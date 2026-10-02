// =============================================================================
// Driver Management Types — Module 6
// =============================================================================

import type { UUID } from './common';

export type DriverStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TERMINATED';
export type DriverDutyStatus = 'OFF_DUTY' | 'ON_DUTY' | 'ON_TRIP' | 'ON_BREAK' | 'UNAVAILABLE';
export type LicenseType = 'LMV' | 'HMV' | 'COMMERCIAL' | 'TRANSPORT' | 'OTHER';
export type DriverDocumentType =
  | 'DRIVING_LICENSE'
  | 'BADGE'
  | 'POLICE_VERIFICATION'
  | 'MEDICAL_CERTIFICATE'
  | 'IDENTITY_PROOF'
  | 'ADDRESS_PROOF'
  | 'OTHER';

/** Minimal employee info embedded with driver */
export interface DriverEmployeeInfo {
  id: UUID;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  employmentStatus: string;
}

/** Minimal assigned vehicle info */
export interface DriverAssignedVehicleInfo {
  id: UUID;
  vehicleNumber: string;
  make: string;
  model: string;
  year?: number;
  status?: string;
  assignmentId?: UUID;
  assignedAt?: string;
}

/** Driver summary for list views */
export interface DriverSummaryDto {
  id: UUID;
  companyId: UUID;
  employeeId?: UUID | null;
  driverCode: string;
  licenseNumber: string;
  licenseType: LicenseType;
  licenseExpiryDate: string;
  experienceYears: number;
  status: DriverStatus;
  dutyStatus: DriverDutyStatus;
  joiningDate: string;
  employee?: DriverEmployeeInfo | null;
  assignedVehicle?: DriverAssignedVehicleInfo | null;
  createdAt: string;
}

/** Full driver detail */
export interface DriverDto extends DriverSummaryDto {
  licenseIssueDate?: string | null;
  licenseIssuingAuthority?: string | null;
  badgeNumber?: string | null;
  badgeExpiryDate?: string | null;
  bloodGroup?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  notes?: string | null;
  documents?: DriverDocumentDto[];
  dutyLogs?: DriverDutyLogDto[];
  vehicleAssignments?: DriverVehicleAssignmentDto[];
  updatedAt: string;
}

/** Paginated driver list response */
export interface DriverListDto {
  drivers: DriverSummaryDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Driver statistics */
export interface DriverStatsDto {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  terminated: number;
  onDuty: number;
  offDuty: number;
  onTrip: number;
  onBreak: number;
  unavailable: number;
  expiringLicenses: number; // licenses expiring in ≤ 30 days
}

/** Driver document */
export interface DriverDocumentDto {
  id: UUID;
  driverId: UUID;
  companyId: UUID;
  documentType: DriverDocumentType;
  documentNumber?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  fileUrl?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Driver duty log */
export interface DriverDutyLogDto {
  id: UUID;
  driverId: UUID;
  companyId: UUID;
  status: DriverDutyStatus;
  startedAt: string;
  endedAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

/** Driver vehicle assignment */
export interface DriverVehicleAssignmentDto {
  id: UUID;
  companyId: UUID;
  driverId: UUID;
  vehicleId: UUID;
  assignedAt: string;
  unassignedAt?: string | null;
  isActive: boolean;
  notes?: string | null;
  vehicle?: {
    id: UUID;
    vehicleNumber: string;
    make: string;
    model: string;
    year?: number;
    status?: string;
  } | null;
  driver?: {
    id: UUID;
    driverCode: string;
    employee?: {
      firstName: string;
      lastName: string;
    } | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}
