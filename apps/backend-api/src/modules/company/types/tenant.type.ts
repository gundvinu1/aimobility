import type { CompanyRole, MembershipStatus } from '@prisma/client';

/**
 * Tenant context injected into the request by TenantGuard.
 * Represents the verified company membership of the current user.
 */
export interface TenantContext {
  companyId: string;
  role: CompanyRole;
  membershipId: string;
  status: MembershipStatus;
}

// Extend Express Request to include tenant context
declare module 'express' {
  interface Request {
    tenant?: TenantContext;
  }
}
