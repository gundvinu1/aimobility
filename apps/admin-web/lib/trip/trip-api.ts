// =============================================================================
// Trip API Client — Module 7
// =============================================================================

import type {
  TripDto,
  TripListDto,
  TripStatsDto,
  CreateTripPayload,
  UpdateTripPayload,
  AssignDriverPayload,
  AssignVehiclePayload,
  DispatchTripPayload,
  UpdateTripStatusPayload,
} from '@ai-mos/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface TripFetchOptions extends RequestInit {
  accessToken?: string;
  companyId?: string;
}

async function tripFetch<T>(
  path: string,
  options: TripFetchOptions = {},
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

// ─── Query params ─────────────────────────────────────────────────────────────

export interface ListTripsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  tripType?: string;
  driverId?: string;
  vehicleId?: string;
  bookingId?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function buildTripQuery(params: ListTripsParams): string {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.search?.trim()) sp.set('search', params.search.trim());
  if (params.status) sp.set('status', params.status);
  if (params.tripType) sp.set('tripType', params.tripType);
  if (params.driverId) sp.set('driverId', params.driverId);
  if (params.vehicleId) sp.set('vehicleId', params.vehicleId);
  if (params.bookingId) sp.set('bookingId', params.bookingId);
  if (params.fromDate) sp.set('fromDate', params.fromDate);
  if (params.toDate) sp.set('toDate', params.toDate);
  if (params.sortBy) sp.set('sortBy', params.sortBy);
  if (params.sortOrder) sp.set('sortOrder', params.sortOrder);
  const q = sp.toString();
  return q ? `?${q}` : '';
}

// ─── API Methods ──────────────────────────────────────────────────────────────

export async function getTrips(
  params: ListTripsParams = {},
  options: TripFetchOptions = {},
): Promise<TripListDto> {
  return tripFetch<TripListDto>(`/trips${buildTripQuery(params)}`, {
    method: 'GET',
    ...options,
  });
}

export async function getTripStats(
  options: TripFetchOptions = {},
): Promise<TripStatsDto> {
  return tripFetch<TripStatsDto>('/trips/stats', {
    method: 'GET',
    ...options,
  });
}

export async function getTrip(
  id: string,
  options: TripFetchOptions = {},
): Promise<TripDto> {
  return tripFetch<TripDto>(`/trips/${id}`, {
    method: 'GET',
    ...options,
  });
}

export async function createTrip(
  payload: CreateTripPayload,
  options: TripFetchOptions = {},
): Promise<TripDto> {
  return tripFetch<TripDto>('/trips', {
    method: 'POST',
    body: JSON.stringify(payload),
    ...options,
  });
}

export async function updateTrip(
  id: string,
  payload: UpdateTripPayload,
  options: TripFetchOptions = {},
): Promise<TripDto> {
  return tripFetch<TripDto>(`/trips/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    ...options,
  });
}

export async function assignDriver(
  tripId: string,
  payload: AssignDriverPayload,
  options: TripFetchOptions = {},
): Promise<TripDto> {
  return tripFetch<TripDto>(`/trips/${tripId}/assign-driver`, {
    method: 'POST',
    body: JSON.stringify(payload),
    ...options,
  });
}

export async function assignVehicle(
  tripId: string,
  payload: AssignVehiclePayload,
  options: TripFetchOptions = {},
): Promise<TripDto> {
  return tripFetch<TripDto>(`/trips/${tripId}/assign-vehicle`, {
    method: 'POST',
    body: JSON.stringify(payload),
    ...options,
  });
}

export async function dispatchTrip(
  tripId: string,
  payload: DispatchTripPayload = {},
  options: TripFetchOptions = {},
): Promise<TripDto> {
  return tripFetch<TripDto>(`/trips/${tripId}/dispatch`, {
    method: 'POST',
    body: JSON.stringify(payload),
    ...options,
  });
}

export async function updateTripStatus(
  tripId: string,
  payload: UpdateTripStatusPayload,
  options: TripFetchOptions = {},
): Promise<TripDto> {
  return tripFetch<TripDto>(`/trips/${tripId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    ...options,
  });
}

export async function deleteTrip(
  id: string,
  options: TripFetchOptions = {},
): Promise<{ success: boolean; message: string }> {
  return tripFetch<{ success: boolean; message: string }>(`/trips/${id}`, {
    method: 'DELETE',
    ...options,
  });
}

export const tripApi = {
  list: (accessToken: string, companyId: string, params?: ListTripsParams) =>
    getTrips(params, { accessToken, companyId }),
  stats: (accessToken: string, companyId: string) =>
    getTripStats({ accessToken, companyId }),
  get: (accessToken: string, companyId: string, id: string) =>
    getTrip(id, { accessToken, companyId }),
  create: (accessToken: string, companyId: string, payload: CreateTripPayload) =>
    createTrip(payload, { accessToken, companyId }),
  update: (accessToken: string, companyId: string, id: string, payload: UpdateTripPayload) =>
    updateTrip(id, payload, { accessToken, companyId }),
  assignDriver: (accessToken: string, companyId: string, tripId: string, payload: AssignDriverPayload) =>
    assignDriver(tripId, payload, { accessToken, companyId }),
  assignVehicle: (accessToken: string, companyId: string, tripId: string, payload: AssignVehiclePayload) =>
    assignVehicle(tripId, payload, { accessToken, companyId }),
  dispatch: (accessToken: string, companyId: string, tripId: string, payload?: DispatchTripPayload) =>
    dispatchTrip(tripId, payload, { accessToken, companyId }),
  updateStatus: (accessToken: string, companyId: string, tripId: string, payload: UpdateTripStatusPayload) =>
    updateTripStatus(tripId, payload, { accessToken, companyId }),
  delete: (accessToken: string, companyId: string, id: string) =>
    deleteTrip(id, { accessToken, companyId }),
};

