// Migration script: Message_Feedback → Events/Pill_Usage
// Phase 3: Data Migration Script
// Migrates existing Message_Feedback records to Pill_Usage and Events tables
// 
// NOTE: This script is only needed if Message_Feedback table still exists.
// If the table has already been removed, this script will exit gracefully.

// Load environment variables FIRST (before importing Prisma)
import dotenv from 'dotenv';
import path from 'path';

// Try .env.local first (Next.js convention), then .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

import { prisma } from '../lib/prisma';

/**
 * Maps needsMore array values to expansion pill IDs
 */
function mapNeedsMoreToPillIds(needsMore: string[]): string[] {
  const mapping: Record<string, string> = {
    examples: 'pill_example_system',
    steps: 'pill_how_to_use_system',
    scripts: 'pill_say_more_system',
    case_studies: 'pill_who_done_system',
  };

  return needsMore
    .map((need) => mapping[need])
    .filter((pillId): pillId is string => pillId !== undefined);
}

/**
 * Extracts chunkIds from message context
 */
function extractChunkIds(context: any): string[] {
  if (!context || typeof context !== 'object') {
    return [];
  }

  const chunks = context.chunks;
  if (!Array.isArray(chunks)) {
    return [];
  }

  return chunks
    .map((chunk: any) => chunk?.chunkId)
    .filter((chunkId): chunkId is string => typeof chunkId === 'string');
}

/**
 * Main migration function
 */
async function migrateFeedbackToPills() {
  console.log('🚀 Starting Message_Feedback → Events/Pill_Usage migration...\n');

  try {
    // Check if Message_Feedback table exists
    // Since the table was removed in Phase 2, we'll catch the error and exit gracefully
    // Use dynamic property access to bypass TypeScript type checking
    let allFeedback;
    try {
      // 1. Get all Message_Feedback records (if table exists)
      // Note: message_Feedback table was removed in Phase 2, but this script
      // may still be needed if running on an older database that hasn't been migrated yet
      // Using dynamic property access to bypass TypeScript type checking
      const messageFeedbackModel = (prisma as any).message_Feedback;
      
      if (!messageFeedbackModel) {
        console.log('ℹ️  Message_Feedback table does not exist.');
        console.log('✅ Migration not needed - table was already removed in Phase 2.');
        console.log('   Feedback is now tracked via Events and Pill_Usage tables.\n');
        return;
      }

      allFeedback = await messageFeedbackModel.findMany({
        include: {
          message: {
            include: {
              conversation: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc', // Process oldest first
        },
      });
    } catch (error: any) {
      // If table doesn't exist, Prisma will throw an error
      if (error?.code === 'P2001' || error?.message?.includes('does not exist') || error?.message?.includes('message_Feedback')) {
        console.log('ℹ️  Message_Feedback table does not exist.');
        console.log('✅ Migration not needed - table was already removed in Phase 2.');
        console.log('   Feedback is now tracked via Events and Pill_Usage tables.\n');
        return;
      }
      // Re-throw if it's a different error
      throw error;
    }

    console.log(`📊 Found ${allFeedback.length} Message_Feedback records to migrate\n`);

    if (allFeedback.length === 0) {
      console.log('✅ No feedback records to migrate. Exiting.');
      return;
    }

    // 2. Get system pills for mapping
    const systemPills = await prisma.pill.findMany({
      where: {
        chatbotId: null, // System pills
      },
    });

    const pillMap = new Map(systemPills.map((pill) => [pill.id, pill]));

    // Verify required pills exist
    const requiredPillIds = [
      'pill_helpful_system',
      'pill_not_helpful_system',
      'pill_example_system',
      'pill_how_to_use_system',
      'pill_say_more_system',
      'pill_who_done_system',
    ];

    const missingPills = requiredPillIds.filter(
      (id) => !pillMap.has(id)
    );

    if (missingPills.length > 0) {
      console.error(
        `❌ Missing required system pills: ${missingPills.join(', ')}`
      );
      console.error(
        'Please run: npx tsx prisma/seed-pills.ts'
      );
      process.exit(1);
    }

    console.log('✅ All required system pills found\n');

    // 3. Process each feedback record
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const totalRecords = allFeedback.length;
    const logInterval = Math.max(1, Math.floor(totalRecords / 10)); // Log every 10%

    for (let i = 0; i < allFeedback.length; i++) {
      const feedback = allFeedback[i];
      
      // Log progress
      if (i % logInterval === 0 || i === totalRecords - 1) {
        const progress = ((i + 1) / totalRecords * 100).toFixed(1);
        console.log(`📊 Progress: ${i + 1}/${totalRecords} (${progress}%)`);
      }
      try {
        const message = feedback.message;
        const conversation = message.conversation;
        const chatbotId = conversation.chatbotId;
        const sessionId = conversation.id;
        const userId = feedback.userId;

        // Extract chunkIds from message context
        const chunkIds = extractChunkIds(message.context);

        // Process based on feedbackType
        if (feedback.feedbackType === 'helpful') {
          // Create Pill_Usage record for helpful feedback
          const helpfulPill = pillMap.get('pill_helpful_system');
          if (!helpfulPill) {
            console.error(
              `❌ Skipping feedback ${feedback.id}: helpful pill not found`
            );
            skippedCount++;
            continue;
          }

          await prisma.pill_Usage.create({
            data: {
              pillId: helpfulPill.id,
              sessionId,
              userId: userId || undefined,
              chatbotId,
              sourceChunkIds: chunkIds,
              prefillText: helpfulPill.prefillText,
              sentText: helpfulPill.prefillText, // Assume user sent as-is
              wasModified: false,
              timestamp: feedback.createdAt,
            },
          });

          migratedCount++;
        } else if (feedback.feedbackType === 'not_helpful') {
          // Create Pill_Usage record for not_helpful feedback
          const notHelpfulPill = pillMap.get('pill_not_helpful_system');
          if (!notHelpfulPill) {
            console.error(
              `❌ Skipping feedback ${feedback.id}: not_helpful pill not found`
            );
            skippedCount++;
            continue;
          }

          await prisma.pill_Usage.create({
            data: {
              pillId: notHelpfulPill.id,
              sessionId,
              userId: userId || undefined,
              chatbotId,
              sourceChunkIds: chunkIds,
              prefillText: notHelpfulPill.prefillText,
              sentText: notHelpfulPill.prefillText, // Assume user sent as-is
              wasModified: false,
              timestamp: feedback.createdAt,
            },
          });

          migratedCount++;
        } else if (feedback.feedbackType === 'need_more') {
          // Map needsMore array to expansion pill IDs
          const expansionPillIds = mapNeedsMoreToPillIds(feedback.needsMore);

          if (expansionPillIds.length === 0) {
            console.warn(
              `⚠️ Skipping feedback ${feedback.id}: no valid expansion pills found for needsMore: ${feedback.needsMore.join(', ')}`
            );
            skippedCount++;
            continue;
          }

          // Create Pill_Usage record for each expansion pill
          for (const pillId of expansionPillIds) {
            const pill = pillMap.get(pillId);
            if (!pill) {
              console.warn(
                `⚠️ Skipping pill ${pillId}: pill not found in database`
              );
              continue;
            }

            // Build prefill text: expansion pill + optional specificSituation
            let prefillText = pill.prefillText;
            if (feedback.specificSituation) {
              prefillText = `${prefillText} ${feedback.specificSituation}`;
            }

            await prisma.pill_Usage.create({
              data: {
                pillId: pill.id,
                sessionId,
                userId: userId || undefined,
                chatbotId,
                sourceChunkIds: chunkIds,
                prefillText: pill.prefillText,
                sentText: prefillText, // Include specificSituation in sent text
                wasModified: !!feedback.specificSituation, // Modified if specificSituation added
                timestamp: feedback.createdAt,
              },
            });
          }

          migratedCount++;
        } else if (feedback.feedbackType === 'copy') {
          // Create Event record for copy feedback
          await prisma.event.create({
            data: {
              sessionId,
              userId: userId || undefined,
              eventType: 'copy',
              chunkIds,
              metadata: {
                messageId: message.id,
                copyUsage: feedback.copyUsage || null,
                copyContext: feedback.copyContext || null,
              },
              timestamp: feedback.createdAt,
            },
          });

          // If copyUsage is provided, we could create a Pill_Usage record
          // However, the plan doesn't specify a pill for copy usage, so we'll skip it
          // The Event record is sufficient for tracking copy events

          migratedCount++;
        } else {
          console.warn(
            `⚠️ Skipping feedback ${feedback.id}: unknown feedbackType: ${feedback.feedbackType}`
          );
          skippedCount++;
        }
      } catch (error) {
        console.error(
          `❌ Error migrating feedback ${feedback.id}:`,
          error instanceof Error ? error.message : error
        );
        errorCount++;
      }
    }

    // 4. Print summary
    console.log('\n📊 Migration Summary:');
    console.log(`  ✅ Migrated: ${migratedCount} records`);
    console.log(`  ⚠️  Skipped: ${skippedCount} records`);
    console.log(`  ❌ Errors: ${errorCount} records`);
    console.log(`  📝 Total processed: ${allFeedback.length} records\n`);

    if (errorCount > 0) {
      console.log(
        '⚠️  Some records failed to migrate. Review errors above.'
      );
    } else {
      console.log(
        '✅ Migration completed successfully!'
      );
      console.log(
        '\n📋 Next steps:'
      );
      console.log(
        '  1. Verify migrated data in Pill_Usage and Events tables'
      );
      console.log(
        '  2. Test that analytics queries work with new tables'
      );
      console.log(
        '  3. After verification, delete Message_Feedback table (we\'re in development)'
      );
      console.log(
        '     Run: npx prisma migrate dev --name remove_message_feedback_table'
      );
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateFeedbackToPills()
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

