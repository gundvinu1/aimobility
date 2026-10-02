'use client';

import React from 'react';
import { usePermissions } from '@/lib/auth/use-permissions';

export interface PermissionGateProps {
  /** Required single permission */
  permission?: string;
  /** Grant access if user has AT LEAST ONE of these permissions */
  anyOf?: string[];
  /** Grant access ONLY if user has ALL of these permissions */
  allOf?: string[];
  /** Optional role requirement (e.g. 'OWNER', 'ADMIN', 'SUPER_ADMIN') */
  role?: string;
  /** Fallback content rendered if permission is denied (default: null) */
  fallback?: React.ReactNode;
  /** Protected children elements */
  children: React.ReactNode;
}

/**
 * PermissionGate Component
 *
 * Declaratively gates rendering of UI actions, buttons, and sections based on permissions.
 * Follows "No Security by CSS" principle — unauthorized elements are omitted from the DOM.
 *
 * Usage Examples:
 *   <PermissionGate permission="vehicle.create">
 *     <Button>Add Vehicle</Button>
 *   </PermissionGate>
 *
 *   <PermissionGate anyOf={["vehicle.update", "vehicle.delete"]}>
 *     <VehicleActions vehicle={v} />
 *   </PermissionGate>
 *
 *   <PermissionGate permission="employee.delete" fallback={<Badge>Restricted</Badge>}>
 *     <DeleteButton />
 *   </PermissionGate>
 */
export function PermissionGate({
  permission,
  anyOf,
  allOf,
  role,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, hasRole } = usePermissions();

  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  if (anyOf && anyOf.length > 0 && !hasAnyPermission(anyOf)) {
    return <>{fallback}</>;
  }

  if (allOf && allOf.length > 0 && !hasAllPermissions(allOf)) {
    return <>{fallback}</>;
  }

  if (role && !hasRole(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
