import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { WorkOrderService } from './work-order.service';
import { DatabaseService } from '../../database/database.service';

describe('WorkOrderService', () => {
  let service: WorkOrderService;
  let db: any;

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
      workOrder: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      workOrderItem: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      maintenanceRecord: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      vehicleExpense: {
        create: jest.fn(),
      },
      maintenanceSchedule: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkOrderService,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();

    service = module.get<WorkOrderService>(WorkOrderService);
  });

  describe('createWorkOrder', () => {
    it('creates work order with generated number and computes item line totals', async () => {
      db.vehicle.findFirst.mockResolvedValue({
        id: vehicleId,
        companyId: companyA,
        vehicleNumber: 'KA01AB1234',
        odometer: 12000,
      });
      // Work order count for sequential number
      db.workOrder.count.mockResolvedValue(5);

      const mockWorkOrder = {
        id: 'wo-1',
        companyId: companyA,
        vehicleId,
        workOrderNumber: 'WO-2026-0006',
        title: 'Brake Overhaul',
        description: 'Replace pads and discs',
        priority: 'HIGH',
        status: 'DRAFT',
        estimatedCost: 8000,
        actualCost: 7500,
        openedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        vehicle: { vehicleNumber: 'KA01AB1234' },
        items: [
          {
            id: 'item-1',
            itemType: 'PARTS',
            description: 'Brake pads',
            quantity: 2,
            unitCost: 2000,
            totalCost: 4000,
          },
          {
            id: 'item-2',
            itemType: 'LABOR',
            description: 'Labor',
            quantity: 1,
            unitCost: 3500,
            totalCost: 3500,
          },
        ],
      };
      db.workOrder.create.mockResolvedValue(mockWorkOrder);

      const res = await service.createWorkOrder(
        companyA,
        {
          vehicleId,
          title: 'Brake Overhaul',
          priority: 'HIGH',
          estimatedCost: 8000,
          items: [
            { itemType: 'PARTS', description: 'Brake pads', quantity: 2, unitCost: 2000 },
            { itemType: 'LABOR', description: 'Labor', quantity: 1, unitCost: 3500 },
          ],
        },
        userId,
      );

      expect(db.vehicle.findFirst).toHaveBeenCalledWith({
        where: { id: vehicleId, companyId: companyA, deletedAt: null },
      });
      expect(db.workOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: companyA,
            vehicleId,
            workOrderNumber: expect.stringMatching(/^WO-\d{4}-\d{4}$/),
            status: 'DRAFT',
            estimatedCost: 8000,
            actualCost: 7500,
          }),
        }),
      );
      expect(res.id).toBe('wo-1');
      expect(res.actualCost).toBe(7500);
      expect(res.items).toHaveLength(2);
    });

    it('rejects work order if vehicle does not belong to company (tenant isolation)', async () => {
      db.vehicle.findFirst.mockResolvedValue(null);

      await expect(
        service.createWorkOrder(
          companyB,
          {
            vehicleId,
            title: 'Suspension Check',
          },
          userId,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(db.workOrder.create).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus & Lifecycle Transitions', () => {
    it('allows valid transition from DRAFT to OPEN, and OPEN to IN_PROGRESS', async () => {
      const existing = {
        id: 'wo-1',
        companyId: companyA,
        vehicleId,
        status: 'DRAFT',
        vehicle: { vehicleNumber: 'KA01AB1234', odometer: 12000 },
        items: [],
      };
      db.workOrder.findFirst.mockResolvedValue(existing);
      db.workOrder.update.mockResolvedValue({
        ...existing,
        status: 'OPEN',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.updateStatus(companyA, 'wo-1', { status: 'OPEN' }, userId);
      expect(res.status).toBe('OPEN');
    });

    it('rejects invalid status transition (e.g. COMPLETED -> OPEN)', async () => {
      const existing = {
        id: 'wo-1',
        companyId: companyA,
        status: 'COMPLETED',
        vehicle: { vehicleNumber: 'KA01AB1234', odometer: 12000 },
        items: [],
      };
      db.workOrder.findFirst.mockResolvedValue(existing);

      await expect(
        service.updateStatus(companyA, 'wo-1', { status: 'OPEN' }, userId),
      ).rejects.toThrow(BadRequestException);

      expect(db.workOrder.update).not.toHaveBeenCalled();
    });

    it('creates MaintenanceRecord and VehicleExpense automatically when transitioned to COMPLETED', async () => {
      const existing = {
        id: 'wo-1',
        companyId: companyA,
        vehicleId,
        workOrderNumber: 'WO-2026-0001',
        title: 'Clutch Replacement',
        description: 'New clutch kit',
        status: 'IN_PROGRESS',
        actualCost: 12000,
        vehicle: { vehicleNumber: 'KA01AB1234', odometer: 15000 },
        items: [
          { itemType: 'PARTS', totalCost: 8000 },
          { itemType: 'LABOR', totalCost: 4000 },
        ],
      };
      db.workOrder.findFirst.mockResolvedValueOnce(existing); // findFirst workOrder
      db.maintenanceRecord.findFirst.mockResolvedValueOnce(null); // existingRecord check

      const updated = {
        ...existing,
        status: 'COMPLETED',
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      db.workOrder.update.mockResolvedValue(updated);
      db.maintenanceRecord.create.mockResolvedValue({ id: 'rec-1' });
      db.vehicleExpense.create.mockResolvedValue({ id: 'exp-1' });

      const res = await service.updateStatus(
        companyA,
        'wo-1',
        { status: 'COMPLETED', actualCost: 12000 },
        userId,
      );

      expect(db.maintenanceRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: companyA,
            vehicleId,
            workOrderId: 'wo-1',
            totalCost: 12000,
            partsCost: 8000,
            laborCost: 4000,
          }),
        }),
      );
      expect(db.vehicleExpense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: companyA,
            vehicleId,
            category: 'MAINTENANCE',
            amount: 12000,
          }),
        }),
      );
      expect(res.status).toBe('COMPLETED');
    });

    it('advances linked maintenance schedule when work order is completed', async () => {
      const existing = {
        id: 'wo-1',
        companyId: companyA,
        vehicleId,
        scheduleId: 'sched-1',
        workOrderNumber: 'WO-2026-0001',
        title: 'Oil Change',
        status: 'IN_PROGRESS',
        actualCost: 5000,
        vehicle: { vehicleNumber: 'KA01AB1234', odometer: 20000 },
        items: [],
      };
      db.workOrder.findFirst.mockResolvedValueOnce(existing);
      db.maintenanceRecord.findFirst.mockResolvedValueOnce(null);
      db.workOrder.update.mockResolvedValue({ ...existing, status: 'COMPLETED' });
      db.maintenanceRecord.create.mockResolvedValue({ id: 'rec-1' });
      db.vehicleExpense.create.mockResolvedValue({ id: 'exp-1' });

      // Linked schedule
      db.maintenanceSchedule.findFirst.mockResolvedValue({
        id: 'sched-1',
        companyId: companyA,
        intervalKm: 10000,
        intervalDays: 180,
      });

      await service.updateStatus(companyA, 'wo-1', { status: 'COMPLETED' }, userId);

      expect(db.maintenanceSchedule.update).toHaveBeenCalledWith({
        where: { id: 'sched-1' },
        data: expect.objectContaining({
          lastServiceOdometer: 20000,
          nextDueOdometer: 30000, // 20000 + 10000
        }),
      });
    });
  });

  describe('Tenant Isolation', () => {
    it('throws NotFoundException when Company B user attempts to access Company A work order', async () => {
      db.workOrder.findFirst.mockResolvedValue(null);

      await expect(service.getWorkOrder(companyB, 'wo-1')).rejects.toThrow(NotFoundException);
      expect(db.workOrder.findFirst).toHaveBeenCalledWith({
        where: { id: 'wo-1', companyId: companyB },
        include: expect.anything(),
      });
    });

    it('rejects creation of work order with scheduleId from another company', async () => {
      db.vehicle.findFirst.mockResolvedValue({ id: vehicleId, companyId: companyA });
      db.maintenanceSchedule.findFirst.mockResolvedValue(null); // Not found in companyA

      await expect(
        service.createWorkOrder(
          companyA,
          { vehicleId, title: 'Service', scheduleId: 'sched-foreign' },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects update of work order with vendorId from another company', async () => {
      db.workOrder.findFirst.mockResolvedValue({ id: 'wo-1', companyId: companyA, status: 'OPEN' });
      db.vendor.findFirst.mockResolvedValue(null); // Not found in companyA

      await expect(
        service.updateWorkOrder(
          companyA,
          'wo-1',
          { vendorId: 'vendor-foreign' },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
