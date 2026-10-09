jest.mock('@nestjs/jwt', () => ({
  JwtService: class {
    verify = jest.fn();
    sign = jest.fn();
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AlertEvaluationService } from './alert-evaluation.service';
import { AlertService } from './alert.service';
import { GeofenceService } from '../geofence/geofence.service';
import { CacheService } from '../cache/cache.service';
import { ALERT_REDIS_KEYS } from '@ai-mos/constants';

describe('AlertEvaluationService', () => {
  let service: AlertEvaluationService;
  let alertService: any;
  let geofenceService: any;
  let cache: any;

  const mockCompanyId = '11111111-1111-1111-1111-111111111111';
  const mockVehicleId = '22222222-2222-2222-2222-222222222222';
  const mockGeofenceId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  beforeEach(async () => {
    alertService = {
      getCompanyConfig: jest.fn().mockResolvedValue({
        overspeedEnabled: true,
        overspeedThresholdKmH: 80,
        overspeedGracePeriodSeconds: 10,
        harshBrakingEnabled: true,
        harshBrakingThresholdKmhPerSec: 20,
        excessiveIdleEnabled: true,
        excessiveIdleThresholdMinutes: 15,
        geofenceEntryAlertsEnabled: true,
        geofenceExitAlertsEnabled: true,
      }),
      createAlert: jest.fn().mockResolvedValue({}),
    };

    geofenceService = {
      getActiveGeofencesForVehicle: jest.fn().mockResolvedValue([]),
      isPointInside: jest.fn(),
    };

    cache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertEvaluationService,
        { provide: AlertService, useValue: alertService },
        { provide: GeofenceService, useValue: geofenceService },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = module.get<AlertEvaluationService>(AlertEvaluationService);
  });

  describe('Geofence Entry / Exit Transitions', () => {
    it('detects ENTRY transition (outside -> inside) and emits GEOFENCE_ENTRY alert', async () => {
      geofenceService.getActiveGeofencesForVehicle.mockResolvedValue([
        {
          id: mockGeofenceId,
          name: 'HQ Zone',
          type: 'CIRCLE',
          geometry: {},
          entryAlertEnabled: true,
          exitAlertEnabled: true,
        },
      ]);

      // Previous state: NOT inside
      cache.get.mockResolvedValue([]);
      // Current point is inside
      geofenceService.isPointInside.mockReturnValue(true);

      const now = new Date();
      await service.evaluateTelemetry({
        companyId: mockCompanyId,
        vehicleId: mockVehicleId,
        vehicleNumber: 'MH12AB1234',
        currentLocation: {
          latitude: 37.7749,
          longitude: -122.4194,
          speed: 40,
          timestamp: now,
          ignition: true,
        },
      });

      expect(alertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'GEOFENCE_ENTRY',
          geofenceId: mockGeofenceId,
        }),
      );
      // Redis updated with inside ID
      expect(cache.set).toHaveBeenCalledWith(
        ALERT_REDIS_KEYS.vehicleInsideGeofences(mockVehicleId),
        [mockGeofenceId],
        86400,
      );
    });

    it('does NOT create duplicate entry alert when vehicle remains inside (inside -> inside)', async () => {
      geofenceService.getActiveGeofencesForVehicle.mockResolvedValue([
        {
          id: mockGeofenceId,
          name: 'HQ Zone',
          type: 'CIRCLE',
          geometry: {},
          entryAlertEnabled: true,
          exitAlertEnabled: true,
        },
      ]);

      // Previous state: ALREADY inside
      cache.get.mockResolvedValue([mockGeofenceId]);
      // Current point is STILL inside
      geofenceService.isPointInside.mockReturnValue(true);

      const now = new Date();
      await service.evaluateTelemetry({
        companyId: mockCompanyId,
        vehicleId: mockVehicleId,
        vehicleNumber: 'MH12AB1234',
        currentLocation: {
          latitude: 37.7749,
          longitude: -122.4194,
          speed: 40,
          timestamp: now,
          ignition: true,
        },
      });

      // No alert should be generated!
      expect(alertService.createAlert).not.toHaveBeenCalled();
    });

    it('detects EXIT transition (inside -> outside) and emits GEOFENCE_EXIT alert', async () => {
      geofenceService.getActiveGeofencesForVehicle.mockResolvedValue([
        {
          id: mockGeofenceId,
          name: 'HQ Zone',
          type: 'CIRCLE',
          geometry: {},
          entryAlertEnabled: true,
          exitAlertEnabled: true,
        },
      ]);

      // Previous state: inside
      cache.get.mockResolvedValue([mockGeofenceId]);
      // Current point is outside
      geofenceService.isPointInside.mockReturnValue(false);

      const now = new Date();
      await service.evaluateTelemetry({
        companyId: mockCompanyId,
        vehicleId: mockVehicleId,
        vehicleNumber: 'MH12AB1234',
        currentLocation: {
          latitude: 37.8,
          longitude: -122.4,
          speed: 50,
          timestamp: now,
          ignition: true,
        },
      });

      expect(alertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'GEOFENCE_EXIT',
          geofenceId: mockGeofenceId,
        }),
      );
      // Redis updated with empty array
      expect(cache.set).toHaveBeenCalledWith(
        ALERT_REDIS_KEYS.vehicleInsideGeofences(mockVehicleId),
        [],
        86400,
      );
    });
  });

  describe('Overspeed Evaluation', () => {
    it('sets first overspeed timestamp on initial excess, but does not alert until grace period elapses', async () => {
      // Speed 100 > limit 80, first time
      cache.get.mockResolvedValue(null);

      const now = new Date();
      await service.evaluateTelemetry({
        companyId: mockCompanyId,
        vehicleId: mockVehicleId,
        vehicleNumber: 'MH12AB1234',
        currentLocation: {
          latitude: 37.7749,
          longitude: -122.4194,
          speed: 100,
          timestamp: now,
          ignition: true,
        },
      });

      // Set timestamp in Redis
      expect(cache.set).toHaveBeenCalledWith(
        ALERT_REDIS_KEYS.vehicleOverspeed(mockVehicleId),
        expect.objectContaining({ speed: 100 }),
        300,
      );
      // No alert yet (grace period is 10s)
      expect(alertService.createAlert).not.toHaveBeenCalled();
    });

    it('emits OVERSPEED alert after grace period has elapsed', async () => {
      const now = new Date();
      const firstExceeded = new Date(now.getTime() - 15000); // 15 seconds ago (grace period is 10s)

      cache.get.mockImplementation((key: string) => {
        if (key === ALERT_REDIS_KEYS.vehicleOverspeed(mockVehicleId)) {
          return Promise.resolve({ firstExceededAt: firstExceeded.toISOString(), speed: 105 });
        }
        return Promise.resolve(null);
      });
      cache.exists.mockResolvedValue(false); // not in cooldown

      await service.evaluateTelemetry({
        companyId: mockCompanyId,
        vehicleId: mockVehicleId,
        vehicleNumber: 'MH12AB1234',
        currentLocation: {
          latitude: 37.7749,
          longitude: -122.4194,
          speed: 108,
          timestamp: now,
          ignition: true,
        },
      });

      expect(alertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'OVERSPEED',
          speed: 108,
        }),
      );
      // Sets cooldown in Redis
      expect(cache.set).toHaveBeenCalledWith(
        ALERT_REDIS_KEYS.alertCooldown(mockVehicleId, 'OVERSPEED'),
        true,
        expect.any(Number),
      );
    });

    it('clears overspeed tracking when speed returns below limit', async () => {
      const now = new Date();
      await service.evaluateTelemetry({
        companyId: mockCompanyId,
        vehicleId: mockVehicleId,
        vehicleNumber: 'MH12AB1234',
        currentLocation: {
          latitude: 37.7749,
          longitude: -122.4194,
          speed: 60, // Well below 80
          timestamp: now,
          ignition: true,
        },
      });

      expect(cache.del).toHaveBeenCalledWith(
        ALERT_REDIS_KEYS.vehicleOverspeed(mockVehicleId),
      );
    });
  });

  describe('Excessive Idle Evaluation', () => {
    it('creates EXCESSIVE_IDLE alert when stationary with ignition ON for > threshold', async () => {
      const now = new Date();
      const startedAt = new Date(now.getTime() - 20 * 60 * 1000); // 20 mins ago (threshold is 15 mins)

      cache.get.mockImplementation((key: string) => {
        if (key === ALERT_REDIS_KEYS.vehicleIdle(mockVehicleId)) {
          return Promise.resolve({ startedAt: startedAt.toISOString(), alerted: false });
        }
        return Promise.resolve(null);
      });

      await service.evaluateTelemetry({
        companyId: mockCompanyId,
        vehicleId: mockVehicleId,
        vehicleNumber: 'MH12AB1234',
        currentLocation: {
          latitude: 37.7749,
          longitude: -122.4194,
          speed: 0,
          timestamp: now,
          ignition: true,
        },
      });

      expect(alertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'EXCESSIVE_IDLE',
        }),
      );
    });

    it('clears idle state when vehicle starts moving', async () => {
      const now = new Date();
      await service.evaluateTelemetry({
        companyId: mockCompanyId,
        vehicleId: mockVehicleId,
        vehicleNumber: 'MH12AB1234',
        currentLocation: {
          latitude: 37.7749,
          longitude: -122.4194,
          speed: 25, // moving
          timestamp: now,
          ignition: true,
        },
      });

      expect(cache.del).toHaveBeenCalledWith(
        ALERT_REDIS_KEYS.vehicleIdle(mockVehicleId),
      );
    });
  });

  describe('Harsh Braking Evaluation', () => {
    it('creates HARSH_BRAKING alert on severe deceleration', async () => {
      const prevTime = new Date('2026-10-08T10:00:00Z');
      const currTime = new Date('2026-10-08T10:00:02Z'); // 2 seconds later

      // Previous: 80 km/h, Current: 20 km/h -> Δspeed = 60 km/h in 2s => 30 km/h/s (threshold: 20 km/h/s)
      cache.exists.mockResolvedValue(false);

      await service.evaluateTelemetry({
        companyId: mockCompanyId,
        vehicleId: mockVehicleId,
        vehicleNumber: 'MH12AB1234',
        previousLocation: {
          latitude: 37.7749,
          longitude: -122.4194,
          speed: 80,
          timestamp: prevTime,
          ignition: true,
        },
        currentLocation: {
          latitude: 37.775,
          longitude: -122.4194,
          speed: 20,
          timestamp: currTime,
          ignition: true,
        },
      });

      expect(alertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'HARSH_BRAKING',
          metadata: expect.objectContaining({
            deltaSpeed: 60,
            decelerationRateKmhPerSec: 30,
          }),
        }),
      );
    });

    it('does not alert on normal gradual braking', async () => {
      const prevTime = new Date('2026-10-08T10:00:00Z');
      const currTime = new Date('2026-10-08T10:00:04Z'); // 4 seconds later
      // Previous: 50 km/h, Current: 40 km/h -> Δspeed = 10 km/h in 4s => 2.5 km/h/s (threshold: 20)

      await service.evaluateTelemetry({
        companyId: mockCompanyId,
        vehicleId: mockVehicleId,
        vehicleNumber: 'MH12AB1234',
        previousLocation: {
          latitude: 37.7749,
          longitude: -122.4194,
          speed: 50,
          timestamp: prevTime,
          ignition: true,
        },
        currentLocation: {
          latitude: 37.775,
          longitude: -122.4194,
          speed: 40,
          timestamp: currTime,
          ignition: true,
        },
      });

      expect(alertService.createAlert).not.toHaveBeenCalled();
    });
  });

  describe('Fuel Drop Evaluation (Module 11)', () => {
    it('creates FUEL_DROP alert when sudden drop exceeds threshold', async () => {
      const prevTime = new Date('2026-10-08T10:00:00Z');
      const currTime = new Date('2026-10-08T10:02:00Z');

      await service.evaluateTelemetry({
        companyId: mockCompanyId,
        vehicleId: mockVehicleId,
        vehicleNumber: 'MH12AB1234',
        previousLocation: {
          latitude: 37.7749,
          longitude: -122.4194,
          speed: 0,
          timestamp: prevTime,
          ignition: false,
          fuelLevel: 65,
        },
        currentLocation: {
          latitude: 37.7749,
          longitude: -122.4194,
          speed: 0,
          timestamp: currTime,
          ignition: false,
          fuelLevel: 45, // 20L drop > 10L threshold
        },
      });

      expect(alertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'FUEL_DROP',
          severity: 'CRITICAL', // 20 >= 10*2
          title: 'Sudden Fuel Drop Detected',
          vehicleId: mockVehicleId,
        }),
      );
      expect(cache.set).toHaveBeenCalledWith(
        ALERT_REDIS_KEYS.alertCooldown(mockVehicleId, 'FUEL_DROP'),
        true,
        300,
      );
    });

    it('does not alert during normal refueling (level increases)', async () => {
      const prevTime = new Date('2026-10-08T10:00:00Z');
      const currTime = new Date('2026-10-08T10:05:00Z');

      await service.evaluateTelemetry({
        companyId: mockCompanyId,
        vehicleId: mockVehicleId,
        vehicleNumber: 'MH12AB1234',
        previousLocation: {
          latitude: 37.7749,
          longitude: -122.4194,
          speed: 0,
          timestamp: prevTime,
          ignition: false,
          fuelLevel: 15,
        },
        currentLocation: {
          latitude: 37.7749,
          longitude: -122.4194,
          speed: 0,
          timestamp: currTime,
          ignition: false,
          fuelLevel: 65, // +50L refueling
        },
      });

      expect(alertService.createAlert).not.toHaveBeenCalled();
    });

    it('does not alert when drop is below threshold or during cooldown', async () => {
      cache.exists.mockResolvedValue(true); // In cooldown

      await service.evaluateTelemetry({
        companyId: mockCompanyId,
        vehicleId: mockVehicleId,
        vehicleNumber: 'MH12AB1234',
        previousLocation: {
          latitude: 37.7749,
          longitude: -122.4194,
          speed: 40,
          timestamp: new Date('2026-10-08T10:00:00Z'),
          ignition: true,
          fuelLevel: 50,
        },
        currentLocation: {
          latitude: 37.775,
          longitude: -122.4194,
          speed: 40,
          timestamp: new Date('2026-10-08T10:01:00Z'),
          ignition: true,
          fuelLevel: 30, // 20L drop but in cooldown
        },
      });

      expect(alertService.createAlert).not.toHaveBeenCalled();
    });
  });
});
