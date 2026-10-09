# AI-MOS — Module 9: Real-Time Fleet Tracking & Live Telemetry Completion Report

**Project:** AI-MOS Enterprise Mobility Management SaaS Monorepo  
**Module:** Module 9 — Real-Time Fleet Tracking & Live Telemetry  
**Status:** COMPLETE & VERIFIED  
**Date:** October 8, 2026  
**Environment:** Local / Windows / Node.js v24.19.0 / PostgreSQL / Redis / Socket.IO / NestJS / Next.js 14 App Router  

---

## 1. Module Overview

Module 9 delivers real-time fleet tracking and provider-independent operational telemetry for the AI-MOS SaaS platform. It establishes the infrastructure to ingest, validate, store, fan-out, and visualize high-frequency vehicle telemetry and GPS data across multi-tenant enterprise mobility operations.

Key capabilities delivered:
- **Provider-Independent Telemetry Ingestion:** Normalized data model supporting mobile driver devices, IoT trackers, third-party telematics APIs, and test simulators.
- **Strict Tenant Isolation:** Every telemetry event, database query, Redis cache key, and real-time WebSocket channel is strictly partitioned by `companyId`. Cross-tenant tracking or room subscriptions are prevented server-side.
- **Hot-Path & Cold-Path Storage:** Single upserted hot-path read model (`VehicleLocation`) for instantaneous map snapshots, combined with append-only historical telemetry (`VehicleTelemetry`) for route replays and audit trails.
- **Real-Time WebSocket Transport:** Low-latency Socket.IO gateway (`/tracking` namespace) broadcasting fine-grained events (`vehicle.location.updated`, `vehicle.status.updated`, `driver.location.updated`, `trip.location.updated`) scoped exclusively to tenant rooms.
- **Dynamic Permission-Based Access Control:** Fully integrated with Module 8A & Module 8B permission catalog and resolution engine. Access to tracking views, live streams, and historical logs is governed by explicit permissions (`fleet.tracking.read`, `fleet.tracking.live`, `vehicle.location.read`, `vehicle.telemetry.read`, `vehicle.telemetry.write`).
- **Interactive Fleet Tracking Map:** Next.js client-side OpenStreetMap & CartoDB tile interface with directional markers, live status badges, dynamic stats, vehicle drawer, inspection panel, and integrated GPS simulation.

---

## 2. Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        TELEMETRY SOURCES                               │
│  [Mobile App]   [GPS Tracker]   [IoT Device]   [Simulator]   [API]     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ POST /api/v1/telemetry
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         AI-MOS BACKEND API                             │
│                                                                        │
│  1. TenantGuard & JWT Authentication (X-Company-Id validation)         │
│  2. Permissions Enforcement (vehicle.telemetry.write check)            │
│  3. Telemetry Validation (Lat/Lng bounds, Speed, Heading, Timestamp)   │
│  4. Operational Enrichment:                                            │
│     - Driver resolution via DriverVehicleAssignment                    │
│     - Active Trip linking (DISPATCHED, IN_PROGRESS, etc.)              │
│     - Fleet status derivation (ACTIVE, ON_TRIP, IDLE, OFFLINE)         │
└───────────────┬───────────────────────────────┬────────────────────────┘
                │ Hot/Cold DB Persistence       │ Fast Cache & WS Broadcast
                ▼                               ▼
┌───────────────────────────────┐     ┌──────────────────────────────────┐
│      POSTGRESQL (Prisma)      │     │         REDIS & SOCKET.IO        │
│                               │     │                                  │
│ • vehicle_locations (Hot)     │     │ • Redis Cache:                   │
│   (1 row per vehicle, upsert) │     │   vehicle:location:{id}          │
│ • vehicle_telemetry (Cold)    │     │ • Socket.IO Gateway (/tracking): │
│   (Append-only, time-indexed) │     │   Room: company:{companyId}      │
└───────────────────────────────┘     └─────────────────┬────────────────┘
                                                        │ WS events
                                                        ▼
                                      ┌──────────────────────────────────┐
                                      │       ADMIN WEB DASHBOARD        │
                                      │                                  │
                                      │ • RouteGuard & Permission Gate   │
                                      │ • useTrackingSocket hook         │
                                      │ • Interactive Leaflet/OSM Map    │
                                      │ • Vehicle Details Slide-over     │
                                      │ • Telemetry Simulator Dialog     │
                                      └──────────────────────────────────┘
```

---

## 3. Database Changes

A dedicated migration `20261008071338_module9_fleet_tracking` was generated without modifying existing migrations or resetting the database:

### TelemetrySource Enum
```sql
CREATE TYPE "TelemetrySource" AS ENUM ('MANUAL', 'MOBILE', 'GPS_DEVICE', 'IOT', 'SIMULATOR', 'API');
```

### `vehicle_locations` (Hot Path)
Represents the current location and operational state for each vehicle:
- `id`: UUID (Primary Key)
- `companyId`: UUID (Foreign Key -> companies, Indexed)
- `vehicleId`: UUID (Unique, Foreign Key -> vehicles)
- `driverId`: UUID (Nullable, Foreign Key -> drivers, Indexed)
- `latitude`: Float (-90.0 to 90.0)
- `longitude`: Float (-180.0 to 180.0)
- `speed`: Float (Default 0 km/h)
- `heading`: Float? (0 to 360 degrees)
- `accuracy`: Float? (metres)
- `altitude`: Float? (metres)
- `ignition`: Boolean (Default false)
- `batteryLevel`: Float? (0-100%)
- `odometer`: Int? (km)
- `engineTemperature`: Float? (°C)
- `fuelLevel`: Float? (0-100%)
- `signalStrength`: Int?
- `source`: TelemetrySource (Default API)
- `timestamp`: DateTime (device timestamp, Indexed)
- `createdAt` / `updatedAt`: DateTime

### `vehicle_telemetry` (Cold Path)
Append-only historical telemetry records:
- `id`: UUID (Primary Key)
- `companyId`, `vehicleId`, `driverId`: Foreign Keys
- Telemetry telemetry attributes (lat, lng, speed, heading, diagnostics)
- Composite indexes: `[companyId, vehicleId, timestamp]`, `[companyId, timestamp]`, `[vehicleId, timestamp]`.

---

## 4. Backend Architecture

New files created in `apps/backend-api/src/modules/telemetry/`:
1. `dto/ingest-telemetry.dto.ts`:
   - `IngestTelemetryDto`: strict validation via `class-validator` (`@Min`, `@Max`, `@IsUUID`, `@IsISO8601`, `@IsEnum`).
   - `ListTelemetryDto`: pagination bounds (`limit` max 500, default 50) and datetime window filters.
2. `telemetry.service.ts`:
   - Validates coordinates and metrics server-side.
   - Enforces vehicle tenant ownership (404 if vehicle does not exist in active company).
   - Validates driver tenant ownership if specified (403 if driver belongs to another company).
   - Auto-resolves driver if omitted using `DriverVehicleAssignment`.
   - Links active trip from `Trip` model.
   - Derives live fleet status (`ACTIVE`, `IDLE`, `ON_TRIP`, `OFFLINE`, `MAINTENANCE`).
   - Upserts latest position in `vehicle_locations` and appends to `vehicle_telemetry`.
   - Caches latest position in Redis with TTL = `TELEMETRY_OFFLINE_THRESHOLD_SECONDS * 2`.
   - Emits real-time events via `TelemetryGateway`.
3. `telemetry.gateway.ts`:
   - Socket.IO gateway mounted at namespace `/tracking`.
   - Handshake authentication via JWT access token and active tenant context.
   - Tenant isolation enforcement: clients can only join their authenticated company room.
   - Client subscriptions: `subscribe:fleet`, `unsubscribe:fleet`, `subscribe:vehicle`.
   - Fan-out methods: `broadcastLocationUpdated`, `broadcastStatusUpdated`, `broadcastDriverLocationUpdated`, `broadcastTripLocationUpdated`.
4. `telemetry.controller.ts`:
   - Controllers: `TelemetryController` (`/telemetry`) and `FleetTrackingController`.
   - Guarded by `TenantGuard` and fine-grained permission checks.
5. `telemetry.module.ts`:
   - Registered into `app.module.ts`.

---

## 5. WebSocket & Real-Time Transport

- **Protocol:** Socket.IO over WebSocket with HTTP long-polling fallback.
- **Namespace:** `/tracking`
- **Handshake Authentication:**
  - Token passed in `auth.token`, `headers.authorization`, or `query.token`.
  - Company ID passed in `auth.companyId`, `headers['x-company-id']`, or `query.companyId`.
  - Verified against database user and active `userCompany` membership.
  - Requires permission `fleet.tracking.live` or `vehicle.location.live`.
- **Rooms:**
  - `company:{companyId}`: tenant-scoped room for all company tracking events.
  - `vehicle:{vehicleId}`: optional vehicle-scoped room.
- **Event Catalog:**
  | Event | Payload Description |
  |---|---|
  | `vehicle.location.updated` | Vehicle ID, company ID, full location DTO, derived fleet status, driver ID & name, current trip ID |
  | `vehicle.status.updated` | Vehicle ID, DB status, derived fleet status |
  | `driver.location.updated` | Driver ID, vehicle ID, coordinates, speed, heading, timestamp |
  | `trip.location.updated` | Trip ID, trip number, vehicle ID, coordinates, speed, timestamp |
  | `fleet.snapshot` | Immediate full fleet array sent upon subscription or reconnection |

---

## 6. Redis Usage

Redis is utilized for high-throughput, low-latency caching:
1. **Latest Vehicle Location Cache:**
   - Key: `vehicle:location:{vehicleId}`
   - Value: Serialized `VehicleLocationDto`
   - TTL: 600 seconds (2x `TELEMETRY_OFFLINE_THRESHOLD_SECONDS`)
2. **Cold-path offloading:**
   - Single-vehicle lookups hit Redis first before falling back to PostgreSQL, reducing database IOPS under high telemetry update frequencies.

---

## 7. Frontend Tracking UI

New pages and components in `apps/admin-web`:
1. `/companies/[companyId]/tracking`:
   - Master-detail interface with dynamic header, KPI stats bar, and live connection badge.
   - Left vehicle drawer with live search and status filter chips (`ALL`, `ACTIVE`, `ON_TRIP`, `IDLE`, `OFFLINE`, `MAINTENANCE`).
   - Dynamic marker movement and state updates via `useTrackingSocket` without full page refresh.
2. `/companies/[companyId]/vehicles/[id]/telemetry`:
   - Historical audit log table with coordinates, speed, heading, ignition, diagnostics, and source.
   - Quick time window filters (1h, 6h, 24h, 7d), source filter, and pagination (up to 500 records).
3. `FleetMap` (`components/tracking/fleet-map.tsx`):
   - Client-side Leaflet integration with CartoDB Voyager tiles.
   - Custom directional HTML markers colored by fleet status with heading rotation arrows.
   - Controls: Zoom In, Zoom Out, Auto-fit bounds.
4. `VehicleDetailsPanel` (`components/tracking/vehicle-details-panel.tsx`):
   - Slide-over inspection panel on marker or card click.
   - Live telemetry metrics (Speed, Heading, Ignition, Accuracy, Coordinates).
   - Extended diagnostics (Fuel level gauge, Battery gauge, Engine temperature, Odometer).
   - Driver details and direct link (guarded by `driver.read`).
   - Active trip details and direct link (guarded by `trip.read`).
   - Relative time since last telemetry ping ("Just now", "45s ago").
5. `TelemetrySimulatorDialog` (`components/tracking/telemetry-simulator-dialog.tsx`):
   - Allows operators and testers to emit live telemetry events directly from the UI.
   - Directional step buttons (North, South, East, West ~200m).
   - Sliders for Speed and Heading, and Ignition toggle.

---

## 8. Permissions & RBAC Integration

Fully integrated with the Module 8A/8B permission catalog and database seed:

| Permission | Description | Assigned Roles |
|---|---|---|
| `fleet.tracking.read` | Access fleet tracking page & list | `SUPER_ADMIN`, `OWNER`, `ADMIN`, `MANAGER`, `DISPATCHER` |
| `fleet.tracking.live` | Connect to live WebSocket stream | `SUPER_ADMIN`, `OWNER`, `ADMIN`, `MANAGER`, `DISPATCHER` |
| `vehicle.location.read` | View single vehicle location | `SUPER_ADMIN`, `OWNER`, `ADMIN`, `MANAGER`, `DISPATCHER` |
| `vehicle.location.live` | Receive vehicle location updates | `SUPER_ADMIN`, `OWNER`, `ADMIN`, `MANAGER`, `DISPATCHER` |
| `vehicle.telemetry.read` | Query historical telemetry logs | `SUPER_ADMIN`, `OWNER`, `ADMIN`, `MANAGER` |
| `vehicle.telemetry.write` | Ingest telemetry data | `SUPER_ADMIN`, `OWNER` |

Restricted Roles:
- **`ACCOUNTANT`:** Cannot access fleet tracking, live stream, or telemetry.
- **`DRIVER`:** Cannot access company-wide fleet tracking.
- **`CUSTOMER`:** Cannot access company-wide fleet tracking.

---

## 9. Tenant Isolation Verification

Tenant isolation is enforced at four distinct layers:
1. **HTTP Ingestion:** `TenantGuard` verifies caller's active membership in `X-Company-Id` header. Vehicle and driver IDs are checked against `companyId`.
2. **Database Queries:** All database queries require `companyId`.
3. **WebSocket Connection:** Clients can only connect and join rooms matching their verified company membership.
4. **WebSocket Subscriptions:** If Client A (Company A) attempts to emit `subscribe:fleet` with Company B ID, the gateway rejects the subscription with a tenant isolation violation error.

---

## 10. API Endpoints

| Method | Endpoint | Description | Permission Required |
|---|---|---|---|
| `POST` | `/api/v1/telemetry` | Ingest vehicle telemetry event | `vehicle.telemetry.write` |
| `POST` | `/api/v1/vehicles/:vehicleId/telemetry` | Ingest telemetry for specific vehicle | `vehicle.telemetry.write` |
| `GET` | `/api/v1/companies/:companyId/tracking` | Get live fleet tracking snapshot | `fleet.tracking.read` |
| `GET` | `/api/v1/vehicles/:vehicleId/location` | Get latest location for vehicle | `vehicle.location.read` |
| `GET` | `/api/v1/vehicles/:vehicleId/telemetry` | Get historical telemetry (paginated) | `vehicle.telemetry.read` |
| `GET` | `/api/v1/vehicles/:vehicleId/telemetry/history` | Alias: get telemetry history | `vehicle.telemetry.read` |
| `WS` | `/tracking` | Real-time tracking WebSocket namespace | `fleet.tracking.live` |

---

## 11. Telemetry Data Model

```typescript
export interface IngestTelemetryDto {
  vehicleId: string;
  driverId?: string | null;
  latitude: number;             // -90 to 90
  longitude: number;            // -180 to 180
  speed?: number;               // 0 to 500 km/h
  heading?: number;             // 0 to 360 degrees
  accuracy?: number;            // metres
  altitude?: number;            // metres
  ignition?: boolean;
  batteryLevel?: number;        // 0 to 100%
  odometer?: number;            // km
  engineTemperature?: number;   // celsius
  fuelLevel?: number;           // 0 to 100%
  signalStrength?: number;
  source?: TelemetrySource;     // MANUAL, MOBILE, GPS_DEVICE, IOT, SIMULATOR, API
  timestamp: string;            // ISO 8601 (max +5m in future)
}
```

---

## 12. Offline Detection

- **Constant:** `TELEMETRY_OFFLINE_THRESHOLD_SECONDS = 300` (5 minutes).
- **Rule:**
  ```text
  Now - LastTelemetryTimestamp > 300 seconds
          ↓
  Vehicle derived status = OFFLINE
  ```
- **Precedence:**
  1. `vehicleStatus === 'MAINTENANCE'` -> `MAINTENANCE`
  2. `!isOnline` -> `OFFLINE`
  3. `isOnTrip || vehicleStatus === 'ON_TRIP'` -> `ON_TRIP`
  4. `speed === 0 && !ignition` -> `IDLE`
  5. Default -> `ACTIVE`

---

## 13. Testing Summary

### Unit & API Test Results
- **`telemetry.service.spec.ts` (17 tests):**
  - Ingestion validation (coordinates, speed, heading, timestamp)
  - Auto-driver assignment resolution via `DriverVehicleAssignment`
  - Active trip detection and status derivation
  - Tenant vehicle mismatch rejection (404)
  - Tenant driver mismatch rejection (403)
  - Offline status calculation & counters
  - Telemetry history window & pagination limits
- **`telemetry.controller.spec.ts` (14 tests):**
  - Ingestion permission checks (OWNER, SUPER_ADMIN vs DISPATCHER, ACCOUNTANT, DRIVER, CUSTOMER)
  - Snapshot permission checks (OWNER, DISPATCHER vs ACCOUNTANT, DRIVER, CUSTOMER)
  - Location and history permission checks
- **`telemetry.gateway.spec.ts` (11 tests):**
  - Missing token rejection
  - Invalid token rejection
  - Inactive user rejection
  - Missing tenant membership rejection
  - Missing `fleet.tracking.live` permission rejection
  - Successful authenticated connection and room joining
  - Cross-tenant subscription prevention (`subscribe:fleet` to Company B from Company A)
  - Tenant-scoped event broadcasting
- **Total Telemetry Tests:** 42 / 42 passed (100%)

---

## 14. Performance Considerations

1. **Hot/Cold Path Separation:** Frequent map lookups query `vehicle_locations` (1 row per vehicle) or Redis cache, avoiding table scans over `vehicle_telemetry`.
2. **Indexed Queries:** `vehicle_telemetry` utilizes composite indexes on `(companyId, vehicleId, timestamp)` and `(companyId, timestamp)`.
3. **Bounded Result Sets:** API restricts telemetry history queries to `TELEMETRY_MAX_PAGE_SIZE = 500` and default 24-hour time windows.
4. **Targeted Socket Fan-Out:** Updates are emitted strictly to `company:{companyId}` and `vehicle:{vehicleId}` rooms. No unpartitioned global broadcasts.
5. **DOM Performance:** Leaflet markers are updated in-place via `marker.setLatLng()` using an in-memory marker map rather than re-creating map instances or re-rendering whole pages.

---

## 15. Regression Results

Full monorepo verification confirms zero regressions:

| Test Suite / Check | Passed / Total | Status |
|---|---|---|
| Monorepo Typecheck (`turbo run typecheck`) | 9 / 9 packages | PASSED |
| Backend API Tests (`jest`) | 113 / 113 tests | PASSED |
| Admin Web Tests (`jest`) | 22 / 22 tests | PASSED |
| Utils Tests (`jest`) | 12 / 12 tests | PASSED |
| Backend Production Build (`nest build`) | Complete | PASSED |
| Next.js Production Build (`next build`) | 15 / 15 routes | PASSED |
| Total Tests | 147 / 147 tests | 100% PASSED |

---

## 16. Known Limitations

- **Geofencing & Alerts:** Geofence boundary evaluation and speeding/idle threshold alert notifications are slated for the alerting engine.
- **Time-Series Partitioning:** For deployments exceeding 10,000 active devices reporting every 5 seconds, migrating `vehicle_telemetry` to TimescaleDB or PostgreSQL native declarative partitioning on `timestamp` is recommended.

---

## 17. Recommended Module 10

### Recommended: **Module 10 — Geofencing, Speeding & Fleet Alert Management**
Building directly upon the real-time telemetry engine established in Module 9:
- Polygon and circular geofence boundary creation
- Real-time entry / exit event detection
- Overspeed, harsh braking, and excessive idle alerts
- Alert notification dispatch (in-app toast, email, webhook)
- Fleet compliance scoring and driver safety analytics
