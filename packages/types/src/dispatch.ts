// =============================================================================
// Dispatch, Route Planning & Trip Optimization Types — Module 12
// =============================================================================

import type { UUID } from './common';
import type { TripStatus } from './trip';

/** Stop/Waypoint Type */
export type StopType = 'PICKUP' | 'WAYPOINT' | 'DROPOFF';

/** Stop Execution Status */
export type StopStatus = 'PENDING' | 'ARRIVED' | 'COMPLETED' | 'SKIPPED';

/** Geographic coordinates */
export interface RouteCoordinates {
  latitude: number;
  longitude: number;
}

/** Waypoint Stop Representation */
export interface TripStopDto {
  id: UUID;
  companyId: UUID;
  tripId: UUID;
  stopOrder: number;
  stopType: StopType;
  locationName: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  plannedArrival?: string | null;
  plannedDeparture?: string | null;
  actualArrival?: string | null;
  actualDeparture?: string | null;
  passengerName?: string | null;
  passengerPhone?: string | null;
  notes?: string | null;
  status: StopStatus;
  createdAt: string;
  updatedAt: string;
}

/** Payload to create a stop */
export interface CreateTripStopPayload {
  stopOrder?: number;
  stopType?: StopType;
  locationName: string;
  address?: string;
  latitude: number;
  longitude: number;
  plannedArrival?: string;
  plannedDeparture?: string;
  passengerName?: string;
  passengerPhone?: string;
  notes?: string;
}

/** Payload to update a stop */
export interface UpdateTripStopPayload {
  stopType?: StopType;
  locationName?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  plannedArrival?: string;
  plannedDeparture?: string;
  actualArrival?: string;
  actualDeparture?: string;
  passengerName?: string;
  passengerPhone?: string;
  notes?: string;
  status?: StopStatus;
}

/** Payload to reorder stops */
export interface ReorderTripStopsPayload {
  stopIds: UUID[];
}

/** Route Calculation Response */
export interface RouteCalculationResult {
  distanceKm: number;
  durationMinutes: number;
  geometryPolyline: string;
  waypointsOrder: number[];
}

/** Dynamic ETA estimate */
export interface EtaEstimateDto {
  tripId: UUID;
  currentLatitude?: number;
  currentLongitude?: number;
  destinationLatitude: number;
  destinationLongitude: number;
  distanceRemainingKm: number;
  durationRemainingMinutes: number;
  calculatedAt: string;
  calculationSource: 'MOCK' | 'OSRM' | 'GOOGLE';
}

/** Driver availability item for dispatchers */
export interface DriverAvailabilityDto {
  id: UUID;
  driverCode: string;
  name: string;
  dutyStatus: string;
  status: string;
  isAvailable: boolean;
  conflictReason?: string;
}

/** Vehicle availability item for dispatchers */
export interface VehicleAvailabilityDto {
  id: UUID;
  vehicleNumber: string;
  make: string;
  model: string;
  status: string;
  isAvailable: boolean;
  conflictReason?: string;
}

/** Consolidated availability response */
export interface DispatchAvailabilityResponseDto {
  drivers: DriverAvailabilityDto[];
  vehicles: VehicleAvailabilityDto[];
}

/** Operational Dispatch Analytics */
export interface DispatchAnalyticsDto {
  totalScheduled: number;
  unassignedTrips: number;
  assignedTrips: number;
  completedTrips: number;
  cancelledTrips: number;
  reassignmentCount: number;
  averageLeadTimeMinutes: number | null;
  driverUtilizationRate: number | null;
  vehicleUtilizationRate: number | null;
  onTimePickupRate: number | null;
  averageDelayMinutes: number | null;
  reportingPeriod: string;
}

/** WebSocket event payload for dispatch assignments */
export interface DispatchTripAssignedEvent {
  tripId: UUID;
  companyId: UUID;
  tripNumber: string;
  driverId?: UUID | null;
  vehicleId?: UUID | null;
  status: TripStatus;
  timestamp: string;
}

/** WebSocket event payload for unassignment */
export interface DispatchTripUnassignedEvent {
  tripId: UUID;
  companyId: UUID;
  tripNumber: string;
  unassignedType: 'DRIVER' | 'VEHICLE';
  status: TripStatus;
  timestamp: string;
}
