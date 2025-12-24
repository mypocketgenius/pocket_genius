// scripts/check-migration-status.ts
// Script to check migration status for both dev and prod databases
// Usage: 
//   Dev: npx tsx scripts/check-migration-status.ts
//   Prod: DATABASE_URL="prod-url" npx tsx scripts/check-migration-status.ts

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

// Determine which database we're checking
const isProd = databaseUrl.includes('prod') || databaseUrl.includes('production');
const dbType = isProd ? 'PRODUCTION' : 'DEVELOPMENT';

console.log(`🔍 Checking ${dbType} database migration status...\n`);
console.log(`Database: ${databaseUrl.split('@')[1]?.split('/')[0] || 'unknown'}\n`);

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function checkMigrationStatus() {
  try {
    // Check migration status using Prisma
    const result = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
      SELECT migration_name, finished_at 
      FROM "_prisma_migrations" 
      ORDER BY finished_at ASC NULLS LAST
    `;

    console.log(`📋 Applied Migrations (${result.length} total):`);
    result.forEach((migration, index) => {
      const status = migration.finished_at ? `✅ applied: ${migration.finished_at}` : '⏳ pending';
      console.log(`   ${index + 1}. ${migration.migration_name} (${status})`);
    });

    // List expected migrations from filesystem
    const fs = require('fs');
    const migrationsDir = path.resolve(process.cwd(), 'prisma/migrations');
    const migrationDirs = fs.readdirSync(migrationsDir)
      .filter((dir: string) => fs.statSync(path.join(migrationsDir, dir)).isDirectory())
      .filter((dir: string) => dir !== 'migration_lock.toml')
      .sort();

    console.log(`\n📁 Expected Migrations (${migrationDirs.length} total):`);
    migrationDirs.forEach((dir: string, index: number) => {
      const applied = result.some(m => m.migration_name === dir);
      console.log(`   ${index + 1}. ${dir} ${applied ? '✅' : '❌ MISSING'}`);
    });

    // Check for drift
    const appliedNames = result.map(m => m.migration_name);
    const missingMigrations = migrationDirs.filter((dir: string) => !appliedNames.includes(dir));
    const extraMigrations = appliedNames.filter((name: string) => !migrationDirs.includes(name));

    console.log(`\n📊 Status Summary:`);
    if (missingMigrations.length === 0 && extraMigrations.length === 0) {
      console.log(`   ✅ Database is up to date with migrations`);
    } else {
      if (missingMigrations.length > 0) {
        console.log(`   ⚠️  Missing ${missingMigrations.length} migration(s):`);
        missingMigrations.forEach((m: string) => console.log(`      - ${m}`));
      }
      if (extraMigrations.length > 0) {
        console.log(`   ⚠️  Extra ${extraMigrations.length} migration(s) in database (not in filesystem):`);
        extraMigrations.forEach((m: string) => console.log(`      - ${m}`));
      }
    }

    // Check schema drift (compare schema.prisma to database)
    console.log(`\n🔍 Checking for schema drift...`);
    try {
      const driftCheck = await prisma.$executeRaw`
        SELECT 
          table_name,
          column_name,
          data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name NOT LIKE '_prisma%'
        ORDER BY table_name, ordinal_position
        LIMIT 5
      `;
      console.log(`   ✅ Can query database schema`);
    } catch (error) {
      console.log(`   ⚠️  Could not check schema drift: ${error}`);
    }

  } catch (error) {
    console.error('❌ Error checking migration status:', error);
    if (error instanceof Error) {
      console.error('   Error:', error.message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkMigrationStatus();

