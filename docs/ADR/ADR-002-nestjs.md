# ADR-002: NestJS for Backend API

**Date**: 2026-09-28  
**Status**: Accepted

## Context

Need a Node.js backend framework for a complex, modular enterprise API.

## Decision

Use **NestJS** with modular architecture.

## Consequences

✅ Built-in DI container ideal for enterprise complexity  
✅ Decorator-based routing aligns with TypeScript  
✅ First-class Swagger/OpenAPI support  
✅ Excellent testing infrastructure  
⚠️ Requires `emitDecoratorMetadata: true` in TypeScript config
