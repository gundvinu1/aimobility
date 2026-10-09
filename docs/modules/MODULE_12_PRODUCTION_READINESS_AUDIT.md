# Module 12: Dispatch, Route Planning & Trip Optimization — Production Readiness Audit

**Audit Date:** October 9, 2026  
**Auditor:** AI-MOS Senior Enterprise Systems & Security Architect  
**Repository:** `D:\Mobility`  
**Scope:** AI-MOS Module 12 (Dispatch, Route Planning & Trip Optimization)  
**Audit Mode:** Read-Only Audit & Forensic Inspection  
**Prisma Database URL:** `postgresql://postgres:postgres@localhost:5432/aimosdb`  

---

## 1. Executive Verdict

### **Verdict: FAIL (NOT PRODUCTION-READY)**

While Module 12 demonstrates substantial scaffolding, correct additive schema design, and successful unit test mock executions (364 tests passing across the monorepo), an independent forensic code and runtime audit reveals **critical architectural, transactional, database, and state machine defects** that prevent it from being safe for production deployment.

### Summary of Verdict Reasons:
1. **Unapplied Database Migrations (Critical):** `prisma migrate status` verifies that migration `20261009122000_module12_dispatch_route_planning` (and predecessor `20261008123000_module11_fuel_maintenance_expenses`) have **never been applied to the local database**. Any production runtime execution accessing `trip_stops` or `routePolyline` will crash immediately with missing relation/column errors.
2. **Race Condition & Double-Booking Vulnerability (Critical):** Resource assignment (`assignDriver` and `assignVehicle`) lacks Redis distributed locks, Prisma interactive transactions (`$transaction`), and database row-level locking (`SELECT ... FOR UPDATE`). Concurrent assignment requests will successfully double-book drivers and vehicles to overlapping trips.
3. **Deterministic Crash in Waypoint Reordering (Critical):** `reorderStops` updates `stopOrder` sequentially in-place. Because of the database constraint `CREATE UNIQUE INDEX "trip_stops_tripId_stopOrder_key" ON "trip_stops"("tripId", "stopOrder")`, moving any stop to a position occupied by another stop causes PostgreSQL to abort with a fatal `duplicate key value violates unique constraint` error.
4. **State Machine Bypass (High):** `updateTripStatus` permits direct transitions from `SCHEDULED` to `DISPATCHED` via `PATCH /trips/:id/status` without verifying that a driver and vehicle are assigned, bypassing the assignment requirement enforced in `dispatchTrip`.
5. **Multi-Stop ETA Blindness (High):** `calculateTripEta` calculates a direct straight-line vector from the vehicle's position to the final destination, completely ignoring all intermediate waypoints and pending stops.
6. **Unbounded Memory Leak & O(N) In-Memory Aggregation (High):** `getDispatchAnalytics` fetches every trip in company history into Node.js heap memory rather than executing SQL aggregates, introducing an OOM risk on enterprise datasets.
7. **Test Coverage Gaps for New Phase 12B Code (High):** Automated test runs show that `TripService` stop methods (`getStops`, `addStop`, `updateStop`, `deleteStop`, `reorderStops`, `calculateTripRoute`, `calculateTripEta`) have **0% unit test coverage** in `trip.service.spec.ts`, and `routing.service.ts` has only 17.14% line coverage.

---

## 2. Findings Matrix

| ID | Severity | Category | Title | Affected File / Function |
| :--- | :--- | :--- | :--- | :--- |
| **CRIT-01** | **Critical** | Database | Module 12 & 11 Migrations Unapplied to Database | `packages/database/prisma/migrations` |
| **CRIT-02** | **Critical** | Concurrency | Double-Booking Race Condition on Concurrent Assignments | `trip.service.ts:assignDriver`, `assignVehicle` |
| **CRIT-03** | **Critical** | Integrity | Unique Constraint Collision during Waypoint Reordering | `trip.service.ts:reorderStops` |
| **HIGH-01** | **High** | State Machine | Status Update Endpoint Bypasses Driver/Vehicle Assignment Check | `trip.service.ts:updateTripStatus` |
| **HIGH-02** | **High** | Routing / ETA | Dynamic ETA Calculation Completely Ignores Intermediate Stops | `trip.service.ts:calculateTripEta` |
| **HIGH-03** | **High** | Performance | Unbounded O(N) In-Memory Data Load in Dispatch Analytics | `trip.service.ts:getDispatchAnalytics` |
| **HIGH-04** | **High** | Quality Assurance | Zero Unit Test Coverage for Waypoint & Routing Service Methods | `trip.service.spec.ts` |
| **MED-01** | **Medium** | Business Rules | Buffer Doubling in Overlap Calculations | `trip.service.ts:validateDriverEligibility` |
| **MED-02** | **Medium** | Lifecycle | Stop Deletion Allowed on Completed Trips and Deletion of Pickup/Dropoff | `trip.service.ts:deleteStop` |
| **MED-03** | **Medium** | Consistency | Stale Polyline & Geometry After Waypoint Mutations | `trip.service.ts:addStop`, `deleteStop`, `reorderStops` |
| **MED-04** | **Medium** | Frontend / Socket | Missing REST Resynchronization on WebSocket Reconnect | `apps/admin-web/lib/dispatch/use-dispatch-socket.ts` |
| **MED-05** | **Medium** | RBAC / Auth | Verification Report Discrepancy (Missing PermissionsGuard) | `trip.controller.ts` |
| **LOW-01** | **Low** | Business Rules | Driver License Expiry Checked Against Current Time, Not Trip Date | `trip.service.ts:validateDriverEligibility` |
| **LOW-02** | **Low** | Status Sync | Vehicle Status Not Updated to `ON_TRIP` During Trip Execution | `trip.service.ts:updateTripStatus` |

---

## 3. Deep Evidence & Reproduction Steps

---

### Finding CRIT-01: Module 12 & 11 Migrations Unapplied to Database
- **Severity:** Critical
- **Category:** Database Schema & Migration Safety
- **Location:** `packages/database/prisma/migrations/20261009122000_module12_dispatch_route_planning/migration.sql`
- **Evidence:**
  Executing `prisma migrate status` against local PostgreSQL (`aimosdb`):
  ```bash
  $ npx -y pnpm@9 --filter @ai-mos/database exec prisma migrate status
  Datasource "db": PostgreSQL database "aimosdb", schema "public" at "localhost:5432"

  13 migrations found in prisma/migrations
  Following migrations have not yet been applied:
  20261008123000_module11_fuel_maintenance_expenses
  20261009122000_module12_dispatch_route_planning
  ```
- **Reproduction Steps:**
  1. Boot the NestJS API connected to `aimosdb`.
  2. Send `GET /trips/:id/stops` or `POST /trips/:id/stops`.
  3. Prisma executes query `SELECT ... FROM "trip_stops"`.
  4. Database rejects query: `relation "trip_stops" does not exist`.

---

### Finding CRIT-02: Double-Booking Race Condition on Concurrent Assignments
- **Severity:** Critical
- **Category:** Concurrency & Transaction Boundaries
- **Location:** [`apps/backend-api/src/modules/trip/trip.service.ts`](file:///D:/Mobility/apps/backend-api/src/modules/trip/trip.service.ts#L657-L729), lines 657–728 (`assignDriver`) & 815–886 (`assignVehicle`)
- **Evidence:**
  In `assignDriver`:
  ```typescript
  // Line 678: Non-atomic read
  await this.validateDriverEligibility(dto.driverId, companyId, id, existing);

  // Line 685: Separate update outside of any database transaction or lock
  const updated = (await this.db.trip.update({
    where: { id },
    data: { driverId: dto.driverId, status: nextStatus, ... }
  }));
  ```
  Inside `validateDriverEligibility`:
  ```typescript
  // Line 1219-1227: Read query without SELECT FOR UPDATE
  const activeTrip = await this.db.trip.findFirst({ ... });
  // Line 1240-1248: Read query for overlapping trips
  const otherTrips = await this.db.trip.findMany({ ... });
  ```
  - **No Redis Locks:** Neither `CacheService` nor Redlock is imported or utilized.
  - **No Database Transaction:** Neither `$transaction` nor `SELECT ... FOR UPDATE` is used.
  - **No Database Exclusion Constraint:** The database schema has no PostgreSQL GiST exclusion constraint on `(driverId, scheduled_window)`.
- **Reproduction Steps:**
  1. Create two scheduled trips, Trip A and Trip B, both scheduled for 10:00 AM – 11:00 AM on the same day.
  2. Concurrently issue two HTTP requests:
     - Request 1: `POST /trips/Trip_A/assign-driver` with `{ driverId: "Driver_1" }`.
     - Request 2: `POST /trips/Trip_B/assign-driver` with `{ driverId: "Driver_1" }`.
  3. Both requests run `validateDriverEligibility` simultaneously. Neither Trip A nor Trip B is committed yet, so both queries find 0 conflicting trips.
  4. Both requests proceed to `this.db.trip.update`.
  5. Both return HTTP 200. Driver_1 is now double-booked to two overlapping trips at the exact same time.

---

### Finding CRIT-03: Unique Constraint Collision during Waypoint Reordering
- **Severity:** Critical
- **Category:** Database Constraints & Logic Integrity
- **Location:** [`apps/backend-api/src/modules/trip/trip.service.ts`](file:///D:/Mobility/apps/backend-api/src/modules/trip/trip.service.ts#L1742-L1748), lines 1742–1748 (`reorderStops`)
- **Evidence:**
  The schema and migration define:
  ```sql
  CREATE UNIQUE INDEX "trip_stops_tripId_stopOrder_key" ON "trip_stops"("tripId", "stopOrder");
  ```
  In `reorderStops`:
  ```typescript
  for (let i = 0; i < stopIds.length; i++) {
    await this.db.tripStop!.update({
      where: { id: stopIds[i] },
      data: { stopOrder: i + 1 },
    });
  }
  ```
- **Reproduction Steps:**
  1. Create Trip T with Stop A (`stopOrder: 1`) and Stop B (`stopOrder: 2`).
  2. Send `PATCH /trips/T/stops/reorder` with body `{ "stopIds": ["Stop_B_id", "Stop_A_id"] }`.
  3. At iteration `i = 0`: The code executes `UPDATE "trip_stops" SET "stopOrder" = 1 WHERE "id" = 'Stop_B_id'`.
  4. PostgreSQL checks the unique constraint `(tripId, stopOrder)`. Stop A already has `stopOrder: 1`.
  5. PostgreSQL throws a fatal error: `duplicate key value violates unique constraint "trip_stops_tripId_stopOrder_key"`.
  6. The request fails with HTTP 500. It is impossible to reorder existing stops using this endpoint.

---

### Finding HIGH-01: Status Update Endpoint Bypasses Driver/Vehicle Assignment Check
- **Severity:** High
- **Category:** State Machine Integrity
- **Location:** [`apps/backend-api/src/modules/trip/trip.service.ts`](file:///D:/Mobility/apps/backend-api/src/modules/trip/trip.service.ts#L1040-L1061) vs [`apps/backend-api/src/modules/trip/trip.service.ts`](file:///D:/Mobility/apps/backend-api/src/modules/trip/trip.service.ts#L988-L992)
- **Evidence:**
  In `dispatchTrip`:
  ```typescript
  if (!existing.driverId || !existing.vehicleId) {
    throw new BadRequestException(
      `Cannot dispatch trip: both a driver and a vehicle must be assigned first`,
    );
  }
  ```
  In `updateTripStatus`:
  ```typescript
  this.validateTransition(
    existing.status as TripStatusValue,
    dto.status as TripStatusValue,
  );
  // No check for existing.driverId or existing.vehicleId!
  ```
  In `packages/constants/src/trip.ts`:
  ```typescript
  SCHEDULED: ['DRIVER_ASSIGNED', 'VEHICLE_ASSIGNED', 'DISPATCHED', 'CANCELLED'],
  ```
- **Reproduction Steps:**
  1. Create a trip with status `SCHEDULED`, with `driverId: null` and `vehicleId: null`.
  2. Send `PATCH /trips/:id/status` with body `{ "status": "DISPATCHED" }`.
  3. `validateTransition` checks if `'DISPATCHED'` is in `VALID_TRIP_TRANSITIONS['SCHEDULED']`. It is.
  4. The trip status becomes `DISPATCHED` without any assigned driver or vehicle.

---

### Finding HIGH-02: Dynamic ETA Calculation Completely Ignores Intermediate Stops
- **Severity:** High
- **Category:** Route Planning & Navigation Engine
- **Location:** [`apps/backend-api/src/modules/trip/trip.service.ts`](file:///D:/Mobility/apps/backend-api/src/modules/trip/trip.service.ts#L1825-L1873), lines 1825–1873 (`calculateTripEta`)
- **Evidence:**
  ```typescript
  async calculateTripEta(tripId: string, companyId: string, currentLatitude?: number, currentLongitude?: number) {
    const dest = {
      latitude: trip.dropLatitude ?? 0,
      longitude: trip.dropLongitude ?? 0,
    };
    const currentLoc = {
      latitude: currentLatitude ?? trip.pickupLatitude ?? 0,
      longitude: currentLongitude ?? trip.pickupLongitude ?? 0,
    };
    // Direct calculation from currentLoc straight to dest
    eta = await this.routingService.calculateEta(currentLoc, dest);
    ...
  }
  ```
  `calculateTripEta` never queries `tripStop`, never filters for incomplete/pending waypoints (`isCompleted: false`), and does not calculate waypoint dwell times.
- **Reproduction Steps:**
  1. Create a trip from Point A to Point D with intermediate stops at Point B and Point C (total route distance: 45 km).
  2. Call `GET /trips/:id/eta`.
  3. The endpoint calculates the straight-line distance from Point A directly to Point D (e.g., 10 km, 15 min), completely omitting Points B and C.

---

### Finding HIGH-03: Unbounded O(N) In-Memory Data Load in Dispatch Analytics
- **Severity:** High
- **Category:** Performance, Scalability & Memory Safety
- **Location:** [`apps/backend-api/src/modules/trip/trip.service.ts`](file:///D:/Mobility/apps/backend-api/src/modules/trip/trip.service.ts#L1876-L1926), lines 1876–1926 (`getDispatchAnalytics`)
- **Evidence:**
  ```typescript
  const [tripsRaw, driversRaw, vehiclesRaw, reassignLogs] = await Promise.all([
    this.db.trip.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, status: true, scheduledStart: true, actualStart: true, driverId: true, vehicleId: true },
    }),
    ...
  ]);
  const trips = (tripsRaw ?? []) as any[];
  // O(N) JavaScript filtering in heap memory
  const unassignedTrips = trips.filter(...).length;
  const assignedTrips = trips.filter(...).length;
  const completedTrips = trips.filter(...).length;
  ```
  - **No Date Range Filtering:** Pulls all trips in the company's entire history.
  - **No Database Aggregations:** Uses in-memory array filtering instead of `COUNT(*)` with `GROUP BY status`.
  - **AuditLog Full Table Scan:** Queries `audit_logs` filtering on JSON path `metadata.companyId`, where `metadata` has no GIN or B-tree index in PostgreSQL.

---

### Finding HIGH-04: Zero Unit Test Coverage for Waypoint & Routing Service Methods
- **Severity:** High
- **Category:** Test Engineering & Quality Assurance
- **Location:** [`apps/backend-api/src/modules/trip/trip.service.spec.ts`](file:///D:/Mobility/apps/backend-api/src/modules/trip/trip.service.spec.ts)
- **Evidence:**
  Forensic inspection and coverage measurements via Jest:
  ```bash
  $ npx -y pnpm@9 --filter @ai-mos/backend-api test -- --coverage --testPathPattern=trip
  ```
  Results from coverage report:
  - `routing.service.ts`: **17.14% Line Coverage** (lines 15–104 completely uncovered).
  - `trip.service.ts`: Lines `1609, 1669, 1677, 1728, 1783, 1806, 1836, 1851` uncovered.
  - In `trip.service.spec.ts`: `mockPrisma` does not even define a `tripStop` delegate. There are **zero unit tests** for:
    - `getStops`
    - `addStop`
    - `updateStop`
    - `deleteStop`
    - `reorderStops`
    - `calculateTripRoute`
    - `calculateTripEta`

---

### Finding MED-01: Buffer Doubling in Overlap Calculations
- **Severity:** Medium
- **Category:** Business Rules
- **Location:** [`apps/backend-api/src/modules/trip/trip.service.ts`](file:///D:/Mobility/apps/backend-api/src/modules/trip/trip.service.ts#L1235-L1262)
- **Evidence:**
  ```typescript
  const bufferMs = DISPATCH_CONFLICT_BUFFER_MINUTES * 60 * 1000;
  // targetTrip is buffered by +/- 15 min:
  const targetStartMs = new Date(targetTrip.scheduledStart).getTime() - bufferMs;
  const targetEndMs = new Date(targetTrip.scheduledStart).getTime() + targetDurationMs + bufferMs;
  // otherTrip is ALSO buffered by +/- 15 min:
  const otherStartMs = new Date(other.scheduledStart).getTime() - bufferMs;
  const otherEndMs = new Date(other.scheduledStart).getTime() + otherDurationMs + bufferMs;
  ```
  By applying a 15-minute buffer to **both** the target trip and the candidate trips, the code demands a minimum gap of **30 minutes** (2 * 15 min) between trips, artificially rejecting valid dispatches that have a 15-minute to 29-minute buffer.

---

### Finding MED-02: Stop Deletion Allowed on Completed Trips and Deletion of Pickup/Dropoff
- **Severity:** Medium
- **Category:** Lifecycle Integrity
- **Location:** [`apps/backend-api/src/modules/trip/trip.service.ts`](file:///D:/Mobility/apps/backend-api/src/modules/trip/trip.service.ts#L1658-L1715), lines 1658–1715 (`deleteStop`)
- **Evidence:**
  `deleteStop` does not check `trip.status`, allowing deleting stops on trips in `COMPLETED` or `CANCELLED` status. Furthermore, `deleteStop` does not check `stopType`, allowing users to delete `PICKUP` and `DROPOFF` stops, compromising journey integrity.

---

### Finding MED-03: Stale Polyline & Geometry After Waypoint Mutations
- **Severity:** Medium
- **Category:** Cache & Route Consistency
- **Location:** [`apps/backend-api/src/modules/trip/trip.service.ts`](file:///D:/Mobility/apps/backend-api/src/modules/trip/trip.service.ts#L1533-L1772)
- **Evidence:**
  When a stop is added (`addStop`), modified (`updateStop`), deleted (`deleteStop`), or reordered (`reorderStops`), the persisted `trip.routePolyline`, `trip.distanceKm`, and `trip.durationMinutes` on the `trips` table are neither cleared nor recalculated. The persisted route geometry remains stale until `calculateRoute` is manually invoked.

---

### Finding MED-04: Missing REST Resynchronization on WebSocket Reconnect
- **Severity:** Medium
- **Category:** Real-Time Frontend Synchronization
- **Location:** [`apps/admin-web/lib/dispatch/use-dispatch-socket.ts`](file:///D:/Mobility/apps/admin-web/lib/dispatch/use-dispatch-socket.ts#L87-L90)
- **Evidence:**
  ```typescript
  socket.on('connect', () => {
    setConnectionStatus('LIVE');
    socket.emit('subscribe:fleet', { companyId });
  });
  ```
  When the socket reconnects after a temporary network drop, it re-subscribes to the fleet room but does not invoke `onAnyDispatchEventRef.current?.()` or refetch the trip list. Any dispatch events that occurred during the outage are permanently missed on the UI until an explicit manual page reload.

---

### Finding MED-05: Discrepancy with Previous Verification Report (Missing PermissionsGuard)
- **Severity:** Medium
- **Category:** Security / Documentation
- **Location:** [`apps/backend-api/src/modules/trip/trip.controller.ts`](file:///D:/Mobility/apps/backend-api/src/modules/trip/trip.controller.ts#L57) vs `docs/modules/MODULE_12_VERIFICATION_REPORT.md`
- **Evidence:**
  The previous report claimed:
  > *"All controller routes are guarded by `@UseGuards(JwtAuthGuard, PermissionsGuard)` with granular `@Permissions(Permission.TRIP_READ, Permission.TRIP_UPDATE)`."*
  
  In the actual code:
  - `trip.controller.ts` line 57 uses `@UseGuards(TenantGuard)` and legacy `@CompanyRoles(...)`.
  - `PermissionsGuard` and `@Permissions` are **not used anywhere** in `TripController`.
  - Read endpoints (`GET /trips`, `/trips/stats`, `/trips/availability`, `/trips/dispatch-analytics`, `/trips/:id`) do not have `@CompanyRoles` decorators, allowing any active company member (including basic `MEMBER`) to read dispatch analytics and resource availability.

---

### Finding LOW-01: Driver License Expiry Checked Against Current Time, Not Trip Date
- **Severity:** Low
- **Category:** Business Rules
- **Location:** [`apps/backend-api/src/modules/trip/trip.service.ts`](file:///D:/Mobility/apps/backend-api/src/modules/trip/trip.service.ts#L1214)
- **Evidence:**
  `if (new Date(driver.licenseExpiryDate) < new Date())`
  If a trip is scheduled for 14 days in the future, but the driver's license expires in 3 days, assignment succeeds because the license is valid today, even though it will be expired at the time of trip execution.

---

### Finding LOW-02: Vehicle Status Not Updated to `ON_TRIP` During Trip Execution
- **Severity:** Low
- **Category:** Status Consistency
- **Location:** [`apps/backend-api/src/modules/trip/trip.service.ts`](file:///D:/Mobility/apps/backend-api/src/modules/trip/trip.service.ts#L1104-L1116)
- **Evidence:**
  When a trip transitions to `IN_PROGRESS`, `driver.dutyStatus` is updated to `'ON_TRIP'`. However, `vehicle.status` (which has an `'ON_TRIP'` enum value defined in `schema.prisma`) is left as `'ACTIVE'`.

---

## 4. Test, Typecheck, and Build Execution Outcomes

Every command below was directly executed and verified:

### 1. Monorepo Typecheck
- **Command:** `npx -y pnpm@9 run typecheck`
- **Exit Code:** `0`
- **Output:** 9 successful, 9 total (FULL TURBO, 0 errors).

### 2. Monorepo Test Suite
- **Command:** `npx -y pnpm@9 run test`
- **Exit Code:** `0`
- **Summary:**
  - `@ai-mos/utils`: 1 test suite, 12 tests passed.
  - `@ai-mos/admin-web`: 6 test suites, 69 tests passed.
  - `@ai-mos/backend-api`: 26 test suites, 283 tests passed.
  - **Total:** 33 test suites, 364 tests passed (100% pass rate).

### 3. Backend Jest Coverage Execution
- **Command:** `npx -y pnpm@9 --filter @ai-mos/backend-api test -- --coverage --testPathPattern=trip`
- **Exit Code:** `0`
- **Measured Coverage:**
  - `src/modules/trip/trip.service.ts`: 64.5% statements, 46.95% branches, 65.46% lines.
  - `src/modules/trip/routing/routing.service.ts`: 21.05% statements, 0% branches, 17.14% lines.
  - `src/modules/trip/routing/mock-routing.provider.ts`: 100% statements, 66.66% branches, 100% lines.

### 4. Monorepo Production Build
- **Command:** `npx -y pnpm@9 run build`
- **Exit Code:** `0`
- **Output:** 9 successful, 9 total (NestJS compiled, Next.js 14 App Router compiled with 15/15 static and dynamic pages generated).

---

## 5. Migration & Deployment Risks

1. **Production Crash on First Query to `trip_stops`:**
   If the container or deployment pipeline starts without running `prisma migrate deploy`, runtime queries will immediately fail with PostgreSQL table relation errors.
2. **PostgreSQL Rollback Barrier:**
   The migration defines two new ENUM types (`StopType`, `StopStatus`), adds a column to `trips`, and creates `trip_stops`. In the event of an emergency production rollback, manual SQL scripts must drop foreign keys, tables, and types in reverse dependency order:
   ```sql
   DROP TABLE IF EXISTS "trip_stops" CASCADE;
   ALTER TABLE "trips" DROP COLUMN IF EXISTS "routePolyline";
   DROP TYPE IF EXISTS "StopStatus";
   DROP TYPE IF EXISTS "StopType";
   ```

---

## 6. Targeted Remediation Plan

Ordered strictly by priority and risk:

### Phase 1: Database & Migration Fixes (Immediate)
1. **Apply Pending Migrations:** Run `npx -y pnpm@9 --filter @ai-mos/database exec prisma migrate deploy` in the deployment environment.
2. **Fix Reordering Unique Constraint Collision:** Refactor `reorderStops` in `trip.service.ts` to use a 2-step update inside a Prisma interactive transaction (`$transaction`):
   - Step 1: Temporarily shift target stop orders to negative indices (`-(i + 1)`).
   - Step 2: Assign final sequence orders (`i + 1`). This completely eliminates unique constraint collisions.

### Phase 2: Concurrency & Transaction Safety
3. **Prevent Double-Booking via Distributed Locking or Row Locking:**
   - Inject `CacheService` into `TripService`.
   - Acquire a Redis lock on `lock:dispatch:driver:${driverId}` and `lock:dispatch:vehicle:${vehicleId}` with a 5-second TTL during assignment.
   - Wrap the assignment check and trip update in a Prisma `$transaction`.

### Phase 3: State Machine & Business Rule Hardening
4. **Enforce Assignment in `updateTripStatus`:** In `updateTripStatus`, if `dto.status === 'DISPATCHED'`, verify `existing.driverId && existing.vehicleId` before allowing transition.
5. **Fix Overlap Buffer Math:** In `validateDriverEligibility` and `validateVehicleEligibility`, apply buffer only once between intervals rather than expanding both windows simultaneously.
6. **Protect Waypoints Lifecycle:** In `deleteStop`, disallow deleting stops when `trip.status` is `COMPLETED`, `CANCELLED`, or `IN_PROGRESS`, and disallow deleting `PICKUP` or `DROPOFF` stops.

### Phase 4: Route, ETA & Analytics Improvements
7. **Multi-Stop Dynamic ETA:** In `calculateTripEta`, fetch pending stops (`isCompleted: false`), calculate sequential legs from `currentLoc` through remaining waypoints to `dest`, and sum duration plus waypoint dwell times.
8. **SQL Aggregations for Dispatch Analytics:** In `getDispatchAnalytics`, replace `trip.findMany` with SQL `_count` / `groupBy` and add a mandatory date filter window (e.g. `reportingPeriod: TODAY | LAST_7_DAYS | LAST_30_DAYS`).
9. **Socket Reconnect Resync:** In `useDispatchSocket.ts`, trigger `onAnyDispatchEventRef.current?.()` upon reconnect to trigger an automatic REST re-fetch.
10. **Add Unit Tests:** Implement comprehensive unit test suites in `trip.service.spec.ts` for all waypoint methods (`getStops`, `addStop`, `updateStop`, `deleteStop`, `reorderStops`), `calculateTripRoute`, and `calculateTripEta`.
