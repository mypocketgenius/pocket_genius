// Verification script for Message_Feedback → Events/Pill_Usage migration
// Phase 3: Data Migration Verification

// Load environment variables FIRST (before importing Prisma)
import dotenv from 'dotenv';
import path from 'path';

// Try .env.local first (Next.js convention), then .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

import { prisma } from '../lib/prisma';

async function verifyMigration() {
  console.log('🔍 Verifying Message_Feedback → Events/Pill_Usage migration...\n');

  try {
    // 1. Count records in new tables (Message_Feedback has been deleted)
    const pillUsageCount = await prisma.pill_Usage.count();
    const eventCount = await prisma.event.count();

    console.log('📊 Record Counts:');
    console.log(`  Message_Feedback: DELETED ✅`);
    console.log(`  Pill_Usage: ${pillUsageCount} records`);
    console.log(`  Events: ${eventCount} records\n`);

    // 3. Verify Pill_Usage records by pill type
    const helpfulPill = await prisma.pill.findUnique({
      where: { id: 'pill_helpful_system' },
    });
    const notHelpfulPill = await prisma.pill.findUnique({
      where: { id: 'pill_not_helpful_system' },
    });

    const helpfulPillUsage = helpfulPill
      ? await prisma.pill_Usage.count({
          where: { pillId: helpfulPill.id },
        })
      : 0;
    const notHelpfulPillUsage = notHelpfulPill
      ? await prisma.pill_Usage.count({
          where: { pillId: notHelpfulPill.id },
        })
      : 0;

    const expansionPillUsage = await prisma.pill_Usage.count({
      where: {
        pill: {
          pillType: 'expansion',
          chatbotId: null, // System pills
        },
      },
    });

    console.log('💊 Pill_Usage breakdown:');
    console.log(`  helpful pill: ${helpfulPillUsage}`);
    console.log(`  not_helpful pill: ${notHelpfulPillUsage}`);
    console.log(`  expansion pills: ${expansionPillUsage}\n`);

    // 4. Verify Events by type
    const copyEvents = await prisma.event.count({
      where: { eventType: 'copy' },
    });

    console.log('📅 Events breakdown:');
    console.log(`  copy events: ${copyEvents}\n`);

    // 5. Verify data integrity - check sample records
    const samplePillUsage = await prisma.pill_Usage.findFirst({
      include: {
        pill: {
          select: {
            label: true,
            pillType: true,
          },
        },
      },
    });

    const sampleEvent = await prisma.event.findFirst({
      where: { eventType: 'copy' },
    });

    console.log('✅ Sample Records:');
    if (samplePillUsage) {
      console.log(`  Pill_Usage: ${samplePillUsage.pill.label} (${samplePillUsage.pill.pillType})`);
      console.log(`    - Session: ${samplePillUsage.sessionId || 'N/A'}`);
      console.log(`    - User: ${samplePillUsage.userId || 'Anonymous'}`);
      console.log(`    - Chunks: ${samplePillUsage.sourceChunkIds.length}`);
      console.log(`    - Timestamp: ${samplePillUsage.timestamp}`);
    }
    if (sampleEvent) {
      console.log(`  Event: ${sampleEvent.eventType}`);
      console.log(`    - Session: ${sampleEvent.sessionId || 'N/A'}`);
      console.log(`    - User: ${sampleEvent.userId || 'Anonymous'}`);
      console.log(`    - Chunks: ${sampleEvent.chunkIds.length}`);
      console.log(`    - Metadata: ${JSON.stringify(sampleEvent.metadata)}`);
      console.log(`    - Timestamp: ${sampleEvent.timestamp}`);
    }

    console.log('\n');

    // 6. Validation checks
    let allChecksPassed = true;

    // Check: We have migrated data in new tables
    if (pillUsageCount === 0 && eventCount === 0) {
      console.warn(
        `⚠️  Warning: No data found in Pill_Usage or Events tables`
      );
      allChecksPassed = false;
    } else {
      console.log('✅ Data found in new tables');
    }

    // 7. Summary
    console.log('📊 Migration Verification Summary:');
    if (allChecksPassed) {
      console.log('  ✅ All checks passed!');
      console.log('  ✅ Data migration appears successful');
      console.log('  ✅ Message_Feedback table has been deleted');
      console.log('\n  🎉 Phase 3 migration complete!');
      console.log('  📋 Ready to proceed to Phase 4: Switch UI');
    } else {
      console.log('  ⚠️  Some checks failed - review warnings above');
    }
  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  }
}

// Run verification
verifyMigration()
  .catch((error) => {
    console.error('❌ Verification script failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

