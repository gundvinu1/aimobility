import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  CreateGeofenceDto,
  UpdateGeofenceDto,
  ListGeofencesQueryDto,
} from './dto/geofence.dto';
import {
  validateGeometry,
  isPointInGeofence,
  LatLng,
  GeofenceGeometry,
} from './utils/geofence-math.util';
import type {
  GeofenceDto,
  GeofenceVehicleDto,
  GeofenceType,
} from '@ai-mos/types';

export interface AuditMeta {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class GeofenceService {
  private readonly logger = new Logger(GeofenceService.name);

  constructor(private readonly db: DatabaseService) {}

  // ─── CRUD Operations ────────────────────────────────────────────────────────

  async createGeofence(
    companyId: string,
    dto: CreateGeofenceDto,
    userId: string,
    meta?: AuditMeta,
  ): Promise<GeofenceDto> {
    // 1. Validate geometry format
    const validation = validateGeometry(dto.type, dto.geometry);
    if (!validation.valid) {
      throw new BadRequestException(validation.error ?? 'Invalid geofence geometry');
    }

    // 2. Validate vehicles belong to tenant if supplied
    if (dto.vehicleIds && dto.vehicleIds.length > 0) {
      const existingCount = await this.db.vehicle.count({
        where: {
          id: { in: dto.vehicleIds },
          companyId,
          deletedAt: null,
        },
      });
      if (existingCount !== dto.vehicleIds.length) {
        throw new BadRequestException(
          'One or more vehicles do not belong to this company or are invalid',
        );
      }
    }

    // 3. Create geofence record
    const created = await this.db.geofence.create({
      data: {
        companyId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        type: dto.type,
        geometry: dto.geometry as any,
        color: dto.color ?? '#3b82f6',
        isActive: dto.isActive ?? true,
        entryAlertEnabled: dto.entryAlertEnabled ?? true,
        exitAlertEnabled: dto.exitAlertEnabled ?? true,
        createdBy: userId,
        assignedVehicles:
          dto.vehicleIds && dto.vehicleIds.length > 0
            ? {
                createMany: {
                  data: dto.vehicleIds.map((vehicleId) => ({
                    companyId,
                    vehicleId,
                  })),
                },
              }
            : undefined,
      },
      include: {
        _count: {
          select: { assignedVehicles: true },
        },
      },
    });

    // 4. Audit Log
    await this.logAudit('GEOFENCE_CREATED', created.id, companyId, userId, meta, {
      name: created.name,
      type: created.type,
      assignedCount: created._count.assignedVehicles,
    });

    return this.toGeofenceDto(created, created._count.assignedVehicles);
  }

  async updateGeofence(
    companyId: string,
    geofenceId: string,
    dto: UpdateGeofenceDto,
    userId: string,
    meta?: AuditMeta,
  ): Promise<GeofenceDto> {
    const existing = await this.db.geofence.findFirst({
      where: { id: geofenceId, companyId },
      include: {
        _count: { select: { assignedVehicles: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Geofence ${geofenceId} not found in this company`);
    }

    // Validate geometry if updated
    const targetType = dto.type ?? (existing.type as GeofenceType);
    if (dto.geometry) {
      const validation = validateGeometry(targetType, dto.geometry);
      if (!validation.valid) {
        throw new BadRequestException(validation.error ?? 'Invalid geofence geometry');
      }
    }

    // If vehicleIds provided, replace assignments
    if (dto.vehicleIds) {
      if (dto.vehicleIds.length > 0) {
        const validVehiclesCount = await this.db.vehicle.count({
          where: {
            id: { in: dto.vehicleIds },
            companyId,
            deletedAt: null,
          },
        });
        if (validVehiclesCount !== dto.vehicleIds.length) {
          throw new BadRequestException(
            'One or more vehicles do not belong to this company',
          );
        }
      }

      await this.db.geofenceVehicle.deleteMany({
        where: { geofenceId, companyId },
      });

      if (dto.vehicleIds.length > 0) {
        await this.db.geofenceVehicle.createMany({
          data: dto.vehicleIds.map((vehicleId) => ({
            companyId,
            geofenceId,
            vehicleId,
          })),
        });
      }
    }

    const updated = await this.db.geofence.update({
      where: { id: geofenceId },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        description: dto.description !== undefined ? dto.description.trim() : undefined,
        type: dto.type ?? undefined,
        geometry: dto.geometry ? (dto.geometry as any) : undefined,
        color: dto.color ?? undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : undefined,
        entryAlertEnabled:
          dto.entryAlertEnabled !== undefined ? dto.entryAlertEnabled : undefined,
        exitAlertEnabled:
          dto.exitAlertEnabled !== undefined ? dto.exitAlertEnabled : undefined,
      },
      include: {
        _count: { select: { assignedVehicles: true } },
      },
    });

    await this.logAudit('GEOFENCE_UPDATED', geofenceId, companyId, userId, meta, {
      name: updated.name,
      type: updated.type,
      isActive: updated.isActive,
    });

    return this.toGeofenceDto(updated, updated._count.assignedVehicles);
  }

  async deleteGeofence(
    companyId: string,
    geofenceId: string,
    userId: string,
    meta?: AuditMeta,
  ): Promise<{ success: boolean }> {
    const existing = await this.db.geofence.findFirst({
      where: { id: geofenceId, companyId },
    });

    if (!existing) {
      throw new NotFoundException(`Geofence ${geofenceId} not found in this company`);
    }

    await this.db.geofence.delete({
      where: { id: geofenceId },
    });

    await this.logAudit('GEOFENCE_DELETED', geofenceId, companyId, userId, meta, {
      name: existing.name,
    });

    return { success: true };
  }

  async getGeofence(companyId: string, geofenceId: string): Promise<GeofenceDto> {
    const geofence = await this.db.geofence.findFirst({
      where: { id: geofenceId, companyId },
      include: {
        _count: { select: { assignedVehicles: true } },
      },
    });

    if (!geofence) {
      throw new NotFoundException(`Geofence ${geofenceId} not found in this company`);
    }

    return this.toGeofenceDto(geofence, geofence._count.assignedVehicles);
  }

  async listGeofences(
    companyId: string,
    query?: ListGeofencesQueryDto,
  ): Promise<GeofenceDto[]> {
    const where: any = { companyId };

    if (query?.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query?.search) {
      where.name = { contains: query.search.trim(), mode: 'insensitive' };
    }

    const records = await this.db.geofence.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { assignedVehicles: true } },
      },
    });

    return records.map((g) => this.toGeofenceDto(g, g._count.assignedVehicles));
  }

  // ─── Vehicle Assignments ───────────────────────────────────────────────────

  async assignVehicles(
    companyId: string,
    geofenceId: string,
    vehicleIds: string[],
    userId: string,
    meta?: AuditMeta,
  ): Promise<GeofenceVehicleDto[]> {
    const geofence = await this.db.geofence.findFirst({
      where: { id: geofenceId, companyId },
    });
    if (!geofence) {
      throw new NotFoundException(`Geofence ${geofenceId} not found in this company`);
    }

    // Verify all vehicles belong to tenant
    const validVehicles = await this.db.vehicle.findMany({
      where: {
        id: { in: vehicleIds },
        companyId,
        deletedAt: null,
      },
      select: { id: true, vehicleNumber: true, make: true, model: true },
    });

    if (validVehicles.length !== vehicleIds.length) {
      throw new BadRequestException(
        'One or more vehicles do not belong to this company',
      );
    }

    // Delete existing and insert new
    await this.db.geofenceVehicle.deleteMany({
      where: { geofenceId, vehicleId: { in: vehicleIds } },
    });

    await this.db.geofenceVehicle.createMany({
      data: vehicleIds.map((vehicleId) => ({
        companyId,
        geofenceId,
        vehicleId,
      })),
    });

    await this.logAudit(
      'GEOFENCE_VEHICLES_ASSIGNED',
      geofenceId,
      companyId,
      userId,
      meta,
      { assignedCount: vehicleIds.length, vehicleIds },
    );

    return this.getAssignedVehicles(companyId, geofenceId);
  }

  async removeVehicle(
    companyId: string,
    geofenceId: string,
    vehicleId: string,
    userId: string,
    meta?: AuditMeta,
  ): Promise<{ success: boolean }> {
    const existing = await this.db.geofenceVehicle.findFirst({
      where: { geofenceId, vehicleId, companyId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Vehicle assignment not found for vehicle ${vehicleId} in geofence ${geofenceId}`,
      );
    }

    await this.db.geofenceVehicle.delete({
      where: { id: existing.id },
    });

    await this.logAudit(
      'GEOFENCE_VEHICLE_REMOVED',
      geofenceId,
      companyId,
      userId,
      meta,
      { vehicleId },
    );

    return { success: true };
  }

  async getAssignedVehicles(
    companyId: string,
    geofenceId: string,
  ): Promise<GeofenceVehicleDto[]> {
    const assignments = await this.db.geofenceVehicle.findMany({
      where: { geofenceId, companyId },
      include: {
        vehicle: {
          select: {
            vehicleNumber: true,
            make: true,
            model: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    return assignments.map((a) => ({
      id: a.id,
      companyId: a.companyId,
      geofenceId: a.geofenceId,
      vehicleId: a.vehicleId,
      assignedAt: a.assignedAt.toISOString(),
      vehicleNumber: a.vehicle?.vehicleNumber,
      vehicleMakeModel: a.vehicle ? `${a.vehicle.make} ${a.vehicle.model}`.trim() : undefined,
    }));
  }

  /**
   * Retrieves all active geofences applicable to a specific vehicle.
   * If a vehicle is explicitly assigned to geofences, only those are returned.
   * If not explicitly assigned, any company-wide active geofences with 0 assignments
   * are also evaluated.
   */
  async getActiveGeofencesForVehicle(
    companyId: string,
    vehicleId: string,
  ): Promise<Array<{ id: string; name: string; type: GeofenceType; geometry: GeofenceGeometry; entryAlertEnabled: boolean; exitAlertEnabled: boolean }>> {
    // 1. Geofences directly assigned to this vehicle
    const assigned = await this.db.geofence.findMany({
      where: {
        companyId,
        isActive: true,
        assignedVehicles: { some: { vehicleId } },
      },
      select: {
        id: true,
        name: true,
        type: true,
        geometry: true,
        entryAlertEnabled: true,
        exitAlertEnabled: true,
      },
    });

    // 2. Geofences with NO specific vehicle assignments (company-wide geofences)
    const companyWide = await this.db.geofence.findMany({
      where: {
        companyId,
        isActive: true,
        assignedVehicles: { none: {} },
      },
      select: {
        id: true,
        name: true,
        type: true,
        geometry: true,
        entryAlertEnabled: true,
        exitAlertEnabled: true,
      },
    });

    const combined = [...assigned, ...companyWide];
    return combined.map((g) => ({
      id: g.id,
      name: g.name,
      type: g.type as GeofenceType,
      geometry: g.geometry as unknown as GeofenceGeometry,
      entryAlertEnabled: g.entryAlertEnabled,
      exitAlertEnabled: g.exitAlertEnabled,
    }));
  }

  /**
   * Evaluates if a given point is inside a geofence
   */
  isPointInside(
    point: LatLng,
    type: GeofenceType,
    geometry: GeofenceGeometry,
  ): boolean {
    return isPointInGeofence(point, type, geometry);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private toGeofenceDto(
    record: {
      id: string;
      companyId: string;
      name: string;
      description: string | null;
      type: string;
      geometry: any;
      color: string;
      isActive: boolean;
      entryAlertEnabled: boolean;
      exitAlertEnabled: boolean;
      createdBy: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
    assignedCount?: number,
  ): GeofenceDto {
    return {
      id: record.id,
      companyId: record.companyId,
      name: record.name,
      description: record.description,
      type: record.type as GeofenceType,
      geometry: record.geometry as GeofenceGeometry,
      color: record.color,
      isActive: record.isActive,
      entryAlertEnabled: record.entryAlertEnabled,
      exitAlertEnabled: record.exitAlertEnabled,
      assignedVehiclesCount: assignedCount ?? 0,
      createdBy: record.createdBy,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
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
          entityType: 'GEOFENCE',
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
