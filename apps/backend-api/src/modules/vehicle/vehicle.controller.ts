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
import { VehicleService } from './vehicle.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { UpdateVehicleStatusDto } from './dto/update-vehicle-status.dto';
import { ListVehiclesDto } from './dto/list-vehicles.dto';
import { CreateVehicleDocumentDto } from './dto/create-vehicle-document.dto';
import { CreateVehicleMaintenanceDto, UpdateMaintenanceStatusDto } from './dto/create-vehicle-maintenance.dto';
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

@ApiTags('Vehicles')
@ApiBearerAuth()
@ApiHeader({ name: COMPANY_HEADER, description: 'Active company context', required: true })
@UseGuards(TenantGuard)
@Controller('vehicles')
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  // ─── Create ─────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a new vehicle (OWNER / ADMIN / MANAGER)' })
  @ApiResponse({ status: 201, description: 'Vehicle created' })
  @ApiResponse({ status: 409, description: 'Vehicle number already exists in this company' })
  async create(
    @Body() dto: CreateVehicleDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.vehicleService.createVehicle(dto, tenant.companyId, user.userId, getMeta(req));
  }

  // ─── List ───────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List vehicles (paginated, filterable)' })
  @ApiResponse({ status: 200, description: 'Vehicle list' })
  async list(
    @Query() query: ListVehiclesDto,
    @CurrentCompany() tenant: TenantContext,
  ) {
    return this.vehicleService.listVehicles(tenant.companyId, query);
  }

  // ─── Stats ──────────────────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Get vehicle statistics for the company' })
  @ApiResponse({ status: 200, description: 'Vehicle stats' })
  async stats(@CurrentCompany() tenant: TenantContext) {
    return this.vehicleService.getStats(tenant.companyId);
  }

  // ─── Get one ────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Get vehicle by ID' })
  @ApiResponse({ status: 200, description: 'Vehicle record' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() tenant: TenantContext,
  ) {
    return this.vehicleService.getVehicle(id, tenant.companyId);
  }

  // ─── Update ─────────────────────────────────────────────────────────────────

  @Patch(':id')
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Update vehicle details (OWNER / ADMIN / MANAGER)' })
  @ApiResponse({ status: 200, description: 'Updated vehicle' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.vehicleService.updateVehicle(id, dto, tenant.companyId, user.userId, getMeta(req));
  }

  // ─── Status change ──────────────────────────────────────────────────────────

  @Patch(':id/status')
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Change vehicle status (OWNER / ADMIN / MANAGER)' })
  @ApiResponse({ status: 200, description: 'Updated vehicle' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleStatusDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.vehicleService.updateVehicleStatus(id, dto, tenant.companyId, user.userId, getMeta(req));
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CompanyRoles('OWNER', 'ADMIN')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Soft-delete vehicle (OWNER / ADMIN only)' })
  @ApiResponse({ status: 204, description: 'Vehicle deleted' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.vehicleService.deleteVehicle(id, tenant.companyId, user.userId, getMeta(req));
  }

  // ─── Documents ──────────────────────────────────────────────────────────────

  @Get(':id/documents')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'List documents for a vehicle' })
  async getDocuments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() tenant: TenantContext,
  ) {
    return this.vehicleService.getDocuments(id, tenant.companyId);
  }

  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Add a document to a vehicle (OWNER / ADMIN / MANAGER)' })
  @ApiResponse({ status: 201, description: 'Document added' })
  async addDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVehicleDocumentDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.vehicleService.addDocument(id, dto, tenant.companyId, user.userId, getMeta(req));
  }

  @Delete(':id/documents/:docId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CompanyRoles('OWNER', 'ADMIN')
  @ApiParam({ name: 'id',    type: 'string', format: 'uuid' })
  @ApiParam({ name: 'docId', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Delete a vehicle document (OWNER / ADMIN only)' })
  @ApiResponse({ status: 204, description: 'Document deleted' })
  async deleteDocument(
    @Param('id',    ParseUUIDPipe) id:    string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.vehicleService.deleteDocument(id, docId, tenant.companyId, user.userId, getMeta(req));
  }

  // ─── Maintenance ────────────────────────────────────────────────────────────

  @Get(':id/maintenances')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'List maintenance records for a vehicle' })
  async getMaintenances(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() tenant: TenantContext,
  ) {
    return this.vehicleService.getMaintenances(id, tenant.companyId);
  }

  @Post(':id/maintenances')
  @HttpCode(HttpStatus.CREATED)
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Log a new maintenance record (OWNER / ADMIN / MANAGER)' })
  @ApiResponse({ status: 201, description: 'Maintenance record created' })
  async addMaintenance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVehicleMaintenanceDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.vehicleService.addMaintenance(id, dto, tenant.companyId, user.userId, getMeta(req));
  }

  @Patch(':id/maintenances/:maintId/status')
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiParam({ name: 'id',      type: 'string', format: 'uuid' })
  @ApiParam({ name: 'maintId', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Update maintenance status (OWNER / ADMIN / MANAGER)' })
  async updateMaintenanceStatus(
    @Param('id',      ParseUUIDPipe) id:      string,
    @Param('maintId', ParseUUIDPipe) maintId: string,
    @Body() dto: UpdateMaintenanceStatusDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.vehicleService.updateMaintenanceStatus(
      id, maintId, dto, tenant.companyId, user.userId, getMeta(req),
    );
  }
}
