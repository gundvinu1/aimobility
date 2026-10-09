jest.mock('@nestjs/jwt', () => ({
  JwtService: class {
    verify = jest.fn();
    sign = jest.fn();
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { GeofenceController } from './geofence.controller';
import { GeofenceService } from './geofence.service';
import { CompanyService } from '../company/company.service';
import type { AuthUser } from '../auth/types/auth-user.type';
import type { TenantContext } from '../company/types/tenant.type';

describe('GeofenceController', () => {
  let controller: GeofenceController;
  let service: any;

  const mockCompanyId = '11111111-1111-1111-1111-111111111111';
  const mockGeofenceId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const tenantOwner: TenantContext = {
    companyId: mockCompanyId,
    role: 'OWNER' as any,
    membershipId: 'mem-1',
    status: 'ACTIVE' as any,
  };

  const tenantManager: TenantContext = {
    companyId: mockCompanyId,
    role: 'MANAGER' as any,
    membershipId: 'mem-2',
    status: 'ACTIVE' as any,
  };

  const tenantDispatcher: TenantContext = {
    companyId: mockCompanyId,
    role: 'DISPATCHER' as any,
    membershipId: 'mem-3',
    status: 'ACTIVE' as any,
  };

  const tenantAccountant: TenantContext = {
    companyId: mockCompanyId,
    role: 'ACCOUNTANT' as any,
    membershipId: 'mem-4',
    status: 'ACTIVE' as any,
  };

  const makeUser = (roles: string[], permissions: string[] = []): AuthUser => ({
    userId: '99999999-9999-9999-9999-999999999999',
    email: 'test@aimos.dev',
    roles,
    permissions,
  });

  const mockReq: any = { ip: '127.0.0.1', headers: {} };

  beforeEach(async () => {
    service = {
      createGeofence: jest.fn().mockResolvedValue({ id: mockGeofenceId }),
      listGeofences: jest.fn().mockResolvedValue([]),
      getGeofence: jest.fn().mockResolvedValue({ id: mockGeofenceId }),
      updateGeofence: jest.fn().mockResolvedValue({ id: mockGeofenceId }),
      deleteGeofence: jest.fn().mockResolvedValue({ success: true }),
      getAssignedVehicles: jest.fn().mockResolvedValue([]),
      assignVehicles: jest.fn().mockResolvedValue([]),
      removeVehicle: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeofenceController],
      providers: [
        { provide: GeofenceService, useValue: service },
        { provide: CompanyService, useValue: { getMembership: jest.fn() } },
      ],
    }).compile();

    controller = module.get<GeofenceController>(GeofenceController);
  });

  describe('RBAC & Permission Enforcement', () => {
    const dto = {
      name: 'Port Area',
      type: 'CIRCLE' as const,
      geometry: { center: { latitude: 10, longitude: 10 }, radiusMeters: 500 },
    };

    it('allows OWNER to create geofence', async () => {
      const user = makeUser(['USER']);
      const res = await controller.create(dto, tenantOwner, user, mockReq);
      expect(res.id).toBe(mockGeofenceId);
    });

    it('allows MANAGER to create geofence', async () => {
      const user = makeUser(['USER']);
      const res = await controller.create(dto, tenantManager, user, mockReq);
      expect(res.id).toBe(mockGeofenceId);
    });

    it('denies DISPATCHER from creating geofence (requires geofence.create)', async () => {
      const user = makeUser(['USER']);
      await expect(
        controller.create(dto, tenantDispatcher, user, mockReq),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies ACCOUNTANT from creating geofence', async () => {
      const user = makeUser(['USER']);
      await expect(
        controller.create(dto, tenantAccountant, user, mockReq),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows DISPATCHER to read geofences', async () => {
      const user = makeUser(['USER']);
      const res = await controller.list({}, tenantDispatcher, user);
      expect(Array.isArray(res)).toBe(true);
    });

    it('denies ACCOUNTANT from reading geofences', async () => {
      const user = makeUser(['USER']);
      await expect(
        controller.list({}, tenantAccountant, user),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows OWNER to delete geofence', async () => {
      const user = makeUser(['USER']);
      const res = await controller.delete(mockGeofenceId, tenantOwner, user, mockReq);
      expect(res.success).toBe(true);
    });

    it('denies MANAGER from deleting geofence (MANAGER has no geofence.delete)', async () => {
      const user = makeUser(['USER']);
      await expect(
        controller.delete(mockGeofenceId, tenantManager, user, mockReq),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SUPER_ADMIN platform role bypasses all checks', async () => {
      const superAdmin = makeUser(['SUPER_ADMIN']);
      const res = await controller.delete(mockGeofenceId, tenantAccountant, superAdmin, mockReq);
      expect(res.success).toBe(true);
    });
  });
});
