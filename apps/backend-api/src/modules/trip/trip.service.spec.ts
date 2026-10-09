jest.mock('@nestjs/jwt', () => ({
  JwtService: class {
    verify = jest.fn();
    sign = jest.fn();
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { TripService } from './trip.service';
import { DatabaseService } from '../database/database.service';
import { TelemetryGateway } from '../telemetry/telemetry.gateway';
import { CacheService } from '../cache/cache.service';

const mockCompanyAId = '11111111-1111-1111-1111-111111111111';
const mockCompanyBId = '22222222-2222-2222-2222-222222222222';
const mockUserId = '99999999-9999-9999-9999-999999999999';
const mockTripId = '33333333-3333-3333-3333-333333333333';
const mockDriverId = '44444444-4444-4444-4444-444444444444';
const mockVehicleId = '55555555-5555-5555-5555-555555555555';

describe('TripService (Lifecycle, Assignment, Dispatch & State Machine)', () => {
  let service: TripService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      trip: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      tripStatusHistory: {
        create: jest.fn().mockResolvedValue({ id: 'history-1' }),
      },
      booking: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'mock-booking-id' }),
        update: jest.fn(),
      },
      driver: {
        findFirst: jest.fn().mockResolvedValue({
          id: mockDriverId,
          companyId: mockCompanyAId,
          status: 'ACTIVE',
          licenseExpiryDate: new Date('2029-01-01'),
          dutyStatus: 'ON_DUTY',
        }),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      vehicle: {
        findFirst: jest.fn().mockResolvedValue({
          id: mockVehicleId,
          companyId: mockCompanyAId,
          status: 'ACTIVE',
        }),
        findMany: jest.fn(),
      },
      workOrder: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      tripStop: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((cb: any) =>
        typeof cb === 'function' ? cb(mockPrisma) : Promise.all(cb),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripService,
        {
          provide: DatabaseService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<TripService>(TripService);
  });

  describe('createTrip', () => {
    it('should create trip in SCHEDULED status and record history', async () => {
      mockPrisma.trip.count.mockResolvedValueOnce(0);
      mockPrisma.trip.findFirst.mockResolvedValueOnce(null);
      mockPrisma.trip.create.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        tripNumber: 'TR-20261015-0001',
        tripType: 'ONE_WAY',
        status: 'SCHEDULED',
        originAddress: 'Point A',
        destinationAddress: 'Point B',
        scheduledStartTime: new Date('2026-10-15T09:00:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createTrip(
        {
          originAddress: 'Point A',
          destinationAddress: 'Point B',
          scheduledStartTime: '2026-10-15T09:00:00Z',
        },
        mockCompanyAId,
        mockUserId,
        {},
      );

      expect(result.id).toBe(mockTripId);
      expect(result.status).toBe('SCHEDULED');
      expect(mockPrisma.tripStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tripId: mockTripId,
            toStatus: 'SCHEDULED',
          }),
        }),
      );
    });
  });

  describe('Tenant Isolation', () => {
    it('should reject trip lookup across company boundary with NotFoundException', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.getTrip(mockTripId, mockCompanyBId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignDriver', () => {
    it('should assign valid active driver and advance status to DRIVER_ASSIGNED', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        status: 'SCHEDULED',
        notes: null,
      });

      mockPrisma.driver.findFirst.mockResolvedValueOnce({
        id: mockDriverId,
        status: 'ACTIVE',
        licenseExpiryDate: new Date('2029-01-01'),
        dutyStatus: 'ON_DUTY',
      });

      // No active conflicting trip
      mockPrisma.trip.findFirst.mockResolvedValueOnce(null);

      mockPrisma.trip.update.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        tripNumber: 'TR-001',
        tripType: 'ONE_WAY',
        status: 'DRIVER_ASSIGNED',
        originAddress: 'Point A',
        destinationAddress: 'Point B',
        driverId: mockDriverId,
        scheduledStartTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.assignDriver(
        mockTripId,
        mockCompanyAId,
        { driverId: mockDriverId },
        mockUserId,
        {},
      );

      expect(result.driverId).toBe(mockDriverId);
      expect(result.status).toBe('DRIVER_ASSIGNED');
    });

    it('should reject assigning driver who is already on another active trip', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        status: 'SCHEDULED',
      });

      mockPrisma.driver.findFirst.mockResolvedValueOnce({
        id: mockDriverId,
        status: 'ACTIVE',
        licenseExpiryDate: new Date('2029-01-01'),
        dutyStatus: 'ON_DUTY',
      });

      // Conflicting active trip found
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: 'conflicting-trip-1',
        status: 'IN_PROGRESS',
      });

      await expect(
        service.assignDriver(
          mockTripId,
          mockCompanyAId,
          { driverId: mockDriverId },
          mockUserId,
          {},
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('dispatchTrip', () => {
    it('should reject dispatch if vehicle is missing', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        status: 'DRIVER_ASSIGNED',
        driverId: mockDriverId,
        vehicleId: null, // Missing!
      });

      await expect(
        service.dispatchTrip(mockTripId, mockCompanyAId, {}, mockUserId, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should dispatch trip when both driver and vehicle assigned', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        tripNumber: 'TR-001',
        status: 'DRIVER_ASSIGNED',
        driverId: mockDriverId,
        vehicleId: mockVehicleId,
        notes: null,
      });

      mockPrisma.trip.update.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        tripNumber: 'TR-001',
        tripType: 'ONE_WAY',
        status: 'DISPATCHED',
        driverId: mockDriverId,
        vehicleId: mockVehicleId,
        originAddress: 'A',
        destinationAddress: 'B',
        scheduledStartTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.dispatchTrip(
        mockTripId,
        mockCompanyAId,
        { notes: 'En route' },
        mockUserId,
        {},
      );

      expect(result.status).toBe('DISPATCHED');
      expect(mockPrisma.tripStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tripId: mockTripId,
            toStatus: 'DISPATCHED',
          }),
        }),
      );
    });
  });

  describe('State Machine & Status Transitions', () => {
    it('should reject invalid transition (e.g. SCHEDULED directly to COMPLETED)', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        status: 'SCHEDULED',
      });

      await expect(
        service.updateTripStatus(
          mockTripId,
          mockCompanyAId,
          { status: 'COMPLETED' },
          mockUserId,
          {},
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow valid transition DISPATCHED -> DRIVER_ARRIVED', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        status: 'DISPATCHED',
        driverId: mockDriverId,
        actualStartTime: null,
      });

      mockPrisma.trip.update.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        tripNumber: 'TR-001',
        tripType: 'ONE_WAY',
        status: 'DRIVER_ARRIVED',
        originAddress: 'A',
        destinationAddress: 'B',
        scheduledStartTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.updateTripStatus(
        mockTripId,
        mockCompanyAId,
        { status: 'DRIVER_ARRIVED' },
        mockUserId,
        {},
      );

      expect(result.status).toBe('DRIVER_ARRIVED');
    });

    it('should update driver dutyStatus to ON_TRIP when trip enters IN_PROGRESS', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        status: 'PASSENGER_ONBOARD',
        driverId: mockDriverId,
        actualStartTime: null,
      });

      mockPrisma.trip.update.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        tripNumber: 'TR-001',
        tripType: 'ONE_WAY',
        status: 'IN_PROGRESS',
        originAddress: 'A',
        destinationAddress: 'B',
        scheduledStartTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.updateTripStatus(
        mockTripId,
        mockCompanyAId,
        { status: 'IN_PROGRESS' },
        mockUserId,
        {},
      );

      expect(mockPrisma.driver.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockDriverId },
          data: { dutyStatus: 'ON_TRIP' },
        }),
      );
    });
  });

  describe('unassignDriver (Phase 12A)', () => {
    it('should unassign driver and revert status to SCHEDULED when no vehicle assigned', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        status: 'DRIVER_ASSIGNED',
        driverId: mockDriverId,
        vehicleId: null,
      });

      mockPrisma.trip.update.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        tripNumber: 'TR-001',
        tripType: 'ONE_WAY',
        status: 'SCHEDULED',
        driverId: null,
        vehicleId: null,
        originAddress: 'Point A',
        destinationAddress: 'Point B',
        scheduledStartTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.unassignDriver(
        mockTripId,
        mockCompanyAId,
        { notes: 'Driver unavailable' },
        mockUserId,
        {},
      );

      expect(result.status).toBe('SCHEDULED');
      expect(result.driverId).toBeNull();
      expect(mockPrisma.trip.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockTripId },
          data: expect.objectContaining({
            driverId: null,
            status: 'SCHEDULED',
          }),
        }),
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'TRIP_DRIVER_UNASSIGNED',
          }),
        }),
      );
    });

    it('should unassign driver and revert status to VEHICLE_ASSIGNED when vehicle is still assigned', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        status: 'DRIVER_ASSIGNED',
        driverId: mockDriverId,
        vehicleId: mockVehicleId,
      });

      mockPrisma.trip.update.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        tripNumber: 'TR-001',
        tripType: 'ONE_WAY',
        status: 'VEHICLE_ASSIGNED',
        driverId: null,
        vehicleId: mockVehicleId,
        originAddress: 'Point A',
        destinationAddress: 'Point B',
        scheduledStartTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.unassignDriver(
        mockTripId,
        mockCompanyAId,
        {},
        mockUserId,
        {},
      );

      expect(result.status).toBe('VEHICLE_ASSIGNED');
    });

    it('should reject unassigning driver from DISPATCHED or IN_PROGRESS trip', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        status: 'DISPATCHED',
        driverId: mockDriverId,
      });

      await expect(
        service.unassignDriver(mockTripId, mockCompanyAId, {}, mockUserId, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unassigning driver when no driver is assigned', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        status: 'SCHEDULED',
        driverId: null,
      });

      await expect(
        service.unassignDriver(mockTripId, mockCompanyAId, {}, mockUserId, {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('unassignVehicle (Phase 12A)', () => {
    it('should unassign vehicle and revert status to SCHEDULED when no driver assigned', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        status: 'VEHICLE_ASSIGNED',
        vehicleId: mockVehicleId,
        driverId: null,
      });

      mockPrisma.trip.update.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        tripNumber: 'TR-001',
        tripType: 'ONE_WAY',
        status: 'SCHEDULED',
        driverId: null,
        vehicleId: null,
        originAddress: 'Point A',
        destinationAddress: 'Point B',
        scheduledStartTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.unassignVehicle(
        mockTripId,
        mockCompanyAId,
        { notes: 'Vehicle replaced' },
        mockUserId,
        {},
      );

      expect(result.status).toBe('SCHEDULED');
      expect(result.vehicleId).toBeNull();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'TRIP_VEHICLE_UNASSIGNED',
          }),
        }),
      );
    });

    it('should unassign vehicle and revert status to DRIVER_ASSIGNED when driver is still assigned', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        status: 'VEHICLE_ASSIGNED',
        vehicleId: mockVehicleId,
        driverId: mockDriverId,
      });

      mockPrisma.trip.update.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        tripNumber: 'TR-001',
        tripType: 'ONE_WAY',
        status: 'DRIVER_ASSIGNED',
        driverId: mockDriverId,
        vehicleId: null,
        originAddress: 'Point A',
        destinationAddress: 'Point B',
        scheduledStartTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.unassignVehicle(
        mockTripId,
        mockCompanyAId,
        {},
        mockUserId,
        {},
      );

      expect(result.status).toBe('DRIVER_ASSIGNED');
    });

    it('should reject unassigning vehicle from COMPLETED or CANCELLED trip', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        status: 'COMPLETED',
        vehicleId: mockVehicleId,
      });

      await expect(
        service.unassignVehicle(mockTripId, mockCompanyAId, {}, mockUserId, {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Maintenance and Overlap Conflict Detection (Phase 12A)', () => {
    it('should reject assigning vehicle that has active WorkOrder in progress', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        status: 'SCHEDULED',
        scheduledStart: new Date('2026-10-15T10:00:00Z'),
        durationMinutes: 60,
      });

      mockPrisma.vehicle.findFirst.mockResolvedValueOnce({
        id: mockVehicleId,
        status: 'ACTIVE',
      });

      // Active work order detected!
      mockPrisma.workOrder.findFirst.mockResolvedValueOnce({
        id: 'wo-1',
        workOrderNumber: 'WO-202610-001',
        status: 'IN_PROGRESS',
      });

      await expect(
        service.assignVehicle(
          mockTripId,
          mockCompanyAId,
          { vehicleId: mockVehicleId },
          mockUserId,
          {},
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject assigning driver with overlapping scheduled trip window', async () => {
      const scheduledStart = new Date('2026-10-15T10:00:00Z');
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        status: 'SCHEDULED',
        scheduledStart,
        durationMinutes: 60,
      });

      mockPrisma.driver.findFirst.mockResolvedValueOnce({
        id: mockDriverId,
        status: 'ACTIVE',
        licenseExpiryDate: new Date('2029-01-01'),
        dutyStatus: 'ON_DUTY',
      });

      // No currently executing trip
      mockPrisma.trip.findFirst.mockResolvedValueOnce(null);

      // Overlapping scheduled trip (starts at 10:30, within 10:00-11:00 window)
      mockPrisma.trip.findMany.mockResolvedValueOnce([
        {
          id: 'overlapping-trip-1',
          tripNumber: 'TR-OVERLAP',
          scheduledStart: new Date('2026-10-15T10:30:00Z'),
          durationMinutes: 60,
          status: 'SCHEDULED',
        },
      ]);

      await expect(
        service.assignDriver(
          mockTripId,
          mockCompanyAId,
          { driverId: mockDriverId },
          mockUserId,
          {},
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getResourceAvailability (Phase 12A)', () => {
    it('should return availability for drivers and vehicles with correct conflict reasons', async () => {
      mockPrisma.driver.findMany.mockResolvedValueOnce([
        {
          id: 'driver-1',
          driverCode: 'DRV-1',
          status: 'ACTIVE',
          licenseExpiryDate: new Date('2028-01-01'),
          dutyStatus: 'ON_DUTY',
          employee: { firstName: 'Alice', lastName: 'Smith' },
        },
        {
          id: 'driver-2',
          driverCode: 'DRV-2',
          status: 'INACTIVE', // Inactive
          licenseExpiryDate: new Date('2028-01-01'),
          dutyStatus: 'OFF_DUTY',
          employee: { firstName: 'Bob', lastName: 'Jones' },
        },
      ]);

      mockPrisma.vehicle.findMany.mockResolvedValueOnce([
        {
          id: 'vehicle-1',
          vehicleNumber: 'VEH-01',
          make: 'Toyota',
          model: 'Camry',
          status: 'ACTIVE',
        },
        {
          id: 'vehicle-2',
          vehicleNumber: 'VEH-02',
          make: 'Ford',
          model: 'Transit',
          status: 'MAINTENANCE', // Not active
        },
      ]);

      // active trips
      mockPrisma.trip.findMany.mockResolvedValueOnce([]);
      // work orders
      mockPrisma.workOrder.findMany.mockResolvedValueOnce([]);

      const result = await service.getResourceAvailability(mockCompanyAId);

      expect(result.drivers).toHaveLength(2);
      expect(result.drivers[0].isAvailable).toBe(true);
      expect(result.drivers[1].isAvailable).toBe(false);
      expect(result.drivers[1].conflictReason).toContain('INACTIVE');

      expect(result.vehicles).toHaveLength(2);
      expect(result.vehicles[0].isAvailable).toBe(true);
      expect(result.vehicles[1].isAvailable).toBe(false);
      expect(result.vehicles[1].conflictReason).toContain('MAINTENANCE');
    });
  });

  // ─── Multi-Stop Waypoints & Routing (Phase 12B) ─────────────────────────────
  describe('multi-stop waypoints (Phase 12B)', () => {
    const mockMeta = { ipAddress: '127.0.0.1', userAgent: 'test' };
    const mockStop1 = {
      id: 'stop-1111-1111-1111-111111111111',
      tripId: mockTripId,
      companyId: mockCompanyAId,
      stopOrder: 1,
      stopType: 'WAYPOINT',
      locationName: 'Stop Alpha',
      address: '100 Alpha St',
      latitude: 37.77,
      longitude: -122.41,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('getStops should return stops ordered by stopOrder', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({ id: mockTripId, companyId: mockCompanyAId });
      mockPrisma.tripStop.findMany.mockResolvedValueOnce([mockStop1]);

      const stops = await service.getStops(mockTripId, mockCompanyAId);

      expect(stops).toHaveLength(1);
      expect(stops[0].id).toBe(mockStop1.id);
      expect(stops[0].locationName).toBe('Stop Alpha');
      expect(mockPrisma.tripStop.findMany).toHaveBeenCalledWith({
        where: { tripId: mockTripId, companyId: mockCompanyAId },
        orderBy: { stopOrder: 'asc' },
      });
    });

    it('getStops should throw NotFoundException if trip does not exist', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce(null);

      await expect(service.getStops(mockTripId, mockCompanyAId)).rejects.toThrow(NotFoundException);
    });

    it('addStop should successfully add a stop and audit', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        status: 'SCHEDULED',
      });
      mockPrisma.tripStop.count.mockResolvedValueOnce(0);
      mockPrisma.tripStop.create.mockResolvedValueOnce(mockStop1);

      const result = await service.addStop(
        mockTripId,
        mockCompanyAId,
        {
          locationName: 'Stop Alpha',
          latitude: 37.77,
          longitude: -122.41,
          stopType: 'WAYPOINT',
        },
        mockUserId,
        mockMeta,
      );

      expect(result.locationName).toBe('Stop Alpha');
      expect(mockPrisma.tripStop.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('addStop should throw BadRequestException if trip is COMPLETED', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        status: 'COMPLETED',
      });

      await expect(
        service.addStop(
          mockTripId,
          mockCompanyAId,
          { locationName: 'Late Stop', latitude: 37.77, longitude: -122.41 },
          mockUserId,
          mockMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('updateStop should update stop details', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({ id: mockTripId, companyId: mockCompanyAId });
      mockPrisma.tripStop.findFirst.mockResolvedValueOnce(mockStop1);
      mockPrisma.tripStop.update.mockResolvedValueOnce({
        ...mockStop1,
        locationName: 'Updated Alpha',
        status: 'ARRIVED',
      });

      const updated = await service.updateStop(
        mockTripId,
        mockStop1.id,
        mockCompanyAId,
        { locationName: 'Updated Alpha', status: 'ARRIVED' },
        mockUserId,
        mockMeta,
      );

      expect(updated.locationName).toBe('Updated Alpha');
      expect(updated.status).toBe('ARRIVED');
    });

    it('updateStop should throw NotFoundException if stop does not exist', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({ id: mockTripId, companyId: mockCompanyAId });
      mockPrisma.tripStop.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.updateStop(
          mockTripId,
          mockStop1.id,
          mockCompanyAId,
          { locationName: 'Ghost' },
          mockUserId,
          mockMeta,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('deleteStop should remove stop and resequence remaining', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({ id: mockTripId, companyId: mockCompanyAId });
      mockPrisma.tripStop.findFirst.mockResolvedValueOnce(mockStop1);
      mockPrisma.tripStop.delete.mockResolvedValueOnce(mockStop1);
      mockPrisma.tripStop.findMany.mockResolvedValueOnce([
        { id: 'stop-2', stopOrder: 2 },
      ]);
      mockPrisma.tripStop.update.mockResolvedValueOnce({ id: 'stop-2', stopOrder: 1 });

      const res = await service.deleteStop(mockTripId, mockStop1.id, mockCompanyAId, mockUserId, mockMeta);

      expect(res.success).toBe(true);
      expect(mockPrisma.tripStop.delete).toHaveBeenCalledWith({ where: { id: mockStop1.id } });
      expect(mockPrisma.tripStop.update).toHaveBeenCalledWith({
        where: { id: 'stop-2' },
        data: { stopOrder: 1 },
      });
    });

    it('reorderStops should update order for valid sequence', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({ id: mockTripId, companyId: mockCompanyAId });
      mockPrisma.tripStop.findMany
        .mockResolvedValueOnce([{ id: 'stop-1' }, { id: 'stop-2' }]) // check existence
        .mockResolvedValueOnce([
          { id: 'stop-2', stopOrder: 1, locationName: 'Stop 2' },
          { id: 'stop-1', stopOrder: 2, locationName: 'Stop 1' },
        ]); // return after update
      mockPrisma.tripStop.update.mockResolvedValue({});

      const reordered = await service.reorderStops(
        mockTripId,
        mockCompanyAId,
        ['stop-2', 'stop-1'],
        mockUserId,
        mockMeta,
      );

      expect(reordered).toHaveLength(2);
      expect(mockPrisma.tripStop.update).toHaveBeenCalledTimes(4); // 2-stage sequence update prevents unique constraint collisions
    });

    it('reorderStops should throw BadRequestException if foreign stop ID is given', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({ id: mockTripId, companyId: mockCompanyAId });
      mockPrisma.tripStop.findMany.mockResolvedValueOnce([{ id: 'stop-1' }]);

      await expect(
        service.reorderStops(
          mockTripId,
          mockCompanyAId,
          ['stop-1', 'foreign-stop-999'],
          mockUserId,
          mockMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('calculateTripRoute should compute distance, duration, and polyline', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        pickupLatitude: 37.7749,
        pickupLongitude: -122.4194,
        dropLatitude: 37.3382,
        dropLongitude: -121.8863,
      });
      mockPrisma.tripStop.findMany.mockResolvedValueOnce([
        { latitude: 37.55, longitude: -122.15 },
      ]);
      mockPrisma.trip.update.mockResolvedValueOnce({});

      const route = await service.calculateTripRoute(mockTripId, mockCompanyAId);

      expect(route.distanceKm).toBeGreaterThan(0);
      expect(route.durationMinutes).toBeGreaterThan(0);
      expect(route.geometryPolyline).toBeDefined();
      expect(mockPrisma.trip.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockTripId },
          data: expect.objectContaining({
            distanceKm: route.distanceKm,
            durationMinutes: route.durationMinutes,
            routePolyline: route.geometryPolyline,
          }),
        }),
      );
    });

    it('calculateTripEta should calculate dynamic remaining distance and time', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: mockTripId,
        companyId: mockCompanyAId,
        dropLatitude: 37.3382,
        dropLongitude: -121.8863,
      });

      const eta = await service.calculateTripEta(mockTripId, mockCompanyAId, 37.7749, -122.4194);

      expect(eta.distanceRemainingKm).toBeGreaterThan(0);
      expect(eta.durationRemainingMinutes).toBeGreaterThan(0);
      expect(eta.calculationSource).toBe('MOCK');
    });
  });

  // ─── Socket.IO Dispatch Broadcasting (Phase 12C) ───────────────────────────
  describe('Socket.IO Dispatch Broadcasting (Phase 12C)', () => {
    let mockGateway: any;
    let serviceWithGateway: TripService;

    beforeEach(async () => {
      mockGateway = {
        broadcastDispatchTripAssigned: jest.fn(),
        broadcastDispatchTripUnassigned: jest.fn(),
        broadcastDispatchTripDispatched: jest.fn(),
        broadcastDispatchStatusUpdated: jest.fn(),
        broadcastDispatchStopUpdated: jest.fn(),
        broadcastDispatchEtaUpdated: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TripService,
          { provide: DatabaseService, useValue: mockPrisma },
          { provide: TelemetryGateway, useValue: mockGateway },
        ],
      }).compile();

      serviceWithGateway = module.get<TripService>(TripService);
    });

    it('triggers broadcastDispatchTripAssigned when driver is assigned', async () => {
      const mockTrip = {
        id: mockTripId,
        companyId: mockCompanyAId,
        status: 'SCHEDULED',
        driverId: null,
        vehicleId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.trip.findFirst.mockResolvedValueOnce(mockTrip);
      mockPrisma.driver.findFirst.mockResolvedValueOnce({
        id: mockDriverId,
        companyId: mockCompanyAId,
        status: 'ACTIVE',
        dutyStatus: 'ON_DUTY',
      });
      mockPrisma.trip.findMany.mockResolvedValueOnce([]); // no active trips
      mockPrisma.trip.update.mockResolvedValueOnce({
        ...mockTrip,
        driverId: mockDriverId,
        status: 'DRIVER_ASSIGNED',
      });

      await serviceWithGateway.assignDriver(
        mockTripId,
        mockCompanyAId,
        { driverId: mockDriverId },
        mockUserId,
        { ipAddress: '127.0.0.1', userAgent: 'test' },
      );

      expect(mockGateway.broadcastDispatchTripAssigned).toHaveBeenCalledWith(
        mockCompanyAId,
        expect.objectContaining({
          tripId: mockTripId,
          driverId: mockDriverId,
          status: 'DRIVER_ASSIGNED',
        }),
      );
    });

    it('triggers broadcastDispatchTripDispatched when trip is dispatched', async () => {
      const mockTrip = {
        id: mockTripId,
        companyId: mockCompanyAId,
        status: 'DRIVER_ASSIGNED',
        driverId: mockDriverId,
        vehicleId: mockVehicleId,
        tripNumber: 'TR-100',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.trip.findFirst.mockResolvedValueOnce(mockTrip);
      mockPrisma.trip.update.mockResolvedValueOnce({
        ...mockTrip,
        status: 'DISPATCHED',
      });

      await serviceWithGateway.dispatchTrip(
        mockTripId,
        mockCompanyAId,
        {},
        mockUserId,
        { ipAddress: '127.0.0.1', userAgent: 'test' },
      );

      expect(mockGateway.broadcastDispatchTripDispatched).toHaveBeenCalledWith(
        mockCompanyAId,
        expect.objectContaining({
          tripId: mockTripId,
          status: 'DISPATCHED',
        }),
      );
    });
  });

  // ─── Dispatch Analytics (Phase 12D) ─────────────────────────────────────────
  describe('getDispatchAnalytics (Phase 12D)', () => {
    it('calculates operational dispatch KPIs and utilization rates', async () => {
      mockPrisma.trip.findMany.mockResolvedValueOnce([
        {
          id: 't-1',
          status: 'SCHEDULED',
          scheduledStart: new Date('2026-10-15T09:00:00Z'),
          actualStart: null,
          driverId: null,
          vehicleId: null,
        },
        {
          id: 't-2',
          status: 'COMPLETED',
          scheduledStart: new Date('2026-10-15T10:00:00Z'),
          actualStart: new Date('2026-10-15T10:05:00Z'),
          driverId: 'd-1',
          vehicleId: 'v-1',
        },
        {
          id: 't-3',
          status: 'IN_PROGRESS',
          scheduledStart: new Date('2026-10-15T11:00:00Z'),
          actualStart: new Date('2026-10-15T11:10:00Z'),
          driverId: 'd-1',
          vehicleId: 'v-1',
        },
      ]);
      mockPrisma.driver.findMany.mockResolvedValueOnce([
        { id: 'd-1', dutyStatus: 'ON_TRIP' },
        { id: 'd-2', dutyStatus: 'ON_DUTY' },
      ]);
      mockPrisma.vehicle.findMany.mockResolvedValueOnce([
        { id: 'v-1' },
        { id: 'v-2' },
      ]);
      mockPrisma.auditLog.count = jest.fn().mockResolvedValueOnce(2);

      const analytics = await service.getDispatchAnalytics(mockCompanyAId);

      expect(analytics.totalScheduled).toBe(3);
      expect(analytics.unassignedTrips).toBe(1);
      expect(analytics.completedTrips).toBe(1);
      expect(analytics.reassignmentCount).toBe(2);
      expect(analytics.averageLeadTimeMinutes).toBe(7.5);
      expect(analytics.onTimePickupRate).toBe(100);
      expect(analytics.driverUtilizationRate).toBe(50);
      expect(analytics.vehicleUtilizationRate).toBe(50);
    });
  });

  // ─── reorderStops (Remediation Phase 1 — Waypoint Reordering Integrity) ─────
  describe('reorderStops (CRIT-03 Remediation)', () => {
    const stop1 = {
      id: 'stop-1111-1111-1111-111111111111',
      tripId: mockTripId,
      companyId: mockCompanyAId,
      stopOrder: 1,
      stopType: 'PICKUP',
      locationName: 'Warehouse A',
      latitude: 37.77,
      longitude: -122.41,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const stop2 = {
      id: 'stop-2222-2222-2222-222222222222',
      tripId: mockTripId,
      companyId: mockCompanyAId,
      stopOrder: 2,
      stopType: 'WAYPOINT',
      locationName: 'Checkpoint B',
      latitude: 37.78,
      longitude: -122.42,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const stop3 = {
      id: 'stop-3333-3333-3333-333333333333',
      tripId: mockTripId,
      companyId: mockCompanyAId,
      stopOrder: 3,
      stopType: 'DROPOFF',
      locationName: 'Customer C',
      latitude: 37.79,
      longitude: -122.43,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockMeta = { ipAddress: '127.0.0.1', userAgent: 'test-agent' };

    it('successfully swaps two stops using two-stage sequence updates to avoid collisions', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({ id: mockTripId, companyId: mockCompanyAId });
      // Initial state and final fetch
      mockPrisma.tripStop.findMany
        .mockResolvedValueOnce([stop1, stop2]) // initial check
        .mockResolvedValueOnce([ // final fetch inside tx
          { ...stop2, stopOrder: 1 },
          { ...stop1, stopOrder: 2 },
        ]);
      mockPrisma.tripStop.update.mockResolvedValue({});

      const result = await service.reorderStops(
        mockTripId,
        mockCompanyAId,
        [stop2.id, stop1.id],
        mockUserId,
        mockMeta,
      );

      // Verify Stage 1 temporary negative orders:
      expect(mockPrisma.tripStop.update).toHaveBeenNthCalledWith(1, {
        where: { id: stop2.id },
        data: { stopOrder: -1 },
      });
      expect(mockPrisma.tripStop.update).toHaveBeenNthCalledWith(2, {
        where: { id: stop1.id },
        data: { stopOrder: -2 },
      });

      // Verify Stage 2 final positive orders:
      expect(mockPrisma.tripStop.update).toHaveBeenNthCalledWith(3, {
        where: { id: stop2.id },
        data: { stopOrder: 1 },
      });
      expect(mockPrisma.tripStop.update).toHaveBeenNthCalledWith(4, {
        where: { id: stop1.id },
        data: { stopOrder: 2 },
      });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(stop2.id);
      expect(result[0].stopOrder).toBe(1);
      expect(result[1].id).toBe(stop1.id);
      expect(result[1].stopOrder).toBe(2);

      // Verify audit was recorded
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'TRIP_STOPS_REORDERED',
            entityId: mockTripId,
          }),
        }),
      );
    });

    it('successfully reverses three stops atomically', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({ id: mockTripId, companyId: mockCompanyAId });
      mockPrisma.tripStop.findMany
        .mockResolvedValueOnce([stop1, stop2, stop3])
        .mockResolvedValueOnce([
          { ...stop3, stopOrder: 1 },
          { ...stop2, stopOrder: 2 },
          { ...stop1, stopOrder: 3 },
        ]);
      mockPrisma.tripStop.update.mockResolvedValue({});

      const result = await service.reorderStops(
        mockTripId,
        mockCompanyAId,
        [stop3.id, stop2.id, stop1.id],
        mockUserId,
        mockMeta,
      );

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe(stop3.id);
      expect(result[0].stopOrder).toBe(1);
      expect(result[1].id).toBe(stop2.id);
      expect(result[1].stopOrder).toBe(2);
      expect(result[2].id).toBe(stop1.id);
      expect(result[2].stopOrder).toBe(3);
    });

    it('successfully reorders a longer list of 5 stops', async () => {
      const stops = [1, 2, 3, 4, 5].map((num) => ({
        id: `stop-uuid-${num}`,
        tripId: mockTripId,
        companyId: mockCompanyAId,
        stopOrder: num,
        locationName: `Stop ${num}`,
        latitude: 37.0 + num * 0.01,
        longitude: -122.0 - num * 0.01,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const newOrderIds = [
        'stop-uuid-3',
        'stop-uuid-5',
        'stop-uuid-1',
        'stop-uuid-2',
        'stop-uuid-4',
      ];

      mockPrisma.trip.findFirst.mockResolvedValueOnce({ id: mockTripId, companyId: mockCompanyAId });
      mockPrisma.tripStop.findMany
        .mockResolvedValueOnce(stops)
        .mockResolvedValueOnce(
          newOrderIds.map((id, idx) => ({
            ...stops.find((s) => s.id === id)!,
            stopOrder: idx + 1,
          })),
        );
      mockPrisma.tripStop.update.mockResolvedValue({});

      const result = await service.reorderStops(
        mockTripId,
        mockCompanyAId,
        newOrderIds,
        mockUserId,
        mockMeta,
      );

      expect(result).toHaveLength(5);
      expect(result.map((r) => r.id)).toEqual(newOrderIds);
      expect(result.map((r) => r.stopOrder)).toEqual([1, 2, 3, 4, 5]);
    });

    it('rejects duplicate stop IDs in reorder array', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({ id: mockTripId, companyId: mockCompanyAId });

      await expect(
        service.reorderStops(
          mockTripId,
          mockCompanyAId,
          [stop1.id, stop1.id],
          mockUserId,
          mockMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects empty stopIds array', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({ id: mockTripId, companyId: mockCompanyAId });

      await expect(
        service.reorderStops(
          mockTripId,
          mockCompanyAId,
          [],
          mockUserId,
          mockMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects nonexistent stop ID', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({ id: mockTripId, companyId: mockCompanyAId });
      mockPrisma.tripStop.findMany.mockResolvedValueOnce([stop1, stop2]);

      await expect(
        service.reorderStops(
          mockTripId,
          mockCompanyAId,
          [stop1.id, '00000000-0000-0000-0000-000000000000'],
          mockUserId,
          mockMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects stop ID belonging to another trip', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({ id: mockTripId, companyId: mockCompanyAId });
      mockPrisma.tripStop.findMany.mockResolvedValueOnce([stop1, stop2]);

      const otherTripStopId = '99999999-9999-9999-9999-999999999999';
      await expect(
        service.reorderStops(
          mockTripId,
          mockCompanyAId,
          [stop1.id, otherTripStopId],
          mockUserId,
          mockMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects reordering for non-existent or cross-tenant trip', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.reorderStops(
          mockTripId,
          mockCompanyBId,
          [stop1.id, stop2.id],
          mockUserId,
          mockMeta,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects incomplete reorder requests missing some stops', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({ id: mockTripId, companyId: mockCompanyAId });
      mockPrisma.tripStop.findMany.mockResolvedValueOnce([stop1, stop2, stop3]);

      await expect(
        service.reorderStops(
          mockTripId,
          mockCompanyAId,
          [stop1.id, stop2.id],
          mockUserId,
          mockMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects reorder requests with extra stop count', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({ id: mockTripId, companyId: mockCompanyAId });
      mockPrisma.tripStop.findMany.mockResolvedValueOnce([stop1, stop2]);

      await expect(
        service.reorderStops(
          mockTripId,
          mockCompanyAId,
          [stop1.id, stop2.id, stop3.id],
          mockUserId,
          mockMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rolls back transaction and does not write audit log if an update operation fails', async () => {
      mockPrisma.trip.findFirst.mockResolvedValueOnce({ id: mockTripId, companyId: mockCompanyAId });
      mockPrisma.tripStop.findMany.mockResolvedValueOnce([stop1, stop2]);

      const dbError = new Error('Database constraint error during update');
      mockPrisma.tripStop.update.mockRejectedValueOnce(dbError);

      await expect(
        service.reorderStops(
          mockTripId,
          mockCompanyAId,
          [stop2.id, stop1.id],
          mockUserId,
          mockMeta,
        ),
      ).rejects.toThrow(dbError);

      expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('triggers broadcastDispatchStopUpdated when reordered with gateway injected', async () => {
      const localGateway = {
        broadcastDispatchTripAssigned: jest.fn(),
        broadcastDispatchTripUnassigned: jest.fn(),
        broadcastDispatchTripDispatched: jest.fn(),
        broadcastDispatchStatusUpdated: jest.fn(),
        broadcastDispatchStopUpdated: jest.fn(),
        broadcastDispatchEtaUpdated: jest.fn(),
      };

      const module = await Test.createTestingModule({
        providers: [
          TripService,
          { provide: DatabaseService, useValue: mockPrisma },
          { provide: TelemetryGateway, useValue: localGateway },
        ],
      }).compile();

      const serviceWithLocalGateway = module.get<TripService>(TripService);

      const mockTrip = { id: mockTripId, companyId: mockCompanyAId };
      mockPrisma.trip.findFirst.mockResolvedValueOnce(mockTrip);
      mockPrisma.tripStop.findMany
        .mockResolvedValueOnce([stop1, stop2])
        .mockResolvedValueOnce([
          { ...stop2, stopOrder: 1 },
          { ...stop1, stopOrder: 2 },
        ]);
      mockPrisma.tripStop.update.mockResolvedValue({});

      await serviceWithLocalGateway.reorderStops(
        mockTripId,
        mockCompanyAId,
        [stop2.id, stop1.id],
        mockUserId,
        mockMeta,
      );

      expect(localGateway.broadcastDispatchStopUpdated).toHaveBeenCalledWith(
        mockCompanyAId,
        expect.objectContaining({
          tripId: mockTripId,
          action: 'REORDERED',
          stops: expect.arrayContaining([
            expect.objectContaining({ id: stop2.id, stopOrder: 1 }),
            expect.objectContaining({ id: stop1.id, stopOrder: 2 }),
          ]),
        }),
      );
    });
  });

  describe('Phase 2 Concurrency Protection & Lifecycle Integrity Remediation (CRIT-02 & HIGH-01)', () => {
    let mockRedisClient: any;
    let mockCacheService: any;
    let serviceWithRedis: TripService;

    beforeEach(async () => {
      mockRedisClient = {
        set: jest.fn(),
        get: jest.fn(),
        eval: jest.fn(),
      };
      mockCacheService = {
        getClient: jest.fn(() => mockRedisClient),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TripService,
          { provide: DatabaseService, useValue: mockPrisma },
          { provide: CacheService, useValue: mockCacheService },
        ],
      }).compile();

      serviceWithRedis = module.get<TripService>(TripService);
    });

    describe('Driver Concurrency (CRIT-02)', () => {
      it('should allow assignment when Redis lock is successfully acquired', async () => {
        mockRedisClient.set.mockResolvedValueOnce('OK');
        mockRedisClient.eval.mockResolvedValueOnce(1);

        mockPrisma.trip.findFirst.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'SCHEDULED',
        });
        mockPrisma.driver.findFirst.mockResolvedValueOnce({
          id: mockDriverId,
          companyId: mockCompanyAId,
          status: 'ACTIVE',
          licenseExpiryDate: new Date('2029-01-01'),
        });
        mockPrisma.trip.findFirst.mockResolvedValueOnce(null); // no conflict
        mockPrisma.trip.update.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'DRIVER_ASSIGNED',
          driverId: mockDriverId,
          createdAt: new Date(),
          updatedAt: new Date(),
          scheduledStart: new Date(),
        });

        const res = await serviceWithRedis.assignDriver(
          mockTripId,
          mockCompanyAId,
          { driverId: mockDriverId },
          mockUserId,
          {},
        );

        expect(res.driverId).toBe(mockDriverId);
        expect(mockRedisClient.set).toHaveBeenCalledWith(
          `dispatch:lock:driver:${mockDriverId}`,
          expect.any(String),
          'PX',
          5000,
          'NX',
        );
        expect(mockRedisClient.eval).toHaveBeenCalledWith(
          expect.stringContaining('redis.call("get", KEYS[1]) == ARGV[1]'),
          1,
          `dispatch:lock:driver:${mockDriverId}`,
          expect.any(String),
        );
      });

      it('should reject assignment with ConflictException when driver lock is already held by another request', async () => {
        // Redis returns null because another request holds the NX lock
        mockRedisClient.set.mockResolvedValueOnce(null);

        await expect(
          serviceWithRedis.assignDriver(
            mockTripId,
            mockCompanyAId,
            { driverId: mockDriverId },
            mockUserId,
            {},
          ),
        ).rejects.toThrow(ConflictException);

        // Does not touch database if lock cannot be acquired
        expect(mockPrisma.trip.update).not.toHaveBeenCalled();
      });

      it('should safely release its own lock in finally block if assignment fails due to terminal status', async () => {
        mockRedisClient.set.mockResolvedValueOnce('OK');
        mockRedisClient.eval.mockResolvedValueOnce(1);

        mockPrisma.trip.findFirst.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'COMPLETED',
        });

        await expect(
          serviceWithRedis.assignDriver(
            mockTripId,
            mockCompanyAId,
            { driverId: mockDriverId },
            mockUserId,
            {},
          ),
        ).rejects.toThrow(BadRequestException);

        // Lock must still be released in finally block
        expect(mockRedisClient.eval).toHaveBeenCalledWith(
          expect.stringContaining('redis.call("get", KEYS[1]) == ARGV[1]'),
          1,
          `dispatch:lock:driver:${mockDriverId}`,
          expect.any(String),
        );
      });

      it('should gracefully fallback to database transaction if Redis client throws an error', async () => {
        mockRedisClient.set.mockRejectedValueOnce(new Error('Redis connection timeout'));

        mockPrisma.trip.findFirst.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'SCHEDULED',
        });
        mockPrisma.driver.findFirst.mockResolvedValueOnce({
          id: mockDriverId,
          companyId: mockCompanyAId,
          status: 'ACTIVE',
          licenseExpiryDate: new Date('2029-01-01'),
        });
        mockPrisma.trip.findFirst.mockResolvedValueOnce(null);
        mockPrisma.trip.update.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'DRIVER_ASSIGNED',
          driverId: mockDriverId,
          createdAt: new Date(),
          updatedAt: new Date(),
          scheduledStart: new Date(),
        });

        const res = await serviceWithRedis.assignDriver(
          mockTripId,
          mockCompanyAId,
          { driverId: mockDriverId },
          mockUserId,
          {},
        );

        expect(res.driverId).toBe(mockDriverId);
      });
    });

    describe('Vehicle Concurrency (CRIT-02)', () => {
      it('should allow assignment when vehicle Redis lock is successfully acquired', async () => {
        mockRedisClient.set.mockResolvedValueOnce('OK');
        mockRedisClient.eval.mockResolvedValueOnce(1);

        mockPrisma.trip.findFirst.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'SCHEDULED',
        });
        mockPrisma.vehicle.findFirst.mockResolvedValueOnce({
          id: mockVehicleId,
          companyId: mockCompanyAId,
          status: 'ACTIVE',
        });
        mockPrisma.trip.findFirst.mockResolvedValueOnce(null);
        mockPrisma.trip.update.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'VEHICLE_ASSIGNED',
          vehicleId: mockVehicleId,
          createdAt: new Date(),
          updatedAt: new Date(),
          scheduledStart: new Date(),
        });

        const res = await serviceWithRedis.assignVehicle(
          mockTripId,
          mockCompanyAId,
          { vehicleId: mockVehicleId },
          mockUserId,
          {},
        );

        expect(res.vehicleId).toBe(mockVehicleId);
        expect(mockRedisClient.set).toHaveBeenCalledWith(
          `dispatch:lock:vehicle:${mockVehicleId}`,
          expect.any(String),
          'PX',
          5000,
          'NX',
        );
        expect(mockRedisClient.eval).toHaveBeenCalledWith(
          expect.stringContaining('redis.call("get", KEYS[1]) == ARGV[1]'),
          1,
          `dispatch:lock:vehicle:${mockVehicleId}`,
          expect.any(String),
        );
      });

      it('should reject vehicle assignment with ConflictException when lock is held by another operation', async () => {
        mockRedisClient.set.mockResolvedValueOnce(null);

        await expect(
          serviceWithRedis.assignVehicle(
            mockTripId,
            mockCompanyAId,
            { vehicleId: mockVehicleId },
            mockUserId,
            {},
          ),
        ).rejects.toThrow(ConflictException);

        expect(mockPrisma.trip.update).not.toHaveBeenCalled();
      });

      it('should enforce vehicle work-order maintenance hold inside transaction and release lock', async () => {
        mockRedisClient.set.mockResolvedValueOnce('OK');
        mockRedisClient.eval.mockResolvedValueOnce(1);

        mockPrisma.trip.findFirst.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'SCHEDULED',
        });
        mockPrisma.vehicle.findFirst.mockResolvedValueOnce({
          id: mockVehicleId,
          companyId: mockCompanyAId,
          status: 'ACTIVE',
        });
        mockPrisma.workOrder.findFirst.mockResolvedValueOnce({
          id: 'wo-1',
          workOrderNumber: 'WO-999',
          status: 'IN_PROGRESS',
        });

        await expect(
          serviceWithRedis.assignVehicle(
            mockTripId,
            mockCompanyAId,
            { vehicleId: mockVehicleId },
            mockUserId,
            {},
          ),
        ).rejects.toThrow(ConflictException);

        expect(mockRedisClient.eval).toHaveBeenCalled();
        expect(mockPrisma.trip.update).not.toHaveBeenCalled();
      });

      it('should roll back transaction and not write audit log if trip update fails', async () => {
        mockRedisClient.set.mockResolvedValueOnce('OK');
        mockRedisClient.eval.mockResolvedValueOnce(1);

        mockPrisma.trip.findFirst.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'SCHEDULED',
        });
        mockPrisma.vehicle.findFirst.mockResolvedValueOnce({
          id: mockVehicleId,
          companyId: mockCompanyAId,
          status: 'ACTIVE',
        });
        mockPrisma.workOrder.findFirst.mockResolvedValueOnce(null);
        mockPrisma.trip.findFirst.mockResolvedValueOnce(null);
        mockPrisma.trip.update.mockRejectedValueOnce(new Error('Database write error'));

        await expect(
          serviceWithRedis.assignVehicle(
            mockTripId,
            mockCompanyAId,
            { vehicleId: mockVehicleId },
            mockUserId,
            {},
          ),
        ).rejects.toThrow('Database write error');

        expect(mockPrisma.auditLog.create).not.toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ action: 'TRIP_VEHICLE_ASSIGNED' }),
          }),
        );
        expect(mockRedisClient.eval).toHaveBeenCalled();
      });
    });

    describe('Trip Lifecycle Hardening (HIGH-01)', () => {
      it('should reject transitioning unassigned SCHEDULED trip to DISPATCHED via updateTripStatus', async () => {
        mockPrisma.trip.findFirst.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'SCHEDULED',
          driverId: null,
          vehicleId: null,
        });

        await expect(
          service.updateTripStatus(
            mockTripId,
            mockCompanyAId,
            { status: 'DISPATCHED' },
            mockUserId,
            {},
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject transitioning trip with only driver assigned to DISPATCHED via updateTripStatus', async () => {
        mockPrisma.trip.findFirst.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'DRIVER_ASSIGNED',
          driverId: mockDriverId,
          vehicleId: null,
        });

        await expect(
          service.updateTripStatus(
            mockTripId,
            mockCompanyAId,
            { status: 'DISPATCHED' },
            mockUserId,
            {},
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject transitioning trip with only vehicle assigned to DISPATCHED via updateTripStatus', async () => {
        mockPrisma.trip.findFirst.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'VEHICLE_ASSIGNED',
          driverId: null,
          vehicleId: mockVehicleId,
        });

        await expect(
          service.updateTripStatus(
            mockTripId,
            mockCompanyAId,
            { status: 'DISPATCHED' },
            mockUserId,
            {},
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject dispatching if assigned driver belongs to a different company', async () => {
        mockPrisma.trip.findFirst.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'DRIVER_ASSIGNED',
          driverId: mockDriverId,
          vehicleId: mockVehicleId,
        });
        // Driver not found in Company A
        mockPrisma.driver.findFirst.mockResolvedValueOnce(null);

        await expect(
          service.updateTripStatus(
            mockTripId,
            mockCompanyAId,
            { status: 'DISPATCHED' },
            mockUserId,
            {},
          ),
        ).rejects.toThrow('Cannot dispatch trip: assigned driver does not belong to this company');
      });

      it('should reject dispatching if assigned vehicle belongs to a different company', async () => {
        mockPrisma.trip.findFirst.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'DRIVER_ASSIGNED',
          driverId: mockDriverId,
          vehicleId: mockVehicleId,
        });
        mockPrisma.driver.findFirst.mockResolvedValueOnce({
          id: mockDriverId,
          companyId: mockCompanyAId,
          status: 'ACTIVE',
          licenseExpiryDate: new Date('2029-01-01'),
        });
        // Vehicle not found in Company A
        mockPrisma.vehicle.findFirst.mockResolvedValueOnce(null);

        await expect(
          service.updateTripStatus(
            mockTripId,
            mockCompanyAId,
            { status: 'DISPATCHED' },
            mockUserId,
            {},
          ),
        ).rejects.toThrow('Cannot dispatch trip: assigned vehicle does not belong to this company');
      });

      it('should reject dispatching if assigned driver license is expired', async () => {
        mockPrisma.trip.findFirst.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'DRIVER_ASSIGNED',
          driverId: mockDriverId,
          vehicleId: mockVehicleId,
        });
        mockPrisma.driver.findFirst.mockResolvedValueOnce({
          id: mockDriverId,
          companyId: mockCompanyAId,
          status: 'ACTIVE',
          licenseExpiryDate: new Date('2020-01-01'), // Expired!
        });

        await expect(
          service.updateTripStatus(
            mockTripId,
            mockCompanyAId,
            { status: 'DISPATCHED' },
            mockUserId,
            {},
          ),
        ).rejects.toThrow("Cannot dispatch trip: assigned driver's license has expired");
      });

      it('should reject dispatching if assigned vehicle is not ACTIVE', async () => {
        mockPrisma.trip.findFirst.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'DRIVER_ASSIGNED',
          driverId: mockDriverId,
          vehicleId: mockVehicleId,
        });
        mockPrisma.driver.findFirst.mockResolvedValueOnce({
          id: mockDriverId,
          companyId: mockCompanyAId,
          status: 'ACTIVE',
          licenseExpiryDate: new Date('2029-01-01'),
        });
        mockPrisma.vehicle.findFirst.mockResolvedValueOnce({
          id: mockVehicleId,
          companyId: mockCompanyAId,
          status: 'INACTIVE', // Inactive!
        });

        await expect(
          service.updateTripStatus(
            mockTripId,
            mockCompanyAId,
            { status: 'DISPATCHED' },
            mockUserId,
            {},
          ),
        ).rejects.toThrow('Cannot dispatch trip: assigned vehicle is not ACTIVE');
      });

      it('should reject dispatching if assigned vehicle has an active maintenance work order', async () => {
        mockPrisma.trip.findFirst.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'DRIVER_ASSIGNED',
          driverId: mockDriverId,
          vehicleId: mockVehicleId,
        });
        mockPrisma.driver.findFirst.mockResolvedValueOnce({
          id: mockDriverId,
          companyId: mockCompanyAId,
          status: 'ACTIVE',
          licenseExpiryDate: new Date('2029-01-01'),
        });
        mockPrisma.vehicle.findFirst.mockResolvedValueOnce({
          id: mockVehicleId,
          companyId: mockCompanyAId,
          status: 'ACTIVE',
        });
        mockPrisma.workOrder.findFirst.mockResolvedValueOnce({
          id: 'wo-1',
          workOrderNumber: 'WO-101',
          status: 'IN_PROGRESS',
        });

        await expect(
          service.updateTripStatus(
            mockTripId,
            mockCompanyAId,
            { status: 'DISPATCHED' },
            mockUserId,
            {},
          ),
        ).rejects.toThrow('Cannot dispatch trip: assigned vehicle has an active maintenance work order');
      });

      it('should allow transitioning to DISPATCHED via updateTripStatus when both driver and vehicle are valid', async () => {
        mockPrisma.trip.findFirst.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'DRIVER_ASSIGNED',
          driverId: mockDriverId,
          vehicleId: mockVehicleId,
        });
        mockPrisma.driver.findFirst.mockResolvedValueOnce({
          id: mockDriverId,
          companyId: mockCompanyAId,
          status: 'ACTIVE',
          licenseExpiryDate: new Date('2029-01-01'),
        });
        mockPrisma.vehicle.findFirst.mockResolvedValueOnce({
          id: mockVehicleId,
          companyId: mockCompanyAId,
          status: 'ACTIVE',
        });
        mockPrisma.workOrder.findFirst.mockResolvedValueOnce(null);

        mockPrisma.trip.update.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'DISPATCHED',
          driverId: mockDriverId,
          vehicleId: mockVehicleId,
          createdAt: new Date(),
          updatedAt: new Date(),
          scheduledStart: new Date(),
        });

        const res = await service.updateTripStatus(
          mockTripId,
          mockCompanyAId,
          { status: 'DISPATCHED' },
          mockUserId,
          {},
        );

        expect(res.status).toBe('DISPATCHED');
      });

      it('should ensure existing valid transitions continue to work normally', async () => {
        // Test SCHEDULED -> CANCELLED
        mockPrisma.trip.findFirst.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'SCHEDULED',
        });
        mockPrisma.trip.update.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'CANCELLED',
          createdAt: new Date(),
          updatedAt: new Date(),
          scheduledStart: new Date(),
        });

        const cancelRes = await service.updateTripStatus(
          mockTripId,
          mockCompanyAId,
          { status: 'CANCELLED' },
          mockUserId,
          {},
        );
        expect(cancelRes.status).toBe('CANCELLED');

        // Test IN_PROGRESS -> COMPLETED
        mockPrisma.trip.findFirst.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'IN_PROGRESS',
          driverId: mockDriverId,
        });
        mockPrisma.trip.update.mockResolvedValueOnce({
          id: mockTripId,
          companyId: mockCompanyAId,
          status: 'COMPLETED',
          createdAt: new Date(),
          updatedAt: new Date(),
          scheduledStart: new Date(),
        });

        const completeRes = await service.updateTripStatus(
          mockTripId,
          mockCompanyAId,
          { status: 'COMPLETED' },
          mockUserId,
          {},
        );
        expect(completeRes.status).toBe('COMPLETED');
      });
    });

    describe('Simultaneous Competing Requests (CRIT-02 Race Protection)', () => {
      it('should ensure exactly one request succeeds and the other receives 409 when two requests simultaneously compete for same driver', async () => {
        // Request 1 acquires lock, Request 2 encounters held lock
        mockRedisClient.set
          .mockResolvedValueOnce('OK')
          .mockResolvedValueOnce(null);
        mockRedisClient.eval.mockResolvedValue(1);

        mockPrisma.trip.findFirst.mockResolvedValueOnce({
          id: 'trip-1',
          companyId: mockCompanyAId,
          status: 'SCHEDULED',
        });
        mockPrisma.driver.findFirst.mockResolvedValueOnce({
          id: mockDriverId,
          companyId: mockCompanyAId,
          status: 'ACTIVE',
          licenseExpiryDate: new Date('2029-01-01'),
        });
        mockPrisma.trip.findFirst.mockResolvedValueOnce(null);
        mockPrisma.trip.update.mockResolvedValueOnce({
          id: 'trip-1',
          companyId: mockCompanyAId,
          status: 'DRIVER_ASSIGNED',
          driverId: mockDriverId,
          createdAt: new Date(),
          updatedAt: new Date(),
          scheduledStart: new Date(),
        });

        const [res1, res2] = await Promise.allSettled([
          serviceWithRedis.assignDriver('trip-1', mockCompanyAId, { driverId: mockDriverId }, mockUserId, {}),
          serviceWithRedis.assignDriver('trip-2', mockCompanyAId, { driverId: mockDriverId }, mockUserId, {}),
        ]);

        expect(res1.status).toBe('fulfilled');
        expect(res2.status).toBe('rejected');
        if (res2.status === 'rejected') {
          expect(res2.reason).toBeInstanceOf(ConflictException);
          expect(res2.reason.message).toContain('Driver is currently being assigned or locked');
        }
      });

      it('should ensure exactly one request succeeds and the other receives 409 when two requests simultaneously compete for same vehicle', async () => {
        // Request 1 acquires lock, Request 2 encounters held lock
        mockRedisClient.set
          .mockResolvedValueOnce('OK')
          .mockResolvedValueOnce(null);
        mockRedisClient.eval.mockResolvedValue(1);

        mockPrisma.trip.findFirst.mockResolvedValueOnce({
          id: 'trip-1',
          companyId: mockCompanyAId,
          status: 'SCHEDULED',
        });
        mockPrisma.vehicle.findFirst.mockResolvedValueOnce({
          id: mockVehicleId,
          companyId: mockCompanyAId,
          status: 'ACTIVE',
        });
        mockPrisma.trip.findFirst.mockResolvedValueOnce(null);
        mockPrisma.trip.update.mockResolvedValueOnce({
          id: 'trip-1',
          companyId: mockCompanyAId,
          status: 'VEHICLE_ASSIGNED',
          vehicleId: mockVehicleId,
          createdAt: new Date(),
          updatedAt: new Date(),
          scheduledStart: new Date(),
        });

        const [res1, res2] = await Promise.allSettled([
          serviceWithRedis.assignVehicle('trip-1', mockCompanyAId, { vehicleId: mockVehicleId }, mockUserId, {}),
          serviceWithRedis.assignVehicle('trip-2', mockCompanyAId, { vehicleId: mockVehicleId }, mockUserId, {}),
        ]);

        expect(res1.status).toBe('fulfilled');
        expect(res2.status).toBe('rejected');
        if (res2.status === 'rejected') {
          expect(res2.reason).toBeInstanceOf(ConflictException);
          expect(res2.reason.message).toContain('Vehicle is currently being assigned or locked');
        }
      });
    });
  });
});
