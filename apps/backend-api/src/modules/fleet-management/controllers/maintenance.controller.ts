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
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { Request } from 'express';
import { MaintenanceService } from '../services/maintenance.service';
import {
  CreateMaintenanceScheduleDto,
  UpdateMaintenanceScheduleDto,
  QueryMaintenanceSchedulesDto,
  CreateMaintenanceRecordDto,
  QueryMaintenanceRecordsDto,
} from '../dto/maintenance.dto';
import { TenantGuard } from '../../company/guards/tenant.guard';
import { CurrentCompany } from '../../company/decorators/current-company.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { enforcePermission } from '../guards/fleet-permission.util';
import type { AuthUser } from '../../auth/types/auth-user.type';
import type { TenantContext } from '../../company/types/tenant.type';
import {
  COMPANY_HEADER,
  FLEET_MANAGEMENT_PERMISSIONS,
} from '@ai-mos/constants';
import type {
  MaintenanceScheduleDto,
  MaintenanceRecordDto,
} from '@ai-mos/types';

@ApiTags('Preventive Maintenance')
@ApiBearerAuth()
@ApiHeader({ name: COMPANY_HEADER, description: 'Active company context', required: true })
@UseGuards(TenantGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  // ─── Schedules ──────────────────────────────────────────────────────────────

  @Post('schedules')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create maintenance schedule' })
  @ApiResponse({ status: 201, description: 'Maintenance schedule created' })
  async createSchedule(
    @Body() dto: CreateMaintenanceScheduleDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<MaintenanceScheduleDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.MAINTENANCE_CREATE);
    return this.maintenanceService.createSchedule(tenant.companyId, dto, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  @Get('schedules')
  @ApiOperation({ summary: 'List maintenance schedules' })
  @ApiResponse({ status: 200, description: 'List of maintenance schedules' })
  async listSchedules(
    @Query() query: QueryMaintenanceSchedulesDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ) {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.MAINTENANCE_READ);
    return this.maintenanceService.listSchedules(tenant.companyId, query);
  }

  @Get('schedules/:id')
  @ApiOperation({ summary: 'Get maintenance schedule by ID' })
  @ApiResponse({ status: 200, description: 'Maintenance schedule details' })
  async getSchedule(
    @Param('id') id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<MaintenanceScheduleDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.MAINTENANCE_READ);
    return this.maintenanceService.getSchedule(tenant.companyId, id);
  }

  @Patch('schedules/:id')
  @ApiOperation({ summary: 'Update maintenance schedule' })
  @ApiResponse({ status: 200, description: 'Updated maintenance schedule' })
  async updateSchedule(
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceScheduleDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<MaintenanceScheduleDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.MAINTENANCE_UPDATE);
    return this.maintenanceService.updateSchedule(tenant.companyId, id, dto, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  @Delete('schedules/:id')
  @ApiOperation({ summary: 'Delete maintenance schedule' })
  @ApiResponse({ status: 200, description: 'Deleted maintenance schedule' })
  async deleteSchedule(
    @Param('id') id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.MAINTENANCE_DELETE);
    return this.maintenanceService.deleteSchedule(tenant.companyId, id, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  // ─── Maintenance Records ────────────────────────────────────────────────────

  @Post('records')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create completed maintenance service record' })
  @ApiResponse({ status: 201, description: 'Maintenance record created' })
  async createRecord(
    @Body() dto: CreateMaintenanceRecordDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<MaintenanceRecordDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.MAINTENANCE_CREATE);
    return this.maintenanceService.createRecord(tenant.companyId, dto, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  @Get('records')
  @ApiOperation({ summary: 'List maintenance history records' })
  @ApiResponse({ status: 200, description: 'List of maintenance records' })
  async listRecords(
    @Query() query: QueryMaintenanceRecordsDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ) {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.MAINTENANCE_READ);
    return this.maintenanceService.listRecords(tenant.companyId, query);
  }

  @Get('records/:id')
  @ApiOperation({ summary: 'Get maintenance record by ID' })
  @ApiResponse({ status: 200, description: 'Maintenance record details' })
  async getRecord(
    @Param('id') id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<MaintenanceRecordDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.MAINTENANCE_READ);
    return this.maintenanceService.getRecord(tenant.companyId, id);
  }

  @Post('evaluate-reminders')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger preventive maintenance due alert evaluation' })
  @ApiResponse({ status: 200, description: 'Evaluation complete' })
  async evaluateReminders(
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<{ evaluated: boolean; alertsSent: number }> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.MAINTENANCE_READ);
    const count = await this.maintenanceService.evaluateMaintenanceReminders(tenant.companyId);
    return { evaluated: true, alertsSent: count };
  }
}
