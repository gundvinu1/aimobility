import { SetMetadata } from '@nestjs/common';
import type { RoleName } from '@ai-mos/constants';

export const ROLES_KEY = 'roles';

/**
 * Require one or more roles on a route.
 * Usage: @Roles('ADMIN', 'OWNER')
 */
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
