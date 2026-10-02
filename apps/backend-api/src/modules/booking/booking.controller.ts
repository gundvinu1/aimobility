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
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { ListBookingsDto } from './dto/list-bookings.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
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

@ApiTags('Bookings')
@ApiBearerAuth()
@ApiHeader({ name: COMPANY_HEADER, description: 'Active company context', required: true })
@UseGuards(TenantGuard)
@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  // ─── Create ─────────────────────────────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a new booking (OWNER / ADMIN / MANAGER / DISPATCHER)' })
  @ApiResponse({ status: 201, description: 'Booking created' })
  async create(
    @Body() dto: CreateBookingDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.bookingService.createBooking(dto, tenant.companyId, user.userId, getMeta(req));
  }

  // ─── List ───────────────────────────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'List bookings (paginated, filterable)' })
  @ApiResponse({ status: 200, description: 'Booking list' })
  async list(
    @Query() query: ListBookingsDto,
    @CurrentCompany() tenant: TenantContext,
  ) {
    return this.bookingService.listBookings(tenant.companyId, query);
  }

  // ─── Stats ──────────────────────────────────────────────────────────────────
  @Get('stats')
  @ApiOperation({ summary: 'Get booking statistics for the company' })
  @ApiResponse({ status: 200, description: 'Booking stats' })
  async stats(@CurrentCompany() tenant: TenantContext) {
    return this.bookingService.getStats(tenant.companyId);
  }

  // ─── Get one ────────────────────────────────────────────────────────────────
  @Get(':id')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Get booking by ID' })
  @ApiResponse({ status: 200, description: 'Booking details' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() tenant: TenantContext,
  ) {
    return this.bookingService.getBooking(id, tenant.companyId);
  }

  // ─── Update ─────────────────────────────────────────────────────────────────
  @Patch(':id')
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Update booking details (OWNER / ADMIN / MANAGER / DISPATCHER)' })
  @ApiResponse({ status: 200, description: 'Booking updated' })
  @ApiResponse({ status: 400, description: 'Cannot update completed or cancelled booking' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookingDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.bookingService.updateBooking(id, tenant.companyId, dto, user.userId, getMeta(req));
  }

  // ─── Confirm ────────────────────────────────────────────────────────────────
  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Confirm a booking (DRAFT -> CONFIRMED)' })
  @ApiResponse({ status: 200, description: 'Booking confirmed' })
  @ApiResponse({ status: 400, description: 'Only DRAFT bookings can be confirmed' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.bookingService.confirmBooking(id, tenant.companyId, user.userId, getMeta(req));
  }

  // ─── Cancel ─────────────────────────────────────────────────────────────────
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @CompanyRoles('OWNER', 'ADMIN', 'MANAGER')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Cancel a booking' })
  @ApiResponse({ status: 200, description: 'Booking cancelled' })
  @ApiResponse({ status: 400, description: 'Cannot cancel completed booking' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBookingDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.bookingService.cancelBooking(id, tenant.companyId, dto, user.userId, getMeta(req));
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────
  @Delete(':id')
  @CompanyRoles('OWNER', 'ADMIN')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Soft-delete a booking (OWNER / ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Booking deleted' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.bookingService.deleteBooking(id, tenant.companyId, user.userId, getMeta(req));
  }
}
