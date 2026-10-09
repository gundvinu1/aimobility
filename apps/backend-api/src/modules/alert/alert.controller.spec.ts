jest.mock('@nestjs/jwt', () => ({
  JwtService: class {
    verify = jest.fn();
    sign = jest.fn();
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AlertController } from './alert.controller';
import { AlertService } from './alert.service';
import { CompanyService } from '../company/company.service';
import type { AuthUser } from '../auth/types/auth-user.type';
import type { TenantContext } from '../company/types/tenant.type';

describe('AlertController', () => {
  let controller: AlertController;
  let service: any;

  const mockCompanyId = '11111111-1111-1111-1111-111111111111';
  const mockAlertId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

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
      listAlerts: jest.fn().mockResolvedValue({ alerts: [], total: 0 }),
      getAlertSummary: jest.fn().mockResolvedValue({ totalOpen: 0 }),
      getCompanyConfig: jest.fn().mockResolvedValue({ overspeedThresholdKmH: 80 }),
      updateCompanyConfig: jest.fn().mockResolvedValue({ overspeedThresholdKmH: 90 }),
      getDriverSafetySummary: jest.fn().mockResolvedValue([]),
      getVehicleSafetySummary: jest.fn().mockResolvedValue([]),
      getAlert: jest.fn().mockResolvedValue({ id: mockAlertId }),
      acknowledgeAlert: jest.fn().mockResolvedValue({ id: mockAlertId, status: 'ACKNOWLEDGED' }),
      resolveAlert: jest.fn().mockResolvedValue({ id: mockAlertId, status: 'RESOLVED' }),
      dismissAlert: jest.fn().mockResolvedValue({ id: mockAlertId, status: 'DISMISSED' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertController],
      providers: [
        { provide: AlertService, useValue: service },
        { provide: CompanyService, useValue: { getMembership: jest.fn() } },
      ],
    }).compile();

    controller = module.get<AlertController>(AlertController);
  });

  describe('RBAC & Permission Enforcement', () => {
    it('allows DISPATCHER to view alerts', async () => {
      const user = makeUser(['USER']);
      const res = await controller.list({}, tenantDispatcher, user);
      expect(res.total).toBe(0);
    });

    it('denies ACCOUNTANT from viewing alerts', async () => {
      const user = makeUser(['USER']);
      await expect(
        controller.list({}, tenantAccountant, user),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows DISPATCHER to acknowledge an alert', async () => {
      const user = makeUser(['USER']);
      const res = await controller.acknowledge(
        mockAlertId,
        { notes: 'Acknowledged' },
        tenantDispatcher,
        user,
        mockReq,
      );
      expect(res.status).toBe('ACKNOWLEDGED');
    });

    it('denies DISPATCHER from resolving an alert (requires alert.resolve)', async () => {
      const user = makeUser(['USER']);
      await expect(
        controller.resolve(
          mockAlertId,
          { notes: 'Resolved' },
          tenantDispatcher,
          user,
          mockReq,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows MANAGER to resolve an alert', async () => {
      const user = makeUser(['USER']);
      const res = await controller.resolve(
        mockAlertId,
        { notes: 'Resolved' },
        tenantManager,
        user,
        mockReq,
      );
      expect(res.status).toBe('RESOLVED');
    });

    it('allows OWNER to update alert configuration', async () => {
      const user = makeUser(['USER']);
      const res = await controller.updateConfig(
        { overspeedThresholdKmH: 95 },
        tenantOwner,
        user,
        mockReq,
      );
      expect(res.overspeedThresholdKmH).toBe(90);
    });

    it('denies MANAGER from updating alert configuration (requires alert.configure)', async () => {
      const user = makeUser(['USER']);
      await expect(
        controller.updateConfig(
          { overspeedThresholdKmH: 95 },
          tenantManager,
          user,
          mockReq,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SUPER_ADMIN platform role bypasses all checks', async () => {
      const superAdmin = makeUser(['SUPER_ADMIN']);
      const res = await controller.updateConfig(
        { overspeedThresholdKmH: 95 },
        tenantAccountant,
        superAdmin,
        mockReq,
      );
      expect(res.overspeedThresholdKmH).toBe(90);
    });
  });
});
