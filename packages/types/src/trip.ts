// =============================================================================
// Trip Management Types — Module 7
// =============================================================================

import type { UUID } from './common';

export type TripType = 'ONE_WAY' | 'ROUND_TRIP' | 'RENTAL' | 'OUTSTATION' | 'AIRPORT_TRANSFER';

export type TripStatus =
  | 'SCHEDULED'
  | 'DRIVER_ASSIGNED'
  | 'VEHICLE_ASSIGNED'
  | 'DISPATCHED'
  | 'DRIVER_ARRIVED'
  | 'PASSENGER_ONBOARD'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

/** Status history record for a trip */
export interface TripStatusHistoryDto {
  id: UUID;
  tripId: UUID;
  status: TripStatus;
  changedAt: string;
  changedBy?: UUID | null;
  notes?: string | null;
}

/** Embedded minimal vehicle info for trip views */
export interface TripVehicleInfo {
  id: UUID;
  vehicleNumber: string;
  make: string;
  model: string;
  year?: number;
  status?: string;
}

/** Embedded minimal driver info for trip views */
export interface TripDriverInfo {
  id: UUID;
  driverCode: string;
  dutyStatus?: string;
  employee?: {
    id: UUID;
    firstName: string;
    lastName: string;
    phone: string;
  } | null;
}

/** Minimal trip summary for list & dispatch views */
export interface TripSummaryDto {
  id: UUID;
  companyId: UUID;
  tripNumber: string;
  bookingId?: UUID | null;
  bookingNumber?: string | null;
  vehicleId?: UUID | null;
  driverId?: UUID | null;
  tripType: TripType;
  status: TripStatus;
  originAddress: string;
  destinationAddress: string;
  scheduledStartTime: string;
  scheduledEndTime?: string | null;
  actualStartTime?: string | null;
  actualEndTime?: string | null;
  distanceKm?: number | null;
  fareAmount?: number | null;
  vehicle?: TripVehicleInfo | null;
  driver?: TripDriverInfo | null;
  createdAt: string;
}

/** Full trip detail */
export interface TripDto extends TripSummaryDto {
  originLatitude?: number | null;
  originLongitude?: number | null;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  startOdometer?: number | null;
  endOdometer?: number | null;
  notes?: string | null;
  statusHistory?: TripStatusHistoryDto[];
  updatedAt: string;
}

/** Paginated trip list response */
export interface TripListDto {
  trips: TripSummaryDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Trip operational statistics */
export interface TripStatsDto {
  total: number;
  scheduled: number;
  assigned: number; // DRIVER_ASSIGNED or VEHICLE_ASSIGNED
  dispatched: number;
  active: number; // DRIVER_ARRIVED, PASSENGER_ONBOARD, IN_PROGRESS
  completed: number;
  cancelled: number;
  noShow: number;
  todayCount: number;
}

/** Create trip payload */
export interface CreateTripPayload {
  bookingId?: UUID;
  vehicleId?: UUID;
  driverId?: UUID;
  tripType?: TripType;
  originAddress: string;
  destinationAddress: string;
  originLatitude?: number;
  originLongitude?: number;
  destinationLatitude?: number;
  destinationLongitude?: number;
  scheduledStartTime: string;
  scheduledEndTime?: string;
  distanceKm?: number;
  fareAmount?: number;
  notes?: string;
}

/** Update trip payload */
export interface UpdateTripPayload {
  originAddress?: string;
  destinationAddress?: string;
  originLatitude?: number;
  originLongitude?: number;
  destinationLatitude?: number;
  destinationLongitude?: number;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  distanceKm?: number;
  fareAmount?: number;
  startOdometer?: number;
  endOdometer?: number;
  notes?: string;
}

/** Assign driver payload */
export interface AssignDriverPayload {
  driverId: UUID;
  notes?: string;
}

/** Assign vehicle payload */
export interface AssignVehiclePayload {
  vehicleId: UUID;
  notes?: string;
}

/** Dispatch trip payload */
export interface DispatchTripPayload {
  notes?: string;
}

/** Update trip status payload */
export interface UpdateTripStatusPayload {
  status: TripStatus;
  notes?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  startOdometer?: number;
  endOdometer?: number;
  distanceKm?: number;
  fareAmount?: number;
}
