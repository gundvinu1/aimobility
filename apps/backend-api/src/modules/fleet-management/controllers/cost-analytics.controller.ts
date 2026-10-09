import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { ExpenseService } from '../services/expense.service';
import { QueryFleetCostsDto } from '../dto/cost-analytics.dto';
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
  FleetCostSummaryDto,
  VehicleCostSummaryDto,
  CategoryCostSummaryDto,
  CostTrendDto,
} from '@ai-mos/types';

@ApiTags('Fleet Cost Analytics')
@ApiBearerAuth()
@ApiHeader({ name: COMPANY_HEADER, description: 'Active company context', required: true })
@UseGuards(TenantGuard)
@Controller('fleet-costs')
export class CostAnalyticsController {
  constructor(private readonly expenseService: ExpenseService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get fleet operating cost and TCO summary' })
  @ApiResponse({ status: 200, description: 'Fleet cost summary' })
  async getSummary(
    @Query() query: QueryFleetCostsDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<FleetCostSummaryDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.TCO_READ);
    return this.expenseService.getCostSummary(tenant.companyId, query);
  }

  @Get('vehicles')
  @ApiOperation({ summary: 'Get vehicle-by-vehicle cost breakdown and cost per km' })
  @ApiResponse({ status: 200, description: 'Vehicle cost rankings' })
  async getVehicles(
    @Query() query: QueryFleetCostsDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<VehicleCostSummaryDto[]> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.TCO_READ);
    return this.expenseService.getVehicleCosts(tenant.companyId, query);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get cost breakdown by expense category' })
  @ApiResponse({ status: 200, description: 'Category cost breakdown' })
  async getCategories(
    @Query() query: QueryFleetCostsDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<CategoryCostSummaryDto[]> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.TCO_READ);
    return this.expenseService.getCategoryCosts(tenant.companyId, query);
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get monthly cost trends' })
  @ApiResponse({ status: 200, description: 'Monthly cost trends' })
  async getTrends(
    @Query() query: QueryFleetCostsDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<CostTrendDto[]> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.TCO_READ);
    return this.expenseService.getCostTrends(tenant.companyId, query);
  }
}
