'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/auth/use-permissions';
import { Loader2 } from 'lucide-react';

export interface RouteGuardProps {
  /** Required single permission to access this page */
  requiredPermission?: string;
  /** Required list of permissions (all must be satisfied) */
  requiredPermissions?: string[];
  /** Optional role requirement (e.g. 'OWNER', 'ADMIN', 'SUPER_ADMIN') */
  requiredRole?: string;
  /** Whether the route requires an active company context (default: false) */
  requireCompany?: boolean;
  /** Protected page contents */
  children: React.ReactNode;
}

/**
 * RouteGuard Component
 *
 * Enforces page-level permission and tenant boundaries.
 *
 * Behaviors:
 * 1. While loading: renders a clean loading indicator (prevents flash of unauthorized UI).
 * 2. Unauthenticated user: redirects to /login.
 * 3. Missing company context (when required): redirects to /companies.
 * 4. Unauthorized user: redirects to /403.
 * 5. Authorized user: renders children.
 *
 * Usage:
 *   <RouteGuard requiredPermission="vehicle.read">
 *     <VehiclesPage />
 *   </RouteGuard>
 */
export function RouteGuard({
  requiredPermission,
  requiredPermissions,
  requiredRole,
  requireCompany = false,
  children,
}: RouteGuardProps) {
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading,
    activeCompany,
    hasPermission,
    hasAllPermissions,
    hasRole,
  } = usePermissions();

  const isAuthorized = React.useMemo(() => {
    if (isLoading || !isAuthenticated) return false;

    if (requireCompany && !activeCompany) {
      return false;
    }

    if (requiredPermission && !hasPermission(requiredPermission)) {
      return false;
    }

    if (
      requiredPermissions &&
      requiredPermissions.length > 0 &&
      !hasAllPermissions(requiredPermissions)
    ) {
      return false;
    }

    if (requiredRole && !hasRole(requiredRole)) {
      return false;
    }

    return true;
  }, [
    isLoading,
    isAuthenticated,
    requireCompany,
    activeCompany,
    requiredPermission,
    requiredPermissions,
    requiredRole,
    hasPermission,
    hasAllPermissions,
    hasRole,
  ]);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (requireCompany && !activeCompany) {
      router.replace('/companies');
      return;
    }

    if (!isAuthorized) {
      router.replace('/403');
    }
  }, [isLoading, isAuthenticated, requireCompany, activeCompany, isAuthorized, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-1 items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verifying permissions…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || (requireCompany && !activeCompany) || !isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
