import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ExpenseService } from './expense.service';
import { DatabaseService } from '../../database/database.service';

describe('ExpenseService', () => {
  let service: ExpenseService;
  let db: any;

  const companyA = '11111111-1111-1111-1111-111111111111';
  const companyB = '22222222-2222-2222-2222-222222222222';
  const vehicleId = 'veh-123';
  const userId = 'user-123';

  beforeEach(async () => {
    db = {
      vehicle: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      driver: {
        findFirst: jest.fn(),
      },
      trip: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      vendor: {
        findFirst: jest.fn(),
      },
      fuelTransaction: {
        findFirst: jest.fn(),
      },
      maintenanceRecord: {
        findFirst: jest.fn(),
      },
      vehicleExpense: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseService,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();

    service = module.get<ExpenseService>(ExpenseService);
  });

  describe('createExpense', () => {
    it('creates expense record successfully scoped to tenant', async () => {
      db.vehicle.findFirst.mockResolvedValue({ id: vehicleId, companyId: companyA, vehicleNumber: 'KA01AB1234' });

      const mockExp = {
        id: 'exp-1',
        companyId: companyA,
        vehicleId,
        category: 'INSURANCE',
        amount: 25000,
        date: new Date(),
        reference: 'INS-2026',
        description: 'Annual commercial vehicle insurance',
        source: 'MANUAL',
        createdAt: new Date(),
        updatedAt: new Date(),
        vehicle: { vehicleNumber: 'KA01AB1234' },
      };
      db.vehicleExpense.create.mockResolvedValue(mockExp);

      const res = await service.createExpense(
        companyA,
        {
          vehicleId,
          category: 'INSURANCE',
          amount: 25000,
          reference: 'INS-2026',
        },
        userId,
      );

      expect(db.vehicle.findFirst).toHaveBeenCalledWith({
        where: { id: vehicleId, companyId: companyA, deletedAt: null },
      });
      expect(db.vehicleExpense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: companyA,
            vehicleId,
            category: 'INSURANCE',
            amount: 25000,
          }),
        }),
      );
      expect(res.id).toBe('exp-1');
      expect(res.amount).toBe(25000);
    });

    it('rejects expense if vehicle does not belong to company (tenant isolation)', async () => {
      db.vehicle.findFirst.mockResolvedValue(null);

      await expect(
        service.createExpense(
          companyB,
          {
            vehicleId,
            category: 'TOLL',
            amount: 500,
          },
          userId,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(db.vehicleExpense.create).not.toHaveBeenCalled();
    });
  });

  describe('TCO & Operating Cost Calculations (getCostSummary)', () => {
    it('computes total operating cost and cost per km safely', async () => {
      // 4 expense categories
      db.vehicleExpense.findMany.mockResolvedValue([
        { vehicleId, category: 'FUEL', amount: 5000 },
        { vehicleId, category: 'MAINTENANCE', amount: 3000 },
        { vehicleId, category: 'REPAIR', amount: 2000 },
        { vehicleId, category: 'INSURANCE', amount: 1000 },
      ]);
      // Completed trip distance
      db.trip.findMany.mockResolvedValue([
        { distanceKm: 600 },
        { distanceKm: 400 },
      ]);

      const summary = await service.getCostSummary(companyA, {});

      expect(summary.fuelCost).toBe(5000);
      expect(summary.maintenanceCost).toBe(3000);
      expect(summary.repairCost).toBe(2000);
      expect(summary.otherCost).toBe(1000);
      // Total operating cost = 5000 + 3000 + 2000 + 1000 = 11000
      expect(summary.totalOperatingCost).toBe(11000);
      expect(summary.totalDistanceKm).toBe(1000);
      // Cost per km = 11000 / 1000 = 11.0
      expect(summary.costPerKm).toBe(11);
      expect(summary.vehicleCount).toBe(1);
    });

    it('safely handles zero distance without division by zero', async () => {
      db.vehicleExpense.findMany.mockResolvedValue([
        { vehicleId, category: 'FUEL', amount: 3000 },
      ]);
      db.trip.findMany.mockResolvedValue([]);
      db.vehicle.findMany.mockResolvedValue([{ odometer: 0 }]);

      const summary = await service.getCostSummary(companyA, {});

      expect(summary.totalOperatingCost).toBe(3000);
      expect(summary.totalDistanceKm).toBe(0);
      expect(summary.costPerKm).toBe(0);
    });
  });

  describe('Category Costs & Trends', () => {
    it('calculates category percentage share accurately', async () => {
      db.vehicleExpense.findMany.mockResolvedValue([
        { category: 'FUEL', amount: 6000 },
        { category: 'MAINTENANCE', amount: 4000 },
      ]);

      const categories = await service.getCategoryCosts(companyA, {});

      expect(categories).toHaveLength(2);
      expect(categories[0].category).toBe('FUEL');
      expect(categories[0].totalAmount).toBe(6000);
      expect(categories[0].percentage).toBe(60);

      expect(categories[1].category).toBe('MAINTENANCE');
      expect(categories[1].totalAmount).toBe(4000);
      expect(categories[1].percentage).toBe(40);
    });

    it('aggregates monthly cost trends chronologically', async () => {
      db.vehicleExpense.findMany.mockResolvedValue([
        { date: new Date('2026-08-10'), category: 'FUEL', amount: 2000 },
        { date: new Date('2026-09-15'), category: 'MAINTENANCE', amount: 3000 },
      ]);

      const trends = await service.getCostTrends(companyA, {});

      expect(trends).toHaveLength(2);
      expect(trends[0].period).toBe('2026-08');
      expect(trends[0].totalCost).toBe(2000);
      expect(trends[1].period).toBe('2026-09');
      expect(trends[1].totalCost).toBe(3000);
    });
  });

  describe('Tenant Isolation', () => {
    it('throws NotFoundException when Company B user attempts to access Company A expense', async () => {
      db.vehicleExpense.findFirst.mockResolvedValue(null);
      await expect(service.getExpense(companyB, 'exp-1')).rejects.toThrow(NotFoundException);
      expect(db.vehicleExpense.findFirst).toHaveBeenCalledWith({
        where: { id: 'exp-1', companyId: companyB },
        include: expect.anything(),
      });
    });

    it('rejects creation of expense with fuelTransactionId from another company', async () => {
      db.vehicle.findFirst.mockResolvedValue({ id: vehicleId, companyId: companyA });
      db.fuelTransaction.findFirst.mockResolvedValue(null); // Not found in companyA

      await expect(
        service.createExpense(
          companyA,
          {
            vehicleId,
            category: 'FUEL',
            amount: 500,
            fuelTransactionId: 'fuel-tx-foreign',
          },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects creation of expense with maintenanceRecordId from another company', async () => {
      db.vehicle.findFirst.mockResolvedValue({ id: vehicleId, companyId: companyA });
      db.maintenanceRecord.findFirst.mockResolvedValue(null); // Not found in companyA

      await expect(
        service.createExpense(
          companyA,
          {
            vehicleId,
            category: 'MAINTENANCE',
            amount: 1500,
            maintenanceRecordId: 'maint-rec-foreign',
          },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
