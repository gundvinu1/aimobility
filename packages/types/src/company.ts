// =============================================================================
// Company + Multi-Tenant Types — Module 3
// =============================================================================

import type { UUID } from './common';

/** Company status */
export type CompanyStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

/** Company membership role (separate from platform RBAC) */
export type CompanyRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER';

/** Membership status */
export type MembershipStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';

/** Full company record (admin view) */
export interface CompanyDto {
  id: UUID;
  name: string;
  legalName?: string | null;
  slug: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  timezone: string;
  currency: string;
  status: CompanyStatus;
  createdAt: string;
  updatedAt: string;
}

/** Compact company summary (for lists, selectors) */
export interface CompanySummaryDto {
  id: UUID;
  name: string;
  slug: string;
  logoUrl?: string | null;
  status: CompanyStatus;
  role: CompanyRole;       // current user's role in this company
  memberCount?: number;
}

/** Company settings */
export interface CompanySettingsDto {
  id: UUID;
  companyId: UUID;
  timezone: string;
  currency: string;
  dateFormat: string;
  timeFormat: string;
  language: string;
  updatedAt: string;
}

/** Company member record */
export interface CompanyMemberDto {
  id: UUID;         // membership id
  userId: UUID;
  companyId: UUID;
  role: CompanyRole;
  status: MembershipStatus;
  joinedAt: string;
  user: {
    id: UUID;
    email: string;
    firstName: string;
    lastName: string;
  };
}

/** Company invitation record */
export interface CompanyInvitationDto {
  id: UUID;
  companyId: UUID;
  email: string;
  role: CompanyRole;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

/** Tenant context available to backend handlers */
export interface TenantContext {
  companyId: UUID;
  role: CompanyRole;
  membershipId: UUID;
  status: MembershipStatus;
}

/** Company creation request */
export interface CreateCompanyRequest {
  name: string;
  legalName?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  timezone?: string;
  currency?: string;
}

/** Company update request */
export interface UpdateCompanyRequest extends Partial<CreateCompanyRequest> {}

/** Update company settings request */
export interface UpdateCompanySettingsRequest {
  timezone?: string;
  currency?: string;
  dateFormat?: string;
  timeFormat?: string;
  language?: string;
}

/** Update membership request */
export interface UpdateMemberRequest {
  role?: CompanyRole;
  status?: MembershipStatus;
}

/** Create invitation request */
export interface CreateInvitationRequest {
  email: string;
  role?: CompanyRole;
}
