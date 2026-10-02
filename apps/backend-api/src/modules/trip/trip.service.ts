import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { CreateTripDto } from './dto/create-trip.dto';
import type { UpdateTripDto } from './dto/update-trip.dto';
import type { ListTripsDto } from './dto/list-trips.dto';
import type { AssignDriverDto } from './dto/assign-driver.dto';
import type { AssignVehicleDto } from './dto/assign-vehicle.dto';
import type { DispatchTripDto } from './dto/dispatch-trip.dto';
import type { UpdateTripStatusDto } from './dto/update-trip-status.dto';
import {
  TRIP_AUDIT_EVENTS,
  VALID_TRIP_TRANSITIONS,
  type TripStatusValue,
} from '@ai-mos/constants';
import type {
  TripDto,
  TripSummaryDto,
  TripListDto,
  TripStatsDto,
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

interface TripDb {
  trip: Delegate;
  tripStatusHistory: Delegate;
  booking: Delegate;
  driver: Delegate;
  vehicle: Delegate;
  auditLog: Delegate;
}

interface AuditMeta {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

interface TripRow {
  id: string;
  companyId: string;
  tripNumber: string;
  bookingId: string;
  vehicleId?: string | null;
  driverId?: string | null;
  status: string;
  pickupLocation: string;
  pickupAddress?: string | null;
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
  dropLocation: string;
  dropAddress?: string | null;
  dropLatitude?: number | null;
  dropLongitude?: number | null;
  scheduledStart: Date;
  actualStart?: Date | null;
  actualEnd?: Date | null;
  distanceKm?: number | null;
  durationMinutes?: number | null;
  passengerCount?: number | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  booking?: {
    id: string;
    bookingNumber: string;
    tripType?: string;
    estimatedFare?: number | null;
  } | null;
  vehicle?: {
    id: string;
    vehicleNumber: string;
    make: string;
    model: string;
    year?: number;
    status?: string;
  } | null;
  driver?: {
    id: string;
    driverCode: string;
    dutyStatus?: string;
    employee?: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string;
    } | null;
  } | null;
  statusHistory?: Array<{
    id: string;
    tripId: string;
    fromStatus?: string | null;
    toStatus: string;
    createdAt: Date;
    changedBy?: string | null;
    notes?: string | null;
  }>;
}

function mapSummary(t: TripRow): TripSummaryDto {
  return {
    id: t.id,
    companyId: t.companyId,
    tripNumber: t.tripNumber,
    bookingId: t.bookingId,
    bookingNumber: t.booking?.bookingNumber ?? null,
    vehicleId: t.vehicleId,
    driverId: t.driverId,
    tripType: (t.booking?.tripType ?? 'ONE_WAY') as TripSummaryDto['tripType'],
    status: t.status as TripSummaryDto['status'],
    originAddress: t.pickupAddress || t.pickupLocation,
    destinationAddress: t.dropAddress || t.dropLocation,
    scheduledStartTime: (t.scheduledStart || t.createdAt).toISOString(),
    scheduledEndTime: null,
    actualStartTime: t.actualStart ? t.actualStart.toISOString() : null,
    actualEndTime: t.actualEnd ? t.actualEnd.toISOString() : null,
    distanceKm: t.distanceKm != null ? Number(t.distanceKm) : null,
    fareAmount: t.booking?.estimatedFare != null ? Number(t.booking.estimatedFare) : null,
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
  };
}

function mapFull(t: TripRow): TripDto {
  return {
    ...mapSummary(t),
    originLatitude: t.pickupLatitude != null ? Number(t.pickupLatitude) : null,
    originLongitude: t.pickupLongitude != null ? Number(t.pickupLongitude) : null,
    destinationLatitude: t.dropLatitude != null ? Number(t.dropLatitude) : null,
    destinationLongitude: t.dropLongitude != null ? Number(t.dropLongitude) : null,
    startOdometer: null,
    endOdometer: null,
    notes: t.notes ?? null,
    statusHistory: Array.isArray(t.statusHistory)
      ? t.statusHistory.map((h) => ({
          id: h.id,
          tripId: h.tripId,
          status: (h.toStatus || 'SCHEDULED') as TripDto['status'],
          changedAt: (h.createdAt || new Date()).toISOString(),
          changedBy: h.changedBy ?? null,
          notes: h.notes ?? null,
        }))
      : [],
    updatedAt: t.updatedAt.toISOString(),
  };
}

@Injectable()
export class TripService {
  private readonly logger = new Logger(TripService.name);
  private get db() {
    return this._db as unknown as TripDb;
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
          entityType: 'TRIP',
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

  // ─── Record Status History Helper ───────────────────────────────────────────
  private async recordStatusHistory(
    companyId: string,
    tripId: string,
    toStatus: string,
    userId?: string,
    notes?: string,
    fromStatus?: string,
  ) {
    await this.db.tripStatusHistory.create({
      data: {
        companyId,
        tripId,
        fromStatus: (fromStatus as any) ?? null,
        toStatus: toStatus as any,
        changedBy: userId ?? null,
        notes: notes ?? null,
      },
    });
  }

  // ─── Unique Trip Number Generator ───────────────────────────────────────────
  private async generateTripNumber(companyId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `TR-${dateStr}`;

    const count = await this.db.trip.count({
      where: {
        companyId,
        tripNumber: { startsWith: prefix },
      },
    });

    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  // ─── Create Trip ────────────────────────────────────────────────────────────
  async createTrip(
    dto: CreateTripDto,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<TripDto> {
    let resolvedBookingId = dto.bookingId;

    // If bookingId is provided, verify it belongs to this company
    if (resolvedBookingId) {
      const booking = await this.db.booking.findFirst({
        where: { id: resolvedBookingId, companyId, deletedAt: null },
      });
      if (!booking) {
        throw new NotFoundException(`Booking not found in current company`);
      }
    } else {
      // Auto-create a linked booking because Trip has a mandatory bookingId in schema
      const autoBooking = (await this.db.booking.create({
        data: {
          companyId,
          bookingNumber: `BK-AUTO-${Date.now().toString().slice(-6)}`,
          customerName: 'Direct Trip Booking',
          customerPhone: 'N/A',
          pickupLocation: dto.originAddress.trim(),
          pickupAddress: dto.originAddress.trim(),
          dropLocation: dto.destinationAddress.trim(),
          dropAddress: dto.destinationAddress.trim(),
          scheduledPickupAt: new Date(dto.scheduledStartTime),
          estimatedDistanceKm: dto.distanceKm ?? null,
          estimatedFare: dto.fareAmount ?? null,
          status: 'CONFIRMED',
          source: 'MANUAL',
          tripType: dto.tripType ?? 'ONE_WAY',
        },
      })) as { id: string };
      resolvedBookingId = autoBooking.id;
    }

    // Determine initial status based on assignments
    let initialStatus: TripStatusValue = 'SCHEDULED';
    if (dto.driverId && dto.vehicleId) {
      initialStatus = 'DRIVER_ASSIGNED';
    } else if (dto.driverId) {
      initialStatus = 'DRIVER_ASSIGNED';
    } else if (dto.vehicleId) {
      initialStatus = 'VEHICLE_ASSIGNED';
    }

    // If driver provided, validate eligibility
    if (dto.driverId) {
      await this.validateDriverEligibility(dto.driverId, companyId);
    }

    // If vehicle provided, validate eligibility
    if (dto.vehicleId) {
      await this.validateVehicleEligibility(dto.vehicleId, companyId);
    }

    let tripNumber = await this.generateTripNumber(companyId);
    const existing = await this.db.trip.findFirst({
      where: { companyId, tripNumber },
    });
    if (existing) {
      tripNumber = `${tripNumber}-${Date.now().toString().slice(-4)}`;
    }

    const created = (await this.db.trip.create({
      data: {
        companyId,
        tripNumber,
        bookingId: resolvedBookingId,
        vehicleId: dto.vehicleId ?? null,
        driverId: dto.driverId ?? null,
        status: initialStatus,
        pickupLocation: dto.originAddress.trim(),
        pickupAddress: dto.originAddress.trim(),
        dropLocation: dto.destinationAddress.trim(),
        dropAddress: dto.destinationAddress.trim(),
        pickupLatitude: dto.originLatitude ?? null,
        pickupLongitude: dto.originLongitude ?? null,
        dropLatitude: dto.destinationLatitude ?? null,
        dropLongitude: dto.destinationLongitude ?? null,
        scheduledStart: new Date(dto.scheduledStartTime),
        distanceKm: dto.distanceKm ?? null,
        notes: dto.notes ? dto.notes.trim() : null,
      },
      include: {
        booking: true,
        vehicle: true,
        driver: { include: { employee: true } },
      },
    })) as TripRow;

    // Record initial status history
    await this.recordStatusHistory(
      companyId,
      created.id,
      initialStatus,
      userId,
      'Trip created',
    );

    await this.audit(
      TRIP_AUDIT_EVENTS.TRIP_CREATED,
      created.id,
      companyId,
      userId,
      meta,
      { tripNumber: created.tripNumber, status: created.status },
    );

    return mapFull(created);
  }

  // ─── List Trips ─────────────────────────────────────────────────────────────
  async listTrips(
    companyId: string,
    query: ListTripsDto,
  ): Promise<TripListDto> {
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

    if (query.driverId) {
      where.driverId = query.driverId;
    }

    if (query.vehicleId) {
      where.vehicleId = query.vehicleId;
    }

    if (query.bookingId) {
      where.bookingId = query.bookingId;
    }

    if (query.fromDate || query.toDate) {
      const scheduledStartTimeWhere: Record<string, unknown> = {};
      if (query.fromDate) {
        scheduledStartTimeWhere.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        scheduledStartTimeWhere.lte = new Date(query.toDate);
      }
      where.scheduledStart = scheduledStartTimeWhere;
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { tripNumber: { contains: s, mode: 'insensitive' } },
        { pickupLocation: { contains: s, mode: 'insensitive' } },
        { dropLocation: { contains: s, mode: 'insensitive' } },
        { vehicle: { vehicleNumber: { contains: s, mode: 'insensitive' } } },
        { driver: { driverCode: { contains: s, mode: 'insensitive' } } },
        { driver: { employee: { firstName: { contains: s, mode: 'insensitive' } } } },
        { driver: { employee: { lastName: { contains: s, mode: 'insensitive' } } } },
      ];
    }

    let sortField = query.sortBy ?? 'scheduledStart';
    if (sortField === 'scheduledStartTime') sortField = 'scheduledStart';

    const sortDir = query.sortOrder ?? 'desc';
    const orderBy = { [sortField]: sortDir };

    const [rows, total] = await Promise.all([
      this.db.trip.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          booking: true,
          vehicle: true,
          driver: { include: { employee: true } },
        },
      }) as Promise<TripRow[]>,
      this.db.trip.count({ where }),
    ]);

    return {
      trips: rows.map(mapSummary),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Get Stats ──────────────────────────────────────────────────────────────
  async getStats(companyId: string): Promise<TripStatsDto> {
    const baseWhere = { companyId, deletedAt: null };

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      total,
      scheduled,
      driverAssigned,
      vehicleAssigned,
      dispatched,
      driverArrived,
      passengerOnboard,
      inProgress,
      completed,
      cancelled,
      noShow,
      todayCount,
    ] = await Promise.all([
      this.db.trip.count({ where: baseWhere }),
      this.db.trip.count({ where: { ...baseWhere, status: 'SCHEDULED' } }),
      this.db.trip.count({ where: { ...baseWhere, status: 'DRIVER_ASSIGNED' } }),
      this.db.trip.count({ where: { ...baseWhere, status: 'VEHICLE_ASSIGNED' } }),
      this.db.trip.count({ where: { ...baseWhere, status: 'DISPATCHED' } }),
      this.db.trip.count({ where: { ...baseWhere, status: 'DRIVER_ARRIVED' } }),
      this.db.trip.count({ where: { ...baseWhere, status: 'PASSENGER_ONBOARD' } }),
      this.db.trip.count({ where: { ...baseWhere, status: 'IN_PROGRESS' } }),
      this.db.trip.count({ where: { ...baseWhere, status: 'COMPLETED' } }),
      this.db.trip.count({ where: { ...baseWhere, status: 'CANCELLED' } }),
      this.db.trip.count({ where: { ...baseWhere, status: 'NO_SHOW' } }),
      this.db.trip.count({
        where: { ...baseWhere, createdAt: { gte: todayStart } },
      }),
    ]);

    return {
      total,
      scheduled,
      assigned: driverAssigned + vehicleAssigned,
      dispatched,
      active: driverArrived + passengerOnboard + inProgress,
      completed,
      cancelled,
      noShow,
      todayCount,
    };
  }

  // ─── Get Single Trip ────────────────────────────────────────────────────────
  async getTrip(id: string, companyId: string): Promise<TripDto> {
    const trip = (await this.db.trip.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        booking: true,
        vehicle: true,
        driver: { include: { employee: true } },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })) as TripRow | null;

    if (!trip) {
      throw new NotFoundException(`Trip not found`);
    }

    return mapFull(trip);
  }

  // ─── Update Trip Details ────────────────────────────────────────────────────
  async updateTrip(
    id: string,
    companyId: string,
    dto: UpdateTripDto,
    userId: string,
    meta: AuditMeta,
  ): Promise<TripDto> {
    const existing = (await this.db.trip.findFirst({
      where: { id, companyId, deletedAt: null },
    })) as TripRow | null;

    if (!existing) {
      throw new NotFoundException(`Trip not found`);
    }

    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      throw new BadRequestException(
        `Cannot edit a trip in ${existing.status} status`,
      );
    }

    const updateData: Record<string, unknown> = {};
    if (dto.originAddress !== undefined) {
      updateData.pickupLocation = dto.originAddress.trim();
      updateData.pickupAddress = dto.originAddress.trim();
    }
    if (dto.destinationAddress !== undefined) {
      updateData.dropLocation = dto.destinationAddress.trim();
      updateData.dropAddress = dto.destinationAddress.trim();
    }
    if (dto.originLatitude !== undefined) updateData.pickupLatitude = dto.originLatitude;
    if (dto.originLongitude !== undefined) updateData.pickupLongitude = dto.originLongitude;
    if (dto.destinationLatitude !== undefined) updateData.dropLatitude = dto.destinationLatitude;
    if (dto.destinationLongitude !== undefined) updateData.dropLongitude = dto.destinationLongitude;
    if (dto.scheduledStartTime !== undefined) updateData.scheduledStart = new Date(dto.scheduledStartTime);
    if (dto.distanceKm !== undefined) updateData.distanceKm = dto.distanceKm;
    if (dto.notes !== undefined) updateData.notes = dto.notes ? dto.notes.trim() : null;

    const updated = (await this.db.trip.update({
      where: { id },
      data: updateData,
      include: {
        booking: true,
        vehicle: true,
        driver: { include: { employee: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    })) as TripRow;

    await this.audit(
      TRIP_AUDIT_EVENTS.TRIP_UPDATED,
      id,
      companyId,
      userId,
      meta,
      { changes: Object.keys(updateData) },
    );

    return mapFull(updated);
  }

  // ─── Assign Driver ──────────────────────────────────────────────────────────
  async assignDriver(
    id: string,
    companyId: string,
    dto: AssignDriverDto,
    userId: string,
    meta: AuditMeta,
  ): Promise<TripDto> {
    const existing = (await this.db.trip.findFirst({
      where: { id, companyId, deletedAt: null },
    })) as TripRow | null;

    if (!existing) {
      throw new NotFoundException(`Trip not found`);
    }

    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(existing.status)) {
      throw new BadRequestException(
        `Cannot assign driver to trip in ${existing.status} status`,
      );
    }

    await this.validateDriverEligibility(dto.driverId, companyId, id);

    let nextStatus = existing.status;
    if (existing.status === 'SCHEDULED' || existing.status === 'VEHICLE_ASSIGNED') {
      nextStatus = 'DRIVER_ASSIGNED';
    }

    const updated = (await this.db.trip.update({
      where: { id },
      data: {
        driverId: dto.driverId,
        status: nextStatus,
        notes: dto.notes ? (existing.notes ? `${existing.notes}\n[Driver Assignment]: ${dto.notes}` : dto.notes) : existing.notes,
      },
      include: {
        booking: true,
        vehicle: true,
        driver: { include: { employee: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    })) as TripRow;

    if (nextStatus !== existing.status) {
      await this.recordStatusHistory(
        companyId,
        id,
        nextStatus,
        userId,
        dto.notes ?? `Driver assigned`,
        existing.status,
      );
    }

    await this.audit(
      TRIP_AUDIT_EVENTS.TRIP_DRIVER_ASSIGNED,
      id,
      companyId,
      userId,
      meta,
      { driverId: dto.driverId },
    );

    return mapFull(updated);
  }

  // ─── Assign Vehicle ─────────────────────────────────────────────────────────
  async assignVehicle(
    id: string,
    companyId: string,
    dto: AssignVehicleDto,
    userId: string,
    meta: AuditMeta,
  ): Promise<TripDto> {
    const existing = (await this.db.trip.findFirst({
      where: { id, companyId, deletedAt: null },
    })) as TripRow | null;

    if (!existing) {
      throw new NotFoundException(`Trip not found`);
    }

    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(existing.status)) {
      throw new BadRequestException(
        `Cannot assign vehicle to trip in ${existing.status} status`,
      );
    }

    await this.validateVehicleEligibility(dto.vehicleId, companyId, id);

    let nextStatus = existing.status;
    if (existing.status === 'SCHEDULED') {
      nextStatus = 'VEHICLE_ASSIGNED';
    }

    const updated = (await this.db.trip.update({
      where: { id },
      data: {
        vehicleId: dto.vehicleId,
        status: nextStatus,
        notes: dto.notes ? (existing.notes ? `${existing.notes}\n[Vehicle Assignment]: ${dto.notes}` : dto.notes) : existing.notes,
      },
      include: {
        booking: true,
        vehicle: true,
        driver: { include: { employee: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    })) as TripRow;

    if (nextStatus !== existing.status) {
      await this.recordStatusHistory(
        companyId,
        id,
        nextStatus,
        userId,
        dto.notes ?? `Vehicle assigned`,
        existing.status,
      );
    }

    await this.audit(
      TRIP_AUDIT_EVENTS.TRIP_VEHICLE_ASSIGNED,
      id,
      companyId,
      userId,
      meta,
      { vehicleId: dto.vehicleId },
    );

    return mapFull(updated);
  }

  // ─── Dispatch Trip ──────────────────────────────────────────────────────────
  async dispatchTrip(
    id: string,
    companyId: string,
    dto: DispatchTripDto,
    userId: string,
    meta: AuditMeta,
  ): Promise<TripDto> {
    const existing = (await this.db.trip.findFirst({
      where: { id, companyId, deletedAt: null },
    })) as TripRow | null;

    if (!existing) {
      throw new NotFoundException(`Trip not found`);
    }

    if (!existing.driverId || !existing.vehicleId) {
      throw new BadRequestException(
        `Cannot dispatch trip: both a driver and a vehicle must be assigned first`,
      );
    }

    this.validateTransition(existing.status as TripStatusValue, 'DISPATCHED');

    const updated = (await this.db.trip.update({
      where: { id },
      data: {
        status: 'DISPATCHED',
        notes: dto.notes ? (existing.notes ? `${existing.notes}\n[Dispatch]: ${dto.notes}` : dto.notes) : existing.notes,
      },
      include: {
        booking: true,
        vehicle: true,
        driver: { include: { employee: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    })) as TripRow;

    await this.recordStatusHistory(
      companyId,
      id,
      'DISPATCHED',
      userId,
      dto.notes ?? 'Trip dispatched',
      existing.status,
    );

    await this.audit(
      TRIP_AUDIT_EVENTS.TRIP_DISPATCHED,
      id,
      companyId,
      userId,
      meta,
      { tripNumber: existing.tripNumber },
    );

    return mapFull(updated);
  }

  // ─── Update Trip Status ─────────────────────────────────────────────────────
  async updateTripStatus(
    id: string,
    companyId: string,
    dto: UpdateTripStatusDto,
    userId: string,
    meta: AuditMeta,
  ): Promise<TripDto> {
    const existing = (await this.db.trip.findFirst({
      where: { id, companyId, deletedAt: null },
    })) as TripRow | null;

    if (!existing) {
      throw new NotFoundException(`Trip not found`);
    }

    this.validateTransition(
      existing.status as TripStatusValue,
      dto.status as TripStatusValue,
    );

    const updateData: Record<string, unknown> = {
      status: dto.status,
    };

    if (dto.actualStartTime) {
      updateData.actualStart = new Date(dto.actualStartTime);
    } else if (dto.status === 'IN_PROGRESS' && !existing.actualStart) {
      updateData.actualStart = new Date();
    }

    if (dto.actualEndTime) {
      updateData.actualEnd = new Date(dto.actualEndTime);
    } else if (dto.status === 'COMPLETED' && !existing.actualEnd) {
      updateData.actualEnd = new Date();
    }

    if (dto.distanceKm !== undefined) updateData.distanceKm = dto.distanceKm;
    if (dto.notes) {
      updateData.notes = existing.notes
        ? `${existing.notes}\n[${dto.status}]: ${dto.notes}`
        : dto.notes;
    }

    const updated = (await this.db.trip.update({
      where: { id },
      data: updateData,
      include: {
        booking: true,
        vehicle: true,
        driver: { include: { employee: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    })) as TripRow;

    // Record immutable history
    await this.recordStatusHistory(
      companyId,
      id,
      dto.status,
      userId,
      dto.notes,
      existing.status,
    );

    // Sync driver duty status if applicable
    if (existing.driverId) {
      if (dto.status === 'IN_PROGRESS') {
        await this.db.driver.update({
          where: { id: existing.driverId },
          data: { dutyStatus: 'ON_TRIP' },
        });
      } else if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(dto.status)) {
        await this.db.driver.update({
          where: { id: existing.driverId },
          data: { dutyStatus: 'ON_DUTY' },
        });
      }
    }

    // Sync booking status if booking is linked and trip completed
    if (existing.bookingId && dto.status === 'COMPLETED') {
      await this.db.booking.update({
        where: { id: existing.bookingId },
        data: {
          status: 'COMPLETED',
        },
      });
    }

    await this.audit(
      TRIP_AUDIT_EVENTS.TRIP_STATUS_UPDATED,
      id,
      companyId,
      userId,
      meta,
      { from: existing.status, to: dto.status },
    );

    return mapFull(updated);
  }

  // ─── Delete Trip (Soft Delete) ──────────────────────────────────────────────
  async deleteTrip(
    id: string,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<{ success: boolean; message: string }> {
    const existing = (await this.db.trip.findFirst({
      where: { id, companyId, deletedAt: null },
    })) as TripRow | null;

    if (!existing) {
      throw new NotFoundException(`Trip not found`);
    }

    if (['IN_PROGRESS', 'DISPATCHED'].includes(existing.status)) {
      throw new BadRequestException(
        `Cannot delete a trip that is currently ${existing.status}`,
      );
    }

    await this.db.trip.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit(
      TRIP_AUDIT_EVENTS.TRIP_DELETED,
      id,
      companyId,
      userId,
      meta,
      { tripNumber: existing.tripNumber },
    );

    return { success: true, message: 'Trip deleted successfully' };
  }

  // ─── Validation Helpers ─────────────────────────────────────────────────────
  private validateTransition(currentStatus: TripStatusValue, targetStatus: TripStatusValue) {
    const allowed = VALID_TRIP_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${targetStatus}`,
      );
    }
  }

  private async validateDriverEligibility(driverId: string, companyId: string, tripId?: string) {
    const driver = (await this.db.driver.findFirst({
      where: { id: driverId, companyId, deletedAt: null },
    })) as { id: string; status: string; licenseExpiryDate: Date; dutyStatus: string } | null;

    if (!driver) {
      throw new NotFoundException(`Driver not found in current company`);
    }

    if (driver.status !== 'ACTIVE') {
      throw new BadRequestException(`Driver is not ACTIVE (current status: ${driver.status})`);
    }

    if (new Date(driver.licenseExpiryDate) < new Date()) {
      throw new BadRequestException(`Driver's license has expired`);
    }

    // Check conflict on another active trip
    const activeTrip = await this.db.trip.findFirst({
      where: {
        companyId,
        driverId,
        deletedAt: null,
        status: { in: ['DISPATCHED', 'DRIVER_ARRIVED', 'PASSENGER_ONBOARD', 'IN_PROGRESS'] },
        ...(tripId ? { id: { not: tripId } } : {}),
      },
    });

    if (activeTrip) {
      throw new ConflictException(`Driver is already assigned to another active trip`);
    }
  }

  private async validateVehicleEligibility(vehicleId: string, companyId: string, tripId?: string) {
    const vehicle = (await this.db.vehicle.findFirst({
      where: { id: vehicleId, companyId, deletedAt: null },
    })) as { id: string; status: string } | null;

    if (!vehicle) {
      throw new NotFoundException(`Vehicle not found in current company`);
    }

    if (vehicle.status !== 'ACTIVE') {
      throw new BadRequestException(`Vehicle is not ACTIVE (current status: ${vehicle.status})`);
    }

    // Check conflict on another active trip
    const activeTrip = await this.db.trip.findFirst({
      where: {
        companyId,
        vehicleId,
        deletedAt: null,
        status: { in: ['DISPATCHED', 'DRIVER_ARRIVED', 'PASSENGER_ONBOARD', 'IN_PROGRESS'] },
        ...(tripId ? { id: { not: tripId } } : {}),
      },
    });

    if (activeTrip) {
      throw new ConflictException(`Vehicle is already assigned to another active trip`);
    }
  }
}
