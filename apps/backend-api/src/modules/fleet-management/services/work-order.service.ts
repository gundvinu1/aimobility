import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  CreateWorkOrderDto,
  UpdateWorkOrderDto,
  UpdateWorkOrderStatusDto,
  QueryWorkOrdersDto,
} from '../dto/work-order.dto';
import { FLEET_MANAGEMENT_AUDIT_EVENTS } from '@ai-mos/constants';
import { calculateNextDueTargets } from '../utils/fleet-math.util';
import type { WorkOrderDto, WorkOrderStatus } from '@ai-mos/types';

export interface AuditMeta {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  DRAFT: ['OPEN', 'CANCELLED'],
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class WorkOrderService {
  private readonly logger = new Logger(WorkOrderService.name);

  constructor(private readonly db: DatabaseService) {}

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
          entityType: 'WORK_ORDER',
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

  private async generateWorkOrderNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.db.workOrder.count({ where: { companyId } });
    const sequence = String(count + 1).padStart(4, '0');
    return `WO-${year}-${sequence}`;
  }

  async createWorkOrder(
    companyId: string,
    dto: CreateWorkOrderDto,
    userId?: string,
    meta?: AuditMeta,
  ): Promise<WorkOrderDto> {
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

    if (dto.scheduleId) {
      const schedule = await this.db.maintenanceSchedule.findFirst({
        where: { id: dto.scheduleId, companyId },
      });
      if (!schedule) {
        throw new BadRequestException(`Maintenance schedule ${dto.scheduleId} not found in this company`);
      }
    }

    const workOrderNumber = await this.generateWorkOrderNumber(companyId);

    // Calculate line items cost if provided
    let itemsTotal = 0;
    const itemsData = (dto.items || []).map((item) => {
      const lineCost = Math.round(item.quantity * item.unitCost * 100) / 100;
      itemsTotal += lineCost;
      return {
        companyId,
        itemType: item.itemType ?? 'PARTS',
        description: item.description,
        quantity: item.quantity,
        unitCost: item.unitCost,
        totalCost: lineCost,
      };
    });

    const estimatedCost = dto.estimatedCost ?? itemsTotal;

    const created = await this.db.workOrder.create({
      data: {
        companyId,
        vehicleId: dto.vehicleId,
        vendorId: dto.vendorId ?? null,
        scheduleId: dto.scheduleId ?? null,
        workOrderNumber,
        title: dto.title,
        description: dto.description ?? null,
        priority: dto.priority ?? 'MEDIUM',
        status: 'DRAFT',
        assignedTechnician: dto.assignedTechnician ?? null,
        estimatedCost,
        actualCost: itemsTotal,
        openedAt: new Date(),
        notes: dto.notes ?? null,
        createdBy: userId ?? null,
        items: {
          create: itemsData,
        },
      },
      include: {
        vehicle: { select: { vehicleNumber: true } },
        vendor: { select: { name: true } },
        items: true,
      },
    });

    await this.logAudit(
      FLEET_MANAGEMENT_AUDIT_EVENTS.WORK_ORDER_CREATED,
      created.id,
      companyId,
      userId,
      meta,
      { workOrderNumber, vehicleId: dto.vehicleId },
    );

    return this.mapToDto(created);
  }

  async listWorkOrders(
    companyId: string,
    query: QueryWorkOrdersDto,
  ): Promise<{ data: WorkOrderDto[]; total: number; page: number; limit: number; totalPages: number }> {
    const where: any = { companyId };
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.db.workOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { openedAt: 'desc' },
        include: {
          vehicle: { select: { vehicleNumber: true } },
          vendor: { select: { name: true } },
          items: true,
        },
      }),
      this.db.workOrder.count({ where }),
    ]);

    return {
      data: items.map((w) => this.mapToDto(w)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getWorkOrder(companyId: string, id: string): Promise<WorkOrderDto> {
    const item = await this.db.workOrder.findFirst({
      where: { id, companyId },
      include: {
        vehicle: { select: { vehicleNumber: true } },
        vendor: { select: { name: true } },
        items: true,
      },
    });

    if (!item) {
      throw new NotFoundException(`Work order ${id} not found`);
    }

    return this.mapToDto(item);
  }

  async updateWorkOrder(
    companyId: string,
    id: string,
    dto: UpdateWorkOrderDto,
    userId?: string,
    meta?: AuditMeta,
  ): Promise<WorkOrderDto> {
    const existing = await this.db.workOrder.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException(`Work order ${id} not found`);
    }

    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot update work order in ${existing.status} status`);
    }

    if (dto.vendorId) {
      const vendor = await this.db.vendor.findFirst({
        where: { id: dto.vendorId, companyId },
      });
      if (!vendor) {
        throw new BadRequestException(`Vendor ${dto.vendorId} not found in this company`);
      }
    }

    const updated = await this.db.workOrder.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.vendorId !== undefined ? { vendorId: dto.vendorId } : {}),
        ...(dto.assignedTechnician !== undefined ? { assignedTechnician: dto.assignedTechnician } : {}),
        ...(dto.estimatedCost !== undefined ? { estimatedCost: dto.estimatedCost } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: {
        vehicle: { select: { vehicleNumber: true } },
        vendor: { select: { name: true } },
        items: true,
      },
    });

    await this.logAudit(
      FLEET_MANAGEMENT_AUDIT_EVENTS.WORK_ORDER_UPDATED,
      id,
      companyId,
      userId,
      meta,
    );

    return this.mapToDto(updated);
  }

  async updateStatus(
    companyId: string,
    id: string,
    dto: UpdateWorkOrderStatusDto,
    userId?: string,
    meta?: AuditMeta,
  ): Promise<WorkOrderDto> {
    const existing = await this.db.workOrder.findFirst({
      where: { id, companyId },
      include: {
        vehicle: { select: { vehicleNumber: true, odometer: true } },
        items: true,
      },
    });
    if (!existing) {
      throw new NotFoundException(`Work order ${id} not found`);
    }

    const currentStatus = existing.status as WorkOrderStatus;
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${dto.status}. Allowed transitions: ${allowed.join(', ') || 'None'}`,
      );
    }

    const now = new Date();
    const updateData: any = {
      status: dto.status,
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    };

    if (dto.status === 'IN_PROGRESS' && !existing.startedAt) {
      updateData.startedAt = now;
    }

    if (dto.status === 'COMPLETED') {
      updateData.completedAt = now;
      const actualCost = dto.actualCost ?? existing.actualCost;
      updateData.actualCost = actualCost;

      // Automatically generate a completed MaintenanceRecord if none exists for this work order
      const existingRecord = await this.db.maintenanceRecord.findFirst({
        where: { workOrderId: id, companyId },
      });

      if (!existingRecord) {
        const createdRecord = await this.db.maintenanceRecord.create({
          data: {
            companyId,
            vehicleId: existing.vehicleId,
            scheduleId: existing.scheduleId,
            workOrderId: id,
            vendorId: existing.vendorId,
            serviceType: existing.title,
            odometer: existing.vehicle.odometer,
            serviceDate: now,
            partsCost: existing.items
              .filter((i) => i.itemType === 'PARTS')
              .reduce((sum, i) => sum + i.totalCost, 0),
            laborCost: existing.items
              .filter((i) => i.itemType === 'LABOR')
              .reduce((sum, i) => sum + i.totalCost, 0),
            totalCost: actualCost,
            description: existing.description ?? `Work Order ${existing.workOrderNumber} completed`,
            createdBy: userId ?? null,
          },
        });

        // Record a linked vehicle expense referencing the created record
        await this.db.vehicleExpense.create({
          data: {
            companyId,
            vehicleId: existing.vehicleId,
            vendorId: existing.vendorId,
            maintenanceRecordId: createdRecord.id,
            category: 'MAINTENANCE',
            amount: actualCost,
            date: now,
            reference: existing.workOrderNumber,
            description: `Work Order: ${existing.title}`,
            source: 'WORK_ORDER',
            createdBy: userId ?? null,
          },
        });

        // If work order was opened for a preventive schedule, advance the schedule targets
        if (existing.scheduleId) {
          const sched = await this.db.maintenanceSchedule.findFirst({
            where: { id: existing.scheduleId, companyId },
          });
          if (sched) {
            const { nextDueOdometer, nextDueDate } = calculateNextDueTargets(
              sched.intervalKm,
              sched.intervalDays,
              existing.vehicle.odometer,
              now,
            );
            await this.db.maintenanceSchedule.update({
              where: { id: existing.scheduleId },
              data: {
                lastServiceOdometer: existing.vehicle.odometer,
                lastServiceDate: now,
                nextDueOdometer,
                nextDueDate,
              },
            });
          }
        }
      }
    }

    const updated = await this.db.workOrder.update({
      where: { id },
      data: updateData,
      include: {
        vehicle: { select: { vehicleNumber: true } },
        vendor: { select: { name: true } },
        items: true,
      },
    });

    await this.logAudit(
      FLEET_MANAGEMENT_AUDIT_EVENTS.WORK_ORDER_STATUS_CHANGED,
      id,
      companyId,
      userId,
      meta,
      { previousStatus: currentStatus, newStatus: dto.status },
    );

    return this.mapToDto(updated);
  }

  async deleteWorkOrder(
    companyId: string,
    id: string,
    userId?: string,
    meta?: AuditMeta,
  ): Promise<{ success: boolean }> {
    const existing = await this.db.workOrder.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException(`Work order ${id} not found`);
    }

    if (existing.status !== 'DRAFT' && existing.status !== 'CANCELLED') {
      throw new BadRequestException('Only DRAFT or CANCELLED work orders can be deleted');
    }

    await this.db.workOrder.delete({ where: { id } });

    await this.logAudit(
      'WORK_ORDER_DELETED',
      id,
      companyId,
      userId,
      meta,
    );

    return { success: true };
  }

  private mapToDto(w: any): WorkOrderDto {
    return {
      id: w.id,
      companyId: w.companyId,
      vehicleId: w.vehicleId,
      vehicleNumber: w.vehicle?.vehicleNumber,
      vendorId: w.vendorId,
      vendorName: w.vendor?.name,
      scheduleId: w.scheduleId,
      workOrderNumber: w.workOrderNumber,
      title: w.title,
      description: w.description,
      priority: w.priority,
      status: w.status,
      assignedTechnician: w.assignedTechnician,
      estimatedCost: w.estimatedCost,
      actualCost: w.actualCost,
      openedAt: w.openedAt ? new Date(w.openedAt).toISOString() : new Date().toISOString(),
      startedAt: w.startedAt ? new Date(w.startedAt).toISOString() : null,
      completedAt: w.completedAt ? new Date(w.completedAt).toISOString() : null,
      notes: w.notes,
      items: (w.items || []).map((i: any) => ({
        id: i.id,
        companyId: i.companyId,
        workOrderId: i.workOrderId,
        itemType: i.itemType,
        description: i.description,
        quantity: i.quantity,
        unitCost: i.unitCost,
        totalCost: i.totalCost,
        createdAt: i.createdAt ? new Date(i.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: i.updatedAt ? new Date(i.updatedAt).toISOString() : new Date().toISOString(),
      })),
      createdBy: w.createdBy,
      createdAt: w.createdAt ? new Date(w.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: w.updatedAt ? new Date(w.updatedAt).toISOString() : new Date().toISOString(),
    };
  }
}
