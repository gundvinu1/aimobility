import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiParam,
} from '@nestjs/swagger';
import { TelemetryService } from './telemetry.service';
import { IngestTelemetryDto, ListTelemetryDto } from './dto/ingest-telemetry.dto';
import { TenantGuard } from '../company/guards/tenant.guard';
import { CurrentCompany } from '../company/decorators/current-company.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import type { TenantContext } from '../company/types/tenant.type';
import {
  COMPANY_HEADER,
  ROLE_PERMISSIONS,
  TRACKING_PERMISSIONS,
} from '@ai-mos/constants';
import type {
  FleetSnapshotDto,
  VehicleLocationDto,
  VehicleTelemetryListDto,
} from '@ai-mos/types';

/**
 * Validates that the caller has the required tracking permission within the active tenant.
 * SUPER_ADMIN platform role bypasses checks.
 */
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

// ─── Telemetry Ingestion Controller (POST /api/v1/telemetry) ─────────────────

@ApiTags('Telemetry')
@ApiBearerAuth()
@ApiHeader({ name: COMPANY_HEADER, description: 'Active company context', required: true })
@UseGuards(TenantGuard)
@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ingest vehicle telemetry event' })
  @ApiResponse({ status: 201, description: 'Telemetry accepted and processed' })
  @ApiResponse({ status: 400, description: 'Invalid coordinate or metric payload' })
  @ApiResponse({ status: 403, description: 'Forbidden (insufficient permissions)' })
  @ApiResponse({ status: 404, description: 'Vehicle not found in company' })
  async ingest(
    @Body() dto: IngestTelemetryDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<{ location: VehicleLocationDto; isNew: boolean }> {
    enforcePermission(user, tenant.role, TRACKING_PERMISSIONS.VEHICLE_TELEMETRY_WRITE);
    return this.telemetryService.ingestTelemetry(tenant.companyId, dto);
  }
}

// ─── Fleet Tracking & Telemetry Query Controller ────────────────────────────

@ApiTags('Fleet Tracking')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller()
export class FleetTrackingController {
  constructor(private readonly telemetryService: TelemetryService) {}

  // ─── Fleet Tracking Snapshot ───────────────────────────────────────────────

  @Get('companies/:companyId/tracking')
  @ApiOperation({ summary: 'Get live fleet tracking snapshot with all vehicle locations' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Fleet tracking snapshot' })
  @ApiResponse({ status: 403, description: 'Forbidden (insufficient permissions)' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async getFleetSnapshot(
    @Param('companyId') companyId: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<FleetSnapshotDto> {
    enforcePermission(user, tenant.role, TRACKING_PERMISSIONS.FLEET_TRACKING_READ);
    return this.telemetryService.getFleetSnapshot(companyId);
  }

  // ─── Vehicle-specific Ingest ───────────────────────────────────────────────

  @Post('vehicles/:vehicleId/telemetry')
  @HttpCode(HttpStatus.CREATED)
  @ApiHeader({ name: COMPANY_HEADER, description: 'Active company context', required: true })
  @ApiOperation({ summary: 'Ingest telemetry for a specific vehicle' })
  @ApiParam({ name: 'vehicleId', description: 'Vehicle UUID' })
  @ApiResponse({ status: 201, description: 'Telemetry accepted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Vehicle not found in company' })
  async ingestForVehicle(
    @Param('vehicleId') vehicleId: string,
    @Body() dto: IngestTelemetryDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<{ location: VehicleLocationDto; isNew: boolean }> {
    enforcePermission(user, tenant.role, TRACKING_PERMISSIONS.VEHICLE_TELEMETRY_WRITE);
    // Ensure vehicleId from path is bound to DTO
    dto.vehicleId = vehicleId;
    return this.telemetryService.ingestTelemetry(tenant.companyId, dto);
  }

  // ─── Latest Single Vehicle Location ───────────────────────────────────────

  @Get('vehicles/:vehicleId/location')
  @ApiHeader({ name: COMPANY_HEADER, description: 'Active company context', required: true })
  @ApiOperation({ summary: 'Get latest known location for a specific vehicle' })
  @ApiParam({ name: 'vehicleId', description: 'Vehicle UUID' })
  @ApiResponse({ status: 200, description: 'Latest vehicle location' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  async getVehicleLocation(
    @Param('vehicleId') vehicleId: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<VehicleLocationDto | null> {
    enforcePermission(user, tenant.role, TRACKING_PERMISSIONS.VEHICLE_LOCATION_READ);
    return this.telemetryService.getVehicleLocation(tenant.companyId, vehicleId);
  }

  // ─── Vehicle Telemetry History ─────────────────────────────────────────────

  @Get('vehicles/:vehicleId/telemetry')
  @ApiHeader({ name: COMPANY_HEADER, description: 'Active company context', required: true })
  @ApiOperation({ summary: 'Get paginated telemetry history for a specific vehicle' })
  @ApiParam({ name: 'vehicleId', description: 'Vehicle UUID' })
  @ApiResponse({ status: 200, description: 'Paginated telemetry history' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  async getTelemetryHistory(
    @Param('vehicleId') vehicleId: string,
    @Query() query: ListTelemetryDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<VehicleTelemetryListDto> {
    enforcePermission(user, tenant.role, TRACKING_PERMISSIONS.VEHICLE_TELEMETRY_READ);
    return this.telemetryService.getTelemetryHistory(tenant.companyId, vehicleId, query);
  }

  @Get('vehicles/:vehicleId/telemetry/history')
  @ApiHeader({ name: COMPANY_HEADER, description: 'Active company context', required: true })
  @ApiOperation({ summary: 'Alias: get telemetry history for a vehicle' })
  @ApiParam({ name: 'vehicleId', description: 'Vehicle UUID' })
  async getTelemetryHistoryAlias(
    @Param('vehicleId') vehicleId: string,
    @Query() query: ListTelemetryDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<VehicleTelemetryListDto> {
    enforcePermission(user, tenant.role, TRACKING_PERMISSIONS.VEHICLE_TELEMETRY_READ);
    return this.telemetryService.getTelemetryHistory(tenant.companyId, vehicleId, query);
  }
}
