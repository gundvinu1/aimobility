import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  API_URL: z.string().default('http://localhost:4000'),
  WEB_URL: z.string().default('http://localhost:3000'),
  // JWT placeholders - will be validated strictly when auth module is added
  JWT_SECRET: z.string().default('placeholder-change-in-auth-module'),
  JWT_REFRESH_SECRET: z.string().default('placeholder-change-in-auth-module'),
});

export type Env = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`❌ Invalid environment variables:\n${errors}\n\nSee .env.example for reference.`);
  }
  return result.data;
}
