import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { CreateVehicleDto } from './dto/create-vehicle.dto';
import type { UpdateVehicleDto } from './dto/update-vehicle.dto';
import type { UpdateVehicleStatusDto } from './dto/update-vehicle-status.dto';
import type { ListVehiclesDto } from './dto/list-vehicles.dto';
import type { CreateVehicleDocumentDto } from './dto/create-vehicle-document.dto';
import type { CreateVehicleMaintenanceDto, UpdateMaintenanceStatusDto } from './dto/create-vehicle-maintenance.dto';
import { VEHICLE_AUDIT_EVENTS } from '@ai-mos/constants';
import type {
  VehicleDto,
  VehicleSummaryDto,
  VehicleListDto,
  VehicleStatsDto,
  VehicleDocumentDto,
  VehicleMaintenanceDto,
} from '@ai-mos/types';

// ─── Minimal typed DB delegate ────────────────────────────────────────────────
interface FindOpts {
  where?: Record<string, unknown>;
  include?: Record<string, unknown>;
  data?: Record<string, unknown>;
  orderBy?: unknown;
  select?: Record<string, unknown>;
  skip?: number;
  take?: number;
}
interface Delegate {
  findUnique: (opts: FindOpts) => Promise<unknown>;
  findFirst:  (opts: FindOpts) => Promise<unknown>;
  findMany:   (opts?: FindOpts) => Promise<unknown[]>;
  create:     (opts: FindOpts) => Promise<unknown>;
  update:     (opts: FindOpts) => Promise<unknown>;
  delete:     (opts: FindOpts) => Promise<unknown>;
  count:      (opts?: FindOpts) => Promise<number>;
  groupBy:    (opts: Record<string, unknown>) => Promise<unknown[]>;
}
interface VehicleDb {
  vehicle:            Delegate;
  vehicleDocument:    Delegate;
  vehicleMaintenance: Delegate;
  auditLog:           Delegate;
}

// ─── DB row shapes ────────────────────────────────────────────────────────────
interface VehicleRow {
  id: string; companyId: string;
  vehicleNumber: string; make: string; model: string; year: number;
  color?: string | null; vin?: string | null;
  fuelType: string; ownership: string; status: string;
  capacity?: number | null; odometer: number; imageUrl?: string | null;
  registrationExpiry?: Date | null; insuranceExpiry?: Date | null;
  notes?: string | null;
  createdAt: Date; updatedAt: Date; deletedAt?: Date | null;
  documents?: DocRow[];
  maintenances?: MaintRow[];
}
interface DocRow {
  id: string; vehicleId: string; companyId: string;
  documentType: string; name: string; documentNumber?: string | null;
  issuedAt?: Date | null; expiresAt?: Date | null;
  fileUrl?: string | null; notes?: string | null;
  createdAt: Date; updatedAt: Date;
}
interface MaintRow {
  id: string; vehicleId: string; companyId: string;
  maintenanceType: string; status: string; description: string;
  scheduledAt?: Date | null; startedAt?: Date | null; completedAt?: Date | null;
  odometerAtService?: number | null; cost?: unknown | null;
  vendor?: string | null; notes?: string | null;
  createdAt: Date; updatedAt: Date;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────
function mapSummary(v: VehicleRow): VehicleSummaryDto {
  return {
    id: v.id, companyId: v.companyId,
    vehicleNumber: v.vehicleNumber, make: v.make, model: v.model, year: v.year,
    color: v.color,
    fuelType: v.fuelType as VehicleSummaryDto['fuelType'],
    ownership: v.ownership as VehicleSummaryDto['ownership'],
    status: v.status as VehicleSummaryDto['status'],
    capacity: v.capacity, odometer: v.odometer, imageUrl: v.imageUrl,
    registrationExpiry: v.registrationExpiry?.toISOString() ?? null,
    insuranceExpiry: v.insuranceExpiry?.toISOString() ?? null,
    createdAt: v.createdAt.toISOString(),
  };
}

function mapFull(v: VehicleRow): VehicleDto {
  return {
    ...mapSummary(v),
    notes: v.notes,
    updatedAt: v.updatedAt.toISOString(),
    documents: v.documents?.map(mapDoc),
    maintenances: v.maintenances?.map(mapMaint),
  };
}

function mapDoc(d: DocRow): VehicleDocumentDto {
  return {
    id: d.id, vehicleId: d.vehicleId, companyId: d.companyId,
    documentType: d.documentType as VehicleDocumentDto['documentType'],
    name: d.name, documentNumber: d.documentNumber,
    issuedAt: d.issuedAt?.toISOString() ?? null,
    expiresAt: d.expiresAt?.toISOString() ?? null,
    fileUrl: d.fileUrl, notes: d.notes,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

function mapMaint(m: MaintRow): VehicleMaintenanceDto {
  return {
    id: m.id, vehicleId: m.vehicleId, companyId: m.companyId,
    maintenanceType: m.maintenanceType as VehicleMaintenanceDto['maintenanceType'],
    status: m.status as VehicleMaintenanceDto['status'],
    description: m.description,
    scheduledAt: m.scheduledAt?.toISOString() ?? null,
    startedAt: m.startedAt?.toISOString() ?? null,
    completedAt: m.completedAt?.toISOString() ?? null,
    odometerAtService: m.odometerAtService,
    cost: m.cost != null ? String(m.cost) : null,
    vendor: m.vendor, notes: m.notes,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

interface AuditMeta { ipAddress?: string; userAgent?: string; requestId?: string }

@Injectable()
export class VehicleService {
  private readonly logger = new Logger(VehicleService.name);
  private get db() { return this._db as unknown as VehicleDb; }

  constructor(private readonly _db: DatabaseService) {}

  // ─── Audit helper ──────────────────────────────────────────────────────────

  private async audit(
    action: string,
    entityId: string,
    companyId: string,
    userId: string,
    meta: AuditMeta,
    metadata?: Record<string, unknown>,
  ) {
    await this.db.auditLog.create({
      data: {
        action,
        entityType: 'VEHICLE',
        entityId,
        userId,
        metadata: { companyId, ...metadata },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      },
    });
  }

  // ─── Create vehicle ────────────────────────────────────────────────────────

  async createVehicle(
    dto: CreateVehicleDto,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<VehicleDto> {
    // Check uniqueness within tenant
    const existing = await this.db.vehicle.findFirst({
      where: { companyId, vehicleNumber: dto.vehicleNumber, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(
        `Vehicle number '${dto.vehicleNumber}' already exists in this company.`,
      );
    }

    const vehicle = await this.db.vehicle.create({
      data: {
        companyId,
        vehicleNumber: dto.vehicleNumber,
        make: dto.make,
        model: dto.model,
        year: dto.year,
        color: dto.color,
        vin: dto.vin,
        fuelType: dto.fuelType ?? 'DIESEL',
        ownership: dto.ownership ?? 'OWNED',
        capacity: dto.capacity,
        odometer: dto.odometer ?? 0,
        imageUrl: dto.imageUrl,
        registrationExpiry: dto.registrationExpiry ? new Date(dto.registrationExpiry) : undefined,
        insuranceExpiry: dto.insuranceExpiry ? new Date(dto.insuranceExpiry) : undefined,
        notes: dto.notes,
      },
    }) as VehicleRow;

    await this.audit(VEHICLE_AUDIT_EVENTS.VEHICLE_CREATED, vehicle.id, companyId, userId, meta, {
      vehicleNumber: vehicle.vehicleNumber,
    });

    this.logger.log(`Vehicle created: ${vehicle.id} (${vehicle.vehicleNumber}) in company ${companyId}`);
    return mapFull(vehicle);
  }

  // ─── List vehicles ─────────────────────────────────────────────────────────

  async listVehicles(companyId: string, query: ListVehiclesDto): Promise<VehicleListDto> {
    const page  = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip  = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = { companyId, deletedAt: null };
    if (query.status)    where['status']    = query.status;
    if (query.fuelType)  where['fuelType']  = query.fuelType;
    if (query.ownership) where['ownership'] = query.ownership;
    if (query.search) {
      where['OR'] = [
        { vehicleNumber: { contains: query.search, mode: 'insensitive' } },
        { make:          { contains: query.search, mode: 'insensitive' } },
        { model:         { contains: query.search, mode: 'insensitive' } },
        { vin:           { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const SAFE_SORT = ['vehicleNumber', 'make', 'model', 'year', 'status', 'createdAt'];
    const sortBy    = SAFE_SORT.includes(query.sortBy ?? '') ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [rows, total] = await Promise.all([
      this.db.vehicle.findMany({ where, skip, take: limit, orderBy: { [sortBy!]: sortOrder } }),
      this.db.vehicle.count({ where }),
    ]);

    return {
      vehicles: (rows as VehicleRow[]).map(mapSummary),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Get one vehicle ───────────────────────────────────────────────────────

  async getVehicle(id: string, companyId: string): Promise<VehicleDto> {
    const vehicle = await this.db.vehicle.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        documents: { orderBy: { createdAt: 'desc' } },
        maintenances: { orderBy: { createdAt: 'desc' } },
      },
    }) as VehicleRow | null;

    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return mapFull(vehicle);
  }

  // ─── Update vehicle ────────────────────────────────────────────────────────

  async updateVehicle(
    id: string,
    dto: UpdateVehicleDto,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<VehicleDto> {
    const existing = await this.db.vehicle.findFirst({
      where: { id, companyId, deletedAt: null },
    }) as VehicleRow | null;
    if (!existing) throw new NotFoundException('Vehicle not found');

    // If vehicleNumber changes, ensure no conflict
    if (dto.vehicleNumber && dto.vehicleNumber !== existing.vehicleNumber) {
      const conflict = await this.db.vehicle.findFirst({
        where: { companyId, vehicleNumber: dto.vehicleNumber, deletedAt: null, id: { not: id } },
      });
      if (conflict) {
        throw new ConflictException(`Vehicle number '${dto.vehicleNumber}' already exists.`);
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.vehicleNumber !== undefined) data['vehicleNumber'] = dto.vehicleNumber;
    if (dto.make          !== undefined) data['make']          = dto.make;
    if (dto.model         !== undefined) data['model']         = dto.model;
    if (dto.year          !== undefined) data['year']          = dto.year;
    if (dto.color         !== undefined) data['color']         = dto.color;
    if (dto.vin           !== undefined) data['vin']           = dto.vin;
    if (dto.fuelType      !== undefined) data['fuelType']      = dto.fuelType;
    if (dto.ownership     !== undefined) data['ownership']     = dto.ownership;
    if (dto.capacity      !== undefined) data['capacity']      = dto.capacity;
    if (dto.odometer      !== undefined) data['odometer']      = dto.odometer;
    if (dto.imageUrl      !== undefined) data['imageUrl']      = dto.imageUrl;
    if (dto.notes         !== undefined) data['notes']         = dto.notes;
    if (dto.registrationExpiry !== undefined)
      data['registrationExpiry'] = dto.registrationExpiry ? new Date(dto.registrationExpiry) : null;
    if (dto.insuranceExpiry !== undefined)
      data['insuranceExpiry'] = dto.insuranceExpiry ? new Date(dto.insuranceExpiry) : null;

    const updated = await this.db.vehicle.update({
      where: { id },
      data,
    }) as VehicleRow;

    await this.audit(VEHICLE_AUDIT_EVENTS.VEHICLE_UPDATED, id, companyId, userId, meta);
    return mapFull(updated);
  }

  // ─── Update status ─────────────────────────────────────────────────────────

  async updateVehicleStatus(
    id: string,
    dto: UpdateVehicleStatusDto,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<VehicleDto> {
    const existing = await this.db.vehicle.findFirst({
      where: { id, companyId, deletedAt: null },
    }) as VehicleRow | null;
    if (!existing) throw new NotFoundException('Vehicle not found');

    const updated = await this.db.vehicle.update({
      where: { id },
      data: { status: dto.status },
    }) as VehicleRow;

    await this.audit(VEHICLE_AUDIT_EVENTS.VEHICLE_STATUS_CHANGED, id, companyId, userId, meta, {
      from: existing.status, to: dto.status,
    });
    return mapFull(updated);
  }

  // ─── Soft-delete ───────────────────────────────────────────────────────────

  async deleteVehicle(
    id: string,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<void> {
    const existing = await this.db.vehicle.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Vehicle not found');

    await this.db.vehicle.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit(VEHICLE_AUDIT_EVENTS.VEHICLE_DELETED, id, companyId, userId, meta);
    this.logger.log(`Vehicle soft-deleted: ${id} in company ${companyId}`);
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  async getStats(companyId: string): Promise<VehicleStatsDto> {
    const where = { companyId, deletedAt: null };
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [total, active, inactive, onTrip, maintenance, retired, byFuelRows, byOwnerRows, expiringSoon] =
      await Promise.all([
        this.db.vehicle.count({ where }),
        this.db.vehicle.count({ where: { ...where, status: 'ACTIVE'      } }),
        this.db.vehicle.count({ where: { ...where, status: 'INACTIVE'    } }),
        this.db.vehicle.count({ where: { ...where, status: 'ON_TRIP'     } }),
        this.db.vehicle.count({ where: { ...where, status: 'MAINTENANCE' } }),
        this.db.vehicle.count({ where: { ...where, status: 'RETIRED'     } }),
        this.db.vehicle.groupBy({ by: ['fuelType'], where, _count: true }),
        this.db.vehicle.groupBy({ by: ['ownership'], where, _count: true }),
        // Docs expiring within 30 days
        this.db.vehicleDocument.count({
          where: {
            companyId,
            expiresAt: { gte: new Date(), lte: thirtyDaysFromNow },
          },
        }),
      ]);

    const byFuelType: Record<string, number> = {};
    for (const row of byFuelRows as Array<{ fuelType: string; _count: number }>) {
      byFuelType[row.fuelType] = row._count;
    }
    const byOwnership: Record<string, number> = {};
    for (const row of byOwnerRows as Array<{ ownership: string; _count: number }>) {
      byOwnership[row.ownership] = row._count;
    }

    return { total, active, inactive, onTrip, maintenance, retired, byFuelType, byOwnership, expiringSoon };
  }

  // ─── Documents ─────────────────────────────────────────────────────────────

  async addDocument(
    vehicleId: string,
    dto: CreateVehicleDocumentDto,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<VehicleDocumentDto> {
    await this._assertVehicleAccess(vehicleId, companyId);

    const doc = await this.db.vehicleDocument.create({
      data: {
        vehicleId,
        companyId,
        documentType: dto.documentType,
        name: dto.name,
        documentNumber: dto.documentNumber,
        issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        fileUrl: dto.fileUrl,
        notes: dto.notes,
      },
    }) as DocRow;

    await this.audit(VEHICLE_AUDIT_EVENTS.VEHICLE_DOC_ADDED, vehicleId, companyId, userId, meta, {
      documentId: doc.id, documentType: doc.documentType,
    });
    return mapDoc(doc);
  }

  async getDocuments(vehicleId: string, companyId: string): Promise<VehicleDocumentDto[]> {
    await this._assertVehicleAccess(vehicleId, companyId);
    const docs = await this.db.vehicleDocument.findMany({
      where: { vehicleId, companyId },
      orderBy: { createdAt: 'desc' },
    }) as DocRow[];
    return docs.map(mapDoc);
  }

  async deleteDocument(
    vehicleId: string,
    docId: string,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<void> {
    await this._assertVehicleAccess(vehicleId, companyId);
    const doc = await this.db.vehicleDocument.findFirst({
      where: { id: docId, vehicleId, companyId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    await this.db.vehicleDocument.delete({ where: { id: docId } });
    await this.audit(VEHICLE_AUDIT_EVENTS.VEHICLE_DOC_DELETED, vehicleId, companyId, userId, meta, {
      documentId: docId,
    });
  }

  // ─── Maintenance ───────────────────────────────────────────────────────────

  async addMaintenance(
    vehicleId: string,
    dto: CreateVehicleMaintenanceDto,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<VehicleMaintenanceDto> {
    await this._assertVehicleAccess(vehicleId, companyId);

    const record = await this.db.vehicleMaintenance.create({
      data: {
        vehicleId,
        companyId,
        maintenanceType: dto.maintenanceType ?? 'PREVENTIVE',
        status: 'SCHEDULED',
        description: dto.description,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        odometerAtService: dto.odometerAtService,
        cost: dto.cost,
        vendor: dto.vendor,
        notes: dto.notes,
      },
    }) as MaintRow;

    await this.audit(VEHICLE_AUDIT_EVENTS.VEHICLE_MAINT_CREATED, vehicleId, companyId, userId, meta, {
      maintenanceId: record.id, maintenanceType: record.maintenanceType,
    });
    return mapMaint(record);
  }

  async getMaintenances(vehicleId: string, companyId: string): Promise<VehicleMaintenanceDto[]> {
    await this._assertVehicleAccess(vehicleId, companyId);
    const records = await this.db.vehicleMaintenance.findMany({
      where: { vehicleId, companyId },
      orderBy: { createdAt: 'desc' },
    }) as MaintRow[];
    return records.map(mapMaint);
  }

  async updateMaintenanceStatus(
    vehicleId: string,
    maintId: string,
    dto: UpdateMaintenanceStatusDto,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<VehicleMaintenanceDto> {
    await this._assertVehicleAccess(vehicleId, companyId);

    const existing = await this.db.vehicleMaintenance.findFirst({
      where: { id: maintId, vehicleId, companyId },
    }) as MaintRow | null;
    if (!existing) throw new NotFoundException('Maintenance record not found');

    const data: Record<string, unknown> = { status: dto.status };
    if (dto.status === 'IN_PROGRESS' && !existing.startedAt)  data['startedAt']   = new Date();
    if (dto.status === 'COMPLETED'   && !existing.completedAt) data['completedAt'] = dto.completedAt ? new Date(dto.completedAt) : new Date();
    if (dto.cost  !== undefined) data['cost']  = dto.cost;
    if (dto.notes !== undefined) data['notes'] = dto.notes;

    const updated = await this.db.vehicleMaintenance.update({ where: { id: maintId }, data }) as MaintRow;
    await this.audit(VEHICLE_AUDIT_EVENTS.VEHICLE_MAINT_UPDATED, vehicleId, companyId, userId, meta, {
      maintenanceId: maintId, status: dto.status,
    });
    return mapMaint(updated);
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private async _assertVehicleAccess(vehicleId: string, companyId: string): Promise<void> {
    const vehicle = await this.db.vehicle.findFirst({
      where: { id: vehicleId, companyId, deletedAt: null },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
  }
}
