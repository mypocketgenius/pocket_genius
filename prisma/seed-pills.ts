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

  // Expansion pills
  const examplePill = await prisma.pill.upsert({
    where: {
      id: 'pill_example_system',
    },
    update: {
      pillType: 'expansion',
      label: 'Give me an example',
      prefillText: 'Give me an example',
      displayOrder: 1,
      isActive: true,
    },
    create: {
      id: 'pill_example_system',
      chatbotId: null, // System pill
      pillType: 'expansion',
      label: 'Give me an example',
      prefillText: 'Give me an example',
      displayOrder: 1,
      isActive: true,
    },
  });

  console.log('✅ Created expansion pill: Give me an example');

  const howToUsePill = await prisma.pill.upsert({
    where: {
      id: 'pill_how_to_use_system',
    },
    update: {
      pillType: 'expansion',
      label: 'How would I actually use this?',
      prefillText: 'How would I actually use this?',
      displayOrder: 2,
      isActive: true,
    },
    create: {
      id: 'pill_how_to_use_system',
      chatbotId: null, // System pill
      pillType: 'expansion',
      label: 'How would I actually use this?',
      prefillText: 'How would I actually use this?',
      displayOrder: 2,
      isActive: true,
    },
  });

  console.log('✅ Created expansion pill: How would I actually use this?');

  const sayMorePill = await prisma.pill.upsert({
    where: {
      id: 'pill_say_more_system',
    },
    update: {
      pillType: 'expansion',
      label: 'Say more about this',
      prefillText: 'Say more about this',
      displayOrder: 3,
      isActive: true,
    },
    create: {
      id: 'pill_say_more_system',
      chatbotId: null, // System pill
      pillType: 'expansion',
      label: 'Say more about this',
      prefillText: 'Say more about this',
      displayOrder: 3,
      isActive: true,
    },
  });

  console.log('✅ Created expansion pill: Say more about this');

  const whoDonePill = await prisma.pill.upsert({
    where: {
      id: 'pill_who_done_system',
    },
    update: {
      pillType: 'expansion',
      label: "Who's done this?",
      prefillText: "Who's done this?",
      displayOrder: 4,
      isActive: true,
    },
    create: {
      id: 'pill_who_done_system',
      chatbotId: null, // System pill
      pillType: 'expansion',
      label: "Who's done this?",
      prefillText: "Who's done this?",
      displayOrder: 4,
      isActive: true,
    },
  });

  console.log('✅ Created expansion pill: Who\'s done this?');

  console.log('\n🎉 Pill seed completed successfully!');
  console.log('\nSummary:');
  console.log(`  - Feedback pills: 2 (Helpful, Not helpful)`);
  console.log(`  - Expansion pills: 4 (Example, How to use, Say more, Who's done)`);
  console.log(`  - All pills are system pills (chatbotId: NULL)`);
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

