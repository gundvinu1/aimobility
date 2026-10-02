import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { CreateBookingDto } from './dto/create-booking.dto';
import type { UpdateBookingDto } from './dto/update-booking.dto';
import type { ListBookingsDto } from './dto/list-bookings.dto';
import type { CancelBookingDto } from './dto/cancel-booking.dto';
import { BOOKING_AUDIT_EVENTS } from '@ai-mos/constants';
import type {
  BookingDto,
  BookingSummaryDto,
  BookingListDto,
  BookingStatsDto,
} from '@ai-mos/types';

interface FindOpts {
  where?: Record<string, unknown>;
  include?: Record<string, unknown>;
  data?: Record<string, unknown>;
  orderBy?: unknown;
  select?: Record<string, unknown>;
  skip?: number;
  take?: number;
}

interface Delegate {
  findUnique: (opts: FindOpts) => Promise<unknown>;
  findFirst: (opts: FindOpts) => Promise<unknown>;
  findMany: (opts?: FindOpts) => Promise<unknown[]>;
  create: (opts: FindOpts) => Promise<unknown>;
  update: (opts: FindOpts) => Promise<unknown>;
  updateMany?: (opts: FindOpts) => Promise<unknown>;
  delete: (opts: FindOpts) => Promise<unknown>;
  count: (opts?: FindOpts) => Promise<number>;
}

interface BookingDb {
  booking: Delegate;
  trip: Delegate;
  auditLog: Delegate;
}

interface AuditMeta {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

interface BookingRow {
  id: string;
  companyId: string;
  bookingNumber: string;
  customerId?: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  pickupLocation: string;
  pickupAddress?: string | null;
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
  dropLocation: string;
  dropAddress?: string | null;
  dropLatitude?: number | null;
  dropLongitude?: number | null;
  scheduledPickupAt: Date;
  passengerCount: number;
  estimatedDistanceKm?: number | null;
  estimatedDurationMinutes?: number | null;
  estimatedFare?: number | null;
  status: string;
  source: string;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  trips?: unknown[];
  _count?: {
    trips?: number;
  };
}

function mapSourceToDb(src?: string): 'MANUAL' | 'ONLINE' | 'CORPORATE' | 'PHONE' | 'APP' | 'OTHER' {
  switch (src) {
    case 'WEB': return 'ONLINE';
    case 'MOBILE': return 'APP';
    case 'PHONE': return 'PHONE';
    case 'API': return 'OTHER';
    case 'ADMIN':
    default:
      return 'MANUAL';
  }
}

function mapSummary(b: BookingRow): BookingSummaryDto {
  return {
    id: b.id,
    companyId: b.companyId,
    bookingNumber: b.bookingNumber,
    bookingDate: b.createdAt.toISOString(),
    customerId: b.customerId,
    customerName: b.customerName,
    customerPhone: b.customerPhone,
    customerEmail: b.customerEmail,
    pickupAddress: b.pickupAddress || b.pickupLocation,
    dropoffAddress: b.dropAddress || b.dropLocation,
    pickupTime: (b.scheduledPickupAt || b.createdAt).toISOString(),
    passengerCount: b.passengerCount,
    estimatedFare: b.estimatedFare != null ? Number(b.estimatedFare) : null,
    actualFare: null,
    status: b.status as BookingSummaryDto['status'],
    source: (b.source === 'ONLINE' ? 'WEB' : b.source === 'APP' ? 'MOBILE' : b.source === 'MANUAL' ? 'ADMIN' : b.source) as BookingSummaryDto['source'],
    tripsCount: b._count?.trips ?? b.trips?.length ?? 0,
    createdAt: b.createdAt.toISOString(),
  };
}

function mapFull(b: BookingRow): BookingDto {
  return {
    ...mapSummary(b),
    pickupLatitude: b.pickupLatitude != null ? Number(b.pickupLatitude) : null,
    pickupLongitude: b.pickupLongitude != null ? Number(b.pickupLongitude) : null,
    dropoffLatitude: b.dropLatitude != null ? Number(b.dropLatitude) : null,
    dropoffLongitude: b.dropLongitude != null ? Number(b.dropLongitude) : null,
    estimatedDistance: b.estimatedDistanceKm != null ? Number(b.estimatedDistanceKm) : null,
    estimatedDuration: b.estimatedDurationMinutes != null ? Number(b.estimatedDurationMinutes) : null,
    notes: b.notes ?? null,
    trips: Array.isArray(b.trips)
      ? (b.trips as any[]).map((t) => ({
          id: t.id,
          companyId: t.companyId,
          tripNumber: t.tripNumber,
          bookingId: t.bookingId,
          vehicleId: t.vehicleId,
          driverId: t.driverId,
          tripType: t.tripType ?? 'ONE_WAY',
          status: t.status,
          originAddress: t.pickupAddress || t.pickupLocation,
          destinationAddress: t.dropAddress || t.dropLocation,
          scheduledStartTime: (t.scheduledStart || t.createdAt).toISOString(),
          scheduledEndTime: null,
          actualStartTime: t.actualStart ? t.actualStart.toISOString() : null,
          actualEndTime: t.actualEnd ? t.actualEnd.toISOString() : null,
          distanceKm: t.distanceKm != null ? Number(t.distanceKm) : null,
          fareAmount: null,
          vehicle: t.vehicle
            ? {
                id: t.vehicle.id,
                vehicleNumber: t.vehicle.vehicleNumber,
                make: t.vehicle.make,
                model: t.vehicle.model,
                year: t.vehicle.year,
                status: t.vehicle.status,
              }
            : null,
          driver: t.driver
            ? {
                id: t.driver.id,
                driverCode: t.driver.driverCode,
                dutyStatus: t.driver.dutyStatus,
                employee: t.driver.employee
                  ? {
                      id: t.driver.employee.id,
                      firstName: t.driver.employee.firstName,
                      lastName: t.driver.employee.lastName,
                      phone: t.driver.employee.phone,
                    }
                  : null,
              }
            : null,
          createdAt: t.createdAt.toISOString(),
        }))
      : [],
    updatedAt: b.updatedAt.toISOString(),
  };
}

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);
  private get db() {
    return this._db as unknown as BookingDb;
  }

  constructor(private readonly _db: DatabaseService) {}

  // ─── Audit Helper ───────────────────────────────────────────────────────────
  private async audit(
    action: string,
    entityId: string,
    companyId: string,
    userId: string,
    meta: AuditMeta,
    metadata?: Record<string, unknown>,
  ) {
    try {
      await this.db.auditLog.create({
        data: {
          action,
          entityType: 'BOOKING',
          entityId,
          userId,
          metadata: { companyId, ...metadata },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log: ${err}`);
    }
  }

  // ─── Unique Booking Number Generator ────────────────────────────────────────
  private async generateBookingNumber(companyId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `BK-${dateStr}`;

    const count = await this.db.booking.count({
      where: {
        companyId,
        bookingNumber: { startsWith: prefix },
      },
    });

    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  // ─── Create Booking ─────────────────────────────────────────────────────────
  async createBooking(
    dto: CreateBookingDto,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<BookingDto> {
    let bookingNumber = await this.generateBookingNumber(companyId);

    // Collision check
    const existing = await this.db.booking.findFirst({
      where: { companyId, bookingNumber },
    });
    if (existing) {
      bookingNumber = `${bookingNumber}-${Date.now().toString().slice(-4)}`;
    }

    const created = (await this.db.booking.create({
      data: {
        companyId,
        bookingNumber,
        customerId: dto.customerId ?? null,
        customerName: dto.customerName.trim(),
        customerPhone: dto.customerPhone.trim(),
        customerEmail: dto.customerEmail ? dto.customerEmail.trim().toLowerCase() : null,
        pickupLocation: dto.pickupAddress.trim(),
        pickupAddress: dto.pickupAddress.trim(),
        dropLocation: dto.dropoffAddress.trim(),
        dropAddress: dto.dropoffAddress.trim(),
        pickupLatitude: dto.pickupLatitude ?? null,
        pickupLongitude: dto.pickupLongitude ?? null,
        dropLatitude: dto.dropoffLatitude ?? null,
        dropLongitude: dto.dropoffLongitude ?? null,
        scheduledPickupAt: new Date(dto.pickupTime),
        passengerCount: dto.passengerCount ?? 1,
        estimatedDistanceKm: dto.estimatedDistance ?? null,
        estimatedDurationMinutes: dto.estimatedDuration ?? null,
        estimatedFare: dto.estimatedFare ?? null,
        status: 'DRAFT',
        source: mapSourceToDb(dto.source),
        notes: dto.notes ? dto.notes.trim() : null,
      },
    })) as BookingRow;

    await this.audit(
      BOOKING_AUDIT_EVENTS.BOOKING_CREATED,
      created.id,
      companyId,
      userId,
      meta,
      { bookingNumber: created.bookingNumber, status: created.status },
    );

    return mapFull(created);
  }

  // ─── List Bookings ──────────────────────────────────────────────────────────
  async listBookings(
    companyId: string,
    query: ListBookingsDto,
  ): Promise<BookingListDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      companyId,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.source) {
      where.source = mapSourceToDb(query.source);
    }

    if (query.fromDate || query.toDate) {
      const pickupTimeWhere: Record<string, unknown> = {};
      if (query.fromDate) {
        pickupTimeWhere.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        pickupTimeWhere.lte = new Date(query.toDate);
      }
      where.scheduledPickupAt = pickupTimeWhere;
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { bookingNumber: { contains: s, mode: 'insensitive' } },
        { customerName: { contains: s, mode: 'insensitive' } },
        { customerPhone: { contains: s, mode: 'insensitive' } },
        { customerEmail: { contains: s, mode: 'insensitive' } },
        { pickupLocation: { contains: s, mode: 'insensitive' } },
        { dropLocation: { contains: s, mode: 'insensitive' } },
      ];
    }

    let sortField = query.sortBy ?? 'createdAt';
    if (sortField === 'bookingDate') sortField = 'createdAt';
    if (sortField === 'pickupTime') sortField = 'scheduledPickupAt';

    const sortDir = query.sortOrder ?? 'desc';
    const orderBy = { [sortField]: sortDir };

    const [rows, total] = await Promise.all([
      this.db.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          _count: {
            select: { trips: true },
          },
        },
      }) as Promise<BookingRow[]>,
      this.db.booking.count({ where }),
    ]);

    return {
      bookings: rows.map(mapSummary),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Get Stats ──────────────────────────────────────────────────────────────
  async getStats(companyId: string): Promise<BookingStatsDto> {
    const baseWhere = { companyId, deletedAt: null };

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [total, draft, confirmed, completed, cancelled, todayCount] =
      await Promise.all([
        this.db.booking.count({ where: baseWhere }),
        this.db.booking.count({ where: { ...baseWhere, status: 'DRAFT' } }),
        this.db.booking.count({ where: { ...baseWhere, status: 'CONFIRMED' } }),
        this.db.booking.count({ where: { ...baseWhere, status: 'COMPLETED' } }),
        this.db.booking.count({ where: { ...baseWhere, status: 'CANCELLED' } }),
        this.db.booking.count({
          where: { ...baseWhere, createdAt: { gte: todayStart } },
        }),
      ]);

    return {
      total,
      draft,
      confirmed,
      completed,
      cancelled,
      todayCount,
    };
  }

  // ─── Get Single Booking ─────────────────────────────────────────────────────
  async getBooking(id: string, companyId: string): Promise<BookingDto> {
    const booking = (await this.db.booking.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        trips: {
          include: {
            vehicle: true,
            driver: {
              include: { employee: true },
            },
          },
        },
      },
    })) as BookingRow | null;

    if (!booking) {
      throw new NotFoundException(`Booking not found`);
    }

    return mapFull(booking);
  }

  // ─── Update Booking ─────────────────────────────────────────────────────────
  async updateBooking(
    id: string,
    companyId: string,
    dto: UpdateBookingDto,
    userId: string,
    meta: AuditMeta,
  ): Promise<BookingDto> {
    const existing = (await this.db.booking.findFirst({
      where: { id, companyId, deletedAt: null },
    })) as BookingRow | null;

    if (!existing) {
      throw new NotFoundException(`Booking not found`);
    }

    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      throw new BadRequestException(
        `Cannot edit a booking in ${existing.status} status`,
      );
    }

    const updateData: Record<string, unknown> = {};
    if (dto.customerName !== undefined) updateData.customerName = dto.customerName.trim();
    if (dto.customerPhone !== undefined) updateData.customerPhone = dto.customerPhone.trim();
    if (dto.customerEmail !== undefined) updateData.customerEmail = dto.customerEmail ? dto.customerEmail.trim().toLowerCase() : null;
    if (dto.pickupAddress !== undefined) {
      updateData.pickupLocation = dto.pickupAddress.trim();
      updateData.pickupAddress = dto.pickupAddress.trim();
    }
    if (dto.dropoffAddress !== undefined) {
      updateData.dropLocation = dto.dropoffAddress.trim();
      updateData.dropAddress = dto.dropoffAddress.trim();
    }
    if (dto.pickupLatitude !== undefined) updateData.pickupLatitude = dto.pickupLatitude;
    if (dto.pickupLongitude !== undefined) updateData.pickupLongitude = dto.pickupLongitude;
    if (dto.dropoffLatitude !== undefined) updateData.dropLatitude = dto.dropoffLatitude;
    if (dto.dropoffLongitude !== undefined) updateData.dropLongitude = dto.dropoffLongitude;
    if (dto.pickupTime !== undefined) updateData.scheduledPickupAt = new Date(dto.pickupTime);
    if (dto.passengerCount !== undefined) updateData.passengerCount = dto.passengerCount;
    if (dto.estimatedDistance !== undefined) updateData.estimatedDistanceKm = dto.estimatedDistance;
    if (dto.estimatedDuration !== undefined) updateData.estimatedDurationMinutes = dto.estimatedDuration;
    if (dto.estimatedFare !== undefined) updateData.estimatedFare = dto.estimatedFare;
    if (dto.notes !== undefined) updateData.notes = dto.notes ? dto.notes.trim() : null;

    const updated = (await this.db.booking.update({
      where: { id },
      data: updateData,
      include: {
        trips: {
          include: {
            vehicle: true,
            driver: {
              include: { employee: true },
            },
          },
        },
      },
    })) as BookingRow;

    await this.audit(
      BOOKING_AUDIT_EVENTS.BOOKING_UPDATED,
      id,
      companyId,
      userId,
      meta,
      { changes: Object.keys(updateData) },
    );

    return mapFull(updated);
  }

  // ─── Confirm Booking ───────────────────────────────────────────────────────
  async confirmBooking(
    id: string,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<BookingDto> {
    const existing = (await this.db.booking.findFirst({
      where: { id, companyId, deletedAt: null },
    })) as BookingRow | null;

    if (!existing) {
      throw new NotFoundException(`Booking not found`);
    }

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        `Only DRAFT bookings can be confirmed. Current status: ${existing.status}`,
      );
    }

    const updated = (await this.db.booking.update({
      where: { id },
      data: { status: 'CONFIRMED' },
      include: {
        trips: {
          include: {
            vehicle: true,
            driver: {
              include: { employee: true },
            },
          },
        },
      },
    })) as BookingRow;

    await this.audit(
      BOOKING_AUDIT_EVENTS.BOOKING_CONFIRMED,
      id,
      companyId,
      userId,
      meta,
      { from: 'DRAFT', to: 'CONFIRMED' },
    );

    return mapFull(updated);
  }

  // ─── Cancel Booking ────────────────────────────────────────────────────────
  async cancelBooking(
    id: string,
    companyId: string,
    dto: CancelBookingDto,
    userId: string,
    meta: AuditMeta,
  ): Promise<BookingDto> {
    const existing = (await this.db.booking.findFirst({
      where: { id, companyId, deletedAt: null },
    })) as BookingRow | null;

    if (!existing) {
      throw new NotFoundException(`Booking not found`);
    }

    if (existing.status === 'COMPLETED') {
      throw new BadRequestException(`Completed bookings cannot be cancelled`);
    }

    let updatedNotes = existing.notes;
    if (dto.reason) {
      updatedNotes = existing.notes
        ? `${existing.notes}\n[Cancelled]: ${dto.reason}`
        : `[Cancelled]: ${dto.reason}`;
    }

    const updated = (await this.db.booking.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancellationReason: dto.reason ?? null,
        cancelledAt: new Date(),
        notes: updatedNotes,
      },
      include: {
        trips: {
          include: {
            vehicle: true,
            driver: {
              include: { employee: true },
            },
          },
        },
      },
    })) as BookingRow;

    await this.audit(
      BOOKING_AUDIT_EVENTS.BOOKING_CANCELLED,
      id,
      companyId,
      userId,
      meta,
      { reason: dto.reason, previousStatus: existing.status },
    );

    return mapFull(updated);
  }

  // ─── Delete Booking (Soft Delete) ───────────────────────────────────────────
  async deleteBooking(
    id: string,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<{ success: boolean; message: string }> {
    const existing = (await this.db.booking.findFirst({
      where: { id, companyId, deletedAt: null },
    })) as BookingRow | null;

    if (!existing) {
      throw new NotFoundException(`Booking not found`);
    }

    await this.db.booking.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit(
      BOOKING_AUDIT_EVENTS.BOOKING_DELETED,
      id,
      companyId,
      userId,
      meta,
      { bookingNumber: existing.bookingNumber },
    );

    return { success: true, message: 'Booking deleted successfully' };
  }
}
