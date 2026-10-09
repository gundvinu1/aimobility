import {
  calculateFuelTotal,
  calculateKmPerLiter,
  calculateLitersPer100Km,
  calculateCostPerKm,
  evaluateMaintenanceDueStatus,
  calculateNextDueTargets,
} from './fleet-math.util';

describe('FleetMathUtil', () => {
  describe('calculateFuelTotal', () => {
    it('calculates total fuel amount accurately', () => {
      expect(calculateFuelTotal(45.5, 1.65)).toBe(75.08);
      expect(calculateFuelTotal(50, 2)).toBe(100);
    });

    it('safely handles zero and negative numbers', () => {
      expect(calculateFuelTotal(0, 1.5)).toBe(0);
      expect(calculateFuelTotal(-10, 1.5)).toBe(0);
      expect(calculateFuelTotal(10, -1.5)).toBe(0);
    });

    it('safely handles non-finite values', () => {
      expect(calculateFuelTotal(Infinity, 1.5)).toBe(0);
      expect(calculateFuelTotal(NaN, 1.5)).toBe(0);
      expect(calculateFuelTotal(10, NaN)).toBe(0);
    });
  });

  describe('calculateKmPerLiter', () => {
    it('calculates km per liter accurately', () => {
      expect(calculateKmPerLiter(500, 50)).toBe(10);
      expect(calculateKmPerLiter(340, 22.5)).toBe(15.11);
    });

    it('returns 0 on zero distance or zero fuel', () => {
      expect(calculateKmPerLiter(0, 50)).toBe(0);
      expect(calculateKmPerLiter(500, 0)).toBe(0);
    });

    it('returns 0 on negative and non-finite inputs', () => {
      expect(calculateKmPerLiter(-100, 20)).toBe(0);
      expect(calculateKmPerLiter(100, -20)).toBe(0);
      expect(calculateKmPerLiter(Infinity, 20)).toBe(0);
      expect(calculateKmPerLiter(100, NaN)).toBe(0);
    });
  });

  describe('calculateLitersPer100Km', () => {
    it('calculates liters per 100km accurately', () => {
      expect(calculateLitersPer100Km(500, 50)).toBe(10);
      expect(calculateLitersPer100Km(340, 22.5)).toBe(6.62);
    });

    it('returns 0 on zero distance without throwing or producing Infinity', () => {
      expect(calculateLitersPer100Km(0, 50)).toBe(0);
      expect(calculateLitersPer100Km(500, 0)).toBe(0);
      expect(calculateLitersPer100Km(-10, 10)).toBe(0);
    });
  });

  describe('calculateCostPerKm', () => {
    it('calculates operating cost per kilometer accurately', () => {
      expect(calculateCostPerKm(1200, 4000)).toBe(0.3);
      expect(calculateCostPerKm(750, 2500)).toBe(0.3);
    });

    it('returns 0 on zero distance and invalid values', () => {
      expect(calculateCostPerKm(500, 0)).toBe(0);
      expect(calculateCostPerKm(0, 500)).toBe(0);
      expect(calculateCostPerKm(-100, 200)).toBe(0);
    });
  });

  describe('evaluateMaintenanceDueStatus', () => {
    const fixedNow = new Date('2026-10-08T12:00:00Z');

    it('returns COMPLETED if schedule is not active', () => {
      const result = evaluateMaintenanceDueStatus({ isActive: false }, 5000, fixedNow);
      expect(result).toBe('COMPLETED');
    });

    it('returns UPCOMING when distance and time are well before thresholds', () => {
      const schedule = {
        nextDueOdometer: 20000,
        nextDueDate: new Date('2026-12-01T12:00:00Z'),
        isActive: true,
      };
      const result = evaluateMaintenanceDueStatus(schedule, 15000, fixedNow);
      expect(result).toBe('UPCOMING');
    });

    it('returns DUE_SOON when within 500 km', () => {
      const schedule = {
        nextDueOdometer: 20000,
        nextDueDate: new Date('2026-12-01T12:00:00Z'),
        isActive: true,
      };
      const result = evaluateMaintenanceDueStatus(schedule, 19600, fixedNow);
      expect(result).toBe('DUE_SOON');
    });

    it('returns DUE_SOON when within 14 days', () => {
      const schedule = {
        nextDueOdometer: 30000,
        nextDueDate: new Date('2026-10-15T12:00:00Z'), // 7 days away
        isActive: true,
      };
      const result = evaluateMaintenanceDueStatus(schedule, 10000, fixedNow);
      expect(result).toBe('DUE_SOON');
    });

    it('returns DUE when exactly on due odometer or due date', () => {
      const scheduleMileage = {
        nextDueOdometer: 20000,
        isActive: true,
      };
      expect(evaluateMaintenanceDueStatus(scheduleMileage, 20000, fixedNow)).toBe('DUE');

      const scheduleDate = {
        nextDueDate: new Date('2026-10-08T12:00:00Z'),
        isActive: true,
      };
      expect(evaluateMaintenanceDueStatus(scheduleDate, 1000, fixedNow)).toBe('DUE');
    });

    it('returns OVERDUE when past due date or odometer', () => {
      const scheduleMileage = {
        nextDueOdometer: 20000,
        isActive: true,
      };
      expect(evaluateMaintenanceDueStatus(scheduleMileage, 20100, fixedNow)).toBe('OVERDUE');

      const scheduleDate = {
        nextDueDate: new Date('2026-10-01T12:00:00Z'),
        isActive: true,
      };
      expect(evaluateMaintenanceDueStatus(scheduleDate, 1000, fixedNow)).toBe('OVERDUE');
    });

    it('implements whichever comes first: mileage triggers overdue even if date is far away', () => {
      const schedule = {
        nextDueOdometer: 20000,
        nextDueDate: new Date('2027-01-01T12:00:00Z'), // months away
        isActive: true,
      };
      expect(evaluateMaintenanceDueStatus(schedule, 20500, fixedNow)).toBe('OVERDUE');
    });
  });

  describe('calculateNextDueTargets', () => {
    it('computes next due odometer and date from intervals', () => {
      const baseDate = new Date('2026-04-01T00:00:00Z');
      const targets = calculateNextDueTargets(10000, 180, 50000, baseDate);
      expect(targets.nextDueOdometer).toBe(60000);
      expect(targets.nextDueDate).toBeDefined();
    });
  });
});
