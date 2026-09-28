# Folder Structure

```
ai-mos/
├── apps/
│   ├── admin-web/          # Next.js 14 Admin Dashboard
│   │   ├── app/            # App Router pages
│   │   ├── components/     # React components
│   │   └── lib/            # Utility functions
│   │
│   └── backend-api/        # NestJS REST API
│       └── src/
│           ├── modules/
│           │   ├── config/     # @nestjs/config + Zod env validation
│           │   ├── logger/     # nestjs-pino structured logging
│           │   ├── database/   # Prisma service
│           │   ├── cache/      # ioredis cache service
│           │   ├── queue/      # BullMQ queue module
│           │   ├── health/     # Live/Ready health endpoints
│           │   └── common/     # Metrics controller
│           └── common/
│               ├── filters/    # Global exception filter
│               └── middleware/ # Request ID correlation
│
├── packages/
│   ├── config/             # Shared TS/ESLint configs
│   ├── types/              # Shared TypeScript types
│   ├── constants/          # Platform-wide constants
│   ├── utils/              # Generic utility functions
│   ├── validation/         # Zod schemas + helpers
│   ├── database/           # Prisma schema + client singleton
│   ├── api-client/         # Typed Axios client base
│   └── ui/                 # shadcn/ui component library
│
├── docker/
│   ├── postgres/           # PostgreSQL init scripts
│   └── redis/              # Redis configuration
│
├── docs/                   # Documentation
│   └── ADR/                # Architecture Decision Records
│
├── scripts/                # Development scripts
│
├── .github/
│   └── workflows/          # CI/CD pipelines
│       ├── lint.yml
│       ├── build.yml
│       └── test.yml
│
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── .env.example
```
