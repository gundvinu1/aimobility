// =============================================================================
// Fleet Calculations & Utility Functions — Module 11
// Safe math routines with zero-division and invalid state guards.
// =============================================================================

import type { MaintenanceDueStatus } from '@ai-mos/types';
import { ALERT_DEFAULTS } from '@ai-mos/constants';

/**
 * Calculates total fuel cost given quantity in liters and price per liter.
 * Guarded against negative, NaN, or non-finite inputs.
 */
export function calculateFuelTotal(quantityLiters: number, pricePerLiter: number): number {
  if (
    !Number.isFinite(quantityLiters) ||
    !Number.isFinite(pricePerLiter) ||
    quantityLiters <= 0 ||
    pricePerLiter <= 0
  ) {
    return 0;
  }
  const total = quantityLiters * pricePerLiter;
  return Math.round(total * 100) / 100;
}

/**
 * Calculates fuel efficiency in kilometers per liter (km/L).
 * Safe zero-distance, missing fuel, negative, and infinity guard.
 */
export function calculateKmPerLiter(distanceKm: number, fuelLiters: number): number {
  if (
    !Number.isFinite(distanceKm) ||
    !Number.isFinite(fuelLiters) ||
    distanceKm <= 0 ||
    fuelLiters <= 0
  ) {
    return 0;
  }
  const kmPerL = distanceKm / fuelLiters;
  return Math.round(kmPerL * 100) / 100;
}

/**
 * Calculates fuel consumption in liters per 100 kilometers (L/100km).
 * Safe zero-distance, missing fuel, negative, and infinity guard.
 */
export function calculateLitersPer100Km(distanceKm: number, fuelLiters: number): number {
  if (
    !Number.isFinite(distanceKm) ||
    !Number.isFinite(fuelLiters) ||
    distanceKm <= 0 ||
    fuelLiters <= 0
  ) {
    return 0;
  }
  const lPer100 = (fuelLiters / distanceKm) * 100;
  return Math.round(lPer100 * 100) / 100;
}

/**
 * Calculates cost per kilometer given total cost and distance covered.
 * Safe zero-distance, negative, and infinity guard.
 */
export function calculateCostPerKm(totalCost: number, distanceKm: number): number {
  if (
    !Number.isFinite(totalCost) ||
    !Number.isFinite(distanceKm) ||
    totalCost <= 0 ||
    distanceKm <= 0
  ) {
    return 0;
  }
  const costPerKm = totalCost / distanceKm;
  return Math.round(costPerKm * 100) / 100;
}

export interface MaintenanceDueInput {
  intervalKm?: number | null;
  intervalDays?: number | null;
  lastServiceOdometer?: number | null;
  lastServiceDate?: Date | string | null;
  nextDueOdometer?: number | null;
  nextDueDate?: Date | string | null;
  isActive?: boolean;
}

/**
 * Evaluates preventive maintenance due status based on mileage and time,
 * implementing the "whichever comes first" business rule.
 */
export function evaluateMaintenanceDueStatus(
  schedule: MaintenanceDueInput,
  currentOdometer?: number | null,
  now: Date = new Date(),
): MaintenanceDueStatus {
  if (schedule.isActive === false) {
    return 'COMPLETED';
  }

  let isOverdue = false;
  let isDue = false;
  let isDueSoon = false;

  const dueSoonDays = ALERT_DEFAULTS.MAINTENANCE_DUE_SOON_DAYS;
  const dueSoonKm = ALERT_DEFAULTS.MAINTENANCE_DUE_SOON_KM;

  // 1. Time-based check
  if (schedule.nextDueDate) {
    const dueDate = new Date(schedule.nextDueDate);
    const msDiff = dueDate.getTime() - now.getTime();
    const daysDiff = Math.ceil(msDiff / (1000 * 60 * 60 * 24));

    if (daysDiff < 0) {
      isOverdue = true;
    } else if (daysDiff === 0) {
      isDue = true;
    } else if (daysDiff <= dueSoonDays) {
      isDueSoon = true;
    }
  }

  // 2. Mileage-based check (whichever comes first)
  if (
    schedule.nextDueOdometer !== null &&
    schedule.nextDueOdometer !== undefined &&
    currentOdometer !== null &&
    currentOdometer !== undefined
  ) {
    const kmDiff = schedule.nextDueOdometer - currentOdometer;

    if (kmDiff < 0) {
      isOverdue = true;
    } else if (kmDiff === 0) {
      isDue = true;
    } else if (kmDiff <= dueSoonKm) {
      isDueSoon = true;
    }
  }

  if (isOverdue) return 'OVERDUE';
  if (isDue) return 'DUE';
  if (isDueSoon) return 'DUE_SOON';
  return 'UPCOMING';
}

/**
 * Computes next due odometer and date given service intervals and last service event.
 */
export function calculateNextDueTargets(
  intervalKm?: number | null,
  intervalDays?: number | null,
  lastServiceOdometer?: number | null,
  lastServiceDate?: Date | string | null,
): { nextDueOdometer: number | null; nextDueDate: Date | null } {
  let nextDueOdometer: number | null = null;
  if (
    intervalKm &&
    intervalKm > 0 &&
    lastServiceOdometer !== null &&
    lastServiceOdometer !== undefined
  ) {
    nextDueOdometer = lastServiceOdometer + intervalKm;
  }

  let nextDueDate: Date | null = null;
  if (intervalDays && intervalDays > 0) {
    const baseDate = lastServiceDate ? new Date(lastServiceDate) : new Date();
    const target = new Date(baseDate.getTime());
    target.setDate(target.getDate() + intervalDays);
    nextDueDate = target;
  }

  return { nextDueOdometer, nextDueDate };
}
