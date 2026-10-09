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
import { WorkOrderService } from '../services/work-order.service';
import {
  CreateWorkOrderDto,
  UpdateWorkOrderDto,
  UpdateWorkOrderStatusDto,
  QueryWorkOrdersDto,
} from '../dto/work-order.dto';
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
import type { WorkOrderDto } from '@ai-mos/types';

@ApiTags('Work Orders')
@ApiBearerAuth()
@ApiHeader({ name: COMPANY_HEADER, description: 'Active company context', required: true })
@UseGuards(TenantGuard)
@Controller('work-orders')
export class WorkOrderController {
  constructor(private readonly workOrderService: WorkOrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create maintenance work order' })
  @ApiResponse({ status: 201, description: 'Work order created' })
  async create(
    @Body() dto: CreateWorkOrderDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<WorkOrderDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.WORKORDER_CREATE);
    return this.workOrderService.createWorkOrder(tenant.companyId, dto, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List work orders' })
  @ApiResponse({ status: 200, description: 'List of work orders' })
  async list(
    @Query() query: QueryWorkOrdersDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ) {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.WORKORDER_READ);
    return this.workOrderService.listWorkOrders(tenant.companyId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get work order by ID' })
  @ApiResponse({ status: 200, description: 'Work order details' })
  async getById(
    @Param('id') id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<WorkOrderDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.WORKORDER_READ);
    return this.workOrderService.getWorkOrder(tenant.companyId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update work order details' })
  @ApiResponse({ status: 200, description: 'Updated work order' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkOrderDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<WorkOrderDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.WORKORDER_UPDATE);
    return this.workOrderService.updateWorkOrder(tenant.companyId, id, dto, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Transition work order status (DRAFT -> OPEN -> IN_PROGRESS -> COMPLETED)' })
  @ApiResponse({ status: 200, description: 'Work order status updated' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateWorkOrderStatusDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<WorkOrderDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.WORKORDER_UPDATE);
    return this.workOrderService.updateStatus(tenant.companyId, id, dto, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete work order' })
  @ApiResponse({ status: 200, description: 'Work order deleted' })
  async delete(
    @Param('id') id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.WORKORDER_DELETE);
    return this.workOrderService.deleteWorkOrder(tenant.companyId, id, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }
}
