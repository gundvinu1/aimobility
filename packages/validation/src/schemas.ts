// =============================================================================
// Common Zod Schemas
// =============================================================================

import { z } from 'zod';

/** UUID schema */
export const uuidSchema = z.string().uuid({ message: 'Must be a valid UUID' });

/** Non-empty string schema */
export const nonEmptyStringSchema = z.string().min(1, { message: 'Must not be empty' }).trim();

/** Email schema */
export const emailSchema = z.string().email({ message: 'Must be a valid email address' }).toLowerCase();

/** URL schema */
export const urlSchema = z.string().url({ message: 'Must be a valid URL' });

/** Positive integer schema */
export const positiveIntSchema = z.number().int().positive({ message: 'Must be a positive integer' });

/** ISO date string schema */
export const isoDateStringSchema = z.string().datetime({ message: 'Must be a valid ISO 8601 date' });

/** Pagination query schema */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/** Environment variable schema helper */
export const environmentSchema = z.enum(['development', 'staging', 'production', 'test']);
