// =============================================================================
// Routing Provider Interface — Module 12
// =============================================================================

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

export interface CalculatedRoute {
  distanceKm: number;
  durationMinutes: number;
  geometryPolyline: string;
  waypointsOrder: number[];
  source: 'MOCK' | 'OSRM' | 'GOOGLE';
}

export interface CalculatedEta {
  distanceKm: number;
  etaMinutes: number;
  estimatedArrival: Date;
  source: 'MOCK' | 'OSRM' | 'GOOGLE';
}

export interface RoutingProvider {
  calculateRoute(
    origin: RoutePoint,
    destination: RoutePoint,
    waypoints?: RoutePoint[],
  ): Promise<CalculatedRoute>;

  calculateEta(
    currentLocation: RoutePoint,
    destination: RoutePoint,
  ): Promise<CalculatedEta>;
}
