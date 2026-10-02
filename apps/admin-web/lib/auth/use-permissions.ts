'use client';

import { useMemo, useCallback } from 'react';
import { useAuth } from './auth-context';
import { useCompany } from '@/lib/company/company-context';
import {
  resolveEffectivePermissions,
  hasPermissionHelper,
  hasAnyPermissionHelper,
  hasAllPermissionsHelper,
  hasRoleHelper,
} from './permissions';
import type { CurrentUserDto, CompanySummaryDto } from '@ai-mos/types';

export interface UsePermissionsResult {
  user: CurrentUserDto | null;
  activeCompany: CompanySummaryDto | null;
  companyRole: string | null;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  hasRole: (role: string) => boolean;
}

/**
 * usePermissions Hook
 *
 * Central permission hook for dynamic role-based UI.
 * Combines global user identity with active company tenant context.
 *
 * Features:
 * - Dynamically computes effective permissions on login, logout, and company switch.
 * - Supports '*' wildcard for super administrators.
 * - Supports fine-grained operational roles (OWNER, ADMIN, MANAGER, DISPATCHER, ACCOUNTANT, DRIVER, CUSTOMER).
 */
export function usePermissions(): UsePermissionsResult {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { activeCompany, isLoading: companyLoading } = useCompany();

  const isLoading = authLoading || (isAuthenticated && companyLoading);

  // Compute effective permissions for current user + tenant context
  const permissions = useMemo(() => {
    return resolveEffectivePermissions(user, activeCompany);
  }, [user, activeCompany]);

  // Compute effective company role label
  const companyRole = useMemo(() => {
    if (!user) return null;
    if (user.roles?.includes('SUPER_ADMIN')) return 'SUPER_ADMIN';
    if (activeCompany) {
      if (activeCompany.role === 'MEMBER') {
        const specialized = user.roles?.find((r) =>
          ['DISPATCHER', 'ACCOUNTANT', 'DRIVER', 'CUSTOMER'].includes(r),
        );
        if (specialized) return specialized;
      }
      return activeCompany.role;
    }
    return user.roles?.[0] ?? null;
  }, [user, activeCompany]);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      return hasPermissionHelper(permissions, permission);
    },
    [permissions],
  );

  const hasAnyPermission = useCallback(
    (perms: string[]): boolean => {
      return hasAnyPermissionHelper(permissions, perms);
    },
    [permissions],
  );

  const hasAllPermissions = useCallback(
    (perms: string[]): boolean => {
      return hasAllPermissionsHelper(permissions, perms);
    },
    [permissions],
  );

  const hasRole = useCallback(
    (role: string): boolean => {
      const rolesToCheck = [
        ...(user?.roles ?? []),
        ...(companyRole ? [companyRole] : []),
        ...(activeCompany?.role ? [activeCompany.role] : []),
      ];
      return hasRoleHelper(rolesToCheck, role);
    },
    [user, companyRole, activeCompany],
  );

  return {
    user,
    activeCompany,
    companyRole,
    permissions,
    isAuthenticated,
    isLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
  };
}
