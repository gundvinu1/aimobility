// =============================================================================
// Authentication & Authorization Types
// =============================================================================

import type { UUID } from './common';

/** User status values */
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';

/** Minimal user shape returned in responses */
export interface UserDto {
  id: UUID;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: string;
}

/** Role shape */
export interface RoleDto {
  id: UUID;
  name: string;
  description?: string | null;
  scope?: 'PLATFORM' | 'COMPANY';
  level?: number;
  isSystem?: boolean;
  companyId?: UUID | null;
  permissionCount?: number;
}

/** Member assigned to a role */
export interface RoleMemberDto {
  id: UUID;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  assignedAt: string;
}

/** Detailed role with full permissions list and assigned members */
export interface RoleDetailDto {
  id: UUID;
  name: string;
  description?: string | null;
  scope: 'PLATFORM' | 'COMPANY';
  level: number;
  isSystem: boolean;
  companyId?: UUID | null;
  permissionCount: number;
  permissions: PermissionDto[];
  userCount?: number;
  users?: RoleMemberDto[];
  createdAt: string;
  updatedAt: string;
}

/** Role with permissions and members */
export interface RoleWithPermissionsDto extends RoleDetailDto {}

/** Role Permission junction shape */
export interface RolePermissionDto {
  roleId: UUID;
  permissionId: UUID;
  assignedAt?: string;
  permission?: PermissionDto;
}

/** Summary role for lists */
export interface RoleSummaryDto {
  id: UUID;
  name: string;
  description?: string | null;
  scope: 'PLATFORM' | 'COMPANY';
  level: number;
  isSystem: boolean;
  companyId?: UUID | null;
  permissionCount: number;
  userCount?: number;
  createdAt: string;
  updatedAt?: string;
}

/** Permission shape */
export interface PermissionDto {
  id: UUID;
  name: string;
  description?: string | null;
  module?: string | null;
  action?: string | null;
}

/** Request to create a new custom role */
export interface CreateRoleRequest {
  name: string;
  description?: string;
  scope?: 'PLATFORM' | 'COMPANY';
  level?: number;
  permissionIds?: string[];
}

/** Request to update a role */
export interface UpdateRoleRequest {
  name?: string;
  description?: string;
}

/** Request to update role permissions */
export interface UpdateRolePermissionsRequest {
  permissionIds: string[];
}

/** Current authenticated user (full profile) */
export interface CurrentUserDto extends UserDto {
  roles: string[];
  permissions: string[];
  activeCompany?: { id: UUID; name: string; role: string } | null;
  companyRole?: string | null;
}

/** Auth response returned on login / refresh */
export interface AuthTokens {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

/** Registration request */
export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/** Login request */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Refresh token request */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/** Change password request */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** Forgot password request */
export interface ForgotPasswordRequest {
  email: string;
}

/** Reset password request */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

/** Verify email request */
export interface VerifyEmailRequest {
  token: string;
}

/** JWT access token payload (minimal — no sensitive data) */
export interface JwtPayload {
  sub: UUID;      // userId
  jti?: string;   // optional token ID
  type: 'access';
  iat?: number;
  exp?: number;
}
