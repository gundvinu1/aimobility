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

// ─── Roles Controller (supports /api/v1/roles and /api/v1/rbac/roles) ──────────

@ApiTags('Roles Management')
@ApiBearerAuth()
@Controller(['roles', 'rbac/roles'])
export class RolesController {
  constructor(private readonly rbacService: RbacService) {}

  @Get()
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

  @Get(':id')
  @ApiOperation({ summary: 'Get role details with assigned permissions and users' })
  @ApiParam({ name: 'id', description: 'Role UUID or name' })
  @ApiResponse({ status: 200, description: 'Role details with assigned permissions and members' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiHeader({ name: COMPANY_HEADER, description: 'Optional active company context', required: false })
  async getRole(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Headers('x-company-id') companyId?: string,
  ) {
    return this.rbacService.getRole(id, user, companyId);
  }

  @Post()
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

  @Patch(':id')
  @ApiOperation({ summary: 'Update role metadata (system roles cannot be renamed)' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot rename system role' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiHeader({ name: COMPANY_HEADER, description: 'Optional active company context', required: false })
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthUser,
    @Headers('x-company-id') companyId: string | undefined,
    @Req() req: Request,
  ) {
    return this.rbacService.updateRole(id, dto, user, companyId, getMeta(req));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete custom role (system roles cannot be deleted)' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete system role' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiHeader({ name: COMPANY_HEADER, description: 'Optional active company context', required: false })
  async deleteRole(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Headers('x-company-id') companyId: string | undefined,
    @Req() req: Request,
  ) {
    return this.rbacService.deleteRole(id, user, companyId, getMeta(req));
  }

  @Get(':id/permissions')
  @ApiOperation({ summary: 'Get permissions assigned to a role' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role permission list' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiHeader({ name: COMPANY_HEADER, description: 'Optional active company context', required: false })
  async getRolePermissions(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Headers('x-company-id') companyId?: string,
  ) {
    return this.rbacService.getRolePermissions(id, user, companyId);
  }

  @Put(':id/permissions')
  @ApiOperation({ summary: 'Update permissions for a role (PUT)' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role permissions updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden (privilege escalation prevention)' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiHeader({ name: COMPANY_HEADER, description: 'Optional active company context', required: false })
  async putRolePermissions(
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() user: AuthUser,
    @Headers('x-company-id') companyId: string | undefined,
    @Req() req: Request,
  ) {
    return this.rbacService.updateRolePermissions(id, dto, user, companyId, getMeta(req));
  }

  @Patch(':id/permissions')
  @ApiOperation({ summary: 'Update permissions for a role (PATCH)' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role permissions updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden (privilege escalation prevention)' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiHeader({ name: COMPANY_HEADER, description: 'Optional active company context', required: false })
  async patchRolePermissions(
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() user: AuthUser,
    @Headers('x-company-id') companyId: string | undefined,
    @Req() req: Request,
  ) {
    return this.rbacService.updateRolePermissions(id, dto, user, companyId, getMeta(req));
  }
}

// ─── Permissions Controller (supports /api/v1/permissions & /api/v1/rbac/permissions)

@ApiTags('Permissions Management')
@ApiBearerAuth()
@Controller(['permissions', 'rbac/permissions'])
export class PermissionsController {
  constructor(private readonly rbacService: RbacService) {}

  @Get()
  @ApiOperation({ summary: 'List all system permissions (matrix catalog)' })
  @ApiResponse({ status: 200, description: 'List of all system permissions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listPermissions(@CurrentUser() user: AuthUser) {
    return this.rbacService.listPermissions(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get permission details by ID or name' })
  @ApiParam({ name: 'id', description: 'Permission UUID or name (e.g. employee.read)' })
  @ApiResponse({ status: 200, description: 'Permission details with assigned roles' })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  async getPermission(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.rbacService.getPermission(id, user);
  }
}

// Backwards compatibility alias
export const RbacController = RolesController;
