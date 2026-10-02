import { SetMetadata } from '@nestjs/common';
import type { CompanyRole } from '@prisma/client';

export const COMPANY_ROLES_KEY = 'companyRoles';

/**
 * @CompanyRoles() decorator
 *
 * Specifies which company-level roles are allowed to access a route.
 * Must be used together with TenantGuard which reads this metadata.
 *
 * Usage:
 *   @CompanyRoles('OWNER', 'ADMIN')
 *   @Patch(':companyId')
 *   update(...) {}
 */
export const CompanyRoles = (...roles: CompanyRole[]) =>
  SetMetadata(COMPANY_ROLES_KEY, roles);
