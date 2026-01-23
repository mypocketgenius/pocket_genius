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

  // Check for failed migrations and resolve them
  if (statusOutput.includes('failed')) {
    console.log('⚠️  Found failed migration(s). Attempting to resolve...');
    // Extract failed migration name from status output
    const failedMatch = statusOutput.match(/The `(\d+_\w+)` migration.*failed/);
    if (failedMatch) {
      const failedMigration = failedMatch[1];
      console.log(`🔧 Marking migration "${failedMigration}" as rolled back...`);
      execSync(`npx prisma migrate resolve --rolled-back "${failedMigration}"`, {
        encoding: 'utf-8',
        stdio: 'inherit',
      });
      console.log('✅ Failed migration resolved.');
    }
  }

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
  const errorMessage = error.message || error.toString();
  const errorOutput = error.stdout || error.stderr || '';

  // Check if this is a connection error (P1001)
  const isConnectionError =
    errorMessage.includes('P1001') ||
    errorMessage.includes("Can't reach database server") ||
    errorMessage.includes('connect ECONNREFUSED') ||
    errorMessage.includes('timeout') ||
    errorOutput.includes('P1001');

  if (isConnectionError) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ DATABASE CONNECTION FAILED');
    console.error('='.repeat(70));
    console.error('\n🔍 This error typically occurs when:');
    console.error('   • Your network blocks port 5432 (PostgreSQL)');
    console.error('   • Common on university/corporate WiFi');
    console.error('   • DNS works, HTTPS works, but PostgreSQL port is blocked\n');

    console.error('💡 QUICK FIXES:\n');
    console.error('1. Connect to VPN, then retry: npm run build');
    console.error('2. Switch to mobile hotspot, then retry: npm run build');
    console.error('3. Run diagnostic: npx tsx scripts/test-db-connection.ts\n');

    console.error('📚 For detailed solutions, see: NETWORK_CONNECTION_TROUBLESHOOTING.md');
    console.error('='.repeat(70) + '\n');
  }

  // Check for failed migrations (P3009) in the error output
  const hasFailedMigration =
    errorMessage.includes('P3009') ||
    errorOutput.includes('P3009') ||
    errorMessage.includes('failed migrations') ||
    errorOutput.includes('failed migrations');

  if (hasFailedMigration) {
    console.log('⚠️  Found failed migration(s) in database. Attempting to resolve...');

    // Extract failed migration name from error output
    const failedMatch = (errorMessage + errorOutput).match(/The `([^`]+)` migration.*failed/);
    if (failedMatch) {
      const failedMigration = failedMatch[1];
      console.log(`🔧 Marking migration "${failedMigration}" as rolled back...`);
      try {
        execSync(`npx prisma migrate resolve --rolled-back "${failedMigration}"`, {
          encoding: 'utf-8',
          stdio: 'inherit',
        });
        console.log('✅ Failed migration marked as rolled back.');

        // Now retry migrate deploy
        console.log('📦 Retrying migrate deploy...');
        execSync('npx prisma migrate deploy', {
          encoding: 'utf-8',
          stdio: 'inherit',
        });
        console.log('✅ Migrations applied successfully.');
        process.exit(0);
      } catch (resolveError: any) {
        console.error('❌ Failed to resolve migration:', resolveError.message);
        process.exit(1);
      }
    } else {
      console.error('❌ Could not extract failed migration name from error.');
      console.error('   Please manually resolve in Neon SQL Editor:');
      console.error('   DELETE FROM "_prisma_migrations" WHERE applied_steps_count = 0;');
      process.exit(1);
    }
  }

  // If migrate status fails, try running migrate deploy anyway
  // (might be a connection issue, not a migration issue)
  if (errorMessage?.includes('migrate status') && !isConnectionError) {
    console.log('⚠️  Could not check migration status. Running migrate deploy anyway...');
    try {
      execSync('npx prisma migrate deploy', {
        encoding: 'utf-8',
        stdio: 'inherit',
      });
      console.log('✅ Migrations applied successfully.');
    } catch (deployError: any) {
      const deployMessage = deployError.message || deployError.toString();
      const deployOutput = deployError.stdout || deployError.stderr || '';
      const isDeployConnectionError =
        deployMessage.includes('P1001') ||
        deployMessage.includes("Can't reach database server") ||
        deployOutput.includes('P1001');

      if (isDeployConnectionError) {
        console.error('\n' + '='.repeat(70));
        console.error('❌ DATABASE CONNECTION FAILED');
        console.error('='.repeat(70));
        console.error('\n💡 QUICK FIXES:\n');
        console.error('1. Connect to VPN, then retry: npm run build');
        console.error('2. Switch to mobile hotspot, then retry: npm run build');
        console.error('3. Run diagnostic: npx tsx scripts/test-db-connection.ts\n');
        console.error('📚 For detailed solutions, see: NETWORK_CONNECTION_TROUBLESHOOTING.md');
        console.error('='.repeat(70) + '\n');
      } else {
        console.error('❌ Migration deploy failed:', deployError);
      }
      process.exit(1);
    }
  } else {
    if (!isConnectionError) {
      console.error('❌ Error:', errorMessage);
    }
    process.exit(1);
  }
}





