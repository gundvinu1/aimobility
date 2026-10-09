import {
  haversineDistance,
  isPointInCircle,
  isPointInPolygon,
  isPointInGeofence,
  validateGeometry,
} from './geofence-math.util';

describe('GeofenceMathUtil', () => {
  describe('haversineDistance', () => {
    it('calculates 0 distance for identical coordinates', () => {
      const dist = haversineDistance(37.7749, -122.4194, 37.7749, -122.4194);
      expect(dist).toBeCloseTo(0, 1);
    });

    it('calculates approximately correct distance between SF and San Jose (~67-70 km)', () => {
      // SF: 37.7749, -122.4194
      // SJ: 37.3382, -121.8863
      const distMeters = haversineDistance(37.7749, -122.4194, 37.3382, -121.8863);
      expect(distMeters).toBeGreaterThan(65000);
      expect(distMeters).toBeLessThan(75000);
    });

    it('calculates distance between Mumbai and Pune (~120 km)', () => {
      const dist = haversineDistance(19.076, 72.8777, 18.5204, 73.8567);
      expect(dist).toBeGreaterThan(110000);
      expect(dist).toBeLessThan(130000);
    });
  });

  describe('isPointInCircle', () => {
    const center = { latitude: 37.7749, longitude: -122.4194 };
    const radiusMeters = 500;

    it('returns true for points inside the circle', () => {
      // Very close to center (approx 50m north)
      const insidePoint = { latitude: 37.7753, longitude: -122.4194 };
      expect(isPointInCircle(insidePoint, center, radiusMeters)).toBe(true);
    });

    it('returns true for exact center point', () => {
      expect(isPointInCircle(center, center, radiusMeters)).toBe(true);
    });

    it('returns false for points clearly outside the circle', () => {
      // Approx 2 km away
      const outsidePoint = { latitude: 37.7949, longitude: -122.4194 };
      expect(isPointInCircle(outsidePoint, center, radiusMeters)).toBe(false);
    });

    it('returns false if radius is 0 or negative', () => {
      expect(isPointInCircle(center, center, 0)).toBe(false);
      expect(isPointInCircle(center, center, -100)).toBe(false);
    });
  });

  describe('isPointInPolygon', () => {
    // Square around (0, 0) from -1 to 1 in lat/lon
    const square = [
      { latitude: -1, longitude: -1 },
      { latitude: 1, longitude: -1 },
      { latitude: 1, longitude: 1 },
      { latitude: -1, longitude: 1 },
    ];

    it('returns true for points strictly inside the polygon', () => {
      expect(isPointInPolygon({ latitude: 0, longitude: 0 }, square)).toBe(true);
      expect(isPointInPolygon({ latitude: 0.5, longitude: 0.5 }, square)).toBe(true);
      expect(isPointInPolygon({ latitude: -0.5, longitude: -0.5 }, square)).toBe(true);
    });

    it('returns false for points outside the polygon', () => {
      expect(isPointInPolygon({ latitude: 2, longitude: 0 }, square)).toBe(false);
      expect(isPointInPolygon({ latitude: 0, longitude: 2 }, square)).toBe(false);
      expect(isPointInPolygon({ latitude: -5, longitude: -5 }, square)).toBe(false);
    });

    it('returns false for polygons with fewer than 3 points', () => {
      expect(isPointInPolygon({ latitude: 0, longitude: 0 }, [{ latitude: 0, longitude: 0 }])).toBe(false);
    });

    // Triangle
    it('correctly handles non-square polygons (triangles)', () => {
      const triangle = [
        { latitude: 0, longitude: 0 },
        { latitude: 2, longitude: 0 },
        { latitude: 0, longitude: 2 },
      ];
      expect(isPointInPolygon({ latitude: 0.5, longitude: 0.5 }, triangle)).toBe(true);
      expect(isPointInPolygon({ latitude: 1.5, longitude: 1.5 }, triangle)).toBe(false);
    });
  });

  describe('isPointInGeofence', () => {
    it('dispatches to circle evaluator for CIRCLE type', () => {
      const geometry = {
        center: { latitude: 10, longitude: 10 },
        radiusMeters: 1000,
      };
      expect(isPointInGeofence({ latitude: 10, longitude: 10 }, 'CIRCLE', geometry)).toBe(true);
      expect(isPointInGeofence({ latitude: 20, longitude: 20 }, 'CIRCLE', geometry)).toBe(false);
    });

    it('dispatches to polygon evaluator for POLYGON type', () => {
      const geometry = {
        coordinates: [
          { latitude: 0, longitude: 0 },
          { latitude: 2, longitude: 0 },
          { latitude: 2, longitude: 2 },
          { latitude: 0, longitude: 2 },
        ],
      };
      expect(isPointInGeofence({ latitude: 1, longitude: 1 }, 'POLYGON', geometry)).toBe(true);
      expect(isPointInGeofence({ latitude: 5, longitude: 5 }, 'POLYGON', geometry)).toBe(false);
    });

    it('returns false for invalid inputs or unknown type', () => {
      expect(isPointInGeofence(null as any, 'CIRCLE', {})).toBe(false);
      expect(isPointInGeofence({ latitude: 0, longitude: 0 }, 'UNKNOWN' as any, {})).toBe(false);
    });
  });

  describe('validateGeometry', () => {
    it('validates a valid circle geometry', () => {
      const validCircle = {
        center: { latitude: 37.7749, longitude: -122.4194 },
        radiusMeters: 500,
      };
      expect(validateGeometry('CIRCLE', validCircle)).toEqual({ valid: true });
    });

    it('rejects circle with invalid center coordinates', () => {
      const invalidCircle = {
        center: { latitude: 100, longitude: -122.4194 }, // lat > 90
        radiusMeters: 500,
      };
      const result = validateGeometry('CIRCLE', invalidCircle);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('latitude must be between -90 and 90');
    });

    it('rejects circle with negative radius', () => {
      const invalidCircle = {
        center: { latitude: 37.7749, longitude: -122.4194 },
        radiusMeters: -50,
      };
      const result = validateGeometry('CIRCLE', invalidCircle);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('greater than 0');
    });

    it('validates a valid polygon geometry', () => {
      const validPoly = {
        coordinates: [
          { latitude: 0, longitude: 0 },
          { latitude: 1, longitude: 0 },
          { latitude: 1, longitude: 1 },
        ],
      };
      expect(validateGeometry('POLYGON', validPoly)).toEqual({ valid: true });
    });

    it('rejects polygon with fewer than 3 coordinates', () => {
      const invalidPoly = {
        coordinates: [
          { latitude: 0, longitude: 0 },
          { latitude: 1, longitude: 0 },
        ],
      };
      const result = validateGeometry('POLYGON', invalidPoly);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 3 coordinates');
    });

    it('rejects polygon with invalid coordinates', () => {
      const invalidPoly = {
        coordinates: [
          { latitude: 0, longitude: 0 },
          { latitude: 1, longitude: 200 }, // lon > 180
          { latitude: 1, longitude: 1 },
        ],
      };
      const result = validateGeometry('POLYGON', invalidPoly);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid longitude');
    });
  });
});
