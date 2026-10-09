// =============================================================================
// Fleet Alert & Safety Analytics Types — Module 10
// =============================================================================

import type { UUID } from './common';

export type FleetAlertType =
  | 'GEOFENCE_ENTRY'
  | 'GEOFENCE_EXIT'
  | 'OVERSPEED'
  | 'HARSH_BRAKING'
  | 'EXCESSIVE_IDLE'
  | 'FUEL_DROP'
  | 'MAINTENANCE_DUE';

export type FleetAlertSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type FleetAlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';

export interface FleetAlertDto {
  id: UUID;
  companyId: UUID;
  vehicleId: UUID;
  vehicleNumber?: string;
  driverId?: UUID | null;
  driverName?: string | null;
  tripId?: UUID | null;
  tripNumber?: string | null;
  geofenceId?: UUID | null;
  geofenceName?: string | null;
  type: FleetAlertType;
  severity: FleetAlertSeverity;
  status: FleetAlertStatus;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  latitude?: number | null;
  longitude?: number | null;
  speed?: number | null;
  triggeredAt: string;
  acknowledgedAt?: string | null;
  acknowledgedBy?: UUID | null;
  resolvedAt?: string | null;
  resolvedBy?: UUID | null;
  dismissedAt?: string | null;
  dismissedBy?: UUID | null;
  resolutionNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FleetAlertListDto {
  alerts: FleetAlertDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FleetAlertSummaryDto {
  totalOpen: number;
  criticalCount: number;
  highCount: number;
  acknowledgedCount: number;
  resolvedTodayCount: number;
  totalAlerts: number;
}

export interface CompanyAlertConfigDto {
  id: UUID;
  companyId: UUID;
  overspeedEnabled: boolean;
  overspeedThresholdKmH: number;
  overspeedGracePeriodSeconds: number;
  harshBrakingEnabled: boolean;
  harshBrakingThresholdKmhPerSec: number;
  excessiveIdleEnabled: boolean;
  excessiveIdleThresholdMinutes: number;
  geofenceEntryAlertsEnabled: boolean;
  geofenceExitAlertsEnabled: boolean;
  fuelDropEnabled: boolean;
  fuelDropThresholdLiters: number;
  maintenanceAlertsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateCompanyAlertConfigDto {
  overspeedEnabled?: boolean;
  overspeedThresholdKmH?: number;
  overspeedGracePeriodSeconds?: number;
  harshBrakingEnabled?: boolean;
  harshBrakingThresholdKmhPerSec?: number;
  excessiveIdleEnabled?: boolean;
  excessiveIdleThresholdMinutes?: number;
  geofenceEntryAlertsEnabled?: boolean;
  geofenceExitAlertsEnabled?: boolean;
  fuelDropEnabled?: boolean;
  fuelDropThresholdLiters?: number;
  maintenanceAlertsEnabled?: boolean;
}

export interface DriverSafetySummaryDto {
  driverId: UUID;
  driverCode: string;
  driverName: string;
  totalAlerts: number;
  overspeedCount: number;
  harshBrakingCount: number;
  excessiveIdleCount: number;
  geofenceViolationsCount: number;
  highSeverityCount: number;
}

export interface VehicleSafetySummaryDto {
  vehicleId: UUID;
  vehicleNumber: string;
  totalAlerts: number;
  overspeedCount: number;
  harshBrakingCount: number;
  excessiveIdleCount: number;
  geofenceViolationsCount: number;
  highSeverityCount: number;
}

export interface FleetAlertCreatedEvent {
  event: 'fleet.alert.created';
  data: FleetAlertDto;
}

export interface FleetAlertUpdatedEvent {
  event: 'fleet.alert.updated';
  data: FleetAlertDto;
}

export interface FleetAlertAcknowledgedEvent {
  event: 'fleet.alert.acknowledged';
  data: FleetAlertDto;
}

export interface FleetAlertResolvedEvent {
  event: 'fleet.alert.resolved';
  data: FleetAlertDto;
}
