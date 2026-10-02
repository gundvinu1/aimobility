import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DriverService } from './driver.service';
import { DatabaseService } from '../database/database.service';

const mockCompanyAId = '11111111-1111-1111-1111-111111111111';
const mockCompanyBId = '22222222-2222-2222-2222-222222222222';
const mockUserId = '99999999-9999-9999-9999-999999999999';
const mockOtherUserId = '88888888-8888-8888-8888-888888888888';
const mockDriverId = '33333333-3333-3333-3333-333333333333';
const mockVehicleId = '44444444-4444-4444-4444-444444444444';
const mockEmployeeId = '55555555-5555-5555-5555-555555555555';

describe('DriverService (Tenant Isolation & Business Logic)', () => {
  let service: DriverService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      driver: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      employee: {
        findFirst: jest.fn(),
      },
      vehicle: {
        findFirst: jest.fn(),
      },
      driverDocument: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      driverDutyLog: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      driverVehicleAssignment: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriverService,
        {
          provide: DatabaseService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<DriverService>(DriverService);
  });

  // ─── 1. Create Driver ───────────────────────────────────────────────────────
  describe('createDriver', () => {
    it('should create a driver scoped to company', async () => {
      mockPrisma.driver.findFirst.mockResolvedValueOnce(null); // driverCode check
      mockPrisma.driver.create.mockResolvedValueOnce({
        id: mockDriverId,
        companyId: mockCompanyAId,
        driverCode: 'DRV-101',
        licenseNumber: 'DL-999',
        licenseType: 'COMMERCIAL',
        licenseExpiryDate: new Date('2028-01-01'),
        experienceYears: 4,
        status: 'ACTIVE',
        dutyStatus: 'OFF_DUTY',
        joiningDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createDriver(
        {
          driverCode: 'DRV-101',
          licenseNumber: 'DL-999',
          licenseExpiryDate: '2028-01-01',
        },
        mockCompanyAId,
        mockUserId,
        {},
      );

      expect(result.id).toBe(mockDriverId);
      expect(result.driverCode).toBe('DRV-101');
      expect(mockPrisma.driver.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: mockCompanyAId,
            driverCode: 'DRV-101',
          }),
        }),
      );
    });

    it('should reject duplicate driverCode in same company', async () => {
      mockPrisma.driver.findFirst.mockResolvedValueOnce({ id: 'existing-drv' });

      await expect(
        service.createDriver(
          {
            driverCode: 'DRV-101',
            licenseNumber: 'DL-999',
            licenseExpiryDate: '2028-01-01',
          },
          mockCompanyAId,
          mockUserId,
          {},
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject employee from another company', async () => {
      mockPrisma.driver.findFirst.mockResolvedValueOnce(null); // driverCode check
      mockPrisma.employee.findFirst.mockResolvedValueOnce(null); // cross-company check

      await expect(
        service.createDriver(
          {
            employeeId: mockEmployeeId,
            driverCode: 'DRV-102',
            licenseNumber: 'DL-999',
            licenseExpiryDate: '2028-01-01',
          },
          mockCompanyAId,
          mockUserId,
          {},
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── 2. Tenant Isolation on Get / Update / Delete ───────────────────────────
  describe('Tenant Isolation', () => {
    it('should allow access to Company A driver with Company A context', async () => {
      mockPrisma.driver.findFirst.mockResolvedValueOnce({
        id: mockDriverId,
        companyId: mockCompanyAId,
        driverCode: 'DRV-101',
        licenseNumber: 'DL-999',
        licenseType: 'COMMERCIAL',
        licenseExpiryDate: new Date('2028-01-01'),
        experienceYears: 4,
        status: 'ACTIVE',
        dutyStatus: 'OFF_DUTY',
        joiningDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getDriver(mockDriverId, mockCompanyAId);
      expect(result.id).toBe(mockDriverId);
    });

    it('should reject access to Company A driver when called with Company B context (404)', async () => {
      mockPrisma.driver.findFirst.mockResolvedValueOnce(null); // where: { id, companyId: mockCompanyBId }

      await expect(service.getDriver(mockDriverId, mockCompanyBId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject updating Company A driver from Company B (404)', async () => {
      mockPrisma.driver.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.updateDriver(mockDriverId, { notes: 'Hack' }, mockCompanyBId, mockUserId, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject deleting Company A driver from Company B (404)', async () => {
      mockPrisma.driver.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.deleteDriver(mockDriverId, mockCompanyBId, mockUserId, {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── 3. RBAC & Duty Status ──────────────────────────────────────────────────
  describe('RBAC & Duty Status', () => {
    it('should allow a driver to update their own duty status', async () => {
      mockPrisma.driver.findFirst.mockResolvedValueOnce({
        id: mockDriverId,
        companyId: mockCompanyAId,
        dutyStatus: 'OFF_DUTY',
        employee: { userId: mockUserId },
      });
      mockPrisma.driverDutyLog.findFirst.mockResolvedValueOnce(null);
      mockPrisma.driverDutyLog.create.mockResolvedValueOnce({ id: 'log-1' });
      mockPrisma.driver.update.mockResolvedValueOnce({
        id: mockDriverId,
        companyId: mockCompanyAId,
        driverCode: 'DRV-101',
        licenseNumber: 'DL-999',
        licenseType: 'COMMERCIAL',
        licenseExpiryDate: new Date('2028-01-01'),
        experienceYears: 4,
        status: 'ACTIVE',
        dutyStatus: 'ON_DUTY',
        joiningDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.updateDutyStatus(
        mockDriverId,
        { dutyStatus: 'ON_DUTY' },
        mockCompanyAId,
        mockUserId,
        {},
        'DRIVER',
      );

      expect(result.dutyStatus).toBe('ON_DUTY');
    });

    it('should reject a driver trying to update another driver’s duty status (ForbiddenException)', async () => {
      mockPrisma.driver.findFirst.mockResolvedValueOnce({
        id: mockDriverId,
        companyId: mockCompanyAId,
        dutyStatus: 'OFF_DUTY',
        employee: { userId: mockOtherUserId }, // belongs to someone else
      });

      await expect(
        service.updateDutyStatus(
          mockDriverId,
          { dutyStatus: 'ON_DUTY' },
          mockCompanyAId,
          mockUserId,
          {},
          'DRIVER',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── 4. Vehicle Assignment ──────────────────────────────────────────────────
  describe('Vehicle Assignment', () => {
    it('should assign a vehicle belonging to the same company', async () => {
      mockPrisma.driver.findFirst.mockResolvedValueOnce({
        id: mockDriverId,
        companyId: mockCompanyAId,
      });
      mockPrisma.vehicle.findFirst.mockResolvedValueOnce({
        id: mockVehicleId,
        companyId: mockCompanyAId,
        vehicleNumber: 'KA01AB1234',
      });
      mockPrisma.driverVehicleAssignment.findFirst
        .mockResolvedValueOnce(null) // previous driver assignment
        .mockResolvedValueOnce(null); // previous vehicle assignment
      mockPrisma.driverVehicleAssignment.create.mockResolvedValueOnce({
        id: 'assign-1',
        companyId: mockCompanyAId,
        driverId: mockDriverId,
        vehicleId: mockVehicleId,
        assignedAt: new Date(),
        isActive: true,
        vehicle: {
          id: mockVehicleId,
          vehicleNumber: 'KA01AB1234',
          make: 'Toyota',
          model: 'Innova',
        },
      });

      const res = await service.assignVehicle(
        mockDriverId,
        { vehicleId: mockVehicleId },
        mockCompanyAId,
        mockUserId,
        {},
      );

      expect(res.id).toBe('assign-1');
      expect(res.vehicleId).toBe(mockVehicleId);
      expect(res.isActive).toBe(true);
    });

    it('should reject vehicle assignment if vehicle belongs to another company (404)', async () => {
      mockPrisma.driver.findFirst.mockResolvedValueOnce({
        id: mockDriverId,
        companyId: mockCompanyAId,
      });
      mockPrisma.vehicle.findFirst.mockResolvedValueOnce(null); // Vehicle not found in Company A

      await expect(
        service.assignVehicle(
          mockDriverId,
          { vehicleId: mockVehicleId },
          mockCompanyAId,
          mockUserId,
          {},
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
