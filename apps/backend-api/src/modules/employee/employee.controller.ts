import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
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
import type { Request } from 'express';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto';
import { ListEmployeesDto } from './dto/list-employees.dto';
import { LinkEmployeeUserDto } from './dto/link-user.dto';
import { TenantGuard } from '../company/guards/tenant.guard';
import { CompanyRoles } from '../company/decorators/company-roles.decorator';
import { CurrentCompany } from '../company/decorators/current-company.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import type { TenantContext } from '../company/types/tenant.type';
import { COMPANY_HEADER } from '@ai-mos/constants';

function getMeta(req: Request) {
  return {
    ipAddress: (req.headers['x-forwarded-for'] as string) ?? req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    requestId: req.headers['x-request-id'] as string,
  };
}

@ApiTags('Employees')
@ApiBearerAuth()
@ApiHeader({ name: COMPANY_HEADER, description: 'Active company context', required: true })
@UseGuards(TenantGuard)
@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  // ─── Create ─────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a new employee (OWNER / ADMIN / MANAGER)' })
  @ApiResponse({ status: 201, description: 'Employee created successfully' })
  async create(
    @Body() dto: CreateEmployeeDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.employeeService.createEmployee(dto, tenant.companyId, user.userId, getMeta(req));
  }

  // ─── List ───────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List employees (paginated, filterable)' })
  @ApiResponse({ status: 200, description: 'Employee list' })
  async list(
    @Query() query: ListEmployeesDto,
    @CurrentCompany() tenant: TenantContext,
  ) {
    return this.employeeService.listEmployees(tenant.companyId, query);
  }

  // ─── Stats ──────────────────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Get employee statistics for the company' })
  @ApiResponse({ status: 200, description: 'Employee stats' })
  async stats(@CurrentCompany() tenant: TenantContext) {
    return this.employeeService.getStats(tenant.companyId);
  }

  // ─── Get one ────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Get employee by ID' })
  @ApiResponse({ status: 200, description: 'Employee record' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() tenant: TenantContext,
  ) {
    return this.employeeService.getEmployee(id, tenant.companyId);
  }

  // ─── Update ─────────────────────────────────────────────────────────────────

  @Patch(':id')
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Update employee details (OWNER / ADMIN / MANAGER)' })
  @ApiResponse({ status: 200, description: 'Updated employee' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.employeeService.updateEmployee(id, dto, tenant.companyId, user.userId, getMeta(req));
  }

  // ─── Status change ──────────────────────────────────────────────────────────

  @Patch(':id/status')
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Change employee employment status (OWNER / ADMIN / MANAGER)' })
  @ApiResponse({ status: 200, description: 'Updated employee' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeStatusDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.employeeService.updateEmployeeStatus(id, dto, tenant.companyId, user.userId, getMeta(req));
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CompanyRoles('OWNER', 'ADMIN')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Soft-delete employee (OWNER / ADMIN only)' })
  @ApiResponse({ status: 204, description: 'Employee deleted' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.employeeService.deleteEmployee(id, tenant.companyId, user.userId, getMeta(req));
  }

  // ─── Link User ──────────────────────────────────────────────────────────────

  @Post(':id/link-user')
  @HttpCode(HttpStatus.OK)
  @CompanyRoles('OWNER', 'ADMIN')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Link an employee to a platform user account (OWNER / ADMIN)' })
  @ApiResponse({ status: 200, description: 'Employee linked to user' })
  @ApiResponse({ status: 400, description: 'User not an active member of this company' })
  @ApiResponse({ status: 404, description: 'Employee or user not found' })
  @ApiResponse({ status: 409, description: 'User already linked to another employee' })
  async linkUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkEmployeeUserDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.employeeService.linkUser(id, dto.userId, tenant.companyId, user.userId, getMeta(req));
  }

  // ─── Unlink User ────────────────────────────────────────────────────────────

  @Delete(':id/link-user')
  @HttpCode(HttpStatus.OK)
  @CompanyRoles('OWNER', 'ADMIN')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Unlink an employee from a platform user account (OWNER / ADMIN)' })
  @ApiResponse({ status: 200, description: 'Employee unlinked from user' })
  @ApiResponse({ status: 400, description: 'Employee not currently linked to any user' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async unlinkUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.employeeService.unlinkUser(id, tenant.companyId, user.userId, getMeta(req));
  }
}
