// Seed script for system pills - Phase 1: Feedback UX System Update
// Creates system pills (feedback + expansion pills) that apply to all chatbots
// System pills have chatbotId: NULL

// Load environment variables FIRST (before importing Prisma)
import dotenv from 'dotenv';
import path from 'path';

// Try .env.local first (Next.js convention), then .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

// Use the Prisma singleton from lib/prisma.ts which handles env vars correctly
import { prisma } from '../lib/prisma';

async function main() {
  console.log('🌱 Starting pill seed...');

  // System pills (chatbotId: NULL) - apply to all chatbots
  
  // Feedback pills
  const helpfulPill = await prisma.pill.upsert({
    where: {
      id: 'pill_helpful_system',
    },
    update: {
      pillType: 'feedback',
      label: 'Helpful',
      prefillText: 'This was helpful',
      displayOrder: 1,
      isActive: true,
    },
    create: {
      id: 'pill_helpful_system',
      chatbotId: null, // System pill
      pillType: 'feedback',
      label: 'Helpful',
      prefillText: 'This was helpful',
      displayOrder: 1,
      isActive: true,
    },
  });

  console.log('✅ Created feedback pill: Helpful');

  const notHelpfulPill = await prisma.pill.upsert({
    where: {
      id: 'pill_not_helpful_system',
    },
    update: {
      pillType: 'feedback',
      label: 'Not helpful',
      prefillText: 'This was not helpful',
      displayOrder: 2,
      isActive: true,
    },
    create: {
      id: 'pill_not_helpful_system',
      chatbotId: null, // System pill
      pillType: 'feedback',
      label: 'Not helpful',
      prefillText: 'This was not helpful',
      displayOrder: 2,
      isActive: true,
    },
  });

  console.log('✅ Created feedback pill: Not helpful');

  // Expansion pills - Updated Jan 15, 2026
  // Delete old expansion pills by ID (cascade deletes Pill_Usage records)
  const oldPillIds = [
    'pill_how_to_use_system',
    'pill_say_more_system',
    'pill_who_done_system',
  ];

  console.log('\n🗑️  Deleting old expansion pills...');
  const deleteResult = await prisma.pill.deleteMany({
    where: {
      id: {
        in: oldPillIds,
      },
    },
  });
  console.log(`✅ Deleted ${deleteResult.count} old expansion pills`);

  // Verify cascade delete worked (no orphaned Pill_Usage records)
  const remainingUsages = await prisma.pill_Usage.count({
    where: {
      pillId: {
        in: oldPillIds,
      },
    },
  });

  if (remainingUsages > 0) {
    throw new Error(`Expected 0 Pill_Usage records after cascade delete, found ${remainingUsages}`);
  }
  console.log('✅ Verified cascade delete: No orphaned Pill_Usage records');

  // Define all 5 expansion pills (4 new + 1 existing) with labels and prefillText
  // prefillText matches label exactly for consistency
  const allExpansionPills = [
    { id: 'pill_evidence_system', label: "What's the evidence", prefillText: "What's the evidence" },
    { id: 'pill_template_system', label: "Give me a template", prefillText: "Give me a template" },
    { id: 'pill_edge_cases_system', label: "What are the edge cases", prefillText: "What are the edge cases" },
    { id: 'pill_steps_system', label: "Break this into steps", prefillText: "Break this into steps" },
    { id: 'pill_example_system', label: "Give me an example", prefillText: "Give me an example" },
  ];

  // Randomize displayOrder for all 5 pills (1-5, shuffled)
  const displayOrders = [1, 2, 3, 4, 5];
  const shuffledOrders = displayOrders.sort(() => Math.random() - 0.5);

  console.log('\n🌱 Creating expansion pills with randomized display order...');
  
  // Upsert all pills (upsert handles both create and update for "Give me an example")
  for (let i = 0; i < allExpansionPills.length; i++) {
    const pill = allExpansionPills[i];
    await prisma.pill.upsert({
      where: { id: pill.id },
      update: {
        label: pill.label,
        prefillText: pill.prefillText,
        displayOrder: shuffledOrders[i],
        pillType: 'expansion',
        isActive: true,
      },
      create: {
        id: pill.id,
        chatbotId: null, // System pill
        pillType: 'expansion',
        label: pill.label,
        prefillText: pill.prefillText,
        displayOrder: shuffledOrders[i],
        isActive: true,
      },
    });
    console.log(`✅ Created/updated expansion pill: ${pill.label} (displayOrder: ${shuffledOrders[i]})`);
  }

  console.log('\n🎉 Pill seed completed successfully!');
  console.log('\nSummary:');
  console.log(`  - Feedback pills: 2 (Helpful, Not helpful)`);
  console.log(`  - Expansion pills: 5 (Evidence, Template, Edge Cases, Steps, Example)`);
  console.log(`  - All pills are system pills (chatbotId: NULL)`);
  console.log(`  - Display order randomized to prevent selection bias`);
  console.log('\nNext steps:');
  console.log('  - System pills are now available for all chatbots');
  console.log('  - Chatbot-specific suggested question pills can be added via API or Prisma Studio');
}

main()
  .catch((e) => {
    console.error('❌ Pill seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

