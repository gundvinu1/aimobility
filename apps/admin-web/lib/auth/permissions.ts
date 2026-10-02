// =============================================================================
// AI-MOS Permission Resolution & Evaluation Engine — Module 8A
// =============================================================================

import { ROLE_PERMISSIONS, UI_PERMISSIONS } from '@ai-mos/constants';
import type { CurrentUserDto, CompanySummaryDto } from '@ai-mos/types';

export { UI_PERMISSIONS, ROLE_PERMISSIONS };

/**
 * Checks whether a given permission list satisfies a single permission requirement.
 * Supports '*' wildcard for super administrators.
 */
export function hasPermissionHelper(
  userPermissions: readonly string[] | string[],
  permission: string,
): boolean {
  if (!userPermissions || userPermissions.length === 0) return false;
  if (userPermissions.includes('*')) return true;
  return userPermissions.includes(permission);
}

/**
 * Checks whether any of the required permissions are granted.
 */
export function hasAnyPermissionHelper(
  userPermissions: readonly string[] | string[],
  permissions: string[],
): boolean {
  if (!permissions || permissions.length === 0) return true;
  if (!userPermissions || userPermissions.length === 0) return false;
  if (userPermissions.includes('*')) return true;
  return permissions.some((p) => userPermissions.includes(p));
}

/**
 * Checks whether ALL of the required permissions are granted.
 */
export function hasAllPermissionsHelper(
  userPermissions: readonly string[] | string[],
  permissions: string[],
): boolean {
  if (!permissions || permissions.length === 0) return true;
  if (!userPermissions || userPermissions.length === 0) return false;
  if (userPermissions.includes('*')) return true;
  return permissions.every((p) => userPermissions.includes(p));
}

/**
 * Checks whether a role list satisfies a role requirement.
 * SUPER_ADMIN satisfies any role check.
 */
export function hasRoleHelper(
  userRoles: readonly string[] | string[],
  role: string,
): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  if (userRoles.some((r) => r.toUpperCase() === 'SUPER_ADMIN')) return true;
  return userRoles.some((r) => r.toUpperCase() === role.toUpperCase());
}

/**
 * Resolves the effective permissions for the current user in the active tenant context.
 *
 * Rules:
 * 1. Unauthenticated -> []
 * 2. SUPER_ADMIN platform role -> ['*'] (wildcard access everywhere)
 * 3. Inside active company:
 *    - Role is derived from company membership (`activeCompany.role`).
 *    - If company role is `MEMBER`, specialized platform roles (DISPATCHER, ACCOUNTANT, DRIVER, CUSTOMER)
 *      are evaluated to grant appropriate operational permissions.
 *    - Permissions are resolved from `ROLE_PERMISSIONS[role]`.
 * 4. Outside active company (e.g. standalone customer or driver):
 *    - Role is derived from platform roles (`user.roles[0]`).
 * 5. Permissions explicitly granted to the user record are combined.
 */
export function resolveEffectivePermissions(
  user: CurrentUserDto | null,
  activeCompany: CompanySummaryDto | null,
): string[] {
  if (!user) return [];

  const platformRoles = user.roles ?? [];
  if (platformRoles.includes('SUPER_ADMIN')) {
    return ['*'];
  }

  // Determine active operational role
  let effectiveRole = 'MEMBER';

  if (activeCompany) {
    const compRole = activeCompany.role;
    if (compRole === 'MEMBER') {
      if (platformRoles.includes('DISPATCHER')) effectiveRole = 'DISPATCHER';
      else if (platformRoles.includes('ACCOUNTANT')) effectiveRole = 'ACCOUNTANT';
      else if (platformRoles.includes('DRIVER')) effectiveRole = 'DRIVER';
      else if (platformRoles.includes('CUSTOMER')) effectiveRole = 'CUSTOMER';
      else effectiveRole = 'MEMBER';
    } else {
      effectiveRole = compRole || 'MEMBER';
    }
  } else {
    // No active company context — use top platform role
    effectiveRole = platformRoles[0] ?? 'CUSTOMER';
  }

  const rolePerms = ROLE_PERMISSIONS[effectiveRole] ?? [];
  const customPerms = user.permissions ?? [];

  if (rolePerms.includes('*') || customPerms.includes('*')) {
    return ['*'];
  }

  return Array.from(new Set([...rolePerms, ...customPerms]));
}
