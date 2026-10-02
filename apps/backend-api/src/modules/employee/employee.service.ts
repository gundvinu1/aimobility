import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { CreateEmployeeDto } from './dto/create-employee.dto';
import type { UpdateEmployeeDto } from './dto/update-employee.dto';
import type { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto';
import type { ListEmployeesDto } from './dto/list-employees.dto';
import { EMPLOYEE_AUDIT_EVENTS } from '@ai-mos/constants';
import type { EmployeeDto, EmployeeSummaryDto, EmployeeListDto, EmployeeStatsDto } from '@ai-mos/types';

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
}
interface EmployeeDb {
  employee: Delegate;
  auditLog: Delegate;
  user: Delegate;
  userCompany: Delegate;
}

// ─── DB row shape ─────────────────────────────────────────────────────────────
interface EmployeeRow {
  id: string; companyId: string; userId?: string | null; employeeNumber: string;
  firstName: string; middleName?: string | null; lastName: string; displayName?: string | null;
  gender?: string | null; dateOfBirth?: Date | null;
  email?: string | null; phone: string; alternatePhone?: string | null; profileImageUrl?: string | null;
  address?: string | null; city?: string | null; state?: string | null; country?: string | null; postalCode?: string | null;
  department?: string | null; designation?: string | null;
  joiningDate: Date; employmentType: string; employmentStatus: string;
  emergencyContactName?: string | null; emergencyContactPhone?: string | null; emergencyContactRelation?: string | null;
  notes?: string | null;
  createdAt: Date; updatedAt: Date; deletedAt?: Date | null;
}

@Injectable()
export class EmployeeService {
  private readonly logger = new Logger(EmployeeService.name);
  private get db() { return this._db as unknown as EmployeeDb; }

  constructor(private readonly _db: DatabaseService) {}

  // ─── Employee number generation ──────────────────────────────────────────────

  private async generateEmployeeNumber(companyId: string): Promise<string> {
    const count = await this.db.employee.count({
      where: { companyId },
    });
    const seq = count + 1;
    return `EMP-${String(seq).padStart(6, '0')}`;
  }

  // ─── Mapper ─────────────────────────────────────────────────────────────────

  private toDto(row: EmployeeRow): EmployeeDto {
    return {
      id:             row.id,
      companyId:      row.companyId,
      userId:         row.userId ?? null,
      employeeNumber: row.employeeNumber,
      firstName:      row.firstName,
      middleName:     row.middleName ?? null,
      lastName:       row.lastName,
      displayName:    row.displayName ?? null,
      gender:         (row.gender as EmployeeDto['gender']) ?? null,
      dateOfBirth:    row.dateOfBirth ? row.dateOfBirth.toISOString().split('T')[0] : null,
      email:          row.email ?? null,
      phone:          row.phone,
      alternatePhone: row.alternatePhone ?? null,
      profileImageUrl: row.profileImageUrl ?? null,
      address:        row.address ?? null,
      city:           row.city ?? null,
      state:          row.state ?? null,
      country:        row.country ?? null,
      postalCode:     row.postalCode ?? null,
      department:     (row.department as EmployeeDto['department']) ?? null,
      designation:    row.designation ?? null,
      joiningDate:    row.joiningDate.toISOString().split('T')[0] as string,
      employmentType: row.employmentType as EmployeeDto['employmentType'],
      employmentStatus: row.employmentStatus as EmployeeDto['employmentStatus'],
      emergencyContactName:     row.emergencyContactName ?? null,
      emergencyContactPhone:    row.emergencyContactPhone ?? null,
      emergencyContactRelation: row.emergencyContactRelation ?? null,
      notes:     row.notes ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toSummaryDto(row: EmployeeRow): EmployeeSummaryDto {
    return {
      id:               row.id,
      companyId:        row.companyId,
      employeeNumber:   row.employeeNumber,
      firstName:        row.firstName,
      lastName:         row.lastName,
      displayName:      row.displayName ?? null,
      email:            row.email ?? null,
      phone:            row.phone,
      department:       (row.department as EmployeeSummaryDto['department']) ?? null,
      designation:      row.designation ?? null,
      employmentType:   row.employmentType as EmployeeSummaryDto['employmentType'],
      employmentStatus: row.employmentStatus as EmployeeSummaryDto['employmentStatus'],
      joiningDate:      row.joiningDate.toISOString().split('T')[0] as string,
      profileImageUrl:  row.profileImageUrl ?? null,
    };
  }

  // ─── Audit helper ────────────────────────────────────────────────────────────

  private async audit(
    action: string,
    entityId: string,
    userId: string,
    companyId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.db.auditLog.create({
      data: {
        action,
        entityType: 'Employee',
        entityId,
        userId,
        metadata: { companyId, ...metadata },
      },
    });
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  async createEmployee(
    dto: CreateEmployeeDto,
    companyId: string,
    actorUserId: string,
    meta?: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<EmployeeDto> {
    const employeeNumber = await this.generateEmployeeNumber(companyId);

    // Unique employee number within company (guaranteed by DB constraint, but double-check here)
    const existing = await this.db.employee.findFirst({
      where: { companyId, employeeNumber, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('Employee number collision; please retry');
    }

    const data = {
      companyId,
      employeeNumber,
      firstName:  dto.firstName,
      middleName: dto.middleName ?? null,
      lastName:   dto.lastName,
      displayName: dto.displayName ?? null,
      gender:      dto.gender ?? null,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
      email:          dto.email ?? null,
      phone:          dto.phone,
      alternatePhone: dto.alternatePhone ?? null,
      profileImageUrl: dto.profileImageUrl ?? null,
      address:   dto.address ?? null,
      city:      dto.city ?? null,
      state:     dto.state ?? null,
      country:   dto.country ?? null,
      postalCode: dto.postalCode ?? null,
      department:       dto.department ?? null,
      designation:      dto.designation ?? null,
      joiningDate:      new Date(dto.joiningDate),
      employmentType:   dto.employmentType ?? 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      emergencyContactName:     dto.emergencyContactName ?? null,
      emergencyContactPhone:    dto.emergencyContactPhone ?? null,
      emergencyContactRelation: dto.emergencyContactRelation ?? null,
      notes: dto.notes ?? null,
    };

    const row = await this.db.employee.create({ data }) as EmployeeRow;

    await this.audit(EMPLOYEE_AUDIT_EVENTS.EMPLOYEE_CREATED, row.id, actorUserId, companyId, {
      employeeNumber,
      ...meta,
    });

    this.logger.log(`Employee created: ${row.id} in company ${companyId}`);
    return this.toDto(row);
  }

  async listEmployees(
    companyId: string,
    query: ListEmployeesDto,
  ): Promise<EmployeeListDto> {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;
    const skip  = (page - 1) * limit;

    // ─── Build where clause ────────────────────────────────────────────────
    const where: Record<string, unknown> = {
      companyId,
      deletedAt: null,
    };

    if (query.employmentStatus) where['employmentStatus'] = query.employmentStatus;
    if (query.employmentType)   where['employmentType']   = query.employmentType;
    if (query.department)       where['department']        = query.department;

    if (query.search) {
      const s = query.search.trim();
      where['OR'] = [
        { firstName:      { contains: s, mode: 'insensitive' } },
        { lastName:       { contains: s, mode: 'insensitive' } },
        { displayName:    { contains: s, mode: 'insensitive' } },
        { email:          { contains: s, mode: 'insensitive' } },
        { phone:          { contains: s, mode: 'insensitive' } },
        { employeeNumber: { contains: s, mode: 'insensitive' } },
        { designation:    { contains: s, mode: 'insensitive' } },
      ];
    }

    // ─── Sort ─────────────────────────────────────────────────────────────
    const ALLOWED_SORT = ['firstName', 'lastName', 'employeeNumber', 'joiningDate', 'createdAt', 'employmentStatus', 'department'];
    const sortBy    = ALLOWED_SORT.includes(query.sortBy ?? '') ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [employees, total] = await Promise.all([
      this.db.employee.findMany({
        where,
        orderBy: { [sortBy as string]: sortOrder },
        skip,
        take: limit,
      }) as Promise<EmployeeRow[]>,
      this.db.employee.count({ where }),
    ]);

    return {
      employees:  employees.map(e => this.toSummaryDto(e)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getEmployee(id: string, companyId: string): Promise<EmployeeDto> {
    const row = await this.db.employee.findFirst({
      where: { id, companyId, deletedAt: null },
    }) as EmployeeRow | null;

    if (!row) throw new NotFoundException(`Employee ${id} not found`);
    return this.toDto(row);
  }

  async updateEmployee(
    id: string,
    dto: UpdateEmployeeDto,
    companyId: string,
    actorUserId: string,
    meta?: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<EmployeeDto> {
    await this.getEmployee(id, companyId); // throws 404 if not found

    const data: Record<string, unknown> = {};
    if (dto.firstName  !== undefined) data['firstName']  = dto.firstName;
    if (dto.middleName !== undefined) data['middleName'] = dto.middleName;
    if (dto.lastName   !== undefined) data['lastName']   = dto.lastName;
    if (dto.displayName !== undefined) data['displayName'] = dto.displayName;
    if (dto.gender      !== undefined) data['gender']     = dto.gender;
    if (dto.dateOfBirth !== undefined) data['dateOfBirth'] = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
    if (dto.email           !== undefined) data['email']           = dto.email;
    if (dto.phone           !== undefined) data['phone']           = dto.phone;
    if (dto.alternatePhone  !== undefined) data['alternatePhone']  = dto.alternatePhone;
    if (dto.profileImageUrl !== undefined) data['profileImageUrl'] = dto.profileImageUrl;
    if (dto.address    !== undefined) data['address']    = dto.address;
    if (dto.city       !== undefined) data['city']       = dto.city;
    if (dto.state      !== undefined) data['state']      = dto.state;
    if (dto.country    !== undefined) data['country']    = dto.country;
    if (dto.postalCode !== undefined) data['postalCode'] = dto.postalCode;
    if (dto.department      !== undefined) data['department']      = dto.department;
    if (dto.designation     !== undefined) data['designation']     = dto.designation;
    if (dto.joiningDate     !== undefined) data['joiningDate']     = new Date(dto.joiningDate);
    if (dto.employmentType  !== undefined) data['employmentType']  = dto.employmentType;
    if (dto.emergencyContactName     !== undefined) data['emergencyContactName']     = dto.emergencyContactName;
    if (dto.emergencyContactPhone    !== undefined) data['emergencyContactPhone']    = dto.emergencyContactPhone;
    if (dto.emergencyContactRelation !== undefined) data['emergencyContactRelation'] = dto.emergencyContactRelation;
    if (dto.notes !== undefined) data['notes'] = dto.notes;

    if (Object.keys(data).length === 0) throw new BadRequestException('No fields to update');

    const row = await this.db.employee.update({
      where: { id },
      data,
    }) as EmployeeRow;

    await this.audit(EMPLOYEE_AUDIT_EVENTS.EMPLOYEE_UPDATED, id, actorUserId, companyId, {
      updatedFields: Object.keys(data),
      ...meta,
    });

    return this.toDto(row);
  }

  async updateEmployeeStatus(
    id: string,
    dto: UpdateEmployeeStatusDto,
    companyId: string,
    actorUserId: string,
    meta?: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<EmployeeDto> {
    const current = await this.getEmployee(id, companyId);

    if (current.employmentStatus === dto.employmentStatus) {
      throw new BadRequestException(`Employee is already ${dto.employmentStatus}`);
    }

    const row = await this.db.employee.update({
      where: { id },
      data: { employmentStatus: dto.employmentStatus },
    }) as EmployeeRow;

    await this.audit(EMPLOYEE_AUDIT_EVENTS.EMPLOYEE_STATUS_CHANGED, id, actorUserId, companyId, {
      from: current.employmentStatus,
      to:   dto.employmentStatus,
      ...meta,
    });

    return this.toDto(row);
  }

  async deleteEmployee(
    id: string,
    companyId: string,
    actorUserId: string,
    meta?: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<void> {
    await this.getEmployee(id, companyId); // throws 404 if not found

    // Soft-delete
    await this.db.employee.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit(EMPLOYEE_AUDIT_EVENTS.EMPLOYEE_DELETED, id, actorUserId, companyId, meta);
  }

  async linkUser(
    id: string,
    userId: string,
    companyId: string,
    actorUserId: string,
    meta?: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<EmployeeDto> {
    const employee = await this.getEmployee(id, companyId);

    // Verify user exists
    const targetUser = await this.db.user.findFirst({
      where: { id: userId, deletedAt: null },
    }) as { id: string } | null;
    if (!targetUser) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Verify user has active membership in this company (cross-company rejected)
    const membership = await this.db.userCompany.findFirst({
      where: { userId, companyId, status: 'ACTIVE' },
    });
    if (!membership) {
      throw new BadRequestException('User must have an active membership in this company before being linked to an employee');
    }

    // Prevent duplicate links within company
    const existingEmployeeWithUser = await this.db.employee.findFirst({
      where: { companyId, userId, deletedAt: null, NOT: { id } },
    });
    if (existingEmployeeWithUser) {
      throw new ConflictException('This user is already linked to another employee in this company');
    }

    const row = await this.db.employee.update({
      where: { id },
      data: { userId },
    }) as EmployeeRow;

    await this.audit(EMPLOYEE_AUDIT_EVENTS.EMPLOYEE_USER_LINKED, id, actorUserId, companyId, {
      userId,
      employeeNumber: employee.employeeNumber,
      ...meta,
    });

    this.logger.log(`User ${userId} linked to employee ${id} in company ${companyId}`);
    return this.toDto(row);
  }

  async unlinkUser(
    id: string,
    companyId: string,
    actorUserId: string,
    meta?: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<EmployeeDto> {
    const employee = await this.getEmployee(id, companyId);

    if (!employee.userId) {
      throw new BadRequestException('Employee is not currently linked to any user account');
    }

    const previousUserId = employee.userId;

    const row = await this.db.employee.update({
      where: { id },
      data: { userId: null },
    }) as EmployeeRow;

    await this.audit(EMPLOYEE_AUDIT_EVENTS.EMPLOYEE_USER_UNLINKED, id, actorUserId, companyId, {
      previousUserId,
      employeeNumber: employee.employeeNumber,
      ...meta,
    });

    this.logger.log(`User ${previousUserId} unlinked from employee ${id} in company ${companyId}`);
    return this.toDto(row);
  }

  async getStats(companyId: string): Promise<EmployeeStatsDto> {
    const [total, active, inactive, onLeave, terminated] = await Promise.all([
      this.db.employee.count({ where: { companyId, deletedAt: null } }),
      this.db.employee.count({ where: { companyId, deletedAt: null, employmentStatus: 'ACTIVE' } }),
      this.db.employee.count({ where: { companyId, deletedAt: null, employmentStatus: 'INACTIVE' } }),
      this.db.employee.count({ where: { companyId, deletedAt: null, employmentStatus: 'ON_LEAVE' } }),
      this.db.employee.count({ where: { companyId, deletedAt: null, employmentStatus: 'TERMINATED' } }),
    ]);

    // Department breakdown
    const depts: string[] = ['OPERATIONS', 'DISPATCH', 'ACCOUNTS', 'HR', 'SALES', 'CUSTOMER_SUPPORT', 'ADMINISTRATION', 'MANAGEMENT', 'OTHER'];
    const deptCounts = await Promise.all(
      depts.map(d => this.db.employee.count({ where: { companyId, deletedAt: null, department: d } })),
    );
    const byDepartment: Record<string, number> = {};
    depts.forEach((d, i) => { if (deptCounts[i] > 0) byDepartment[d] = deptCounts[i]; });

    // Employment type breakdown
    const types: string[] = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERN'];
    const typeCounts = await Promise.all(
      types.map(t => this.db.employee.count({ where: { companyId, deletedAt: null, employmentType: t } })),
    );
    const byEmploymentType: Record<string, number> = {};
    types.forEach((t, i) => { if (typeCounts[i] > 0) byEmploymentType[t] = typeCounts[i]; });

    // Recent hires — last 30 days
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const recentHires = await this.db.employee.count({
      where: { companyId, deletedAt: null, joiningDate: { gte: since } },
    });

    return { total, active, inactive, onLeave, terminated, byDepartment, byEmploymentType, recentHires };
  }
}
