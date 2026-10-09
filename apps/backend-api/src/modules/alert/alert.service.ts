import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { TelemetryGateway } from '../telemetry/telemetry.gateway';
import {
  QueryAlertsDto,
  UpdateCompanyAlertConfigDto,
} from './dto/alert.dto';
import {
  ALERT_DEFAULTS,
} from '@ai-mos/constants';
import type {
  FleetAlertDto,
  FleetAlertListDto,
  FleetAlertSummaryDto,
  CompanyAlertConfigDto,
  DriverSafetySummaryDto,
  VehicleSafetySummaryDto,
  FleetAlertType,
  FleetAlertSeverity,
  FleetAlertStatus,
} from '@ai-mos/types';

export interface AuditMeta {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export interface CreateAlertParams {
  companyId: string;
  vehicleId: string;
  driverId?: string | null;
  tripId?: string | null;
  geofenceId?: string | null;
  type: FleetAlertType;
  severity: FleetAlertSeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  latitude?: number | null;
  longitude?: number | null;
  speed?: number | null;
  triggeredAt?: Date;
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    private readonly db: DatabaseService,
    @Inject(forwardRef(() => TelemetryGateway))
    private readonly telemetryGateway: TelemetryGateway,
  ) {}

  // ─── Company Alert Configuration ──────────────────────────────────────────

  async getCompanyConfig(companyId: string): Promise<CompanyAlertConfigDto> {
    let config = await this.db.companyAlertConfig.findUnique({
      where: { companyId },
    });

    if (!config) {
      config = await this.db.companyAlertConfig.create({
        data: {
          companyId,
          overspeedEnabled: true,
          overspeedThresholdKmH: ALERT_DEFAULTS.OVERSPEED_THRESHOLD_KMH,
          overspeedGracePeriodSeconds: ALERT_DEFAULTS.OVERSPEED_GRACE_PERIOD_SECONDS,
          harshBrakingEnabled: true,
          harshBrakingThresholdKmhPerSec: ALERT_DEFAULTS.HARSH_BRAKING_THRESHOLD_KMH_PER_SEC,
          excessiveIdleEnabled: true,
          excessiveIdleThresholdMinutes: ALERT_DEFAULTS.EXCESSIVE_IDLE_MINUTES,
          geofenceEntryAlertsEnabled: true,
          geofenceExitAlertsEnabled: true,
          fuelDropEnabled: true,
          fuelDropThresholdLiters: 10.0,
          maintenanceAlertsEnabled: true,
        },
      });
    }

    return this.toConfigDto(config);
  }

  async updateCompanyConfig(
    companyId: string,
    dto: UpdateCompanyAlertConfigDto,
    userId: string,
    meta?: AuditMeta,
  ): Promise<CompanyAlertConfigDto> {
    const updated = await this.db.companyAlertConfig.upsert({
      where: { companyId },
      create: {
        companyId,
        overspeedEnabled: dto.overspeedEnabled ?? true,
        overspeedThresholdKmH: dto.overspeedThresholdKmH ?? ALERT_DEFAULTS.OVERSPEED_THRESHOLD_KMH,
        overspeedGracePeriodSeconds:
          dto.overspeedGracePeriodSeconds ?? ALERT_DEFAULTS.OVERSPEED_GRACE_PERIOD_SECONDS,
        harshBrakingEnabled: dto.harshBrakingEnabled ?? true,
        harshBrakingThresholdKmhPerSec:
          dto.harshBrakingThresholdKmhPerSec ?? ALERT_DEFAULTS.HARSH_BRAKING_THRESHOLD_KMH_PER_SEC,
        excessiveIdleEnabled: dto.excessiveIdleEnabled ?? true,
        excessiveIdleThresholdMinutes:
          dto.excessiveIdleThresholdMinutes ?? ALERT_DEFAULTS.EXCESSIVE_IDLE_MINUTES,
        geofenceEntryAlertsEnabled: dto.geofenceEntryAlertsEnabled ?? true,
        geofenceExitAlertsEnabled: dto.geofenceExitAlertsEnabled ?? true,
        fuelDropEnabled: dto.fuelDropEnabled ?? true,
        fuelDropThresholdLiters: dto.fuelDropThresholdLiters ?? 10.0,
        maintenanceAlertsEnabled: dto.maintenanceAlertsEnabled ?? true,
      },
      update: {
        overspeedEnabled: dto.overspeedEnabled !== undefined ? dto.overspeedEnabled : undefined,
        overspeedThresholdKmH:
          dto.overspeedThresholdKmH !== undefined ? dto.overspeedThresholdKmH : undefined,
        overspeedGracePeriodSeconds:
          dto.overspeedGracePeriodSeconds !== undefined
            ? dto.overspeedGracePeriodSeconds
            : undefined,
        harshBrakingEnabled:
          dto.harshBrakingEnabled !== undefined ? dto.harshBrakingEnabled : undefined,
        harshBrakingThresholdKmhPerSec:
          dto.harshBrakingThresholdKmhPerSec !== undefined
            ? dto.harshBrakingThresholdKmhPerSec
            : undefined,
        excessiveIdleEnabled:
          dto.excessiveIdleEnabled !== undefined ? dto.excessiveIdleEnabled : undefined,
        excessiveIdleThresholdMinutes:
          dto.excessiveIdleThresholdMinutes !== undefined
            ? dto.excessiveIdleThresholdMinutes
            : undefined,
        geofenceEntryAlertsEnabled:
          dto.geofenceEntryAlertsEnabled !== undefined
            ? dto.geofenceEntryAlertsEnabled
            : undefined,
        geofenceExitAlertsEnabled:
          dto.geofenceExitAlertsEnabled !== undefined
            ? dto.geofenceExitAlertsEnabled
            : undefined,
        fuelDropEnabled: dto.fuelDropEnabled !== undefined ? dto.fuelDropEnabled : undefined,
        fuelDropThresholdLiters:
          dto.fuelDropThresholdLiters !== undefined ? dto.fuelDropThresholdLiters : undefined,
        maintenanceAlertsEnabled:
          dto.maintenanceAlertsEnabled !== undefined ? dto.maintenanceAlertsEnabled : undefined,
      },
    });

    await this.logAudit(
      'ALERT_CONFIG_UPDATED',
      updated.id,
      companyId,
      userId,
      meta,
      dto as Record<string, unknown>,
    );

    return this.toConfigDto(updated);
  }

  // ─── Alert Lifecycle & Ingestion ───────────────────────────────────────────

  async createAlert(params: CreateAlertParams): Promise<FleetAlertDto> {
    const created = await this.db.fleetAlert.create({
      data: {
        companyId: params.companyId,
        vehicleId: params.vehicleId,
        driverId: params.driverId ?? null,
        tripId: params.tripId ?? null,
        geofenceId: params.geofenceId ?? null,
        type: params.type,
        severity: params.severity,
        status: 'OPEN',
        title: params.title,
        message: params.message,
        metadata: (params.metadata as any) ?? null,
        latitude: params.latitude ?? null,
        longitude: params.longitude ?? null,
        speed: params.speed ?? null,
        triggeredAt: params.triggeredAt ?? new Date(),
      },
      include: {
        vehicle: { select: { vehicleNumber: true } },
        driver: {
          select: {
            driverCode: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
        trip: { select: { tripNumber: true } },
        geofence: { select: { name: true } },
      },
    });

    const alertDto = this.toAlertDto(created);

    // Broadcast to tenant-scoped WebSocket channel
    if (this.telemetryGateway) {
      this.telemetryGateway.broadcastAlertCreated(params.companyId, alertDto);
    }

    this.logger.log(
      `Fleet Alert [${params.type}:${params.severity}] created for vehicle ${params.vehicleId} [tenant: ${params.companyId}]`,
    );

    return alertDto;
  }

  async listAlerts(
    companyId: string,
    query: QueryAlertsDto,
  ): Promise<FleetAlertListDto> {
    const where: any = { companyId };

    if (query.type) where.type = query.type;
    if (query.severity) where.severity = query.severity;
    if (query.status) where.status = query.status;
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.driverId) where.driverId = query.driverId;
    if (query.geofenceId) where.geofenceId = query.geofenceId;

    if (query.startDate || query.endDate) {
      where.triggeredAt = {};
      if (query.startDate) where.triggeredAt.gte = new Date(query.startDate);
      if (query.endDate) where.triggeredAt.lte = new Date(query.endDate);
    }

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { message: { contains: s, mode: 'insensitive' } },
        { vehicle: { vehicleNumber: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [total, records] = await Promise.all([
      this.db.fleetAlert.count({ where }),
      this.db.fleetAlert.findMany({
        where,
        skip,
        take: limit,
        orderBy: { triggeredAt: 'desc' },
        include: {
          vehicle: { select: { vehicleNumber: true } },
          driver: {
            select: {
              driverCode: true,
              employee: { select: { firstName: true, lastName: true } },
            },
          },
          trip: { select: { tripNumber: true } },
          geofence: { select: { name: true } },
        },
      }),
    ]);

    return {
      alerts: records.map((r) => this.toAlertDto(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getAlert(companyId: string, alertId: string): Promise<FleetAlertDto> {
    const alert = await this.db.fleetAlert.findFirst({
      where: { id: alertId, companyId },
      include: {
        vehicle: { select: { vehicleNumber: true } },
        driver: {
          select: {
            driverCode: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
        trip: { select: { tripNumber: true } },
        geofence: { select: { name: true } },
      },
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found in this company`);
    }

    return this.toAlertDto(alert);
  }

  async getAlertSummary(companyId: string): Promise<FleetAlertSummaryDto> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalOpen,
      criticalCount,
      highCount,
      acknowledgedCount,
      resolvedTodayCount,
      totalAlerts,
    ] = await Promise.all([
      this.db.fleetAlert.count({
        where: { companyId, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      }),
      this.db.fleetAlert.count({
        where: { companyId, status: 'OPEN', severity: 'CRITICAL' },
      }),
      this.db.fleetAlert.count({
        where: { companyId, status: 'OPEN', severity: 'HIGH' },
      }),
      this.db.fleetAlert.count({
        where: { companyId, status: 'ACKNOWLEDGED' },
      }),
      this.db.fleetAlert.count({
        where: {
          companyId,
          status: 'RESOLVED',
          resolvedAt: { gte: todayStart },
        },
      }),
      this.db.fleetAlert.count({
        where: { companyId },
      }),
    ]);

    return {
      totalOpen,
      criticalCount,
      highCount,
      acknowledgedCount,
      resolvedTodayCount,
      totalAlerts,
    };
  }

  async acknowledgeAlert(
    companyId: string,
    alertId: string,
    userId: string,
    notes?: string,
    meta?: AuditMeta,
  ): Promise<FleetAlertDto> {
    const existing = await this.db.fleetAlert.findFirst({
      where: { id: alertId, companyId },
    });
    if (!existing) {
      throw new NotFoundException(`Alert ${alertId} not found in this company`);
    }

    if (existing.status !== 'OPEN') {
      throw new BadRequestException(
        `Cannot acknowledge an alert with status ${existing.status}`,
      );
    }

    const updated = await this.db.fleetAlert.update({
      where: { id: alertId },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
        resolutionNotes: notes ?? existing.resolutionNotes,
      },
      include: {
        vehicle: { select: { vehicleNumber: true } },
        driver: {
          select: {
            driverCode: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
        trip: { select: { tripNumber: true } },
        geofence: { select: { name: true } },
      },
    });

    const alertDto = this.toAlertDto(updated);

    if (this.telemetryGateway) {
      this.telemetryGateway.broadcastAlertAcknowledged(companyId, alertDto);
    }

    await this.logAudit('ALERT_ACKNOWLEDGED', alertId, companyId, userId, meta, {
      notes,
    });

    return alertDto;
  }

  async resolveAlert(
    companyId: string,
    alertId: string,
    userId: string,
    notes?: string,
    meta?: AuditMeta,
  ): Promise<FleetAlertDto> {
    const existing = await this.db.fleetAlert.findFirst({
      where: { id: alertId, companyId },
    });
    if (!existing) {
      throw new NotFoundException(`Alert ${alertId} not found in this company`);
    }

    if (existing.status === 'RESOLVED') {
      throw new BadRequestException('Alert is already resolved');
    }

    const updated = await this.db.fleetAlert.update({
      where: { id: alertId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy: userId,
        resolutionNotes: notes ?? existing.resolutionNotes,
      },
      include: {
        vehicle: { select: { vehicleNumber: true } },
        driver: {
          select: {
            driverCode: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
        trip: { select: { tripNumber: true } },
        geofence: { select: { name: true } },
      },
    });

    const alertDto = this.toAlertDto(updated);

    if (this.telemetryGateway) {
      this.telemetryGateway.broadcastAlertResolved(companyId, alertDto);
    }

    await this.logAudit('ALERT_RESOLVED', alertId, companyId, userId, meta, {
      notes,
    });

    return alertDto;
  }

  async dismissAlert(
    companyId: string,
    alertId: string,
    userId: string,
    notes?: string,
    meta?: AuditMeta,
  ): Promise<FleetAlertDto> {
    const existing = await this.db.fleetAlert.findFirst({
      where: { id: alertId, companyId },
    });
    if (!existing) {
      throw new NotFoundException(`Alert ${alertId} not found in this company`);
    }

    const updated = await this.db.fleetAlert.update({
      where: { id: alertId },
      data: {
        status: 'DISMISSED',
        dismissedAt: new Date(),
        dismissedBy: userId,
        resolutionNotes: notes ?? existing.resolutionNotes,
      },
      include: {
        vehicle: { select: { vehicleNumber: true } },
        driver: {
          select: {
            driverCode: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
        trip: { select: { tripNumber: true } },
        geofence: { select: { name: true } },
      },
    });

    const alertDto = this.toAlertDto(updated);

    if (this.telemetryGateway) {
      this.telemetryGateway.broadcastAlertUpdated(companyId, alertDto);
    }

    await this.logAudit('ALERT_DISMISSED', alertId, companyId, userId, meta, {
      notes,
    });

    return alertDto;
  }

  // ─── Driver & Vehicle Safety Analytics ─────────────────────────────────────

  async getDriverSafetySummary(
    companyId: string,
    driverId?: string,
  ): Promise<DriverSafetySummaryDto[]> {
    const where: any = { companyId, driverId: { not: null } };
    if (driverId) {
      where.driverId = driverId;
    }

    const alerts = await this.db.fleetAlert.findMany({
      where,
      select: {
        driverId: true,
        type: true,
        severity: true,
        driver: {
          select: {
            id: true,
            driverCode: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    const map = new Map<string, DriverSafetySummaryDto>();

    for (const a of alerts) {
      if (!a.driverId || !a.driver) continue;
      if (!map.has(a.driverId)) {
        const emp = a.driver.employee;
        const name = emp ? `${emp.firstName} ${emp.lastName}`.trim() : a.driver.driverCode;
        map.set(a.driverId, {
          driverId: a.driverId,
          driverCode: a.driver.driverCode,
          driverName: name,
          totalAlerts: 0,
          overspeedCount: 0,
          harshBrakingCount: 0,
          excessiveIdleCount: 0,
          geofenceViolationsCount: 0,
          highSeverityCount: 0,
        });
      }

      const item = map.get(a.driverId)!;
      item.totalAlerts += 1;
      if (a.type === 'OVERSPEED') item.overspeedCount += 1;
      if (a.type === 'HARSH_BRAKING') item.harshBrakingCount += 1;
      if (a.type === 'EXCESSIVE_IDLE') item.excessiveIdleCount += 1;
      if (a.type === 'GEOFENCE_ENTRY' || a.type === 'GEOFENCE_EXIT') {
        item.geofenceViolationsCount += 1;
      }
      if (a.severity === 'HIGH' || a.severity === 'CRITICAL') {
        item.highSeverityCount += 1;
      }
    }

    return Array.from(map.values());
  }

  async getVehicleSafetySummary(
    companyId: string,
    vehicleId?: string,
  ): Promise<VehicleSafetySummaryDto[]> {
    const where: any = { companyId };
    if (vehicleId) {
      where.vehicleId = vehicleId;
    }

    const alerts = await this.db.fleetAlert.findMany({
      where,
      select: {
        vehicleId: true,
        type: true,
        severity: true,
        vehicle: { select: { id: true, vehicleNumber: true } },
      },
    });

    const map = new Map<string, VehicleSafetySummaryDto>();

    for (const a of alerts) {
      if (!a.vehicleId || !a.vehicle) continue;
      if (!map.has(a.vehicleId)) {
        map.set(a.vehicleId, {
          vehicleId: a.vehicleId,
          vehicleNumber: a.vehicle.vehicleNumber,
          totalAlerts: 0,
          overspeedCount: 0,
          harshBrakingCount: 0,
          excessiveIdleCount: 0,
          geofenceViolationsCount: 0,
          highSeverityCount: 0,
        });
      }

      const item = map.get(a.vehicleId)!;
      item.totalAlerts += 1;
      if (a.type === 'OVERSPEED') item.overspeedCount += 1;
      if (a.type === 'HARSH_BRAKING') item.harshBrakingCount += 1;
      if (a.type === 'EXCESSIVE_IDLE') item.excessiveIdleCount += 1;
      if (a.type === 'GEOFENCE_ENTRY' || a.type === 'GEOFENCE_EXIT') {
        item.geofenceViolationsCount += 1;
      }
      if (a.severity === 'HIGH' || a.severity === 'CRITICAL') {
        item.highSeverityCount += 1;
      }
    }

    return Array.from(map.values());
  }

  // ─── Helper Converters ─────────────────────────────────────────────────────

  private toConfigDto(config: any): CompanyAlertConfigDto {
    return {
      id: config.id,
      companyId: config.companyId,
      overspeedEnabled: config.overspeedEnabled,
      overspeedThresholdKmH: config.overspeedThresholdKmH,
      overspeedGracePeriodSeconds: config.overspeedGracePeriodSeconds,
      harshBrakingEnabled: config.harshBrakingEnabled,
      harshBrakingThresholdKmhPerSec: config.harshBrakingThresholdKmhPerSec,
      excessiveIdleEnabled: config.excessiveIdleEnabled,
      excessiveIdleThresholdMinutes: config.excessiveIdleThresholdMinutes,
      geofenceEntryAlertsEnabled: config.geofenceEntryAlertsEnabled,
      geofenceExitAlertsEnabled: config.geofenceExitAlertsEnabled,
      fuelDropEnabled: config.fuelDropEnabled ?? true,
      fuelDropThresholdLiters: config.fuelDropThresholdLiters ?? 10.0,
      maintenanceAlertsEnabled: config.maintenanceAlertsEnabled ?? true,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    };
  }

  private toAlertDto(alert: any): FleetAlertDto {
    let driverName: string | null = null;
    if (alert.driver) {
      const emp = alert.driver.employee;
      driverName = emp ? `${emp.firstName} ${emp.lastName}`.trim() : alert.driver.driverCode;
    }

    return {
      id: alert.id,
      companyId: alert.companyId,
      vehicleId: alert.vehicleId,
      vehicleNumber: alert.vehicle?.vehicleNumber,
      driverId: alert.driverId,
      driverName,
      tripId: alert.tripId,
      tripNumber: alert.trip?.tripNumber,
      geofenceId: alert.geofenceId,
      geofenceName: alert.geofence?.name,
      type: alert.type as FleetAlertType,
      severity: alert.severity as FleetAlertSeverity,
      status: alert.status as FleetAlertStatus,
      title: alert.title,
      message: alert.message,
      metadata: alert.metadata as Record<string, unknown> | null,
      latitude: alert.latitude,
      longitude: alert.longitude,
      speed: alert.speed,
      triggeredAt: alert.triggeredAt.toISOString(),
      acknowledgedAt: alert.acknowledgedAt?.toISOString() ?? null,
      acknowledgedBy: alert.acknowledgedBy,
      resolvedAt: alert.resolvedAt?.toISOString() ?? null,
      resolvedBy: alert.resolvedBy,
      dismissedAt: alert.dismissedAt?.toISOString() ?? null,
      dismissedBy: alert.dismissedBy,
      resolutionNotes: alert.resolutionNotes,
      createdAt: alert.createdAt.toISOString(),
      updatedAt: alert.updatedAt.toISOString(),
    };
  }

  private async logAudit(
    action: string,
    entityId: string,
    companyId: string,
    userId: string,
    meta?: AuditMeta,
    metadata?: Record<string, unknown>,
  ) {
    try {
      await this.db.auditLog.create({
        data: {
          action,
          entityType: 'ALERT',
          entityId,
          userId,
          metadata: { companyId, ...metadata },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
          requestId: meta?.requestId,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to record audit log for ${action}: ${err}`);
    }
  }
}
