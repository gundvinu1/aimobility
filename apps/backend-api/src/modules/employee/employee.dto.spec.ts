import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto';
import { ListEmployeesDto } from './dto/list-employees.dto';

async function validateDto<T extends object>(cls: new () => T, plain: Record<string, unknown>) {
  const instance = plainToInstance(cls, plain);
  return validate(instance);
}

describe('Employee DTOs', () => {
  describe('CreateEmployeeDto', () => {
    it('should validate valid employee creation payload', async () => {
      const errors = await validateDto(CreateEmployeeDto, {
        firstName: 'Aarav',
        lastName: 'Sharma',
        email: 'aarav.sharma@example.com',
        phone: '+919876543210',
        employmentType: 'FULL_TIME',
        department: 'OPERATIONS',
        designation: 'Fleet Coordinator',
        joiningDate: '2026-01-15T00:00:00.000Z',
      });
      expect(errors.length).toBe(0);
    });

    it('should fail when required fields are missing', async () => {
      const errors = await validateDto(CreateEmployeeDto, {
        firstName: '',
      });
      const properties = errors.map((e) => e.property);
      expect(properties).toContain('firstName');
      expect(properties).toContain('lastName');
      expect(properties).toContain('phone');
      expect(properties).toContain('joiningDate');
    });

    it('should reject invalid email format', async () => {
      const errors = await validateDto(CreateEmployeeDto, {
        firstName: 'Aarav',
        lastName: 'Sharma',
        email: 'invalid-email',
        phone: '+919876543210',
        employmentType: 'FULL_TIME',
        department: 'OPERATIONS',
        designation: 'Fleet Coordinator',
        joiningDate: '2026-01-15T00:00:00.000Z',
      });
      expect(errors.some((e) => e.property === 'email')).toBe(true);
    });

    it('should reject invalid employmentType enum value', async () => {
      const errors = await validateDto(CreateEmployeeDto, {
        firstName: 'Aarav',
        lastName: 'Sharma',
        email: 'aarav.sharma@example.com',
        phone: '+919876543210',
        employmentType: 'UNKNOWN_TYPE',
        department: 'OPERATIONS',
        designation: 'Fleet Coordinator',
        joiningDate: '2026-01-15T00:00:00.000Z',
      });
      expect(errors.some((e) => e.property === 'employmentType')).toBe(true);
    });
  });

  describe('UpdateEmployeeStatusDto', () => {
    it('should pass with valid status enum', async () => {
      const errors = await validateDto(UpdateEmployeeStatusDto, {
        employmentStatus: 'ACTIVE',
      });
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid status value', async () => {
      const errors = await validateDto(UpdateEmployeeStatusDto, {
        employmentStatus: 'FIRED',
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('employmentStatus');
    });
  });

  describe('ListEmployeesDto', () => {
    it('should accept empty query params with default values', async () => {
      const errors = await validateDto(ListEmployeesDto, {});
      expect(errors.length).toBe(0);
    });

    it('should pass with valid filters and pagination', async () => {
      const errors = await validateDto(ListEmployeesDto, {
        page: 1,
        limit: 25,
        search: 'Ravi',
        employmentStatus: 'ACTIVE',
        department: 'OPERATIONS',
        sortBy: 'joiningDate',
        sortOrder: 'asc',
      });
      expect(errors.length).toBe(0);
    });

    it('should reject invalid sortOrder', async () => {
      const errors = await validateDto(ListEmployeesDto, {
        sortOrder: 'diagonal',
      });
      expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
    });
  });
});
