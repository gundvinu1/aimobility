import {
  fetchAlerts,
  fetchAlertSummary,
  fetchAlertConfig,
  updateAlertConfig,
  getAlert,
  acknowledgeAlert,
  resolveAlert,
  dismissAlert,
  fetchDriverSafetyAnalytics,
  fetchVehicleSafetyAnalytics,
} from './alert-api';
import { apiClient } from '@/lib/api/api-client';

jest.mock('@/lib/api/api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('Alert API Client', () => {
  const companyId = 'comp-100';
  const alertId = 'alt-999';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetchAlerts builds query params and calls GET /alerts', async () => {
    const mockList = { data: [{ id: alertId, type: 'OVERSPEED' }], total: 1, page: 1, limit: 10 };
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockList });

    const result = await fetchAlerts(companyId, {
      type: 'OVERSPEED',
      severity: 'CRITICAL',
      status: 'OPEN',
      page: 1,
      limit: 10,
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/alerts?type=OVERSPEED&severity=CRITICAL&status=OPEN&page=1&limit=10',
      { headers: { 'x-company-id': companyId } },
    );
    expect(result).toEqual(mockList);
  });

  it('fetchAlertSummary calls GET /alerts/summary', async () => {
    const mockSummary = {
      totalOpen: 5,
      criticalCount: 2,
      highCount: 1,
      acknowledgedCount: 3,
      resolvedTodayCount: 10,
      totalAlerts: 20,
    };
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSummary });

    const result = await fetchAlertSummary(companyId);

    expect(apiClient.get).toHaveBeenCalledWith('/alerts/summary', {
      headers: { 'x-company-id': companyId },
    });
    expect(result.totalOpen).toBe(5);
  });

  it('fetchAlertConfig calls GET /alerts/config', async () => {
    const mockConfig = {
      overspeedEnabled: true,
      overspeedThresholdKmH: 80,
      overspeedGracePeriodSeconds: 5,
    };
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockConfig });

    const result = await fetchAlertConfig(companyId);

    expect(apiClient.get).toHaveBeenCalledWith('/alerts/config', {
      headers: { 'x-company-id': companyId },
    });
    expect(result.overspeedThresholdKmH).toBe(80);
  });

  it('updateAlertConfig calls PATCH /alerts/config with payload', async () => {
    const updatePayload = { overspeedThresholdKmH: 90 };
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: { overspeedThresholdKmH: 90 } });

    const result = await updateAlertConfig(companyId, updatePayload as any);

    expect(apiClient.patch).toHaveBeenCalledWith('/alerts/config', updatePayload, {
      headers: { 'x-company-id': companyId },
    });
    expect(result.overspeedThresholdKmH).toBe(90);
  });

  it('getAlert calls GET /alerts/:id', async () => {
    const mockAlert = { id: alertId, title: 'Speeding Alert' };
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockAlert });

    const result = await getAlert(companyId, alertId);

    expect(apiClient.get).toHaveBeenCalledWith(`/alerts/${alertId}`, {
      headers: { 'x-company-id': companyId },
    });
    expect(result).toEqual(mockAlert);
  });

  it('acknowledgeAlert calls PATCH /alerts/:id/acknowledge with notes', async () => {
    (apiClient.patch as jest.Mock).mockResolvedValue({
      data: { id: alertId, status: 'ACKNOWLEDGED' },
    });

    const result = await acknowledgeAlert(companyId, alertId, 'Reviewing event');

    expect(apiClient.patch).toHaveBeenCalledWith(
      `/alerts/${alertId}/acknowledge`,
      { notes: 'Reviewing event' },
      { headers: { 'x-company-id': companyId } },
    );
    expect(result.status).toBe('ACKNOWLEDGED');
  });

  it('resolveAlert calls PATCH /alerts/:id/resolve with notes', async () => {
    (apiClient.patch as jest.Mock).mockResolvedValue({
      data: { id: alertId, status: 'RESOLVED' },
    });

    const result = await resolveAlert(companyId, alertId, 'Driver slowed down');

    expect(apiClient.patch).toHaveBeenCalledWith(
      `/alerts/${alertId}/resolve`,
      { notes: 'Driver slowed down' },
      { headers: { 'x-company-id': companyId } },
    );
    expect(result.status).toBe('RESOLVED');
  });

  it('dismissAlert calls PATCH /alerts/:id/dismiss', async () => {
    (apiClient.patch as jest.Mock).mockResolvedValue({
      data: { id: alertId, status: 'DISMISSED' },
    });

    const result = await dismissAlert(companyId, alertId, 'False positive');

    expect(apiClient.patch).toHaveBeenCalledWith(
      `/alerts/${alertId}/dismiss`,
      { notes: 'False positive' },
      { headers: { 'x-company-id': companyId } },
    );
    expect(result.status).toBe('DISMISSED');
  });

  it('fetchDriverSafetyAnalytics calls GET /alerts/analytics/driver', async () => {
    const mockAnalytics = [{ driverId: 'd-1', totalAlerts: 3 }];
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockAnalytics });

    const result = await fetchDriverSafetyAnalytics(companyId, 'd-1');

    expect(apiClient.get).toHaveBeenCalledWith('/alerts/analytics/driver?driverId=d-1', {
      headers: { 'x-company-id': companyId },
    });
    expect(result).toEqual(mockAnalytics);
  });

  it('fetchVehicleSafetyAnalytics calls GET /alerts/analytics/vehicle', async () => {
    const mockAnalytics = [{ vehicleId: 'v-1', totalAlerts: 2 }];
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockAnalytics });

    const result = await fetchVehicleSafetyAnalytics(companyId, 'v-1');

    expect(apiClient.get).toHaveBeenCalledWith('/alerts/analytics/vehicle?vehicleId=v-1', {
      headers: { 'x-company-id': companyId },
    });
    expect(result).toEqual(mockAnalytics);
  });
});
