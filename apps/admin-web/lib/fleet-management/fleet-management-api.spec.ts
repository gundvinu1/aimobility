import {
  fetchFuelTransactions,
  createFuelTransaction,
  fetchFuelAnalytics,
  fetchMaintenanceSchedules,
  createMaintenanceSchedule,
  fetchMaintenanceRecords,
  triggerMaintenanceReminders,
  fetchWorkOrders,
  createWorkOrder,
  updateWorkOrderStatus,
  fetchVendors,
  createVendor,
  fetchVendorInvoices,
  fetchVehicleExpenses,
  createVehicleExpense,
  fetchCostSummary,
  fetchVehicleCosts,
  fetchCostTrends,
} from './fleet-management-api';
import { apiClient } from '@/lib/api/api-client';

jest.mock('@/lib/api/api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('Fleet Management Frontend API Clients', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const vehicleId = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Fuel API', () => {
    it('fetchFuelTransactions calls GET /fuel with company header', async () => {
      const mockResult = { data: [{ id: 'tx-1', quantityLiters: 45 }], total: 1 };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResult });

      const res = await fetchFuelTransactions(companyId, { fuelType: 'DIESEL' as any });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/fuel?fuelType=DIESEL'),
        { headers: { 'x-company-id': companyId } },
      );
      expect(res).toEqual(mockResult);
    });

    it('createFuelTransaction calls POST /fuel with payload', async () => {
      const payload: any = { vehicleId, quantityLiters: 50, pricePerLiter: 100 };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: 'tx-new', ...payload } });

      const res = await createFuelTransaction(companyId, payload);

      expect(apiClient.post).toHaveBeenCalledWith('/fuel', payload, {
        headers: { 'x-company-id': companyId },
      });
      expect(res.id).toBe('tx-new');
    });

    it('fetchFuelAnalytics calls GET /fuel/analytics/summary', async () => {
      const mockAnalytics = { totalFuelConsumed: 500, totalFuelCost: 50000, avgKmPerLiter: 12 };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockAnalytics });

      const res = await fetchFuelAnalytics(companyId);

      expect(apiClient.get).toHaveBeenCalledWith(
        '/fuel/analytics/summary',
        { headers: { 'x-company-id': companyId } },
      );
      expect(res.avgKmPerLiter).toBe(12);
    });
  });

  describe('Maintenance API', () => {
    it('fetchMaintenanceSchedules calls GET /maintenance/schedules', async () => {
      const mockResult = { data: [{ id: 'sched-1', serviceType: 'Oil Change' }], total: 1 };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResult });

      const res = await fetchMaintenanceSchedules(companyId, { dueStatus: 'DUE' });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/maintenance/schedules?dueStatus=DUE'),
        { headers: { 'x-company-id': companyId } },
      );
      expect(res).toEqual(mockResult);
    });

    it('createMaintenanceSchedule calls POST /maintenance/schedules', async () => {
      const payload: any = { vehicleId, serviceType: 'Brake Inspection', intervalKm: 15000 };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: 'sched-new', ...payload } });

      const res = await createMaintenanceSchedule(companyId, payload);

      expect(apiClient.post).toHaveBeenCalledWith('/maintenance/schedules', payload, {
        headers: { 'x-company-id': companyId },
      });
      expect(res.id).toBe('sched-new');
    });

    it('fetchMaintenanceRecords calls GET /maintenance/records', async () => {
      const mockResult = { data: [{ id: 'rec-1', serviceType: 'Oil Change', totalCost: 120 }], total: 1 };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResult });

      const res = await fetchMaintenanceRecords(companyId, { vehicleId });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining(`/maintenance/records?vehicleId=${vehicleId}`),
        { headers: { 'x-company-id': companyId } },
      );
      expect(res).toEqual(mockResult);
    });

    it('triggerMaintenanceReminders calls POST /maintenance/evaluate-reminders', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: { evaluated: true, alertsSent: 2 } });

      const res = await triggerMaintenanceReminders(companyId);

      expect(apiClient.post).toHaveBeenCalledWith(
        '/maintenance/evaluate-reminders',
        {},
        { headers: { 'x-company-id': companyId } },
      );
      expect(res.alertsSent).toBe(2);
    });
  });

  describe('Work Orders API', () => {
    it('fetchWorkOrders calls GET /work-orders with status filter', async () => {
      const mockResult = { data: [{ id: 'wo-1', workOrderNumber: 'WO-2026-0001' }], total: 1 };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResult });

      const res = await fetchWorkOrders(companyId, { status: 'OPEN' });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/work-orders?status=OPEN'),
        { headers: { 'x-company-id': companyId } },
      );
      expect(res).toEqual(mockResult);
    });

    it('createWorkOrder calls POST /work-orders', async () => {
      const payload: any = { vehicleId, title: 'Engine Check', priority: 'HIGH' };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: 'wo-new', ...payload } });

      const res = await createWorkOrder(companyId, payload);

      expect(apiClient.post).toHaveBeenCalledWith('/work-orders', payload, {
        headers: { 'x-company-id': companyId },
      });
      expect(res.id).toBe('wo-new');
    });

    it('updateWorkOrderStatus calls PATCH /work-orders/:id/status', async () => {
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: { id: 'wo-1', status: 'COMPLETED' } });

      const res = await updateWorkOrderStatus(companyId, 'wo-1', { status: 'COMPLETED', actualCost: 5000 });

      expect(apiClient.patch).toHaveBeenCalledWith(
        '/work-orders/wo-1/status',
        { status: 'COMPLETED', actualCost: 5000 },
        { headers: { 'x-company-id': companyId } },
      );
      expect(res.status).toBe('COMPLETED');
    });
  });

  describe('Vendors & Invoices API', () => {
    it('fetchVendors calls GET /vendors', async () => {
      const mockResult = { data: [{ id: 'ven-1', name: 'Speedy Auto' }], total: 1 };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResult });

      const res = await fetchVendors(companyId);

      expect(apiClient.get).toHaveBeenCalledWith(
        '/vendors',
        { headers: { 'x-company-id': companyId } },
      );
      expect(res).toEqual(mockResult);
    });

    it('createVendor calls POST /vendors', async () => {
      const payload: any = { name: 'Quick Lube', type: 'SERVICE_CENTER' };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: 'ven-new', ...payload } });

      const res = await createVendor(companyId, payload);

      expect(apiClient.post).toHaveBeenCalledWith('/vendors', payload, {
        headers: { 'x-company-id': companyId },
      });
      expect(res.id).toBe('ven-new');
    });

    it('fetchVendorInvoices calls GET /vendors/invoices/all', async () => {
      const mockResult = { data: [{ id: 'inv-1', invoiceNumber: 'INV-1001' }], total: 1 };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResult });

      const res = await fetchVendorInvoices(companyId);

      expect(apiClient.get).toHaveBeenCalledWith(
        '/vendors/invoices/all',
        { headers: { 'x-company-id': companyId } },
      );
      expect(res).toEqual(mockResult);
    });
  });

  describe('Vehicle Expenses & TCO Analytics API', () => {
    it('fetchVehicleExpenses calls GET /vehicle-expenses with category filter', async () => {
      const mockResult = { data: [{ id: 'exp-1', category: 'TOLL', amount: 150 }], total: 1 };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResult });

      const res = await fetchVehicleExpenses(companyId, { category: 'TOLL' });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/vehicle-expenses?category=TOLL'),
        { headers: { 'x-company-id': companyId } },
      );
      expect(res).toEqual(mockResult);
    });

    it('createVehicleExpense calls POST /vehicle-expenses', async () => {
      const payload: any = { vehicleId, category: 'PARKING', amount: 30 };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: 'exp-new', ...payload } });

      const res = await createVehicleExpense(companyId, payload);

      expect(apiClient.post).toHaveBeenCalledWith('/vehicle-expenses', payload, {
        headers: { 'x-company-id': companyId },
      });
      expect(res.id).toBe('exp-new');
    });

    it('fetchCostSummary calls GET /fleet-costs/summary with range', async () => {
      const mockSummary = { totalOperatingCost: 15000, costPerKm: 1.5, fuelCost: 8000 };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSummary });

      const res = await fetchCostSummary(companyId, { range: '30d' });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/fleet-costs/summary?range=30d'),
        { headers: { 'x-company-id': companyId } },
      );
      expect(res.costPerKm).toBe(1.5);
    });

    it('fetchVehicleCosts calls GET /fleet-costs/vehicles', async () => {
      const mockVehicles = [{ vehicleId, vehicleNumber: 'KA01AB1234', totalOperatingCost: 5000 }];
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockVehicles });

      const res = await fetchVehicleCosts(companyId, { range: 'this_month' });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/fleet-costs/vehicles?range=this_month'),
        { headers: { 'x-company-id': companyId } },
      );
      expect(res).toEqual(mockVehicles);
    });

    it('fetchCostTrends calls GET /fleet-costs/trends', async () => {
      const mockTrends = [{ month: '2026-10', fuelCost: 1000, maintenanceCost: 500 }];
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockTrends });

      const res = await fetchCostTrends(companyId);

      expect(apiClient.get).toHaveBeenCalledWith(
        '/fleet-costs/trends',
        { headers: { 'x-company-id': companyId } },
      );
      expect(res).toEqual(mockTrends);
    });
  });
});
