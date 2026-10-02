# Module 8A Completion Report: Dynamic Role-Based UI & Permission Access Control

## Executive Summary
Module 8A transitions **AI-MOS (AI Mobility Operating System)** from a backend-only RBAC model to an end-to-end, multi-tenant, permission-driven platform. While the backend remains the authoritative security boundary (enforcing JWT authentication, `TenantGuard`, and `CompanyRoles`), the frontend now dynamically derives permissions based on the active user identity and the selected tenant context. Unauthorized navigation items, action buttons, and entire page views are proactively hidden from the user experience, while unauthorized direct URL navigations are intercepted and routed to a dedicated, security-hardened **403 Access Restricted** page.

---

## Architecture Overview

```
                      AUTHENTICATED USER LOGIN
                                │
                                ▼
                       LOAD USER IDENTITY
                    (Platform Roles & Claims)
                                │
                                ▼
                   DETERMINE COMPANY CONTEXT
            (From URL Path /companies/[id] or Store)
                                │
                                ▼
                   RESOLVE EFFECTIVE PERMISSIONS
      ┌─────────────────────────────────────────────────────────┐
      │ SUPER_ADMIN: Wildcard ['*']                            │
      │ Inside Company: Company Role (OWNER/ADMIN/MANAGER/etc.)  │
      │ Specialized Platform Role: DISPATCHER, ACCOUNTANT, etc.  │
      │ Standalone: Top Platform Role (CUSTOMER, DRIVER)        │
      └────────────────────────────┬────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
            FRONTEND UI LAYER             BACKEND API GATEWAY
     ┌────────────────────────────┐  ┌────────────────────────────┐
     │ • Dynamic AppSidebar       │  │ • JwtAuthGuard             │
     │ • PermissionGate (Actions) │  │ • TenantGuard (Isolation)  │
     │ • RouteGuard (Pages)       │  │ • RolesGuard / CompanyRole │
     │ • 403 Forbidden Redirection│  │ • Authoritative Boundary   │
     └────────────────────────────┘  └────────────────────────────┘
```

---

## 1. Centralized Permission System

### 1.1 Permission Registry (`@ai-mos/constants`)
Location: [`packages/constants/src/permissions.ts`](file:///D:/Mobility/packages/constants/src/permissions.ts)

The centralized permission registry aggregates all granular permission tokens across Modules 2 through 7 without duplicate declarations:
- **Module 2 (Auth/Platform)**: `user.read`, `user.write`, `user.delete`, `profile.read`, `profile.write`, `role.read`, `role.write`, `permission.read`, `permission.write`
- **Module 3 (Company & Multi-Tenancy)**: `company.read`, `company.create`, `company.update`, `company.delete`, `company.settings.read`, `company.settings.write`, `company.members.read`, `company.members.write`, `company.invite`
- **Module 4 (Employee Management)**: `employee.read`, `employee.create`, `employee.update`, `employee.delete`, `employee.status.write`, `employee.user.link`
- **Module 5 (Vehicle Fleet Management)**: `vehicle.read`, `vehicle.create`, `vehicle.update`, `vehicle.delete`, `vehicle.status.write`, `vehicle.documents.manage`, `vehicle.maintenance.manage`
- **Module 6 (Driver Management)**: `driver.read`, `driver.create`, `driver.update`, `driver.delete`, `driver.status.update`, `driver.duty.update`, `driver.documents.read`, `driver.documents.write`, `driver.vehicle.assign`
- **Module 7 (Booking & Trip Management)**: `booking.read`, `booking.create`, `booking.update`, `booking.delete`, `booking.confirm`, `booking.cancel`, `trip.read`, `trip.create`, `trip.update`, `trip.delete`, `trip.assign.driver`, `trip.assign.vehicle`, `trip.dispatch`, `trip.update.status`, `trip.cancel`

---

## 2. Role-to-Permission Matrix (`ROLE_PERMISSIONS`)

| Role | Wildcard | Scope & Capabilities |
| :--- | :---: | :--- |
| **`SUPER_ADMIN`** | `['*']` | Unrestricted global access across all tenants, modules, operations, and administrative functions. |
| **`OWNER`** | No | Full tenant administration: create/update/delete vehicles, employees, drivers, bookings, trips, dispatch, company settings, invite members. |
| **`ADMIN`** | No | Full tenant operational and configuration authority: manages employees, vehicles, drivers, bookings, trips, dispatch, and company settings. |
| **`MANAGER`** | No | Operational control over employees, vehicles, drivers, bookings, trips, and dispatch. **Strictly denied** record deletion (`vehicle.delete`, `employee.delete`, `driver.delete`, `booking.delete`, `trip.delete`). |
| **`DISPATCHER`** | No | Real-time operations: dispatch board, bookings, trips, vehicle read, driver read/duty toggle/vehicle assignment. **Internal employee administration and company settings are hidden**. |
| **`ACCOUNTANT`** | No | Financial auditing visibility: read bookings, read trips, read company profile. **Fleet modifications, employee operations, and dispatch actions are hidden**. |
| **`DRIVER`** | No | Driver portal: view assigned trips, update trip status (`ARRIVED`, `EN_ROUTE`, `COMPLETED`), toggle duty status (`ON_DUTY`, `OFF_DUTY`), view assigned vehicle. Fleet admin and employee management are hidden. |
| **`CUSTOMER`** | No | Customer portal: view own bookings, create bookings, cancel bookings, view trip progression, view/update profile. Fleet administration and dispatcher tools are hidden. |

---

## 3. Dynamic UI Components & Integration

### 3.1 Permission Resolution Helper (`permissions.ts`)
Location: [`apps/admin-web/lib/auth/permissions.ts`](file:///D:/Mobility/apps/admin-web/lib/auth/permissions.ts)
- `resolveEffectivePermissions(user, activeCompany)`: Resolves active permissions combining platform roles, company role memberships, and wildcard evaluation.
- `hasPermissionHelper(userPermissions, permission)`: Evaluates single permission requirement, honoring `*`.
- `hasAnyPermissionHelper(userPermissions, permissions)`: Checks if user possesses at least one of the listed permissions.
- `hasAllPermissionsHelper(userPermissions, permissions)`: Checks if user possesses all listed permissions.
- `hasRoleHelper(userRoles, role)`: Case-insensitive check supporting `SUPER_ADMIN` override.

### 3.2 Permission Hook (`use-permissions.ts`)
Location: [`apps/admin-web/lib/auth/use-permissions.ts`](file:///D:/Mobility/apps/admin-web/lib/auth/use-permissions.ts)
Provides standard interface across any React component:
```tsx
const { hasPermission, hasAnyPermission, hasAllPermissions, hasRole } = usePermissions();
```

### 3.3 Action-Level Gate (`PermissionGate`)
Location: [`apps/admin-web/components/auth/permission-gate.tsx`](file:///D:/Mobility/apps/admin-web/components/auth/permission-gate.tsx)
Declarative component gating actions without CSS `display: none` tricks:
```tsx
<PermissionGate permission="vehicle.create">
  <Link href={`/companies/${companyId}/vehicles/new`}>
    <Button>Add Vehicle</Button>
  </Link>
</PermissionGate>
```

### 3.4 Page Route Protection (`RouteGuard`)
Location: [`apps/admin-web/components/auth/route-guard.tsx`](file:///D:/Mobility/apps/admin-web/components/auth/route-guard.tsx)
Intercepts unauthorized page access before sensitive component data mounts:
- Not authenticated $\to$ Redirects to `/login`
- Authenticated but missing required permission/role $\to$ Redirects to `/403`
- Missing company context on tenant routes $\to$ Redirects to `/companies`

### 3.5 Security-Hardened 403 Page
Location: [`apps/admin-web/app/403/page.tsx`](file:///D:/Mobility/apps/admin-web/app/403/page.tsx)
- Clear UX: "Access Restricted: You don't have permission to access this page."
- Provides navigation recovery link back to Dashboard or Companies selection.
- Does not leak internal permissions, role keys, or sensitive backend error traces.

### 3.6 Dynamic Sidebar Navigation (`AppSidebar`)
Location: [`apps/admin-web/components/layout/app-sidebar.tsx`](file:///D:/Mobility/apps/admin-web/components/layout/app-sidebar.tsx)
Navigation items define required permission tokens and are filtered dynamically:
- **Employees**: `employee.read`
- **Vehicles**: `vehicle.read`
- **Drivers**: `driver.read`
- **Bookings**: `booking.read`
- **Trips**: `trip.read`
- **Dispatch**: `trip.dispatch`
- **Members**: `company.members.read`
- **Settings**: `company.settings.read`

---

## 4. Multi-Tenant Reactive Company Context

When a user switches between companies in the application header:
1. `CompanyProvider` in `lib/company/company-context.tsx` updates `activeCompany` state and persists to `localStorage`.
2. `usePermissions()` hook receives the updated company context immediately.
3. Effective permissions are recomputed synchronously.
4. All `PermissionGate`, `RouteGuard`, and `AppSidebar` components instantly reflect the new tenant's role without requiring a full page reload or stale permission state.

---

## 5. Backend Authoritative Security Boundary

The frontend permission system is strictly for User Experience. The backend continues to enforce mandatory multi-tier protection:
- `JwtAuthGuard`: Validates cryptographic bearer token signatures and revocations.
- `TenantGuard`: Enforces company tenancy isolation and checks membership via database relation `userCompanies`.
- `CompanyRolesGuard`: Enforces role hierarchy on critical endpoints.
- Direct API calls with unauthorized tokens (e.g. Customer creating a vehicle or deleting a vehicle) receive `403 Forbidden` responses directly from the API gateway.

---

## 6. Verification Results

### 6.1 Automated E2E RBAC Test Results
Executed across all 8 user personas against live backend (`http://localhost:4000`) and web server (`http://localhost:3000`):

| Persona | Email | Expected Behavior | Result |
| :--- | :--- | :--- | :---: |
| **SUPER_ADMIN** | `superadmin@aimos.dev` | Wildcard `['*']`, 100% navigation items visible, all actions permitted. | **PASSED** |
| **OWNER** | `owner@aimos.dev` | Company admin, vehicle/employee create & delete, trip dispatch permitted. | **PASSED** |
| **ADMIN** | `admin@aimos.dev` | Company operations, vehicle create, driver create, trip dispatch permitted. | **PASSED** |
| **MANAGER** | `manager@aimos.dev` | Vehicle create & update permitted; delete operations **strictly denied**. | **PASSED** |
| **DISPATCHER** | `dispatcher@aimos.dev` | Dispatch board, trips, bookings, vehicles/drivers visible; employee admin **hidden**. | **PASSED** |
| **ACCOUNTANT** | `accountant@aimos.dev` | Bookings, trips visible; fleet delete and dispatch **strictly denied & hidden**. | **PASSED** |
| **DRIVER** | `driver@aimos.dev` | Trips, duty toggle, vehicle read permitted; employee management **hidden & denied**. | **PASSED** |
| **CUSTOMER** | `customer@aimos.dev` | Bookings read/create/cancel permitted; internal fleet & dispatch **hidden & denied**. | **PASSED** |

**Total RBAC Assertions**: 71 Passed, 0 Failed.

### 6.2 Monorepo Verification Matrix

| Verification Step | Command | Result | Details |
| :--- | :--- | :---: | :--- |
| **TypeScript Validation** | `pnpm typecheck` | **PASSED** | 9 packages in scope, 0 type errors. |
| **Unit & Integration Tests** | `pnpm test` | **PASSED** | 7 test suites, 82 total tests passing. |
| **Production Build** | `pnpm build` | **PASSED** | All Next.js routes compiled (13 static/dynamic routes). |

---

## 7. Known Limitations & Future Improvements
1. **Fine-Grained Custom Roles**: Current matrix maps platform and tenant roles (`OWNER`, `ADMIN`, `MANAGER`, etc.). Future extensions in Module 8B can introduce tenant-configurable custom role definitions.
2. **Real-time Role Invalidation**: WebSocket / SSE channel to instantly broadcast permission downgrades to active web sessions if an administrator revokes permissions mid-session.
