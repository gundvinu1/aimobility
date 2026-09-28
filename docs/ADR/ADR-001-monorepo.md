# ADR-001: Monorepo with Turborepo and pnpm

**Date**: 2026-09-28  
**Status**: Accepted

## Context

AI-MOS is a multi-app platform requiring code sharing between admin web, backend API, and future apps (driver-app, customer-app). We need a strategy for managing shared code.

## Decision

Use a **pnpm workspace monorepo** managed by **Turborepo** for build orchestration.

## Consequences

✅ Shared packages (types, utils, ui) consumed directly without publishing  
✅ Turborepo provides caching and parallelism  
✅ Single `pnpm install` installs everything  
⚠️ Slightly more complex than independent repos  
⚠️ All apps must be Node.js compatible
