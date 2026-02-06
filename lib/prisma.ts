// Prisma Client singleton
// Prevents multiple instances in development (hot reload)

// Load environment variables FIRST (before importing PrismaClient)
// This ensures DATABASE_URL is available when PrismaClient is instantiated
// Required for seed scripts and standalone scripts that don't use Next.js env loading
if (!process.env.DATABASE_URL) {
  try {
    // Use require for synchronous loading (works in both CommonJS and ESM via tsx)
    // eslint-disable-next-line
    const dotenv = require('dotenv');
    // eslint-disable-next-line
    const path = require('path');
    // Try .env.local first (Next.js convention), then .env
    dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
    if (!process.env.DATABASE_URL) {
      dotenv.config({ path: path.resolve(process.cwd(), '.env') });
    }
  } catch (e) {
    // dotenv not available, assume env vars are set externally (e.g., by dotenv-cli)
  }
}

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma Client automatically reads DATABASE_URL from process.env
// We read it directly here (instead of using env.DATABASE_URL from lib/env.ts)
// to allow database operations to work independently even if other env vars
// (Clerk, OpenAI, etc.) aren't configured yet.
// This is intentional and production-ready - no need to change.
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not set in environment variables.\n' +
      'Please ensure .env.local contains DATABASE_URL or set it in your environment.'
  );
}

function createPrismaClient(): PrismaClient {
  // In Prisma 7, we must use an adapter for database connections
  // Create PostgreSQL adapter with the connection string
  const adapter = new PrismaPg({ connectionString: databaseUrl });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
  });
}

// Prisma Client requires adapter in Prisma 7
// Only create a new client if one doesn't exist in the global scope
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
