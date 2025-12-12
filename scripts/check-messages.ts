// scripts/check-messages.ts
// Check if messages are being stored with context chunks
// Usage: npx dotenv-cli -e .env.local -- npx tsx scripts/check-messages.ts

// Load environment variables FIRST
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

import { prisma } from '../lib/prisma';

async function checkMessages() {
  console.log('📨 Checking stored messages...\n');

  const messages = await prisma.message.findMany({
    where: {
      conversation: {
        chatbotId: 'chatbot_art_of_war',
      },
    },
    include: {
      conversation: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 5,
  });

  if (messages.length === 0) {
    console.log('⚠️  No messages found');
    return;
  }

  console.log(`Found ${messages.length} recent messages:\n`);

  messages.forEach((msg, index) => {
    console.log(`${index + 1}. ${msg.role.toUpperCase()} message:`);
    console.log(`   Content: ${msg.content.substring(0, 100)}...`);
    console.log(`   Conversation: ${msg.conversationId}`);
    console.log(`   Created: ${msg.createdAt.toISOString()}`);
    
    if (msg.context) {
      const context = msg.context as any;
      if (context.chunks && Array.isArray(context.chunks)) {
        console.log(`   ✅ Context: ${context.chunks.length} chunks retrieved`);
        if (context.chunks.length > 0) {
          console.log(`      Sample chunk: ${context.chunks[0].text?.substring(0, 80)}...`);
        }
      } else {
        console.log(`   ⚠️  Context exists but no chunks found`);
      }
    } else {
      console.log(`   ⚠️  No context stored`);
    }
    
    if (msg.sourceIds && msg.sourceIds.length > 0) {
      console.log(`   ✅ Source IDs: ${msg.sourceIds.join(', ')}`);
    }
    
    console.log('');
  });

  // Check chunk performance
  console.log('📊 Chunk Performance:');
  const chunkPerf = await prisma.chunk_Performance.findMany({
    where: {
      chatbotId: 'chatbot_art_of_war',
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
    },
    orderBy: {
      timesUsed: 'desc',
    },
    take: 5,
  });

  if (chunkPerf.length === 0) {
    console.log('   ⚠️  No chunk performance data found');
  } else {
    console.log(`   Top ${chunkPerf.length} most used chunks:`);
    chunkPerf.forEach((chunk, index) => {
      console.log(`   ${index + 1}. Chunk ${chunk.chunkId.substring(0, 20)}...`);
      console.log(`      Times used: ${chunk.timesUsed}`);
      console.log(`      Source ID: ${chunk.sourceId}`);
    });
  }

  await prisma.$disconnect();
}

checkMessages().catch(console.error);
