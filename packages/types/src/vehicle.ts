// =============================================================================
// Vehicle Management Types — Module 5
// =============================================================================

import type { UUID } from './common';

export type VehicleStatus    = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'RETIRED' | 'ON_TRIP';
export type FuelType         = 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'CNG' | 'LPG' | 'OTHER';
export type VehicleOwnership = 'OWNED' | 'LEASED' | 'RENTED';
export type VehicleDocumentType =
  | 'REGISTRATION_CERTIFICATE'
  | 'INSURANCE'
  | 'POLLUTION_CERTIFICATE'
  | 'FITNESS_CERTIFICATE'
  | 'PERMIT'
  | 'TAX_TOKEN'
  | 'OTHER';
export type MaintenanceType   = 'PREVENTIVE' | 'CORRECTIVE' | 'EMERGENCY' | 'INSPECTION' | 'OTHER';
export type MaintenanceStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/** Full vehicle record (as returned from API) */
export interface VehicleDto {
  id: UUID;
  companyId: UUID;

  // Identity
  vehicleNumber: string;
  make: string;
  model: string;
  year: number;
  color?: string | null;
  vin?: string | null;

  // Classification
  fuelType: FuelType;
  ownership: VehicleOwnership;
  status: VehicleStatus;
  capacity?: number | null;
  odometer: number;
  imageUrl?: string | null;

  // Registration
  registrationExpiry?: string | null;
  insuranceExpiry?: string | null;

  notes?: string | null;

  // Relations
  documents?: VehicleDocumentDto[];
  maintenances?: VehicleMaintenanceDto[];

  createdAt: string;
  updatedAt: string;
}

/** Compact vehicle summary (for list views) */
export interface VehicleSummaryDto {
  id: UUID;
  companyId: UUID;
  vehicleNumber: string;
  make: string;
  model: string;
  year: number;
  color?: string | null;
  fuelType: FuelType;
  ownership: VehicleOwnership;
  status: VehicleStatus;
  capacity?: number | null;
  odometer: number;
  imageUrl?: string | null;
  registrationExpiry?: string | null;
  insuranceExpiry?: string | null;
  createdAt: string;
}

/** Paginated vehicle list response */
export interface VehicleListDto {
  vehicles: VehicleSummaryDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Vehicle statistics */
export interface VehicleStatsDto {
  total: number;
  active: number;
  inactive: number;
  onTrip: number;
  maintenance: number;
  retired: number;
  byFuelType: Record<string, number>;
  byOwnership: Record<string, number>;
  expiringSoon: number; // docs expiring in ≤30 days
}

/** Vehicle document record */
export interface VehicleDocumentDto {
  id: UUID;
  vehicleId: UUID;
  companyId: UUID;
  documentType: VehicleDocumentType;
  name: string;
  documentNumber?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  fileUrl?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Vehicle maintenance record */
export interface VehicleMaintenanceDto {
  id: UUID;
  vehicleId: UUID;
  companyId: UUID;
  maintenanceType: MaintenanceType;
  status: MaintenanceStatus;
  description: string;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  odometerAtService?: number | null;
  cost?: string | null;
  vendor?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}
