import { Injectable, Logger } from '@nestjs/common';
import { AlertService } from './alert.service';
import { GeofenceService } from '../geofence/geofence.service';
import { CacheService } from '../cache/cache.service';
import {
  ALERT_REDIS_KEYS,
  ALERT_DEFAULTS,
} from '@ai-mos/constants';

export interface TelemetryPoint {
  latitude: number;
  longitude: number;
  speed: number;
  timestamp: Date;
  ignition: boolean;
  fuelLevel?: number | null;
  odometer?: number | null;
}

export interface TelemetryEvaluationInput {
  companyId: string;
  vehicleId: string;
  vehicleNumber: string;
  driverId?: string | null;
  tripId?: string | null;
  previousLocation?: TelemetryPoint | null;
  currentLocation: TelemetryPoint;
}

@Injectable()
export class AlertEvaluationService {
  private readonly logger = new Logger(AlertEvaluationService.name);

  constructor(
    private readonly alertService: AlertService,
    private readonly geofenceService: GeofenceService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Main telemetry event evaluation entry point.
   * Evaluates geofences, overspeed, excessive idle, harsh braking, and fuel drops.
   * Designed to run safely and non-blockingly.
   */
  async evaluateTelemetry(input: TelemetryEvaluationInput): Promise<void> {
    try {
      // 1. Fetch company alert configuration
      const config = await this.alertService.getCompanyConfig(input.companyId);

      // 2. Evaluate Geofences (Entry / Exit)
      await this.evaluateGeofences(input, config);

      // 3. Evaluate Overspeed
      await this.evaluateOverspeed(input, config);

      // 4. Evaluate Excessive Idle
      await this.evaluateIdle(input, config);

      // 5. Evaluate Harsh Braking
      await this.evaluateHarshBraking(input, config);

      // 6. Evaluate Sudden Fuel Drop (Module 11)
      await this.evaluateFuelDrop(input, config);
    } catch (err) {
      this.logger.error(
        `Error evaluating telemetry for vehicle ${input.vehicleId}: ${err instanceof Error ? err.stack : err}`,
      );
    }
  }

  // ─── 1. Geofence Evaluation ────────────────────────────────────────────────

  private async evaluateGeofences(
    input: TelemetryEvaluationInput,
    config: { geofenceEntryAlertsEnabled: boolean; geofenceExitAlertsEnabled: boolean },
  ): Promise<void> {
    if (!config.geofenceEntryAlertsEnabled && !config.geofenceExitAlertsEnabled) {
      return;
    }

    const { companyId, vehicleId, vehicleNumber, driverId, tripId, currentLocation } = input;

    // Get active geofences applicable to this vehicle
    const geofences = await this.geofenceService.getActiveGeofencesForVehicle(
      companyId,
      vehicleId,
    );

    if (geofences.length === 0) {
      return;
    }

    // Retrieve previous inside states from Redis
    const redisKey = ALERT_REDIS_KEYS.vehicleInsideGeofences(vehicleId);
    const cachedInsideIds = await this.cache.get<string[]>(redisKey);
    const previouslyInside = new Set<string>(cachedInsideIds ?? []);

    const currentlyInside = new Set<string>();

    for (const geofence of geofences) {
      const isInside = this.geofenceService.isPointInside(
        { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
        geofence.type,
        geofence.geometry,
      );

      const wasInside = previouslyInside.has(geofence.id);

      if (isInside) {
        currentlyInside.add(geofence.id);

        // Outside -> Inside Transition (Entry)
        if (!wasInside && geofence.entryAlertEnabled && config.geofenceEntryAlertsEnabled) {
          await this.alertService.createAlert({
            companyId,
            vehicleId,
            driverId,
            tripId,
            geofenceId: geofence.id,
            type: 'GEOFENCE_ENTRY',
            severity: 'MEDIUM',
            title: 'Geofence Entry',
            message: `Vehicle ${vehicleNumber} entered geofence "${geofence.name}"`,
            metadata: {
              geofenceName: geofence.name,
              geofenceType: geofence.type,
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            },
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            speed: currentLocation.speed,
            triggeredAt: currentLocation.timestamp,
          });
        }
      } else {
        // Inside -> Outside Transition (Exit)
        if (wasInside && geofence.exitAlertEnabled && config.geofenceExitAlertsEnabled) {
          await this.alertService.createAlert({
            companyId,
            vehicleId,
            driverId,
            tripId,
            geofenceId: geofence.id,
            type: 'GEOFENCE_EXIT',
            severity: 'MEDIUM',
            title: 'Geofence Exit',
            message: `Vehicle ${vehicleNumber} exited geofence "${geofence.name}"`,
            metadata: {
              geofenceName: geofence.name,
              geofenceType: geofence.type,
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            },
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            speed: currentLocation.speed,
            triggeredAt: currentLocation.timestamp,
          });
        }
      }
    }

    // Persist current inside states to Redis (24 hour TTL)
    await this.cache.set(redisKey, Array.from(currentlyInside), 86400);
  }

  // ─── 2. Overspeed Evaluation ───────────────────────────────────────────────

  private async evaluateOverspeed(
    input: TelemetryEvaluationInput,
    config: {
      overspeedEnabled: boolean;
      overspeedThresholdKmH: number;
      overspeedGracePeriodSeconds: number;
    },
  ): Promise<void> {
    if (!config.overspeedEnabled) return;

    const { companyId, vehicleId, vehicleNumber, driverId, tripId, currentLocation } = input;
    const speed = currentLocation.speed;
    const threshold = config.overspeedThresholdKmH;
    const graceSeconds = config.overspeedGracePeriodSeconds;

    const overspeedKey = ALERT_REDIS_KEYS.vehicleOverspeed(vehicleId);

    if (speed > threshold) {
      const activeOverspeed = await this.cache.get<{
        firstExceededAt: string;
        speed: number;
      }>(overspeedKey);

      const eventTime = currentLocation.timestamp.getTime();

      if (!activeOverspeed) {
        // Record first moment speed exceeded threshold
        await this.cache.set(
          overspeedKey,
          { firstExceededAt: currentLocation.timestamp.toISOString(), speed },
          300,
        );
      } else {
        const firstTime = new Date(activeOverspeed.firstExceededAt).getTime();
        const durationSeconds = (eventTime - firstTime) / 1000;

        if (durationSeconds >= graceSeconds) {
          // Check cooldown to avoid alert flooding
          const cooldownKey = ALERT_REDIS_KEYS.alertCooldown(vehicleId, 'OVERSPEED');
          const inCooldown = await this.cache.exists(cooldownKey);

          if (!inCooldown) {
            const severity =
              speed >= threshold * 1.3
                ? 'CRITICAL'
                : speed >= threshold * 1.15
                  ? 'HIGH'
                  : 'MEDIUM';

            await this.alertService.createAlert({
              companyId,
              vehicleId,
              driverId,
              tripId,
              type: 'OVERSPEED',
              severity,
              title: 'Overspeed Detected',
              message: `Vehicle ${vehicleNumber} traveling at ${speed.toFixed(1)} km/h (Limit: ${threshold} km/h)`,
              metadata: {
                currentSpeed: speed,
                speedLimit: threshold,
                excessSpeed: Number((speed - threshold).toFixed(1)),
                durationSeconds: Math.round(durationSeconds),
              },
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              speed,
              triggeredAt: currentLocation.timestamp,
            });

            // Set cooldown
            await this.cache.set(
              cooldownKey,
              true,
              ALERT_DEFAULTS.ALERT_COOLDOWN_SECONDS,
            );
          }
        }
      }
    } else {
      // Speed returned below threshold -> reset overspeed state
      await this.cache.del(overspeedKey);
    }
  }

  // ─── 3. Excessive Idle Evaluation ──────────────────────────────────────────

  private async evaluateIdle(
    input: TelemetryEvaluationInput,
    config: {
      excessiveIdleEnabled: boolean;
      excessiveIdleThresholdMinutes: number;
    },
  ): Promise<void> {
    if (!config.excessiveIdleEnabled) return;

    const { companyId, vehicleId, vehicleNumber, driverId, tripId, currentLocation } = input;
    const isIdling =
      currentLocation.ignition &&
      currentLocation.speed <= ALERT_DEFAULTS.IDLE_SPEED_THRESHOLD_KMH;

    const idleKey = ALERT_REDIS_KEYS.vehicleIdle(vehicleId);

    if (isIdling) {
      const activeIdle = await this.cache.get<{
        startedAt: string;
        alerted: boolean;
      }>(idleKey);

      const eventTime = currentLocation.timestamp.getTime();

      if (!activeIdle) {
        // Record idle start
        await this.cache.set(
          idleKey,
          { startedAt: currentLocation.timestamp.toISOString(), alerted: false },
          86400,
        );
      } else {
        const startTime = new Date(activeIdle.startedAt).getTime();
        const idleMinutes = (eventTime - startTime) / (1000 * 60);

        if (
          idleMinutes >= config.excessiveIdleThresholdMinutes &&
          !activeIdle.alerted
        ) {
          await this.alertService.createAlert({
            companyId,
            vehicleId,
            driverId,
            tripId,
            type: 'EXCESSIVE_IDLE',
            severity: 'LOW',
            title: 'Excessive Idle Detected',
            message: `Vehicle ${vehicleNumber} idling for ${Math.round(idleMinutes)} minutes with ignition ON`,
            metadata: {
              idleMinutes: Math.round(idleMinutes),
              thresholdMinutes: config.excessiveIdleThresholdMinutes,
            },
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            speed: currentLocation.speed,
            triggeredAt: currentLocation.timestamp,
          });

          // Mark alerted so repeated alerts are not sent for the same session
          await this.cache.set(
            idleKey,
            { startedAt: activeIdle.startedAt, alerted: true },
            86400,
          );
        }
      }
    } else {
      // Vehicle moved or ignition turned OFF -> reset idle state
      await this.cache.del(idleKey);
    }
  }

  // ─── 4. Harsh Braking Evaluation ───────────────────────────────────────────

  private async evaluateHarshBraking(
    input: TelemetryEvaluationInput,
    config: {
      harshBrakingEnabled: boolean;
      harshBrakingThresholdKmhPerSec: number;
    },
  ): Promise<void> {
    if (!config.harshBrakingEnabled || !input.previousLocation) return;

    const {
      companyId,
      vehicleId,
      vehicleNumber,
      driverId,
      tripId,
      previousLocation,
      currentLocation,
    } = input;

    const timeDeltaSeconds =
      (currentLocation.timestamp.getTime() - previousLocation.timestamp.getTime()) / 1000;

    // Only evaluate deceleration if time difference between telemetry points is valid (0.5s to 15s)
    if (timeDeltaSeconds < 0.5 || timeDeltaSeconds > 15) {
      return;
    }

    const speedDelta = previousLocation.speed - currentLocation.speed;

    // Must be a deceleration
    if (speedDelta > 0) {
      const decelerationRate = speedDelta / timeDeltaSeconds; // km/h per second

      if (decelerationRate >= config.harshBrakingThresholdKmhPerSec) {
        const cooldownKey = ALERT_REDIS_KEYS.alertCooldown(vehicleId, 'HARSH_BRAKING');
        const inCooldown = await this.cache.exists(cooldownKey);

        if (!inCooldown) {
          const severity =
            decelerationRate >= config.harshBrakingThresholdKmhPerSec * 1.5
              ? 'CRITICAL'
              : 'HIGH';

          await this.alertService.createAlert({
            companyId,
            vehicleId,
            driverId,
            tripId,
            type: 'HARSH_BRAKING',
            severity,
            title: 'Harsh Braking Detected',
            message: `Vehicle ${vehicleNumber} decelerated by ${speedDelta.toFixed(1)} km/h in ${timeDeltaSeconds.toFixed(1)}s (${decelerationRate.toFixed(1)} km/h/s)`,
            metadata: {
              previousSpeed: previousLocation.speed,
              currentSpeed: currentLocation.speed,
              deltaSpeed: Number(speedDelta.toFixed(1)),
              timeDeltaSeconds: Number(timeDeltaSeconds.toFixed(1)),
              decelerationRateKmhPerSec: Number(decelerationRate.toFixed(1)),
            },
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            speed: currentLocation.speed,
            triggeredAt: currentLocation.timestamp,
          });

          // Set 30-second cooldown for harsh braking alerts on the same vehicle
          await this.cache.set(cooldownKey, true, 30);
        }
      }
    }
  }

  // ─── 5. Sudden Fuel Drop Evaluation (Module 11) ────────────────────────────

  private async evaluateFuelDrop(
    input: TelemetryEvaluationInput,
    config: { fuelDropEnabled?: boolean; fuelDropThresholdLiters?: number },
  ): Promise<void> {
    if (config.fuelDropEnabled === false) {
      return;
    }

    const {
      companyId,
      vehicleId,
      vehicleNumber,
      driverId,
      tripId,
      previousLocation,
      currentLocation,
    } = input;

    if (!previousLocation || previousLocation.fuelLevel == null || currentLocation.fuelLevel == null) {
      return;
    }

    const prevLevel = previousLocation.fuelLevel;
    const currLevel = currentLocation.fuelLevel;

    // Fuel drop calculation
    const drop = prevLevel - currLevel;
    if (drop <= 0) {
      // Fuel stayed same or increased (e.g. refueling event)
      return;
    }

    const threshold = config.fuelDropThresholdLiters ?? 10.0;
    if (drop < threshold) {
      // Normal fuel burn or sensor jitter below threshold
      return;
    }

    const timeDeltaSeconds =
      (currentLocation.timestamp.getTime() - previousLocation.timestamp.getTime()) / 1000;

    // Avoid false positives if prolonged interval between readings (> 4 hours)
    if (timeDeltaSeconds > 14400) {
      return;
    }

    const cooldownKey = ALERT_REDIS_KEYS.alertCooldown(vehicleId, 'FUEL_DROP');
    const inCooldown = await this.cache.exists(cooldownKey);
    if (inCooldown) {
      return;
    }

    const severity = drop >= threshold * 2 ? 'CRITICAL' : 'HIGH';

    await this.alertService.createAlert({
      companyId,
      vehicleId,
      driverId,
      tripId,
      type: 'FUEL_DROP',
      severity,
      title: 'Sudden Fuel Drop Detected',
      message: `Vehicle ${vehicleNumber} experienced sudden fuel loss of ${drop.toFixed(1)}L (${prevLevel.toFixed(1)}L \u2192 ${currLevel.toFixed(1)}L)`,
      metadata: {
        previousFuelLevel: prevLevel,
        currentFuelLevel: currLevel,
        fuelDropLiters: Number(drop.toFixed(1)),
        timeDeltaSeconds: Number(timeDeltaSeconds.toFixed(1)),
        speed: currentLocation.speed,
        ignition: currentLocation.ignition,
      },
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      speed: currentLocation.speed,
      triggeredAt: currentLocation.timestamp,
    });

    // 5-minute cooldown for fuel drop alerts on the same vehicle
    await this.cache.set(cooldownKey, true, 300);
  }
}
