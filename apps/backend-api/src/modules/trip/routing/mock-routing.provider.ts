import { Injectable, Logger } from '@nestjs/common';
import type {
  RoutingProvider,
  RoutePoint,
  CalculatedRoute,
  CalculatedEta,
} from './routing.interface';
import { DEFAULT_URBAN_SPEED_KMH } from '@ai-mos/constants';

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculates great-circle distance between two geographic coordinates in kilometers
 * using the Haversine formula.
 */
export function calculateHaversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

/**
 * Encodes an array of geographic points using the Google Encoded Polyline algorithm.
 */
export function encodePolyline(points: RoutePoint[]): string {
  let result = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const point of points) {
    const lat = Math.round(point.latitude * 1e5);
    const lng = Math.round(point.longitude * 1e5);

    result += encodeNumber(lat - prevLat);
    result += encodeNumber(lng - prevLng);

    prevLat = lat;
    prevLng = lng;
  }

  return result;
}

function encodeNumber(num: number): string {
  let sgnNum = num < 0 ? ~(num << 1) : num << 1;
  let s = '';
  while (sgnNum >= 0x20) {
    s += String.fromCharCode((0x20 | (sgnNum & 0x1f)) + 63);
    sgnNum >>= 5;
  }
  s += String.fromCharCode(sgnNum + 63);
  return s;
}

@Injectable()
export class MockRoutingProvider implements RoutingProvider {
  private readonly logger = new Logger(MockRoutingProvider.name);

  async calculateRoute(
    origin: RoutePoint,
    destination: RoutePoint,
    waypoints: RoutePoint[] = [],
  ): Promise<CalculatedRoute> {
    const points: RoutePoint[] = [origin, ...waypoints, destination];
    let totalDistanceKm = 0;

    for (let i = 0; i < points.length - 1; i++) {
      totalDistanceKm += calculateHaversineKm(
        points[i].latitude,
        points[i].longitude,
        points[i + 1].latitude,
        points[i + 1].longitude,
      );
    }

    // Travel time based on urban speed + 5 min dwell per waypoint
    const drivingMinutes = Math.round((totalDistanceKm / DEFAULT_URBAN_SPEED_KMH) * 60);
    const dwellMinutes = waypoints.length * 5;
    const durationMinutes = Math.max(5, drivingMinutes + dwellMinutes);

    const polyline = encodePolyline(points);
    const waypointsOrder = waypoints.map((_, idx) => idx);

    return {
      distanceKm: parseFloat(totalDistanceKm.toFixed(2)),
      durationMinutes,
      geometryPolyline: polyline,
      waypointsOrder,
      source: 'MOCK',
    };
  }

  async calculateEta(
    currentLocation: RoutePoint,
    destination: RoutePoint,
  ): Promise<CalculatedEta> {
    const distanceKm = calculateHaversineKm(
      currentLocation.latitude,
      currentLocation.longitude,
      destination.latitude,
      destination.longitude,
    );

    const etaMinutes = Math.max(1, Math.round((distanceKm / DEFAULT_URBAN_SPEED_KMH) * 60));
    const estimatedArrival = new Date(Date.now() + etaMinutes * 60 * 1000);

    return {
      distanceKm,
      etaMinutes,
      estimatedArrival,
      source: 'MOCK',
    };
  }
}
