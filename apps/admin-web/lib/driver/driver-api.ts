// =============================================================================
// Driver API Client — Module 6
// =============================================================================

import type {
  DriverDto,
  DriverListDto,
  DriverStatsDto,
  DriverDocumentDto,
  DriverDutyLogDto,
  DriverVehicleAssignmentDto,
} from '@ai-mos/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface DriverFetchOptions extends RequestInit {
  accessToken?: string;
  companyId?: string;
}

async function driverFetch<T>(
  path: string,
  options: DriverFetchOptions = {},
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

// ─── Driver list params ───────────────────────────────────────────────────────

export interface ListDriversParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  dutyStatus?: string;
  licenseType?: string;
  licenseExpiringDays?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function buildDriverQuery(params: ListDriversParams): string {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.search) q.set('search', params.search);
  if (params.status) q.set('status', params.status);
  if (params.dutyStatus) q.set('dutyStatus', params.dutyStatus);
  if (params.licenseType) q.set('licenseType', params.licenseType);
  if (params.licenseExpiringDays) q.set('licenseExpiringDays', String(params.licenseExpiringDays));
  if (params.sortBy) q.set('sortBy', params.sortBy);
  if (params.sortOrder) q.set('sortOrder', params.sortOrder);
  return q.toString() ? `?${q.toString()}` : '';
}

// ─── Driver API ───────────────────────────────────────────────────────────────

export const driverApi = {
  // CRUD
  list(accessToken: string, companyId: string, params: ListDriversParams = {}): Promise<DriverListDto> {
    return driverFetch(`/drivers${buildDriverQuery(params)}`, { accessToken, companyId });
  },
  stats(accessToken: string, companyId: string): Promise<DriverStatsDto> {
    return driverFetch('/drivers/stats', { accessToken, companyId });
  },
  get(accessToken: string, companyId: string, id: string): Promise<DriverDto> {
    return driverFetch(`/drivers/${id}`, { accessToken, companyId });
  },
  create(accessToken: string, companyId: string, data: Record<string, unknown>): Promise<DriverDto> {
    return driverFetch('/drivers', {
      method: 'POST',
      body: JSON.stringify(data),
      accessToken,
      companyId,
    });
  },
  update(accessToken: string, companyId: string, id: string, data: Record<string, unknown>): Promise<DriverDto> {
    return driverFetch(`/drivers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      accessToken,
      companyId,
    });
  },
  updateStatus(accessToken: string, companyId: string, id: string, status: string): Promise<DriverDto> {
    return driverFetch(`/drivers/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      accessToken,
      companyId,
    });
  },
  updateDutyStatus(
    accessToken: string,
    companyId: string,
    id: string,
    dutyStatus: string,
    notes?: string,
  ): Promise<DriverDto> {
    return driverFetch(`/drivers/${id}/duty-status`, {
      method: 'PATCH',
      body: JSON.stringify({ dutyStatus, notes }),
      accessToken,
      companyId,
    });
  },
  remove(accessToken: string, companyId: string, id: string): Promise<void> {
    return driverFetch(`/drivers/${id}`, { method: 'DELETE', accessToken, companyId });
  },

  // Documents
  getDocuments(accessToken: string, companyId: string, driverId: string): Promise<DriverDocumentDto[]> {
    return driverFetch(`/drivers/${driverId}/documents`, { accessToken, companyId });
  },
  addDocument(
    accessToken: string,
    companyId: string,
    driverId: string,
    data: Record<string, unknown>,
  ): Promise<DriverDocumentDto> {
    return driverFetch(`/drivers/${driverId}/documents`, {
      method: 'POST',
      body: JSON.stringify(data),
      accessToken,
      companyId,
    });
  },
  updateDocument(
    accessToken: string,
    companyId: string,
    driverId: string,
    docId: string,
    data: Record<string, unknown>,
  ): Promise<DriverDocumentDto> {
    return driverFetch(`/drivers/${driverId}/documents/${docId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      accessToken,
      companyId,
    });
  },
  deleteDocument(accessToken: string, companyId: string, driverId: string, docId: string): Promise<void> {
    return driverFetch(`/drivers/${driverId}/documents/${docId}`, {
      method: 'DELETE',
      accessToken,
      companyId,
    });
  },

  // Duty History
  getDutyHistory(accessToken: string, companyId: string, driverId: string): Promise<DriverDutyLogDto[]> {
    return driverFetch(`/drivers/${driverId}/duty-history`, { accessToken, companyId });
  },
  createDuty(
    accessToken: string,
    companyId: string,
    driverId: string,
    data: Record<string, unknown>,
  ): Promise<DriverDutyLogDto> {
    return driverFetch(`/drivers/${driverId}/duty`, {
      method: 'POST',
      body: JSON.stringify(data),
      accessToken,
      companyId,
    });
  },

  // Vehicle Assignment
  getVehicle(accessToken: string, companyId: string, driverId: string): Promise<DriverVehicleAssignmentDto | null> {
    return driverFetch(`/drivers/${driverId}/vehicle`, { accessToken, companyId });
  },
  assignVehicle(
    accessToken: string,
    companyId: string,
    driverId: string,
    data: Record<string, unknown>,
  ): Promise<DriverVehicleAssignmentDto> {
    return driverFetch(`/drivers/${driverId}/vehicle`, {
      method: 'POST',
      body: JSON.stringify(data),
      accessToken,
      companyId,
    });
  },
  unassignVehicle(accessToken: string, companyId: string, driverId: string): Promise<void> {
    return driverFetch(`/drivers/${driverId}/vehicle`, {
      method: 'DELETE',
      accessToken,
      companyId,
    });
  },
};
