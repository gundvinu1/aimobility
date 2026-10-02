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
import { TripService } from './trip.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { ListTripsDto } from './dto/list-trips.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { AssignVehicleDto } from './dto/assign-vehicle.dto';
import { DispatchTripDto } from './dto/dispatch-trip.dto';
import { UpdateTripStatusDto } from './dto/update-trip-status.dto';
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

@ApiTags('Trips')
@ApiBearerAuth()
@ApiHeader({ name: COMPANY_HEADER, description: 'Active company context', required: true })
@UseGuards(TenantGuard)
@Controller('trips')
export class TripController {
  constructor(private readonly tripService: TripService) {}

  // ─── Create ─────────────────────────────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a new trip (OWNER / ADMIN / MANAGER / DISPATCHER)' })
  @ApiResponse({ status: 201, description: 'Trip created' })
  async create(
    @Body() dto: CreateTripDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.tripService.createTrip(dto, tenant.companyId, user.userId, getMeta(req));
  }

  // ─── List ───────────────────────────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'List trips (paginated, filterable)' })
  @ApiResponse({ status: 200, description: 'Trip list' })
  async list(
    @Query() query: ListTripsDto,
    @CurrentCompany() tenant: TenantContext,
  ) {
    return this.tripService.listTrips(tenant.companyId, query);
  }

  // ─── Stats ──────────────────────────────────────────────────────────────────
  @Get('stats')
  @ApiOperation({ summary: 'Get trip statistics for the company' })
  @ApiResponse({ status: 200, description: 'Trip stats' })
  async stats(@CurrentCompany() tenant: TenantContext) {
    return this.tripService.getStats(tenant.companyId);
  }

  // ─── Get one ────────────────────────────────────────────────────────────────
  @Get(':id')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Get trip by ID' })
  @ApiResponse({ status: 200, description: 'Trip details' })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  async getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() tenant: TenantContext,
  ) {
    return this.tripService.getTrip(id, tenant.companyId);
  }

  // ─── Update ─────────────────────────────────────────────────────────────────
  @Patch(':id')
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Update trip details (OWNER / ADMIN / MANAGER / DISPATCHER)' })
  @ApiResponse({ status: 200, description: 'Trip updated' })
  @ApiResponse({ status: 400, description: 'Cannot update completed or cancelled trip' })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTripDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.tripService.updateTrip(id, tenant.companyId, dto, user.userId, getMeta(req));
  }

  // ─── Assign Driver ──────────────────────────────────────────────────────────
  @Post(':id/assign-driver')
  @HttpCode(HttpStatus.OK)
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Assign a driver to a trip' })
  @ApiResponse({ status: 200, description: 'Driver assigned' })
  @ApiResponse({ status: 400, description: 'Driver invalid or trip not in assignable state' })
  @ApiResponse({ status: 404, description: 'Trip or driver not found' })
  @ApiResponse({ status: 409, description: 'Driver already on an active trip' })
  async assignDriver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDriverDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.tripService.assignDriver(id, tenant.companyId, dto, user.userId, getMeta(req));
  }

  // ─── Assign Vehicle ─────────────────────────────────────────────────────────
  @Post(':id/assign-vehicle')
  @HttpCode(HttpStatus.OK)
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Assign a vehicle to a trip' })
  @ApiResponse({ status: 200, description: 'Vehicle assigned' })
  @ApiResponse({ status: 400, description: 'Vehicle invalid or trip not in assignable state' })
  @ApiResponse({ status: 404, description: 'Trip or vehicle not found' })
  @ApiResponse({ status: 409, description: 'Vehicle already on an active trip' })
  async assignVehicle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignVehicleDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.tripService.assignVehicle(id, tenant.companyId, dto, user.userId, getMeta(req));
  }

  // ─── Dispatch ───────────────────────────────────────────────────────────────
  @Post(':id/dispatch')
  @HttpCode(HttpStatus.OK)
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Dispatch a trip (requires driver & vehicle)' })
  @ApiResponse({ status: 200, description: 'Trip dispatched' })
  @ApiResponse({ status: 400, description: 'Cannot dispatch: missing assignment or invalid state' })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  async dispatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DispatchTripDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.tripService.dispatchTrip(id, tenant.companyId, dto, user.userId, getMeta(req));
  }

  // ─── Update Status ──────────────────────────────────────────────────────────
  @Patch(':id/status')
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER', 'MEMBER')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Update trip status through execution workflow' })
  @ApiResponse({ status: 200, description: 'Trip status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTripStatusDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.tripService.updateTripStatus(id, tenant.companyId, dto, user.userId, getMeta(req));
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────
  @Delete(':id')
  @CompanyRoles('OWNER', 'ADMIN')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Soft-delete a trip (OWNER / ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Trip deleted' })
  @ApiResponse({ status: 400, description: 'Cannot delete in-progress or dispatched trip' })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.tripService.deleteTrip(id, tenant.companyId, user.userId, getMeta(req));
  }
}
