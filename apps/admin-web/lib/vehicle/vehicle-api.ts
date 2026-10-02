// =============================================================================
// Vehicle API Client — Module 5
// =============================================================================

import type {
  VehicleDto,
  VehicleListDto,
  VehicleStatsDto,
  VehicleDocumentDto,
  VehicleMaintenanceDto,
} from '@ai-mos/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface VehicleFetchOptions extends RequestInit {
  accessToken?: string;
  companyId?: string;
}

async function vehicleFetch<T>(
  path: string,
  options: VehicleFetchOptions = {},
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
  const wrapped = json as { success?: boolean; data?: T };
  if (wrapped.success !== undefined && wrapped.data !== undefined) return wrapped.data as T;
  return json as T;
}

// ─── Vehicle list params ──────────────────────────────────────────────────────

export interface ListVehiclesParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  fuelType?: string;
  ownership?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function buildVehicleQuery(params: ListVehiclesParams): string {
  const q = new URLSearchParams();
  if (params.page)      q.set('page',      String(params.page));
  if (params.limit)     q.set('limit',     String(params.limit));
  if (params.search)    q.set('search',    params.search);
  if (params.status)    q.set('status',    params.status);
  if (params.fuelType)  q.set('fuelType',  params.fuelType);
  if (params.ownership) q.set('ownership', params.ownership);
  if (params.sortBy)    q.set('sortBy',    params.sortBy);
  if (params.sortOrder) q.set('sortOrder', params.sortOrder);
  return q.toString() ? `?${q.toString()}` : '';
}

// ─── Vehicle API ──────────────────────────────────────────────────────────────

export const vehicleApi = {
  // CRUD
  list(accessToken: string, companyId: string, params: ListVehiclesParams = {}): Promise<VehicleListDto> {
    return vehicleFetch(`/vehicles${buildVehicleQuery(params)}`, { accessToken, companyId });
  },
  stats(accessToken: string, companyId: string): Promise<VehicleStatsDto> {
    return vehicleFetch('/vehicles/stats', { accessToken, companyId });
  },
  get(accessToken: string, companyId: string, id: string): Promise<VehicleDto> {
    return vehicleFetch(`/vehicles/${id}`, { accessToken, companyId });
  },
  create(accessToken: string, companyId: string, data: Record<string, unknown>): Promise<VehicleDto> {
    return vehicleFetch('/vehicles', {
      method: 'POST',
      body: JSON.stringify(data),
      accessToken,
      companyId,
    });
  },
  update(accessToken: string, companyId: string, id: string, data: Record<string, unknown>): Promise<VehicleDto> {
    return vehicleFetch(`/vehicles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      accessToken,
      companyId,
    });
  },
  updateStatus(accessToken: string, companyId: string, id: string, status: string): Promise<VehicleDto> {
    return vehicleFetch(`/vehicles/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      accessToken,
      companyId,
    });
  },
  remove(accessToken: string, companyId: string, id: string): Promise<void> {
    return vehicleFetch(`/vehicles/${id}`, { method: 'DELETE', accessToken, companyId });
  },

  // Documents
  getDocuments(accessToken: string, companyId: string, vehicleId: string): Promise<VehicleDocumentDto[]> {
    return vehicleFetch(`/vehicles/${vehicleId}/documents`, { accessToken, companyId });
  },
  addDocument(accessToken: string, companyId: string, vehicleId: string, data: Record<string, unknown>): Promise<VehicleDocumentDto> {
    return vehicleFetch(`/vehicles/${vehicleId}/documents`, {
      method: 'POST',
      body: JSON.stringify(data),
      accessToken,
      companyId,
    });
  },
  deleteDocument(accessToken: string, companyId: string, vehicleId: string, docId: string): Promise<void> {
    return vehicleFetch(`/vehicles/${vehicleId}/documents/${docId}`, {
      method: 'DELETE',
      accessToken,
      companyId,
    });
  },

  // Maintenance
  getMaintenances(accessToken: string, companyId: string, vehicleId: string): Promise<VehicleMaintenanceDto[]> {
    return vehicleFetch(`/vehicles/${vehicleId}/maintenances`, { accessToken, companyId });
  },
  addMaintenance(accessToken: string, companyId: string, vehicleId: string, data: Record<string, unknown>): Promise<VehicleMaintenanceDto> {
    return vehicleFetch(`/vehicles/${vehicleId}/maintenances`, {
      method: 'POST',
      body: JSON.stringify(data),
      accessToken,
      companyId,
    });
  },
  updateMaintenanceStatus(
    accessToken: string,
    companyId: string,
    vehicleId: string,
    maintId: string,
    data: Record<string, unknown>,
  ): Promise<VehicleMaintenanceDto> {
    return vehicleFetch(`/vehicles/${vehicleId}/maintenances/${maintId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      accessToken,
      companyId,
    });
  },
};
