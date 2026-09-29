# AI-MOS — Local Development Guide

> **AI Mobility Operating System** · Enterprise SaaS Platform for Mobility Businesses
>
> This guide takes you from a blank machine to a fully-running local development environment, step by step.

---

## Table of Contents

1. [What is AI-MOS?](#1-what-is-ai-mos)
2. [Architecture Overview](#2-architecture-overview)
3. [Prerequisites — Install Everything First](#3-prerequisites--install-everything-first)
4. [Clone the Repository](#4-clone-the-repository)
5. [Set Up Environment Variables](#5-set-up-environment-variables)
6. [Start Docker Services (PostgreSQL + Redis)](#6-start-docker-services-postgresql--redis)
7. [Install Node Dependencies](#7-install-node-dependencies)
8. [Set Up the Database](#8-set-up-the-database)
9. [Run the Backend API](#9-run-the-backend-api)
10. [Run the Frontend Dashboard](#10-run-the-frontend-dashboard)
11. [Verify Everything Works](#11-verify-everything-works)
12. [Complete Quick-Start (All Steps Combined)](#12-complete-quick-start-all-steps-combined)
13. [Project Structure](#13-project-structure)
14. [Available URLs](#14-available-urls)
15. [Common Commands Reference](#15-common-commands-reference)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. What is AI-MOS?

AI-MOS is a multi-tenant enterprise SaaS platform for mobility businesses including:

- 🚗 Car rental companies
- 🚌 Fleet operators
- 🏨 Hotels and travel agencies
- ✈️ Airport transfer services
- 🏢 Corporate transportation

**Current Modules:**
| # | Module | Status |
|---|--------|--------|
| 1 | Foundation (infrastructure, DB, cache, queues) | ✅ Complete |
| 2 | Authentication + RBAC (users, roles, JWT, sessions) | ✅ Complete |
| 3–17 | Company, Fleet, Booking, Billing, AI, etc. | 🔜 Coming |

---

## 2. Architecture Overview

```
ai-mos/  (pnpm monorepo)
├── apps/
│   ├── backend-api/        ← NestJS REST API  (port 4000)
│   └── admin-web/          ← Next.js 14 Dashboard (port 3000)
│
├── packages/
│   ├── database/           ← Prisma schema + migrations + seed
│   ├── types/              ← Shared TypeScript types
│   ├── constants/          ← Platform-wide constants
│   ├── validation/         ← Shared Zod schemas
│   ├── utils/              ← Utility functions
│   ├── api-client/         ← Typed Axios HTTP client
│   ├── ui/                 ← shadcn/ui component library
│   └── config/             ← Shared ESLint/TypeScript configs
│
└── docker-compose.yml      ← PostgreSQL 16 + Redis 7
```

**Tech Stack:**

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 10, TypeScript 5 |
| Database | PostgreSQL 16 (via Prisma 5 ORM) |
| Cache / Queues | Redis 7, BullMQ |
| Auth | Passport + JWT (access 15m) + opaque refresh tokens (7d) |
| Password Hashing | Argon2id |
| Frontend | Next.js 14 App Router, Tailwind CSS, shadcn/ui |
| Package Manager | pnpm 9 (workspaces) |
| Container | Docker + Docker Compose |

---

## 3. Prerequisites — Install Everything First

Install these tools **in order** before doing anything else.

### 3.1 — Node.js (v20 LTS)

> Required: **Node.js 20 or higher**

1. Go to https://nodejs.org
2. Download **Node.js 20 LTS**
3. Run the installer (accept defaults)
4. Verify:
   ```bash
   node --version    # should print v20.x.x or higher
   npm --version     # should print 10.x or higher
   ```

### 3.2 — pnpm (Package Manager)

> AI-MOS uses `pnpm` (not `npm` or `yarn`) for monorepo workspace support.

```bash
npm install -g pnpm@9
pnpm --version    # should print 9.x.x
```

### 3.3 — Docker Desktop

> Docker runs PostgreSQL and Redis locally — no manual database installation needed.

1. Go to https://www.docker.com/products/docker-desktop
2. Download **Docker Desktop** for your OS (Windows / macOS / Linux)
3. Install and launch Docker Desktop
4. Wait for it to fully start (the whale icon in the taskbar turns solid)
5. Verify:
   ```bash
   docker --version            # e.g. Docker version 24.x.x
   docker compose version      # e.g. Docker Compose version v2.x.x
   ```

   > ⚠️ **Windows users:** Make sure WSL 2 backend is enabled in Docker Desktop settings.

### 3.4 — Git

1. Go to https://git-scm.com
2. Download and install Git
3. Verify:
   ```bash
   git --version    # e.g. git version 2.x.x
   ```

### 3.5 — (Optional but recommended) VS Code

1. Go to https://code.visualstudio.com
2. Install the **ESLint**, **Prisma**, and **Tailwind CSS IntelliSense** extensions

---

## 4. Clone the Repository

```bash
# Clone the repo
git clone https://github.com/your-org/ai-mos.git

# Enter the project
cd ai-mos
```

> Replace `your-org/ai-mos` with the actual GitHub URL.

---

## 5. Set Up Environment Variables

The project uses a single root `.env` file.

### 5.1 — Copy the example file

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env
```

### 5.2 — Open `.env` and fill in values

The file already has **development defaults** that work out of the box with the Docker setup below. You only need to change anything if you're customising ports or using external services.

```env
# ─── Server ─────────────────────────────────────────────
NODE_ENV=development
PORT=4000
API_URL=http://localhost:4000
WEB_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000

# ─── Database (Docker PostgreSQL) ────────────────────────
DATABASE_URL=postgresql://aimosuser:aimospassword@localhost:5432/aimosdb?schema=public

# ─── Redis (Docker Redis) ─────────────────────────────────
REDIS_URL=redis://localhost:6379

# ─── JWT — Access Token (short-lived: 15 minutes) ────────
JWT_ACCESS_SECRET=dev-access-secret-change-this-in-production-must-be-32-chars
JWT_ACCESS_EXPIRES_IN=15m

# ─── JWT — Refresh Token (long-lived: 7 days) ─────────────
JWT_REFRESH_SECRET=dev-refresh-secret-change-this-in-production-must-be-32-chars
JWT_REFRESH_EXPIRES_IN=7d

# ─── Frontend ─────────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:4000
```

> ⚠️ **Security:** The JWT secrets above are for local development only. **Never** use them in production. Generate strong secrets with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
> ```

---

## 6. Start Docker Services (PostgreSQL + Redis)

AI-MOS requires PostgreSQL 16 and Redis 7. Docker Compose starts both with one command.

```bash
# Start PostgreSQL + Redis in the background
docker compose up -d
```

**Verify they are running:**

```bash
docker compose ps
```

You should see output like:

```
NAME              IMAGE           STATUS          PORTS
ai-mos-postgres   postgres:16     Up              0.0.0.0:5432->5432/tcp
ai-mos-redis      redis:7-alpine  Up              0.0.0.0:6379->6379/tcp
```

**Test the connections:**

```bash
# Test PostgreSQL
docker exec ai-mos-postgres pg_isready -U aimosuser -d aimosdb
# Expected: localhost:5432 - accepting connections

# Test Redis
docker exec ai-mos-redis redis-cli ping
# Expected: PONG
```

> 💡 To stop the services later: `docker compose down`
> 💡 To stop AND wipe all data: `docker compose down -v`

---

## 7. Install Node Dependencies

```bash
# From the project root — installs ALL packages in the monorepo
pnpm install
```

This installs dependencies for:
- `apps/backend-api` (NestJS)
- `apps/admin-web` (Next.js)
- All packages in `packages/`

> ⏱️ First-time install may take 2–3 minutes.

---

## 8. Set Up the Database

### 8.1 — Run Migrations

This creates all tables in PostgreSQL from the Prisma schema.

```bash
cd packages/database
$env:DATABASE_URL="postgresql://aimosuser:aimospassword@localhost:5432/aimosdb?schema=public"
node_modules/.bin/prisma migrate dev
cd ../..
```

**macOS / Linux:**
```bash
cd packages/database
DATABASE_URL="postgresql://aimosuser:aimospassword@localhost:5432/aimosdb?schema=public" \
  npx prisma migrate dev
cd ../..
```

You should see:
```
✔ Applied migration `20260928171325_auth_module`
Your database is now in sync with your schema.
```

### 8.2 — Run the Seed

This creates the platform roles and permissions (SUPER_ADMIN, OWNER, ADMIN, MANAGER, etc.).

```bash
# Windows (PowerShell)
cd packages/database
$env:DATABASE_URL="postgresql://aimosuser:aimospassword@localhost:5432/aimosdb?schema=public"
node_modules/.bin/ts-node prisma/seed.ts
cd ../..
```

**macOS / Linux:**
```bash
cd packages/database
DATABASE_URL="postgresql://aimosuser:aimospassword@localhost:5432/aimosdb?schema=public" \
  npx ts-node prisma/seed.ts
cd ../..
```

Expected output:
```
🌱 Starting Module 2 seed...
  ✅ Role: SUPER_ADMIN
  ✅ Role: OWNER
  ...
  ✅ Permission: user.read
  ...
✅ Module 2 seed complete.
   Roles:       8
   Permissions: 9
```

---

## 9. Run the Backend API

```bash
# From the project root
cd apps/backend-api
pnpm run dev
```

Or from the root using the workspace script:
```bash
pnpm --filter @ai-mos/backend-api run dev
```

**Expected startup output:**
```
🚀 AI-MOS Backend running on http://localhost:4000
📚 Swagger docs: http://localhost:4000/api/docs
❤️  Health: http://localhost:4000/api/v1/health/live
✅ Database connection established
✅ Redis connection established
```

> The backend uses `ts-node` in dev mode with hot-reload via NestJS CLI.

---

## 10. Run the Frontend Dashboard

Open a **new terminal window/tab** (keep the backend running).

```bash
# From the project root
cd apps/admin-web
pnpm run dev
```

Or:
```bash
pnpm --filter @ai-mos/admin-web run dev
```

**Expected output:**
```
▲ Next.js 14.x.x
- Local:    http://localhost:3000
- Network:  http://192.168.x.x:3000
✓ Ready in 2.3s
```

---

## 11. Verify Everything Works

Open a new terminal and run these checks:

```bash
# 1. Backend health - liveness
curl http://localhost:4000/api/v1/health/live
# Expected: {"status":"ok","timestamp":"...","uptime":...}

# 2. Backend health - readiness (checks DB + Redis)
curl http://localhost:4000/api/v1/health/ready
# Expected: {"status":"ok","checks":{"database":...,"redis":...}}

# 3. Register a test user
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!","firstName":"Test","lastName":"User"}'
# Expected: {"user":{"id":"...","email":"test@example.com","roles":["CUSTOMER"],...},...}

# 4. Frontend dashboard
# Open http://localhost:3000 in your browser
```

**Windows PowerShell equivalent:**
```powershell
# Health check
Invoke-RestMethod "http://localhost:4000/api/v1/health/live"

# Register user
Invoke-RestMethod -Method POST `
  -Uri "http://localhost:4000/api/v1/auth/register" `
  -ContentType "application/json" `
  -Body '{"email":"test@example.com","password":"TestPass123!","firstName":"Test","lastName":"User"}'
```

### Swagger API Docs

Open **http://localhost:4000/api/docs** in your browser to explore and test all API endpoints interactively.

---

## 12. Complete Quick-Start (All Steps Combined)

Copy-paste this entire block if you want to get running as fast as possible:

```bash
# 1. Clone
git clone https://github.com/your-org/ai-mos.git && cd ai-mos

# 2. Environment
cp .env.example .env

# 3. Docker
docker compose up -d

# 4. Dependencies
pnpm install

# 5. Database
cd packages/database
DATABASE_URL="postgresql://aimosuser:aimospassword@localhost:5432/aimosdb?schema=public" npx prisma migrate dev
DATABASE_URL="postgresql://aimosuser:aimospassword@localhost:5432/aimosdb?schema=public" npx ts-node prisma/seed.ts
cd ../..

# 6. Backend (terminal 1)
cd apps/backend-api && pnpm run dev

# 7. Frontend (terminal 2)
cd apps/admin-web && pnpm run dev
```

---

## 13. Project Structure

```
ai-mos/
│
├── .env                        ← Environment variables (DO NOT commit)
├── .env.example                ← Template for .env
├── docker-compose.yml          ← PostgreSQL 16 + Redis 7
├── package.json                ← Root workspace config
├── pnpm-workspace.yaml         ← pnpm workspace definition
│
├── apps/
│   ├── backend-api/            ← NestJS API server
│   │   ├── src/
│   │   │   ├── app.module.ts           ← Root module
│   │   │   ├── main.ts                 ← Entry point (port 4000)
│   │   │   └── modules/
│   │   │       ├── auth/               ← Auth + RBAC (Module 2)
│   │   │       │   ├── auth.service.ts
│   │   │       │   ├── auth.controller.ts
│   │   │       │   ├── auth.module.ts
│   │   │       │   ├── decorators/     ← @Public, @CurrentUser, @Roles, @Permissions
│   │   │       │   ├── dto/            ← Request validation
│   │   │       │   ├── guards/         ← JwtAuthGuard, RolesGuard, PermissionsGuard
│   │   │       │   ├── services/       ← PasswordService, TokenService, SessionService
│   │   │       │   └── strategies/     ← Passport JWT strategy
│   │   │       ├── database/           ← Prisma client wrapper
│   │   │       ├── cache/              ← Redis via ioredis
│   │   │       ├── queue/              ← BullMQ job queues
│   │   │       ├── health/             ← /health/live + /health/ready
│   │   │       ├── config/             ← Env validation (Zod)
│   │   │       ├── logger/             ← nestjs-pino structured logging
│   │   │       ├── common/             ← Exception filter, metrics
│   │   │       └── rate-limit/         ← Global throttler
│   │   └── package.json
│   │
│   └── admin-web/              ← Next.js 14 admin dashboard
│       ├── app/
│       │   ├── (auth)/                 ← Login, Register, Forgot/Reset password
│       │   └── (dashboard)/            ← Protected dashboard pages
│       ├── components/
│       │   ├── auth/                   ← Auth form components
│       │   └── layout/                 ← Sidebar, TopNav
│       ├── lib/
│       │   └── auth/                   ← AuthProvider, useRequireAuth
│       └── package.json
│
└── packages/
    ├── database/
    │   └── prisma/
    │       ├── schema.prisma           ← Database models
    │       ├── migrations/             ← Applied migrations (committed)
    │       └── seed.ts                 ← Roles + permissions seed
    ├── types/src/auth.ts               ← Shared auth TypeScript types
    ├── constants/src/auth.ts           ← ROLES, PERMISSIONS constants
    └── api-client/src/auth.client.ts   ← Typed auth API client
```

---

## 14. Available URLs

| URL | Description |
|-----|-------------|
| `http://localhost:3000` | Admin Dashboard (Next.js) |
| `http://localhost:3000/login` | Login page |
| `http://localhost:3000/register` | Register page |
| `http://localhost:4000` | Backend API root |
| `http://localhost:4000/api/docs` | **Swagger UI** — interactive API explorer |
| `http://localhost:4000/api/v1/health/live` | Liveness probe |
| `http://localhost:4000/api/v1/health/ready` | Readiness probe (checks DB + Redis) |
| `http://localhost:4000/api/v1/metrics` | Process metrics |
| `http://localhost:5432` | PostgreSQL (aimosuser / aimospassword) |
| `http://localhost:6379` | Redis |

---

## 15. Common Commands Reference

### Docker

```bash
docker compose up -d          # Start PostgreSQL + Redis
docker compose down           # Stop services (keep data)
docker compose down -v        # Stop services + delete data
docker compose ps             # Show running containers
docker compose logs postgres  # View PostgreSQL logs
docker compose logs redis     # View Redis logs
```

### pnpm — Install & Build

```bash
pnpm install                  # Install all dependencies (run from root)
pnpm build                    # Build all packages
pnpm --filter @ai-mos/backend-api build    # Build just the backend
pnpm --filter @ai-mos/admin-web build      # Build just the frontend
```

### pnpm — Development

```bash
# Backend (in apps/backend-api/)
pnpm run dev          # Start with hot-reload
pnpm run build        # Compile TypeScript → dist/
pnpm run test         # Run Jest unit tests
pnpm run typecheck    # Type-check only (no emit)
pnpm run lint         # ESLint

# Frontend (in apps/admin-web/)
pnpm run dev          # Start Next.js dev server
pnpm run build        # Production build
pnpm run typecheck    # Type-check only
```

### Database (run from `packages/database/`)

```bash
# Migrations
npx prisma migrate dev --name <name>    # Create + apply new migration
npx prisma migrate status               # Check migration status
npx prisma migrate deploy               # Apply all pending (production)

# Client generation
npx prisma generate                     # Regenerate Prisma client after schema changes

# Seeding
npx ts-node prisma/seed.ts             # Run idempotent seed

# GUI
npx prisma studio                       # Open Prisma Studio (http://localhost:5555)

# Reset (DANGER — wipes all data)
npx prisma migrate reset
```

### Testing

```bash
# From apps/backend-api/
pnpm run test                 # All tests
pnpm run test --watch         # Watch mode
pnpm run test --coverage      # Coverage report
pnpm run test -- --testPathPattern=auth   # Only auth tests
```

---

## 16. Troubleshooting

### ❌ `docker compose up` fails — port already in use

```bash
# Find what's using port 5432 (PostgreSQL)
netstat -ano | findstr :5432   # Windows
lsof -i :5432                  # macOS/Linux

# Or change the port in docker-compose.yml and .env DATABASE_URL
```

### ❌ `pnpm install` fails — "workspace not found"

Make sure you're running `pnpm install` from the **project root** (`ai-mos/`), not inside a subfolder.

### ❌ Backend fails to start — "Invalid environment variables"

```
❌ Invalid environment variables:
  JWT_ACCESS_SECRET: JWT_ACCESS_SECRET must be at least 32 characters
```

Open `.env` and make sure `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are filled in and at least 32 characters long.

### ❌ Prisma errors — "Environment variable not found: DATABASE_URL"

You must set `DATABASE_URL` when running Prisma commands from `packages/database/`:

```powershell
# Windows PowerShell
$env:DATABASE_URL="postgresql://aimosuser:aimospassword@localhost:5432/aimosdb?schema=public"
node_modules/.bin/prisma migrate dev
```

```bash
# macOS / Linux
DATABASE_URL="postgresql://aimosuser:aimospassword@localhost:5432/aimosdb?schema=public" npx prisma migrate dev
```

### ❌ Prisma generate fails — "EPERM: operation not permitted"

The backend is running and has locked the query engine DLL. Stop the backend first, run `prisma generate`, then restart the backend.

### ❌ `Cannot connect to Docker` error

Docker Desktop must be running. Check your system tray (Windows) or menu bar (macOS) for the Docker whale icon. If it's not running, launch Docker Desktop and wait ~30 seconds.

### ❌ Frontend shows 401 errors immediately

The access token lives in memory and is lost on page refresh. The frontend automatically tries to restore the session using the refresh token in `sessionStorage`. If you cleared browser storage, you need to log in again at `http://localhost:3000/login`.

### ❌ Port 4000 or 3000 already in use

```bash
# Kill whatever is on port 4000 (Windows)
netstat -ano | findstr :4000
taskkill /PID <PID> /F

# macOS / Linux
kill $(lsof -t -i:4000)
```

---

## Quick Reference Card

```
Prerequisite checklist:
  □ Node.js 20+       →  node --version
  □ pnpm 9+           →  pnpm --version
  □ Docker Desktop    →  docker --version
  □ Git               →  git --version

Start sequence:
  1.  docker compose up -d
  2.  pnpm install
  3.  (first time) prisma migrate dev + seed.ts
  4.  Terminal A: cd apps/backend-api  → pnpm run dev
  5.  Terminal B: cd apps/admin-web   → pnpm run dev

Key URLs:
  Dashboard  →  http://localhost:3000
  API Docs   →  http://localhost:4000/api/docs
  Health     →  http://localhost:4000/api/v1/health/live
```

---

> 📝 **This guide covers Modules 1 (Foundation) and 2 (Authentication + RBAC).**
> Additional setup steps will be added here as new modules are implemented.
