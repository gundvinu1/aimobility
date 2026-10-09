# AI-MOS MODULE 12: ARCHITECTURE SPECIFICATION
## Dispatch, Route Planning & Trip Optimization

**Target Monorepo:** `D:\Mobility` (`aimobility`)  
**Status:** Architecture Frozen & Implementation Underway  
**System Role:** Operational Execution & Resource Scheduling Engine  

---

## 1. Domain Boundaries

Module 12 serves as the operational orchestration hub that connects:
- **Commercial Demand:** Bookings (Module 7) and Trip orders.
- **Physical Assets:** Vehicles (Module 5) and Drivers (Module 6).
- **Fleet Telemetry & Tracking:** Real-time GPS location and speed streams (Module 9).
- **Fleet Safety & Geofencing:** Speed violation and geofence alerts (Module 10).
- **Fleet Health & Work Orders:** Preventive maintenance schedules and repair work orders (Module 11).

```
                      ┌────────────────────────┐
                      │   Booking (Module 7)   │
                      └───────────┬────────────┘
                                  │ 1:N
                                  ▼
      ┌─────────────┐       ┌───────────┐       ┌─────────────┐
      │   Driver    ├──────►│   Trip    │◄──────┤   Vehicle   │
      │ (Module 6)  │       │(Authorit.)│       │ (Module 5)  │
      └─────────────┘       └─────┬─────┘       └──────┬──────┘
                                  │ 1:N                │
                                  ▼                    ▼
                            ┌───────────┐       ┌─────────────┐
                            │ TripStop  │       │  WorkOrder  │
                            │(Waypoints)│       │ (Module 11) │
                            └───────────┘       └─────────────┘
```

The `Trip` entity remains the sole authoritative record of operational journey execution. Module 12 does not create duplicate assignment or booking tables.

---

## 2. Reused Models and Services

1. **`Trip` (`trips` table):** Contains core scheduling, route endpoints, execution status, driver/vehicle foreign keys, actual start/end timestamps, and cancellation metadata.
2. **`TripStatusHistory` (`trip_status_histories` table):** Immutable state audit log recording each status transition, user actor, notes, and geographic coordinates.
3. **`Driver` & `DriverDutyLog`:** Authoritative driver records, license validity, operational status (`ACTIVE`, `INACTIVE`), and duty status (`OFF_DUTY`, `ON_DUTY`, `ON_TRIP`).
4. **`Vehicle`:** Authoritative vehicle asset records, operational status (`ACTIVE`, `MAINTENANCE`, `ON_TRIP`), capacity, odometer, and insurance validity.
5. **`WorkOrder` (Module 11):** Used to check whether a vehicle has pending or in-progress maintenance holds that disqualify it from dispatch.
6. **`VehicleLocation` (Module 9):** Hot-path cached GPS coordinates per vehicle used for map tracking and live ETA calculations.
7. **`TelemetryGateway` (Module 9):** Socket.IO gateway running on `/tracking` namespace, isolating communications into `company:{companyId}` rooms.
8. **`DatabaseService` / Prisma Client:** Multi-tenant PostgreSQL access layer with relational constraints and cascade deletes.

---

## 3. New Models and Rationale

Only **one** additive table is introduced:

### `TripStop` (`trip_stops`)
- **Rationale:** The baseline `Trip` model only supports a single origin and a single destination (`pickupLocation` / `dropLocation`). Real-world transport often requires multiple stops (e.g., intermediate passenger pickups, multi-drop delivery, rest waypoints).
- **Attributes:**
  - `id`: UUID (Primary Key)
  - `companyId`: UUID (Multi-tenant partition)
  - `tripId`: UUID (Foreign key to `trips`)
  - `stopOrder`: Int (1-indexed sequence order, unique per `[tripId, stopOrder]`)
  - `stopType`: `StopType` enum (`PICKUP`, `WAYPOINT`, `DROPOFF`)
  - `locationName`: String
  - `address`: String?
  - `latitude`: Float
  - `longitude`: Float
  - `plannedArrival`: DateTime?
  - `plannedDeparture`: DateTime?
  - `actualArrival`: DateTime?
  - `actualDeparture`: DateTime?
  - `passengerName`: String?
  - `passengerPhone`: String?
  - `notes`: String?
  - `status`: `StopStatus` enum (`PENDING`, `ARRIVED`, `COMPLETED`, `SKIPPED`)
  - `createdAt`, `updatedAt`: Timestamps

### Additive Fields on `Trip`
- `routePolyline`: String? (Encoded Google polyline geometry for map rendering)
- `estimatedDistanceKm`: Float? (Provider-calculated distance)
- `estimatedDurationMinutes`: Int? (Provider-calculated duration)

---

## 4. State Transitions

The operational lifecycle strictly respects `VALID_TRIP_TRANSITIONS`:

```
┌─────────────┐
│  SCHEDULED  │◄────────────────────────────────────────────┐
└──────┬──────┘                                             │
       │                                                    │
       ├──────────────────┬──────────────────┐              │
       ▼                  ▼                  ▼              │
┌──────────────┐   ┌──────────────┐   ┌──────────────┐      │
│DRIVER_ASSIGN │   │VEHICLE_ASSIGN│   │  CANCELLED   │      │
└──────┬───────┘   └──────┬───────┘   └──────────────┘      │
       │                  │                                 │
       ▼                  ▼                                 │
┌─────────────────────────────────┐   (Unassign Driver or   │
│  Both Driver & Vehicle Assigned │    Vehicle before disp.)│
└────────────────┬────────────────┘─────────────────────────┘
                 │
                 ▼
          ┌─────────────┐
          │ DISPATCHED  │
          └──────┬──────┘
                 │
                 ▼
          ┌─────────────┐
          │DRIVER_ARRIVD│
          └──────┬──────┘
                 │
                 ▼
          ┌─────────────┐
          │PASSENGER_ONB│
          └──────┬──────┘
                 │
                 ▼
          ┌─────────────┐
          │ IN_PROGRESS │
          └──────┬──────┘
                 │
                 ▼
          ┌─────────────┐
          │  COMPLETED  │
          └─────────────┘
```

### Entity Synchronizations on State Changes
- **Trip $\to$ `IN_PROGRESS`:**
  - `Driver.dutyStatus` $\to$ `ON_TRIP`
  - `Vehicle.status` $\to$ `ON_TRIP`
- **Trip $\to$ `COMPLETED`:**
  - `Driver.dutyStatus` $\to$ `ON_DUTY`
  - `Vehicle.status` $\to$ `ACTIVE`
  - `Booking.status` $\to$ `COMPLETED`
- **Trip $\to$ `CANCELLED`:**
  - `Driver.dutyStatus` $\to$ `ON_DUTY` (if assigned)
  - `Vehicle.status` $\to$ `ACTIVE` (if assigned)

---

## 5. Assignment & Conflict Validation Rules

Before an assignment or reassignment is committed to the database, the backend executes the following validations:

1. **Tenant Ownership:**
   - Both driver and vehicle must have `companyId === tenant.companyId`. Cross-tenant assignments are rejected with `404 Not Found`.
2. **Driver Status & Credentials:**
   - `driver.status === 'ACTIVE'` (not `INACTIVE`, `SUSPENDED`, `TERMINATED`).
   - `driver.licenseExpiryDate >= today`. Expired licenses are rejected with `400 BadRequestException`.
3. **Vehicle Status & Maintenance Hold:**
   - `vehicle.status === 'ACTIVE'` (not `MAINTENANCE`, `INACTIVE`, `RETIRED`).
   - Must not have any active `WorkOrder` with status `OPEN` or `IN_PROGRESS`.
4. **Active Trip Conflict:**
   - Driver or vehicle must not be assigned to any trip with status in `['DISPATCHED', 'DRIVER_ARRIVED', 'PASSENGER_ONBOARD', 'IN_PROGRESS']`.
5. **Scheduled Time-Window Overlap Conflict:**
   - An operational trip window is defined as:
     $$[T_{start} - 30\text{ min},\; T_{start} + \text{duration} + 30\text{ min}]$$
   - If another scheduled trip for the same driver or vehicle has overlapping start/end windows, assignment is rejected with `409 ConflictException`.
6. **Lifecycle State Constraint:**
   - Assignments and unassignments are blocked if the trip is in `COMPLETED`, `CANCELLED`, or `NO_SHOW` status.
   - Unassignment is also blocked once a trip has progressed to `DISPATCHED` or beyond.

---

## 6. Concurrency & Data Integrity Strategy

1. **Transactional Execution:**
   - Assignment, reassignment, and unassignment are executed within Prisma interactive transactions (`db.$transaction`).
2. **Resource Reservation Validation:**
   - Inside the transaction, conflict detection queries check for overlapping assignments.
3. **Optional Distributed Concurrency Lock:**
   - For high-frequency environments, a short-lived Redis lock (`dispatch:lock:driver:{driverId}` and `dispatch:lock:vehicle:{vehicleId}`, TTL 5000ms) prevents race conditions across concurrent dispatcher requests.

---

## 7. API Contracts

| Method | Endpoint | Permissions | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/trips` | `trip.read` | List company trips with filtering, pagination, search |
| `GET` | `/trips/:id` | `trip.read` | Get complete trip details including stops and assignments |
| `POST` | `/trips/:id/assign-driver` | `trip.assign.driver` | Assign driver to trip with full conflict validation |
| `POST` | `/trips/:id/unassign-driver` | `trip.assign.driver` | Unassign driver from scheduled trip |
| `POST` | `/trips/:id/assign-vehicle` | `trip.assign.vehicle` | Assign vehicle to trip with conflict and maintenance check |
| `POST` | `/trips/:id/unassign-vehicle` | `trip.assign.vehicle` | Unassign vehicle from scheduled trip |
| `POST` | `/trips/:id/dispatch` | `trip.dispatch` | Dispatch trip (verifies both driver and vehicle assigned) |
| `PATCH` | `/trips/:id/status` | `trip.update.status` | Progress trip lifecycle with entity synchronization |
| `GET` | `/dispatch/availability` | `trip.read` | List eligible drivers and vehicles for a given time window |
| `GET` | `/dispatch/analytics` | `trip.read` | Operational metrics (unassigned, lead times, utilization) |
| `GET` | `/trips/:id/stops` | `trip.read` | List sequenced waypoints for trip |
| `POST` | `/trips/:id/stops` | `trip.update` | Add new waypoint to trip |
| `PATCH` | `/trips/:id/stops/reorder` | `trip.update` | Reorder waypoints transactionally |
| `PATCH` | `/trips/:id/stops/:stopId` | `trip.update` | Update waypoint arrival/status |
| `DELETE` | `/trips/:id/stops/:stopId` | `trip.update` | Remove waypoint from trip |
| `POST` | `/trips/:id/calculate-route`| `trip.update` | Compute route geometry, distance, and duration |

---

## 8. Routing Provider Abstraction & ETA

### Architecture
```typescript
export interface RouteCoordinates {
  latitude: number;
  longitude: number;
}

export interface RouteCalculationResult {
  distanceKm: number;
  durationMinutes: number;
  geometryPolyline: string;
  waypointsOrder: number[];
}

export interface RoutingProvider {
  calculateRoute(
    origin: RouteCoordinates,
    destination: RouteCoordinates,
    waypoints?: RouteCoordinates[],
  ): Promise<RouteCalculationResult>;
  
  calculateEta(
    currentLocation: RouteCoordinates,
    destination: RouteCoordinates,
  ): Promise<{ etaMinutes: number; distanceKm: number }>;
}
```

### Implementations
1. **`MockRoutingProvider` (Default):** Computes deterministic Haversine distance, estimates urban travel time at 35 km/h, and encodes synthetic polyline geometry. Works out-of-the-box in development and testing with zero API keys or external fees.
2. **`OsrmRoutingProvider`:** Connects to standard OSRM v5 API server when `OSRM_ROUTING_URL` is configured.
3. **Graceful Fallback:** If an external routing provider throws an error, the routing service catches it, logs a warning, and falls back to `MockRoutingProvider` so core dispatch operations are never blocked.

### Redis Caching
- Route calculations are cached in Redis with key `routing:cache:{hash(coordinates)}` (TTL: 86400 seconds).

---

## 9. Real-Time Socket.IO Integration

- **Gateway:** Existing `TelemetryGateway` on `/tracking` namespace.
- **Tenant Isolation:** Events are emitted strictly to `company:{companyId}` room.
- **Events Emitted:**
  - `dispatch:trip_assigned`: `{ tripId, driverId, vehicleId, status }`
  - `dispatch:trip_unassigned`: `{ tripId, unassignedType, status }`
  - `dispatch:trip_dispatched`: `{ tripId, tripNumber, driverId, vehicleId }`
  - `dispatch:trip_updated`: `{ tripId, status, actualStart, actualEnd }`
  - `dispatch:stop_updated`: `{ tripId, stopId, stopOrder, status }`

---

## 10. Security & Tenant Isolation

- **Guards:** All endpoints are protected by `TenantGuard` and role/permission decorators.
- **Data Scoping:** All queries strictly enforce `where: { companyId: tenant.companyId }`. Client-provided `companyId` headers or DTO fields are never trusted blindly.
- **Audit Logging:** Every assignment, unassignment, and status update generates an immutable `AuditLog` entry with user ID, IP address, user agent, and metadata.
