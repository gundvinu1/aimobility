import { apiClient } from '@/lib/api/api-client';
import type {
  FleetAlertDto,
  FleetAlertListDto,
  FleetAlertSummaryDto,
  CompanyAlertConfigDto,
  UpdateCompanyAlertConfigDto,
  DriverSafetySummaryDto,
  VehicleSafetySummaryDto,
  FleetAlertType,
  FleetAlertSeverity,
  FleetAlertStatus,
} from '@ai-mos/types';

export interface AlertFilterOptions {
  type?: FleetAlertType;
  severity?: FleetAlertSeverity;
  status?: FleetAlertStatus;
  vehicleId?: string;
  driverId?: string;
  geofenceId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function fetchAlerts(
  companyId: string,
  options?: AlertFilterOptions,
): Promise<FleetAlertListDto> {
  const queryParams = new URLSearchParams();
  if (options?.type) queryParams.set('type', options.type);
  if (options?.severity) queryParams.set('severity', options.severity);
  if (options?.status) queryParams.set('status', options.status);
  if (options?.vehicleId) queryParams.set('vehicleId', options.vehicleId);
  if (options?.driverId) queryParams.set('driverId', options.driverId);
  if (options?.geofenceId) queryParams.set('geofenceId', options.geofenceId);
  if (options?.startDate) queryParams.set('startDate', options.startDate);
  if (options?.endDate) queryParams.set('endDate', options.endDate);
  if (options?.search) queryParams.set('search', options.search);
  if (options?.page) queryParams.set('page', String(options.page));
  if (options?.limit) queryParams.set('limit', String(options.limit));

  const qs = queryParams.toString();
  const url = `/alerts${qs ? `?${qs}` : ''}`;

  const res = await apiClient.get<FleetAlertListDto>(url, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function fetchAlertSummary(companyId: string): Promise<FleetAlertSummaryDto> {
  const res = await apiClient.get<FleetAlertSummaryDto>('/alerts/summary', {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function fetchAlertConfig(companyId: string): Promise<CompanyAlertConfigDto> {
  const res = await apiClient.get<CompanyAlertConfigDto>('/alerts/config', {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function updateAlertConfig(
  companyId: string,
  data: UpdateCompanyAlertConfigDto,
): Promise<CompanyAlertConfigDto> {
  const res = await apiClient.patch<CompanyAlertConfigDto>('/alerts/config', data, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function getAlert(companyId: string, alertId: string): Promise<FleetAlertDto> {
  const res = await apiClient.get<FleetAlertDto>(`/alerts/${alertId}`, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function acknowledgeAlert(
  companyId: string,
  alertId: string,
  notes?: string,
): Promise<FleetAlertDto> {
  const res = await apiClient.patch<FleetAlertDto>(
    `/alerts/${alertId}/acknowledge`,
    { notes },
    { headers: { 'x-company-id': companyId } },
  );
  return res.data;
}

export async function resolveAlert(
  companyId: string,
  alertId: string,
  notes?: string,
): Promise<FleetAlertDto> {
  const res = await apiClient.patch<FleetAlertDto>(
    `/alerts/${alertId}/resolve`,
    { notes },
    { headers: { 'x-company-id': companyId } },
  );
  return res.data;
}

export async function dismissAlert(
  companyId: string,
  alertId: string,
  notes?: string,
): Promise<FleetAlertDto> {
  const res = await apiClient.patch<FleetAlertDto>(
    `/alerts/${alertId}/dismiss`,
    { notes },
    { headers: { 'x-company-id': companyId } },
  );
  return res.data;
}

export async function fetchDriverSafetyAnalytics(
  companyId: string,
  driverId?: string,
): Promise<DriverSafetySummaryDto[]> {
  const qs = driverId ? `?driverId=${driverId}` : '';
  const res = await apiClient.get<DriverSafetySummaryDto[]>(`/alerts/analytics/driver${qs}`, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function fetchVehicleSafetyAnalytics(
  companyId: string,
  vehicleId?: string,
): Promise<VehicleSafetySummaryDto[]> {
  const qs = vehicleId ? `?vehicleId=${vehicleId}` : '';
  const res = await apiClient.get<VehicleSafetySummaryDto[]>(`/alerts/analytics/vehicle${qs}`, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}
