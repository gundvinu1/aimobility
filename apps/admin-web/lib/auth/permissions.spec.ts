import {
  resolveEffectivePermissions,
  hasPermissionHelper,
  hasAnyPermissionHelper,
  hasAllPermissionsHelper,
  hasRoleHelper,
} from './permissions';
import { ROLE_PERMISSIONS } from '@ai-mos/constants';
import type { CurrentUserDto, CompanySummaryDto } from '@ai-mos/types';

describe('Role-Based UI & Permission Access Control System', () => {
  const superAdminUser: CurrentUserDto = {
    id: 'user-superadmin',
    email: 'superadmin@aimos.dev',
    firstName: 'Super',
    lastName: 'Admin',
    roles: ['SUPER_ADMIN'],
    permissions: [],
    status: 'ACTIVE',
    emailVerified: true,
    createdAt: new Date().toISOString(),
  };

  const regularUser: CurrentUserDto = {
    id: 'user-regular',
    email: 'user@aimos.dev',
    firstName: 'Regular',
    lastName: 'User',
    roles: ['USER'],
    permissions: [],
    status: 'ACTIVE',
    emailVerified: true,
    createdAt: new Date().toISOString(),
  };

  const companyA: CompanySummaryDto = {
    id: 'company-a',
    name: 'Fleet Corp A',
    slug: 'fleet-a',
    status: 'ACTIVE',
    role: 'OWNER',
    memberCount: 5,
  };

  const companyB: CompanySummaryDto = {
    id: 'company-b',
    name: 'Logistics B',
    slug: 'logistics-b',
    status: 'ACTIVE',
    role: 'MEMBER',
    memberCount: 12,
  };

  describe('resolveEffectivePermissions', () => {
    it('grants wildcard permission ["*"] to SUPER_ADMIN', () => {
      const perms = resolveEffectivePermissions(superAdminUser, null);
      expect(perms).toEqual(['*']);
    });

    it('grants wildcard permission ["*"] to SUPER_ADMIN even inside a company', () => {
      const perms = resolveEffectivePermissions(superAdminUser, companyA);
      expect(perms).toEqual(['*']);
    });

    it('resolves OWNER permissions when companyA is active', () => {
      const perms = resolveEffectivePermissions(regularUser, companyA);
      expect(perms).toEqual(ROLE_PERMISSIONS.OWNER);
      expect(perms).toContain('vehicle.create');
      expect(perms).toContain('vehicle.delete');
      expect(perms).toContain('employee.delete');
      expect(perms).toContain('trip.dispatch');
    });

    it('resolves DRIVER permissions when specialized role is DRIVER in companyB', () => {
      const driverUser: CurrentUserDto = {
        ...regularUser,
        roles: ['DRIVER'],
      };
      const perms = resolveEffectivePermissions(driverUser, companyB);
      expect(perms).toEqual(ROLE_PERMISSIONS.DRIVER);
      expect(perms).toContain('trip.read');
      expect(perms).toContain('driver.duty.update');
      expect(perms).not.toContain('vehicle.create');
      expect(perms).not.toContain('employee.create');
    });

    it('resolves DISPATCHER permissions for dispatcher users', () => {
      const dispatcherUser: CurrentUserDto = {
        ...regularUser,
        roles: ['DISPATCHER'],
      };
      const perms = resolveEffectivePermissions(dispatcherUser, companyB);
      expect(perms).toEqual(ROLE_PERMISSIONS.DISPATCHER);
      expect(perms).toContain('trip.dispatch');
      expect(perms).toContain('booking.read');
      expect(perms).toContain('vehicle.read');
      expect(perms).not.toContain('employee.create');
      expect(perms).not.toContain('company.settings.write');
    });

    it('resolves ACCOUNTANT permissions for accountant users', () => {
      const accountantUser: CurrentUserDto = {
        ...regularUser,
        roles: ['ACCOUNTANT'],
      };
      const perms = resolveEffectivePermissions(accountantUser, companyB);
      expect(perms).toEqual(ROLE_PERMISSIONS.ACCOUNTANT);
      expect(perms).toContain('booking.read');
      expect(perms).toContain('trip.read');
      expect(perms).toContain('company.read');
      expect(perms).not.toContain('vehicle.delete');
      expect(perms).not.toContain('trip.dispatch');
    });

    it('resolves CUSTOMER permissions for customer users', () => {
      const customerUser: CurrentUserDto = {
        ...regularUser,
        roles: ['CUSTOMER'],
      };
      const perms = resolveEffectivePermissions(customerUser, companyB);
      expect(perms).toEqual(ROLE_PERMISSIONS.CUSTOMER);
      expect(perms).toContain('booking.read');
      expect(perms).toContain('booking.create');
      expect(perms).not.toContain('employee.read');
      expect(perms).not.toContain('vehicle.read');
      expect(perms).not.toContain('trip.dispatch');
    });

    it('returns empty permissions when user is null', () => {
      expect(resolveEffectivePermissions(null, null)).toEqual([]);
    });
  });

  describe('Dynamic Company Switching', () => {
    it('immediately changes effective permissions when switching company context', () => {
      const multiRoleUser: CurrentUserDto = {
        ...regularUser,
        roles: ['DRIVER'],
      };

      // In Company A: User is OWNER
      const permsCompanyA = resolveEffectivePermissions(multiRoleUser, companyA);
      expect(permsCompanyA).toContain('vehicle.delete');
      expect(permsCompanyA).toContain('employee.create');

      // Switch to Company B: User is DRIVER
      const permsCompanyB = resolveEffectivePermissions(multiRoleUser, companyB);
      expect(permsCompanyB).not.toContain('vehicle.delete');
      expect(permsCompanyB).not.toContain('employee.create');
      expect(permsCompanyB).toContain('driver.duty.update');
    });
  });

  describe('hasPermissionHelper', () => {
    it('returns true when wildcard "*" is present', () => {
      expect(hasPermissionHelper(['*'], 'vehicle.create')).toBe(true);
      expect(hasPermissionHelper(['*'], 'employee.delete')).toBe(true);
      expect(hasPermissionHelper(['*'], 'anything.at.all')).toBe(true);
    });

    it('returns true for exact permission match', () => {
      expect(hasPermissionHelper(['vehicle.read', 'vehicle.create'], 'vehicle.read')).toBe(true);
      expect(hasPermissionHelper(['vehicle.read', 'vehicle.create'], 'vehicle.create')).toBe(true);
    });

    it('returns false when permission is absent', () => {
      expect(hasPermissionHelper(['vehicle.read'], 'vehicle.create')).toBe(false);
      expect(hasPermissionHelper([], 'vehicle.read')).toBe(false);
    });
  });

  describe('hasAnyPermissionHelper', () => {
    it('returns true if wildcard is present', () => {
      expect(hasAnyPermissionHelper(['*'], ['vehicle.create', 'vehicle.delete'])).toBe(true);
    });

    it('returns true if at least one permission matches', () => {
      expect(hasAnyPermissionHelper(['vehicle.read'], ['vehicle.create', 'vehicle.read'])).toBe(true);
    });

    it('returns false if no permissions match', () => {
      expect(hasAnyPermissionHelper(['vehicle.read'], ['vehicle.create', 'vehicle.delete'])).toBe(false);
    });
  });

  describe('hasAllPermissionsHelper', () => {
    it('returns true if wildcard is present', () => {
      expect(hasAllPermissionsHelper(['*'], ['vehicle.read', 'vehicle.create', 'vehicle.delete'])).toBe(true);
    });

    it('returns true if all permissions match', () => {
      expect(hasAllPermissionsHelper(['vehicle.read', 'vehicle.create'], ['vehicle.read', 'vehicle.create'])).toBe(true);
    });

    it('returns false if any permission is missing', () => {
      expect(hasAllPermissionsHelper(['vehicle.read'], ['vehicle.read', 'vehicle.create'])).toBe(false);
    });
  });

  describe('hasRoleHelper', () => {
    it('matches roles case-insensitively', () => {
      expect(hasRoleHelper(['OWNER'], 'owner')).toBe(true);
      expect(hasRoleHelper(['SUPER_ADMIN'], 'SUPER_ADMIN')).toBe(true);
      expect(hasRoleHelper(['DRIVER'], 'ADMIN')).toBe(false);
    });
  });
});
