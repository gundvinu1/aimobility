jest.mock('@nestjs/jwt', () => ({
  JwtService: class {
    verify = jest.fn();
    sign = jest.fn();
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../cache/cache.service';
import { TelemetryGateway } from './telemetry.gateway';
import { IngestTelemetryDto } from './dto/ingest-telemetry.dto';
import { TELEMETRY_OFFLINE_THRESHOLD_SECONDS } from '@ai-mos/constants';

describe('TelemetryService', () => {
  let service: TelemetryService;
  let db: any;
  let cache: any;
  let gateway: any;

  const mockCompanyId = '11111111-1111-1111-1111-111111111111';
  const mockVehicleId = '22222222-2222-2222-2222-222222222222';
  const mockDriverId = '33333333-3333-3333-3333-333333333333';
  const mockTripId = '44444444-4444-4444-4444-444444444444';

  beforeEach(async () => {
    db = {
      vehicle: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      driver: {
        findFirst: jest.fn(),
      },
      driverVehicleAssignment: {
        findFirst: jest.fn(),
      },
      trip: {
        findFirst: jest.fn(),
      },
      vehicleLocation: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
      },
      vehicleTelemetry: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };

    cache = {
      get: jest.fn(),
      set: jest.fn(),
    };

    gateway = {
      broadcastLocationUpdated: jest.fn(),
      broadcastStatusUpdated: jest.fn(),
      broadcastDriverLocationUpdated: jest.fn(),
      broadcastTripLocationUpdated: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryService,
        { provide: DatabaseService, useValue: db },
        { provide: CacheService, useValue: cache },
        { provide: TelemetryGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get<TelemetryService>(TelemetryService);
  });

  describe('ingestTelemetry', () => {
    const validDto: IngestTelemetryDto = {
      vehicleId: mockVehicleId,
      latitude: 37.7749,
      longitude: -122.4194,
      speed: 45.5,
      heading: 180,
      accuracy: 5.0,
      altitude: 15.0,
      ignition: true,
      timestamp: new Date().toISOString(),
    };

    it('should successfully ingest telemetry for a valid vehicle and tenant', async () => {
      db.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        companyId: mockCompanyId,
        status: 'ACTIVE',
      });
      db.driverVehicleAssignment.findFirst.mockResolvedValue(null);
      db.trip.findFirst.mockResolvedValue(null);
      db.vehicleLocation.findUnique.mockResolvedValue(null);
      const mockCreatedLocation = {
        id: 'loc-1',
        companyId: mockCompanyId,
        vehicleId: mockVehicleId,
        driverId: null,
        latitude: validDto.latitude,
        longitude: validDto.longitude,
        speed: validDto.speed,
        heading: validDto.heading,
        accuracy: validDto.accuracy,
        altitude: validDto.altitude,
        ignition: true,
        batteryLevel: null,
        odometer: null,
        engineTemperature: null,
        fuelLevel: null,
        signalStrength: null,
        source: 'API',
        timestamp: new Date(validDto.timestamp),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      db.vehicleLocation.upsert.mockResolvedValue(mockCreatedLocation);
      db.vehicleTelemetry.create.mockResolvedValue({ id: 'tel-1' });

      const result = await service.ingestTelemetry(mockCompanyId, validDto);

      expect(result.isNew).toBe(true);
      expect(result.location.vehicleId).toBe(mockVehicleId);
      expect(result.location.latitude).toBe(37.7749);
      expect(db.vehicleLocation.upsert).toHaveBeenCalled();
      expect(db.vehicleTelemetry.create).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalled();
      expect(gateway.broadcastLocationUpdated).toHaveBeenCalledWith(
        mockCompanyId,
        expect.objectContaining({
          vehicleId: mockVehicleId,
          fleetStatus: 'ACTIVE',
        }),
      );
    });

    it('should auto-resolve assigned driver if driverId is omitted', async () => {
      db.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        companyId: mockCompanyId,
        status: 'ACTIVE',
      });
      db.driverVehicleAssignment.findFirst.mockResolvedValue({
        driverId: mockDriverId,
        driver: {
          id: mockDriverId,
          driverCode: 'DRV-001',
          employee: { firstName: 'John', lastName: 'Doe' },
        },
      });
      db.trip.findFirst.mockResolvedValue(null);
      db.vehicleLocation.findUnique.mockResolvedValue({ id: 'loc-1' });
      db.vehicleLocation.upsert.mockResolvedValue({
        id: 'loc-1',
        companyId: mockCompanyId,
        vehicleId: mockVehicleId,
        driverId: mockDriverId,
        latitude: validDto.latitude,
        longitude: validDto.longitude,
        speed: validDto.speed,
        heading: validDto.heading,
        accuracy: null,
        altitude: null,
        ignition: true,
        batteryLevel: null,
        odometer: null,
        engineTemperature: null,
        fuelLevel: null,
        signalStrength: null,
        source: 'API',
        timestamp: new Date(validDto.timestamp),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      db.vehicleTelemetry.create.mockResolvedValue({ id: 'tel-1' });

      const result = await service.ingestTelemetry(mockCompanyId, validDto);

      expect(result.location.driverId).toBe(mockDriverId);
      expect(gateway.broadcastLocationUpdated).toHaveBeenCalledWith(
        mockCompanyId,
        expect.objectContaining({
          driverId: mockDriverId,
          driverName: 'John Doe',
        }),
      );
      expect(gateway.broadcastDriverLocationUpdated).toHaveBeenCalled();
    });

    it('should link active trip and mark fleetStatus as ON_TRIP', async () => {
      db.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        companyId: mockCompanyId,
        status: 'ACTIVE',
      });
      db.driverVehicleAssignment.findFirst.mockResolvedValue(null);
      db.trip.findFirst.mockResolvedValue({
        id: mockTripId,
        tripNumber: 'TRP-1001',
      });
      db.vehicleLocation.findUnique.mockResolvedValue(null);
      db.vehicleLocation.upsert.mockResolvedValue({
        id: 'loc-1',
        companyId: mockCompanyId,
        vehicleId: mockVehicleId,
        driverId: null,
        latitude: validDto.latitude,
        longitude: validDto.longitude,
        speed: validDto.speed,
        heading: null,
        accuracy: null,
        altitude: null,
        ignition: true,
        batteryLevel: null,
        odometer: null,
        engineTemperature: null,
        fuelLevel: null,
        signalStrength: null,
        source: 'API',
        timestamp: new Date(validDto.timestamp),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      db.vehicleTelemetry.create.mockResolvedValue({ id: 'tel-1' });

      await service.ingestTelemetry(mockCompanyId, validDto);

      expect(gateway.broadcastLocationUpdated).toHaveBeenCalledWith(
        mockCompanyId,
        expect.objectContaining({
          fleetStatus: 'ON_TRIP',
          currentTripId: mockTripId,
        }),
      );
      expect(gateway.broadcastTripLocationUpdated).toHaveBeenCalledWith(
        mockCompanyId,
        expect.objectContaining({
          tripId: mockTripId,
          tripNumber: 'TRP-1001',
        }),
      );
    });

    it('should throw NotFoundException if vehicle does not exist or belongs to another tenant', async () => {
      db.vehicle.findFirst.mockResolvedValue(null);

      await expect(service.ingestTelemetry(mockCompanyId, validDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if specified driverId belongs to another tenant', async () => {
      db.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        companyId: mockCompanyId,
        status: 'ACTIVE',
      });
      db.driver.findFirst.mockResolvedValue(null); // driver not found in company

      await expect(
        service.ingestTelemetry(mockCompanyId, { ...validDto, driverId: 'wrong-driver' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject invalid coordinates (out of range latitude)', async () => {
      db.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        companyId: mockCompanyId,
        status: 'ACTIVE',
      });

      await expect(
        service.ingestTelemetry(mockCompanyId, { ...validDto, latitude: 91.5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid coordinates (out of range longitude)', async () => {
      db.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        companyId: mockCompanyId,
        status: 'ACTIVE',
      });

      await expect(
        service.ingestTelemetry(mockCompanyId, { ...validDto, longitude: -185.0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid speed (< 0 or > 500)', async () => {
      db.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        companyId: mockCompanyId,
        status: 'ACTIVE',
      });

      await expect(
        service.ingestTelemetry(mockCompanyId, { ...validDto, speed: -5 }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.ingestTelemetry(mockCompanyId, { ...validDto, speed: 550 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid heading (< 0 or > 360)', async () => {
      db.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        companyId: mockCompanyId,
        status: 'ACTIVE',
      });

      await expect(
        service.ingestTelemetry(mockCompanyId, { ...validDto, heading: 400 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject timestamps more than 5 minutes in the future', async () => {
      db.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        companyId: mockCompanyId,
        status: 'ACTIVE',
      });

      const futureDate = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await expect(
        service.ingestTelemetry(mockCompanyId, { ...validDto, timestamp: futureDate }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deriveFleetStatus & Offline Detection', () => {
    it('should return MAINTENANCE if vehicle status is MAINTENANCE', () => {
      expect(service.deriveFleetStatus('MAINTENANCE', true, false)).toBe('MAINTENANCE');
      expect(service.deriveFleetStatus('MAINTENANCE', false, false)).toBe('MAINTENANCE');
    });

    it('should return OFFLINE if isOnline is false', () => {
      expect(service.deriveFleetStatus('ACTIVE', false, false)).toBe('OFFLINE');
      expect(service.deriveFleetStatus('ON_TRIP', false, true)).toBe('OFFLINE');
    });

    it('should return ON_TRIP if isOnline is true and isOnTrip is true', () => {
      expect(service.deriveFleetStatus('ACTIVE', true, true)).toBe('ON_TRIP');
      expect(service.deriveFleetStatus('ON_TRIP', true, false)).toBe('ON_TRIP');
    });

    it('should return ACTIVE if online and not on trip', () => {
      expect(service.deriveFleetStatus('ACTIVE', true, false)).toBe('ACTIVE');
    });
  });

  describe('getFleetSnapshot', () => {
    it('should aggregate online, offline, and onTrip counts accurately', async () => {
      const now = new Date();
      const recentTimestamp = new Date(now.getTime() - 60 * 1000); // 1 min ago (ONLINE)
      const staleTimestamp = new Date(now.getTime() - 600 * 1000); // 10 mins ago (OFFLINE)

      db.vehicle.findMany.mockResolvedValue([
        {
          id: 'v1',
          companyId: mockCompanyId,
          vehicleNumber: 'V-001',
          make: 'Toyota',
          model: 'Prius',
          year: 2022,
          color: 'White',
          status: 'ACTIVE',
          location: {
            id: 'l1',
            companyId: mockCompanyId,
            vehicleId: 'v1',
            driverId: null,
            latitude: 37.77,
            longitude: -122.41,
            speed: 50,
            heading: 90,
            accuracy: null,
            altitude: null,
            ignition: true,
            batteryLevel: null,
            odometer: null,
            engineTemperature: null,
            fuelLevel: null,
            signalStrength: null,
            source: 'API',
            timestamp: recentTimestamp,
            createdAt: recentTimestamp,
            updatedAt: recentTimestamp,
          },
          driverAssignments: [],
          trips: [],
        },
        {
          id: 'v2',
          companyId: mockCompanyId,
          vehicleNumber: 'V-002',
          make: 'Ford',
          model: 'Transit',
          year: 2021,
          color: 'Blue',
          status: 'ACTIVE',
          location: {
            id: 'l2',
            companyId: mockCompanyId,
            vehicleId: 'v2',
            driverId: null,
            latitude: 37.78,
            longitude: -122.42,
            speed: 0,
            heading: 0,
            accuracy: null,
            altitude: null,
            ignition: false,
            batteryLevel: null,
            odometer: null,
            engineTemperature: null,
            fuelLevel: null,
            signalStrength: null,
            source: 'API',
            timestamp: staleTimestamp, // stale > 300s -> OFFLINE
            createdAt: staleTimestamp,
            updatedAt: staleTimestamp,
          },
          driverAssignments: [],
          trips: [],
        },
      ]);

      const snapshot = await service.getFleetSnapshot(mockCompanyId);

      expect(snapshot.totalVehicles).toBe(2);
      expect(snapshot.onlineCount).toBe(1);
      expect(snapshot.offlineCount).toBe(1);
      expect(snapshot.vehicles[0].isOnline).toBe(true);
      expect(snapshot.vehicles[0].fleetStatus).toBe('ACTIVE');
      expect(snapshot.vehicles[1].isOnline).toBe(false);
      expect(snapshot.vehicles[1].fleetStatus).toBe('OFFLINE');
    });
  });

  describe('getTelemetryHistory', () => {
    it('should throw NotFoundException if vehicle does not exist in company', async () => {
      db.vehicle.findFirst.mockResolvedValue(null);

      await expect(
        service.getTelemetryHistory(mockCompanyId, 'non-existent', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce pagination and bounded limits', async () => {
      db.vehicle.findFirst.mockResolvedValue({ id: mockVehicleId });
      db.vehicleTelemetry.findMany.mockResolvedValue([
        {
          id: 'tel-1',
          companyId: mockCompanyId,
          vehicleId: mockVehicleId,
          driverId: null,
          latitude: 37.77,
          longitude: -122.41,
          speed: 40,
          heading: 100,
          accuracy: null,
          altitude: null,
          ignition: true,
          batteryLevel: null,
          odometer: null,
          engineTemperature: null,
          fuelLevel: null,
          signalStrength: null,
          source: 'API',
          timestamp: new Date(),
          createdAt: new Date(),
        },
      ]);
      db.vehicleTelemetry.count.mockResolvedValue(1);

      const result = await service.getTelemetryHistory(mockCompanyId, mockVehicleId, {
        page: 1,
        limit: 100,
      });

      expect(result.total).toBe(1);
      expect(result.telemetry).toHaveLength(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(100);
    });
  });
});
