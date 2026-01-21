#!/usr/bin/env ts-node
/**
 * Cleanup script to remove duplicate Intake_Response records
 * 
 * This script finds and removes duplicate intake responses, keeping only the most recent one
 * for each unique combination of userId, intakeQuestionId, and chatbotId.
 * 
 * Run with: npx ts-node scripts/cleanup-duplicate-intake-responses.ts
 * 
 * WARNING: This script modifies the database. Make sure to backup your database before running.
 */

// Load environment variables
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

// Use the project's Prisma client
import { prisma } from '../lib/prisma.js';

interface DuplicateGroup {
  userId: string;
  intakeQuestionId: string;
  chatbotId: string | null;
  count: number;
  ids: string[];
  latestId: string;
}

async function findDuplicates(): Promise<DuplicateGroup[]> {
  console.log('Finding duplicate intake responses...');

  // Get all intake responses grouped by userId, intakeQuestionId, and chatbotId
  const allResponses = await prisma.intake_Response.findMany({
    select: {
      id: true,
      userId: true,
      intakeQuestionId: true,
      chatbotId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [
      { userId: 'asc' },
      { intakeQuestionId: 'asc' },
      { chatbotId: 'asc' },
      { updatedAt: 'desc' }, // Most recent first
    ],
  });

  // Group by userId, intakeQuestionId, chatbotId
  const groups = new Map<string, DuplicateGroup>();

  for (const response of allResponses) {
    // Create a key for grouping (handle null chatbotId)
    const key = `${response.userId}:${response.intakeQuestionId}:${response.chatbotId ?? 'null'}`;

    if (!groups.has(key)) {
      groups.set(key, {
        userId: response.userId,
        intakeQuestionId: response.intakeQuestionId,
        chatbotId: response.chatbotId,
        count: 0,
        ids: [],
        latestId: response.id,
      });
    }

    const group = groups.get(key)!;
    group.count++;
    group.ids.push(response.id);

    // Keep track of the most recent ID (first one due to ordering)
    if (group.count === 1) {
      group.latestId = response.id;
    }
  }

  // Filter to only groups with duplicates
  const duplicates = Array.from(groups.values()).filter((g) => g.count > 1);

  return duplicates;
}

async function deleteDuplicates(dryRun: boolean = true): Promise<void> {
  const duplicates = await findDuplicates();

  if (duplicates.length === 0) {
    console.log('✅ No duplicate intake responses found!');
    return;
  }

  console.log(`\nFound ${duplicates.length} groups with duplicates:`);
  console.log('─'.repeat(80));

  let totalDuplicates = 0;
  let totalToDelete = 0;

  for (const group of duplicates) {
    const duplicatesInGroup = group.count - 1; // Keep one, delete the rest
    totalDuplicates += group.count;
    totalToDelete += duplicatesInGroup;

    console.log(
      `\nGroup: userId=${group.userId}, questionId=${group.intakeQuestionId}, chatbotId=${group.chatbotId ?? 'null'}`
    );
    console.log(`  Total records: ${group.count}`);
    console.log(`  Keeping (latest): ${group.latestId}`);
    console.log(`  Will delete: ${duplicatesInGroup} record(s)`);
    console.log(`  IDs to delete: ${group.ids.filter((id) => id !== group.latestId).join(', ')}`);
  }

  console.log('\n' + '─'.repeat(80));
  console.log(`Summary:`);
  console.log(`  Total duplicate groups: ${duplicates.length}`);
  console.log(`  Total records: ${totalDuplicates}`);
  console.log(`  Records to keep: ${duplicates.length}`);
  console.log(`  Records to delete: ${totalToDelete}`);

  if (dryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes made');
    console.log('Run with --execute flag to actually delete duplicates');
    return;
  }

  console.log('\n🗑️  Deleting duplicates...');

  let deletedCount = 0;
  let errorCount = 0;

  for (const group of duplicates) {
    const idsToDelete = group.ids.filter((id) => id !== group.latestId);

    for (const id of idsToDelete) {
      try {
        await prisma.intake_Response.delete({
          where: { id },
        });
        deletedCount++;
      } catch (error) {
        console.error(`Error deleting response ${id}:`, error);
        errorCount++;
      }
    }
  }

  console.log('\n✅ Cleanup complete!');
  console.log(`  Deleted: ${deletedCount} records`);
  if (errorCount > 0) {
    console.log(`  Errors: ${errorCount} records`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');

  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode (no changes will be made)');
    console.log('Add --execute flag to actually delete duplicates\n');
  } else {
    console.log('⚠️  EXECUTE MODE - This will delete duplicate records!');
    console.log('Press Ctrl+C within 5 seconds to cancel...\n');
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  try {
    await deleteDuplicates(dryRun);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();