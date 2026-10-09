// =============================================================================
// Fleet Tracking & Telemetry API Client — Module 9
// =============================================================================

import type {
  FleetSnapshotDto,
  VehicleLocationDto,
  VehicleTelemetryListDto,
  IngestTelemetryDto,
} from '@ai-mos/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface TrackingFetchOptions extends RequestInit {
  accessToken?: string;
  companyId?: string;
}

async function trackingFetch<T>(
  path: string,
  options: TrackingFetchOptions = {},
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

export interface ListTelemetryHistoryParams {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  source?: string;
}

export const trackingApi = {
  /**
   * Fetch current live fleet tracking snapshot for a company
   */
  async getFleetSnapshot(
    companyId: string,
    accessToken?: string,
  ): Promise<FleetSnapshotDto> {
    return trackingFetch<FleetSnapshotDto>(`/companies/${companyId}/tracking`, {
      companyId,
      accessToken,
    });
  },

  /**
   * Fetch latest known location for a specific vehicle
   */
  async getVehicleLocation(
    vehicleId: string,
    companyId: string,
    accessToken?: string,
  ): Promise<VehicleLocationDto | null> {
    return trackingFetch<VehicleLocationDto | null>(
      `/vehicles/${vehicleId}/location`,
      { companyId, accessToken },
    );
  },

  /**
   * Fetch historical telemetry events for a vehicle (paginated & filtered)
   */
  async getTelemetryHistory(
    vehicleId: string,
    params: ListTelemetryHistoryParams = {},
    companyId: string,
    accessToken?: string,
  ): Promise<VehicleTelemetryListDto> {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    if (params.source) q.set('source', params.source);

    const qs = q.toString() ? `?${q.toString()}` : '';
    return trackingFetch<VehicleTelemetryListDto>(
      `/vehicles/${vehicleId}/telemetry${qs}`,
      { companyId, accessToken },
    );
  },

  /**
   * Ingest a telemetry event (device, simulator, or manual)
   */
  async ingestTelemetry(
    dto: IngestTelemetryDto,
    companyId: string,
    accessToken?: string,
  ): Promise<{ location: VehicleLocationDto; isNew: boolean }> {
    return trackingFetch<{ location: VehicleLocationDto; isNew: boolean }>(
      '/telemetry',
      {
        method: 'POST',
        body: JSON.stringify(dto),
        companyId,
        accessToken,
      },
    );
  },
};
