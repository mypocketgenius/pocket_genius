// scripts/re-trigger-ingestion.ts
// Re-trigger ingestion for a file to see what happens
// Usage: npx dotenv-cli -e .env.local -- npx tsx scripts/re-trigger-ingestion.ts [fileId]

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
import { env } from '../lib/env';

async function reTriggerIngestion(fileId?: string) {
  console.log('🔄 Re-triggering ingestion...\n');

  // Get file ID from args or find first READY file
  let targetFileId = fileId;

  if (!targetFileId) {
    // Get source IDs linked to the chatbot via junction table
    const chatbotSources = await prisma.chatbot_Source.findMany({
      where: { chatbotId: 'chatbot_art_of_war' },
      select: { sourceId: true },
    });
    const sourceIds = chatbotSources.map((cs) => cs.sourceId);

    const files = await prisma.file.findMany({
      where: {
        sourceId: { in: sourceIds },
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    if (files.length === 0) {
      console.error('❌ No files found');
      process.exit(1);
    }

    targetFileId = files[0].id;
    console.log(`📄 Found file: ${files[0].fileName} (ID: ${targetFileId})`);
    console.log(`   Status: ${files[0].status}\n`);
  }

  console.log(`📤 Triggering ingestion for file: ${targetFileId}`);
  console.log(`🌐 URL: ${env.NEXT_PUBLIC_URL}/api/ingestion/trigger\n`);

  try {
    const response = await fetch(`${env.NEXT_PUBLIC_URL}/api/ingestion/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: This requires authentication. You'll need to provide a Clerk session token
        // For testing, you might need to temporarily disable auth or use a test token
      },
      body: JSON.stringify({ fileId: targetFileId }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Ingestion failed:');
      console.error(`   Status: ${response.status}`);
      console.error(`   Error: ${data.error || response.statusText}`);
      if (data.details) {
        console.error(`   Details: ${data.details}`);
      }
      process.exit(1);
    }

    console.log('✅ Ingestion triggered successfully:');
    console.log(`   File ID: ${data.fileId}`);
    console.log(`   Status: ${data.status}`);
    if (data.chunksCreated) {
      console.log(`   Chunks created: ${data.chunksCreated}`);
    }
    if (data.vectorsUpserted) {
      console.log(`   Vectors upserted: ${data.vectorsUpserted}`);
    }
    console.log(`   Message: ${data.message}`);

  } catch (error) {
    console.error('❌ Request failed:');
    console.error(error instanceof Error ? error.message : error);
    console.error('\n💡 Note: This endpoint requires authentication.');
    console.error('   Make sure you are logged in via Clerk, or temporarily disable auth for testing.');
    process.exit(1);
  }

  await prisma.$disconnect();
}

const fileId = process.argv[2];
reTriggerIngestion(fileId).catch(console.error);
