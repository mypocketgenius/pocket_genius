// Seed script for suggested pills - chatbot-specific pills
// Creates suggested question pills for chatbot_art_of_war

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
  console.log('🌱 Starting suggested pills seed for chatbot_art_of_war...');

  const chatbotId = 'chatbot_art_of_war';

  // Verify chatbot exists
  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    select: { id: true, title: true },
  });

  if (!chatbot) {
    console.error(`❌ Chatbot not found: ${chatbotId}`);
    console.log('Please run the main seed script first: npx prisma db seed');
    process.exit(1);
  }

  console.log(`✅ Found chatbot: ${chatbot.title}`);

  // Suggested question pills for The Art of War
  const suggestedPills = [
    {
      id: 'pill_suggested_1_art_of_war',
      label: 'What are the five factors of warfare?',
      prefillText: 'What are the five factors of warfare?',
      displayOrder: 1,
    },
    {
      id: 'pill_suggested_2_art_of_war',
      label: 'How do I apply Sun Tzu\'s principles to business?',
      prefillText: 'How do I apply Sun Tzu\'s principles to business?',
      displayOrder: 2,
    },
    {
      id: 'pill_suggested_3_art_of_war',
      label: 'What does "know yourself and know your enemy" mean?',
      prefillText: 'What does "know yourself and know your enemy" mean?',
      displayOrder: 3,
    },
    {
      id: 'pill_suggested_4_art_of_war',
      label: 'Explain the importance of terrain',
      prefillText: 'Explain the importance of terrain',
      displayOrder: 4,
    },
    {
      id: 'pill_suggested_5_art_of_war',
      label: 'How do I use deception in strategy?',
      prefillText: 'How do I use deception in strategy?',
      displayOrder: 5,
    },
    {
      id: 'pill_suggested_6_art_of_war',
      label: 'What is the best way to attack?',
      prefillText: 'What is the best way to attack?',
      displayOrder: 6,
    },
  ];

  // Upsert each suggested pill
  for (const pill of suggestedPills) {
    await prisma.pill.upsert({
      where: { id: pill.id },
      update: {
        pillType: 'suggested',
        label: pill.label,
        prefillText: pill.prefillText,
        displayOrder: pill.displayOrder,
        isActive: true,
      },
      create: {
        id: pill.id,
        chatbotId, // Chatbot-specific pill
        pillType: 'suggested',
        label: pill.label,
        prefillText: pill.prefillText,
        displayOrder: pill.displayOrder,
        isActive: true,
      },
    });
    console.log(`✅ Created suggested pill: ${pill.label}`);
  }

  console.log('\n🎉 Suggested pills seed completed successfully!');
  console.log('\nSummary:');
  console.log(`  - Suggested pills: ${suggestedPills.length}`);
  console.log(`  - Chatbot: ${chatbot.title} (${chatbotId})`);
  console.log('\nNext steps:');
  console.log('  - Visit /chat/chatbot_art_of_war to see suggested pills');
  console.log('  - Suggested pills should appear before any messages are sent');
}

main()
  .catch((e) => {
    console.error('❌ Suggested pills seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



