import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { TripService } from './trip.service';
import { DatabaseService } from '../database/database.service';

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
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      vehicle: {
        findFirst: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
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
});
