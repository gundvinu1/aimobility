# ADR-004: Next.js App Router for Admin Web

**Date**: 2026-09-28  
**Status**: Accepted

## Context

Need a React framework for the admin dashboard.

## Decision

Use **Next.js 14 with App Router**.

## Consequences

✅ Server Components reduce client bundle size  
✅ Built-in routing, layouts, and loading states  
✅ First-class TypeScript support  
✅ Image optimization built-in  
⚠️ App Router requires 'use client' directive for interactive components
