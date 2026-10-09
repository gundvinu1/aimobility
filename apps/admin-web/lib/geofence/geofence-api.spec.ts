import {
  fetchGeofences,
  getGeofence,
  createGeofence,
  updateGeofence,
  deleteGeofence,
  fetchAssignedVehicles,
  assignVehiclesToGeofence,
  removeVehicleFromGeofence,
} from './geofence-api';
import { apiClient } from '@/lib/api/api-client';

jest.mock('@/lib/api/api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('Geofence API Client', () => {
  const companyId = 'comp-123';
  const geofenceId = 'geo-456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetchGeofences calls GET /geofences with headers and filters', async () => {
    const mockData = [{ id: geofenceId, name: 'Depot A' }];
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockData });

    const result = await fetchGeofences(companyId, { isActive: true, search: 'Depot' });

    expect(apiClient.get).toHaveBeenCalledWith('/geofences?isActive=true&search=Depot', {
      headers: { 'x-company-id': companyId },
    });
    expect(result).toEqual(mockData);
  });

  it('getGeofence calls GET /geofences/:id with company header', async () => {
    const mockData = { id: geofenceId, name: 'Warehouse' };
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockData });

    const result = await getGeofence(companyId, geofenceId);

    expect(apiClient.get).toHaveBeenCalledWith(`/geofences/${geofenceId}`, {
      headers: { 'x-company-id': companyId },
    });
    expect(result).toEqual(mockData);
  });

  it('createGeofence calls POST /geofences with payload', async () => {
    const payload: any = {
      name: 'Downtown HQ',
      type: 'CIRCLE',
      geometry: { center: { latitude: 37.77, longitude: -122.41 }, radiusMeters: 500 },
    };
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: 'geo-new', ...payload } });

    const result = await createGeofence(companyId, payload);

    expect(apiClient.post).toHaveBeenCalledWith('/geofences', payload, {
      headers: { 'x-company-id': companyId },
    });
    expect(result.id).toBe('geo-new');
  });

  it('updateGeofence calls PATCH /geofences/:id with payload', async () => {
    const updatePayload = { isActive: false };
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: { id: geofenceId, isActive: false } });

    const result = await updateGeofence(companyId, geofenceId, updatePayload);

    expect(apiClient.patch).toHaveBeenCalledWith(`/geofences/${geofenceId}`, updatePayload, {
      headers: { 'x-company-id': companyId },
    });
    expect(result.isActive).toBe(false);
  });

  it('deleteGeofence calls DELETE /geofences/:id', async () => {
    (apiClient.delete as jest.Mock).mockResolvedValue({ data: { success: true } });

    const result = await deleteGeofence(companyId, geofenceId);

    expect(apiClient.delete).toHaveBeenCalledWith(`/geofences/${geofenceId}`, {
      headers: { 'x-company-id': companyId },
    });
    expect(result).toEqual({ success: true });
  });

  it('fetchAssignedVehicles calls GET /geofences/:id/vehicles', async () => {
    const mockVehicles = [{ id: 'gv-1', vehicleId: 'veh-1' }];
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockVehicles });

    const result = await fetchAssignedVehicles(companyId, geofenceId);

    expect(apiClient.get).toHaveBeenCalledWith(`/geofences/${geofenceId}/vehicles`, {
      headers: { 'x-company-id': companyId },
    });
    expect(result).toEqual(mockVehicles);
  });

  it('assignVehiclesToGeofence calls POST /geofences/:id/vehicles', async () => {
    const vehicleIds = ['v-1', 'v-2'];
    (apiClient.post as jest.Mock).mockResolvedValue({ data: [{ id: 'gv-1' }, { id: 'gv-2' }] });

    const result = await assignVehiclesToGeofence(companyId, geofenceId, vehicleIds);

    expect(apiClient.post).toHaveBeenCalledWith(
      `/geofences/${geofenceId}/vehicles`,
      { vehicleIds },
      { headers: { 'x-company-id': companyId } },
    );
    expect(result).toHaveLength(2);
  });

  it('removeVehicleFromGeofence calls DELETE /geofences/:id/vehicles/:vehicleId', async () => {
    (apiClient.delete as jest.Mock).mockResolvedValue({ data: { success: true } });

    const result = await removeVehicleFromGeofence(companyId, geofenceId, 'v-1');

    expect(apiClient.delete).toHaveBeenCalledWith(`/geofences/${geofenceId}/vehicles/v-1`, {
      headers: { 'x-company-id': companyId },
    });
    expect(result).toEqual({ success: true });
  });
});
