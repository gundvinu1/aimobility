import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FuelService } from './fuel.service';
import { DatabaseService } from '../../database/database.service';

describe('FuelService', () => {
  let service: FuelService;
  let db: any;

  const companyA = '11111111-1111-1111-1111-111111111111';
  const companyB = '22222222-2222-2222-2222-222222222222';
  const userId = 'user-123';
  const vehicleId = 'veh-123';

  beforeEach(async () => {
    db = {
      vehicle: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      driver: {
        findFirst: jest.fn(),
      },
      trip: {
        findFirst: jest.fn(),
      },
      vendor: {
        findFirst: jest.fn(),
      },
      fuelTransaction: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      vehicleExpense: {
        create: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FuelService,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();

    service = module.get<FuelService>(FuelService);
  });

  describe('createTransaction', () => {
    it('creates a fuel transaction with valid calculations and updates vehicle odometer', async () => {
      db.vehicle.findFirst.mockResolvedValue({
        id: vehicleId,
        companyId: companyA,
        vehicleNumber: 'KA01AB1234',
        odometer: 9500,
      });

      // Previous transaction at odometer 9500
      db.fuelTransaction.findFirst.mockResolvedValue({
        id: 'tx-prev',
        odometer: 9500,
        fuelLevelAfter: 10,
      });

      const mockCreated = {
        id: 'tx-new',
        companyId: companyA,
        vehicleId,
        quantityLiters: 50,
        pricePerLiter: 100,
        totalAmount: 5000,
        odometer: 10000,
        distanceKm: 500,
        kmPerLiter: 10,
        litersPer100Km: 10,
        costPerKm: 10,
        source: 'MANUAL',
        transactionDate: new Date('2026-10-08T10:00:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
        vehicle: { vehicleNumber: 'KA01AB1234' },
      };
      db.fuelTransaction.create.mockResolvedValue(mockCreated);
      db.vehicleExpense.create.mockResolvedValue({ id: 'exp-new' });

      const result = await service.createFuelTransaction(
        companyA,
        {
          vehicleId,
          quantityLiters: 50,
          pricePerLiter: 100,
          odometer: 10000,
          fuelType: 'DIESEL',
        },
        userId,
      );

      expect(db.vehicle.findFirst).toHaveBeenCalledWith({
        where: { id: vehicleId, companyId: companyA, deletedAt: null },
      });
      expect(db.fuelTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: companyA,
            vehicleId,
            quantityLiters: 50,
            pricePerLiter: 100,
            totalAmount: 5000,
          }),
        }),
      );
      // Vehicle odometer updated
      expect(db.vehicle.update).toHaveBeenCalledWith({
        where: { id: vehicleId },
        data: { odometer: 10000 },
      });
      // Linked vehicle expense created
      expect(db.vehicleExpense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: companyA,
            vehicleId,
            category: 'FUEL',
            amount: 5000,
          }),
        }),
      );
      expect(result.id).toBe('tx-new');
    });

    it('rejects transaction when vehicle does not belong to company (tenant isolation)', async () => {
      // Vehicle not found in Company B
      db.vehicle.findFirst.mockResolvedValue(null);

      await expect(
        service.createFuelTransaction(
          companyB,
          {
            vehicleId,
            quantityLiters: 40,
            pricePerLiter: 90,
          },
          userId,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(db.fuelTransaction.create).not.toHaveBeenCalled();
    });

    it('rejects non-positive fuel quantity or price', async () => {
      db.vehicle.findFirst.mockResolvedValue({ id: vehicleId, companyId: companyA });

      await expect(
        service.createFuelTransaction(
          companyA,
          {
            vehicleId,
            quantityLiters: -10,
            pricePerLiter: 90,
          },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getFuelTransaction & Tenant Isolation', () => {
    it('returns transaction when owned by company', async () => {
      db.fuelTransaction.findFirst.mockResolvedValue({
        id: 'tx-1',
        companyId: companyA,
        vehicleId,
        quantityLiters: 40,
        pricePerLiter: 95,
        totalAmount: 3800,
        transactionDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.getFuelTransaction(companyA, 'tx-1');
      expect(res.id).toBe('tx-1');
    });

    it('throws NotFoundException when Company B user attempts to access Company A transaction', async () => {
      db.fuelTransaction.findFirst.mockResolvedValue(null);

      await expect(service.getFuelTransaction(companyB, 'tx-1')).rejects.toThrow(NotFoundException);
      expect(db.fuelTransaction.findFirst).toHaveBeenCalledWith({
        where: { id: 'tx-1', companyId: companyB },
        include: expect.anything(),
      });
    });
  });

  describe('getFuelAnalytics', () => {
    it('calculates aggregate metrics safely without division by zero', async () => {
      db.fuelTransaction.findMany.mockResolvedValue([
        {
          vehicleId,
          quantityLiters: 50,
          totalAmount: 5000,
          pricePerLiter: 100,
          odometer: 1000,
        },
        {
          vehicleId,
          quantityLiters: 40,
          totalAmount: 4000,
          pricePerLiter: 100,
          odometer: 1900,
        },
      ]);

      const analytics = await service.getFuelAnalytics(companyA, {});

      expect(analytics.totalFuelConsumed).toBe(90);
      expect(analytics.totalFuelCost).toBe(9000);
      expect(analytics.avgPricePerLiter).toBe(100);
      expect(analytics.avgKmPerLiter).toBe(10);
      expect(analytics.avgLitersPer100Km).toBe(10);
      expect(analytics.totalDistanceKm).toBe(900);
      expect(analytics.transactionCount).toBe(2);
    });

    it('handles empty transactions safely returning zero metrics', async () => {
      db.fuelTransaction.findMany.mockResolvedValue([]);

      const analytics = await service.getFuelAnalytics(companyA, {});

      expect(analytics.totalFuelConsumed).toBe(0);
      expect(analytics.totalFuelCost).toBe(0);
      expect(analytics.avgKmPerLiter).toBe(0);
      expect(analytics.transactionCount).toBe(0);
    });
  });
});
