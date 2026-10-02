import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../auth/types/auth-user.type';

describe('RbacService', () => {
  let service: RbacService;
  let mockDb: any;

  const superAdminUser: AuthUser = {
    userId: 'sa-user-id',
    email: 'superadmin@aimos.dev',
    roles: ['SUPER_ADMIN'],
    permissions: ['*'],
  };

  const ownerUser: AuthUser = {
    userId: 'owner-user-id',
    email: 'owner@aimos.dev',
    roles: ['OWNER'],
    permissions: ['role.read', 'role.create', 'role.update', 'role.delete', 'permission.assign'],
  };

  const driverUser: AuthUser = {
    userId: 'driver-user-id',
    email: 'driver@aimos.dev',
    roles: ['DRIVER'],
    permissions: ['driver.duty.update'],
  };

  const testCompanyId = '11111111-1111-1111-1111-111111111111';
  const otherCompanyId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    mockDb = {
      role: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      permission: {
        findMany: jest.fn(),
      },
      rolePermission: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      userCompany: {
        findFirst: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      $transaction: jest.fn((cb) => cb(mockDb)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        {
          provide: DatabaseService,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<RbacService>(RbacService);
  });

  describe('listRoles', () => {
    it('should allow SUPER_ADMIN to list all roles', async () => {
      mockDb.role.findMany.mockResolvedValueOnce([
        { id: '1', name: 'SUPER_ADMIN', level: 100, scope: 'PLATFORM', isSystem: true, _count: { permissions: 50, users: 1 }, createdAt: new Date(), updatedAt: new Date() },
        { id: '2', name: 'OWNER', level: 80, scope: 'COMPANY', isSystem: true, _count: { permissions: 45, users: 2 }, createdAt: new Date(), updatedAt: new Date() },
      ]);

      const result = await service.listRoles(superAdminUser);
      expect(result).toHaveLength(2);
      expect(mockDb.role.findMany).toHaveBeenCalled();
    });

    it('should reject unauthorized users without role.read (e.g. DRIVER)', async () => {
      mockDb.role.findUnique.mockResolvedValueOnce(null);
      await expect(service.listRoles(driverUser, testCompanyId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteRole', () => {
    it('should reject deleting a system role', async () => {
      mockDb.role.findUnique.mockImplementation(({ where }: any) => {
        if (where.name === 'SUPER_ADMIN') return Promise.resolve(null);
        if (where.id === 'role-owner') {
          return Promise.resolve({
            id: 'role-owner',
            name: 'OWNER',
            isSystem: true,
            level: 80,
          });
        }
        return Promise.resolve(null);
      });

      await expect(service.deleteRole('role-owner', superAdminUser)).rejects.toThrow(BadRequestException);
    });

    it('should reject deleting a role from another company', async () => {
      mockDb.userCompany.findFirst.mockResolvedValue({ role: 'OWNER' });
      mockDb.role.findUnique.mockImplementation(({ where }: any) => {
        if (where.name === 'OWNER') {
          return Promise.resolve({
            id: 'role-owner',
            name: 'OWNER',
            level: 80,
            permissions: [{ permission: { name: 'role.delete' } }],
          });
        }
        if (where.id === 'custom-role-1') {
          return Promise.resolve({
            id: 'custom-role-1',
            name: 'CUSTOM_ROLE',
            isSystem: false,
            level: 40,
            companyId: otherCompanyId,
          });
        }
        return Promise.resolve(null);
      });

      await expect(service.deleteRole('custom-role-1', ownerUser, testCompanyId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createRole', () => {
    it('should reject creating a role with level equal or higher than caller level', async () => {
      mockDb.userCompany.findFirst.mockResolvedValue({ role: 'OWNER' }); // level 80
      mockDb.role.findUnique.mockImplementation(({ where }: any) => {
        if (where.name === 'OWNER') {
          return Promise.resolve({
            id: 'role-owner',
            name: 'OWNER',
            level: 80,
            permissions: [{ permission: { name: 'role.create' } }],
          });
        }
        return Promise.resolve(null); // Uniqueness check passes
      });

      await expect(
        service.createRole(
          { name: 'SUPER_ELEVATED', level: 90 },
          ownerUser,
          testCompanyId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject privilege escalation when granting unpossessed permissions', async () => {
      mockDb.userCompany.findFirst.mockResolvedValue({ role: 'OWNER' });
      mockDb.role.findUnique.mockImplementation(({ where }: any) => {
        if (where.name === 'OWNER') {
          return Promise.resolve({
            id: 'role-owner',
            name: 'OWNER',
            level: 80,
            permissions: [{ permission: { name: 'driver.read' } }],
          });
        }
        return Promise.resolve(null); // New role name unique
      });

      // Mock requested permission
      mockDb.permission.findMany.mockResolvedValueOnce([
        { id: 'perm-super', name: 'unpossessed.permission' },
      ]);

      await expect(
        service.createRole(
          { name: 'CUSTOM_ROLE', level: 40, permissionIds: ['unpossessed.permission'] },
          ownerUser,
          testCompanyId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateRolePermissions', () => {
    it('should reject self-elevation when user attempts to modify their own active role', async () => {
      mockDb.userCompany.findFirst.mockResolvedValue({ role: 'OWNER' });
      mockDb.role.findUnique.mockImplementation(({ where }: any) => {
        if (where.name === 'OWNER' || where.id === 'role-owner-id') {
          return Promise.resolve({
            id: 'role-owner-id',
            name: 'OWNER',
            level: 80,
            isSystem: true,
            permissions: [{ permission: { name: 'permission.assign' } }],
          });
        }
        return Promise.resolve(null);
      });

      await expect(
        service.updateRolePermissions(
          'role-owner-id',
          { permissionIds: ['role.read'] },
          ownerUser,
          testCompanyId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject modifying SUPER_ADMIN role by non-superadmin', async () => {
      mockDb.userCompany.findFirst.mockResolvedValue({ role: 'OWNER' });
      mockDb.role.findUnique.mockImplementation(({ where }: any) => {
        if (where.name === 'OWNER') {
          return Promise.resolve({
            id: 'role-owner-id',
            name: 'OWNER',
            level: 80,
            permissions: [{ permission: { name: 'permission.assign' } }],
          });
        }
        if (where.id === 'role-sa-id') {
          return Promise.resolve({
            id: 'role-sa-id',
            name: 'SUPER_ADMIN',
            level: 100,
            isSystem: true,
            permissions: [],
          });
        }
        return Promise.resolve(null);
      });

      await expect(
        service.updateRolePermissions(
          'role-sa-id',
          { permissionIds: ['role.read'] },
          ownerUser,
          testCompanyId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
