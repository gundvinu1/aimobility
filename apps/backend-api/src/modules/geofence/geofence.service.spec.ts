import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GeofenceService } from './geofence.service';
import { DatabaseService } from '../database/database.service';

describe('GeofenceService', () => {
  let service: GeofenceService;
  let db: any;

  const mockCompanyId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '99999999-9999-9999-9999-999999999999';
  const mockGeofenceId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const mockVehicleId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    db = {
      geofence: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      geofenceVehicle: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      vehicle: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeofenceService,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();

    service = module.get<GeofenceService>(GeofenceService);
  });

  describe('createGeofence', () => {
    it('creates a circular geofence with valid geometry', async () => {
      const dto = {
        name: 'Warehouse Zone',
        type: 'CIRCLE' as const,
        geometry: {
          center: { latitude: 37.7749, longitude: -122.4194 },
          radiusMeters: 500,
        },
      };

      db.geofence.create.mockResolvedValue({
        id: mockGeofenceId,
        companyId: mockCompanyId,
        name: dto.name,
        description: null,
        type: 'CIRCLE',
        geometry: dto.geometry,
        color: '#3b82f6',
        isActive: true,
        entryAlertEnabled: true,
        exitAlertEnabled: true,
        createdBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { assignedVehicles: 0 },
      });

      const result = await service.createGeofence(mockCompanyId, dto, mockUserId);

      expect(result.id).toBe(mockGeofenceId);
      expect(result.name).toBe('Warehouse Zone');
      expect(db.geofence.create).toHaveBeenCalled();
      expect(db.auditLog.create).toHaveBeenCalled();
    });

    it('rejects creation with invalid geometry', async () => {
      const dto = {
        name: 'Invalid Zone',
        type: 'CIRCLE' as const,
        geometry: {
          center: { latitude: 120, longitude: 0 }, // invalid lat
          radiusMeters: 500,
        },
      };

      await expect(
        service.createGeofence(mockCompanyId, dto, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects creation if vehicle IDs do not belong to the company', async () => {
      const dto = {
        name: 'Zone',
        type: 'CIRCLE' as const,
        geometry: {
          center: { latitude: 37.7749, longitude: -122.4194 },
          radiusMeters: 500,
        },
        vehicleIds: [mockVehicleId, 'other-vehicle-id'],
      };

      db.vehicle.count.mockResolvedValue(1); // Only 1 belongs to tenant, but 2 requested

      await expect(
        service.createGeofence(mockCompanyId, dto, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateGeofence', () => {
    it('updates geofence successfully', async () => {
      db.geofence.findFirst.mockResolvedValue({
        id: mockGeofenceId,
        companyId: mockCompanyId,
        type: 'CIRCLE',
        _count: { assignedVehicles: 1 },
      });

      db.geofence.update.mockResolvedValue({
        id: mockGeofenceId,
        companyId: mockCompanyId,
        name: 'Updated Name',
        description: 'New desc',
        type: 'CIRCLE',
        geometry: { center: { latitude: 37.7749, longitude: -122.4194 }, radiusMeters: 600 },
        color: '#ef4444',
        isActive: true,
        entryAlertEnabled: true,
        exitAlertEnabled: true,
        createdBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { assignedVehicles: 1 },
      });

      const result = await service.updateGeofence(
        mockCompanyId,
        mockGeofenceId,
        { name: 'Updated Name', color: '#ef4444' },
        mockUserId,
      );

      expect(result.name).toBe('Updated Name');
      expect(result.color).toBe('#ef4444');
      expect(db.auditLog.create).toHaveBeenCalled();
    });

    it('throws NotFoundException if geofence does not belong to tenant', async () => {
      db.geofence.findFirst.mockResolvedValue(null);

      await expect(
        service.updateGeofence(mockCompanyId, 'non-existent', { name: 'Test' }, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteGeofence', () => {
    it('deletes geofence and logs audit', async () => {
      db.geofence.findFirst.mockResolvedValue({
        id: mockGeofenceId,
        companyId: mockCompanyId,
        name: 'Delete Me',
      });
      db.geofence.delete.mockResolvedValue({});

      const result = await service.deleteGeofence(mockCompanyId, mockGeofenceId, mockUserId);
      expect(result.success).toBe(true);
      expect(db.geofence.delete).toHaveBeenCalledWith({ where: { id: mockGeofenceId } });
      expect(db.auditLog.create).toHaveBeenCalled();
    });

    it('throws NotFoundException on cross-tenant delete attempt', async () => {
      db.geofence.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteGeofence(mockCompanyId, 'other-tenant-id', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignVehicles', () => {
    it('assigns vehicles to geofence successfully', async () => {
      db.geofence.findFirst.mockResolvedValue({ id: mockGeofenceId, companyId: mockCompanyId });
      db.vehicle.findMany.mockResolvedValue([
        { id: mockVehicleId, vehicleNumber: 'MH12AB1234', make: 'Toyota', model: 'Innova' },
      ]);
      db.geofenceVehicle.deleteMany.mockResolvedValue({ count: 0 });
      db.geofenceVehicle.createMany.mockResolvedValue({ count: 1 });
      db.geofenceVehicle.findMany.mockResolvedValue([
        {
          id: 'assign-1',
          companyId: mockCompanyId,
          geofenceId: mockGeofenceId,
          vehicleId: mockVehicleId,
          assignedAt: new Date(),
          vehicle: { vehicleNumber: 'MH12AB1234', make: 'Toyota', model: 'Innova' },
        },
      ]);

      const result = await service.assignVehicles(
        mockCompanyId,
        mockGeofenceId,
        [mockVehicleId],
        mockUserId,
      );

      expect(result).toHaveLength(1);
      expect(result[0].vehicleNumber).toBe('MH12AB1234');
      expect(db.auditLog.create).toHaveBeenCalled();
    });

    it('rejects vehicle assignment if vehicle belongs to another company', async () => {
      db.geofence.findFirst.mockResolvedValue({ id: mockGeofenceId, companyId: mockCompanyId });
      db.vehicle.findMany.mockResolvedValue([]); // Vehicle not found in tenant

      await expect(
        service.assignVehicles(mockCompanyId, mockGeofenceId, [mockVehicleId], mockUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getActiveGeofencesForVehicle', () => {
    it('returns assigned and company-wide geofences', async () => {
      // 1. Assigned specifically
      db.geofence.findMany.mockResolvedValueOnce([
        {
          id: 'geo-1',
          name: 'Airport Zone',
          type: 'CIRCLE',
          geometry: { center: { latitude: 10, longitude: 10 }, radiusMeters: 500 },
          entryAlertEnabled: true,
          exitAlertEnabled: true,
        },
      ]);

      // 2. Company-wide (none assigned)
      db.geofence.findMany.mockResolvedValueOnce([
        {
          id: 'geo-2',
          name: 'City Limits',
          type: 'POLYGON',
          geometry: {
            coordinates: [
              { latitude: 0, longitude: 0 },
              { latitude: 20, longitude: 0 },
              { latitude: 20, longitude: 20 },
            ],
          },
          entryAlertEnabled: true,
          exitAlertEnabled: false,
        },
      ]);

      const result = await service.getActiveGeofencesForVehicle(mockCompanyId, mockVehicleId);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Airport Zone');
      expect(result[1].name).toBe('City Limits');
    });
  });
});
