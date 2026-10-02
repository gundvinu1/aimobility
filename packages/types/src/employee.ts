// =============================================================================
// Employee Management Types — Module 4
// =============================================================================

import type { UUID } from './common';

export type EmploymentStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED';
export type EmploymentType   = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'TEMPORARY' | 'INTERN';
export type EmployeeGender   = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export type EmployeeDepartment =
  | 'OPERATIONS'
  | 'DISPATCH'
  | 'ACCOUNTS'
  | 'HR'
  | 'SALES'
  | 'CUSTOMER_SUPPORT'
  | 'ADMINISTRATION'
  | 'MANAGEMENT'
  | 'OTHER';

/** Full employee record (as returned from API) */
export interface EmployeeDto {
  id: UUID;
  companyId: UUID;
  userId?: UUID | null;
  employeeNumber: string;

  // Personal
  firstName: string;
  middleName?: string | null;
  lastName: string;
  displayName?: string | null;
  gender?: EmployeeGender | null;
  dateOfBirth?: string | null;

  // Contact
  email?: string | null;
  phone: string;
  alternatePhone?: string | null;
  profileImageUrl?: string | null;

  // Address
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;

  // Employment
  department?: EmployeeDepartment | null;
  designation?: string | null;
  joiningDate: string;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;

  // Emergency
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;

  notes?: string | null;

  createdAt: string;
  updatedAt: string;
}

/** Compact employee summary (for list views) */
export interface EmployeeSummaryDto {
  id: UUID;
  companyId: UUID;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  email?: string | null;
  phone: string;
  department?: EmployeeDepartment | null;
  designation?: string | null;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  joiningDate: string;
  profileImageUrl?: string | null;
}

/** Paginated employee list response */
export interface EmployeeListDto {
  employees: EmployeeSummaryDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Stats summary for the employee dashboard */
export interface EmployeeStatsDto {
  total: number;
  active: number;
  inactive: number;
  onLeave: number;
  terminated: number;
  byDepartment: Record<string, number>;
  byEmploymentType: Record<string, number>;
  recentHires: number; // last 30 days
}
