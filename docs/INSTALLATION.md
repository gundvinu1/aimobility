# Installation Guide

## Prerequisites

- Node.js >= 20 LTS
- pnpm 9 (`npm install -g pnpm@9`)
- Docker Desktop (for PostgreSQL and Redis)
- Git

## Quick Start

### 1. Clone and install

```bash
git clone <repository-url>
cd ai-mos
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Start infrastructure

```bash
docker-compose up -d
```

Wait for services to be healthy:

```bash
docker-compose ps
```

### 4. Generate Prisma client

```bash
pnpm db:generate
```

### 5. Run database migrations

```bash
pnpm db:migrate
```

### 6. Start development servers

```bash
pnpm dev
```

This starts:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **Swagger Docs**: http://localhost:4000/api/v1/docs

## Verify Installation

```bash
# Health checks
curl http://localhost:4000/api/v1/health/live
curl http://localhost:4000/api/v1/health/ready

# Frontend
open http://localhost:3000/dashboard
```
