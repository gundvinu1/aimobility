// =============================================================================
// Employee API Client
// =============================================================================

import type {
  EmployeeDto,
  EmployeeListDto,
  EmployeeStatsDto,
} from '@ai-mos/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface EmployeeFetchOptions extends RequestInit {
  accessToken?: string;
  companyId?: string;
}

async function employeeFetch<T>(
  path: string,
  options: EmployeeFetchOptions = {},
): Promise<T> {
  const { accessToken, companyId, ...init } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(companyId   ? { 'x-company-id': companyId }              : {}),
  };
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> ?? {}) },
  });
  if (res.status === 204) return undefined as unknown as T;
  const json = await res.json() as unknown;
  if (!res.ok) {
    const err = json as { error?: { message: string }; message?: string };
    throw new Error(err.error?.message ?? err.message ?? `Request failed: ${res.status}`);
  }
  // Handle envelope { success, data } or plain object
  const wrapped = json as { success?: boolean; data?: T };
  if (wrapped.success !== undefined && wrapped.data !== undefined) return wrapped.data as T;
  return json as T;
}

// ─── Employee API methods ─────────────────────────────────────────────────────

export interface ListEmployeesParams {
  page?: number;
  limit?: number;
  search?: string;
  employmentStatus?: string;
  employmentType?: string;
  department?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function buildEmployeeQuery(params: ListEmployeesParams): string {
  const q = new URLSearchParams();
  if (params.page)             q.set('page',             String(params.page));
  if (params.limit)            q.set('limit',            String(params.limit));
  if (params.search)           q.set('search',           params.search);
  if (params.employmentStatus) q.set('employmentStatus', params.employmentStatus);
  if (params.employmentType)   q.set('employmentType',   params.employmentType);
  if (params.department)       q.set('department',       params.department);
  if (params.sortBy)           q.set('sortBy',           params.sortBy);
  if (params.sortOrder)        q.set('sortOrder',        params.sortOrder);
  return q.toString() ? `?${q.toString()}` : '';
}

export const employeeApi = {
  list(accessToken: string, companyId: string, params: ListEmployeesParams = {}): Promise<EmployeeListDto> {
    return employeeFetch(`/employees${buildEmployeeQuery(params)}`, { accessToken, companyId });
  },

  stats(accessToken: string, companyId: string): Promise<EmployeeStatsDto> {
    return employeeFetch('/employees/stats', { accessToken, companyId });
  },

  get(accessToken: string, companyId: string, id: string): Promise<EmployeeDto> {
    return employeeFetch(`/employees/${id}`, { accessToken, companyId });
  },

  create(accessToken: string, companyId: string, data: Record<string, unknown>): Promise<EmployeeDto> {
    return employeeFetch('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
      accessToken,
      companyId,
    });
  },

  update(accessToken: string, companyId: string, id: string, data: Record<string, unknown>): Promise<EmployeeDto> {
    return employeeFetch(`/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      accessToken,
      companyId,
    });
  },

  updateStatus(accessToken: string, companyId: string, id: string, employmentStatus: string): Promise<EmployeeDto> {
    return employeeFetch(`/employees/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ employmentStatus }),
      accessToken,
      companyId,
    });
  },

  remove(accessToken: string, companyId: string, id: string): Promise<void> {
    return employeeFetch(`/employees/${id}`, {
      method: 'DELETE',
      accessToken,
      companyId,
    });
  },

  linkUser(accessToken: string, companyId: string, id: string, userId: string): Promise<EmployeeDto> {
    return employeeFetch(`/employees/${id}/link-user`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
      accessToken,
      companyId,
    });
  },

  unlinkUser(accessToken: string, companyId: string, id: string): Promise<EmployeeDto> {
    return employeeFetch(`/employees/${id}/link-user`, {
      method: 'DELETE',
      accessToken,
      companyId,
    });
  },
};
