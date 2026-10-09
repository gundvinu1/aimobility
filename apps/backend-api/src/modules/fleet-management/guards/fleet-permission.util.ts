import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../../auth/types/auth-user.type';
import { ROLE_PERMISSIONS } from '@ai-mos/constants';

export function enforcePermission(
  user: AuthUser,
  tenantRole: string,
  requiredPermission: string,
): void {
  if (user.roles?.includes('SUPER_ADMIN')) {
    return;
  }
  const rolePerms = ROLE_PERMISSIONS[tenantRole] ?? [];
  const userPerms = user.permissions ?? [];
  const allPerms = new Set([...rolePerms, ...userPerms]);

  if (!allPerms.has(requiredPermission) && !allPerms.has('*')) {
    throw new ForbiddenException(
      `Insufficient permissions: requires ${requiredPermission}`,
    );
  }
}
