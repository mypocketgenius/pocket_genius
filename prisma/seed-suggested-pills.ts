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

  // Delete all existing pills for this chatbot first
  const deleteResult = await prisma.pill.deleteMany({
    where: { chatbotId },
  });
  console.log(`🗑️  Deleted ${deleteResult.count} existing pills for ${chatbotId}`);

  // Suggested question pills for The Art of War
  const suggestedPills = [
    // On competitive strategy
    {
      id: 'pill_suggested_1_art_of_war',
      label: 'What does Sun Tzu say about entering markets where you\'re currently weak versus doubling down on your strengths?',
      prefillText: 'What does Sun Tzu say about entering markets where you\'re currently weak versus doubling down on your strengths?',
      displayOrder: 1,
    },
    {
      id: 'pill_suggested_2_art_of_war',
      label: 'How should I approach a competitor who has more resources than my company?',
      prefillText: 'How should I approach a competitor who has more resources than my company?',
      displayOrder: 2,
    },
    {
      id: 'pill_suggested_3_art_of_war',
      label: 'What does The Art of War teach about timing—when to move aggressively versus when to wait?',
      prefillText: 'What does The Art of War teach about timing—when to move aggressively versus when to wait?',
      displayOrder: 3,
    },
    // On leadership and organizational dynamics
    {
      id: 'pill_suggested_4_art_of_war',
      label: 'What principles does Sun Tzu offer about maintaining team morale during difficult business periods?',
      prefillText: 'What principles does Sun Tzu offer about maintaining team morale during difficult business periods?',
      displayOrder: 4,
    },
    {
      id: 'pill_suggested_5_art_of_war',
      label: 'How does The Art of War suggest handling internal politics or conflicts within an organization?',
      prefillText: 'How does The Art of War suggest handling internal politics or conflicts within an organization?',
      displayOrder: 5,
    },
    {
      id: 'pill_suggested_6_art_of_war',
      label: 'What does Sun Tzu say about the balance between centralized control and delegating authority?',
      prefillText: 'What does Sun Tzu say about the balance between centralized control and delegating authority?',
      displayOrder: 6,
    },
    // On intelligence and decision-making
    {
      id: 'pill_suggested_7_art_of_war',
      label: 'What does The Art of War teach about gathering competitive intelligence ethically?',
      prefillText: 'What does The Art of War teach about gathering competitive intelligence ethically?',
      displayOrder: 7,
    },
    {
      id: 'pill_suggested_8_art_of_war',
      label: 'How should I make decisions when I have incomplete information about market conditions?',
      prefillText: 'How should I make decisions when I have incomplete information about market conditions?',
      displayOrder: 8,
    },
    {
      id: 'pill_suggested_9_art_of_war',
      label: 'What does Sun Tzu say about distinguishing between reliable and unrealistic business advice?',
      prefillText: 'What does Sun Tzu say about distinguishing between reliable and unrealistic business advice?',
      displayOrder: 9,
    },
    // On specific tactical situations
    {
      id: 'pill_suggested_10_art_of_war',
      label: 'How would Sun Tzu approach a price war with competitors?',
      prefillText: 'How would Sun Tzu approach a price war with competitors?',
      displayOrder: 10,
    },
    {
      id: 'pill_suggested_11_art_of_war',
      label: 'What would The Art of War recommend when negotiating a major partnership or acquisition?',
      prefillText: 'What would The Art of War recommend when negotiating a major partnership or acquisition?',
      displayOrder: 11,
    },
    {
      id: 'pill_suggested_12_art_of_war',
      label: 'How should I position my startup against established incumbents according to Sun Tzu\'s principles?',
      prefillText: 'How should I position my startup against established incumbents according to Sun Tzu\'s principles?',
      displayOrder: 12,
    },
    // On strategic positioning
    {
      id: 'pill_suggested_13_art_of_war',
      label: 'What does Sun Tzu mean by "winning without fighting" and how does that apply to business?',
      prefillText: 'What does Sun Tzu mean by "winning without fighting" and how does that apply to business?',
      displayOrder: 13,
    },
    {
      id: 'pill_suggested_14_art_of_war',
      label: 'How does The Art of War define what makes a strategic position truly defensible?',
      prefillText: 'How does The Art of War define what makes a strategic position truly defensible?',
      displayOrder: 14,
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













