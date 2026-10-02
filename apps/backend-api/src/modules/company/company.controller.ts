import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { TenantGuard } from './guards/tenant.guard';
import { CurrentCompany } from './decorators/current-company.decorator';
import { CompanyRoles } from './decorators/company-roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import type { TenantContext } from './types/tenant.type';
import type { CompanyStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class UpdateStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED', 'INACTIVE'] })
  @IsEnum(['ACTIVE', 'SUSPENDED', 'INACTIVE'])
  status!: CompanyStatus;
}

function getMeta(req: Request) {
  return {
    ipAddress: (req.headers['x-forwarded-for'] as string) ?? req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    requestId: req.headers['x-request-id'] as string,
  };
}

@ApiTags('Companies')
@ApiBearerAuth()
@Controller('companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  // ─── Create Company ─────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new company (caller becomes OWNER)' })
  @ApiResponse({ status: 201, description: 'Company created successfully' })
  @ApiResponse({ status: 409, description: 'Slug conflict' })
  async create(
    @Body() dto: CreateCompanyDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.companyService.createCompany(dto, user.userId, getMeta(req));
  }

  // ─── List user's companies ──────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: "List authenticated user's companies" })
  @ApiResponse({ status: 200, description: 'Company list' })
  async list(@CurrentUser() user: AuthUser) {
    return this.companyService.listUserCompanies(user.userId);
  }

  // ─── Get Company ────────────────────────────────────────────────────────────

  @Get(':companyId')
  @UseGuards(TenantGuard)
  @ApiOperation({ summary: 'Get company details (membership required)' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Company details' })
  @ApiResponse({ status: 403, description: 'Not a member of this company' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async getOne(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentCompany() _tenant: TenantContext,
  ) {
    return this.companyService.getCompany(companyId);
  }

  // ─── Update Company ─────────────────────────────────────────────────────────

  @Patch(':companyId')
  @UseGuards(TenantGuard)
  @CompanyRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update company profile (OWNER/ADMIN only)' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Company updated' })
  @ApiResponse({ status: 403, description: 'Insufficient company role' })
  async update(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() user: AuthUser,
    @CurrentCompany() _tenant: TenantContext,
    @Req() req: Request,
  ) {
    return this.companyService.updateCompany(companyId, dto, user.userId, getMeta(req));
  }

  // ─── Update Company Status ──────────────────────────────────────────────────

  @Patch(':companyId/status')
  @UseGuards(TenantGuard)
  @CompanyRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update company status (OWNER/ADMIN only)' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  async updateStatus(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
    @CurrentCompany() _tenant: TenantContext,
    @Req() req: Request,
  ) {
    return this.companyService.updateStatus(companyId, dto.status, user.userId, getMeta(req));
  }

  // ─── Settings ───────────────────────────────────────────────────────────────

  @Get(':companyId/settings')
  @UseGuards(TenantGuard)
  @ApiOperation({ summary: 'Get company settings' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Company settings' })
  async getSettings(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentCompany() _tenant: TenantContext,
  ) {
    return this.companyService.getSettings(companyId);
  }

  @Patch(':companyId/settings')
  @UseGuards(TenantGuard)
  @CompanyRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update company settings (OWNER/ADMIN only)' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  async updateSettings(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateCompanySettingsDto,
    @CurrentUser() user: AuthUser,
    @CurrentCompany() _tenant: TenantContext,
    @Req() req: Request,
  ) {
    return this.companyService.updateSettings(companyId, dto, user.userId, getMeta(req));
  }

  // ─── Members ─────────────────────────────────────────────────────────────────

  @Get(':companyId/members')
  @UseGuards(TenantGuard)
  @ApiOperation({ summary: 'List company members' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  async listMembers(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentCompany() _tenant: TenantContext,
  ) {
    return this.companyService.listMembers(companyId);
  }

  @Get(':companyId/members/:userId')
  @UseGuards(TenantGuard)
  @ApiOperation({ summary: 'Get a specific company member' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  async getMember(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentCompany() _tenant: TenantContext,
  ) {
    return this.companyService.getMember(companyId, userId);
  }

  @Patch(':companyId/members/:userId')
  @UseGuards(TenantGuard)
  @CompanyRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update member role or status (OWNER/ADMIN only)' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  async updateMember(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() user: AuthUser,
    @CurrentCompany() tenant: TenantContext,
    @Req() req: Request,
  ) {
    return this.companyService.updateMember(
      companyId, userId, dto, user.userId, tenant.role, getMeta(req),
    );
  }

  @Delete(':companyId/members/:userId')
  @UseGuards(TenantGuard)
  @CompanyRoles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a company member (OWNER/ADMIN only)' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  async removeMember(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthUser,
    @CurrentCompany() _tenant: TenantContext,
    @Req() req: Request,
  ) {
    return this.companyService.removeMember(companyId, userId, user.userId, getMeta(req));
  }

  // ─── Invitations ─────────────────────────────────────────────────────────────

  @Post(':companyId/invitations')
  @UseGuards(TenantGuard)
  @CompanyRoles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a company invitation (OWNER/ADMIN only)' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  async createInvitation(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateInvitationDto,
    @CurrentUser() user: AuthUser,
    @CurrentCompany() _tenant: TenantContext,
    @Req() req: Request,
  ) {
    return this.companyService.createInvitation(companyId, dto, user.userId, getMeta(req));
  }

  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a company invitation using a token' })
  @ApiResponse({ status: 200, description: 'Invitation accepted, membership created' })
  @ApiResponse({ status: 400, description: 'Invalid, expired or already used token' })
  async acceptInvitation(
    @Body('token') token: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.companyService.acceptInvitation(token, user.userId, getMeta(req));
  }
}
