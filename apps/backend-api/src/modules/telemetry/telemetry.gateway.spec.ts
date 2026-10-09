jest.mock('@nestjs/jwt', () => ({
  JwtService: class {
    verify = jest.fn();
    sign = jest.fn();
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryGateway } from './telemetry.gateway';
import { TokenService } from '../auth/services/token.service';
import { DatabaseService } from '../database/database.service';
import { TelemetryService } from './telemetry.service';
import { TRACKING_EVENTS, DISPATCH_EVENTS } from '@ai-mos/constants';

describe('TelemetryGateway', () => {
  let gateway: TelemetryGateway;
  let tokenService: any;
  let db: any;
  let telemetryService: any;
  let mockServer: any;

  const mockCompanyA = '11111111-1111-1111-1111-111111111111';
  const mockCompanyB = '99999999-9999-9999-9999-999999999999';
  const mockUserId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    tokenService = {
      verifyAccessToken: jest.fn(),
    };

    db = {
      user: {
        findUnique: jest.fn(),
      },
      userCompany: {
        findFirst: jest.fn(),
      },
      vehicle: {
        findFirst: jest.fn(),
      },
    };

    telemetryService = {
      getFleetSnapshot: jest.fn().mockResolvedValue({ totalVehicles: 2, onlineCount: 2 }),
    };

    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryGateway,
        { provide: TokenService, useValue: tokenService },
        { provide: DatabaseService, useValue: db },
        { provide: TelemetryService, useValue: telemetryService },
      ],
    }).compile();

    gateway = module.get<TelemetryGateway>(TelemetryGateway);
    gateway.server = mockServer;
  });

  describe('handleConnection', () => {
    it('rejects connection if no token is provided', async () => {
      const client: any = {
        id: 'sock-1',
        handshake: { auth: {}, headers: {}, query: {} },
        emit: jest.fn(),
        disconnect: jest.fn(),
      };

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Authentication token required',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('rejects connection if token is invalid or expired', async () => {
      tokenService.verifyAccessToken.mockReturnValue(null);
      const client: any = {
        id: 'sock-1',
        handshake: { auth: { token: 'bad-token' }, headers: {}, query: {} },
        emit: jest.fn(),
        disconnect: jest.fn(),
      };

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Invalid or expired access token',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('rejects connection if user has no active membership in requested company', async () => {
      tokenService.verifyAccessToken.mockReturnValue({ sub: mockUserId });
      db.user.findUnique.mockResolvedValue({
        id: mockUserId,
        status: 'ACTIVE',
        deletedAt: null,
        roles: [{ role: { name: 'MEMBER', permissions: [] } }],
      });
      db.userCompany.findFirst.mockResolvedValue(null); // not a member of company A

      const client: any = {
        id: 'sock-1',
        handshake: {
          auth: { token: 'valid-token', companyId: mockCompanyA },
          headers: {},
          query: {},
        },
        emit: jest.fn(),
        disconnect: jest.fn(),
      };

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Tenant access forbidden',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('rejects connection if member role lacks fleet.tracking.live permission (e.g. ACCOUNTANT)', async () => {
      tokenService.verifyAccessToken.mockReturnValue({ sub: mockUserId });
      db.user.findUnique.mockResolvedValue({
        id: mockUserId,
        status: 'ACTIVE',
        deletedAt: null,
        roles: [{ role: { name: 'ACCOUNTANT', permissions: [] } }],
      });
      db.userCompany.findFirst.mockResolvedValue({
        userId: mockUserId,
        companyId: mockCompanyA,
        role: 'ACCOUNTANT',
      });

      const client: any = {
        id: 'sock-1',
        handshake: {
          auth: { token: 'valid-token', companyId: mockCompanyA },
          headers: {},
          query: {},
        },
        emit: jest.fn(),
        disconnect: jest.fn(),
      };

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Insufficient tracking permissions',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('authenticates and joins tenant room for authorized user (e.g. OWNER or DISPATCHER)', async () => {
      tokenService.verifyAccessToken.mockReturnValue({ sub: mockUserId });
      db.user.findUnique.mockResolvedValue({
        id: mockUserId,
        status: 'ACTIVE',
        deletedAt: null,
        roles: [{ role: { name: 'DISPATCHER', permissions: [] } }],
      });
      db.userCompany.findFirst.mockResolvedValue({
        userId: mockUserId,
        companyId: mockCompanyA,
        role: 'DISPATCHER',
      });

      const client: any = {
        id: 'sock-1',
        handshake: {
          auth: { token: 'valid-token', companyId: mockCompanyA },
          headers: {},
          query: {},
        },
        data: {},
        join: jest.fn().mockResolvedValue(undefined),
        emit: jest.fn(),
        disconnect: jest.fn(),
      };

      await gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith(`company:${mockCompanyA}`);
      expect(client.emit).toHaveBeenCalledWith('connected', {
        status: 'AUTHENTICATED',
        companyId: mockCompanyA,
        socketId: 'sock-1',
      });
      expect(client.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('Tenant Isolation in Subscriptions', () => {
    it('prevents Company A client from subscribing to Company B fleet', async () => {
      const client: any = {
        id: 'sock-1',
        data: {
          userId: mockUserId,
          companyId: mockCompanyA, // belongs to Company A
          isSuperAdmin: false,
          tenantRole: 'DISPATCHER',
          permissions: ['fleet.tracking.read', 'fleet.tracking.live'],
        },
        join: jest.fn(),
        emit: jest.fn(),
      };

      const result = await gateway.handleSubscribeFleet(client, { companyId: mockCompanyB });

      expect(result.success).toBe(false);
      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Forbidden: Cannot subscribe to another company fleet',
      });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('allows client to subscribe to their own company fleet and sends snapshot', async () => {
      const client: any = {
        id: 'sock-1',
        data: {
          userId: mockUserId,
          companyId: mockCompanyA,
          isSuperAdmin: false,
          tenantRole: 'DISPATCHER',
          permissions: ['fleet.tracking.read', 'fleet.tracking.live'],
        },
        join: jest.fn().mockResolvedValue(undefined),
        emit: jest.fn(),
      };

      const result = await gateway.handleSubscribeFleet(client, { companyId: mockCompanyA });

      expect(result.success).toBe(true);
      expect(client.join).toHaveBeenCalledWith(`company:${mockCompanyA}`);
      expect(client.emit).toHaveBeenCalledWith(
        TRACKING_EVENTS.FLEET_SNAPSHOT,
        expect.objectContaining({ totalVehicles: 2 }),
      );
    });
  });

  describe('Broadcasting', () => {
    it('scopes vehicle.location.updated strictly to company room', () => {
      const payload: any = {
        companyId: mockCompanyA,
        vehicleId: 'veh-1',
        location: { latitude: 37.77, longitude: -122.41 },
        fleetStatus: 'ACTIVE',
      };

      gateway.broadcastLocationUpdated(mockCompanyA, payload);

      expect(mockServer.to).toHaveBeenCalledWith(`company:${mockCompanyA}`);
      expect(mockServer.emit).toHaveBeenCalledWith(
        TRACKING_EVENTS.VEHICLE_LOCATION_UPDATED,
        payload,
      );
    });

    it('scopes vehicle.status.updated to company room', () => {
      const payload: any = {
        companyId: mockCompanyA,
        vehicleId: 'veh-1',
        vehicleStatus: 'ACTIVE',
        fleetStatus: 'ACTIVE',
      };

      gateway.broadcastStatusUpdated(mockCompanyA, payload);

      expect(mockServer.to).toHaveBeenCalledWith(`company:${mockCompanyA}`);
      expect(mockServer.emit).toHaveBeenCalledWith(
        TRACKING_EVENTS.VEHICLE_STATUS_UPDATED,
        payload,
      );
    });

    it('scopes dispatch.trip.assigned strictly to company room', () => {
      const payload = { tripId: 'trip-1', driverId: 'drv-1', status: 'DRIVER_ASSIGNED' };

      gateway.broadcastDispatchTripAssigned(mockCompanyA, payload);

      expect(mockServer.to).toHaveBeenCalledWith(`company:${mockCompanyA}`);
      expect(mockServer.emit).toHaveBeenCalledWith(
        DISPATCH_EVENTS.TRIP_ASSIGNED,
        payload,
      );
    });

    it('scopes dispatch.trip.unassigned strictly to company room', () => {
      const payload = { tripId: 'trip-1', unassignedType: 'DRIVER', status: 'SCHEDULED' };

      gateway.broadcastDispatchTripUnassigned(mockCompanyA, payload);

      expect(mockServer.to).toHaveBeenCalledWith(`company:${mockCompanyA}`);
      expect(mockServer.emit).toHaveBeenCalledWith(
        DISPATCH_EVENTS.TRIP_UNASSIGNED,
        payload,
      );
    });

    it('scopes dispatch.trip.dispatched strictly to company room', () => {
      const payload = { tripId: 'trip-1', status: 'DISPATCHED' };

      gateway.broadcastDispatchTripDispatched(mockCompanyA, payload);

      expect(mockServer.to).toHaveBeenCalledWith(`company:${mockCompanyA}`);
      expect(mockServer.emit).toHaveBeenCalledWith(
        DISPATCH_EVENTS.TRIP_DISPATCHED,
        payload,
      );
    });

    it('scopes dispatch.trip.status.updated strictly to company room', () => {
      const payload = { tripId: 'trip-1', status: 'IN_PROGRESS', previousStatus: 'DRIVER_ARRIVED' };

      gateway.broadcastDispatchStatusUpdated(mockCompanyA, payload);

      expect(mockServer.to).toHaveBeenCalledWith(`company:${mockCompanyA}`);
      expect(mockServer.emit).toHaveBeenCalledWith(
        DISPATCH_EVENTS.TRIP_STATUS_UPDATED,
        payload,
      );
    });

    it('scopes dispatch.stop.updated strictly to company room', () => {
      const payload = { tripId: 'trip-1', stopId: 'stop-1', status: 'COMPLETED' };

      gateway.broadcastDispatchStopUpdated(mockCompanyA, payload);

      expect(mockServer.to).toHaveBeenCalledWith(`company:${mockCompanyA}`);
      expect(mockServer.emit).toHaveBeenCalledWith(
        DISPATCH_EVENTS.STOP_UPDATED,
        payload,
      );
    });

    it('scopes dispatch.eta.updated strictly to company room', () => {
      const payload = { tripId: 'trip-1', distanceRemainingKm: 4.5, durationRemainingMinutes: 12 };

      gateway.broadcastDispatchEtaUpdated(mockCompanyA, payload);

      expect(mockServer.to).toHaveBeenCalledWith(`company:${mockCompanyA}`);
      expect(mockServer.emit).toHaveBeenCalledWith(
        DISPATCH_EVENTS.ETA_UPDATED,
        payload,
      );
    });
  });
});
