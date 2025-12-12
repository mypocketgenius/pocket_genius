// lib/env.ts
// Type-safe environment variable validation using Zod
// Catches missing/invalid env vars at build time (not runtime)
// Provides TypeScript autocomplete and prevents "undefined" errors in production
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  OPENAI_API_KEY: z.string().min(1),
  PINECONE_API_KEY: z.string().min(1),
  PINECONE_INDEX: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SECRET: z.string().min(1).optional(),
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
  NEXT_PUBLIC_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Sentry (optional - only needed for error monitoring)
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(),
});

// Parse and validate environment variables
// Throws descriptive error if any required env vars are missing or invalid
function getEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('\n');
      throw new Error(
        `❌ Invalid or missing environment variables:\n${missingVars}\n\n` +
          `Please check your .env.local file and ensure all required variables are set.`
      );
    }
    throw error;
  }
}

export const env = getEnv();

// Usage:
// import { env } from '@/lib/env';
// const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
//
// Note: lib/prisma.ts currently reads DATABASE_URL directly from process.env
// instead of using env.DATABASE_URL. This is intentional to allow testing
// before all environment variables are configured. Once all env vars are set up,
// you can optionally update lib/prisma.ts to use the type-safe env object.
