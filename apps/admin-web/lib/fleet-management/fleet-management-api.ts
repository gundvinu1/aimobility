import { apiClient } from '@/lib/api/api-client';
import type {
  FuelTransactionDto,
  CreateFuelTransactionDto,
  UpdateFuelTransactionDto,
  QueryFuelTransactionsDto,
  FuelAnalyticsDto,
  MaintenanceScheduleDto,
  CreateMaintenanceScheduleDto,
  UpdateMaintenanceScheduleDto,
  QueryMaintenanceSchedulesDto,
  MaintenanceRecordDto,
  CreateMaintenanceRecordDto,
  QueryMaintenanceRecordsDto,
  WorkOrderDto,
  CreateWorkOrderDto,
  UpdateWorkOrderDto,
  UpdateWorkOrderStatusDto,
  QueryWorkOrdersDto,
  VendorDto,
  CreateVendorDto,
  UpdateVendorDto,
  QueryVendorsDto,
  VendorInvoiceDto,
  CreateVendorInvoiceDto,
  UpdateVendorInvoiceDto,
  QueryVendorInvoicesDto,
  VehicleExpenseDto,
  CreateVehicleExpenseDto,
  UpdateVehicleExpenseDto,
  QueryVehicleExpensesDto,
  FleetCostSummaryDto,
  VehicleCostSummaryDto,
  CategoryCostSummaryDto,
  CostTrendDto,
  QueryFleetCostsDto,
} from '@ai-mos/types';

// ─── Fuel API ────────────────────────────────────────────────────────────────

export async function fetchFuelTransactions(
  companyId: string,
  query?: QueryFuelTransactionsDto,
): Promise<{ data: FuelTransactionDto[]; total: number; page: number; limit: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (query?.vehicleId) params.set('vehicleId', query.vehicleId);
  if (query?.driverId) params.set('driverId', query.driverId);
  if (query?.startDate) params.set('startDate', query.startDate);
  if (query?.endDate) params.set('endDate', query.endDate);
  if (query?.fuelType) params.set('fuelType', query.fuelType);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const qs = params.toString();
  const res = await apiClient.get<{ data: FuelTransactionDto[]; total: number; page: number; limit: number; totalPages: number }>(
    `/fuel${qs ? `?${qs}` : ''}`,
    { headers: { 'x-company-id': companyId } },
  );
  return res.data;
}

export async function getFuelTransaction(companyId: string, id: string): Promise<FuelTransactionDto> {
  const res = await apiClient.get<FuelTransactionDto>(`/fuel/${id}`, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function createFuelTransaction(
  companyId: string,
  data: CreateFuelTransactionDto,
): Promise<FuelTransactionDto> {
  const res = await apiClient.post<FuelTransactionDto>('/fuel', data, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function updateFuelTransaction(
  companyId: string,
  id: string,
  data: UpdateFuelTransactionDto,
): Promise<FuelTransactionDto> {
  const res = await apiClient.patch<FuelTransactionDto>(`/fuel/${id}`, data, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function deleteFuelTransaction(
  companyId: string,
  id: string,
): Promise<{ success: boolean }> {
  const res = await apiClient.delete<{ success: boolean }>(`/fuel/${id}`, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function fetchFuelAnalytics(
  companyId: string,
  query?: QueryFuelTransactionsDto,
): Promise<FuelAnalyticsDto> {
  const params = new URLSearchParams();
  if (query?.vehicleId) params.set('vehicleId', query.vehicleId);
  if (query?.startDate) params.set('startDate', query.startDate);
  if (query?.endDate) params.set('endDate', query.endDate);

  const qs = params.toString();
  const res = await apiClient.get<FuelAnalyticsDto>(`/fuel/analytics/summary${qs ? `?${qs}` : ''}`, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

// ─── Maintenance API ─────────────────────────────────────────────────────────

export async function fetchMaintenanceSchedules(
  companyId: string,
  query?: QueryMaintenanceSchedulesDto,
): Promise<{ data: MaintenanceScheduleDto[]; total: number; page: number; limit: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (query?.vehicleId) params.set('vehicleId', query.vehicleId);
  if (query?.dueStatus) params.set('dueStatus', query.dueStatus);
  if (query?.isActive !== undefined) params.set('isActive', String(query.isActive));
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const qs = params.toString();
  const res = await apiClient.get<{ data: MaintenanceScheduleDto[]; total: number; page: number; limit: number; totalPages: number }>(
    `/maintenance/schedules${qs ? `?${qs}` : ''}`,
    { headers: { 'x-company-id': companyId } },
  );
  return res.data;
}

export async function getMaintenanceSchedule(companyId: string, id: string): Promise<MaintenanceScheduleDto> {
  const res = await apiClient.get<MaintenanceScheduleDto>(`/maintenance/schedules/${id}`, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function createMaintenanceSchedule(
  companyId: string,
  data: CreateMaintenanceScheduleDto,
): Promise<MaintenanceScheduleDto> {
  const res = await apiClient.post<MaintenanceScheduleDto>('/maintenance/schedules', data, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function updateMaintenanceSchedule(
  companyId: string,
  id: string,
  data: UpdateMaintenanceScheduleDto,
): Promise<MaintenanceScheduleDto> {
  const res = await apiClient.patch<MaintenanceScheduleDto>(`/maintenance/schedules/${id}`, data, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function deleteMaintenanceSchedule(
  companyId: string,
  id: string,
): Promise<{ success: boolean }> {
  const res = await apiClient.delete<{ success: boolean }>(`/maintenance/schedules/${id}`, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function fetchMaintenanceRecords(
  companyId: string,
  query?: QueryMaintenanceRecordsDto,
): Promise<{ data: MaintenanceRecordDto[]; total: number; page: number; limit: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (query?.vehicleId) params.set('vehicleId', query.vehicleId);
  if (query?.startDate) params.set('startDate', query.startDate);
  if (query?.endDate) params.set('endDate', query.endDate);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const qs = params.toString();
  const res = await apiClient.get<{ data: MaintenanceRecordDto[]; total: number; page: number; limit: number; totalPages: number }>(
    `/maintenance/records${qs ? `?${qs}` : ''}`,
    { headers: { 'x-company-id': companyId } },
  );
  return res.data;
}

export async function createMaintenanceRecord(
  companyId: string,
  data: CreateMaintenanceRecordDto,
): Promise<MaintenanceRecordDto> {
  const res = await apiClient.post<MaintenanceRecordDto>('/maintenance/records', data, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function triggerMaintenanceReminders(companyId: string): Promise<{ evaluated: boolean; alertsSent: number }> {
  const res = await apiClient.post<{ evaluated: boolean; alertsSent: number }>(
    '/maintenance/evaluate-reminders',
    {},
    { headers: { 'x-company-id': companyId } },
  );
  return res.data;
}

// ─── Work Orders API ─────────────────────────────────────────────────────────

export async function fetchWorkOrders(
  companyId: string,
  query?: QueryWorkOrdersDto,
): Promise<{ data: WorkOrderDto[]; total: number; page: number; limit: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (query?.vehicleId) params.set('vehicleId', query.vehicleId);
  if (query?.vendorId) params.set('vendorId', query.vendorId);
  if (query?.status) params.set('status', query.status);
  if (query?.priority) params.set('priority', query.priority);
  if (query?.search) params.set('search', query.search);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const qs = params.toString();
  const res = await apiClient.get<{ data: WorkOrderDto[]; total: number; page: number; limit: number; totalPages: number }>(
    `/work-orders${qs ? `?${qs}` : ''}`,
    { headers: { 'x-company-id': companyId } },
  );
  return res.data;
}

export async function getWorkOrder(companyId: string, id: string): Promise<WorkOrderDto> {
  const res = await apiClient.get<WorkOrderDto>(`/work-orders/${id}`, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function createWorkOrder(companyId: string, data: CreateWorkOrderDto): Promise<WorkOrderDto> {
  const res = await apiClient.post<WorkOrderDto>('/work-orders', data, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function updateWorkOrder(
  companyId: string,
  id: string,
  data: UpdateWorkOrderDto,
): Promise<WorkOrderDto> {
  const res = await apiClient.patch<WorkOrderDto>(`/work-orders/${id}`, data, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function updateWorkOrderStatus(
  companyId: string,
  id: string,
  data: UpdateWorkOrderStatusDto,
): Promise<WorkOrderDto> {
  const res = await apiClient.patch<WorkOrderDto>(`/work-orders/${id}/status`, data, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function deleteWorkOrder(companyId: string, id: string): Promise<{ success: boolean }> {
  const res = await apiClient.delete<{ success: boolean }>(`/work-orders/${id}`, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

// ─── Vendors & Invoices API ──────────────────────────────────────────────────

export async function fetchVendors(
  companyId: string,
  query?: QueryVendorsDto,
): Promise<{ data: VendorDto[]; total: number; page: number; limit: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (query?.type) params.set('type', query.type);
  if (query?.isActive !== undefined) params.set('isActive', String(query.isActive));
  if (query?.search) params.set('search', query.search);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const qs = params.toString();
  const res = await apiClient.get<{ data: VendorDto[]; total: number; page: number; limit: number; totalPages: number }>(
    `/vendors${qs ? `?${qs}` : ''}`,
    { headers: { 'x-company-id': companyId } },
  );
  return res.data;
}

export async function getVendor(companyId: string, id: string): Promise<VendorDto> {
  const res = await apiClient.get<VendorDto>(`/vendors/${id}`, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function createVendor(companyId: string, data: CreateVendorDto): Promise<VendorDto> {
  const res = await apiClient.post<VendorDto>('/vendors', data, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function updateVendor(
  companyId: string,
  id: string,
  data: UpdateVendorDto,
): Promise<VendorDto> {
  const res = await apiClient.patch<VendorDto>(`/vendors/${id}`, data, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function deleteVendor(companyId: string, id: string): Promise<{ success: boolean }> {
  const res = await apiClient.delete<{ success: boolean }>(`/vendors/${id}`, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function fetchVendorInvoices(
  companyId: string,
  query?: QueryVendorInvoicesDto,
): Promise<{ data: VendorInvoiceDto[]; total: number; page: number; limit: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (query?.vendorId) params.set('vendorId', query.vendorId);
  if (query?.status) params.set('status', query.status);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const qs = params.toString();
  const res = await apiClient.get<{ data: VendorInvoiceDto[]; total: number; page: number; limit: number; totalPages: number }>(
    `/vendors/invoices/all${qs ? `?${qs}` : ''}`,
    { headers: { 'x-company-id': companyId } },
  );
  return res.data;
}

export async function createVendorInvoice(
  companyId: string,
  data: CreateVendorInvoiceDto,
): Promise<VendorInvoiceDto> {
  const res = await apiClient.post<VendorInvoiceDto>('/vendors/invoices', data, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function updateVendorInvoice(
  companyId: string,
  id: string,
  data: UpdateVendorInvoiceDto,
): Promise<VendorInvoiceDto> {
  const res = await apiClient.patch<VendorInvoiceDto>(`/vendors/invoices/${id}`, data, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

// ─── Vehicle Expenses API ────────────────────────────────────────────────────

export async function fetchVehicleExpenses(
  companyId: string,
  query?: QueryVehicleExpensesDto,
): Promise<{ data: VehicleExpenseDto[]; total: number; page: number; limit: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (query?.vehicleId) params.set('vehicleId', query.vehicleId);
  if (query?.driverId) params.set('driverId', query.driverId);
  if (query?.category) params.set('category', query.category);
  if (query?.startDate) params.set('startDate', query.startDate);
  if (query?.endDate) params.set('endDate', query.endDate);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const qs = params.toString();
  const res = await apiClient.get<{ data: VehicleExpenseDto[]; total: number; page: number; limit: number; totalPages: number }>(
    `/vehicle-expenses${qs ? `?${qs}` : ''}`,
    { headers: { 'x-company-id': companyId } },
  );
  return res.data;
}

export async function createVehicleExpense(
  companyId: string,
  data: CreateVehicleExpenseDto,
): Promise<VehicleExpenseDto> {
  const res = await apiClient.post<VehicleExpenseDto>('/vehicle-expenses', data, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function updateVehicleExpense(
  companyId: string,
  id: string,
  data: UpdateVehicleExpenseDto,
): Promise<VehicleExpenseDto> {
  const res = await apiClient.patch<VehicleExpenseDto>(`/vehicle-expenses/${id}`, data, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function deleteVehicleExpense(
  companyId: string,
  id: string,
): Promise<{ success: boolean }> {
  const res = await apiClient.delete<{ success: boolean }>(`/vehicle-expenses/${id}`, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

// ─── TCO & Fleet Cost Analytics API ──────────────────────────────────────────

export async function fetchCostSummary(
  companyId: string,
  query?: QueryFleetCostsDto,
): Promise<FleetCostSummaryDto> {
  const params = new URLSearchParams();
  if (query?.vehicleId) params.set('vehicleId', query.vehicleId);
  if (query?.range) params.set('range', query.range);
  if (query?.startDate) params.set('startDate', query.startDate);
  if (query?.endDate) params.set('endDate', query.endDate);

  const qs = params.toString();
  const res = await apiClient.get<FleetCostSummaryDto>(`/fleet-costs/summary${qs ? `?${qs}` : ''}`, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function fetchVehicleCosts(
  companyId: string,
  query?: QueryFleetCostsDto,
): Promise<VehicleCostSummaryDto[]> {
  const params = new URLSearchParams();
  if (query?.vehicleId) params.set('vehicleId', query.vehicleId);
  if (query?.range) params.set('range', query.range);
  if (query?.startDate) params.set('startDate', query.startDate);
  if (query?.endDate) params.set('endDate', query.endDate);

  const qs = params.toString();
  const res = await apiClient.get<VehicleCostSummaryDto[]>(`/fleet-costs/vehicles${qs ? `?${qs}` : ''}`, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function fetchCategoryCosts(
  companyId: string,
  query?: QueryFleetCostsDto,
): Promise<CategoryCostSummaryDto[]> {
  const params = new URLSearchParams();
  if (query?.vehicleId) params.set('vehicleId', query.vehicleId);
  if (query?.range) params.set('range', query.range);
  if (query?.startDate) params.set('startDate', query.startDate);
  if (query?.endDate) params.set('endDate', query.endDate);

  const qs = params.toString();
  const res = await apiClient.get<CategoryCostSummaryDto[]>(`/fleet-costs/categories${qs ? `?${qs}` : ''}`, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}

export async function fetchCostTrends(
  companyId: string,
  query?: QueryFleetCostsDto,
): Promise<CostTrendDto[]> {
  const params = new URLSearchParams();
  if (query?.vehicleId) params.set('vehicleId', query.vehicleId);
  if (query?.range) params.set('range', query.range);
  if (query?.startDate) params.set('startDate', query.startDate);
  if (query?.endDate) params.set('endDate', query.endDate);

  const qs = params.toString();
  const res = await apiClient.get<CostTrendDto[]>(`/fleet-costs/trends${qs ? `?${qs}` : ''}`, {
    headers: { 'x-company-id': companyId },
  });
  return res.data;
}
