import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { TenantContext } from '../types/tenant.type';

/**
 * @CurrentCompany() decorator
 *
 * Extracts the verified tenant context from the request.
 * Only available after TenantGuard has executed.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, TenantGuard)
 *   @Get()
 *   getCompanyData(@CurrentCompany() tenant: TenantContext) { ... }
 */
export const CurrentCompany = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext | undefined => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.tenant;
  },
);
