// =============================================================================
// Fleet Tracking & Telemetry Types — Module 9
// =============================================================================

import type { UUID } from './common';

export type TelemetrySource = 'MANUAL' | 'MOBILE' | 'GPS_DEVICE' | 'IOT' | 'SIMULATOR' | 'API';

/** Fleet vehicle status (live tracking view) */
export type FleetVehicleStatus = 'ACTIVE' | 'IDLE' | 'ON_TRIP' | 'OFFLINE' | 'MAINTENANCE';

/** Telemetry ingest payload (from device/API) */
export interface IngestTelemetryDto {
  vehicleId: UUID;
  driverId?: UUID | null;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  altitude?: number;
  ignition?: boolean;
  batteryLevel?: number;
  odometer?: number;
  engineTemperature?: number;
  fuelLevel?: number;
  signalStrength?: number;
  source?: TelemetrySource;
  timestamp: string; // ISO 8601
}

/** Latest vehicle location record */
export interface VehicleLocationDto {
  id: UUID;
  companyId: UUID;
  vehicleId: UUID;
  driverId?: UUID | null;
  latitude: number;
  longitude: number;
  speed: number;
  heading?: number | null;
  accuracy?: number | null;
  altitude?: number | null;
  ignition: boolean;
  batteryLevel?: number | null;
  odometer?: number | null;
  engineTemperature?: number | null;
  fuelLevel?: number | null;
  signalStrength?: number | null;
  source: TelemetrySource;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
}

/** Historical telemetry event */
export interface VehicleTelemetryDto {
  id: UUID;
  companyId: UUID;
  vehicleId: UUID;
  driverId?: UUID | null;
  latitude: number;
  longitude: number;
  speed: number;
  heading?: number | null;
  accuracy?: number | null;
  altitude?: number | null;
  ignition: boolean;
  batteryLevel?: number | null;
  odometer?: number | null;
  engineTemperature?: number | null;
  fuelLevel?: number | null;
  signalStrength?: number | null;
  source: TelemetrySource;
  timestamp: string;
  createdAt: string;
}

/** Paginated telemetry history */
export interface VehicleTelemetryListDto {
  telemetry: VehicleTelemetryDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Rich vehicle object for fleet tracking map */
export interface FleetTrackingVehicleDto {
  vehicleId: UUID;
  companyId: UUID;
  vehicleNumber: string;
  make: string;
  model: string;
  year: number;
  color?: string | null;
  vehicleStatus: string;         // VehicleStatus from DB
  fleetStatus: FleetVehicleStatus; // Derived: OFFLINE if no recent telemetry
  driverId?: UUID | null;
  driverCode?: string | null;
  driverName?: string | null;
  driverDutyStatus?: string | null;
  currentTripId?: UUID | null;
  currentTripNumber?: string | null;
  location?: VehicleLocationDto | null;
  lastSeenAt?: string | null;    // Timestamp of last telemetry
  isOnline: boolean;             // True if within TELEMETRY_OFFLINE_THRESHOLD
}

/** Fleet snapshot — all vehicles with current location */
export interface FleetSnapshotDto {
  companyId: UUID;
  vehicles: FleetTrackingVehicleDto[];
  totalVehicles: number;
  onlineCount: number;
  offlineCount: number;
  onTripCount: number;
  fetchedAt: string;
}

/** WebSocket event payload: vehicle location updated */
export interface VehicleLocationUpdatedEvent {
  event: 'vehicle.location.updated';
  data: {
    companyId: UUID;
    vehicleId: UUID;
    location: VehicleLocationDto;
    fleetStatus: FleetVehicleStatus;
    driverId?: UUID | null;
    driverName?: string | null;
    currentTripId?: UUID | null;
  };
}

/** WebSocket event payload: vehicle status updated */
export interface VehicleStatusUpdatedEvent {
  event: 'vehicle.status.updated';
  data: {
    companyId: UUID;
    vehicleId: UUID;
    vehicleStatus: string;
    fleetStatus: FleetVehicleStatus;
  };
}
