# AI-MOS — AI Mobility Operating System

> Enterprise SaaS Platform for Mobility Businesses

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org)
[![NestJS](https://img.shields.io/badge/NestJS-10-red)](https://nestjs.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-red)](https://redis.io)
[![pnpm](https://img.shields.io/badge/pnpm-9-orange)](https://pnpm.io)

---

## 📖 Documentation

| Doc | Description |
|-----|-------------|
| **[DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md)** | **← Start here — complete local setup guide** |
| [ENV_VARIABLES.md](./docs/ENV_VARIABLES.md) | All environment variables reference |
| [FOLDER_STRUCTURE.md](./docs/FOLDER_STRUCTURE.md) | Monorepo folder structure |

---

## ⚡ Quick Start

```bash
# 1. Clone & enter
git clone https://github.com/your-org/ai-mos.git && cd ai-mos

# 2. Copy env
cp .env.example .env

# 3. Start Docker services
docker compose up -d

# 4. Install dependencies
pnpm install

# 5. Set up database (first time only)
cd packages/database
DATABASE_URL="postgresql://aimosuser:aimospassword@localhost:5432/aimosdb?schema=public" npx prisma migrate dev
DATABASE_URL="postgresql://aimosuser:aimospassword@localhost:5432/aimosdb?schema=public" npx ts-node prisma/seed.ts
cd ../..

# 6. Run (two terminals)
cd apps/backend-api && pnpm run dev    # Terminal 1 → http://localhost:4000
cd apps/admin-web && pnpm run dev      # Terminal 2 → http://localhost:3000
```

> 📋 **Full step-by-step setup:** [docs/DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md)

---

## 🏗️ Platform Modules

| # | Module | Status |
|---|--------|--------|
| 1 | Foundation — Infrastructure, DB, Cache, Queues | ✅ Complete |
| 2 | Authentication + RBAC — Users, Roles, JWT, Sessions | ✅ Complete |
| 3 | Company Management | 🔜 Coming |
| 4 | Employee Management | 🔜 Coming |
| 5 | Vehicle / Fleet | 🔜 Coming |
| 6 | Driver | 🔜 Coming |
| 7 | Customer / CRM | 🔜 Coming |
| 8 | Booking | 🔜 Coming |
| 9 | Dispatch | 🔜 Coming |
| 10 | Trips + GPS | 🔜 Coming |
| 11 | Billing + Invoicing | 🔜 Coming |
| 12 | Notifications | 🔜 Coming |
| 13 | Reports + Analytics | 🔜 Coming |
| 14 | Customer App | 🔜 Coming |
| 15 | Driver App | 🔜 Coming |
| 16 | AI | 🔜 Coming |
| 17 | Marketplace | 🔜 Coming |

---

## 🗺️ Key URLs (when running locally)

| URL | Description |
|-----|-------------|
| http://localhost:3000 | Admin Dashboard |
| http://localhost:3000/login | Login |
| http://localhost:4000/api/docs | **Swagger API Docs** |
| http://localhost:4000/api/v1/health/live | Health check |

---

## 🛠️ Tech Stack

- **Backend:** NestJS 10 + TypeScript 5
- **Database:** PostgreSQL 16 via Prisma 5
- **Cache / Queues:** Redis 7 + BullMQ
- **Auth:** Passport + JWT (Argon2id)
- **Frontend:** Next.js 14 + Tailwind CSS + shadcn/ui
- **Monorepo:** pnpm workspaces
- **Containers:** Docker Compose
