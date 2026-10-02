// =============================================================================
// Company + Multi-Tenant Constants — Module 3
// =============================================================================

/** Company status values */
export const COMPANY_STATUS = {
  ACTIVE:    'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  INACTIVE:  'INACTIVE',
} as const;

export type CompanyStatusValue = (typeof COMPANY_STATUS)[keyof typeof COMPANY_STATUS];

/** Company-level membership roles (separate from platform RBAC) */
export const COMPANY_ROLES = {
  OWNER:   'OWNER',
  ADMIN:   'ADMIN',
  MANAGER: 'MANAGER',
  MEMBER:  'MEMBER',
} as const;

export type CompanyRoleValue = (typeof COMPANY_ROLES)[keyof typeof COMPANY_ROLES];

/** Company membership statuses */
export const MEMBERSHIP_STATUS = {
  ACTIVE:    'ACTIVE',
  INVITED:   'INVITED',
  SUSPENDED: 'SUSPENDED',
  REMOVED:   'REMOVED',
} as const;

export type MembershipStatusValue = (typeof MEMBERSHIP_STATUS)[keyof typeof MEMBERSHIP_STATUS];

/**
 * Company roles that can perform admin-level operations (update, manage members, etc.)
 * Used for authorization checks throughout the company module.
 */
export const COMPANY_ADMIN_ROLES: CompanyRoleValue[] = [
  COMPANY_ROLES.OWNER,
  COMPANY_ROLES.ADMIN,
];

/** Audit event types for company actions */
export const COMPANY_AUDIT_EVENTS = {
  // Company lifecycle
  COMPANY_CREATED:     'COMPANY_CREATED',
  COMPANY_UPDATED:     'COMPANY_UPDATED',
  COMPANY_SUSPENDED:   'COMPANY_SUSPENDED',
  COMPANY_ACTIVATED:   'COMPANY_ACTIVATED',
  COMPANY_DEACTIVATED: 'COMPANY_DEACTIVATED',

  // Membership
  COMPANY_MEMBER_ADDED:     'COMPANY_MEMBER_ADDED',
  COMPANY_MEMBER_UPDATED:   'COMPANY_MEMBER_UPDATED',
  COMPANY_MEMBER_SUSPENDED: 'COMPANY_MEMBER_SUSPENDED',
  COMPANY_MEMBER_REMOVED:   'COMPANY_MEMBER_REMOVED',

  // Invitations
  COMPANY_INVITATION_CREATED:  'COMPANY_INVITATION_CREATED',
  COMPANY_INVITATION_ACCEPTED: 'COMPANY_INVITATION_ACCEPTED',
  COMPANY_INVITATION_REVOKED:  'COMPANY_INVITATION_REVOKED',

  // Context
  COMPANY_SWITCHED: 'COMPANY_SWITCHED',

  // Settings
  COMPANY_SETTINGS_UPDATED: 'COMPANY_SETTINGS_UPDATED',
} as const;

export type CompanyAuditEvent = (typeof COMPANY_AUDIT_EVENTS)[keyof typeof COMPANY_AUDIT_EVENTS];

/** Module 3 permissions */
export const COMPANY_PERMISSIONS = {
  // Company CRUD
  COMPANY_READ:   'company.read',
  COMPANY_CREATE: 'company.create',
  COMPANY_UPDATE: 'company.update',
  COMPANY_DELETE: 'company.delete',

  // Settings
  COMPANY_SETTINGS_READ:  'company.settings.read',
  COMPANY_SETTINGS_WRITE: 'company.settings.write',

  // Members
  COMPANY_MEMBERS_READ:  'company.members.read',
  COMPANY_MEMBERS_WRITE: 'company.members.write',

  // Invitations
  COMPANY_INVITE: 'company.invite',
} as const;

export type CompanyPermission = (typeof COMPANY_PERMISSIONS)[keyof typeof COMPANY_PERMISSIONS];

/** X-Company-Id header name used for tenant context */
export const COMPANY_HEADER = 'x-company-id';
