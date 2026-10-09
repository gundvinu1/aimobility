jest.mock('@nestjs/jwt', () => ({
  JwtService: class {
    verify = jest.fn();
    sign = jest.fn();
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { DatabaseService } from '../../database/database.service';
import { CacheService } from '../../cache/cache.service';
import { AlertService } from '../../alert/alert.service';

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let db: any;
  let cache: any;
  let alertService: any;

  const companyA = '11111111-1111-1111-1111-111111111111';
  const companyB = '22222222-2222-2222-2222-222222222222';
  const vehicleId = 'veh-123';
  const userId = 'user-123';

  beforeEach(async () => {
    db = {
      vehicle: {
        findFirst: jest.fn(),
      },
      vendor: {
        findFirst: jest.fn(),
      },
      maintenanceSchedule: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      maintenanceRecord: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      vehicleExpense: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      workOrder: {
        findFirst: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    alertService = {
      getCompanyConfig: jest.fn().mockResolvedValue({ maintenanceAlertsEnabled: true }),
      createAlert: jest.fn().mockResolvedValue({ id: 'alert-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        { provide: DatabaseService, useValue: db },
        { provide: CacheService, useValue: cache },
        { provide: AlertService, useValue: alertService },
      ],
    }).compile();

    service = module.get<MaintenanceService>(MaintenanceService);
  });

  describe('createSchedule', () => {
    it('creates schedule with calculated next due targets for mileage and days', async () => {
      db.vehicle.findFirst.mockResolvedValue({
        id: vehicleId,
        companyId: companyA,
        vehicleNumber: 'KA01AB1234',
        odometer: 10000,
      });

      const mockSchedule = {
        id: 'sched-1',
        companyId: companyA,
        vehicleId,
        serviceType: 'Engine Oil',
        intervalKm: 10000,
        intervalDays: 180,
        lastServiceOdometer: 10000,
        lastServiceDate: new Date('2026-01-01'),
        nextDueOdometer: 20000,
        nextDueDate: new Date('2026-06-30'),
        isActive: true,
        vehicle: { vehicleNumber: 'KA01AB1234', odometer: 10000 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      db.maintenanceSchedule.create.mockResolvedValue(mockSchedule);

      const res = await service.createSchedule(
        companyA,
        {
          vehicleId,
          serviceType: 'Engine Oil',
          intervalKm: 10000,
          intervalDays: 180,
          lastServiceOdometer: 10000,
          lastServiceDate: '2026-01-01',
        },
        userId,
      );

      expect(db.vehicle.findFirst).toHaveBeenCalledWith({
        where: { id: vehicleId, companyId: companyA, deletedAt: null },
      });
      expect(db.maintenanceSchedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: companyA,
            vehicleId,
            serviceType: 'Engine Oil',
            intervalKm: 10000,
            intervalDays: 180,
          }),
        }),
      );
      expect(res.id).toBe('sched-1');
      expect(res.dueStatus).toBeDefined();
    });

    it('rejects schedule creation if vehicle belongs to another company (tenant isolation)', async () => {
      db.vehicle.findFirst.mockResolvedValue(null);

      await expect(
        service.createSchedule(
          companyB,
          {
            vehicleId,
            serviceType: 'Brake Inspection',
          },
          userId,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(db.maintenanceSchedule.create).not.toHaveBeenCalled();
    });
  });

  describe('createRecord', () => {
    it('creates maintenance record, advances schedule targets, and logs vehicle expense', async () => {
      db.vehicle.findFirst.mockResolvedValue({
        id: vehicleId,
        companyId: companyA,
        vehicleNumber: 'KA01AB1234',
        odometer: 15000,
      });

      const sched = {
        id: 'sched-1',
        companyId: companyA,
        intervalKm: 5000,
        intervalDays: 90,
      };
      db.maintenanceSchedule.findFirst.mockResolvedValue(sched);

      const mockRecord = {
        id: 'rec-1',
        companyId: companyA,
        vehicleId,
        scheduleId: 'sched-1',
        serviceType: 'Brake Pad Replacement',
        partsCost: 3000,
        laborCost: 1500,
        tax: 500,
        totalCost: 5000,
        odometer: 15000,
        serviceDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        vehicle: { vehicleNumber: 'KA01AB1234' },
      };
      db.maintenanceRecord.create.mockResolvedValue(mockRecord);
      db.maintenanceSchedule.update.mockResolvedValue({});
      db.vehicleExpense.create.mockResolvedValue({ id: 'exp-1' });

      const res = await service.createRecord(
        companyA,
        {
          vehicleId,
          scheduleId: 'sched-1',
          serviceType: 'Brake Pad Replacement',
          partsCost: 3000,
          laborCost: 1500,
          tax: 500,
          odometer: 15000,
        },
        userId,
      );

      // Advances schedule next due targets
      expect(db.maintenanceSchedule.update).toHaveBeenCalledWith({
        where: { id: 'sched-1' },
        data: expect.objectContaining({
          lastServiceOdometer: 15000,
          nextDueOdometer: 20000, // 15000 + 5000
        }),
      });

      // Automatically links vehicle expense
      expect(db.vehicleExpense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: companyA,
            vehicleId,
            category: 'MAINTENANCE',
            amount: 5000,
            maintenanceRecordId: 'rec-1',
          }),
        }),
      );

      expect(res.id).toBe('rec-1');
      expect(res.totalCost).toBe(5000);
    });
  });

  describe('evaluateMaintenanceReminders', () => {
    it('creates MAINTENANCE_DUE alert for overdue schedule and dedupes via Redis', async () => {
      // Overdue schedule: nextDueOdometer 10000, current odometer 11000
      db.maintenanceSchedule.findMany.mockResolvedValue([
        {
          id: 'sched-overdue',
          companyId: companyA,
          vehicleId,
          serviceType: 'Oil Change',
          nextDueOdometer: 10000,
          nextDueDate: new Date('2026-01-01'), // past date
          isActive: true,
          vehicle: { vehicleNumber: 'KA01AB1234', odometer: 11000 },
        },
      ]);

      const alertsSent = await service.evaluateMaintenanceReminders(companyA);

      expect(alertsSent).toBe(1);
      expect(alertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: companyA,
          vehicleId,
          type: 'MAINTENANCE_DUE',
          severity: 'HIGH',
          title: expect.stringContaining('Maintenance Overdue'),
        }),
      );
      // Redis lock was placed
      expect(cache.set).toHaveBeenCalled();
    });

    it('skips alert if Redis deduplication key already exists', async () => {
      cache.get.mockResolvedValue('1'); // Already locked

      db.maintenanceSchedule.findMany.mockResolvedValue([
        {
          id: 'sched-overdue',
          companyId: companyA,
          serviceType: 'Oil Change',
          nextDueOdometer: 10000,
          nextDueDate: new Date('2026-01-01'),
          isActive: true,
          vehicle: { vehicleNumber: 'KA01AB1234', odometer: 11000 },
        },
      ]);

      const alertsSent = await service.evaluateMaintenanceReminders(companyA);
      expect(alertsSent).toBe(0);
      expect(alertService.createAlert).not.toHaveBeenCalled();
    });
  });

  describe('Tenant Isolation for Schedules and Records', () => {
    it('throws NotFoundException when accessing schedule of another company', async () => {
      db.maintenanceSchedule.findFirst.mockResolvedValue(null);
      await expect(service.getSchedule(companyB, 'sched-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when accessing record of another company', async () => {
      db.maintenanceRecord.findFirst.mockResolvedValue(null);
      await expect(service.getRecord(companyB, 'rec-1')).rejects.toThrow(NotFoundException);
    });

    it('rejects creation of maintenance record with scheduleId from another company', async () => {
      db.vehicle.findFirst.mockResolvedValue({ id: vehicleId, companyId: companyA });
      db.maintenanceSchedule.findFirst.mockResolvedValue(null); // Not found in companyA

      await expect(
        service.createRecord(
          companyA,
          { vehicleId, serviceType: 'Oil Change', scheduleId: 'sched-foreign' },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects creation of maintenance record with workOrderId from another company', async () => {
      db.vehicle.findFirst.mockResolvedValue({ id: vehicleId, companyId: companyA });
      db.workOrder.findFirst.mockResolvedValue(null); // Not found in companyA

      await expect(
        service.createRecord(
          companyA,
          { vehicleId, serviceType: 'Brake Service', workOrderId: 'wo-foreign' },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('links to existing work order vehicle expense without creating duplicate expense', async () => {
      db.vehicle.findFirst.mockResolvedValue({ id: vehicleId, companyId: companyA, odometer: 15000 });
      db.workOrder.findFirst.mockResolvedValue({ id: 'wo-1', companyId: companyA, workOrderNumber: 'WO-2026-0001' });
      db.maintenanceRecord.create.mockResolvedValue({
        id: 'rec-1',
        companyId: companyA,
        vehicleId,
        serviceType: 'Brake Service',
        serviceDate: new Date(),
        totalCost: 5000,
        createdAt: new Date(),
        updatedAt: new Date(),
        vehicle: { vehicleNumber: 'KA01AB1234' },
      });
      // Existing work order expense exists
      db.vehicleExpense.findFirst.mockResolvedValue({ id: 'exp-wo-1', companyId: companyA, amount: 5000 });
      db.vehicleExpense.update.mockResolvedValue({ id: 'exp-wo-1', maintenanceRecordId: 'rec-1' });

      const res = await service.createRecord(
        companyA,
        { vehicleId, serviceType: 'Brake Service', workOrderId: 'wo-1', totalCost: 5000 },
        userId,
      );

      expect(db.vehicleExpense.update).toHaveBeenCalledWith({
        where: { id: 'exp-wo-1' },
        data: { maintenanceRecordId: 'rec-1' },
      });
      expect(db.vehicleExpense.create).not.toHaveBeenCalled();
      expect(res.id).toBe('rec-1');
    });
  });
});
