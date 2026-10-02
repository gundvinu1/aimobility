import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiParam,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { RbacService } from './rbac.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { ListRolesDto } from './dto/list-roles.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { COMPANY_HEADER } from '@ai-mos/constants';

function getMeta(req: Request) {
  return {
    ipAddress: (req.headers['x-forwarded-for'] as string) ?? req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    requestId: req.headers['x-request-id'] as string,
  };
}

@ApiTags('RBAC Management')
@ApiBearerAuth()
@Controller('rbac')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  // ─── List Roles ─────────────────────────────────────────────────────────────

  @Get('roles')
  @ApiOperation({ summary: 'List roles (platform or scoped by tenant context)' })
  @ApiResponse({ status: 200, description: 'Role list with hierarchy and permission counts' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiHeader({ name: COMPANY_HEADER, description: 'Optional active company context', required: false })
  async listRoles(
    @CurrentUser() user: AuthUser,
    @Headers('x-company-id') companyId?: string,
    @Query() query?: ListRolesDto,
  ) {
    return this.rbacService.listRoles(user, companyId, query);
  }

  // ─── List Permissions ───────────────────────────────────────────────────────

  @Get('permissions')
  @ApiOperation({ summary: 'List all system permissions (matrix catalog)' })
  @ApiResponse({ status: 200, description: 'List of all system permissions grouped by module' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listPermissions(@CurrentUser() user: AuthUser) {
    return this.rbacService.listPermissions(user);
  }

  // ─── Get Role By ID ─────────────────────────────────────────────────────────

  @Get('roles/:id')
  @ApiOperation({ summary: 'Get role details and its permissions' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role details with assigned permissions' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiHeader({ name: COMPANY_HEADER, description: 'Optional active company context', required: false })
  async getRole(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Headers('x-company-id') companyId?: string,
  ) {
    return this.rbacService.getRole(id, user, companyId);
  }

  // ─── Create Custom Role ─────────────────────────────────────────────────────

  @Post('roles')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a custom role' })
  @ApiResponse({ status: 201, description: 'Custom role created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden (privilege escalation prevention)' })
  @ApiHeader({ name: COMPANY_HEADER, description: 'Optional active company context', required: false })
  async createRole(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: AuthUser,
    @Headers('x-company-id') companyId: string | undefined,
    @Req() req: Request,
  ) {
    return this.rbacService.createRole(dto, user, companyId, getMeta(req));
  }

  // ─── Update Role ────────────────────────────────────────────────────────────

  @Patch('roles/:id')
  @ApiOperation({ summary: 'Update role metadata (system roles can only update description)' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot rename system role' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiHeader({ name: COMPANY_HEADER, description: 'Optional active company context', required: false })
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthUser,
    @Headers('x-company-id') companyId: string | undefined,
    @Req() req: Request,
  ) {
    return this.rbacService.updateRole(id, dto, user, companyId, getMeta(req));
  }

  // ─── Delete Role ────────────────────────────────────────────────────────────

  @Delete('roles/:id')
  @ApiOperation({ summary: 'Delete custom role (system roles cannot be deleted)' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete system role' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiHeader({ name: COMPANY_HEADER, description: 'Optional active company context', required: false })
  async deleteRole(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Headers('x-company-id') companyId: string | undefined,
    @Req() req: Request,
  ) {
    return this.rbacService.deleteRole(id, user, companyId, getMeta(req));
  }

  // ─── Get Role Permissions ───────────────────────────────────────────────────

  @Get('roles/:id/permissions')
  @ApiOperation({ summary: 'Get permissions assigned to a role' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role permission list' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiHeader({ name: COMPANY_HEADER, description: 'Optional active company context', required: false })
  async getRolePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Headers('x-company-id') companyId?: string,
  ) {
    return this.rbacService.getRolePermissions(id, user, companyId);
  }

  // ─── Update Role Permissions ────────────────────────────────────────────────

  @Put('roles/:id/permissions')
  @ApiOperation({ summary: 'Update permissions for a role (replaces existing assignments)' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role permissions updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden (privilege escalation prevention)' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiHeader({ name: COMPANY_HEADER, description: 'Optional active company context', required: false })
  async updateRolePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() user: AuthUser,
    @Headers('x-company-id') companyId: string | undefined,
    @Req() req: Request,
  ) {
    return this.rbacService.updateRolePermissions(id, dto, user, companyId, getMeta(req));
  }
}
