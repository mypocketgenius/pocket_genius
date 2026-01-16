// scripts/fix-migration-checksums.ts
// Script to fix Prisma migration checksum mismatches
// This happens when migration files are modified after being applied
// Usage: npx tsx scripts/fix-migration-checksums.ts [migration-name]

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

/**
 * Calculate SHA256 checksum of a file (matching Prisma's algorithm)
 */
function calculateChecksum(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function fixMigrationChecksums() {
  try {
    const migrationsDir = path.resolve(process.cwd(), 'prisma/migrations');
    
    // Get all migration directories
    const migrationDirs = fs.readdirSync(migrationsDir)
      .filter((dir: string) => {
        const fullPath = path.join(migrationsDir, dir);
        return fs.statSync(fullPath).isDirectory() && dir !== 'migration_lock.toml';
      })
      .sort();

    console.log('🔍 Checking migration checksums...\n');

    // Get applied migrations from database
    const appliedMigrations = await prisma.$queryRaw<Array<{
      migration_name: string;
      checksum: string;
      finished_at: Date | null;
    }>>`
      SELECT migration_name, checksum, finished_at
      FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL
      ORDER BY finished_at ASC
    `;

    const appliedMap = new Map(
      appliedMigrations.map(m => [m.migration_name, m])
    );

    let fixedCount = 0;
    const mismatches: Array<{ name: string; dbChecksum: string; fileChecksum: string }> = [];

    // Check each migration file
    for (const migrationDir of migrationDirs) {
      const migrationFile = path.join(migrationsDir, migrationDir, 'migration.sql');
      
      if (!fs.existsSync(migrationFile)) {
        continue;
      }

      const appliedMigration = appliedMap.get(migrationDir);
      if (!appliedMigration) {
        // Migration not applied yet, skip
        continue;
      }

      const fileChecksum = calculateChecksum(migrationFile);
      const dbChecksum = appliedMigration.checksum;

      if (fileChecksum !== dbChecksum) {
        mismatches.push({
          name: migrationDir,
          dbChecksum,
          fileChecksum,
        });
      }
    }

    if (mismatches.length === 0) {
      console.log('✅ All migration checksums match!\n');
      return;
    }

    console.log(`⚠️  Found ${mismatches.length} checksum mismatch(es):\n`);
    mismatches.forEach((m, i) => {
      console.log(`   ${i + 1}. ${m.name}`);
      console.log(`      DB checksum:   ${m.dbChecksum.substring(0, 16)}...`);
      console.log(`      File checksum: ${m.fileChecksum.substring(0, 16)}...`);
    });

    // Check for duplicate migration entries
    const duplicates = await prisma.$queryRaw<Array<{
      migration_name: string;
      count: bigint;
    }>>`
      SELECT migration_name, COUNT(*) as count
      FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL
      GROUP BY migration_name
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length > 0) {
      console.log(`\n⚠️  Found ${duplicates.length} migration(s) with duplicate entries:\n`);
      for (const dup of duplicates) {
        console.log(`   - ${dup.migration_name} (${dup.count} entries)`);
        
        // Get all entries for this migration
        const entries = await prisma.$queryRaw<Array<{
          migration_name: string;
          checksum: string;
          finished_at: Date | null;
        }>>`
          SELECT migration_name, checksum, finished_at
          FROM "_prisma_migrations"
          WHERE migration_name = ${dup.migration_name}
          ORDER BY finished_at DESC NULLS LAST
        `;

        // Find the correct checksum from file
        const migrationFile = path.join(migrationsDir, dup.migration_name, 'migration.sql');
        if (fs.existsSync(migrationFile)) {
          const fileChecksum = calculateChecksum(migrationFile);
          
          // Keep the entry with matching checksum, delete others
          const correctEntry = entries.find(e => e.checksum === fileChecksum);
          if (correctEntry) {
            await prisma.$executeRaw`
              DELETE FROM "_prisma_migrations"
              WHERE migration_name = ${dup.migration_name}
              AND checksum != ${fileChecksum}
            `;
            console.log(`   ✅ Removed duplicate entries for ${dup.migration_name}`);
            fixedCount++;
          } else {
            // No matching checksum, keep the most recent one
            const mostRecent = entries[0];
            await prisma.$executeRaw`
              DELETE FROM "_prisma_migrations"
              WHERE migration_name = ${dup.migration_name}
              AND checksum != ${mostRecent.checksum}
            `;
            console.log(`   ⚠️  Kept most recent entry for ${dup.migration_name} (checksum may still mismatch)`);
          }
        }
      }
      console.log('');
    }

    console.log('\n🔧 Fixing checksums...\n');

    // Update checksums in database
    for (const mismatch of mismatches) {
      const migrationFile = path.join(migrationsDir, mismatch.name, 'migration.sql');
      const fileChecksum = calculateChecksum(migrationFile);

      await prisma.$executeRaw`
        UPDATE "_prisma_migrations"
        SET checksum = ${fileChecksum}
        WHERE migration_name = ${mismatch.name}
      `;

      console.log(`   ✅ Fixed checksum for ${mismatch.name}`);
      fixedCount++;
    }

    console.log(`\n✅ Fixed ${fixedCount} checksum(s)!\n`);
    console.log('💡 You can now run: npx prisma migrate dev --name <your-migration-name>\n');

  } catch (error) {
    console.error('❌ Error fixing migration checksums:', error);
    if (error instanceof Error) {
      console.error('   Error:', error.message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixMigrationChecksums();

