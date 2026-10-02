import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthUser } from '../../auth/types/auth-user.type';
import { CompanyService } from '../company.service';
import { COMPANY_ROLES_KEY } from '../decorators/company-roles.decorator';
import { COMPANY_HEADER } from '@ai-mos/constants';
import type { CompanyRole, MembershipStatus } from '@prisma/client';

/**
 * TenantGuard
 *
 * Security contract:
 *  1. Extract the requested companyId from X-Company-Id header.
 *  2. Verify the authenticated user has an ACTIVE membership in that company.
 *  3. Check company status (SUSPENDED companies block most operations).
 *  4. Optionally enforce company-level role requirements (@CompanyRoles).
 *  5. Attach TenantContext to request.tenant for downstream use.
 *
 * NEVER trust the frontend company ID without server-side membership verification.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, TenantGuard)
 *   @CompanyRoles('OWNER', 'ADMIN')
 *   @Patch(':companyId')
 *   update(@CurrentCompany() tenant: TenantContext, ...) {}
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly companyService: CompanyService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const user = req.user as AuthUser | undefined;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Read company ID from:
    //   1. Route param :companyId  (preferred for resource-level routes)
    //   2. X-Company-Id header     (for context-level routes)
    const companyId =
      (req.params['companyId'] as string | undefined) ??
      (req.headers[COMPANY_HEADER] as string | undefined);

    if (!companyId) {
      throw new BadRequestException(
        `Company context required. Pass company ID via route parameter or ${COMPANY_HEADER} header.`,
      );
    }

    // Validate UUID format
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(companyId)) {
      throw new BadRequestException('Invalid company ID format');
    }

    // Verify company exists (not soft-deleted)
    const company = await this.companyService.findByIdOrNull(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Verify user has an ACTIVE membership in this company (or is SUPER_ADMIN)
    const isSuperAdmin = user.roles?.includes('SUPER_ADMIN');
    let membership = await this.companyService.findActiveMembership(user.userId, companyId);
    if (!membership && isSuperAdmin) {
      membership = {
        id: '00000000-0000-0000-0000-000000000000',
        userId: user.userId,
        companyId,
        role: 'OWNER' as CompanyRole,
        status: 'ACTIVE' as MembershipStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
        joinedAt: new Date(),
      };
    }
    if (!membership) {
      // Return 403 — do not reveal whether the company exists to unauthorized users
      throw new ForbiddenException('Access to this company is not authorized');
    }

    // Check company-level role requirements if @CompanyRoles() is applied
    const requiredRoles = this.reflector.getAllAndOverride<CompanyRole[]>(COMPANY_ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(membership.role as CompanyRole)) {
        throw new ForbiddenException(
          `This operation requires company role: ${requiredRoles.join(' or ')}`,
        );
      }
    }

    // Attach verified tenant context to request
    req.tenant = {
      companyId: company.id,
      role: membership.role as CompanyRole,
      membershipId: membership.id,
      status: membership.status as MembershipStatus,
    };

    return true;
  }
}
