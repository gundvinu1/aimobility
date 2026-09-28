# AI-MOS — AI Mobility Operating System

> Enterprise SaaS Platform for Mobility Businesses

## Overview

AI-MOS is a multi-tenant enterprise platform designed for mobility businesses including car rental companies, fleet operators, corporate transportation, and more.

**Current Status**: 🏗️ Foundation Phase

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy env file
cp .env.example .env

# Start infrastructure (PostgreSQL + Redis)
docker-compose up -d

# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Start development
pnpm dev
```

## Applications

| App | URL | Description |
|-----|-----|-------------|
| Admin Web | http://localhost:3000 | Next.js 14 Admin Dashboard |
| Backend API | http://localhost:4000 | NestJS REST API |
| Swagger Docs | http://localhost:4000/api/v1/docs | API Documentation |

## Health Checks

```bash
# Liveness
curl http://localhost:4000/api/v1/health/live

# Readiness
curl http://localhost:4000/api/v1/health/ready

# Metrics
curl http://localhost:4000/api/v1/metrics
```

## Commands

```bash
pnpm dev        # Start all apps
pnpm build      # Build all
pnpm lint       # Lint all
pnpm typecheck  # Type check all
pnpm test       # Run tests
pnpm format     # Format code
pnpm clean      # Clean builds
```

## Technology Stack

- **Runtime**: Node.js 20 LTS
- **Package Manager**: pnpm 9
- **Build System**: Turborepo
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
- **Backend**: NestJS + Prisma 5 + PostgreSQL 16
- **Cache/Queue**: Redis 7 + BullMQ
- **Language**: TypeScript (strict mode)

## Documentation

See [docs/](./docs/) for full documentation.

## License

Proprietary — All Rights Reserved
