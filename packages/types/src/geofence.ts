// =============================================================================
// Geofencing Types — Module 10
// =============================================================================

import type { UUID } from './common';

export type GeofenceType = 'CIRCLE' | 'POLYGON';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface CircleGeometry {
  center: LatLng;
  radiusMeters: number;
}

export interface PolygonGeometry {
  coordinates: LatLng[];
}

export type GeofenceGeometry = CircleGeometry | PolygonGeometry;

export interface GeofenceDto {
  id: UUID;
  companyId: UUID;
  name: string;
  description?: string | null;
  type: GeofenceType;
  geometry: GeofenceGeometry;
  color: string;
  isActive: boolean;
  entryAlertEnabled: boolean;
  exitAlertEnabled: boolean;
  assignedVehiclesCount?: number;
  createdBy?: UUID | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGeofenceDto {
  name: string;
  description?: string;
  type: GeofenceType;
  geometry: GeofenceGeometry;
  color?: string;
  isActive?: boolean;
  entryAlertEnabled?: boolean;
  exitAlertEnabled?: boolean;
  vehicleIds?: UUID[];
}

export interface UpdateGeofenceDto {
  name?: string;
  description?: string;
  type?: GeofenceType;
  geometry?: GeofenceGeometry;
  color?: string;
  isActive?: boolean;
  entryAlertEnabled?: boolean;
  exitAlertEnabled?: boolean;
  vehicleIds?: UUID[];
}

export interface GeofenceVehicleDto {
  id: UUID;
  companyId: UUID;
  geofenceId: UUID;
  vehicleId: UUID;
  assignedAt: string;
  vehicleNumber?: string;
  vehicleMakeModel?: string;
}

export interface AssignVehiclesDto {
  vehicleIds: UUID[];
}
