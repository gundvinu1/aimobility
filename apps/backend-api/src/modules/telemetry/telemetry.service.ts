import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../cache/cache.service';
import { TelemetryGateway } from './telemetry.gateway';
import { AlertEvaluationService } from '../alert/alert-evaluation.service';
import { IngestTelemetryDto, ListTelemetryDto } from './dto/ingest-telemetry.dto';
import {
  TRACKING_REDIS_KEYS,
  TELEMETRY_OFFLINE_THRESHOLD_SECONDS,
  TELEMETRY_MAX_PAGE_SIZE,
  TELEMETRY_DEFAULT_WINDOW_HOURS,
} from '@ai-mos/constants';
import type {
  VehicleLocationDto,
  VehicleTelemetryDto,
  VehicleTelemetryListDto,
  FleetTrackingVehicleDto,
  FleetSnapshotDto,
  FleetVehicleStatus,
} from '@ai-mos/types';
import type { VehicleLocation } from '@prisma/client';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService,
    @Inject(forwardRef(() => TelemetryGateway))
    private readonly gateway: TelemetryGateway,
    @Optional()
    @Inject(forwardRef(() => AlertEvaluationService))
    private readonly alertEvaluationService?: AlertEvaluationService,
  ) {}

  // ─── Ingest ─────────────────────────────────────────────────────────────────

  /**
   * Ingest a single telemetry event.
   * Validates vehicle ownership, coordinate bounds, driver assignment, and timestamp.
   * Upserts VehicleLocation (latest) and appends VehicleTelemetry (history).
   * Caches latest location in Redis and broadcasts event via WebSocket gateway.
   */
  async ingestTelemetry(
    companyId: string,
    dto: IngestTelemetryDto,
  ): Promise<{ location: VehicleLocationDto; isNew: boolean }> {
    // 1. Validate vehicle exists and belongs to this tenant
    const vehicle = await this.db.vehicle.findFirst({
      where: { id: dto.vehicleId, companyId, deletedAt: null },
      select: { id: true, companyId: true, status: true, vehicleNumber: true },
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${dto.vehicleId} not found in this company`);
    }

    // 2. Validate coordinate and metric bounds
    if (dto.latitude < -90 || dto.latitude > 90) {
      throw new BadRequestException('Latitude must be between -90 and 90 degrees');
    }
    if (dto.longitude < -180 || dto.longitude > 180) {
      throw new BadRequestException('Longitude must be between -180 and 180 degrees');
    }
    if (dto.speed !== undefined && (dto.speed < 0 || dto.speed > 500)) {
      throw new BadRequestException('Speed must be between 0 and 500 km/h');
    }
    if (dto.heading !== undefined && (dto.heading < 0 || dto.heading > 360)) {
      throw new BadRequestException('Heading must be between 0 and 360 degrees');
    }

    // 3. Resolve driver assignment
    let assignedDriverId = dto.driverId ?? null;
    let driverName: string | null = null;

    if (assignedDriverId) {
      const driver = await this.db.driver.findFirst({
        where: { id: assignedDriverId, companyId, deletedAt: null },
        include: {
          employee: { select: { firstName: true, lastName: true } },
        },
      });
      if (!driver) {
        throw new ForbiddenException(`Driver ${assignedDriverId} is not part of this company`);
      }
      const emp = driver.employee;
      driverName = emp ? `${emp.firstName} ${emp.lastName}`.trim() : driver.driverCode;
    } else {
      // Auto-resolve active assigned driver for this vehicle
      const activeAssignment = await this.db.driverVehicleAssignment.findFirst({
        where: { vehicleId: dto.vehicleId, isActive: true },
        include: {
          driver: {
            include: {
              employee: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });
      if (activeAssignment?.driver) {
        assignedDriverId = activeAssignment.driver.id;
        const emp = activeAssignment.driver.employee;
        driverName = emp
          ? `${emp.firstName} ${emp.lastName}`.trim()
          : activeAssignment.driver.driverCode;
      }
    }

    // 4. Validate timestamp is not in the far future (max +5 minutes)
    const eventTs = new Date(dto.timestamp);
    if (isNaN(eventTs.getTime())) {
      throw new BadRequestException('Invalid timestamp format');
    }
    const nowMs = Date.now();
    if (eventTs.getTime() > nowMs + 5 * 60 * 1000) {
      throw new BadRequestException('Telemetry timestamp cannot be more than 5 minutes in the future');
    }

    // 5. Check if vehicle is currently on an active trip
    const activeTrip = await this.db.trip.findFirst({
      where: {
        vehicleId: dto.vehicleId,
        companyId,
        status: { in: ['DISPATCHED', 'DRIVER_ARRIVED', 'PASSENGER_ONBOARD', 'IN_PROGRESS'] },
      },
      select: { id: true, tripNumber: true },
    });

    const locationData = {
      companyId,
      vehicleId: dto.vehicleId,
      driverId: assignedDriverId,
      latitude: dto.latitude,
      longitude: dto.longitude,
      speed: dto.speed ?? 0,
      heading: dto.heading ?? null,
      accuracy: dto.accuracy ?? null,
      altitude: dto.altitude ?? null,
      ignition: dto.ignition ?? false,
      batteryLevel: dto.batteryLevel ?? null,
      odometer: dto.odometer ?? null,
      engineTemperature: dto.engineTemperature ?? null,
      fuelLevel: dto.fuelLevel ?? null,
      signalStrength: dto.signalStrength ?? null,
      source: dto.source ?? 'API' as const,
      timestamp: eventTs,
    };

    // 6. Upsert latest location (one row per vehicle)
    const existing = await this.db.vehicleLocation.findUnique({
      where: { vehicleId: dto.vehicleId },
    });

    const location = await this.db.vehicleLocation.upsert({
      where: { vehicleId: dto.vehicleId },
      create: locationData,
      update: locationData,
    });

    // 7. Append to history (VehicleTelemetry)
    await this.db.vehicleTelemetry.create({ data: locationData });

    // 8. Cache latest location in Redis (TTL = offline threshold * 2)
    const locationDto = this.toLocationDto(location);
    const redisKey = TRACKING_REDIS_KEYS.vehicleLocation(dto.vehicleId);
    await this.cache.set(redisKey, locationDto, TELEMETRY_OFFLINE_THRESHOLD_SECONDS * 2);

    // 9. Derive live fleet status
    const fleetStatus = this.deriveFleetStatus(vehicle.status, true, !!activeTrip);

    // 10. Real-time fan-out via WebSocket gateway
    if (this.gateway) {
      this.gateway.broadcastLocationUpdated(companyId, {
        companyId,
        vehicleId: dto.vehicleId,
        location: locationDto,
        fleetStatus,
        driverId: assignedDriverId,
        driverName,
        currentTripId: activeTrip?.id ?? null,
      });

      if (assignedDriverId) {
        this.gateway.broadcastDriverLocationUpdated(companyId, {
          driverId: assignedDriverId,
          vehicleId: dto.vehicleId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          speed: dto.speed ?? 0,
          heading: dto.heading ?? null,
          timestamp: eventTs.toISOString(),
        });
      }

      if (activeTrip) {
        this.gateway.broadcastTripLocationUpdated(companyId, {
          tripId: activeTrip.id,
          tripNumber: activeTrip.tripNumber,
          vehicleId: dto.vehicleId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          speed: dto.speed ?? 0,
          timestamp: eventTs.toISOString(),
        });
      }

      this.gateway.broadcastStatusUpdated(companyId, {
        companyId,
        vehicleId: dto.vehicleId,
        vehicleStatus: vehicle.status,
        fleetStatus,
      });
    }

    // 11. Fleet Alert & Geofencing Evaluation (Module 10)
    if (this.alertEvaluationService) {
      void this.alertEvaluationService.evaluateTelemetry({
        companyId,
        vehicleId: dto.vehicleId,
        vehicleNumber: vehicle.vehicleNumber,
        driverId: assignedDriverId,
        tripId: activeTrip?.id ?? null,
        previousLocation: existing
          ? {
              latitude: existing.latitude,
              longitude: existing.longitude,
              speed: existing.speed,
              timestamp: existing.timestamp,
              ignition: existing.ignition,
              fuelLevel: existing.fuelLevel ?? null,
              odometer: existing.odometer ?? null,
            }
          : null,
        currentLocation: {
          latitude: dto.latitude,
          longitude: dto.longitude,
          speed: dto.speed ?? 0,
          timestamp: eventTs,
          ignition: dto.ignition ?? false,
          fuelLevel: dto.fuelLevel ?? null,
          odometer: dto.odometer ?? null,
        },
      });
    }

    this.logger.debug(
      `Telemetry ingested for vehicle ${dto.vehicleId} at ${dto.latitude},${dto.longitude} [tenant: ${companyId}]`,
    );

    return { location: locationDto, isNew: !existing };
  }

  // ─── Latest Location ────────────────────────────────────────────────────────

  async getVehicleLocation(companyId: string, vehicleId: string): Promise<VehicleLocationDto | null> {
    // 1. Verify vehicle belongs to tenant
    const vehicle = await this.db.vehicle.findFirst({
      where: { id: vehicleId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${vehicleId} not found in this company`);
    }

    // 2. Try Redis first
    const cached = await this.cache.get<VehicleLocationDto>(
      TRACKING_REDIS_KEYS.vehicleLocation(vehicleId),
    );
    if (cached) return cached;

    // 3. Fall back to DB
    const location = await this.db.vehicleLocation.findFirst({
      where: { vehicleId, companyId },
    });
    return location ? this.toLocationDto(location) : null;
  }

  // ─── Fleet Snapshot ─────────────────────────────────────────────────────────

  async getFleetSnapshot(companyId: string): Promise<FleetSnapshotDto> {
    const vehicles = await this.db.vehicle.findMany({
      where: { companyId, deletedAt: null },
      select: {
        id: true,
        companyId: true,
        vehicleNumber: true,
        make: true,
        model: true,
        year: true,
        color: true,
        status: true,
        location: true,
        driverAssignments: {
          where: { isActive: true },
          take: 1,
          select: {
            driver: {
              select: {
                id: true,
                driverCode: true,
                dutyStatus: true,
                employee: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
        trips: {
          where: { status: { in: ['DISPATCHED', 'DRIVER_ARRIVED', 'PASSENGER_ONBOARD', 'IN_PROGRESS'] } },
          take: 1,
          select: { id: true, tripNumber: true },
        },
      },
    });

    const nowMs = Date.now();
    const offlineThresholdMs = TELEMETRY_OFFLINE_THRESHOLD_SECONDS * 1000;

    const trackingVehicles: FleetTrackingVehicleDto[] = vehicles.map((v) => {
      const assignment = v.driverAssignments[0];
      const driver = assignment?.driver;
      const currentTrip = v.trips[0];
      const loc = v.location;
      const lastSeen = loc ? new Date(loc.timestamp).getTime() : null;
      const isOnline = lastSeen !== null && nowMs - lastSeen < offlineThresholdMs;

      const fleetStatus = this.deriveFleetStatus(v.status, isOnline, !!currentTrip);

      return {
        vehicleId: v.id,
        companyId: v.companyId,
        vehicleNumber: v.vehicleNumber,
        make: v.make,
        model: v.model,
        year: v.year,
        color: v.color ?? null,
        vehicleStatus: v.status,
        fleetStatus,
        driverId: driver?.id ?? null,
        driverCode: driver?.driverCode ?? null,
        driverName: driver
          ? `${driver.employee?.firstName ?? ''} ${driver.employee?.lastName ?? ''}`.trim() || driver.driverCode
          : null,
        driverDutyStatus: driver?.dutyStatus ?? null,
        currentTripId: currentTrip?.id ?? null,
        currentTripNumber: currentTrip?.tripNumber ?? null,
        location: loc ? this.toLocationDto(loc) : null,
        lastSeenAt: loc ? loc.timestamp.toISOString() : null,
        isOnline,
      };
    });

    const onlineCount = trackingVehicles.filter((v) => v.isOnline).length;
    const onTripCount = trackingVehicles.filter((v) => v.fleetStatus === 'ON_TRIP').length;

    return {
      companyId,
      vehicles: trackingVehicles,
      totalVehicles: trackingVehicles.length,
      onlineCount,
      offlineCount: trackingVehicles.length - onlineCount,
      onTripCount,
      fetchedAt: new Date().toISOString(),
    };
  }

  // ─── Telemetry History ───────────────────────────────────────────────────────

  async getTelemetryHistory(
    companyId: string,
    vehicleId: string,
    dto: ListTelemetryDto,
  ): Promise<VehicleTelemetryListDto> {
    // Verify vehicle belongs to tenant
    const vehicle = await this.db.vehicle.findFirst({
      where: { id: vehicleId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${vehicleId} not found in this company`);
    }

    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 50, TELEMETRY_MAX_PAGE_SIZE);
    const skip = (page - 1) * limit;

    // Default window: last 24 hours
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - TELEMETRY_DEFAULT_WINDOW_HOURS * 3600 * 1000);
    const from = dto.from ? new Date(dto.from) : defaultFrom;
    const to = dto.to ? new Date(dto.to) : now;

    const where = {
      vehicleId,
      companyId,
      timestamp: { gte: from, lte: to },
      ...(dto.source ? { source: dto.source } : {}),
    };

    const [telemetry, total] = await this.db.$transaction([
      this.db.vehicleTelemetry.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      this.db.vehicleTelemetry.count({ where }),
    ]);

    return {
      telemetry: telemetry.map((t) => this.toTelemetryDto(t)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Offline Detection & Status Derivation ───────────────────────────────────

  /**
   * Derive fleet tracking status from vehicle DB status + online presence.
   */
  deriveFleetStatus(
    vehicleStatus: string,
    isOnline: boolean,
    isOnTrip: boolean,
  ): FleetVehicleStatus {
    if (vehicleStatus === 'MAINTENANCE') return 'MAINTENANCE';
    if (!isOnline) return 'OFFLINE';
    if (isOnTrip || vehicleStatus === 'ON_TRIP') return 'ON_TRIP';
    return 'ACTIVE';
  }

  // ─── Mappers ─────────────────────────────────────────────────────────────────

  toLocationDto(loc: VehicleLocation): VehicleLocationDto {
    return {
      id: loc.id,
      companyId: loc.companyId,
      vehicleId: loc.vehicleId,
      driverId: loc.driverId ?? null,
      latitude: loc.latitude,
      longitude: loc.longitude,
      speed: loc.speed,
      heading: loc.heading ?? null,
      accuracy: loc.accuracy ?? null,
      altitude: loc.altitude ?? null,
      ignition: loc.ignition,
      batteryLevel: loc.batteryLevel ?? null,
      odometer: loc.odometer ?? null,
      engineTemperature: loc.engineTemperature ?? null,
      fuelLevel: loc.fuelLevel ?? null,
      signalStrength: loc.signalStrength ?? null,
      source: loc.source as import('@ai-mos/types').TelemetrySource,
      timestamp: loc.timestamp.toISOString(),
      createdAt: loc.createdAt.toISOString(),
      updatedAt: loc.updatedAt.toISOString(),
    };
  }

  private toTelemetryDto(t: import('@prisma/client').VehicleTelemetry): VehicleTelemetryDto {
    return {
      id: t.id,
      companyId: t.companyId,
      vehicleId: t.vehicleId,
      driverId: t.driverId ?? null,
      latitude: t.latitude,
      longitude: t.longitude,
      speed: t.speed,
      heading: t.heading ?? null,
      accuracy: t.accuracy ?? null,
      altitude: t.altitude ?? null,
      ignition: t.ignition,
      batteryLevel: t.batteryLevel ?? null,
      odometer: t.odometer ?? null,
      engineTemperature: t.engineTemperature ?? null,
      fuelLevel: t.fuelLevel ?? null,
      signalStrength: t.signalStrength ?? null,
      source: t.source as import('@ai-mos/types').TelemetrySource,
      timestamp: t.timestamp.toISOString(),
      createdAt: t.createdAt.toISOString(),
    };
  }
}
