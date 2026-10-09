jest.mock('@nestjs/jwt', () => ({
  JwtService: class {
    verify = jest.fn();
    sign = jest.fn();
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { TelemetryController, FleetTrackingController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';
import { CompanyService } from '../company/company.service';
import type { AuthUser } from '../auth/types/auth-user.type';
import type { TenantContext } from '../company/types/tenant.type';
import { IngestTelemetryDto } from './dto/ingest-telemetry.dto';

describe('TelemetryController & FleetTrackingController', () => {
  let telemetryController: TelemetryController;
  let fleetTrackingController: FleetTrackingController;
  let telemetryService: any;

  const mockCompanyId = '11111111-1111-1111-1111-111111111111';
  const mockVehicleId = '22222222-2222-2222-2222-222222222222';

  const tenantOwner: TenantContext = {
    companyId: mockCompanyId,
    role: 'OWNER' as any,
    membershipId: 'mem-1',
    status: 'ACTIVE' as any,
  };

  const tenantDispatcher: TenantContext = {
    companyId: mockCompanyId,
    role: 'DISPATCHER' as any,
    membershipId: 'mem-2',
    status: 'ACTIVE' as any,
  };

  const tenantAccountant: TenantContext = {
    companyId: mockCompanyId,
    role: 'ACCOUNTANT' as any,
    membershipId: 'mem-3',
    status: 'ACTIVE' as any,
  };

  const tenantDriver: TenantContext = {
    companyId: mockCompanyId,
    role: 'DRIVER' as any,
    membershipId: 'mem-4',
    status: 'ACTIVE' as any,
  };

  const tenantCustomer: TenantContext = {
    companyId: mockCompanyId,
    role: 'CUSTOMER' as any,
    membershipId: 'mem-5',
    status: 'ACTIVE' as any,
  };

  const userRegular: AuthUser = {
    userId: 'user-1',
    email: 'user@aimos.dev',
    roles: ['MEMBER'],
    permissions: [],
  };

  const userSuperAdmin: AuthUser = {
    userId: 'admin-1',
    email: 'admin@aimos.dev',
    roles: ['SUPER_ADMIN'],
    permissions: ['*'],
  };

  const validDto: IngestTelemetryDto = {
    vehicleId: mockVehicleId,
    latitude: 37.7749,
    longitude: -122.4194,
    speed: 40,
    timestamp: new Date().toISOString(),
  };

  beforeEach(async () => {
    telemetryService = {
      ingestTelemetry: jest.fn().mockResolvedValue({ location: { id: 'loc-1' }, isNew: true }),
      getFleetSnapshot: jest.fn().mockResolvedValue({ totalVehicles: 5, onlineCount: 4 }),
      getVehicleLocation: jest.fn().mockResolvedValue({ id: 'loc-1', vehicleId: mockVehicleId }),
      getTelemetryHistory: jest.fn().mockResolvedValue({ telemetry: [], total: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelemetryController, FleetTrackingController],
      providers: [
        { provide: TelemetryService, useValue: telemetryService },
        { provide: CompanyService, useValue: {} },
      ],
    }).compile();

    telemetryController = module.get<TelemetryController>(TelemetryController);
    fleetTrackingController = module.get<FleetTrackingController>(FleetTrackingController);
  });

  describe('Ingest Permission Enforcement', () => {
    it('allows OWNER to ingest telemetry', async () => {
      const res = await telemetryController.ingest(validDto, tenantOwner, userRegular);
      expect(res).toBeDefined();
      expect(telemetryService.ingestTelemetry).toHaveBeenCalledWith(mockCompanyId, validDto);
    });

    it('denies DISPATCHER from ingesting telemetry (lacks vehicle.telemetry.write)', async () => {
      await expect(
        telemetryController.ingest(validDto, tenantDispatcher, userRegular),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies ACCOUNTANT from ingesting telemetry', async () => {
      await expect(
        telemetryController.ingest(validDto, tenantAccountant, userRegular),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies DRIVER from ingesting company-wide telemetry', async () => {
      await expect(
        telemetryController.ingest(validDto, tenantDriver, userRegular),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies CUSTOMER from ingesting telemetry', async () => {
      await expect(
        telemetryController.ingest(validDto, tenantCustomer, userRegular),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows SUPER_ADMIN to ingest telemetry regardless of tenant role', async () => {
      const res = await telemetryController.ingest(validDto, tenantAccountant, userSuperAdmin);
      expect(res).toBeDefined();
    });
  });

  describe('Fleet Tracking Snapshot Permission Enforcement', () => {
    it('allows OWNER to view fleet tracking snapshot', async () => {
      const res = await fleetTrackingController.getFleetSnapshot(
        mockCompanyId,
        tenantOwner,
        userRegular,
      );
      expect(res).toBeDefined();
      expect(telemetryService.getFleetSnapshot).toHaveBeenCalledWith(mockCompanyId);
    });

    it('allows DISPATCHER to view fleet tracking snapshot (has fleet.tracking.read)', async () => {
      const res = await fleetTrackingController.getFleetSnapshot(
        mockCompanyId,
        tenantDispatcher,
        userRegular,
      );
      expect(res).toBeDefined();
    });

    it('denies ACCOUNTANT from viewing fleet tracking (lacks fleet.tracking.read)', async () => {
      await expect(
        fleetTrackingController.getFleetSnapshot(mockCompanyId, tenantAccountant, userRegular),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies DRIVER from viewing fleet tracking snapshot', async () => {
      await expect(
        fleetTrackingController.getFleetSnapshot(mockCompanyId, tenantDriver, userRegular),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies CUSTOMER from viewing fleet tracking snapshot', async () => {
      await expect(
        fleetTrackingController.getFleetSnapshot(mockCompanyId, tenantCustomer, userRegular),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows SUPER_ADMIN to view fleet tracking snapshot', async () => {
      const res = await fleetTrackingController.getFleetSnapshot(
        mockCompanyId,
        tenantCustomer,
        userSuperAdmin,
      );
      expect(res).toBeDefined();
    });
  });

  describe('Vehicle Location & History Permission Enforcement', () => {
    it('allows DISPATCHER to read single vehicle location (has vehicle.location.read)', async () => {
      const res = await fleetTrackingController.getVehicleLocation(
        mockVehicleId,
        tenantDispatcher,
        userRegular,
      );
      expect(res).toBeDefined();
      expect(telemetryService.getVehicleLocation).toHaveBeenCalledWith(
        mockCompanyId,
        mockVehicleId,
      );
    });

    it('denies ACCOUNTANT from reading single vehicle location', async () => {
      await expect(
        fleetTrackingController.getVehicleLocation(mockVehicleId, tenantAccountant, userRegular),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows OWNER to view telemetry history (has vehicle.telemetry.read)', async () => {
      const res = await fleetTrackingController.getTelemetryHistory(
        mockVehicleId,
        {},
        tenantOwner,
        userRegular,
      );
      expect(res).toBeDefined();
      expect(telemetryService.getTelemetryHistory).toHaveBeenCalled();
    });

    it('denies DISPATCHER from viewing historical telemetry (only live/location read)', async () => {
      await expect(
        fleetTrackingController.getTelemetryHistory(mockVehicleId, {}, tenantDispatcher, userRegular),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
