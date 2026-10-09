import { apiClient } from '@/lib/api/api-client';
import type {
  GeofenceDto,
  CreateGeofenceDto,
  UpdateGeofenceDto,
  GeofenceVehicleDto,
} from '@ai-mos/types';

export async function fetchGeofences(
  companyId: string,
  options?: { isActive?: boolean; search?: string },
): Promise<GeofenceDto[]> {
  const queryParams = new URLSearchParams();
  if (options?.isActive !== undefined) {
    queryParams.set('isActive', String(options.isActive));
  }
  if (options?.search) {
    queryParams.set('search', options.search);
  }

  const qs = queryParams.toString();
  const url = `/geofences${qs ? `?${qs}` : ''}`;

  const res = await apiClient.get<GeofenceDto[]>(url, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function getGeofence(
  companyId: string,
  geofenceId: string,
): Promise<GeofenceDto> {
  const res = await apiClient.get<GeofenceDto>(`/geofences/${geofenceId}`, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function createGeofence(
  companyId: string,
  data: CreateGeofenceDto,
): Promise<GeofenceDto> {
  const res = await apiClient.post<GeofenceDto>('/geofences', data, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function updateGeofence(
  companyId: string,
  geofenceId: string,
  data: UpdateGeofenceDto,
): Promise<GeofenceDto> {
  const res = await apiClient.patch<GeofenceDto>(`/geofences/${geofenceId}`, data, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function deleteGeofence(
  companyId: string,
  geofenceId: string,
): Promise<{ success: boolean }> {
  const res = await apiClient.delete<{ success: boolean }>(`/geofences/${geofenceId}`, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function fetchAssignedVehicles(
  companyId: string,
  geofenceId: string,
): Promise<GeofenceVehicleDto[]> {
  const res = await apiClient.get<GeofenceVehicleDto[]>(`/geofences/${geofenceId}/vehicles`, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function assignVehiclesToGeofence(
  companyId: string,
  geofenceId: string,
  vehicleIds: string[],
): Promise<GeofenceVehicleDto[]> {
  const res = await apiClient.post<GeofenceVehicleDto[]>(
    `/geofences/${geofenceId}/vehicles`,
    { vehicleIds },
    { headers: { 'x-company-id': companyId } },
  );
  return res.data;
}

export async function removeVehicleFromGeofence(
  companyId: string,
  geofenceId: string,
  vehicleId: string,
): Promise<{ success: boolean }> {
  const res = await apiClient.delete<{ success: boolean }>(
    `/geofences/${geofenceId}/vehicles/${vehicleId}`,
    { headers: { 'x-company-id': companyId } },
  );
  return res.data;
}
