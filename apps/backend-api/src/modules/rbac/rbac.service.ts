import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../auth/types/auth-user.type';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { ListRolesDto } from './dto/list-roles.dto';
import { AUTH_AUDIT_EVENTS } from '@ai-mos/constants';
import { ROLE_PERMISSIONS } from '@ai-mos/constants';
import type { RoleMemberDto, RoleDetailDto, RoleSummaryDto, PermissionDto } from '@ai-mos/types';

export interface AuditMeta {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(private readonly db: DatabaseService) {}

  // ─── Helper: Get Caller Context and Permissions ──────────────────────────────

  private async getCallerContext(user: AuthUser, companyId?: string): Promise<{
    callerLevel: number;
    callerRole: string;
    isSuperAdmin: boolean;
    allowedPermissions: Set<string>;
  }> {
    const isSuperAdmin = user.roles.includes('SUPER_ADMIN');
    if (isSuperAdmin) {
      return {
        callerLevel: 100,
        callerRole: 'SUPER_ADMIN',
        isSuperAdmin: true,
        allowedPermissions: new Set(['*']),
      };
    }

    let callerRole = 'CUSTOMER';
    let callerLevel = 10;

    if (companyId) {
      const membership = await (this.db as any).userCompany.findFirst({
        where: { userId: user.userId, companyId, status: 'ACTIVE' },
      });
      if (membership?.role) {
        callerRole = membership.role;
      }
    }

    if (callerRole === 'MEMBER' || callerRole === 'CUSTOMER') {
      const topPlatform = user.roles.find((r) =>
        ['OWNER', 'ADMIN', 'MANAGER', 'DISPATCHER', 'ACCOUNTANT', 'DRIVER', 'CUSTOMER'].includes(r),
      );
      if (topPlatform) callerRole = topPlatform;
    }

    switch (callerRole) {
      case 'OWNER':
        callerLevel = 80;
        break;
      case 'ADMIN':
        callerLevel = 60;
        break;
      case 'MANAGER':
        callerLevel = 40;
        break;
      case 'DISPATCHER':
      case 'ACCOUNTANT':
        callerLevel = 30;
        break;
      case 'DRIVER':
        callerLevel = 20;
        break;
      default:
        callerLevel = 10;
    }

    // Resolve caller's effective permissions from DB role + fallback to constants
    const dbRole = await (this.db as any).role.findFirst({
      where: { name: callerRole },
      include: { permissions: { include: { permission: true } } },
    });
    const dbPerms = dbRole?.permissions?.map((p: any) => p.permission.name) ?? [];
    const constantPerms = ROLE_PERMISSIONS[callerRole] ?? [];
    const merged = Array.from(new Set([...dbPerms, ...constantPerms, ...user.permissions]));

    return {
      callerLevel,
      callerRole,
      isSuperAdmin: false,
      allowedPermissions: new Set(merged),
    };
  }

  private async resolvePermissions(inputs: string[]): Promise<any[]> {
    if (!inputs || inputs.length === 0) return [];
    const idInputs = inputs.filter((p) => UUID_REGEX.test(p));
    const nameInputs = inputs.filter((p) => !UUID_REGEX.test(p));

    const orClauses: any[] = [];
    if (idInputs.length > 0) orClauses.push({ id: { in: idInputs } });
    if (nameInputs.length > 0) orClauses.push({ name: { in: nameInputs } });

    if (orClauses.length === 0) return [];

    return (this.db as any).permission.findMany({
      where: orClauses.length > 1 ? { OR: orClauses } : orClauses[0],
    });
  }

  // ─── List Roles ─────────────────────────────────────────────────────────────

  async listRoles(user: AuthUser, companyId?: string, query?: ListRolesDto): Promise<RoleSummaryDto[]> {
    const ctx = await this.getCallerContext(user, companyId);

    // Permission check: role.read or role.write or SUPER_ADMIN
    if (
      !ctx.isSuperAdmin &&
      !ctx.allowedPermissions.has('role.read') &&
      !ctx.allowedPermissions.has('role.write')
    ) {
      throw new ForbiddenException('Insufficient permissions to view roles');
    }

    // Tenant isolation:
    // SUPER_ADMIN can view all roles or filter.
    // Tenant admin/user sees platform roles available to company + their company custom roles.
    const where: Record<string, unknown> = {};

    if (!ctx.isSuperAdmin) {
      where['OR'] = [
        { scope: 'COMPANY', companyId: null },
        ...(companyId ? [{ companyId }] : []),
      ];
    } else {
      if (companyId) {
        where['OR'] = [{ companyId: null }, { companyId }];
      }
    }

    if (query?.scope) {
      where['scope'] = query.scope;
    }

    if (query?.search) {
      where['AND'] = [
        {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const roles = await (this.db as any).role.findMany({
      where,
      include: {
        _count: { select: { permissions: true, users: true } },
      },
      orderBy: [{ level: 'desc' }, { name: 'asc' }],
    });

    // If active company context, tally memberships from user_companies
    const companyRoleCounts: Record<string, number> = {};
    if (companyId) {
      try {
        const memberCounts = await (this.db as any).userCompany.groupBy({
          by: ['role'],
          where: { companyId, status: 'ACTIVE' },
          _count: { role: true },
        });
        for (const mc of memberCounts) {
          companyRoleCounts[mc.role] = mc._count.role;
        }
      } catch (e) {
        // Fallback gracefully
      }
    }

    return roles.map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      scope: r.scope,
      level: r.level,
      isSystem: r.isSystem,
      companyId: r.companyId,
      permissionCount: r._count.permissions,
      userCount: r._count.users + (companyRoleCounts[r.name] ?? 0),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  // ─── Get Role By ID ─────────────────────────────────────────────────────────

  async getRole(id: string, user: AuthUser, companyId?: string): Promise<RoleDetailDto> {
    const ctx = await this.getCallerContext(user, companyId);

    if (
      !ctx.isSuperAdmin &&
      !ctx.allowedPermissions.has('role.read') &&
      !ctx.allowedPermissions.has('role.write')
    ) {
      throw new ForbiddenException('Insufficient permissions to view role details');
    }

    const role = await (this.db as any).role.findFirst({
      where: UUID_REGEX.test(id) ? { id } : { name: id },
      include: {
        permissions: {
          include: { permission: true },
        },
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID or name "${id}" not found`);
    }

    // Tenant isolation check
    if (!ctx.isSuperAdmin && role.companyId && role.companyId !== companyId) {
      throw new ForbiddenException('Access denied: role belongs to another organization');
    }

    const permissions: PermissionDto[] = role.permissions.map((rp: any) => ({
      id: rp.permission.id,
      name: rp.permission.name,
      description: rp.permission.description,
      module: rp.permission.module,
      action: rp.permission.action,
    }));

    // Collect direct users
    const directUsers: RoleMemberDto[] = (role.users || []).map((ur: any) => ({
      id: ur.user.id,
      email: ur.user.email,
      firstName: ur.user.firstName,
      lastName: ur.user.lastName,
      status: ur.user.status,
      assignedAt: ur.assignedAt ? ur.assignedAt.toISOString() : ur.user.createdAt.toISOString(),
    }));

    // If company context exists, also retrieve active members mapped through user_companies
    let companyUsers: RoleMemberDto[] = [];
    const effectiveCompanyId = role.companyId ?? companyId;
    if (effectiveCompanyId) {
      try {
        const matchingMembers = await (this.db as any).userCompany.findMany({
          where: {
            companyId: effectiveCompanyId,
            role: role.name,
            status: 'ACTIVE',
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                status: true,
              },
            },
          },
        });
        companyUsers = matchingMembers.map((m: any) => ({
          id: m.user.id,
          email: m.user.email,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          status: m.user.status,
          assignedAt: m.joinedAt ? m.joinedAt.toISOString() : new Date().toISOString(),
        }));
      } catch (err) {
        // Fallback
      }
    }

    // Deduplicate users by id
    const userMap = new Map<string, RoleMemberDto>();
    for (const u of [...directUsers, ...companyUsers]) {
      if (!userMap.has(u.id)) {
        userMap.set(u.id, u);
      }
    }
    const users = Array.from(userMap.values());

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      scope: role.scope,
      level: role.level,
      isSystem: role.isSystem,
      companyId: role.companyId,
      permissionCount: permissions.length,
      permissions,
      userCount: users.length,
      users,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  }

  // ─── Create Custom Role ─────────────────────────────────────────────────────

  async createRole(dto: CreateRoleDto, user: AuthUser, companyId?: string, meta?: AuditMeta) {
    const ctx = await this.getCallerContext(user, companyId);

    // Permission check
    if (
      !ctx.isSuperAdmin &&
      !ctx.allowedPermissions.has('role.create') &&
      !ctx.allowedPermissions.has('role.write')
    ) {
      throw new ForbiddenException('Insufficient permissions to create custom roles');
    }

    const scope = ctx.isSuperAdmin ? (dto.scope ?? 'PLATFORM') : 'COMPANY';
    const roleCompanyId = ctx.isSuperAdmin ? (dto.companyId ?? null) : (companyId ?? null);

    // 1. Prevent collision with system roles
    const systemRole = await (this.db as any).role.findFirst({
      where: { name: dto.name, isSystem: true },
    });
    if (systemRole) {
      throw new ConflictException(`Cannot create a custom role with reserved system role name "${dto.name}"`);
    }

    // 2. Prevent duplicate role name in the same tenant/company
    const existing = await (this.db as any).role.findFirst({
      where: { name: dto.name, companyId: roleCompanyId },
    });
    if (existing) {
      throw new ConflictException(`Role with name "${dto.name}" already exists in this organization`);
    }

    // 3. Hierarchy check: custom role level must be strictly less than creator's level
    const targetLevel = dto.level ?? Math.max(10, ctx.callerLevel - 10);
    if (!ctx.isSuperAdmin && targetLevel >= ctx.callerLevel) {
      throw new ForbiddenException(
        `Cannot create a role with level (${targetLevel}) equal to or higher than your own level (${ctx.callerLevel})`,
      );
    }

    // 4. Privilege Escalation Prevention:
    // Caller cannot grant permissions they do not possess themselves
    const assignedPermIds: string[] = [];
    if (dto.permissionIds && dto.permissionIds.length > 0) {
      const perms = await this.resolvePermissions(dto.permissionIds);

      for (const p of perms) {
        if (!ctx.isSuperAdmin && !ctx.allowedPermissions.has(p.name)) {
          throw new ForbiddenException(
            `Privilege escalation prevented: you do not possess permission "${p.name}"`,
          );
        }
        assignedPermIds.push(p.id);
      }
    }

    const createdRole = await (this.db as any).$transaction(async (tx: any) => {
      const role = await tx.role.create({
        data: {
          name: dto.name,
          description: dto.description ?? null,
          scope,
          level: targetLevel,
          isSystem: false,
          companyId: roleCompanyId,
        },
      });

      if (assignedPermIds.length > 0) {
        await tx.rolePermission.createMany({
          data: assignedPermIds.map((pId) => ({
            roleId: role.id,
            permissionId: pId,
          })),
        });
      }

      return role;
    });

    await this.audit({
      action: AUTH_AUDIT_EVENTS.ROLE_CREATED,
      entityType: 'ROLE',
      entityId: createdRole.id,
      userId: user.userId,
      companyId,
      metadata: {
        roleName: createdRole.name,
        scope,
        level: targetLevel,
        permissionsAssigned: assignedPermIds.length,
      },
      ...meta,
    });

    return this.getRole(createdRole.id, user, companyId);
  }

  // ─── Update Role ────────────────────────────────────────────────────────────

  async updateRole(id: string, dto: UpdateRoleDto, user: AuthUser, companyId?: string, meta?: AuditMeta) {
    const ctx = await this.getCallerContext(user, companyId);

    if (
      !ctx.isSuperAdmin &&
      !ctx.allowedPermissions.has('role.update') &&
      !ctx.allowedPermissions.has('role.write')
    ) {
      throw new ForbiddenException('Insufficient permissions to update roles');
    }

    const role = await (this.db as any).role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    // System role protection: cannot rename system roles
    if (role.isSystem && dto.name && dto.name !== role.name) {
      throw new BadRequestException('System role names cannot be renamed');
    }

    // Hierarchy protection: cannot update a role with >= callerLevel
    if (!ctx.isSuperAdmin && role.level >= ctx.callerLevel) {
      throw new ForbiddenException('Cannot modify a role with equal or higher authority level');
    }

    // Tenant check
    if (!ctx.isSuperAdmin && role.companyId && role.companyId !== companyId) {
      throw new ForbiddenException('Access denied: role belongs to another organization');
    }

    // If renaming, check collisions
    if (dto.name && dto.name !== role.name) {
      const systemRole = await (this.db as any).role.findFirst({
        where: { name: dto.name, isSystem: true },
      });
      if (systemRole) {
        throw new ConflictException(`Cannot rename to reserved system role name "${dto.name}"`);
      }

      const existing = await (this.db as any).role.findFirst({
        where: { name: dto.name, companyId: role.companyId, id: { not: id } },
      });
      if (existing) {
        throw new ConflictException(`Role with name "${dto.name}" already exists in this organization`);
      }
    }

    const updated = await (this.db as any).role.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
    });

    await this.audit({
      action: AUTH_AUDIT_EVENTS.ROLE_UPDATED,
      entityType: 'ROLE',
      entityId: id,
      userId: user.userId,
      companyId,
      metadata: {
        roleName: role.name,
        changes: dto,
      },
      ...meta,
    });

    return this.getRole(updated.id, user, companyId);
  }

  // ─── Delete Role ────────────────────────────────────────────────────────────

  async deleteRole(id: string, user: AuthUser, companyId?: string, meta?: AuditMeta) {
    const ctx = await this.getCallerContext(user, companyId);

    if (
      !ctx.isSuperAdmin &&
      !ctx.allowedPermissions.has('role.delete') &&
      !ctx.allowedPermissions.has('role.write')
    ) {
      throw new ForbiddenException('Insufficient permissions to delete roles');
    }

    const role = await (this.db as any).role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    // CRITICAL: System roles CANNOT be deleted
    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be deleted');
    }

    // Hierarchy protection
    if (!ctx.isSuperAdmin && role.level >= ctx.callerLevel) {
      throw new ForbiddenException('Cannot delete a role with equal or higher authority level');
    }

    // Tenant check
    if (!ctx.isSuperAdmin && role.companyId && role.companyId !== companyId) {
      throw new ForbiddenException('Access denied: role belongs to another organization');
    }

    await (this.db as any).role.delete({ where: { id } });

    await this.audit({
      action: AUTH_AUDIT_EVENTS.ROLE_DELETED,
      entityType: 'ROLE',
      entityId: id,
      userId: user.userId,
      companyId,
      metadata: {
        roleName: role.name,
        roleLevel: role.level,
      },
      ...meta,
    });

    return { success: true, message: `Role "${role.name}" was deleted successfully` };
  }

  // ─── List All Available Permissions ─────────────────────────────────────────

  async listPermissions(user: AuthUser) {
    const ctx = await this.getCallerContext(user);

    if (
      !ctx.isSuperAdmin &&
      !ctx.allowedPermissions.has('permission.read') &&
      !ctx.allowedPermissions.has('role.read')
    ) {
      throw new ForbiddenException('Insufficient permissions to list system permissions');
    }

    const permissions = await (this.db as any).permission.findMany({
      orderBy: [{ module: 'asc' }, { name: 'asc' }],
    });

    return permissions.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      module: p.module ?? 'GENERAL',
      action: p.action ?? 'MANAGE',
    }));
  }

  // ─── Get Permission By ID or Name ───────────────────────────────────────────

  async getPermission(id: string, user: AuthUser) {
    const ctx = await this.getCallerContext(user);

    if (
      !ctx.isSuperAdmin &&
      !ctx.allowedPermissions.has('permission.read') &&
      !ctx.allowedPermissions.has('role.read')
    ) {
      throw new ForbiddenException('Insufficient permissions to view permission details');
    }

    const permission = await (this.db as any).permission.findFirst({
      where: UUID_REGEX.test(id) ? { id } : { name: id },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!permission) {
      throw new NotFoundException(`Permission with ID or name "${id}" not found`);
    }

    return {
      id: permission.id,
      name: permission.name,
      description: permission.description,
      module: permission.module ?? 'GENERAL',
      action: permission.action ?? 'MANAGE',
      roles: permission.roles.map((r: any) => ({
        id: r.role.id,
        name: r.role.name,
        scope: r.role.scope,
        isSystem: r.role.isSystem,
      })),
      createdAt: permission.createdAt.toISOString(),
      updatedAt: permission.updatedAt.toISOString(),
    };
  }

  // ─── Get Role Permissions ───────────────────────────────────────────────────

  async getRolePermissions(roleId: string, user: AuthUser, companyId?: string) {
    const role = await this.getRole(roleId, user, companyId);
    return role.permissions;
  }

  // ─── Update Role Permissions ────────────────────────────────────────────────

  async updateRolePermissions(
    roleId: string,
    dto: UpdateRolePermissionsDto,
    user: AuthUser,
    companyId?: string,
    meta?: AuditMeta,
  ) {
    const ctx = await this.getCallerContext(user, companyId);

    // Permission check
    if (
      !ctx.isSuperAdmin &&
      !ctx.allowedPermissions.has('permission.assign') &&
      !ctx.allowedPermissions.has('role.update') &&
      !ctx.allowedPermissions.has('role.write')
    ) {
      throw new ForbiddenException('Insufficient permissions to assign role permissions');
    }

    const role = await (this.db as any).role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    // CRITICAL: SUPER_ADMIN permissions cannot be changed from company UI or by non-superadmin
    if (role.name === 'SUPER_ADMIN' && !ctx.isSuperAdmin) {
      throw new ForbiddenException('Cannot modify permissions for SUPER_ADMIN role');
    }

    // Cannot modify a role with equal or higher authority level
    if (!ctx.isSuperAdmin && role.level >= ctx.callerLevel) {
      throw new ForbiddenException(
        `Cannot modify permissions of role "${role.name}" (level ${role.level}) with your authority level (${ctx.callerLevel})`,
      );
    }

    // Tenant check
    if (!ctx.isSuperAdmin && role.companyId && role.companyId !== companyId) {
      throw new ForbiddenException('Access denied: role belongs to another organization');
    }

    // Self-elevation prevention: user cannot modify their own active role to elevate their permissions
    if (!ctx.isSuperAdmin && role.name === ctx.callerRole) {
      throw new ForbiddenException('Privilege escalation: users cannot elevate permissions of their own assigned role');
    }

    // Resolve requested permissions from IDs or names
    const requestedPerms = await this.resolvePermissions(dto.permissionIds);

    // Privilege Escalation Prevention:
    // A user must NEVER be able to grant permissions they do not hold
    if (!ctx.isSuperAdmin) {
      for (const p of requestedPerms) {
        if (!ctx.allowedPermissions.has(p.name)) {
          throw new ForbiddenException(
            `Privilege escalation prevented: cannot grant permission "${p.name}" which you do not possess`,
          );
        }
      }
    }

    const previousPerms = role.permissions.map((rp: any) => rp.permission.name);
    const newPermIds = requestedPerms.map((p: any) => p.id);
    const newPermNames = requestedPerms.map((p: any) => p.name);

    await (this.db as any).$transaction(async (tx: any) => {
      // Clear existing permissions
      await tx.rolePermission.deleteMany({ where: { roleId } });

      // Insert new permissions
      if (newPermIds.length > 0) {
        await tx.rolePermission.createMany({
          data: newPermIds.map((permissionId: string) => ({
            roleId,
            permissionId,
          })),
        });
      }
    });

    await this.audit({
      action: AUTH_AUDIT_EVENTS.ROLE_PERMISSIONS_UPDATED,
      entityType: 'ROLE',
      entityId: roleId,
      userId: user.userId,
      companyId,
      metadata: {
        roleName: role.name,
        previousPermissions: previousPerms,
        newPermissions: newPermNames,
      },
      ...meta,
    });

    return this.getRole(roleId, user, companyId);
  }

  // ─── Audit Helper ───────────────────────────────────────────────────────────

  private async audit(params: {
    action: string;
    entityType: string;
    entityId: string;
    userId: string;
    companyId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
  }): Promise<void> {
    try {
      await (this.db as any).auditLog.create({
        data: {
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          userId: params.userId,
          metadata: {
            ...(params.companyId ? { companyId: params.companyId } : {}),
            ...(params.metadata ?? {}),
          },
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          requestId: params.requestId,
        },
      });
    } catch (err) {
      this.logger.error('Failed to create RBAC audit log', err);
    }
  }
}
