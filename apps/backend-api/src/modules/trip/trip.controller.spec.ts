jest.mock('@nestjs/jwt', () => ({
  JwtService: class {
    verify = jest.fn();
    sign = jest.fn();
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { TripController } from './trip.controller';
import { TripService } from './trip.service';
import { CompanyService } from '../company/company.service';
import { DatabaseService } from '../database/database.service';
import type { TenantContext } from '../company/types/tenant.type';
import type { AuthUser } from '../auth/types/auth-user.type';
import type { Request } from 'express';

const mockCompanyId = '11111111-1111-1111-1111-111111111111';
const mockUserId = '99999999-9999-9999-9999-999999999999';
const mockTripId = '33333333-3333-3333-3333-333333333333';
const mockDriverId = '44444444-4444-4444-4444-444444444444';
const mockVehicleId = '55555555-5555-5555-5555-555555555555';

describe('TripController (Phase 12A)', () => {
  let controller: TripController;
  let service: TripService;

  const mockTenant: TenantContext = {
    companyId: mockCompanyId,
    role: 'OWNER',
    membershipId: 'mem-1',
    status: 'ACTIVE',
  };

  const mockUser: AuthUser = {
    userId: mockUserId,
    email: 'admin@company.com',
    roles: ['OWNER'],
    permissions: ['trip.read', 'trip.dispatch'],
  };

  const mockReq = {
    headers: { 'user-agent': 'jest-test' },
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;

  beforeEach(async () => {
    const mockTripService = {
      createTrip: jest.fn(),
      listTrips: jest.fn(),
      getStats: jest.fn(),
      getTrip: jest.fn(),
      updateTrip: jest.fn(),
      assignDriver: jest.fn(),
      unassignDriver: jest.fn(),
      assignVehicle: jest.fn(),
      unassignVehicle: jest.fn(),
      dispatchTrip: jest.fn(),
      updateTripStatus: jest.fn(),
      deleteTrip: jest.fn(),
      getResourceAvailability: jest.fn(),
      getStops: jest.fn(),
      addStop: jest.fn(),
      updateStop: jest.fn(),
      deleteStop: jest.fn(),
      reorderStops: jest.fn(),
      calculateTripRoute: jest.fn(),
      calculateTripEta: jest.fn(),
      getDispatchAnalytics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TripController],
      providers: [
        {
          provide: TripService,
          useValue: mockTripService,
        },
        {
          provide: CompanyService,
          useValue: { getMembership: jest.fn() },
        },
        {
          provide: DatabaseService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<TripController>(TripController);
    service = module.get<TripService>(TripService);
  });

  it('should call assignDriver on service', async () => {
    (service.assignDriver as jest.Mock).mockResolvedValueOnce({ id: mockTripId, status: 'DRIVER_ASSIGNED' });

    const result = await controller.assignDriver(
      mockTripId,
      { driverId: mockDriverId, notes: 'Assigned driver' },
      mockTenant,
      mockUser,
      mockReq,
    );

    expect(service.assignDriver).toHaveBeenCalledWith(
      mockTripId,
      mockCompanyId,
      { driverId: mockDriverId, notes: 'Assigned driver' },
      mockUserId,
      expect.any(Object),
    );
    expect(result.status).toBe('DRIVER_ASSIGNED');
  });

  it('should call unassignDriver on service', async () => {
    (service.unassignDriver as jest.Mock).mockResolvedValueOnce({ id: mockTripId, status: 'SCHEDULED' });

    const result = await controller.unassignDriver(
      mockTripId,
      { notes: 'Driver unavailable' },
      mockTenant,
      mockUser,
      mockReq,
    );

    expect(service.unassignDriver).toHaveBeenCalledWith(
      mockTripId,
      mockCompanyId,
      { notes: 'Driver unavailable' },
      mockUserId,
      expect.any(Object),
    );
    expect(result.status).toBe('SCHEDULED');
  });

  it('should call assignVehicle on service', async () => {
    (service.assignVehicle as jest.Mock).mockResolvedValueOnce({ id: mockTripId, status: 'VEHICLE_ASSIGNED' });

    const result = await controller.assignVehicle(
      mockTripId,
      { vehicleId: mockVehicleId },
      mockTenant,
      mockUser,
      mockReq,
    );

    expect(service.assignVehicle).toHaveBeenCalledWith(
      mockTripId,
      mockCompanyId,
      { vehicleId: mockVehicleId },
      mockUserId,
      expect.any(Object),
    );
    expect(result.status).toBe('VEHICLE_ASSIGNED');
  });

  it('should call unassignVehicle on service', async () => {
    (service.unassignVehicle as jest.Mock).mockResolvedValueOnce({ id: mockTripId, status: 'SCHEDULED' });

    const result = await controller.unassignVehicle(
      mockTripId,
      { notes: 'Maintenance needed' },
      mockTenant,
      mockUser,
      mockReq,
    );

    expect(service.unassignVehicle).toHaveBeenCalledWith(
      mockTripId,
      mockCompanyId,
      { notes: 'Maintenance needed' },
      mockUserId,
      expect.any(Object),
    );
    expect(result.status).toBe('SCHEDULED');
  });

  it('should call getResourceAvailability on service', async () => {
    (service.getResourceAvailability as jest.Mock).mockResolvedValueOnce({
      drivers: [{ id: mockDriverId, isAvailable: true }],
      vehicles: [{ id: mockVehicleId, isAvailable: true }],
    });

    const result = await controller.availability(
      mockTenant,
      '2026-10-15T10:00:00Z',
      '90',
    );

    expect(service.getResourceAvailability).toHaveBeenCalledWith(
      mockCompanyId,
      '2026-10-15T10:00:00Z',
      90,
    );
    expect(result.drivers).toHaveLength(1);
    expect(result.vehicles).toHaveLength(1);
  });

  // ─── Phase 12B Tests ────────────────────────────────────────────────────────
  it('should call getStops on service', async () => {
    const mockStops = [{ id: 'stop-1', stopOrder: 1, locationName: 'Waypoint 1' }];
    (service.getStops as jest.Mock).mockResolvedValueOnce(mockStops);

    const result = await controller.getStops(mockTripId, mockTenant);

    expect(service.getStops).toHaveBeenCalledWith(mockTripId, mockCompanyId);
    expect(result).toEqual(mockStops);
  });

  it('should call addStop on service', async () => {
    const dto = { locationName: 'Waypoint 1', latitude: 37.7, longitude: -122.4 };
    const mockCreated = { id: 'stop-1', ...dto, stopOrder: 1 };
    (service.addStop as jest.Mock).mockResolvedValueOnce(mockCreated);

    const result = await controller.addStop(mockTripId, dto as any, mockTenant, mockUser, mockReq);

    expect(service.addStop).toHaveBeenCalledWith(
      mockTripId,
      mockCompanyId,
      dto,
      mockUserId,
      expect.any(Object),
    );
    expect(result).toEqual(mockCreated);
  });

  it('should call reorderStops on service', async () => {
    const stopIds = ['stop-2', 'stop-1'];
    (service.reorderStops as jest.Mock).mockResolvedValueOnce([
      { id: 'stop-2', stopOrder: 1 },
      { id: 'stop-1', stopOrder: 2 },
    ]);

    const result = await controller.reorderStops(
      mockTripId,
      { stopIds },
      mockTenant,
      mockUser,
      mockReq,
    );

    expect(service.reorderStops).toHaveBeenCalledWith(
      mockTripId,
      mockCompanyId,
      stopIds,
      mockUserId,
      expect.any(Object),
    );
    expect(result).toHaveLength(2);
  });

  it('should call updateStop on service', async () => {
    const stopId = '123e4567-e89b-12d3-a456-426614174000';
    const dto = { locationName: 'Updated Name' };
    (service.updateStop as jest.Mock).mockResolvedValueOnce({ id: stopId, ...dto });

    const result = await controller.updateStop(
      mockTripId,
      stopId,
      dto,
      mockTenant,
      mockUser,
      mockReq,
    );

    expect(service.updateStop).toHaveBeenCalledWith(
      mockTripId,
      stopId,
      mockCompanyId,
      dto,
      mockUserId,
      expect.any(Object),
    );
    expect(result.locationName).toBe('Updated Name');
  });

  it('should call deleteStop on service', async () => {
    const stopId = '123e4567-e89b-12d3-a456-426614174000';
    (service.deleteStop as jest.Mock).mockResolvedValueOnce({ success: true, message: 'Stop deleted successfully' });

    const result = await controller.deleteStop(
      mockTripId,
      stopId,
      mockTenant,
      mockUser,
      mockReq,
    );

    expect(service.deleteStop).toHaveBeenCalledWith(
      mockTripId,
      stopId,
      mockCompanyId,
      mockUserId,
      expect.any(Object),
    );
    expect(result.success).toBe(true);
  });

  it('should call calculateRoute on service', async () => {
    const mockRoute = { distanceKm: 15.5, durationMinutes: 25, geometryPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' };
    (service.calculateTripRoute as jest.Mock).mockResolvedValueOnce(mockRoute);

    const result = await controller.calculateRoute(mockTripId, mockTenant);

    expect(service.calculateTripRoute).toHaveBeenCalledWith(mockTripId, mockCompanyId);
    expect(result).toEqual(mockRoute);
  });

  it('should call getEta on service', async () => {
    const mockEta = { tripId: mockTripId, distanceRemainingKm: 5.2, durationRemainingMinutes: 10 };
    (service.calculateTripEta as jest.Mock).mockResolvedValueOnce(mockEta);

    const result = await controller.getEta(
      mockTripId,
      mockTenant,
      '37.77',
      '-122.41',
    );

    expect(service.calculateTripEta).toHaveBeenCalledWith(
      mockTripId,
      mockCompanyId,
      37.77,
      -122.41,
    );
    expect(result).toEqual(mockEta);
  });

  it('should call getDispatchAnalytics on service', async () => {
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
    (service.getDispatchAnalytics as jest.Mock).mockResolvedValueOnce(mockAnalytics);

    const result = await controller.dispatchAnalytics(mockTenant);

    expect(service.getDispatchAnalytics).toHaveBeenCalledWith(mockCompanyId);
    expect(result).toEqual(mockAnalytics);
  });
});
