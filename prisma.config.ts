// Prisma 7 configuration file
// Manages database connection URLs and migration settings
// In Prisma 7, datasource.url must be configured here (not in schema.prisma)
import 'dotenv/config';
import { resolve } from 'path';
import { defineConfig, env } from 'prisma/config';

// Load .env.local first (Next.js convention), then fall back to .env
// Note: dotenv/config already loaded above, but we ensure both files are checked
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Seed command - uses dotenv-cli to load .env.local before running
    seed: 'npx dotenv-cli -e .env.local -- npx tsx prisma/seed.ts',
  },
  // In Prisma 7, datasource URL must be configured here
  datasource: {
    url: env('DATABASE_URL'),
  },
});
