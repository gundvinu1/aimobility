# ADR-003: Prisma as ORM

**Date**: 2026-09-28  
**Status**: Accepted

## Context

Need a database access layer for PostgreSQL 16 with type safety.

## Decision

Use **Prisma 5** as the ORM.

## Consequences

✅ Type-safe database queries  
✅ Schema-first approach with migrations  
✅ Excellent developer experience with Prisma Studio  
✅ Auto-generated TypeScript types  
⚠️ Slightly less flexible than raw SQL for complex queries  
⚠️ Generated client must be re-generated after schema changes
