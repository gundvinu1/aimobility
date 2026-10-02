import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { CreateCompanyDto } from './dto/create-company.dto';
import type { UpdateCompanyDto } from './dto/update-company.dto';
import type { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';
import type { UpdateMemberDto } from './dto/update-member.dto';
import type { CreateInvitationDto } from './dto/create-invitation.dto';
import { COMPANY_AUDIT_EVENTS } from '@ai-mos/constants';
import type {
  CompanyDto,
  CompanySummaryDto,
  CompanySettingsDto,
  CompanyMemberDto,
  CompanyInvitationDto,
} from '@ai-mos/types';
import type { CompanyRole, MembershipStatus, CompanyStatus } from '@prisma/client';
import * as crypto from 'crypto';

// ─── Minimal DB delegate types ────────────────────────────────────────────────
interface FindOpts { where?: Record<string, unknown>; include?: Record<string, unknown>; data?: Record<string, unknown>; orderBy?: unknown; select?: Record<string, unknown> }
interface Delegate {
  findUnique: (opts: FindOpts) => Promise<unknown>;
  findFirst: (opts: FindOpts) => Promise<unknown>;
  findMany: (opts?: FindOpts) => Promise<unknown[]>;
  create: (opts: FindOpts) => Promise<unknown>;
  update: (opts: FindOpts) => Promise<unknown>;
  updateMany: (opts: FindOpts) => Promise<{ count: number }>;
  delete: (opts: FindOpts) => Promise<unknown>;
  count: (opts?: FindOpts) => Promise<number>;
}
interface CompanyDb { company: Delegate; companySettings: Delegate; userCompany: Delegate; companyInvitation: Delegate; auditLog: Delegate }

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);
  private get db() { return this._db as unknown as CompanyDb; }

  constructor(private readonly _db: DatabaseService) {}

  // ─── Slug generation ────────────────────────────────────────────────────────

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 40);
    const suffix = crypto.randomBytes(3).toString('hex');
    return `${base}-${suffix}`;
  }

  // ─── Token helpers ───────────────────────────────────────────────────────────

  generateInviteToken(): string {
    return crypto.randomBytes(48).toString('base64url');
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // ─── Public lookup helpers (used by TenantGuard) ─────────────────────────

  async findByIdOrNull(id: string) {
    return this.db.company.findFirst({
      where: { id, deletedAt: null },
    }) as Promise<CompanyRecord | null>;
  }

  async findActiveMembership(userId: string, companyId: string) {
    return this.db.userCompany.findFirst({
      where: { userId, companyId, status: 'ACTIVE' },
    }) as Promise<MembershipRecord | null>;
  }

  // ─── CREATE COMPANY ─────────────────────────────────────────────────────────

  async createCompany(
    dto: CreateCompanyDto,
    userId: string,
    meta: AuditMeta,
  ): Promise<{ company: CompanyDto; membership: CompanyMemberDto }> {
    const slug = this.generateSlug(dto.name);

    const company = await this.db.company.create({
      data: {
        name: dto.name,
        legalName: dto.legalName,
        slug,
        email: dto.email,
        phone: dto.phone,
        website: dto.website,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        country: dto.country,
        postalCode: dto.postalCode,
        timezone: dto.timezone ?? 'UTC',
        currency: dto.currency ?? 'USD',
        status: 'ACTIVE' as CompanyStatus,
      },
    }) as CompanyRecord;

    // Create default settings (mirrors company defaults)
    await this.db.companySettings.create({
      data: {
        companyId: company.id,
        timezone: dto.timezone ?? 'UTC',
        currency: dto.currency ?? 'USD',
      },
    });

    // Creator becomes OWNER
    const membership = await this.db.userCompany.create({
      data: {
        userId,
        companyId: company.id,
        role: 'OWNER' as CompanyRole,
        status: 'ACTIVE' as MembershipStatus,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    }) as MembershipRecord & { user: UserRecord };

    await this.audit({
      action: COMPANY_AUDIT_EVENTS.COMPANY_CREATED,
      entityType: 'Company',
      entityId: company.id,
      companyId: company.id,
      userId,
      metadata: { name: company.name, slug: company.slug },
      ...meta,
    });

    return {
      company: this.mapCompany(company),
      membership: this.mapMembership(membership),
    };
  }

  // ─── LIST COMPANIES (current user's) ────────────────────────────────────────

  async listUserCompanies(userId: string): Promise<CompanySummaryDto[]> {
    const memberships = await this.db.userCompany.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        company: {
          include: {
            _count: { select: { members: { where: { status: 'ACTIVE' } } } },
          },
        },
      },
    }) as Array<MembershipRecord & { company: CompanyRecord & { _count: { members: number } } }>;

    return memberships
      .filter((m) => !m.company.deletedAt)
      .map((m) => ({
        id: m.company.id,
        name: m.company.name,
        slug: m.company.slug,
        logoUrl: m.company.logoUrl,
        status: m.company.status as CompanySummaryDto['status'],
        role: m.role as CompanySummaryDto['role'],
        memberCount: m.company._count.members,
      }));
  }

  // ─── GET COMPANY (membership verified by TenantGuard) ────────────────────

  async getCompany(companyId: string): Promise<CompanyDto> {
    const company = await this.db.company.findFirst({
      where: { id: companyId, deletedAt: null },
    }) as CompanyRecord | null;

    if (!company) throw new NotFoundException('Company not found');
    return this.mapCompany(company);
  }

  // ─── UPDATE COMPANY ──────────────────────────────────────────────────────────

  async updateCompany(
    companyId: string,
    dto: UpdateCompanyDto,
    userId: string,
    meta: AuditMeta,
  ): Promise<CompanyDto> {
    const company = await this.db.company.update({
      where: { id: companyId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.legalName !== undefined && { legalName: dto.legalName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
      },
    }) as CompanyRecord;

    await this.audit({
      action: COMPANY_AUDIT_EVENTS.COMPANY_UPDATED,
      entityType: 'Company',
      entityId: companyId,
      companyId,
      userId,
      metadata: { updatedFields: Object.keys(dto) },
      ...meta,
    });

    return this.mapCompany(company);
  }

  // ─── UPDATE COMPANY STATUS ───────────────────────────────────────────────────

  async updateStatus(
    companyId: string,
    status: CompanyStatus,
    userId: string,
    meta: AuditMeta,
  ): Promise<CompanyDto> {
    const current = await this.findByIdOrNull(companyId);
    if (!current) throw new NotFoundException('Company not found');

    // Validate allowed transitions
    const allowedTransitions: Record<string, CompanyStatus[]> = {
      ACTIVE:    ['SUSPENDED', 'INACTIVE'],
      SUSPENDED: ['ACTIVE'],
      INACTIVE:  [],
    };

    if (!allowedTransitions[current.status]?.includes(status)) {
      throw new BadRequestException(
        `Cannot transition company from ${current.status} to ${status}`,
      );
    }

    const updated = await this.db.company.update({
      where: { id: companyId },
      data: { status },
    }) as CompanyRecord;

    const eventMap: Record<string, string> = {
      ACTIVE:    COMPANY_AUDIT_EVENTS.COMPANY_ACTIVATED,
      SUSPENDED: COMPANY_AUDIT_EVENTS.COMPANY_SUSPENDED,
      INACTIVE:  COMPANY_AUDIT_EVENTS.COMPANY_DEACTIVATED,
    };

    await this.audit({
      action: eventMap[status] ?? COMPANY_AUDIT_EVENTS.COMPANY_UPDATED,
      entityType: 'Company',
      entityId: companyId,
      companyId,
      userId,
      metadata: { from: current.status, to: status },
      ...meta,
    });

    return this.mapCompany(updated);
  }

  // ─── SETTINGS ────────────────────────────────────────────────────────────────

  async getSettings(companyId: string): Promise<CompanySettingsDto> {
    const settings = await this.db.companySettings.findUnique({
      where: { companyId },
    }) as SettingsRecord | null;

    if (!settings) throw new NotFoundException('Company settings not found');
    return this.mapSettings(settings);
  }

  async updateSettings(
    companyId: string,
    dto: UpdateCompanySettingsDto,
    userId: string,
    meta: AuditMeta,
  ): Promise<CompanySettingsDto> {
    const settings = await this.db.companySettings.update({
      where: { companyId },
      data: {
        ...(dto.timezone   !== undefined && { timezone: dto.timezone }),
        ...(dto.currency   !== undefined && { currency: dto.currency }),
        ...(dto.dateFormat !== undefined && { dateFormat: dto.dateFormat }),
        ...(dto.timeFormat !== undefined && { timeFormat: dto.timeFormat }),
        ...(dto.language   !== undefined && { language: dto.language }),
      },
    }) as SettingsRecord;

    await this.audit({
      action: COMPANY_AUDIT_EVENTS.COMPANY_SETTINGS_UPDATED,
      entityType: 'CompanySettings',
      entityId: companyId,
      companyId,
      userId,
      metadata: { updatedFields: Object.keys(dto) },
      ...meta,
    });

    return this.mapSettings(settings);
  }

  // ─── MEMBERS ─────────────────────────────────────────────────────────────────

  async listMembers(companyId: string): Promise<CompanyMemberDto[]> {
    const members = await this.db.userCompany.findMany({
      where: { companyId, status: { not: 'REMOVED' as MembershipStatus } },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { joinedAt: 'asc' },
    }) as Array<MembershipRecord & { user: UserRecord }>;

    return members.map((m) => this.mapMembership(m));
  }

  async getMember(companyId: string, userId: string): Promise<CompanyMemberDto> {
    const member = await this.db.userCompany.findFirst({
      where: { companyId, userId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    }) as (MembershipRecord & { user: UserRecord }) | null;

    if (!member) throw new NotFoundException('Member not found');
    return this.mapMembership(member);
  }

  async updateMember(
    companyId: string,
    targetUserId: string,
    dto: UpdateMemberDto,
    requestingUserId: string,
    requestingRole: CompanyRole,
    meta: AuditMeta,
  ): Promise<CompanyMemberDto> {
    const membership = await this.db.userCompany.findFirst({
      where: { companyId, userId: targetUserId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    }) as (MembershipRecord & { user: UserRecord }) | null;

    if (!membership) throw new NotFoundException('Member not found');

    // Prevent self-promotion beyond current role
    if (requestingUserId === targetUserId && dto.role && dto.role !== membership.role) {
      const roleOrder: Record<string, number> = { OWNER: 4, ADMIN: 3, MANAGER: 2, MEMBER: 1 };
      if ((roleOrder[dto.role] ?? 0) > (roleOrder[requestingRole] ?? 0)) {
        throw new ForbiddenException('Cannot promote yourself to a higher role');
      }
    }

    // Protect the last OWNER
    if (
      dto.role &&
      dto.role !== 'OWNER' &&
      membership.role === 'OWNER'
    ) {
      const ownerCount = await this.db.userCompany.count({
        where: { companyId, role: 'OWNER', status: 'ACTIVE' },
      });
      if (ownerCount <= 1) {
        throw new ForbiddenException(
          'Cannot remove the last owner. Transfer ownership first.',
        );
      }
    }

    const updated = await this.db.userCompany.update({
      where: { id: membership.id },
      data: {
        ...(dto.role   !== undefined && { role: dto.role }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    }) as MembershipRecord & { user: UserRecord };

    const eventMap: Record<string, string> = {
      SUSPENDED: COMPANY_AUDIT_EVENTS.COMPANY_MEMBER_SUSPENDED,
      REMOVED:   COMPANY_AUDIT_EVENTS.COMPANY_MEMBER_REMOVED,
    };
    const event = dto.status
      ? (eventMap[dto.status] ?? COMPANY_AUDIT_EVENTS.COMPANY_MEMBER_UPDATED)
      : COMPANY_AUDIT_EVENTS.COMPANY_MEMBER_UPDATED;

    await this.audit({
      action: event,
      entityType: 'UserCompany',
      entityId: membership.id,
      companyId,
      userId: requestingUserId,
      metadata: { targetUserId, changes: dto },
      ...meta,
    });

    return this.mapMembership(updated);
  }

  async removeMember(
    companyId: string,
    targetUserId: string,
    requestingUserId: string,
    meta: AuditMeta,
  ): Promise<void> {
    const membership = await this.db.userCompany.findFirst({
      where: { companyId, userId: targetUserId },
    }) as MembershipRecord | null;

    if (!membership) throw new NotFoundException('Member not found');

    // Protect last owner
    if (membership.role === 'OWNER') {
      const ownerCount = await this.db.userCompany.count({
        where: { companyId, role: 'OWNER', status: 'ACTIVE' },
      });
      if (ownerCount <= 1) {
        throw new ForbiddenException(
          'Cannot remove the last owner. Transfer ownership first.',
        );
      }
    }

    await this.db.userCompany.update({
      where: { id: membership.id },
      data: { status: 'REMOVED' as MembershipStatus },
    });

    await this.audit({
      action: COMPANY_AUDIT_EVENTS.COMPANY_MEMBER_REMOVED,
      entityType: 'UserCompany',
      entityId: membership.id,
      companyId,
      userId: requestingUserId,
      metadata: { targetUserId },
      ...meta,
    });
  }

  // ─── INVITATIONS ─────────────────────────────────────────────────────────────

  async createInvitation(
    companyId: string,
    dto: CreateInvitationDto,
    invitedById: string,
    meta: AuditMeta,
  ): Promise<{ invitation: CompanyInvitationDto; developmentToken?: string }> {
    // Revoke existing pending invitations for this email+company
    await this.db.companyInvitation.updateMany({
      where: {
        companyId,
        email: dto.email,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    const rawToken = this.generateInviteToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await this.db.companyInvitation.create({
      data: {
        companyId,
        email: dto.email,
        role: dto.role ?? 'MEMBER',
        tokenHash,
        expiresAt,
        invitedById,
      },
    }) as InvitationRecord;

    await this.audit({
      action: COMPANY_AUDIT_EVENTS.COMPANY_INVITATION_CREATED,
      entityType: 'CompanyInvitation',
      entityId: invitation.id,
      companyId,
      userId: invitedById,
      metadata: { email: dto.email, role: dto.role },
      ...meta,
    });

    const isDev = process.env['NODE_ENV'] !== 'production';
    return {
      invitation: this.mapInvitation(invitation),
      ...(isDev && { developmentToken: rawToken }),
    };
  }

  async acceptInvitation(
    rawToken: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<CompanyMemberDto> {
    const tokenHash = this.hashToken(rawToken);
    const invitation = await this.db.companyInvitation.findFirst({
      where: {
        tokenHash,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    }) as InvitationRecord | null;

    if (!invitation) {
      throw new BadRequestException('Invalid, expired, or already used invitation token');
    }

    // Create or reactivate membership
    const existing = await this.db.userCompany.findFirst({
      where: { userId, companyId: invitation.companyId },
    }) as MembershipRecord | null;

    let membership: MembershipRecord & { user: UserRecord };

    if (existing) {
      membership = await this.db.userCompany.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE', role: invitation.role },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }) as MembershipRecord & { user: UserRecord };
    } else {
      membership = await this.db.userCompany.create({
        data: {
          userId,
          companyId: invitation.companyId,
          role: invitation.role,
          status: 'ACTIVE',
        },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }) as MembershipRecord & { user: UserRecord };
    }

    // Mark invitation as accepted
    await this.db.companyInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    await this.audit({
      action: COMPANY_AUDIT_EVENTS.COMPANY_INVITATION_ACCEPTED,
      entityType: 'CompanyInvitation',
      entityId: invitation.id,
      companyId: invitation.companyId,
      userId,
      metadata: { email: invitation.email },
      ...meta,
    });

    return this.mapMembership(membership);
  }

  // ─── MAPPERS ─────────────────────────────────────────────────────────────────

  private mapCompany(c: CompanyRecord): CompanyDto {
    return {
      id: c.id,
      name: c.name,
      legalName: c.legalName,
      slug: c.slug,
      email: c.email,
      phone: c.phone,
      website: c.website,
      logoUrl: c.logoUrl,
      address: c.address,
      city: c.city,
      state: c.state,
      country: c.country,
      postalCode: c.postalCode,
      timezone: c.timezone,
      currency: c.currency,
      status: c.status as CompanyDto['status'],
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  private mapSettings(s: SettingsRecord): CompanySettingsDto {
    return {
      id: s.id,
      companyId: s.companyId,
      timezone: s.timezone,
      currency: s.currency,
      dateFormat: s.dateFormat,
      timeFormat: s.timeFormat,
      language: s.language,
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  private mapMembership(m: MembershipRecord & { user?: UserRecord }): CompanyMemberDto {
    return {
      id: m.id,
      userId: m.userId,
      companyId: m.companyId,
      role: m.role as CompanyMemberDto['role'],
      status: m.status as CompanyMemberDto['status'],
      joinedAt: m.joinedAt.toISOString(),
      user: {
        id: m.user?.id ?? m.userId,
        email: m.user?.email ?? '',
        firstName: m.user?.firstName ?? '',
        lastName: m.user?.lastName ?? '',
      },
    };
  }

  private mapInvitation(i: InvitationRecord): CompanyInvitationDto {
    return {
      id: i.id,
      companyId: i.companyId,
      email: i.email,
      role: i.role as CompanyInvitationDto['role'],
      expiresAt: i.expiresAt.toISOString(),
      acceptedAt: i.acceptedAt?.toISOString(),
      revokedAt: i.revokedAt?.toISOString(),
      createdAt: i.createdAt.toISOString(),
    };
  }

  // ─── AUDIT ───────────────────────────────────────────────────────────────────

  private async audit(params: {
    action: string;
    entityType: string;
    entityId?: string;
    companyId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
  }): Promise<void> {
    try {
      await this.db.auditLog.create({
        data: {
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          userId: params.userId,
          metadata: { ...params.metadata, companyId: params.companyId },
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          requestId: params.requestId,
        },
      });
    } catch (err) {
      this.logger.error('Failed to write audit log', err);
    }
  }
}

// ─── Internal record types ────────────────────────────────────────────────────
interface CompanyRecord {
  id: string; name: string; legalName: string | null; slug: string;
  email: string | null; phone: string | null; website: string | null; logoUrl: string | null;
  address: string | null; city: string | null; state: string | null; country: string | null;
  postalCode: string | null; timezone: string; currency: string;
  status: string; createdAt: Date; updatedAt: Date; deletedAt: Date | null;
}
interface SettingsRecord {
  id: string; companyId: string; timezone: string; currency: string;
  dateFormat: string; timeFormat: string; language: string; updatedAt: Date;
}
interface MembershipRecord {
  id: string; userId: string; companyId: string;
  role: string; status: string; joinedAt: Date; createdAt: Date; updatedAt: Date;
}
interface UserRecord { id: string; email: string; firstName: string; lastName: string }
interface InvitationRecord {
  id: string; companyId: string; email: string; role: string;
  tokenHash: string; expiresAt: Date; acceptedAt: Date | null;
  revokedAt: Date | null; invitedById: string; createdAt: Date; updatedAt: Date;
}
interface AuditMeta { ipAddress?: string; userAgent?: string; requestId?: string }
