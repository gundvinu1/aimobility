import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CacheService } from '../../cache/cache.service';
import { AlertService } from '../../alert/alert.service';
import {
  CreateMaintenanceScheduleDto,
  UpdateMaintenanceScheduleDto,
  QueryMaintenanceSchedulesDto,
  CreateMaintenanceRecordDto,
  QueryMaintenanceRecordsDto,
} from '../dto/maintenance.dto';
import {
  evaluateMaintenanceDueStatus,
  calculateNextDueTargets,
} from '../utils/fleet-math.util';
import {
  FLEET_MANAGEMENT_AUDIT_EVENTS,
  ALERT_REDIS_KEYS,
} from '@ai-mos/constants';
import type {
  MaintenanceScheduleDto,
  MaintenanceRecordDto,
} from '@ai-mos/types';

export interface AuditMeta {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService,
    @Optional()
    @Inject(forwardRef(() => AlertService))
    private readonly alertService?: AlertService,
  ) {}

  private async logAudit(
    action: string,
    entityId: string,
    companyId: string,
    userId?: string,
    meta?: AuditMeta,
    metadata?: Record<string, unknown>,
  ) {
    try {
      await this.db.auditLog.create({
        data: {
          action,
          entityType: 'MAINTENANCE',
          entityId,
          userId: userId ?? null,
          metadata: { companyId, ...metadata },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
          requestId: meta?.requestId,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to log audit for ${action}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // ─── Maintenance Schedules ──────────────────────────────────────────────────

  async createSchedule(
    companyId: string,
    dto: CreateMaintenanceScheduleDto,
    userId?: string,
    meta?: AuditMeta,
  ): Promise<MaintenanceScheduleDto> {
    const vehicle = await this.db.vehicle.findFirst({
      where: { id: dto.vehicleId, companyId, deletedAt: null },
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${dto.vehicleId} not found in this company`);
    }

    const { nextDueOdometer, nextDueDate } = calculateNextDueTargets(
      dto.intervalKm,
      dto.intervalDays,
      dto.lastServiceOdometer ?? vehicle.odometer,
      dto.lastServiceDate,
    );

    const created = await this.db.maintenanceSchedule.create({
      data: {
        companyId,
        vehicleId: dto.vehicleId,
        serviceType: dto.serviceType,
        description: dto.description ?? null,
        intervalKm: dto.intervalKm ?? null,
        intervalDays: dto.intervalDays ?? null,
        lastServiceOdometer: dto.lastServiceOdometer ?? null,
        lastServiceDate: dto.lastServiceDate ? new Date(dto.lastServiceDate) : null,
        nextDueOdometer: dto.nextDueOdometer ?? nextDueOdometer,
        nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : nextDueDate,
        isActive: dto.isActive ?? true,
        createdBy: userId ?? null,
      },
      include: {
        vehicle: { select: { vehicleNumber: true, odometer: true } },
      },
    });

    await this.logAudit(
      FLEET_MANAGEMENT_AUDIT_EVENTS.MAINTENANCE_SCHEDULE_CREATED,
      created.id,
      companyId,
      userId,
      meta,
      { vehicleId: dto.vehicleId, serviceType: dto.serviceType },
    );

    return this.mapScheduleToDto(created, created.vehicle.odometer);
  }

  async listSchedules(
    companyId: string,
    query: QueryMaintenanceSchedulesDto,
  ): Promise<{ data: MaintenanceScheduleDto[]; total: number; page: number; limit: number; totalPages: number }> {
    const where: any = { companyId };
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.db.maintenanceSchedule.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isActive: 'desc' }, { nextDueDate: 'asc' }],
        include: {
          vehicle: { select: { vehicleNumber: true, odometer: true } },
        },
      }),
      this.db.maintenanceSchedule.count({ where }),
    ]);

    let dtos = items.map((s) => this.mapScheduleToDto(s, s.vehicle.odometer));

    if (query.dueStatus) {
      dtos = dtos.filter((d) => d.dueStatus === query.dueStatus);
    }

    return {
      data: dtos,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getSchedule(companyId: string, id: string): Promise<MaintenanceScheduleDto> {
    const item = await this.db.maintenanceSchedule.findFirst({
      where: { id, companyId },
      include: {
        vehicle: { select: { vehicleNumber: true, odometer: true } },
      },
    });

    if (!item) {
      throw new NotFoundException(`Maintenance schedule ${id} not found`);
    }

    return this.mapScheduleToDto(item, item.vehicle.odometer);
  }

  async updateSchedule(
    companyId: string,
    id: string,
    dto: UpdateMaintenanceScheduleDto,
    userId?: string,
    meta?: AuditMeta,
  ): Promise<MaintenanceScheduleDto> {
    const existing = await this.db.maintenanceSchedule.findFirst({
      where: { id, companyId },
      include: { vehicle: { select: { odometer: true } } },
    });
    if (!existing) {
      throw new NotFoundException(`Maintenance schedule ${id} not found`);
    }

    const updated = await this.db.maintenanceSchedule.update({
      where: { id },
      data: {
        ...(dto.serviceType ? { serviceType: dto.serviceType } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.intervalKm !== undefined ? { intervalKm: dto.intervalKm } : {}),
        ...(dto.intervalDays !== undefined ? { intervalDays: dto.intervalDays } : {}),
        ...(dto.lastServiceOdometer !== undefined ? { lastServiceOdometer: dto.lastServiceOdometer } : {}),
        ...(dto.lastServiceDate ? { lastServiceDate: new Date(dto.lastServiceDate) } : {}),
        ...(dto.nextDueOdometer !== undefined ? { nextDueOdometer: dto.nextDueOdometer } : {}),
        ...(dto.nextDueDate ? { nextDueDate: new Date(dto.nextDueDate) } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        vehicle: { select: { vehicleNumber: true, odometer: true } },
      },
    });

    await this.logAudit(
      FLEET_MANAGEMENT_AUDIT_EVENTS.MAINTENANCE_SCHEDULE_UPDATED,
      id,
      companyId,
      userId,
      meta,
    );

    return this.mapScheduleToDto(updated, updated.vehicle.odometer);
  }

  async deleteSchedule(
    companyId: string,
    id: string,
    userId?: string,
    meta?: AuditMeta,
  ): Promise<{ success: boolean }> {
    const existing = await this.db.maintenanceSchedule.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException(`Maintenance schedule ${id} not found`);
    }

    await this.db.maintenanceSchedule.delete({ where: { id } });

    await this.logAudit(
      FLEET_MANAGEMENT_AUDIT_EVENTS.MAINTENANCE_SCHEDULE_DELETED,
      id,
      companyId,
      userId,
      meta,
    );

    return { success: true };
  }

  // ─── Maintenance Records ────────────────────────────────────────────────────

  async createRecord(
    companyId: string,
    dto: CreateMaintenanceRecordDto,
    userId?: string,
    meta?: AuditMeta,
  ): Promise<MaintenanceRecordDto> {
    const vehicle = await this.db.vehicle.findFirst({
      where: { id: dto.vehicleId, companyId, deletedAt: null },
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${dto.vehicleId} not found in this company`);
    }

    if (dto.vendorId) {
      const vendor = await this.db.vendor.findFirst({
        where: { id: dto.vendorId, companyId },
      });
      if (!vendor) {
        throw new BadRequestException(`Vendor ${dto.vendorId} not found in this company`);
      }
    }

    let schedule: any = null;
    if (dto.scheduleId) {
      schedule = await this.db.maintenanceSchedule.findFirst({
        where: { id: dto.scheduleId, companyId },
      });
      if (!schedule) {
        throw new BadRequestException(`Maintenance schedule ${dto.scheduleId} not found in this company`);
      }
    }

    let workOrder: any = null;
    if (dto.workOrderId) {
      workOrder = await this.db.workOrder.findFirst({
        where: { id: dto.workOrderId, companyId },
      });
      if (!workOrder) {
        throw new BadRequestException(`Work order ${dto.workOrderId} not found in this company`);
      }
    }

    const partsCost = dto.partsCost ?? 0;
    const laborCost = dto.laborCost ?? 0;
    const tax = dto.tax ?? 0;
    const totalCost = dto.totalCost ?? (partsCost + laborCost + tax);

    const sDate = dto.serviceDate ? new Date(dto.serviceDate) : new Date();

    const created = await this.db.maintenanceRecord.create({
      data: {
        companyId,
        vehicleId: dto.vehicleId,
        scheduleId: dto.scheduleId ?? null,
        workOrderId: dto.workOrderId ?? null,
        vendorId: dto.vendorId ?? null,
        serviceType: dto.serviceType,
        odometer: dto.odometer ?? null,
        serviceDate: sDate,
        partsCost,
        laborCost,
        tax,
        totalCost,
        description: dto.description ?? null,
        notes: dto.notes ?? null,
        reference: dto.reference ?? null,
        createdBy: userId ?? null,
      },
      include: {
        vehicle: { select: { vehicleNumber: true } },
        vendor: { select: { name: true } },
      },
    });

    // If attached to a schedule, advance the schedule's next due targets
    if (schedule) {
      const { nextDueOdometer, nextDueDate } = calculateNextDueTargets(
        schedule.intervalKm,
        schedule.intervalDays,
        dto.odometer ?? vehicle.odometer,
        sDate,
      );
      await this.db.maintenanceSchedule.update({
        where: { id: schedule.id },
        data: {
          lastServiceOdometer: dto.odometer ?? vehicle.odometer,
          lastServiceDate: sDate,
          nextDueOdometer,
          nextDueDate,
        },
      });
    }

    // Automatically record a unified vehicle expense or link to existing work order expense to prevent double-counting
    let expenseSynced = false;
    if (workOrder) {
      const existingExpense = await this.db.vehicleExpense.findFirst({
        where: {
          companyId,
          reference: workOrder.workOrderNumber,
        },
      });
      if (existingExpense) {
        await this.db.vehicleExpense.update({
          where: { id: existingExpense.id },
          data: { maintenanceRecordId: created.id },
        });
        expenseSynced = true;
      }
    }

    if (!expenseSynced) {
      await this.db.vehicleExpense.create({
        data: {
          companyId,
          vehicleId: dto.vehicleId,
          vendorId: dto.vendorId ?? null,
          maintenanceRecordId: created.id,
          category: 'MAINTENANCE',
          amount: totalCost,
          date: sDate,
          reference: dto.reference ?? `Maint Ref: ${created.id.slice(0, 8)}`,
          description: `${dto.serviceType} completed.`,
          source: 'MAINTENANCE_RECORD',
          createdBy: userId ?? null,
        },
      });
    }

    await this.logAudit(
      FLEET_MANAGEMENT_AUDIT_EVENTS.MAINTENANCE_RECORD_CREATED,
      created.id,
      companyId,
      userId,
      meta,
      { vehicleId: dto.vehicleId, serviceType: dto.serviceType, totalCost },
    );

    return this.mapRecordToDto(created);
  }

  async listRecords(
    companyId: string,
    query: QueryMaintenanceRecordsDto,
  ): Promise<{ data: MaintenanceRecordDto[]; total: number; page: number; limit: number; totalPages: number }> {
    const where: any = { companyId };
    if (query.vehicleId) where.vehicleId = query.vehicleId;

    if (query.startDate || query.endDate) {
      where.serviceDate = {};
      if (query.startDate) where.serviceDate.gte = new Date(query.startDate);
      if (query.endDate) where.serviceDate.lte = new Date(query.endDate);
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.db.maintenanceRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { serviceDate: 'desc' },
        include: {
          vehicle: { select: { vehicleNumber: true } },
          vendor: { select: { name: true } },
        },
      }),
      this.db.maintenanceRecord.count({ where }),
    ]);

    return {
      data: items.map((r) => this.mapRecordToDto(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getRecord(companyId: string, id: string): Promise<MaintenanceRecordDto> {
    const item = await this.db.maintenanceRecord.findFirst({
      where: { id, companyId },
      include: {
        vehicle: { select: { vehicleNumber: true } },
        vendor: { select: { name: true } },
      },
    });

    if (!item) {
      throw new NotFoundException(`Maintenance record ${id} not found`);
    }

    return this.mapRecordToDto(item);
  }

  /**
   * Evaluate company schedules and trigger alerts via Module 10 AlertEngine
   */
  async evaluateMaintenanceReminders(companyId: string): Promise<number> {
    if (!this.alertService) return 0;

    const config = await this.alertService.getCompanyConfig(companyId);
    if (!config.maintenanceAlertsEnabled) return 0;

    const activeSchedules = await this.db.maintenanceSchedule.findMany({
      where: { companyId, isActive: true },
      include: { vehicle: { select: { vehicleNumber: true, odometer: true } } },
    });

    let alertsSent = 0;
    const now = new Date();

    for (const schedule of activeSchedules) {
      const status = evaluateMaintenanceDueStatus(schedule, schedule.vehicle.odometer, now);

      if (status === 'DUE' || status === 'OVERDUE') {
        const dedupeKey = `${ALERT_REDIS_KEYS.maintenanceDueAlert(schedule.id)}:${status}`;
        const existingLock = await this.cache.get(dedupeKey);

        if (!existingLock) {
          // Lock for 24 hours to prevent repeated alerts per day for the same status level
          await this.cache.set(dedupeKey, '1', 86400);

          const severity = status === 'OVERDUE' ? 'HIGH' : 'MEDIUM';
          await this.alertService.createAlert({
            companyId,
            vehicleId: schedule.vehicleId,
            type: 'MAINTENANCE_DUE',
            severity,
            title: `Vehicle ${schedule.vehicle.vehicleNumber} Maintenance ${status === 'OVERDUE' ? 'Overdue' : 'Due'}`,
            message: `Scheduled service "${schedule.serviceType}" is ${status.toLowerCase()} for vehicle ${schedule.vehicle.vehicleNumber}.`,
            metadata: {
              scheduleId: schedule.id,
              serviceType: schedule.serviceType,
              status,
              nextDueOdometer: schedule.nextDueOdometer,
              nextDueDate: schedule.nextDueDate?.toISOString(),
              currentOdometer: schedule.vehicle.odometer,
            },
          });

          alertsSent++;
        }
      }
    }

    return alertsSent;
  }

  private mapScheduleToDto(s: any, currentOdometer?: number): MaintenanceScheduleDto {
    const dueStatus = evaluateMaintenanceDueStatus(s, currentOdometer);
    return {
      id: s.id,
      companyId: s.companyId,
      vehicleId: s.vehicleId,
      vehicleNumber: s.vehicle?.vehicleNumber,
      serviceType: s.serviceType,
      description: s.description,
      intervalKm: s.intervalKm,
      intervalDays: s.intervalDays,
      lastServiceOdometer: s.lastServiceOdometer,
      lastServiceDate: s.lastServiceDate ? s.lastServiceDate.toISOString() : null,
      nextDueOdometer: s.nextDueOdometer,
      nextDueDate: s.nextDueDate ? s.nextDueDate.toISOString() : null,
      isActive: s.isActive,
      dueStatus,
      currentOdometer,
      createdBy: s.createdBy,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  private mapRecordToDto(r: any): MaintenanceRecordDto {
    return {
      id: r.id,
      companyId: r.companyId,
      vehicleId: r.vehicleId,
      vehicleNumber: r.vehicle?.vehicleNumber,
      scheduleId: r.scheduleId,
      workOrderId: r.workOrderId,
      vendorId: r.vendorId,
      vendorName: r.vendor?.name,
      serviceType: r.serviceType,
      odometer: r.odometer,
      serviceDate: r.serviceDate.toISOString(),
      partsCost: r.partsCost,
      laborCost: r.laborCost,
      tax: r.tax,
      totalCost: r.totalCost,
      description: r.description,
      notes: r.notes,
      reference: r.reference,
      createdBy: r.createdBy,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
