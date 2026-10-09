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
import { FuelService } from '../services/fuel.service';
import {
  CreateFuelTransactionDto,
  UpdateFuelTransactionDto,
  QueryFuelTransactionsDto,
  QueryFuelAnalyticsDto,
} from '../dto/fuel.dto';
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
import type { FuelTransactionDto, FuelAnalyticsDto } from '@ai-mos/types';

@ApiTags('Fuel Management')
@ApiBearerAuth()
@ApiHeader({ name: COMPANY_HEADER, description: 'Active company context', required: true })
@UseGuards(TenantGuard)
@Controller('fuel')
export class FuelController {
  constructor(private readonly fuelService: FuelService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new fuel transaction' })
  @ApiResponse({ status: 201, description: 'Fuel transaction created' })
  async create(
    @Body() dto: CreateFuelTransactionDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<FuelTransactionDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.FUEL_CREATE);
    return this.fuelService.createFuelTransaction(tenant.companyId, dto, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List company fuel transactions' })
  @ApiResponse({ status: 200, description: 'List of fuel transactions' })
  async list(
    @Query() query: QueryFuelTransactionsDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ) {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.FUEL_READ);
    return this.fuelService.listFuelTransactions(tenant.companyId, query);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get fuel consumption and cost analytics' })
  @ApiResponse({ status: 200, description: 'Fuel analytics summary' })
  async getAnalytics(
    @Query() query: QueryFuelAnalyticsDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<FuelAnalyticsDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.FUEL_READ);
    return this.fuelService.getFuelAnalytics(tenant.companyId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get fuel transaction by ID' })
  @ApiResponse({ status: 200, description: 'Fuel transaction details' })
  async getById(
    @Param('id') id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<FuelTransactionDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.FUEL_READ);
    return this.fuelService.getFuelTransaction(tenant.companyId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update fuel transaction' })
  @ApiResponse({ status: 200, description: 'Updated fuel transaction' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFuelTransactionDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<FuelTransactionDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.FUEL_UPDATE);
    return this.fuelService.updateFuelTransaction(tenant.companyId, id, dto, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete fuel transaction' })
  @ApiResponse({ status: 200, description: 'Deleted fuel transaction' })
  async delete(
    @Param('id') id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.FUEL_DELETE);
    return this.fuelService.deleteFuelTransaction(tenant.companyId, id, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }
}
