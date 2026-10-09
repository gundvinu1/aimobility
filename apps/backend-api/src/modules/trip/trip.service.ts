import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { TelemetryGateway } from '../telemetry/telemetry.gateway';
import type { CreateTripDto } from './dto/create-trip.dto';
import type { UpdateTripDto } from './dto/update-trip.dto';
import type { ListTripsDto } from './dto/list-trips.dto';
import type { AssignDriverDto } from './dto/assign-driver.dto';
import type { AssignVehicleDto } from './dto/assign-vehicle.dto';
import type { UnassignDriverDto } from './dto/unassign-driver.dto';
import type { UnassignVehicleDto } from './dto/unassign-vehicle.dto';
import type { DispatchTripDto } from './dto/dispatch-trip.dto';
import type { UpdateTripStatusDto } from './dto/update-trip-status.dto';
import type { CreateTripStopDto } from './dto/create-trip-stop.dto';
import type { UpdateTripStopDto } from './dto/update-trip-stop.dto';
import { RoutingService } from './routing/routing.service';
import type { CalculatedRoute, CalculatedEta } from './routing/routing.interface';
import {
  TRIP_AUDIT_EVENTS,
  VALID_TRIP_TRANSITIONS,
  DISPATCH_CONFLICT_BUFFER_MINUTES,
  DISPATCH_REDIS_KEYS,
  type TripStatusValue,
} from '@ai-mos/constants';
import { CacheService } from '../cache/cache.service';
import { randomUUID } from 'crypto';
import type {
  TripDto,
  TripSummaryDto,
  TripListDto,
  TripStatsDto,
  TripStopDto,
  DispatchAvailabilityResponseDto,
  DriverAvailabilityDto,
  VehicleAvailabilityDto,
  DispatchAnalyticsDto,
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
  workOrder?: Delegate;
  tripStop?: Delegate;
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
  routePolyline?: string | null;
  stops?: any[];
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

function mapStop(s: any): TripStopDto {
  return {
    id: s.id,
    companyId: s.companyId,
    tripId: s.tripId,
    stopOrder: s.stopOrder,
    stopType: s.stopType,
    locationName: s.locationName,
    address: s.address ?? null,
    latitude: Number(s.latitude),
    longitude: Number(s.longitude),
    plannedArrival: s.plannedArrival ? (s.plannedArrival instanceof Date ? s.plannedArrival.toISOString() : String(s.plannedArrival)) : null,
    plannedDeparture: s.plannedDeparture ? (s.plannedDeparture instanceof Date ? s.plannedDeparture.toISOString() : String(s.plannedDeparture)) : null,
    actualArrival: s.actualArrival ? (s.actualArrival instanceof Date ? s.actualArrival.toISOString() : String(s.actualArrival)) : null,
    actualDeparture: s.actualDeparture ? (s.actualDeparture instanceof Date ? s.actualDeparture.toISOString() : String(s.actualDeparture)) : null,
    passengerName: s.passengerName ?? null,
    passengerPhone: s.passengerPhone ?? null,
    notes: s.notes ?? null,
    status: s.status,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
    updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : String(s.updatedAt),
  };
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
    routePolyline: t.routePolyline ?? null,
    stops: Array.isArray(t.stops) ? t.stops.map(mapStop) : [],
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

  constructor(
    private readonly _db: DatabaseService,
    @Optional() private readonly routingService?: RoutingService,
    @Optional()
    @Inject(forwardRef(() => TelemetryGateway))
    private readonly telemetryGateway?: TelemetryGateway,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  // ─── Distributed Locking Helpers (Redis SET NX PX + Lua Safe Release) ───────
  /**
   * Acquire a distributed lock using Redis SET ... PX ... NX
   * Returns ownership token if acquired, or null if lock is already held.
   * If Redis is unavailable or fails, logs warning and returns fallback.
   */
  private async acquireLock(
    lockKey: string,
    ttlMs: number = 5000,
  ): Promise<{ acquired: boolean; token: string | null; fallback: boolean }> {
    if (!this.cacheService) {
      return { acquired: true, token: null, fallback: true };
    }

    const token = randomUUID();
    try {
      const client = this.cacheService.getClient();
      if (!client || typeof client.set !== 'function') {
        return { acquired: true, token: null, fallback: true };
      }

      const result = await client.set(lockKey, token, 'PX', ttlMs, 'NX');
      if (result === 'OK') {
        return { acquired: true, token, fallback: false };
      }
      return { acquired: false, token: null, fallback: false };
    } catch (err) {
      this.logger.warn(
        `Redis lock acquisition failed for key ${lockKey}; falling back to database transaction: ${(err as Error).message}`,
      );
      return { acquired: true, token: null, fallback: true };
    }
  }

  /**
   * Release a distributed lock safely using a Lua script to ensure
   * only the token owner can release it (avoiding removing another request's lock if expired).
   */
  private async releaseLock(lockKey: string, token: string | null): Promise<void> {
    if (!this.cacheService || !token) {
      return;
    }

    try {
      const client = this.cacheService.getClient();
      if (!client || typeof client.eval !== 'function') {
        return;
      }

      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await client.eval(luaScript, 1, lockKey, token);
    } catch (err) {
      this.logger.warn(
        `Redis lock release failed for key ${lockKey}: ${(err as Error).message}`,
      );
    }
  }

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
    dbOverride?: any,
  ) {
    const dbClient = dbOverride ?? this.db;
    const historyDelegate = dbClient.tripStatusHistory ?? this.db.tripStatusHistory;
    await historyDelegate.create({
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
    // Acquire distributed locks in deterministic order if driver or vehicle is assigned
    const locksToAcquire: Array<{ key: string; type: 'driver' | 'vehicle' }> = [];
    if (dto.driverId) {
      locksToAcquire.push({
        key: DISPATCH_REDIS_KEYS.lockDriver(dto.driverId),
        type: 'driver',
      });
    }
    if (dto.vehicleId) {
      locksToAcquire.push({
        key: DISPATCH_REDIS_KEYS.lockVehicle(dto.vehicleId),
        type: 'vehicle',
      });
    }
    locksToAcquire.sort((a, b) => a.key.localeCompare(b.key));

    const acquiredLocks: Array<{ key: string; token: string | null }> = [];
    for (const item of locksToAcquire) {
      const lockRes = await this.acquireLock(item.key, 5000);
      if (!lockRes.acquired) {
        for (const acquired of acquiredLocks.reverse()) {
          await this.releaseLock(acquired.key, acquired.token);
        }
        throw new ConflictException(
          `${item.type === 'driver' ? 'Driver' : 'Vehicle'} is currently being assigned or locked by another concurrent operation. Please retry.`,
        );
      }
      acquiredLocks.push({ key: item.key, token: lockRes.token });
    }

    try {
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
    } finally {
      for (const acquired of acquiredLocks.reverse()) {
        await this.releaseLock(acquired.key, acquired.token);
      }
    }
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
    const lockKey = DISPATCH_REDIS_KEYS.lockDriver(dto.driverId);
    const lock = await this.acquireLock(lockKey, 5000);

    if (!lock.acquired) {
      throw new ConflictException(
        `Driver is currently being assigned or locked by another concurrent operation. Please retry.`,
      );
    }

    try {
      const executeTx = async (tx: any) => {
        const tripDelegate = tx.trip ?? this.db.trip;
        const existing = (await tripDelegate.findFirst({
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

        await this.validateDriverEligibility(dto.driverId, companyId, id, existing, tx);

        let nextStatus = existing.status;
        if (existing.status === 'SCHEDULED' || existing.status === 'VEHICLE_ASSIGNED') {
          nextStatus = 'DRIVER_ASSIGNED';
        }

        const updated = (await tripDelegate.update({
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
            tx,
          );
        }

        return { updated, nextStatus, existingStatus: existing.status };
      };

      let resultData: { updated: TripRow; nextStatus: string; existingStatus: string };
      if (typeof (this._db as any).$transaction === 'function') {
        resultData = await (this._db as any).$transaction(async (tx: any) => executeTx(tx));
      } else {
        resultData = await executeTx(this.db);
      }

      await this.audit(
        TRIP_AUDIT_EVENTS.TRIP_DRIVER_ASSIGNED,
        id,
        companyId,
        userId,
        meta,
        { driverId: dto.driverId },
      );

      const result = mapFull(resultData.updated);
      this.telemetryGateway?.broadcastDispatchTripAssigned(companyId, {
        tripId: id,
        driverId: dto.driverId,
        status: resultData.nextStatus,
        trip: result,
      });

      return result;
    } finally {
      await this.releaseLock(lockKey, lock.token);
    }
  }

  // ─── Unassign Driver ────────────────────────────────────────────────────────
  async unassignDriver(
    id: string,
    companyId: string,
    dto: UnassignDriverDto,
    userId: string,
    meta: AuditMeta,
  ): Promise<TripDto> {
    const existing = (await this.db.trip.findFirst({
      where: { id, companyId, deletedAt: null },
    })) as TripRow | null;

    if (!existing) {
      throw new NotFoundException(`Trip not found`);
    }

    if (
      ['DISPATCHED', 'DRIVER_ARRIVED', 'PASSENGER_ONBOARD', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(
        existing.status,
      )
    ) {
      throw new BadRequestException(
        `Cannot unassign driver from trip in ${existing.status} status`,
      );
    }

    if (!existing.driverId) {
      throw new BadRequestException(`No driver is assigned to this trip`);
    }

    const previousDriverId = existing.driverId;
    const nextStatus = existing.vehicleId ? 'VEHICLE_ASSIGNED' : 'SCHEDULED';

    const updated = (await this.db.trip.update({
      where: { id },
      data: {
        driverId: null,
        status: nextStatus,
        notes: dto.notes
          ? existing.notes
            ? `${existing.notes}\n[Driver Unassigned]: ${dto.notes}`
            : dto.notes
          : existing.notes,
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
        dto.notes ?? `Driver unassigned`,
        existing.status,
      );
    }

    await this.audit(
      TRIP_AUDIT_EVENTS.TRIP_DRIVER_UNASSIGNED,
      id,
      companyId,
      userId,
      meta,
      { previousDriverId, reason: dto.notes },
    );

    const result = mapFull(updated);
    this.telemetryGateway?.broadcastDispatchTripUnassigned(companyId, {
      tripId: id,
      unassignedType: 'DRIVER',
      status: nextStatus,
      trip: result,
    });

    return result;
  }

  // ─── Assign Vehicle ─────────────────────────────────────────────────────────
  async assignVehicle(
    id: string,
    companyId: string,
    dto: AssignVehicleDto,
    userId: string,
    meta: AuditMeta,
  ): Promise<TripDto> {
    const lockKey = DISPATCH_REDIS_KEYS.lockVehicle(dto.vehicleId);
    const lock = await this.acquireLock(lockKey, 5000);

    if (!lock.acquired) {
      throw new ConflictException(
        `Vehicle is currently being assigned or locked by another concurrent operation. Please retry.`,
      );
    }

    try {
      const executeTx = async (tx: any) => {
        const tripDelegate = tx.trip ?? this.db.trip;
        const existing = (await tripDelegate.findFirst({
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

        await this.validateVehicleEligibility(dto.vehicleId, companyId, id, existing, tx);

        let nextStatus = existing.status;
        if (existing.status === 'SCHEDULED') {
          nextStatus = 'VEHICLE_ASSIGNED';
        }

        const updated = (await tripDelegate.update({
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
            tx,
          );
        }

        return { updated, nextStatus, existingStatus: existing.status };
      };

      let resultData: { updated: TripRow; nextStatus: string; existingStatus: string };
      if (typeof (this._db as any).$transaction === 'function') {
        resultData = await (this._db as any).$transaction(async (tx: any) => executeTx(tx));
      } else {
        resultData = await executeTx(this.db);
      }

      await this.audit(
        TRIP_AUDIT_EVENTS.TRIP_VEHICLE_ASSIGNED,
        id,
        companyId,
        userId,
        meta,
        { vehicleId: dto.vehicleId },
      );

      const result = mapFull(resultData.updated);
      this.telemetryGateway?.broadcastDispatchTripAssigned(companyId, {
        tripId: id,
        vehicleId: dto.vehicleId,
        status: resultData.nextStatus,
        trip: result,
      });

      return result;
    } finally {
      await this.releaseLock(lockKey, lock.token);
    }
  }

  // ─── Unassign Vehicle ───────────────────────────────────────────────────────
  async unassignVehicle(
    id: string,
    companyId: string,
    dto: UnassignVehicleDto,
    userId: string,
    meta: AuditMeta,
  ): Promise<TripDto> {
    const existing = (await this.db.trip.findFirst({
      where: { id, companyId, deletedAt: null },
    })) as TripRow | null;

    if (!existing) {
      throw new NotFoundException(`Trip not found`);
    }

    if (
      ['DISPATCHED', 'DRIVER_ARRIVED', 'PASSENGER_ONBOARD', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(
        existing.status,
      )
    ) {
      throw new BadRequestException(
        `Cannot unassign vehicle from trip in ${existing.status} status`,
      );
    }

    if (!existing.vehicleId) {
      throw new BadRequestException(`No vehicle is assigned to this trip`);
    }

    const previousVehicleId = existing.vehicleId;
    const nextStatus = existing.driverId ? 'DRIVER_ASSIGNED' : 'SCHEDULED';

    const updated = (await this.db.trip.update({
      where: { id },
      data: {
        vehicleId: null,
        status: nextStatus,
        notes: dto.notes
          ? existing.notes
            ? `${existing.notes}\n[Vehicle Unassigned]: ${dto.notes}`
            : dto.notes
          : existing.notes,
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
        dto.notes ?? `Vehicle unassigned`,
        existing.status,
      );
    }

    await this.audit(
      TRIP_AUDIT_EVENTS.TRIP_VEHICLE_UNASSIGNED,
      id,
      companyId,
      userId,
      meta,
      { previousVehicleId, reason: dto.notes },
    );

    const result = mapFull(updated);
    this.telemetryGateway?.broadcastDispatchTripUnassigned(companyId, {
      tripId: id,
      unassignedType: 'VEHICLE',
      status: nextStatus,
      trip: result,
    });

    return result;
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

    await this.validateDispatchReadiness(existing, companyId);

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

    const result = mapFull(updated);
    this.telemetryGateway?.broadcastDispatchTripDispatched(companyId, {
      tripId: id,
      status: 'DISPATCHED',
      trip: result,
    });

    return result;
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

    if (dto.status === 'DISPATCHED') {
      await this.validateDispatchReadiness(existing, companyId);
    } else {
      this.validateTransition(
        existing.status as TripStatusValue,
        dto.status as TripStatusValue,
      );
    }

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

    const result = mapFull(updated);
    this.telemetryGateway?.broadcastDispatchStatusUpdated(companyId, {
      tripId: id,
      status: dto.status,
      previousStatus: existing.status,
      trip: result,
    });

    return result;
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

  /**
   * Shared validation for dispatching a trip:
   * 1. Requires both driverId and vehicleId to be present.
   * 2. Validates lifecycle state transition to DISPATCHED.
   * 3. Verifies assigned driver belongs to the same company, is ACTIVE, and license is valid.
   * 4. Verifies assigned vehicle belongs to the same company, is ACTIVE, and has no active work orders.
   */
  private async validateDispatchReadiness(
    existing: TripRow,
    companyId: string,
    dbOverride?: any,
  ): Promise<{ driver: any; vehicle: any }> {
    if (!existing.driverId || !existing.vehicleId) {
      throw new BadRequestException(
        `Cannot dispatch trip: both a driver and a vehicle must be assigned first`,
      );
    }

    this.validateTransition(existing.status as TripStatusValue, 'DISPATCHED');

    const dbClient = dbOverride ?? this.db;
    const driverDelegate = dbClient.driver ?? this.db.driver;
    const vehicleDelegate = dbClient.vehicle ?? this.db.vehicle;
    const workOrderDelegate = dbClient.workOrder ?? this.db.workOrder;

    // Verify driver tenant boundary, active status, and license
    const driver = (await driverDelegate.findFirst({
      where: { id: existing.driverId, companyId, deletedAt: null },
    })) as { id: string; status: string; licenseExpiryDate: Date } | null;

    if (!driver) {
      throw new BadRequestException(
        `Cannot dispatch trip: assigned driver does not belong to this company`,
      );
    }

    if (driver.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Cannot dispatch trip: assigned driver is not ACTIVE (current status: ${driver.status})`,
      );
    }

    if (new Date(driver.licenseExpiryDate) < new Date()) {
      throw new BadRequestException(
        `Cannot dispatch trip: assigned driver's license has expired`,
      );
    }

    // Verify vehicle tenant boundary, active status, and maintenance hold
    const vehicle = (await vehicleDelegate.findFirst({
      where: { id: existing.vehicleId, companyId, deletedAt: null },
    })) as { id: string; status: string } | null;

    if (!vehicle) {
      throw new BadRequestException(
        `Cannot dispatch trip: assigned vehicle does not belong to this company`,
      );
    }

    if (vehicle.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Cannot dispatch trip: assigned vehicle is not ACTIVE (current status: ${vehicle.status})`,
      );
    }

    if (workOrderDelegate?.findFirst) {
      const activeWorkOrder = (await workOrderDelegate.findFirst({
        where: {
          companyId,
          vehicleId: existing.vehicleId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      })) as { id: string; workOrderNumber?: string } | null;

      if (activeWorkOrder) {
        throw new BadRequestException(
          `Cannot dispatch trip: assigned vehicle has an active maintenance work order (${activeWorkOrder.workOrderNumber ?? activeWorkOrder.id})`,
        );
      }
    }

    return { driver, vehicle };
  }

  private async validateDriverEligibility(
    driverId: string,
    companyId: string,
    tripId?: string,
    targetTrip?: TripRow | null,
    dbOverride?: any,
  ) {
    const dbClient = dbOverride ?? this.db;
    const driverDelegate = dbClient.driver ?? this.db.driver;
    const tripDelegate = dbClient.trip ?? this.db.trip;

    const driver = (await driverDelegate.findFirst({
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

    // Check conflict on another active executing trip
    const activeTrip = await tripDelegate.findFirst({
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

    // Check conflict on overlapping scheduled trip time window
    if (targetTrip?.scheduledStart && tripDelegate.findMany) {
      const bufferMs = DISPATCH_CONFLICT_BUFFER_MINUTES * 60 * 1000;
      const targetDurationMs = (targetTrip.durationMinutes ?? 60) * 60 * 1000;
      const targetStartMs = new Date(targetTrip.scheduledStart).getTime() - bufferMs;
      const targetEndMs = new Date(targetTrip.scheduledStart).getTime() + targetDurationMs + bufferMs;

      const otherTrips = (await tripDelegate.findMany({
        where: {
          companyId,
          driverId,
          deletedAt: null,
          status: { in: ['SCHEDULED', 'DRIVER_ASSIGNED', 'VEHICLE_ASSIGNED', 'DISPATCHED', 'DRIVER_ARRIVED', 'PASSENGER_ONBOARD', 'IN_PROGRESS'] },
          ...(tripId ? { id: { not: tripId } } : {}),
        },
      })) as TripRow[] | undefined;

      if (otherTrips && otherTrips.length > 0) {
        for (const other of otherTrips) {
          if (other.scheduledStart) {
            const otherDurationMs = (other.durationMinutes ?? 60) * 60 * 1000;
            const otherStartMs = new Date(other.scheduledStart).getTime() - bufferMs;
            const otherEndMs = new Date(other.scheduledStart).getTime() + otherDurationMs + bufferMs;
            if (otherStartMs < targetEndMs && otherEndMs > targetStartMs) {
              throw new ConflictException(
                `Driver is already scheduled for an overlapping trip (${other.tripNumber ?? other.id})`,
              );
            }
          }
        }
      }
    }
  }

  private async validateVehicleEligibility(
    vehicleId: string,
    companyId: string,
    tripId?: string,
    targetTrip?: TripRow | null,
    dbOverride?: any,
  ) {
    const dbClient = dbOverride ?? this.db;
    const vehicleDelegate = dbClient.vehicle ?? this.db.vehicle;
    const tripDelegate = dbClient.trip ?? this.db.trip;
    const workOrderDelegate = dbClient.workOrder ?? this.db.workOrder;

    const vehicle = (await vehicleDelegate.findFirst({
      where: { id: vehicleId, companyId, deletedAt: null },
    })) as { id: string; status: string } | null;

    if (!vehicle) {
      throw new NotFoundException(`Vehicle not found in current company`);
    }

    if (vehicle.status !== 'ACTIVE') {
      throw new BadRequestException(`Vehicle is not ACTIVE (current status: ${vehicle.status})`);
    }

    // Check Module 11 WorkOrder maintenance hold
    if (workOrderDelegate?.findFirst) {
      const activeWorkOrder = (await workOrderDelegate.findFirst({
        where: {
          companyId,
          vehicleId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      })) as { id: string; workOrderNumber?: string } | null;

      if (activeWorkOrder) {
        throw new ConflictException(
          `Vehicle is unavailable due to active maintenance (Work Order ${activeWorkOrder.workOrderNumber ?? activeWorkOrder.id})`,
        );
      }
    }

    // Check conflict on another active executing trip
    const activeTrip = await tripDelegate.findFirst({
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

    // Check conflict on overlapping scheduled trip time window
    if (targetTrip?.scheduledStart && tripDelegate.findMany) {
      const bufferMs = DISPATCH_CONFLICT_BUFFER_MINUTES * 60 * 1000;
      const targetDurationMs = (targetTrip.durationMinutes ?? 60) * 60 * 1000;
      const targetStartMs = new Date(targetTrip.scheduledStart).getTime() - bufferMs;
      const targetEndMs = new Date(targetTrip.scheduledStart).getTime() + targetDurationMs + bufferMs;

      const otherTrips = (await tripDelegate.findMany({
        where: {
          companyId,
          vehicleId,
          deletedAt: null,
          status: { in: ['SCHEDULED', 'DRIVER_ASSIGNED', 'VEHICLE_ASSIGNED', 'DISPATCHED', 'DRIVER_ARRIVED', 'PASSENGER_ONBOARD', 'IN_PROGRESS'] },
          ...(tripId ? { id: { not: tripId } } : {}),
        },
      })) as TripRow[] | undefined;

      if (otherTrips && otherTrips.length > 0) {
        for (const other of otherTrips) {
          if (other.scheduledStart) {
            const otherDurationMs = (other.durationMinutes ?? 60) * 60 * 1000;
            const otherStartMs = new Date(other.scheduledStart).getTime() - bufferMs;
            const otherEndMs = new Date(other.scheduledStart).getTime() + otherDurationMs + bufferMs;
            if (otherStartMs < targetEndMs && otherEndMs > targetStartMs) {
              throw new ConflictException(
                `Vehicle is already scheduled for an overlapping trip (${other.tripNumber ?? other.id})`,
              );
            }
          }
        }
      }
    }
  }

  // ─── Resource Availability ──────────────────────────────────────────────────
  async getResourceAvailability(
    companyId: string,
    scheduledStartTime?: string,
    durationMinutes?: number,
  ): Promise<DispatchAvailabilityResponseDto> {
    const drivers = (await this.db.driver.findMany({
      where: { companyId, deletedAt: null },
      include: { employee: true },
    })) as any[];

    const vehicles = (await this.db.vehicle.findMany({
      where: { companyId, deletedAt: null },
    })) as any[];

    const targetTime = scheduledStartTime ? new Date(scheduledStartTime) : new Date();
    const duration = durationMinutes ?? 60;
    const bufferMs = DISPATCH_CONFLICT_BUFFER_MINUTES * 60 * 1000;
    const targetStartMs = targetTime.getTime() - bufferMs;
    const targetEndMs = targetTime.getTime() + duration * 60 * 1000 + bufferMs;

    // Fetch active trips in company
    const activeTrips = (await this.db.trip.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: {
          in: [
            'SCHEDULED',
            'DRIVER_ASSIGNED',
            'VEHICLE_ASSIGNED',
            'DISPATCHED',
            'DRIVER_ARRIVED',
            'PASSENGER_ONBOARD',
            'IN_PROGRESS',
          ],
        },
      },
      select: {
        id: true,
        tripNumber: true,
        driverId: true,
        vehicleId: true,
        status: true,
        scheduledStart: true,
        durationMinutes: true,
      },
    })) as any[];

    // Fetch active work orders if delegate exists
    let activeWorkOrders: any[] = [];
    if (this.db.workOrder?.findMany) {
      activeWorkOrders = (await this.db.workOrder.findMany({
        where: {
          companyId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
        select: { vehicleId: true, workOrderNumber: true },
      })) as any[];
    }

    const availableDrivers: DriverAvailabilityDto[] = drivers.map((d) => {
      let isAvailable = true;
      let conflictReason: string | undefined;

      if (d.status !== 'ACTIVE') {
        isAvailable = false;
        conflictReason = `Driver status is ${d.status}`;
      } else if (new Date(d.licenseExpiryDate) < new Date()) {
        isAvailable = false;
        conflictReason = `Driver's license is expired`;
      } else {
        const executing = activeTrips.find(
          (t) =>
            t.driverId === d.id &&
            ['DISPATCHED', 'DRIVER_ARRIVED', 'PASSENGER_ONBOARD', 'IN_PROGRESS'].includes(t.status),
        );
        if (executing) {
          isAvailable = false;
          conflictReason = `Currently executing trip ${executing.tripNumber}`;
        } else if (scheduledStartTime) {
          const overlap = activeTrips.find((t) => {
            if (t.driverId !== d.id || !t.scheduledStart) return false;
            const otherDurMs = (t.durationMinutes ?? 60) * 60 * 1000;
            const otherStartMs = new Date(t.scheduledStart).getTime() - bufferMs;
            const otherEndMs = new Date(t.scheduledStart).getTime() + otherDurMs + bufferMs;
            return otherStartMs < targetEndMs && otherEndMs > targetStartMs;
          });
          if (overlap) {
            isAvailable = false;
            conflictReason = `Scheduled trip conflict with ${overlap.tripNumber}`;
          }
        }
      }

      const name = d.employee
        ? `${d.employee.firstName} ${d.employee.lastName}`.trim()
        : d.driverCode;

      return {
        id: d.id,
        driverCode: d.driverCode,
        name,
        dutyStatus: d.dutyStatus ?? 'UNKNOWN',
        status: d.status,
        isAvailable,
        conflictReason,
      };
    });

    const availableVehicles: VehicleAvailabilityDto[] = vehicles.map((v) => {
      let isAvailable = true;
      let conflictReason: string | undefined;

      if (v.status !== 'ACTIVE') {
        isAvailable = false;
        conflictReason = `Vehicle status is ${v.status}`;
      } else {
        const wo = activeWorkOrders.find((w) => w.vehicleId === v.id);
        if (wo) {
          isAvailable = false;
          conflictReason = `Under maintenance (Work Order ${wo.workOrderNumber ?? wo.id})`;
        } else {
          const executing = activeTrips.find(
            (t) =>
              t.vehicleId === v.id &&
              ['DISPATCHED', 'DRIVER_ARRIVED', 'PASSENGER_ONBOARD', 'IN_PROGRESS'].includes(t.status),
          );
          if (executing) {
            isAvailable = false;
            conflictReason = `Currently executing trip ${executing.tripNumber}`;
          } else if (scheduledStartTime) {
            const overlap = activeTrips.find((t) => {
              if (t.vehicleId !== v.id || !t.scheduledStart) return false;
              const otherDurMs = (t.durationMinutes ?? 60) * 60 * 1000;
              const otherStartMs = new Date(t.scheduledStart).getTime() - bufferMs;
              const otherEndMs = new Date(t.scheduledStart).getTime() + otherDurMs + bufferMs;
              return otherStartMs < targetEndMs && otherEndMs > targetStartMs;
            });
            if (overlap) {
              isAvailable = false;
              conflictReason = `Scheduled trip conflict with ${overlap.tripNumber}`;
            }
          }
        }
      }

      return {
        id: v.id,
        vehicleNumber: v.vehicleNumber,
        make: v.make,
        model: v.model,
        status: v.status,
        isAvailable,
        conflictReason,
      };
    });

    return { drivers: availableDrivers, vehicles: availableVehicles };
  }

  // ─── Stops Management (Phase 12B) ───────────────────────────────────────────
  async getStops(tripId: string, companyId: string): Promise<TripStopDto[]> {
    const trip = await this.db.trip.findFirst({
      where: { id: tripId, companyId, deletedAt: null },
    });
    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    if (!this.db.tripStop?.findMany) {
      return [];
    }

    const stops = (await this.db.tripStop.findMany({
      where: { tripId, companyId },
      orderBy: { stopOrder: 'asc' },
    })) as any[];

    return stops.map(mapStop);
  }

  async addStop(
    tripId: string,
    companyId: string,
    dto: CreateTripStopDto,
    userId: string,
    meta: AuditMeta,
  ): Promise<TripStopDto> {
    const trip = await this.db.trip.findFirst({
      where: { id: tripId, companyId, deletedAt: null },
    });
    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes((trip as any).status)) {
      throw new BadRequestException(`Cannot add stops to trip in ${(trip as any).status} status`);
    }

    let stopOrder = dto.stopOrder;
    if (!stopOrder && this.db.tripStop?.count) {
      const currentCount = await this.db.tripStop.count({ where: { tripId } });
      stopOrder = currentCount + 1;
    } else if (!stopOrder) {
      stopOrder = 1;
    }

    const created = (await this.db.tripStop!.create({
      data: {
        companyId,
        tripId,
        stopOrder,
        stopType: dto.stopType ?? 'WAYPOINT',
        locationName: dto.locationName.trim(),
        address: dto.address?.trim() ?? null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        plannedArrival: dto.plannedArrival ? new Date(dto.plannedArrival) : null,
        plannedDeparture: dto.plannedDeparture ? new Date(dto.plannedDeparture) : null,
        passengerName: dto.passengerName?.trim() ?? null,
        passengerPhone: dto.passengerPhone?.trim() ?? null,
        notes: dto.notes?.trim() ?? null,
        status: 'PENDING',
      },
    })) as any;

    await this.audit(
      'TRIP_STOP_ADDED',
      tripId,
      companyId,
      userId,
      meta,
      { stopId: created.id, stopOrder, locationName: created.locationName },
    );

    const mapped = mapStop(created);
    this.telemetryGateway?.broadcastDispatchStopUpdated(companyId, {
      tripId,
      action: 'ADDED',
      stop: mapped,
    });

    return mapped;
  }

  async updateStop(
    tripId: string,
    stopId: string,
    companyId: string,
    dto: UpdateTripStopDto,
    userId: string,
    meta: AuditMeta,
  ): Promise<TripStopDto> {
    const trip = await this.db.trip.findFirst({
      where: { id: tripId, companyId, deletedAt: null },
    });
    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    const existingStop = (await this.db.tripStop!.findFirst({
      where: { id: stopId, tripId, companyId },
    })) as any;

    if (!existingStop) {
      throw new NotFoundException('Stop not found for this trip');
    }

    const updated = (await this.db.tripStop!.update({
      where: { id: stopId },
      data: {
        ...(dto.locationName !== undefined ? { locationName: dto.locationName.trim() } : {}),
        ...(dto.address !== undefined ? { address: dto.address?.trim() ?? null } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.stopType !== undefined ? { stopType: dto.stopType } : {}),
        ...(dto.plannedArrival !== undefined ? { plannedArrival: dto.plannedArrival ? new Date(dto.plannedArrival) : null } : {}),
        ...(dto.plannedDeparture !== undefined ? { plannedDeparture: dto.plannedDeparture ? new Date(dto.plannedDeparture) : null } : {}),
        ...(dto.actualArrival !== undefined ? { actualArrival: dto.actualArrival ? new Date(dto.actualArrival) : null } : {}),
        ...(dto.actualDeparture !== undefined ? { actualDeparture: dto.actualDeparture ? new Date(dto.actualDeparture) : null } : {}),
        ...(dto.passengerName !== undefined ? { passengerName: dto.passengerName?.trim() ?? null } : {}),
        ...(dto.passengerPhone !== undefined ? { passengerPhone: dto.passengerPhone?.trim() ?? null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() ?? null } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    })) as any;

    await this.audit(
      'TRIP_STOP_UPDATED',
      tripId,
      companyId,
      userId,
      meta,
      { stopId, changes: dto },
    );

    const mapped = mapStop(updated);
    this.telemetryGateway?.broadcastDispatchStopUpdated(companyId, {
      tripId,
      action: 'UPDATED',
      stop: mapped,
    });

    return mapped;
  }

  async deleteStop(
    tripId: string,
    stopId: string,
    companyId: string,
    userId: string,
    meta: AuditMeta,
  ): Promise<{ success: boolean; message: string }> {
    const trip = await this.db.trip.findFirst({
      where: { id: tripId, companyId, deletedAt: null },
    });
    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    const existingStop = (await this.db.tripStop!.findFirst({
      where: { id: stopId, tripId, companyId },
    })) as any;

    if (!existingStop) {
      throw new NotFoundException('Stop not found for this trip');
    }

    await this.db.tripStop!.delete({ where: { id: stopId } });

    // Re-sequence remaining stops
    if (this.db.tripStop?.findMany) {
      const remaining = (await this.db.tripStop.findMany({
        where: { tripId, companyId },
        orderBy: { stopOrder: 'asc' },
      })) as any[];

      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].stopOrder !== i + 1) {
          await this.db.tripStop.update({
            where: { id: remaining[i].id },
            data: { stopOrder: i + 1 },
          });
        }
      }
    }

    await this.audit(
      'TRIP_STOP_DELETED',
      tripId,
      companyId,
      userId,
      meta,
      { stopId, previousOrder: existingStop.stopOrder },
    );

    this.telemetryGateway?.broadcastDispatchStopUpdated(companyId, {
      tripId,
      action: 'DELETED',
      stopId,
    });

    return { success: true, message: 'Stop deleted successfully' };
  }

  async reorderStops(
    tripId: string,
    companyId: string,
    stopIds: string[],
    userId: string,
    meta: AuditMeta,
  ): Promise<TripStopDto[]> {
    const trip = await this.db.trip.findFirst({
      where: { id: tripId, companyId, deletedAt: null },
    });
    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    if (!Array.isArray(stopIds) || stopIds.length === 0) {
      throw new BadRequestException('stopIds array must be provided and not empty');
    }

    // 1. Reject duplicate stop IDs in input
    const uniqueIds = new Set(stopIds);
    if (uniqueIds.size !== stopIds.length) {
      throw new BadRequestException('Duplicate stop IDs provided in reorder list');
    }

    if (!this.db.tripStop?.findMany) {
      return [];
    }

    // 2. Fetch existing stops for this exact trip and company
    const existingStops = (await this.db.tripStop.findMany({
      where: { tripId, companyId },
      orderBy: { stopOrder: 'asc' },
    })) as any[];

    // 3. Reject incomplete or extra ordering requests (must match complete set of stops)
    if (stopIds.length !== existingStops.length) {
      throw new BadRequestException(
        `Reorder request must include all ${existingStops.length} stops for this trip (received ${stopIds.length})`,
      );
    }

    // 4. Reject nonexistent, foreign-trip, or cross-tenant stop IDs
    const existingMap = new Map(existingStops.map((s) => [s.id, s]));
    for (const sid of stopIds) {
      if (!existingMap.has(sid)) {
        throw new BadRequestException(`Stop ID ${sid} does not belong to this trip`);
      }
    }

    // 5. Execute two-stage sequence update inside database transaction
    // Stage 1 moves target stops to temporary negative indices to eliminate
    // @@unique([tripId, stopOrder]) collision when stops swap positions.
    // Stage 2 sets the final 1-indexed positive sequence orders.
    const executeTx = async (tx: any) => {
      const stopDelegate = tx.tripStop ?? this.db.tripStop;

      // Stage 1: Temporary negative order assignment
      for (let i = 0; i < stopIds.length; i++) {
        await stopDelegate.update({
          where: { id: stopIds[i] },
          data: { stopOrder: -(i + 1) },
        });
      }

      // Stage 2: Final positive order assignment
      for (let i = 0; i < stopIds.length; i++) {
        await stopDelegate.update({
          where: { id: stopIds[i] },
          data: { stopOrder: i + 1 },
        });
      }

      // Stage 3: Fetch updated stops ordered by new sequence
      return (await stopDelegate.findMany({
        where: { tripId, companyId },
        orderBy: { stopOrder: 'asc' },
      })) as any[];
    };

    let updatedStops: any[];
    if (typeof (this._db as any).$transaction === 'function') {
      updatedStops = await (this._db as any).$transaction(async (tx: any) => executeTx(tx));
    } else {
      updatedStops = await executeTx(this.db);
    }

    await this.audit(
      'TRIP_STOPS_REORDERED',
      tripId,
      companyId,
      userId,
      meta,
      { newOrder: stopIds },
    );

    const mapped = updatedStops.map(mapStop);
    this.telemetryGateway?.broadcastDispatchStopUpdated(companyId, {
      tripId,
      action: 'REORDERED',
      stops: mapped,
    });

    return mapped;
  }

  // ─── Routing & Route Calculation (Phase 12B) ─────────────────────────────────
  async calculateTripRoute(
    tripId: string,
    companyId: string,
  ): Promise<CalculatedRoute> {
    const trip = (await this.db.trip.findFirst({
      where: { id: tripId, companyId, deletedAt: null },
    })) as TripRow | null;

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    const origin = {
      latitude: trip.pickupLatitude ?? 0,
      longitude: trip.pickupLongitude ?? 0,
    };
    const destination = {
      latitude: trip.dropLatitude ?? 0,
      longitude: trip.dropLongitude ?? 0,
    };

    let waypoints: Array<{ latitude: number; longitude: number }> = [];
    if (this.db.tripStop?.findMany) {
      const stops = (await this.db.tripStop.findMany({
        where: { tripId, companyId },
        orderBy: { stopOrder: 'asc' },
      })) as any[];
      waypoints = stops.map((s) => ({ latitude: s.latitude, longitude: s.longitude }));
    }

    let route: CalculatedRoute;
    if (this.routingService) {
      route = await this.routingService.calculateRoute(origin, destination, waypoints);
    } else {
      const { MockRoutingProvider } = require('./routing/mock-routing.provider');
      const mock = new MockRoutingProvider();
      route = await mock.calculateRoute(origin, destination, waypoints);
    }

    await this.db.trip.update({
      where: { id: tripId },
      data: {
        distanceKm: route.distanceKm,
        durationMinutes: route.durationMinutes,
        routePolyline: route.geometryPolyline,
      },
    });

    return route;
  }

  async calculateTripEta(
    tripId: string,
    companyId: string,
    currentLatitude?: number,
    currentLongitude?: number,
  ): Promise<import('@ai-mos/types').EtaEstimateDto> {
    const trip = (await this.db.trip.findFirst({
      where: { id: tripId, companyId, deletedAt: null },
    })) as TripRow | null;

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    const dest = {
      latitude: trip.dropLatitude ?? 0,
      longitude: trip.dropLongitude ?? 0,
    };

    const currentLoc = {
      latitude: currentLatitude ?? trip.pickupLatitude ?? 0,
      longitude: currentLongitude ?? trip.pickupLongitude ?? 0,
    };

    let eta: CalculatedEta;
    if (this.routingService) {
      eta = await this.routingService.calculateEta(currentLoc, dest);
    } else {
      const { MockRoutingProvider } = require('./routing/mock-routing.provider');
      const mock = new MockRoutingProvider();
      eta = await mock.calculateEta(currentLoc, dest);
    }

    const result = {
      tripId,
      currentLatitude: currentLoc.latitude,
      currentLongitude: currentLoc.longitude,
      destinationLatitude: dest.latitude,
      destinationLongitude: dest.longitude,
      distanceRemainingKm: eta.distanceKm,
      durationRemainingMinutes: eta.etaMinutes,
      calculatedAt: new Date().toISOString(),
      calculationSource: eta.source,
    };

    this.telemetryGateway?.broadcastDispatchEtaUpdated(companyId, result);

    return result;
  }

  // ─── Dispatch Analytics (Phase 12D) ─────────────────────────────────────────
  async getDispatchAnalytics(companyId: string): Promise<DispatchAnalyticsDto> {
    const [tripsRaw, driversRaw, vehiclesRaw, reassignLogs] = await Promise.all([
      this.db.trip.findMany({
        where: { companyId, deletedAt: null },
        select: {
          id: true,
          status: true,
          scheduledStart: true,
          actualStart: true,
          driverId: true,
          vehicleId: true,
        },
      }),
      this.db.driver.findMany({
        where: { companyId, status: 'ACTIVE' },
        select: { id: true, dutyStatus: true },
      }),
      this.db.vehicle.findMany({
        where: { companyId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true },
      }),
      this.db.auditLog?.count
        ? this.db.auditLog.count({
            where: {
              action: { in: ['TRIP_DRIVER_UNASSIGNED', 'TRIP_VEHICLE_UNASSIGNED'] },
              metadata: { path: ['companyId'], equals: companyId },
            },
          }).catch(() => 0)
        : Promise.resolve(0),
    ]);

    const trips = (tripsRaw ?? []) as any[];
    const drivers = (driversRaw ?? []) as any[];
    const vehicles = (vehiclesRaw ?? []) as any[];

    const totalScheduled = trips.length;
    const unassignedTrips = trips.filter(
      (t) =>
        t.status === 'SCHEDULED' ||
        ((t.status === 'DRIVER_ASSIGNED' || t.status === 'VEHICLE_ASSIGNED') &&
          (!t.driverId || !t.vehicleId)),
    ).length;
    const assignedTrips = trips.filter(
      (t) =>
        ['DRIVER_ASSIGNED', 'VEHICLE_ASSIGNED', 'DISPATCHED'].includes(t.status) &&
        t.driverId &&
        t.vehicleId,
    ).length;
    const completedTrips = trips.filter((t) => t.status === 'COMPLETED').length;
    const cancelledTrips = trips.filter((t) => t.status === 'CANCELLED').length;

    const tripsWithStarts = trips.filter((t) => t.scheduledStart && t.actualStart);
    let averageLeadTimeMinutes: number | null = null;
    let averageDelayMinutes: number | null = null;
    let onTimePickupRate: number | null = null;

    if (tripsWithStarts.length > 0) {
      let totalLeadMinutes = 0;
      let totalDelayMinutes = 0;
      let onTimeCount = 0;

      for (const t of tripsWithStarts) {
        const sched = new Date(t.scheduledStart!).getTime();
        const act = new Date(t.actualStart!).getTime();
        const diffMinutes = Math.round((act - sched) / 60000);
        totalLeadMinutes += Math.abs(diffMinutes);
        if (diffMinutes > 0) {
          totalDelayMinutes += diffMinutes;
        }
        if (diffMinutes <= 15) {
          onTimeCount++;
        }
      }

      averageLeadTimeMinutes = Math.round((totalLeadMinutes / tripsWithStarts.length) * 10) / 10;
      averageDelayMinutes = Math.round((totalDelayMinutes / tripsWithStarts.length) * 10) / 10;
      onTimePickupRate = Math.round((onTimeCount / tripsWithStarts.length) * 100);
    }

    const activeTripsDriverIds = new Set(
      trips
        .filter((t) => ['IN_PROGRESS', 'PASSENGER_ONBOARD', 'DRIVER_ARRIVED'].includes(t.status) && t.driverId)
        .map((t) => t.driverId),
    );
    const driverUtilizationRate = drivers.length > 0
      ? Math.round((activeTripsDriverIds.size / drivers.length) * 100)
      : null;

    const activeTripsVehicleIds = new Set(
      trips
        .filter((t) => ['IN_PROGRESS', 'PASSENGER_ONBOARD', 'DRIVER_ARRIVED', 'DISPATCHED'].includes(t.status) && t.vehicleId)
        .map((t) => t.vehicleId),
    );
    const vehicleUtilizationRate = vehicles.length > 0
      ? Math.round((activeTripsVehicleIds.size / vehicles.length) * 100)
      : null;

    return {
      totalScheduled,
      unassignedTrips,
      assignedTrips,
      completedTrips,
      cancelledTrips,
      reassignmentCount: typeof reassignLogs === 'number' ? reassignLogs : 0,
      averageLeadTimeMinutes,
      driverUtilizationRate,
      vehicleUtilizationRate,
      onTimePickupRate,
      averageDelayMinutes,
      reportingPeriod: 'ALL_TIME',
    };
  }
}
