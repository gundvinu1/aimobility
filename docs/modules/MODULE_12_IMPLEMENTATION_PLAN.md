# AI-MOS MODULE 12: IMPLEMENTATION PLAN
## Dispatch, Route Planning & Trip Optimization

**Target Monorepo:** `D:\Mobility` (`aimobility`)  
**Status:** In Progress — Incremental Execution  
**Baseline Test Status:** 310 / 310 Passing (Backend: 240, Frontend: 58, Utils: 12)  
**Baseline Typecheck:** Clean across all packages  

---

## 1. Verified Baseline Test Results

Prior to any modifications in Module 12, the entire monorepo test suite and typechecker were executed to establish ground truth:

```bash
# Package Typecheck
npx -y pnpm@9 run typecheck
Result: 0 errors across all 10 packages

# Unit & Integration Tests
npx -y pnpm@9 run test
Result:
  - Backend API: 25 test suites, 240 tests passed
  - Admin Web:   5 test suites, 58 tests passed
  - Utils:       1 test suite, 12 tests passed
  - Total:       31 test suites, 310 tests passed (0 failures)
```

---

## 2. Existing Components and Systems Reused

| Component / Subsystem | Location | Reuse Strategy |
| :--- | :--- | :--- |
| **Authentication & RBAC** | `apps/backend-api/src/modules/auth`, `rbac` | Reuse JWT tokens, `TenantGuard`, `CompanyRoles`, `ROLE_PERMISSIONS` |
| **Multi-Tenancy** | `apps/backend-api/src/modules/company` | Tenant-scoped data queries with `companyId` isolation, zero IDOR leakage |
| **Trip Model & Lifecycle** | `packages/database`, `modules/trip` | Authoritative `Trip` table (`trips`), `TripStatus`, `VALID_TRIP_TRANSITIONS` |
| **Booking Model** | `packages/database`, `modules/booking` | `Booking` table (`bookings`), origin for customer, passenger count, addresses |
| **Driver Management** | `packages/database`, `modules/driver` | `Driver` table, `dutyStatus` (`ON_TRIP`, `ON_DUTY`), license checks |
| **Vehicle Management** | `packages/database`, `modules/vehicle` | `Vehicle` table, `status` (`ACTIVE`, `MAINTENANCE`, `ON_TRIP`), capacity |
| **Fleet Maintenance & Work Orders** | `modules/fleet-management` | Module 11 `WorkOrder` status (`OPEN`, `IN_PROGRESS`) blocks vehicle assignment |
| **Fleet Tracking & Telemetry** | `modules/telemetry` | Module 9 `VehicleLocation`, `VehicleTelemetry`, Redis location caching |
| **Socket.IO Gateway** | `modules/telemetry/telemetry.gateway.ts` | Reuse `/tracking` namespace, `company:{companyId}` tenant rooms |
| **Fleet Alerts & Geofences** | `modules/alert`, `modules/geofence` | Module 10 `FleetAlert`, geofence boundary checks |
| **Frontend UI & Layout** | `apps/admin-web` | Next.js 14 App Router, `RouteGuard`, `PermissionGate`, shadcn/ui components |
| **API Client** | `apps/admin-web/lib/api/api-client.ts` | Base HTTP client with bearer tokens and `x-company-id` header |

---

## 3. Gap Analysis & Proposed Architectural Additions

### Missing Functionality Identified
1. **Time-Window Conflict Detection:** Existing `TripService` only blocks assignment if a driver or vehicle is currently on a live `IN_PROGRESS` or `DISPATCHED` trip. It does not check scheduled overlap time windows ($T_{scheduled} \pm \Delta_{buffer}$).
2. **Maintenance Hold Validation:** Existing `TripService` does not check Module 11's `WorkOrder` table for active maintenance holds.
3. **Driver & Vehicle Unassignment:** No dedicated endpoints exist to unassign a driver or vehicle from a scheduled trip.
4. **Multi-Stop Trip Support:** `Trip` model only contains origin and dropoff. No sequenced waypoints/stops entity exists.
5. **Provider-Independent Routing Abstraction:** No interface exists for distance/duration calculation, route polyline geometry, or mock calculation.
6. **ETA Metadata & Throttled Recalculation:** No dynamic ETA calculation or persistence on trips/stops.
7. **Real-Time Dispatch Sockets:** `TripService` does not broadcast dispatch/assignment events to `company:{companyId}` socket rooms.
8. **Dispatch Analytics & Availability:** No operational dispatch metrics (lead time, unassigned queues, resource utilization) or availability queries.
9. **Interactive Dispatch UI:** Existing dispatch page is a basic Kanban board without assignment modals, conflict alerts, multi-stop drawer, or live socket subscriptions.

### Proposed Additive Schema Changes
1. **Additive Schema Model:** `TripStop` (sequenced waypoints with `stopOrder`, `stopType`, coordinates, arrival/departure timestamps, status).
2. **Additive Fields on `Trip`:**
   - `routePolyline`: String? (encoded polyline for route visualization)
   - `estimatedDistanceKm`: Float?
   - `estimatedDurationMinutes`: Int?

*Note: No existing tables or columns will be modified destructively. All additions are strictly non-breaking and additive.*

---

## 4. Implementation Phases

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MODULE 12 IMPLEMENTATION PHASES                       │
├─────────────┬───────────────────────────────────────────────────────────────┤
│ Phase 12A   │ Dispatch Foundation & Assignment Engine                       │
│             │ • Centralized conflict engine (overlap, maintenance, status)  │
│             │ • Unassign & Reassign endpoints (Driver & Vehicle)            │
│             │ • DB transactions & concurrency safety                        │
│             │ • Audit logging & permission guards                           │
│             │ • Unit & integration test verification                        │
├─────────────┼───────────────────────────────────────────────────────────────┤
│ Phase 12B   │ Multi-Stop Trips, Routing Abstraction & ETA                   │
│             │ • Additive Prisma migration (`TripStop`, `routePolyline`)     │
│             │ • Routing provider abstraction (Mock Haversine + OSRM)        │
│             │ • Multi-stop CRUD & sequential ordering validation            │
│             │ • ETA calculation & Redis route caching                       │
│             │ • Unit & integration test verification                        │
├─────────────┼───────────────────────────────────────────────────────────────┤
│ Phase 12C   │ Real-Time Dispatch Integration                                │
│             │ • Socket.IO dispatch events in `/tracking` namespace          │
│             │ • Tenant room isolation (`company:{companyId}`)               │
│             │ • Resilient post-commit event dispatch                        │
│             │ • Unit & integration test verification                        │
├─────────────┼───────────────────────────────────────────────────────────────┤
│ Phase 12D   │ Dispatch Analytics, Optimization Foundation & UI Polish       │
│             │ • Dispatch analytics API & formulas (lead time, utilization)  │
│             │ • VRP / route optimization foundation (distance matrix ready) │
│             │ • Modern frontend dispatch board (selectors, conflicts, map)  │
│             │ • Full regression verification (Modules 1–12)                 │
└─────────────┴───────────────────────────────────────────────────────────────┘
```

---

## 5. Verification Commands

```powershell
# Typecheck across monorepo
npx -y pnpm@9 run typecheck

# Focused Backend Tests
npx -y pnpm@9 --filter @ai-mos/backend-api run test -- test/dispatch.service.spec.ts

# Full Test Suite
npx -y pnpm@9 run test

# Full Monorepo Build
npx -y pnpm@9 run build
```

---

## 6. Risks & Mitigations

1. **Risk: Concurrent Double-Booking of Drivers/Vehicles**  
   *Mitigation:* Use interactive database transactions with row-level verification and short-lived Redis concurrency locks.
2. **Risk: External Map API Dependencies / Costs**  
   *Mitigation:* Implement `MockRoutingProvider` by default with zero API keys required; fall back gracefully if external provider fails.
3. **Risk: Cross-Tenant Data Leakage via WebSockets**  
   *Mitigation:* Strictly emit events to authenticated `company:{companyId}` rooms; reject client if company context is absent or unauthorized.
4. **Risk: Schema Drift or Destructive Database Migrations**  
   *Mitigation:* Keep all migrations additive. Never reset database or drop columns. Validate schema with `prisma validate`.
