import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
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
import { AlertService } from './alert.service';
import {
  QueryAlertsDto,
  UpdateAlertStatusDto,
  UpdateCompanyAlertConfigDto,
} from './dto/alert.dto';
import { TenantGuard } from '../company/guards/tenant.guard';
import { CurrentCompany } from '../company/decorators/current-company.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import type { TenantContext } from '../company/types/tenant.type';
import {
  COMPANY_HEADER,
  ROLE_PERMISSIONS,
  ALERT_PERMISSIONS,
} from '@ai-mos/constants';
import type {
  FleetAlertDto,
  FleetAlertListDto,
  FleetAlertSummaryDto,
  CompanyAlertConfigDto,
  DriverSafetySummaryDto,
  VehicleSafetySummaryDto,
} from '@ai-mos/types';

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

@ApiTags('Fleet Alerts')
@ApiBearerAuth()
@ApiHeader({ name: COMPANY_HEADER, description: 'Active company context', required: true })
@UseGuards(TenantGuard)
@Controller('alerts')
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Get()
  @ApiOperation({ summary: 'List fleet alerts with pagination and filters' })
  @ApiResponse({ status: 200, description: 'List of alerts' })
  async list(
    @Query() query: QueryAlertsDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<FleetAlertListDto> {
    enforcePermission(user, tenant.role, ALERT_PERMISSIONS.ALERT_READ);
    return this.alertService.listAlerts(tenant.companyId, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get summary statistics and KPI counts of fleet alerts' })
  @ApiResponse({ status: 200, description: 'Alert statistics KPI summary' })
  async getSummary(
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<FleetAlertSummaryDto> {
    enforcePermission(user, tenant.role, ALERT_PERMISSIONS.ALERT_READ);
    return this.alertService.getAlertSummary(tenant.companyId);
  }

  @Get('config')
  @ApiOperation({ summary: 'Get company alert rule configuration' })
  @ApiResponse({ status: 200, description: 'Company alert configuration' })
  async getConfig(
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<CompanyAlertConfigDto> {
    enforcePermission(user, tenant.role, ALERT_PERMISSIONS.ALERT_READ);
    return this.alertService.getCompanyConfig(tenant.companyId);
  }

  @Patch('config')
  @ApiOperation({ summary: 'Update company alert rules and thresholds' })
  @ApiResponse({ status: 200, description: 'Updated company alert configuration' })
  async updateConfig(
    @Body() dto: UpdateCompanyAlertConfigDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<CompanyAlertConfigDto> {
    enforcePermission(user, tenant.role, ALERT_PERMISSIONS.ALERT_CONFIGURE);
    return this.alertService.updateCompanyConfig(tenant.companyId, dto, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  @Get('analytics/driver')
  @ApiOperation({ summary: 'Get driver safety analytics summary' })
  @ApiResponse({ status: 200, description: 'Driver safety metrics' })
  async getDriverAnalytics(
    @Query('driverId') driverId: string | undefined,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<DriverSafetySummaryDto[]> {
    enforcePermission(user, tenant.role, ALERT_PERMISSIONS.ALERT_READ);
    return this.alertService.getDriverSafetySummary(tenant.companyId, driverId);
  }

  @Get('analytics/vehicle')
  @ApiOperation({ summary: 'Get vehicle safety analytics summary' })
  @ApiResponse({ status: 200, description: 'Vehicle safety metrics' })
  async getVehicleAnalytics(
    @Query('vehicleId') vehicleId: string | undefined,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<VehicleSafetySummaryDto[]> {
    enforcePermission(user, tenant.role, ALERT_PERMISSIONS.ALERT_READ);
    return this.alertService.getVehicleSafetySummary(tenant.companyId, vehicleId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get alert details by ID' })
  @ApiParam({ name: 'id', description: 'Alert UUID' })
  @ApiResponse({ status: 200, description: 'Alert details' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async get(
    @Param('id') id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<FleetAlertDto> {
    enforcePermission(user, tenant.role, ALERT_PERMISSIONS.ALERT_READ);
    return this.alertService.getAlert(tenant.companyId, id);
  }

  @Patch(':id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge an open alert' })
  @ApiParam({ name: 'id', description: 'Alert UUID' })
  @ApiResponse({ status: 200, description: 'Alert acknowledged' })
  async acknowledge(
    @Param('id') id: string,
    @Body() dto: UpdateAlertStatusDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<FleetAlertDto> {
    enforcePermission(user, tenant.role, ALERT_PERMISSIONS.ALERT_ACKNOWLEDGE);
    return this.alertService.acknowledgeAlert(tenant.companyId, id, user.userId, dto.notes, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Resolve an operational alert' })
  @ApiParam({ name: 'id', description: 'Alert UUID' })
  @ApiResponse({ status: 200, description: 'Alert resolved' })
  async resolve(
    @Param('id') id: string,
    @Body() dto: UpdateAlertStatusDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<FleetAlertDto> {
    enforcePermission(user, tenant.role, ALERT_PERMISSIONS.ALERT_RESOLVE);
    return this.alertService.resolveAlert(tenant.companyId, id, user.userId, dto.notes, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  @Patch(':id/dismiss')
  @ApiOperation({ summary: 'Dismiss an operational alert' })
  @ApiParam({ name: 'id', description: 'Alert UUID' })
  @ApiResponse({ status: 200, description: 'Alert dismissed' })
  async dismiss(
    @Param('id') id: string,
    @Body() dto: UpdateAlertStatusDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<FleetAlertDto> {
    enforcePermission(user, tenant.role, ALERT_PERMISSIONS.ALERT_RESOLVE);
    return this.alertService.dismissAlert(tenant.companyId, id, user.userId, dto.notes, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

}
