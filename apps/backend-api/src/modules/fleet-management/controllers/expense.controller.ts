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
import { ExpenseService } from '../services/expense.service';
import {
  CreateVehicleExpenseDto,
  UpdateVehicleExpenseDto,
  QueryVehicleExpensesDto,
} from '../dto/expense.dto';
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
import type { VehicleExpenseDto } from '@ai-mos/types';

@ApiTags('Vehicle Expenses')
@ApiBearerAuth()
@ApiHeader({ name: COMPANY_HEADER, description: 'Active company context', required: true })
@UseGuards(TenantGuard)
@Controller('vehicle-expenses')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a vehicle expense record' })
  @ApiResponse({ status: 201, description: 'Expense recorded' })
  async create(
    @Body() dto: CreateVehicleExpenseDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<VehicleExpenseDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.EXPENSE_CREATE);
    return this.expenseService.createExpense(tenant.companyId, dto, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List vehicle expenses' })
  @ApiResponse({ status: 200, description: 'List of vehicle expenses' })
  async list(
    @Query() query: QueryVehicleExpensesDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ) {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.EXPENSE_READ);
    return this.expenseService.listExpenses(tenant.companyId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vehicle expense by ID' })
  @ApiResponse({ status: 200, description: 'Vehicle expense details' })
  async getById(
    @Param('id') id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<VehicleExpenseDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.EXPENSE_READ);
    return this.expenseService.getExpense(tenant.companyId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update vehicle expense' })
  @ApiResponse({ status: 200, description: 'Updated vehicle expense' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleExpenseDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<VehicleExpenseDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.EXPENSE_UPDATE);
    return this.expenseService.updateExpense(tenant.companyId, id, dto, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete vehicle expense' })
  @ApiResponse({ status: 200, description: 'Deleted vehicle expense' })
  async delete(
    @Param('id') id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.EXPENSE_DELETE);
    return this.expenseService.deleteExpense(tenant.companyId, id, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }
}
