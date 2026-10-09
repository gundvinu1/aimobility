import {
  getTrips,
  assignDriver,
  unassignDriver,
  unassignVehicle,
  getAvailability,
  getTripStops,
  addTripStop,
  calculateTripRoute,
  getTripEta,
  getDispatchAnalytics,
  tripApi,
} from './trip-api';

describe('Trip API Client (Phase 12A)', () => {
  const mockToken = 'test-token';
  const mockCompanyId = 'company-123';
  const mockTripId = 'trip-456';

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('getTrips builds query and calls GET /trips', async () => {
    const mockResponse = { trips: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockResponse }),
    });

    const result = await getTrips(
      { page: 1, limit: 10, status: 'SCHEDULED' },
      { accessToken: mockToken, companyId: mockCompanyId },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/trips?page=1&limit=10&status=SCHEDULED'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockToken}`,
          'x-company-id': mockCompanyId,
        }),
      }),
    );
    expect(result).toEqual(mockResponse);
  });

  it('assignDriver sends POST /trips/:id/assign-driver', async () => {
    const mockTrip = { id: mockTripId, status: 'DRIVER_ASSIGNED' };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockTrip }),
    });

    const result = await assignDriver(
      mockTripId,
      { driverId: 'driver-1', notes: 'Urgent' },
      { accessToken: mockToken, companyId: mockCompanyId },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/trips/${mockTripId}/assign-driver`),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ driverId: 'driver-1', notes: 'Urgent' }),
      }),
    );
    expect(result.status).toBe('DRIVER_ASSIGNED');
  });

  it('unassignDriver sends POST /trips/:id/unassign-driver', async () => {
    const mockTrip = { id: mockTripId, status: 'SCHEDULED' };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockTrip }),
    });

    const result = await unassignDriver(
      mockTripId,
      { notes: 'Driver sick' },
      { accessToken: mockToken, companyId: mockCompanyId },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/trips/${mockTripId}/unassign-driver`),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ notes: 'Driver sick' }),
      }),
    );
    expect(result.status).toBe('SCHEDULED');
  });

  it('unassignVehicle sends POST /trips/:id/unassign-vehicle', async () => {
    const mockTrip = { id: mockTripId, status: 'SCHEDULED' };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockTrip }),
    });

    const result = await unassignVehicle(
      mockTripId,
      { notes: 'Tire puncture' },
      { accessToken: mockToken, companyId: mockCompanyId },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/trips/${mockTripId}/unassign-vehicle`),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ notes: 'Tire puncture' }),
      }),
    );
    expect(result.status).toBe('SCHEDULED');
  });

  it('getAvailability sends GET /trips/availability', async () => {
    const mockAvail = { drivers: [], vehicles: [] };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockAvail }),
    });

    const result = await getAvailability(
      { startTime: '2026-10-15T09:00:00Z', durationMinutes: 60 },
      { accessToken: mockToken, companyId: mockCompanyId },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/trips/availability?startTime=2026-10-15T09%3A00%3A00Z&durationMinutes=60'),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toEqual(mockAvail);
  });

  it('getTripStops sends GET /trips/:id/stops', async () => {
    const mockStops = [{ id: 'stop-1', stopOrder: 1, locationName: 'Waypoint 1' }];
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockStops }),
    });

    const result = await getTripStops(mockTripId, {
      accessToken: mockToken,
      companyId: mockCompanyId,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/trips/${mockTripId}/stops`),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toEqual(mockStops);
  });

  it('addTripStop sends POST /trips/:id/stops', async () => {
    const payload = { locationName: 'Waypoint 2', latitude: 37.7, longitude: -122.4 };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ success: true, data: { id: 'stop-2', ...payload } }),
    });

    const result = await addTripStop(mockTripId, payload, {
      accessToken: mockToken,
      companyId: mockCompanyId,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/trips/${mockTripId}/stops`),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    );
    expect(result.id).toBe('stop-2');
  });

  it('calculateTripRoute sends POST /trips/:id/calculate-route', async () => {
    const mockRoute = { distanceKm: 12.3, durationMinutes: 20, geometryPolyline: 'abc', waypointsOrder: [] };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockRoute }),
    });

    const result = await calculateTripRoute(mockTripId, {
      accessToken: mockToken,
      companyId: mockCompanyId,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/trips/${mockTripId}/calculate-route`),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result).toEqual(mockRoute);
  });

  it('getTripEta sends GET /trips/:id/eta with coordinates', async () => {
    const mockEta = { tripId: mockTripId, distanceRemainingKm: 5, durationRemainingMinutes: 10 };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockEta }),
    });

    const result = await getTripEta(
      mockTripId,
      { currentLatitude: 37.77, currentLongitude: -122.41 },
      { accessToken: mockToken, companyId: mockCompanyId },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/trips/${mockTripId}/eta?currentLatitude=37.77&currentLongitude=-122.41`),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toEqual(mockEta);
  });

  it('getDispatchAnalytics sends GET /trips/dispatch-analytics', async () => {
    const mockAnalytics = {
      totalScheduled: 10,
      unassignedTrips: 2,
      assignedTrips: 5,
      completedTrips: 3,
      cancelledTrips: 0,
      reassignmentCount: 1,
      averageLeadTimeMinutes: 12,
      driverUtilizationRate: 75,
      vehicleUtilizationRate: 80,
      onTimePickupRate: 90,
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockAnalytics }),
    });

    const result = await getDispatchAnalytics({
      accessToken: mockToken,
      companyId: mockCompanyId,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/trips/dispatch-analytics'),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toEqual(mockAnalytics);
  });

  it('tripApi convenience object exposes all methods', () => {
    expect(typeof tripApi.list).toBe('function');
    expect(typeof tripApi.assignDriver).toBe('function');
    expect(typeof tripApi.unassignDriver).toBe('function');
    expect(typeof tripApi.assignVehicle).toBe('function');
    expect(typeof tripApi.unassignVehicle).toBe('function');
    expect(typeof tripApi.availability).toBe('function');
    expect(typeof tripApi.dispatch).toBe('function');
    expect(typeof tripApi.stops).toBe('function');
    expect(typeof tripApi.addStop).toBe('function');
    expect(typeof tripApi.updateStop).toBe('function');
    expect(typeof tripApi.reorderStops).toBe('function');
    expect(typeof tripApi.deleteStop).toBe('function');
    expect(typeof tripApi.calculateRoute).toBe('function');
    expect(typeof tripApi.getEta).toBe('function');
    expect(typeof tripApi.dispatchAnalytics).toBe('function');
  });
});
