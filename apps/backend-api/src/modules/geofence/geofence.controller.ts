import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiParam,
} from '@nestjs/swagger';
import { Request } from 'express';
import { GeofenceService } from './geofence.service';
import {
  CreateGeofenceDto,
  UpdateGeofenceDto,
  AssignVehiclesDto,
  ListGeofencesQueryDto,
} from './dto/geofence.dto';
import { TenantGuard } from '../company/guards/tenant.guard';
import { CurrentCompany } from '../company/decorators/current-company.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import type { TenantContext } from '../company/types/tenant.type';
import {
  COMPANY_HEADER,
  ROLE_PERMISSIONS,
  GEOFENCE_PERMISSIONS,
} from '@ai-mos/constants';
import type { GeofenceDto, GeofenceVehicleDto } from '@ai-mos/types';

function enforcePermission(
  user: AuthUser,
  tenantRole: string,
  requiredPermission: string,
): void {
  if (user.roles?.includes('SUPER_ADMIN')) {
    return;
  }
  const rolePerms = ROLE_PERMISSIONS[tenantRole] ?? [];
  const userPerms = user.permissions ?? [];
  const allPerms = new Set([...rolePerms, ...userPerms]);

  if (!allPerms.has(requiredPermission) && !allPerms.has('*')) {
    throw new ForbiddenException(
      `Insufficient permissions: requires ${requiredPermission}`,
    );
  }
}

@ApiTags('Geofences')
@ApiBearerAuth()
@ApiHeader({ name: COMPANY_HEADER, description: 'Active company context', required: true })
@UseGuards(TenantGuard)
@Controller('geofences')
export class GeofenceController {
  constructor(private readonly geofenceService: GeofenceService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new geofence' })
  @ApiResponse({ status: 201, description: 'Geofence created successfully' })
  async create(
    @Body() dto: CreateGeofenceDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<GeofenceDto> {
    enforcePermission(user, tenant.role, GEOFENCE_PERMISSIONS.GEOFENCE_CREATE);
    return this.geofenceService.createGeofence(tenant.companyId, dto, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List company geofences' })
  @ApiResponse({ status: 200, description: 'List of geofences' })
  async list(
    @Query() query: ListGeofencesQueryDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<GeofenceDto[]> {
    enforcePermission(user, tenant.role, GEOFENCE_PERMISSIONS.GEOFENCE_READ);
    return this.geofenceService.listGeofences(tenant.companyId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get geofence details by ID' })
  @ApiParam({ name: 'id', description: 'Geofence UUID' })
  @ApiResponse({ status: 200, description: 'Geofence details' })
  @ApiResponse({ status: 404, description: 'Geofence not found' })
  async get(
    @Param('id') id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<GeofenceDto> {
    enforcePermission(user, tenant.role, GEOFENCE_PERMISSIONS.GEOFENCE_READ);
    return this.geofenceService.getGeofence(tenant.companyId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update geofence geometry or parameters' })
  @ApiParam({ name: 'id', description: 'Geofence UUID' })
  @ApiResponse({ status: 200, description: 'Geofence updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGeofenceDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<GeofenceDto> {
    enforcePermission(user, tenant.role, GEOFENCE_PERMISSIONS.GEOFENCE_UPDATE);
    return this.geofenceService.updateGeofence(tenant.companyId, id, dto, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a geofence' })
  @ApiParam({ name: 'id', description: 'Geofence UUID' })
  @ApiResponse({ status: 200, description: 'Geofence deleted successfully' })
  async delete(
    @Param('id') id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    enforcePermission(user, tenant.role, GEOFENCE_PERMISSIONS.GEOFENCE_DELETE);
    return this.geofenceService.deleteGeofence(tenant.companyId, id, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  // ─── Vehicle Assignment Endpoints ──────────────────────────────────────────

  @Get(':id/vehicles')
  @ApiOperation({ summary: 'Get vehicles assigned to geofence' })
  @ApiParam({ name: 'id', description: 'Geofence UUID' })
  async getAssignedVehicles(
    @Param('id') id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<GeofenceVehicleDto[]> {
    enforcePermission(user, tenant.role, GEOFENCE_PERMISSIONS.GEOFENCE_READ);
    return this.geofenceService.getAssignedVehicles(tenant.companyId, id);
  }

  @Post(':id/vehicles')
  @ApiOperation({ summary: 'Assign vehicles to geofence' })
  @ApiParam({ name: 'id', description: 'Geofence UUID' })
  async assignVehicles(
    @Param('id') id: string,
    @Body() dto: AssignVehiclesDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<GeofenceVehicleDto[]> {
    enforcePermission(user, tenant.role, GEOFENCE_PERMISSIONS.GEOFENCE_UPDATE);
    return this.geofenceService.assignVehicles(
      tenant.companyId,
      id,
      dto.vehicleIds,
      user.userId,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-request-id'] as string | undefined,
      },
    );
  }

  @Delete(':id/vehicles/:vehicleId')
  @ApiOperation({ summary: 'Remove a vehicle from geofence' })
  @ApiParam({ name: 'id', description: 'Geofence UUID' })
  @ApiParam({ name: 'vehicleId', description: 'Vehicle UUID' })
  async removeVehicle(
    @Param('id') id: string,
    @Param('vehicleId') vehicleId: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    enforcePermission(user, tenant.role, GEOFENCE_PERMISSIONS.GEOFENCE_UPDATE);
    return this.geofenceService.removeVehicle(tenant.companyId, id, vehicleId, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

}
