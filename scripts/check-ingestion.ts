// scripts/check-ingestion.ts
// Diagnostic script to check ingestion status and Pinecone namespace
// Usage: npx tsx scripts/check-ingestion.ts

import dotenv from 'dotenv';
import path from 'path';
import { prisma } from '../lib/prisma';
import { getPineconeIndex } from '../lib/pinecone/client';
import { env } from '../lib/env';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkIngestion() {
  console.log('🔍 Checking ingestion status...\n');

  try {
    // 1. Check chatbot
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: 'chatbot_art_of_war' },
      include: {
        sources: {
          include: { source: true },
        },
        creator: true,
      },
    });

    if (!chatbot) {
      console.error('❌ Chatbot not found: chatbot_art_of_war');
      console.log('💡 Run: npx prisma db seed');
      process.exit(1);
    }

    console.log('✅ Chatbot found:');
    console.log(`   ID: ${chatbot.id}`);
    console.log(`   Title: ${chatbot.title}`);
    console.log(`   Namespace: creator-${chatbot.creatorId}`);
    console.log('');

    // 2. Check sources (via junction table)
    if (chatbot.sources.length === 0) {
      console.error('❌ No sources linked to chatbot');
      process.exit(1);
    }

    // Flatten junction table to get source details
    const linkedSources = chatbot.sources.map((cs) => cs.source);

    console.log(`✅ Found ${linkedSources.length} source(s):`);
    for (const source of linkedSources) {
      console.log(`   - ${source.title} (${source.id})`);
    }
    console.log('');

    // 3. Check files
    const files = await prisma.file.findMany({
      where: {
        sourceId: {
          in: linkedSources.map((s) => s.id),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (files.length === 0) {
      console.error('❌ No files found');
      console.log('💡 Upload a file first using the upload API');
      process.exit(1);
    }

    console.log(`✅ Found ${files.length} file(s):`);
    for (const file of files) {
      console.log(`   - ${file.fileName}`);
      console.log(`     Status: ${file.status}`);
      console.log(`     Size: ${(file.fileSize / 1024).toFixed(2)} KB`);
      console.log(`     Created: ${file.createdAt.toISOString()}`);
      console.log('');
    }

    // 4. Check Pinecone namespace
    const namespace = `chatbot-${chatbot.id}`;
    console.log(`🔍 Checking Pinecone namespace: "${namespace}"`);
    console.log(`   Index: ${env.PINECONE_INDEX}`);
    console.log('');

    try {
      const index = getPineconeIndex(env.PINECONE_INDEX);
      const namespaceIndex = index.namespace(namespace);

      // Try to query with a dummy vector to see if namespace exists
      // We'll use a zero vector for testing
      const dummyVector = new Array(1536).fill(0); // text-embedding-3-small dimension

      const queryResult = await namespaceIndex.query({
        vector: dummyVector,
        topK: 1,
        includeMetadata: true,
      });

      if (queryResult.matches.length === 0) {
        console.log('⚠️  Namespace exists but has no vectors');
        console.log('💡 This means ingestion may not have completed successfully');
      } else {
        console.log(`✅ Namespace has ${queryResult.matches.length} vector(s) (showing top 1)`);
        const match = queryResult.matches[0];
        console.log(`   Vector ID: ${match.id}`);
        console.log(`   Score: ${match.score}`);
        if (match.metadata) {
          console.log(`   Metadata:`, JSON.stringify(match.metadata, null, 2));
        }
      }

      // Try to get stats for the namespace
      try {
        const stats = await index.describeIndexStats();
        console.log('\n📊 Index Stats:');
        console.log(`   Total vectors: ${stats.totalRecordCount || 'N/A'}`);
        if (stats.namespaces) {
          console.log(`   Namespaces: ${Object.keys(stats.namespaces).length}`);
          if (stats.namespaces[namespace]) {
            console.log(`   "${namespace}": ${stats.namespaces[namespace].recordCount} vectors`);
          } else {
            console.log(`   ⚠️  Namespace "${namespace}" not found in stats`);
          }
        }
      } catch (statsError) {
        console.log('⚠️  Could not fetch index stats (this is okay)');
      }
    } catch (error) {
      console.error('❌ Error querying Pinecone:');
      console.error(`   ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log('\n💡 Possible issues:');
      console.log('   1. Pinecone API key is incorrect');
      console.log('   2. Pinecone index name is incorrect');
      console.log('   3. Index does not exist');
      console.log('   4. Network connectivity issue');
    }

    // 5. Summary
    console.log('\n📋 Summary:');
    const readyFiles = files.filter((f) => f.status === 'READY');
    const processingFiles = files.filter((f) => f.status === 'PROCESSING');
    const errorFiles = files.filter((f) => f.status === 'ERROR');
    const pendingFiles = files.filter((f) => f.status === 'PENDING');

    console.log(`   Ready: ${readyFiles.length}`);
    console.log(`   Processing: ${processingFiles.length}`);
    console.log(`   Error: ${errorFiles.length}`);
    console.log(`   Pending: ${pendingFiles.length}`);

    if (errorFiles.length > 0) {
      console.log('\n⚠️  Files with errors:');
      for (const file of errorFiles) {
        console.log(`   - ${file.fileName}`);
      }
      console.log('\n💡 Check server logs for error details');
      console.log('   Or re-trigger ingestion: POST /api/ingestion/trigger with fileId');
    }

    if (pendingFiles.length > 0) {
      console.log('\n💡 Files pending ingestion:');
      for (const file of pendingFiles) {
        console.log(`   - ${file.fileName} (${file.id})`);
      }
      console.log('\n💡 Trigger ingestion:');
      console.log(`   curl -X POST http://localhost:3000/api/ingestion/trigger \\`);
      console.log(`     -H "Content-Type: application/json" \\`);
      console.log(`     -d '{"fileId": "${pendingFiles[0].id}"}'`);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkIngestion();
