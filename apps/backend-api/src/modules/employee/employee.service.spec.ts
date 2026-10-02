import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { DatabaseService } from '../database/database.service';

const mockCompanyAId = '11111111-1111-1111-1111-111111111111';
const mockCompanyBId = '22222222-2222-2222-2222-222222222222';
const mockUserId = '99999999-9999-9999-9999-999999999999';

describe('EmployeeService (Tenant Isolation & CRUD)', () => {
  let service: EmployeeService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      employee: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
      userCompany: {
        findFirst: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeService,
        {
          provide: DatabaseService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<EmployeeService>(EmployeeService);
  });

  describe('createEmployee', () => {
    it('should create an employee scoped to the company and assign auto-generated employee number', async () => {
      mockPrisma.employee.count.mockResolvedValueOnce(0); // For generateEmployeeNumber -> EMP-000001
      mockPrisma.employee.findFirst.mockResolvedValueOnce(null); // Collision check
      mockPrisma.employee.create.mockResolvedValueOnce({
        id: 'emp-1',
        companyId: mockCompanyAId,
        employeeNumber: 'EMP-000001',
        firstName: 'Vikram',
        lastName: 'Patel',
        phone: '+919999988888',
        joiningDate: new Date('2026-02-01'),
        employmentStatus: 'ACTIVE',
        employmentType: 'FULL_TIME',
        department: 'OPERATIONS',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createEmployee(
        {
          firstName: 'Vikram',
          lastName: 'Patel',
          phone: '+919999988888',
          joiningDate: '2026-02-01',
        },
        mockCompanyAId,
        mockUserId,
      );

      expect(result.id).toBe('emp-1');
      expect(result.employeeNumber).toBe('EMP-000001');
      expect(mockPrisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: mockCompanyAId,
            employeeNumber: 'EMP-000001',
          }),
        }),
      );
    });
  });

  describe('getEmployee (Tenant Isolation)', () => {
    it('should return employee if belongs to caller company', async () => {
      mockPrisma.employee.findFirst.mockResolvedValueOnce({
        id: 'emp-1',
        companyId: mockCompanyAId,
        employeeNumber: 'EMP-000001',
        firstName: 'Vikram',
        lastName: 'Patel',
        phone: '+919999988888',
        joiningDate: new Date('2026-02-01'),
        employmentStatus: 'ACTIVE',
        employmentType: 'FULL_TIME',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getEmployee('emp-1', mockCompanyAId);
      expect(result.id).toBe('emp-1');
      expect(mockPrisma.employee.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'emp-1',
          companyId: mockCompanyAId,
          deletedAt: null,
        },
      });
    });

    it('should throw NotFoundException if employee belongs to another company (Tenant Isolation)', async () => {
      // Searching for emp-1 with Company B returns null because DB query scopes by companyId
      mockPrisma.employee.findFirst.mockResolvedValueOnce(null);

      await expect(service.getEmployee('emp-1', mockCompanyBId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateEmployeeStatus', () => {
    it('should update status and audit the transition', async () => {
      mockPrisma.employee.findFirst.mockResolvedValueOnce({
        id: 'emp-1',
        companyId: mockCompanyAId,
        employeeNumber: 'EMP-000001',
        firstName: 'Vikram',
        lastName: 'Patel',
        phone: '+919999988888',
        joiningDate: new Date('2026-02-01'),
        employmentStatus: 'ACTIVE',
        employmentType: 'FULL_TIME',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.employee.update.mockResolvedValueOnce({
        id: 'emp-1',
        companyId: mockCompanyAId,
        employeeNumber: 'EMP-000001',
        firstName: 'Vikram',
        lastName: 'Patel',
        phone: '+919999988888',
        joiningDate: new Date('2026-02-01'),
        employmentStatus: 'ON_LEAVE',
        employmentType: 'FULL_TIME',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.updateEmployeeStatus(
        'emp-1',
        { employmentStatus: 'ON_LEAVE' },
        mockCompanyAId,
        mockUserId,
      );

      expect(result.employmentStatus).toBe('ON_LEAVE');
      expect(mockPrisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: { employmentStatus: 'ON_LEAVE' },
      });
    });

    it('should throw BadRequestException if target status is same as current status', async () => {
      mockPrisma.employee.findFirst.mockResolvedValueOnce({
        id: 'emp-1',
        companyId: mockCompanyAId,
        employeeNumber: 'EMP-000001',
        firstName: 'Vikram',
        lastName: 'Patel',
        phone: '+919999988888',
        joiningDate: new Date('2026-02-01'),
        employmentStatus: 'ACTIVE',
        employmentType: 'FULL_TIME',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.updateEmployeeStatus(
          'emp-1',
          { employmentStatus: 'ACTIVE' },
          mockCompanyAId,
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteEmployee (Soft Delete)', () => {
    it('should soft delete employee by setting deletedAt timestamp', async () => {
      mockPrisma.employee.findFirst.mockResolvedValueOnce({
        id: 'emp-1',
        companyId: mockCompanyAId,
        employeeNumber: 'EMP-000001',
        firstName: 'Vikram',
        lastName: 'Patel',
        phone: '+919999988888',
        joiningDate: new Date('2026-02-01'),
        employmentStatus: 'ACTIVE',
        employmentType: 'FULL_TIME',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.employee.update.mockResolvedValueOnce({
        id: 'emp-1',
        deletedAt: new Date(),
      });

      await service.deleteEmployee('emp-1', mockCompanyAId, mockUserId);

      expect(mockPrisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('linkUser & unlinkUser', () => {
    const mockTargetUserId = '88888888-8888-8888-8888-888888888888';

    it('should link a valid company user to an employee', async () => {
      // 1. Employee exists
      mockPrisma.employee.findFirst.mockResolvedValueOnce({
        id: 'emp-1',
        companyId: mockCompanyAId,
        employeeNumber: 'EMP-000001',
        firstName: 'Vikram',
        lastName: 'Patel',
        phone: '+919999988888',
        joiningDate: new Date('2026-02-01'),
        employmentStatus: 'ACTIVE',
        employmentType: 'FULL_TIME',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      // 2. Target user exists
      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: mockTargetUserId });
      // 3. User is active member of this company
      mockPrisma.userCompany.findFirst.mockResolvedValueOnce({ id: 'membership-1' });
      // 4. No other employee in this company has this user linked
      mockPrisma.employee.findFirst.mockResolvedValueOnce(null);
      // 5. Update
      mockPrisma.employee.update.mockResolvedValueOnce({
        id: 'emp-1',
        companyId: mockCompanyAId,
        employeeNumber: 'EMP-000001',
        userId: mockTargetUserId,
        firstName: 'Vikram',
        lastName: 'Patel',
        phone: '+919999988888',
        joiningDate: new Date('2026-02-01'),
        employmentStatus: 'ACTIVE',
        employmentType: 'FULL_TIME',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.linkUser('emp-1', mockTargetUserId, mockCompanyAId, mockUserId);
      expect(result.userId).toBe(mockTargetUserId);
      expect(mockPrisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: { userId: mockTargetUserId },
      });
    });

    it('should reject linking user if user does not belong to the company', async () => {
      mockPrisma.employee.findFirst.mockResolvedValueOnce({
        id: 'emp-1',
        companyId: mockCompanyAId,
        employeeNumber: 'EMP-000001',
        firstName: 'Vikram',
        lastName: 'Patel',
        phone: '+919999988888',
        joiningDate: new Date('2026-02-01'),
        employmentStatus: 'ACTIVE',
        employmentType: 'FULL_TIME',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: mockTargetUserId });
      mockPrisma.userCompany.findFirst.mockResolvedValueOnce(null); // Not a member of Company A!

      await expect(
        service.linkUser('emp-1', mockTargetUserId, mockCompanyAId, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should unlink user from employee', async () => {
      mockPrisma.employee.findFirst.mockResolvedValueOnce({
        id: 'emp-1',
        companyId: mockCompanyAId,
        employeeNumber: 'EMP-000001',
        userId: mockTargetUserId,
        firstName: 'Vikram',
        lastName: 'Patel',
        phone: '+919999988888',
        joiningDate: new Date('2026-02-01'),
        employmentStatus: 'ACTIVE',
        employmentType: 'FULL_TIME',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.employee.update.mockResolvedValueOnce({
        id: 'emp-1',
        companyId: mockCompanyAId,
        employeeNumber: 'EMP-000001',
        userId: null,
        firstName: 'Vikram',
        lastName: 'Patel',
        phone: '+919999988888',
        joiningDate: new Date('2026-02-01'),
        employmentStatus: 'ACTIVE',
        employmentType: 'FULL_TIME',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.unlinkUser('emp-1', mockCompanyAId, mockUserId);
      expect(result.userId).toBeNull();
      expect(mockPrisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: { userId: null },
      });
    });
  });
});
