jest.mock('@nestjs/jwt', () => ({
  JwtService: class {
    verify = jest.fn();
    sign = jest.fn();
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AlertService } from './alert.service';
import { DatabaseService } from '../database/database.service';
import { TelemetryGateway } from '../telemetry/telemetry.gateway';

describe('AlertService', () => {
  let service: AlertService;
  let db: any;
  let gateway: any;

  const mockCompanyId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '99999999-9999-9999-9999-999999999999';
  const mockAlertId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const mockVehicleId = '22222222-2222-2222-2222-222222222222';
  const mockDriverId = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    db = {
      companyAlertConfig: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      fleetAlert: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    gateway = {
      broadcastAlertCreated: jest.fn(),
      broadcastAlertUpdated: jest.fn(),
      broadcastAlertAcknowledged: jest.fn(),
      broadcastAlertResolved: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertService,
        { provide: DatabaseService, useValue: db },
        { provide: TelemetryGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get<AlertService>(AlertService);
  });

  describe('getCompanyConfig', () => {
    it('returns existing company config if found', async () => {
      db.companyAlertConfig.findUnique.mockResolvedValue({
        id: 'cfg-1',
        companyId: mockCompanyId,
        overspeedEnabled: true,
        overspeedThresholdKmH: 90,
        overspeedGracePeriodSeconds: 15,
        harshBrakingEnabled: true,
        harshBrakingThresholdKmhPerSec: 25,
        excessiveIdleEnabled: true,
        excessiveIdleThresholdMinutes: 20,
        geofenceEntryAlertsEnabled: true,
        geofenceExitAlertsEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const config = await service.getCompanyConfig(mockCompanyId);
      expect(config.overspeedThresholdKmH).toBe(90);
      expect(config.excessiveIdleThresholdMinutes).toBe(20);
    });

    it('creates and returns default configuration if none exists', async () => {
      db.companyAlertConfig.findUnique.mockResolvedValue(null);
      db.companyAlertConfig.create.mockResolvedValue({
        id: 'cfg-default',
        companyId: mockCompanyId,
        overspeedEnabled: true,
        overspeedThresholdKmH: 80,
        overspeedGracePeriodSeconds: 10,
        harshBrakingEnabled: true,
        harshBrakingThresholdKmhPerSec: 20,
        excessiveIdleEnabled: true,
        excessiveIdleThresholdMinutes: 15,
        geofenceEntryAlertsEnabled: true,
        geofenceExitAlertsEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const config = await service.getCompanyConfig(mockCompanyId);
      expect(config.overspeedThresholdKmH).toBe(80);
      expect(db.companyAlertConfig.create).toHaveBeenCalled();
    });
  });

  describe('createAlert', () => {
    it('creates alert in DB and broadcasts through gateway', async () => {
      const now = new Date();
      db.fleetAlert.create.mockResolvedValue({
        id: mockAlertId,
        companyId: mockCompanyId,
        vehicleId: mockVehicleId,
        driverId: mockDriverId,
        tripId: null,
        geofenceId: null,
        type: 'OVERSPEED',
        severity: 'CRITICAL',
        status: 'OPEN',
        title: 'Overspeed Detected',
        message: 'Vehicle MH12AB1234 traveling at 110 km/h',
        metadata: { currentSpeed: 110 },
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 110,
        triggeredAt: now,
        acknowledgedAt: null,
        acknowledgedBy: null,
        resolvedAt: null,
        resolvedBy: null,
        dismissedAt: null,
        dismissedBy: null,
        resolutionNotes: null,
        createdAt: now,
        updatedAt: now,
        vehicle: { vehicleNumber: 'MH12AB1234' },
        driver: { driverCode: 'DRV-001', employee: { firstName: 'Rahul', lastName: 'Patil' } },
        trip: null,
        geofence: null,
      });

      const alert = await service.createAlert({
        companyId: mockCompanyId,
        vehicleId: mockVehicleId,
        driverId: mockDriverId,
        type: 'OVERSPEED',
        severity: 'CRITICAL',
        title: 'Overspeed Detected',
        message: 'Vehicle MH12AB1234 traveling at 110 km/h',
        speed: 110,
      });

      expect(alert.id).toBe(mockAlertId);
      expect(alert.vehicleNumber).toBe('MH12AB1234');
      expect(alert.driverName).toBe('Rahul Patil');
      expect(gateway.broadcastAlertCreated).toHaveBeenCalledWith(mockCompanyId, expect.objectContaining({ id: mockAlertId }));
    });
  });

  describe('acknowledgeAlert', () => {
    it('acknowledges OPEN alert and emits broadcast', async () => {
      db.fleetAlert.findFirst.mockResolvedValue({
        id: mockAlertId,
        companyId: mockCompanyId,
        status: 'OPEN',
      });

      const now = new Date();
      db.fleetAlert.update.mockResolvedValue({
        id: mockAlertId,
        companyId: mockCompanyId,
        vehicleId: mockVehicleId,
        status: 'ACKNOWLEDGED',
        acknowledgedAt: now,
        acknowledgedBy: mockUserId,
        resolutionNotes: 'Dispatched call to driver',
        triggeredAt: now,
        createdAt: now,
        updatedAt: now,
        type: 'OVERSPEED',
        severity: 'HIGH',
        title: 'Overspeed Detected',
        message: 'Test message',
      });

      const updated = await service.acknowledgeAlert(
        mockCompanyId,
        mockAlertId,
        mockUserId,
        'Dispatched call to driver',
      );

      expect(updated.status).toBe('ACKNOWLEDGED');
      expect(gateway.broadcastAlertAcknowledged).toHaveBeenCalled();
      expect(db.auditLog.create).toHaveBeenCalled();
    });

    it('rejects acknowledgement if alert is not OPEN', async () => {
      db.fleetAlert.findFirst.mockResolvedValue({
        id: mockAlertId,
        companyId: mockCompanyId,
        status: 'RESOLVED',
      });

      await expect(
        service.acknowledgeAlert(mockCompanyId, mockAlertId, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if alert not found in company', async () => {
      db.fleetAlert.findFirst.mockResolvedValue(null);

      await expect(
        service.acknowledgeAlert(mockCompanyId, 'other-company-alert', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('resolveAlert', () => {
    it('resolves alert and emits broadcast', async () => {
      db.fleetAlert.findFirst.mockResolvedValue({
        id: mockAlertId,
        companyId: mockCompanyId,
        status: 'ACKNOWLEDGED',
      });

      const now = new Date();
      db.fleetAlert.update.mockResolvedValue({
        id: mockAlertId,
        companyId: mockCompanyId,
        vehicleId: mockVehicleId,
        status: 'RESOLVED',
        resolvedAt: now,
        resolvedBy: mockUserId,
        resolutionNotes: 'Driver reduced speed',
        triggeredAt: now,
        createdAt: now,
        updatedAt: now,
        type: 'OVERSPEED',
        severity: 'HIGH',
        title: 'Overspeed Detected',
        message: 'Test message',
      });

      const resolved = await service.resolveAlert(
        mockCompanyId,
        mockAlertId,
        mockUserId,
        'Driver reduced speed',
      );

      expect(resolved.status).toBe('RESOLVED');
      expect(gateway.broadcastAlertResolved).toHaveBeenCalled();
      expect(db.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('getAlertSummary', () => {
    it('computes accurate KPI summaries', async () => {
      db.fleetAlert.count
        .mockResolvedValueOnce(5) // totalOpen
        .mockResolvedValueOnce(2) // critical
        .mockResolvedValueOnce(3) // high
        .mockResolvedValueOnce(1) // acknowledged
        .mockResolvedValueOnce(4) // resolvedToday
        .mockResolvedValueOnce(15); // totalAlerts

      const summary = await service.getAlertSummary(mockCompanyId);

      expect(summary.totalOpen).toBe(5);
      expect(summary.criticalCount).toBe(2);
      expect(summary.highCount).toBe(3);
      expect(summary.acknowledgedCount).toBe(1);
      expect(summary.resolvedTodayCount).toBe(4);
      expect(summary.totalAlerts).toBe(15);
    });
  });

  describe('Safety Analytics Foundation', () => {
    it('aggregates driver alerts correctly', async () => {
      db.fleetAlert.findMany.mockResolvedValue([
        {
          driverId: mockDriverId,
          type: 'OVERSPEED',
          severity: 'HIGH',
          driver: { id: mockDriverId, driverCode: 'DRV-001', employee: { firstName: 'John', lastName: 'Doe' } },
        },
        {
          driverId: mockDriverId,
          type: 'HARSH_BRAKING',
          severity: 'CRITICAL',
          driver: { id: mockDriverId, driverCode: 'DRV-001', employee: { firstName: 'John', lastName: 'Doe' } },
        },
      ]);

      const result = await service.getDriverSafetySummary(mockCompanyId);
      expect(result).toHaveLength(1);
      expect(result[0].driverCode).toBe('DRV-001');
      expect(result[0].totalAlerts).toBe(2);
      expect(result[0].overspeedCount).toBe(1);
      expect(result[0].harshBrakingCount).toBe(1);
      expect(result[0].highSeverityCount).toBe(2);
    });
  });
});
