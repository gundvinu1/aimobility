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
import { DriverService } from './driver.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';
import { UpdateDutyStatusDto } from './dto/update-duty-status.dto';
import { ListDriversDto } from './dto/list-drivers.dto';
import { CreateDriverDocumentDto } from './dto/create-driver-document.dto';
import { UpdateDriverDocumentDto } from './dto/update-driver-document.dto';
import { CreateDutyLogDto } from './dto/create-duty-log.dto';
import { AssignVehicleDto } from './dto/assign-vehicle.dto';
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

@ApiTags('Drivers')
@ApiBearerAuth()
@ApiHeader({ name: COMPANY_HEADER, description: 'Active company context', required: true })
@UseGuards(TenantGuard)
@Controller('drivers')
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  // ─── Create ─────────────────────────────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a new driver (OWNER / ADMIN / MANAGER)' })
  @ApiResponse({ status: 201, description: 'Driver created' })
  @ApiResponse({ status: 409, description: 'Driver code or employee already exists' })
  async create(
    @Body() dto: CreateDriverDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.driverService.createDriver(dto, tenant.companyId, user.userId, getMeta(req));
  }

  // ─── List ───────────────────────────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'List drivers (paginated, filterable)' })
  @ApiResponse({ status: 200, description: 'Driver list' })
  async list(
    @Query() query: ListDriversDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ) {
    const role = user.roles?.[0];
    return this.driverService.listDrivers(tenant.companyId, query, role, user.userId);
  }

  // ─── Stats ──────────────────────────────────────────────────────────────────
  @Get('stats')
  @ApiOperation({ summary: 'Get driver statistics for the company' })
  @ApiResponse({ status: 200, description: 'Driver stats' })
  async stats(@CurrentCompany() tenant: TenantContext) {
    return this.driverService.getStats(tenant.companyId);
  }

  // ─── Get one ────────────────────────────────────────────────────────────────
  @Get(':id')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Get driver by ID' })
  @ApiResponse({ status: 200, description: 'Driver details' })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ) {
    const role = user.roles?.[0];
    return this.driverService.getDriver(id, tenant.companyId, role, user.userId);
  }

  // ─── Update ─────────────────────────────────────────────────────────────────
  @Patch(':id')
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Update driver details (OWNER / ADMIN / MANAGER)' })
  @ApiResponse({ status: 200, description: 'Updated driver' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDriverDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.driverService.updateDriver(id, dto, tenant.companyId, user.userId, getMeta(req));
  }

  // ─── Status change ──────────────────────────────────────────────────────────
  @Patch(':id/status')
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Change driver operational status (OWNER / ADMIN / MANAGER)' })
  @ApiResponse({ status: 200, description: 'Updated driver' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDriverStatusDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.driverService.updateDriverStatus(
      id,
      dto,
      tenant.companyId,
      user.userId,
      getMeta(req),
    );
  }

  // ─── Duty status change ─────────────────────────────────────────────────────
  @Patch(':id/duty-status')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Change duty status (OWNER / ADMIN / MANAGER / DRIVER [own])' })
  @ApiResponse({ status: 200, description: 'Updated driver' })
  async updateDutyStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDutyStatusDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const role = user.roles?.[0];
    return this.driverService.updateDutyStatus(
      id,
      dto,
      tenant.companyId,
      user.userId,
      getMeta(req),
      role,
    );
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CompanyRoles('OWNER', 'ADMIN')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Soft-delete driver (OWNER / ADMIN only)' })
  @ApiResponse({ status: 204, description: 'Driver deleted' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.driverService.deleteDriver(id, tenant.companyId, user.userId, getMeta(req));
  }

  // ─── Documents ──────────────────────────────────────────────────────────────
  @Get(':id/documents')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'List documents for a driver' })
  async getDocuments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ) {
    const role = user.roles?.[0];
    return this.driverService.getDocuments(id, tenant.companyId, role, user.userId);
  }

  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Add a document to a driver (OWNER / ADMIN / MANAGER)' })
  @ApiResponse({ status: 201, description: 'Document added' })
  async addDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDriverDocumentDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.driverService.addDocument(id, dto, tenant.companyId, user.userId, getMeta(req));
  }

  @Patch(':id/documents/:docId')
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'docId', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Update driver document (OWNER / ADMIN / MANAGER)' })
  @ApiResponse({ status: 200, description: 'Document updated' })
  async updateDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Body() dto: UpdateDriverDocumentDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.driverService.updateDocument(
      id,
      docId,
      dto,
      tenant.companyId,
      user.userId,
      getMeta(req),
    );
  }

  @Delete(':id/documents/:docId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CompanyRoles('OWNER', 'ADMIN')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'docId', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Delete driver document (OWNER / ADMIN only)' })
  @ApiResponse({ status: 204, description: 'Document deleted' })
  async deleteDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.driverService.deleteDocument(id, docId, tenant.companyId, user.userId, getMeta(req));
  }

  // ─── Duty History ───────────────────────────────────────────────────────────
  @Get(':id/duty-history')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Get driver duty history' })
  async getDutyHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ) {
    const role = user.roles?.[0];
    return this.driverService.getDutyHistory(id, tenant.companyId, role, user.userId);
  }

  @Post(':id/duty')
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Log duty record (OWNER / ADMIN / MANAGER / DRIVER [own])' })
  @ApiResponse({ status: 201, description: 'Duty log created' })
  async createDuty(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDutyLogDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const role = user.roles?.[0];
    return this.driverService.createDutyLog(
      id,
      dto,
      tenant.companyId,
      user.userId,
      getMeta(req),
      role,
    );
  }

  // ─── Vehicle Assignment ─────────────────────────────────────────────────────
  @Get(':id/vehicle')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Get currently assigned vehicle for a driver' })
  @ApiResponse({ status: 200, description: 'Assigned vehicle record or null' })
  async getVehicle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() tenant: TenantContext,
  ) {
    return this.driverService.getAssignedVehicle(id, tenant.companyId);
  }

  @Post(':id/vehicle')
  @HttpCode(HttpStatus.CREATED)
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Assign a vehicle to a driver (OWNER / ADMIN / MANAGER)' })
  @ApiResponse({ status: 201, description: 'Vehicle assigned' })
  @ApiResponse({ status: 404, description: 'Driver or vehicle not found in company' })
  async assignVehicle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignVehicleDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.driverService.assignVehicle(
      id,
      dto,
      tenant.companyId,
      user.userId,
      getMeta(req),
    );
  }

  @Delete(':id/vehicle')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Unassign vehicle from driver (OWNER / ADMIN / MANAGER)' })
  @ApiResponse({ status: 204, description: 'Vehicle unassigned' })
  async unassignVehicle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.driverService.unassignVehicle(id, tenant.companyId, user.userId, getMeta(req));
  }
}
