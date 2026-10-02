// =============================================================================
// RBAC API Client — Module 8B
// =============================================================================

import type {
  RoleSummaryDto,
  RoleDetailDto,
  PermissionDto,
  CreateRoleRequest,
  UpdateRoleRequest,
} from '@ai-mos/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface RbacFetchOptions extends RequestInit {
  accessToken?: string;
  companyId?: string;
}

async function rbacFetch<T>(
  path: string,
  options: RbacFetchOptions = {},
): Promise<T> {
  const { accessToken, companyId, ...init } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(companyId ? { 'x-company-id': companyId } : {}),
  };

  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    headers: { ...headers, ...((init.headers as Record<string, string>) ?? {}) },
  });

  if (res.status === 204) return undefined as unknown as T;

  const json = (await res.json()) as unknown;
  if (!res.ok) {
    const err = json as { error?: { message: string }; message?: string };
    throw new Error(err.error?.message ?? err.message ?? `Request failed: ${res.status}`);
  }

  const wrapped = json as { success?: boolean; data?: T };
  if (wrapped.success !== undefined && wrapped.data !== undefined) return wrapped.data as T;
  return json as T;
}

export interface ListRolesParams {
  search?: string;
  scope?: 'PLATFORM' | 'COMPANY';
}

export const rbacApi = {
  // Roles
  listRoles(accessToken: string, companyId?: string, params: ListRolesParams = {}): Promise<RoleSummaryDto[]> {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.scope) q.set('scope', params.scope);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return rbacFetch(`/rbac/roles${qs}`, { accessToken, companyId });
  },

  getRole(accessToken: string, id: string, companyId?: string): Promise<RoleDetailDto> {
    return rbacFetch(`/rbac/roles/${id}`, { accessToken, companyId });
  },

  createRole(accessToken: string, data: CreateRoleRequest, companyId?: string): Promise<RoleDetailDto> {
    return rbacFetch('/rbac/roles', {
      method: 'POST',
      body: JSON.stringify(data),
      accessToken,
      companyId,
    });
  },

  updateRole(accessToken: string, id: string, data: UpdateRoleRequest, companyId?: string): Promise<RoleDetailDto> {
    return rbacFetch(`/rbac/roles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      accessToken,
      companyId,
    });
  },

  deleteRole(accessToken: string, id: string, companyId?: string): Promise<{ success: boolean; message: string }> {
    return rbacFetch(`/rbac/roles/${id}`, {
      method: 'DELETE',
      accessToken,
      companyId,
    });
  },

  // Permissions & Matrix
  listPermissions(accessToken: string): Promise<PermissionDto[]> {
    return rbacFetch('/rbac/permissions', { accessToken });
  },

  getRolePermissions(accessToken: string, roleId: string, companyId?: string): Promise<PermissionDto[]> {
    return rbacFetch(`/rbac/roles/${roleId}/permissions`, { accessToken, companyId });
  },

  updateRolePermissions(
    accessToken: string,
    roleId: string,
    permissionIds: string[],
    companyId?: string,
  ): Promise<RoleDetailDto> {
    return rbacFetch(`/rbac/roles/${roleId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissionIds }),
      accessToken,
      companyId,
    });
  },
};
