// scripts/update-chatbot-short-description.ts
// Simple script to update chatbot shortDescription field
// Usage: npx tsx scripts/update-chatbot-short-description.ts <chatbotId> <shortDescription>
// 
// Note: You can also use the API endpoint: PATCH /api/chatbots/[chatbotId]

import { prisma } from '../lib/prisma';

async function updateChatbotShortDescription(chatbotId: string, shortDescription: string) {
  try {
    const chatbot = await prisma.chatbot.update({
      where: { id: chatbotId },
      data: { shortDescription },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        shortDescription: true,
      },
    });

    console.log('✅ Chatbot updated successfully:');
    console.log(`   Title: ${chatbot.title}`);
    console.log(`   Slug: ${chatbot.slug}`);
    console.log(`   Short Description: ${chatbot.shortDescription}`);
    console.log(`   Full Description: ${chatbot.description?.substring(0, 50)}...`);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Record to update not found')) {
        console.error(`❌ Chatbot with id "${chatbotId}" not found`);
      } else {
        console.error('❌ Error updating chatbot:', error.message);
      }
    } else {
      console.error('❌ Unknown error:', error);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get arguments from command line
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: npx tsx scripts/update-chatbot-short-description.ts <chatbotId> <shortDescription>');
  console.error('Example: npx tsx scripts/update-chatbot-short-description.ts clxxx... "Short description here"');
  console.error('\nNote: You can also use the API: PATCH /api/chatbots/[chatbotId]');
  process.exit(1);
}

const [chatbotId, shortDescription] = args;
updateChatbotShortDescription(chatbotId, shortDescription);




