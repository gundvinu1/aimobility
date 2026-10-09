/**
 * Geographic and polygon geometric calculations for Geofencing Engine.
 * Provider-independent mathematical implementation without PostGIS requirement.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface CircleGeometry {
  center: LatLng;
  radiusMeters: number;
}

export interface PolygonGeometry {
  coordinates: LatLng[];
}

export type GeofenceGeometry = CircleGeometry | PolygonGeometry;

/** Earth's mean radius in meters */
const EARTH_RADIUS_METERS = 6371000;

/** Convert degrees to radians */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculates great-circle distance between two geographic coordinates in meters
 * using the Haversine formula.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Evaluates whether a point is within a circular geofence boundary.
 */
export function isPointInCircle(
  point: LatLng,
  center: LatLng,
  radiusMeters: number,
): boolean {
  if (radiusMeters <= 0) return false;
  const distance = haversineDistance(
    point.latitude,
    point.longitude,
    center.latitude,
    center.longitude,
  );
  return distance <= radiusMeters;
}

/**
 * Evaluates whether a point is inside an arbitrary polygon using the Ray-Casting algorithm.
 *
 * Algorithm:
 * Cast a horizontal ray eastward from the test point to infinity. Count the number
 * of intersections with the edges of the polygon. An odd count means the point is inside;
 * an even count means outside.
 *
 * Handles arbitrary convex and concave polygons, clockwise or counter-clockwise vertex orders.
 */
export function isPointInPolygon(
  point: LatLng,
  polygonCoordinates: LatLng[],
): boolean {
  if (!polygonCoordinates || polygonCoordinates.length < 3) {
    return false;
  }

  const { latitude: y, longitude: x } = point;
  let isInside = false;
  const n = polygonCoordinates.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygonCoordinates[i].longitude;
    const yi = polygonCoordinates[i].latitude;
    const xj = polygonCoordinates[j].longitude;
    const yj = polygonCoordinates[j].latitude;

    // Check if point is exactly on horizontal boundary or within ray span
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) {
      isInside = !isInside;
    }
  }

  return isInside;
}

/**
 * Evaluates whether a point is inside a geofence of given type and geometry.
 */
export function isPointInGeofence(
  point: LatLng,
  type: 'CIRCLE' | 'POLYGON',
  geometry: unknown,
): boolean {
  if (!point || typeof point.latitude !== 'number' || typeof point.longitude !== 'number') {
    return false;
  }

  if (type === 'CIRCLE') {
    const circle = geometry as CircleGeometry | undefined;
    if (!circle || !circle.center || typeof circle.radiusMeters !== 'number') {
      return false;
    }
    return isPointInCircle(point, circle.center, circle.radiusMeters);
  }

  if (type === 'POLYGON') {
    const poly = geometry as PolygonGeometry | undefined;
    if (!poly || !Array.isArray(poly.coordinates)) {
      return false;
    }
    return isPointInPolygon(point, poly.coordinates);
  }

  return false;
}

/**
 * Validates geofence geometry structure.
 */
export function validateGeometry(
  type: 'CIRCLE' | 'POLYGON',
  geometry: unknown,
): { valid: boolean; error?: string } {
  if (!geometry || typeof geometry !== 'object') {
    return { valid: false, error: 'Geometry must be an object' };
  }

  if (type === 'CIRCLE') {
    const circle = geometry as Partial<CircleGeometry>;
    if (!circle.center || typeof circle.center !== 'object') {
      return { valid: false, error: 'Circle geometry must include center coordinates' };
    }
    const { latitude, longitude } = circle.center;
    if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
      return { valid: false, error: 'Center latitude must be between -90 and 90' };
    }
    if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
      return { valid: false, error: 'Center longitude must be between -180 and 180' };
    }
    if (typeof circle.radiusMeters !== 'number' || circle.radiusMeters <= 0) {
      return { valid: false, error: 'Circle radiusMeters must be greater than 0' };
    }
    if (circle.radiusMeters > 500000) {
      return { valid: false, error: 'Circle radiusMeters cannot exceed 500 km' };
    }
    return { valid: true };
  }

  if (type === 'POLYGON') {
    const poly = geometry as Partial<PolygonGeometry>;
    if (!Array.isArray(poly.coordinates)) {
      return { valid: false, error: 'Polygon geometry must include an array of coordinates' };
    }
    if (poly.coordinates.length < 3) {
      return { valid: false, error: 'Polygon geometry requires at least 3 coordinates' };
    }
    if (poly.coordinates.length > 500) {
      return { valid: false, error: 'Polygon geometry cannot exceed 500 coordinates' };
    }
    for (let i = 0; i < poly.coordinates.length; i++) {
      const coord = poly.coordinates[i];
      if (!coord || typeof coord !== 'object') {
        return { valid: false, error: `Invalid coordinate at index ${i}` };
      }
      if (typeof coord.latitude !== 'number' || coord.latitude < -90 || coord.latitude > 90) {
        return { valid: false, error: `Coordinate at index ${i} has invalid latitude` };
      }
      if (typeof coord.longitude !== 'number' || coord.longitude < -180 || coord.longitude > 180) {
        return { valid: false, error: `Coordinate at index ${i} has invalid longitude` };
      }
    }
    return { valid: true };
  }

  return { valid: false, error: `Unknown geofence type: ${type}` };
}
