// scripts/check-and-migrate.ts
// Script to check migration status and only run migrate deploy if needed
// This prevents timeout issues when migrations are already applied
// Usage: npx tsx scripts/check-and-migrate.ts

import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

try {
  // Check migration status first
  console.log('🔍 Checking migration status...');
  const statusOutput = execSync('npx prisma migrate status', {
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  // If migrations are up to date, skip deploy
  if (statusOutput.includes('Database schema is up to date')) {
    console.log('✅ Database schema is up to date. Skipping migrate deploy.');
    process.exit(0);
  }

  // If migrations are pending, run deploy
  console.log('📦 Migrations pending. Running migrate deploy...');
  execSync('npx prisma migrate deploy', {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  console.log('✅ Migrations applied successfully.');
} catch (error: any) {
  // If migrate status fails, try running migrate deploy anyway
  // (might be a connection issue, not a migration issue)
  if (error.message?.includes('migrate status')) {
    console.log('⚠️  Could not check migration status. Running migrate deploy anyway...');
    try {
      execSync('npx prisma migrate deploy', {
        encoding: 'utf-8',
        stdio: 'inherit',
      });
      console.log('✅ Migrations applied successfully.');
    } catch (deployError) {
      console.error('❌ Migration deploy failed:', deployError);
      process.exit(1);
    }
  } else {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}


