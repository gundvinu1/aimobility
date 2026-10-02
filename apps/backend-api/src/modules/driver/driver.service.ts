import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { CreateDriverDto } from './dto/create-driver.dto';
import type { UpdateDriverDto } from './dto/update-driver.dto';
import type { UpdateDriverStatusDto } from './dto/update-driver-status.dto';
import type { UpdateDutyStatusDto } from './dto/update-duty-status.dto';
import type { ListDriversDto } from './dto/list-drivers.dto';
import type { CreateDriverDocumentDto } from './dto/create-driver-document.dto';
import type { UpdateDriverDocumentDto } from './dto/update-driver-document.dto';
import type { CreateDutyLogDto } from './dto/create-duty-log.dto';
import type { AssignVehicleDto } from './dto/assign-vehicle.dto';
import { DRIVER_AUDIT_EVENTS } from '@ai-mos/constants';
import type {
  DriverDto,
  DriverSummaryDto,
  DriverListDto,
  DriverStatsDto,
  DriverDocumentDto,
  DriverDutyLogDto,
  DriverVehicleAssignmentDto,
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
  findFirst: (opts: FindOpts) => Promise<unknown>;
  findMany: (opts?: FindOpts) => Promise<unknown[]>;
  create: (opts: FindOpts) => Promise<unknown>;
  update: (opts: FindOpts) => Promise<unknown>;
  updateMany?: (opts: FindOpts) => Promise<unknown>;
  delete: (opts: FindOpts) => Promise<unknown>;
  count: (opts?: FindOpts) => Promise<number>;
  groupBy?: (opts: Record<string, unknown>) => Promise<unknown[]>;
}

interface DriverDb {
  driver: Delegate;
  driverDocument: Delegate;
  driverDutyLog: Delegate;
  driverVehicleAssignment: Delegate;
  employee: Delegate;
  vehicle: Delegate;
  auditLog: Delegate;
}

interface AuditMeta {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

interface EmployeeEmbed {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  employmentStatus: string;
  userId?: string | null;
}

interface VehicleAssignmentEmbed {
  id: string;
  assignedAt: Date;
  vehicle: {
    id: string;
    vehicleNumber: string;
    make: string;
    model: string;
    year?: number;
    status?: string;
  };
}

interface DriverRow {
  id: string;
  companyId: string;
  employeeId?: string | null;
  driverCode: string;
  licenseNumber: string;
  licenseType: string;
  licenseIssueDate?: Date | null;
  licenseExpiryDate: Date;
  licenseIssuingAuthority?: string | null;
  badgeNumber?: string | null;
  badgeExpiryDate?: Date | null;
  experienceYears: number;
  bloodGroup?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  status: string;
  dutyStatus: string;
  joiningDate: Date;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  employee?: EmployeeEmbed | null;
  vehicleAssignments?: VehicleAssignmentEmbed[];
  documents?: DriverDocRow[];
  dutyLogs?: DriverDutyLogRow[];
}

interface DriverDocRow {
  id: string;
  driverId: string;
  companyId: string;
  documentType: string;
  documentNumber?: string | null;
  issueDate?: Date | null;
  expiryDate?: Date | null;
  fileUrl?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

interface DriverDutyLogRow {
  id: string;
  driverId: string;
  companyId: string;
  status: string;
  startedAt: Date;
  endedAt?: Date | null;
  notes?: string | null;
  createdAt: Date;
}

interface DriverAssignmentRow {
  id: string;
  companyId: string;
  driverId: string;
  vehicleId: string;
  assignedAt: Date;
  unassignedAt?: Date | null;
  isActive: boolean;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  vehicle?: {
    id: string;
    vehicleNumber: string;
    make: string;
    model: string;
    year?: number;
    status?: string;
  } | null;
  driver?: {
    id: string;
    driverCode: string;
    employee?: {
      firstName: string;
      lastName: string;
    } | null;
  } | null;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────
function mapSummary(d: DriverRow): DriverSummaryDto {
  const activeAssignment = d.vehicleAssignments?.[0];
  return {
    id: d.id,
    companyId: d.companyId,
    employeeId: d.employeeId,
    driverCode: d.driverCode,
    licenseNumber: d.licenseNumber,
    licenseType: d.licenseType as DriverSummaryDto['licenseType'],
    licenseExpiryDate: d.licenseExpiryDate.toISOString(),
    experienceYears: d.experienceYears,
    status: d.status as DriverSummaryDto['status'],
    dutyStatus: d.dutyStatus as DriverSummaryDto['dutyStatus'],
    joiningDate: d.joiningDate.toISOString(),
    employee: d.employee
      ? {
          id: d.employee.id,
          employeeNumber: d.employee.employeeNumber,
          firstName: d.employee.firstName,
          lastName: d.employee.lastName,
          phone: d.employee.phone,
          email: d.employee.email,
          employmentStatus: d.employee.employmentStatus,
        }
      : null,
    assignedVehicle: activeAssignment?.vehicle
      ? {
          id: activeAssignment.vehicle.id,
          vehicleNumber: activeAssignment.vehicle.vehicleNumber,
          make: activeAssignment.vehicle.make,
          model: activeAssignment.vehicle.model,
          year: activeAssignment.vehicle.year,
          status: activeAssignment.vehicle.status,
          assignmentId: activeAssignment.id,
          assignedAt: activeAssignment.assignedAt.toISOString(),
        }
      : null,
    createdAt: d.createdAt.toISOString(),
  };
}

function mapFull(d: DriverRow): DriverDto {
  return {
    ...mapSummary(d),
    licenseIssueDate: d.licenseIssueDate?.toISOString() ?? null,
    licenseIssuingAuthority: d.licenseIssuingAuthority ?? null,
    badgeNumber: d.badgeNumber ?? null,
    badgeExpiryDate: d.badgeExpiryDate?.toISOString() ?? null,
    bloodGroup: d.bloodGroup ?? null,
    emergencyContactName: d.emergencyContactName ?? null,
    emergencyContactPhone: d.emergencyContactPhone ?? null,
    notes: d.notes ?? null,
    documents: d.documents?.map(mapDoc),
    dutyLogs: d.dutyLogs?.map(mapDutyLog),
    vehicleAssignments: d.vehicleAssignments?.map(mapAssignment),
    updatedAt: d.updatedAt.toISOString(),
  };
}

function mapDoc(doc: DriverDocRow): DriverDocumentDto {
  return {
    id: doc.id,
    driverId: doc.driverId,
    companyId: doc.companyId,
    documentType: doc.documentType as DriverDocumentDto['documentType'],
    documentNumber: doc.documentNumber ?? null,
    issueDate: doc.issueDate?.toISOString() ?? null,
    expiryDate: doc.expiryDate?.toISOString() ?? null,
    fileUrl: doc.fileUrl ?? null,
    notes: doc.notes ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function mapDutyLog(log: DriverDutyLogRow): DriverDutyLogDto {
  return {
    id: log.id,
    driverId: log.driverId,
    companyId: log.companyId,
    status: log.status as DriverDutyLogDto['status'],
    startedAt: log.startedAt.toISOString(),
    endedAt: log.endedAt?.toISOString() ?? null,
    notes: log.notes ?? null,
    createdAt: log.createdAt.toISOString(),
  };
}

function mapAssignment(a: DriverAssignmentRow | VehicleAssignmentEmbed): DriverVehicleAssignmentDto {
  return {
    id: a.id,
    companyId: (a as DriverAssignmentRow).companyId ?? '',
    driverId: (a as DriverAssignmentRow).driverId ?? '',
    vehicleId: (a as DriverAssignmentRow).vehicleId ?? a.vehicle?.id ?? '',
    assignedAt: a.assignedAt.toISOString(),
    unassignedAt: (a as DriverAssignmentRow).unassignedAt?.toISOString() ?? null,
    isActive: (a as DriverAssignmentRow).isActive ?? true,
    notes: (a as DriverAssignmentRow).notes ?? null,
    vehicle: a.vehicle
      ? {
          id: a.vehicle.id,
          vehicleNumber: a.vehicle.vehicleNumber,
          make: a.vehicle.make,
          model: a.vehicle.model,
          year: a.vehicle.year,
          status: a.vehicle.status,
        }
      : null,
    driver: (a as DriverAssignmentRow).driver
      ? {
          id: (a as DriverAssignmentRow).driver!.id,
          driverCode: (a as DriverAssignmentRow).driver!.driverCode,
          employee: (a as DriverAssignmentRow).driver!.employee
            ? {
                firstName: (a as DriverAssignmentRow).driver!.employee!.firstName,
                lastName: (a as DriverAssignmentRow).driver!.employee!.lastName,
              }
            : null,
        }
      : null,
    createdAt: ((a as DriverAssignmentRow).createdAt ?? a.assignedAt).toISOString(),
    updatedAt: ((a as DriverAssignmentRow).updatedAt ?? a.assignedAt).toISOString(),
  };
}

@Injectable()
export class DriverService {
  private readonly logger = new Logger(DriverService.name);
  private get db() {
    return this._db as unknown as DriverDb;
  }

  constructor(private readonly _db: DatabaseService) {}

  // ─── Audit Helper ───────────────────────────────────────────────────────────
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
        entityType: 'DRIVER',
        entityId,
        userId,
        metadata: { companyId, ...metadata },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      },
    });
  }

  // ─── Create Driver ──────────────────────────────────────────────────────────
  async createDriver(
    dto: CreateDriverDto,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<DriverDto> {
    // 1. Uniqueness check on driverCode within company
    const existingCode = await this.db.driver.findFirst({
      where: { companyId, driverCode: dto.driverCode, deletedAt: null },
    });
    if (existingCode) {
      throw new ConflictException(`Driver code '${dto.driverCode}' already exists in this company.`);
    }

    // 2. If employeeId is given, ensure employee belongs to company and isn't already a driver
    if (dto.employeeId) {
      const employee = (await this.db.employee.findFirst({
        where: { id: dto.employeeId, companyId, deletedAt: null },
      })) as { id: string } | null;

      if (!employee) {
        throw new NotFoundException(`Employee not found in this company.`);
      }

      const existingDriverEmployee = await this.db.driver.findFirst({
        where: { employeeId: dto.employeeId, deletedAt: null },
      });
      if (existingDriverEmployee) {
        throw new ConflictException(`This employee is already linked to another driver.`);
      }
    }

    const driver = (await this.db.driver.create({
      data: {
        companyId,
        employeeId: dto.employeeId ?? null,
        driverCode: dto.driverCode,
        licenseNumber: dto.licenseNumber,
        licenseType: dto.licenseType ?? 'COMMERCIAL',
        licenseIssueDate: dto.licenseIssueDate ? new Date(dto.licenseIssueDate) : null,
        licenseExpiryDate: new Date(dto.licenseExpiryDate),
        licenseIssuingAuthority: dto.licenseIssuingAuthority,
        badgeNumber: dto.badgeNumber,
        badgeExpiryDate: dto.badgeExpiryDate ? new Date(dto.badgeExpiryDate) : null,
        experienceYears: dto.experienceYears ?? 0,
        bloodGroup: dto.bloodGroup,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
        status: dto.status ?? 'ACTIVE',
        dutyStatus: dto.dutyStatus ?? 'OFF_DUTY',
        joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : new Date(),
        notes: dto.notes,
      },
      include: {
        employee: true,
      },
    })) as DriverRow;

    // Log initial duty log if dutyStatus specified
    if (driver.dutyStatus !== 'OFF_DUTY') {
      await this.db.driverDutyLog.create({
        data: {
          driverId: driver.id,
          companyId,
          status: driver.dutyStatus,
          notes: 'Initial duty status on creation',
        },
      });
    }

    await this.audit(DRIVER_AUDIT_EVENTS.DRIVER_CREATED, driver.id, companyId, userId, meta, {
      driverCode: driver.driverCode,
    });

    this.logger.log(`Driver created: ${driver.id} (${driver.driverCode}) in company ${companyId}`);
    return mapFull(driver);
  }

  // ─── List Drivers ───────────────────────────────────────────────────────────
  async listDrivers(
    companyId: string,
    query: ListDriversDto,
    currentUserRole?: string,
    currentUserId?: string,
  ): Promise<DriverListDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { companyId, deletedAt: null };

    // If caller is role DRIVER, restrict to own driver record
    if (currentUserRole === 'DRIVER' && currentUserId) {
      where['employee'] = { userId: currentUserId };
    }

    if (query.status) where['status'] = query.status;
    if (query.dutyStatus) where['dutyStatus'] = query.dutyStatus;
    if (query.licenseType) where['licenseType'] = query.licenseType;

    if (query.licenseExpiringDays) {
      const now = new Date();
      const future = new Date(now.getTime() + query.licenseExpiringDays * 24 * 60 * 60 * 1000);
      where['licenseExpiryDate'] = { lte: future };
    }

    if (query.search) {
      where['OR'] = [
        { driverCode: { contains: query.search, mode: 'insensitive' } },
        { licenseNumber: { contains: query.search, mode: 'insensitive' } },
        { employee: { firstName: { contains: query.search, mode: 'insensitive' } } },
        { employee: { lastName: { contains: query.search, mode: 'insensitive' } } },
        { employee: { phone: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const SAFE_SORT = [
      'driverCode',
      'licenseNumber',
      'licenseExpiryDate',
      'experienceYears',
      'joiningDate',
      'status',
      'dutyStatus',
      'createdAt',
    ];
    const sortBy = SAFE_SORT.includes(query.sortBy ?? '') ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [rows, total] = await Promise.all([
      this.db.driver.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy!]: sortOrder },
        include: {
          employee: true,
          vehicleAssignments: {
            where: { isActive: true },
            take: 1,
            include: { vehicle: true },
          },
        },
      }),
      this.db.driver.count({ where }),
    ]);

    return {
      drivers: (rows as DriverRow[]).map(mapSummary),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Get Stats ──────────────────────────────────────────────────────────────
  async getStats(companyId: string): Promise<DriverStatsDto> {
    const whereBase: Record<string, unknown> = { companyId, deletedAt: null };
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      total,
      active,
      inactive,
      suspended,
      terminated,
      onDuty,
      offDuty,
      onTrip,
      onBreak,
      unavailable,
      expiringLicenses,
    ] = await Promise.all([
      this.db.driver.count({ where: whereBase }),
      this.db.driver.count({ where: { ...whereBase, status: 'ACTIVE' } }),
      this.db.driver.count({ where: { ...whereBase, status: 'INACTIVE' } }),
      this.db.driver.count({ where: { ...whereBase, status: 'SUSPENDED' } }),
      this.db.driver.count({ where: { ...whereBase, status: 'TERMINATED' } }),
      this.db.driver.count({ where: { ...whereBase, dutyStatus: 'ON_DUTY' } }),
      this.db.driver.count({ where: { ...whereBase, dutyStatus: 'OFF_DUTY' } }),
      this.db.driver.count({ where: { ...whereBase, dutyStatus: 'ON_TRIP' } }),
      this.db.driver.count({ where: { ...whereBase, dutyStatus: 'ON_BREAK' } }),
      this.db.driver.count({ where: { ...whereBase, dutyStatus: 'UNAVAILABLE' } }),
      this.db.driver.count({
        where: {
          ...whereBase,
          licenseExpiryDate: { lte: in30Days },
        },
      }),
    ]);

    return {
      total,
      active,
      inactive,
      suspended,
      terminated,
      onDuty,
      offDuty,
      onTrip,
      onBreak,
      unavailable,
      expiringLicenses,
    };
  }

  // ─── Get One Driver ─────────────────────────────────────────────────────────
  async getDriver(
    id: string,
    companyId: string,
    currentUserRole?: string,
    currentUserId?: string,
  ): Promise<DriverDto> {
    const driver = (await this.db.driver.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        employee: true,
        documents: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        dutyLogs: { orderBy: { startedAt: 'desc' }, take: 20 },
        vehicleAssignments: {
          where: { isActive: true },
          include: { vehicle: true },
          take: 1,
        },
      },
    })) as DriverRow | null;

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    // Role check for DRIVER: can only view own record
    if (currentUserRole === 'DRIVER' && currentUserId) {
      if (!driver.employee?.userId || driver.employee.userId !== currentUserId) {
        throw new ForbiddenException('You can only view your own driver record.');
      }
    }

    return mapFull(driver);
  }

  // ─── Update Driver ──────────────────────────────────────────────────────────
  async updateDriver(
    id: string,
    dto: UpdateDriverDto,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<DriverDto> {
    const existing = (await this.db.driver.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { employee: true },
    })) as DriverRow | null;

    if (!existing) {
      throw new NotFoundException('Driver not found');
    }

    // Check unique driverCode if changing
    if (dto.driverCode && dto.driverCode !== existing.driverCode) {
      const conflict = await this.db.driver.findFirst({
        where: { companyId, driverCode: dto.driverCode, deletedAt: null, id: { not: id } },
      });
      if (conflict) {
        throw new ConflictException(`Driver code '${dto.driverCode}' already exists.`);
      }
    }

    // Check unique employeeId if changing
    if (dto.employeeId !== undefined && dto.employeeId !== existing.employeeId) {
      if (dto.employeeId !== null) {
        const emp = await this.db.employee.findFirst({
          where: { id: dto.employeeId, companyId, deletedAt: null },
        });
        if (!emp) {
          throw new NotFoundException('Employee not found in this company.');
        }

        const conflict = await this.db.driver.findFirst({
          where: { employeeId: dto.employeeId, deletedAt: null, id: { not: id } },
        });
        if (conflict) {
          throw new ConflictException('This employee is already linked to another driver.');
        }
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.driverCode !== undefined) data['driverCode'] = dto.driverCode;
    if (dto.employeeId !== undefined) data['employeeId'] = dto.employeeId;
    if (dto.licenseNumber !== undefined) data['licenseNumber'] = dto.licenseNumber;
    if (dto.licenseType !== undefined) data['licenseType'] = dto.licenseType;
    if (dto.licenseIssueDate !== undefined)
      data['licenseIssueDate'] = dto.licenseIssueDate ? new Date(dto.licenseIssueDate) : null;
    if (dto.licenseExpiryDate !== undefined)
      data['licenseExpiryDate'] = new Date(dto.licenseExpiryDate);
    if (dto.licenseIssuingAuthority !== undefined)
      data['licenseIssuingAuthority'] = dto.licenseIssuingAuthority;
    if (dto.badgeNumber !== undefined) data['badgeNumber'] = dto.badgeNumber;
    if (dto.badgeExpiryDate !== undefined)
      data['badgeExpiryDate'] = dto.badgeExpiryDate ? new Date(dto.badgeExpiryDate) : null;
    if (dto.experienceYears !== undefined) data['experienceYears'] = dto.experienceYears;
    if (dto.bloodGroup !== undefined) data['bloodGroup'] = dto.bloodGroup;
    if (dto.emergencyContactName !== undefined)
      data['emergencyContactName'] = dto.emergencyContactName;
    if (dto.emergencyContactPhone !== undefined)
      data['emergencyContactPhone'] = dto.emergencyContactPhone;
    if (dto.status !== undefined) data['status'] = dto.status;
    if (dto.dutyStatus !== undefined) data['dutyStatus'] = dto.dutyStatus;
    if (dto.joiningDate !== undefined)
      data['joiningDate'] = dto.joiningDate ? new Date(dto.joiningDate) : new Date();
    if (dto.notes !== undefined) data['notes'] = dto.notes;

    const updated = (await this.db.driver.update({
      where: { id },
      data,
      include: {
        employee: true,
        vehicleAssignments: {
          where: { isActive: true },
          include: { vehicle: true },
          take: 1,
        },
      },
    })) as DriverRow;

    await this.audit(DRIVER_AUDIT_EVENTS.DRIVER_UPDATED, id, companyId, userId, meta);
    return mapFull(updated);
  }

  // ─── Update Driver Status ───────────────────────────────────────────────────
  async updateDriverStatus(
    id: string,
    dto: UpdateDriverStatusDto,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<DriverDto> {
    const existing = (await this.db.driver.findFirst({
      where: { id, companyId, deletedAt: null },
    })) as DriverRow | null;

    if (!existing) {
      throw new NotFoundException('Driver not found');
    }

    const updated = (await this.db.driver.update({
      where: { id },
      data: { status: dto.status },
      include: {
        employee: true,
        vehicleAssignments: {
          where: { isActive: true },
          include: { vehicle: true },
          take: 1,
        },
      },
    })) as DriverRow;

    await this.audit(DRIVER_AUDIT_EVENTS.DRIVER_STATUS_CHANGED, id, companyId, userId, meta, {
      from: existing.status,
      to: dto.status,
    });

    return mapFull(updated);
  }

  // ─── Update Duty Status ─────────────────────────────────────────────────────
  async updateDutyStatus(
    id: string,
    dto: UpdateDutyStatusDto,
    companyId: string,
    userId: string,
    meta: AuditMeta,
    currentUserRole?: string,
  ): Promise<DriverDto> {
    const existing = (await this.db.driver.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { employee: true },
    })) as DriverRow | null;

    if (!existing) {
      throw new NotFoundException('Driver not found');
    }

    // Role check: DRIVER role can only modify own duty status
    if (currentUserRole === 'DRIVER') {
      if (!existing.employee?.userId || existing.employee.userId !== userId) {
        throw new ForbiddenException('You can only update your own duty status.');
      }
    }

    // End previous open duty log
    const lastOpenLog = (await this.db.driverDutyLog.findFirst({
      where: { driverId: id, companyId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    })) as { id: string } | null;

    if (lastOpenLog) {
      await this.db.driverDutyLog.update({
        where: { id: lastOpenLog.id },
        data: { endedAt: new Date() },
      });
    }

    // Create new duty log record
    await this.db.driverDutyLog.create({
      data: {
        driverId: id,
        companyId,
        status: dto.dutyStatus,
        startedAt: new Date(),
        notes: dto.notes ?? `Duty status changed to ${dto.dutyStatus}`,
      },
    });

    const updated = (await this.db.driver.update({
      where: { id },
      data: { dutyStatus: dto.dutyStatus },
      include: {
        employee: true,
        vehicleAssignments: {
          where: { isActive: true },
          include: { vehicle: true },
          take: 1,
        },
      },
    })) as DriverRow;

    await this.audit(DRIVER_AUDIT_EVENTS.DRIVER_DUTY_STATUS_CHANGED, id, companyId, userId, meta, {
      from: existing.dutyStatus,
      to: dto.dutyStatus,
    });

    return mapFull(updated);
  }

  // ─── Soft-Delete Driver ─────────────────────────────────────────────────────
  async deleteDriver(
    id: string,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<void> {
    const existing = (await this.db.driver.findFirst({
      where: { id, companyId, deletedAt: null },
    })) as DriverRow | null;

    if (!existing) {
      throw new NotFoundException('Driver not found');
    }

    // Deactivate active vehicle assignments
    const activeAssignment = (await this.db.driverVehicleAssignment.findFirst({
      where: { driverId: id, companyId, isActive: true },
    })) as { id: string } | null;

    if (activeAssignment) {
      await this.db.driverVehicleAssignment.update({
        where: { id: activeAssignment.id },
        data: { isActive: false, unassignedAt: new Date(), notes: 'Driver deleted' },
      });
    }

    await this.db.driver.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit(DRIVER_AUDIT_EVENTS.DRIVER_DELETED, id, companyId, userId, meta, {
      driverCode: existing.driverCode,
    });

    this.logger.log(`Driver soft-deleted: ${id} (${existing.driverCode}) in company ${companyId}`);
  }

  // ─── Documents Management ───────────────────────────────────────────────────
  async getDocuments(
    driverId: string,
    companyId: string,
    currentUserRole?: string,
    currentUserId?: string,
  ): Promise<DriverDocumentDto[]> {
    const driver = (await this.db.driver.findFirst({
      where: { id: driverId, companyId, deletedAt: null },
      include: { employee: true },
    })) as DriverRow | null;

    if (!driver) throw new NotFoundException('Driver not found');

    if (currentUserRole === 'DRIVER' && currentUserId) {
      if (!driver.employee?.userId || driver.employee.userId !== currentUserId) {
        throw new ForbiddenException('You can only view your own driver documents.');
      }
    }

    const docs = (await this.db.driverDocument.findMany({
      where: { driverId, companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    })) as DriverDocRow[];

    return docs.map(mapDoc);
  }

  async addDocument(
    driverId: string,
    dto: CreateDriverDocumentDto,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<DriverDocumentDto> {
    const driver = await this.db.driver.findFirst({
      where: { id: driverId, companyId, deletedAt: null },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const doc = (await this.db.driverDocument.create({
      data: {
        driverId,
        companyId,
        documentType: dto.documentType,
        documentNumber: dto.documentNumber,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        fileUrl: dto.fileUrl,
        notes: dto.notes,
      },
    })) as DriverDocRow;

    await this.audit(DRIVER_AUDIT_EVENTS.DRIVER_DOCUMENT_ADDED, doc.id, companyId, userId, meta, {
      driverId,
      documentType: dto.documentType,
    });

    return mapDoc(doc);
  }

  async updateDocument(
    driverId: string,
    docId: string,
    dto: UpdateDriverDocumentDto,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<DriverDocumentDto> {
    const doc = (await this.db.driverDocument.findFirst({
      where: { id: docId, driverId, companyId, deletedAt: null },
    })) as DriverDocRow | null;

    if (!doc) throw new NotFoundException('Document not found');

    const data: Record<string, unknown> = {};
    if (dto.documentType !== undefined) data['documentType'] = dto.documentType;
    if (dto.documentNumber !== undefined) data['documentNumber'] = dto.documentNumber;
    if (dto.issueDate !== undefined)
      data['issueDate'] = dto.issueDate ? new Date(dto.issueDate) : null;
    if (dto.expiryDate !== undefined)
      data['expiryDate'] = dto.expiryDate ? new Date(dto.expiryDate) : null;
    if (dto.fileUrl !== undefined) data['fileUrl'] = dto.fileUrl;
    if (dto.notes !== undefined) data['notes'] = dto.notes;

    const updated = (await this.db.driverDocument.update({
      where: { id: docId },
      data,
    })) as DriverDocRow;

    await this.audit(DRIVER_AUDIT_EVENTS.DRIVER_DOCUMENT_UPDATED, docId, companyId, userId, meta, {
      driverId,
    });

    return mapDoc(updated);
  }

  async deleteDocument(
    driverId: string,
    docId: string,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<void> {
    const doc = await this.db.driverDocument.findFirst({
      where: { id: docId, driverId, companyId, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Document not found');

    await this.db.driverDocument.update({
      where: { id: docId },
      data: { deletedAt: new Date() },
    });

    await this.audit(DRIVER_AUDIT_EVENTS.DRIVER_DOCUMENT_DELETED, docId, companyId, userId, meta, {
      driverId,
    });
  }

  // ─── Duty History / Logs ────────────────────────────────────────────────────
  async getDutyHistory(
    driverId: string,
    companyId: string,
    currentUserRole?: string,
    currentUserId?: string,
  ): Promise<DriverDutyLogDto[]> {
    const driver = (await this.db.driver.findFirst({
      where: { id: driverId, companyId, deletedAt: null },
      include: { employee: true },
    })) as DriverRow | null;

    if (!driver) throw new NotFoundException('Driver not found');

    if (currentUserRole === 'DRIVER' && currentUserId) {
      if (!driver.employee?.userId || driver.employee.userId !== currentUserId) {
        throw new ForbiddenException('You can only view your own duty history.');
      }
    }

    const logs = (await this.db.driverDutyLog.findMany({
      where: { driverId, companyId },
      orderBy: { startedAt: 'desc' },
      take: 100,
    })) as DriverDutyLogRow[];

    return logs.map(mapDutyLog);
  }

  async createDutyLog(
    driverId: string,
    dto: CreateDutyLogDto,
    companyId: string,
    userId: string,
    meta: AuditMeta,
    currentUserRole?: string,
  ): Promise<DriverDutyLogDto> {
    const driver = (await this.db.driver.findFirst({
      where: { id: driverId, companyId, deletedAt: null },
      include: { employee: true },
    })) as DriverRow | null;

    if (!driver) throw new NotFoundException('Driver not found');

    if (currentUserRole === 'DRIVER') {
      if (!driver.employee?.userId || driver.employee.userId !== userId) {
        throw new ForbiddenException('You can only log duty for your own driver profile.');
      }
    }

    const log = (await this.db.driverDutyLog.create({
      data: {
        driverId,
        companyId,
        status: dto.status,
        startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
        endedAt: dto.endedAt ? new Date(dto.endedAt) : null,
        notes: dto.notes,
      },
    })) as DriverDutyLogRow;

    // Sync driver's current duty status
    await this.db.driver.update({
      where: { id: driverId },
      data: { dutyStatus: dto.status },
    });

    await this.audit(DRIVER_AUDIT_EVENTS.DRIVER_DUTY_STATUS_CHANGED, driverId, companyId, userId, meta, {
      status: dto.status,
    });

    return mapDutyLog(log);
  }

  // ─── Vehicle Assignment ─────────────────────────────────────────────────────
  async getAssignedVehicle(
    driverId: string,
    companyId: string,
  ): Promise<DriverVehicleAssignmentDto | null> {
    const driver = await this.db.driver.findFirst({
      where: { id: driverId, companyId, deletedAt: null },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const assignment = (await this.db.driverVehicleAssignment.findFirst({
      where: { driverId, companyId, isActive: true },
      include: {
        vehicle: true,
        driver: { include: { employee: true } },
      },
    })) as DriverAssignmentRow | null;

    if (!assignment) return null;
    return mapAssignment(assignment);
  }

  async assignVehicle(
    driverId: string,
    dto: AssignVehicleDto,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<DriverVehicleAssignmentDto> {
    // 1. Verify driver belongs to company and is active
    const driver = (await this.db.driver.findFirst({
      where: { id: driverId, companyId, deletedAt: null },
    })) as DriverRow | null;

    if (!driver) throw new NotFoundException('Driver not found in this company');

    // 2. Verify vehicle belongs to company and is not deleted
    const vehicle = (await this.db.vehicle.findFirst({
      where: { id: dto.vehicleId, companyId, deletedAt: null },
    })) as { id: string; vehicleNumber: string } | null;

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found in this company');
    }

    // 3. Deactivate any existing active assignment for this driver
    const existingDriverAssignment = (await this.db.driverVehicleAssignment.findFirst({
      where: { driverId, companyId, isActive: true },
    })) as { id: string } | null;

    if (existingDriverAssignment) {
      await this.db.driverVehicleAssignment.update({
        where: { id: existingDriverAssignment.id },
        data: { isActive: false, unassignedAt: new Date(), notes: 'Reassigned to new vehicle' },
      });
    }

    // 4. Deactivate any existing active assignment for this vehicle
    const existingVehicleAssignment = (await this.db.driverVehicleAssignment.findFirst({
      where: { vehicleId: dto.vehicleId, companyId, isActive: true },
    })) as { id: string } | null;

    if (existingVehicleAssignment && existingVehicleAssignment.id !== existingDriverAssignment?.id) {
      await this.db.driverVehicleAssignment.update({
        where: { id: existingVehicleAssignment.id },
        data: { isActive: false, unassignedAt: new Date(), notes: 'Vehicle assigned to another driver' },
      });
    }

    // 5. Create new assignment
    const assignment = (await this.db.driverVehicleAssignment.create({
      data: {
        companyId,
        driverId,
        vehicleId: dto.vehicleId,
        assignedAt: new Date(),
        isActive: true,
        notes: dto.notes,
      },
      include: {
        vehicle: true,
        driver: { include: { employee: true } },
      },
    })) as DriverAssignmentRow;

    await this.audit(DRIVER_AUDIT_EVENTS.DRIVER_VEHICLE_ASSIGNED, assignment.id, companyId, userId, meta, {
      driverId,
      vehicleId: dto.vehicleId,
      vehicleNumber: vehicle.vehicleNumber,
    });

    this.logger.log(
      `Vehicle ${dto.vehicleId} assigned to driver ${driverId} in company ${companyId}`,
    );

    return mapAssignment(assignment);
  }

  async unassignVehicle(
    driverId: string,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<void> {
    const driver = await this.db.driver.findFirst({
      where: { id: driverId, companyId, deletedAt: null },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const activeAssignment = (await this.db.driverVehicleAssignment.findFirst({
      where: { driverId, companyId, isActive: true },
    })) as { id: string; vehicleId: string } | null;

    if (!activeAssignment) {
      throw new NotFoundException('No active vehicle assignment found for this driver');
    }

    await this.db.driverVehicleAssignment.update({
      where: { id: activeAssignment.id },
      data: {
        isActive: false,
        unassignedAt: new Date(),
        notes: 'Unassigned by administrator',
      },
    });

    await this.audit(
      DRIVER_AUDIT_EVENTS.DRIVER_VEHICLE_UNASSIGNED,
      activeAssignment.id,
      companyId,
      userId,
      meta,
      {
        driverId,
        vehicleId: activeAssignment.vehicleId,
      },
    );

    this.logger.log(`Vehicle unassigned from driver ${driverId} in company ${companyId}`);
  }
}
