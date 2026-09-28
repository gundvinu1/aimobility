// =============================================================================
// Validation Helper Utilities
// =============================================================================

import { z, ZodError, ZodSchema } from 'zod';

/** Validation result type */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Array<{ path: string; message: string }> };

/**
 * Validate data against a Zod schema and return a structured result
 */
export function validate<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: formatZodErrors(result.error),
  };
}

/**
 * Format Zod errors into a flat array of path + message pairs
 */
export function formatZodErrors(error: ZodError): Array<{ path: string; message: string }> {
  return error.errors.map((err) => ({
    path: err.path.join('.') || 'root',
    message: err.message,
  }));
}

/**
 * Create an environment variable parser using Zod
 */
export function createEnvParser<T extends z.ZodRawShape>(shape: T) {
  return {
    parse: (env: Record<string, string | undefined> = process.env as Record<string, string | undefined>): z.infer<z.ZodObject<T>> => {
      const schema = z.object(shape);
      return schema.parse(env);
    },
  };
}
