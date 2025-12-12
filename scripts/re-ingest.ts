// scripts/re-ingest.ts
// Re-trigger ingestion for a file
// Usage: npx tsx scripts/re-ingest.ts [fileId]

import dotenv from 'dotenv';
import path from 'path';
import { prisma } from '../lib/prisma';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

async function reIngest(fileId?: string) {
  console.log('🔄 Re-triggering ingestion...\n');

  try {
    // If no fileId provided, find the first file
    let targetFileId = fileId;

    if (!targetFileId) {
      const files = await prisma.file.findMany({
        where: {
          sourceId: 'source_art_of_war',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      });

      if (files.length === 0) {
        console.error('❌ No files found');
        process.exit(1);
      }

      targetFileId = files[0].id;
      console.log(`📄 Using file: ${files[0].fileName} (${targetFileId})`);
    }

    console.log(`🌐 Triggering: ${BASE_URL}/api/ingestion/trigger`);
    console.log(`📤 File ID: ${targetFileId}\n`);

    // Note: This requires authentication
    // For testing, you'll need to either:
    // 1. Use a valid Clerk session cookie
    // 2. Temporarily disable auth in the ingestion route
    // 3. Use curl with your browser's session cookie

    console.log('⚠️  Note: This endpoint requires authentication.');
    console.log('💡 Options:');
    console.log('   1. Use curl with your browser session cookie:');
    console.log(`      curl -X POST ${BASE_URL}/api/ingestion/trigger \\`);
    console.log(`        -H "Content-Type: application/json" \\`);
    console.log(`        -H "Cookie: __session=YOUR_SESSION_COOKIE" \\`);
    console.log(`        -d '{"fileId": "${targetFileId}"}'`);
    console.log('');
    console.log('   2. Or visit the test page in your browser:');
    console.log(`      ${BASE_URL}/test-files`);
    console.log('');
    console.log('   3. Or temporarily disable auth in the route for testing');

    // Try to make the request anyway (will fail if not authenticated)
    try {
      const response = await fetch(`${BASE_URL}/api/ingestion/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileId: targetFileId }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Request failed:');
        console.error(`   Status: ${response.status}`);
        console.error(`   Error: ${data.error || response.statusText}`);
        if (response.status === 401) {
          console.error('\n💡 Authentication required. See options above.');
        }
        process.exit(1);
      }

      console.log('✅ Ingestion triggered successfully!');
      console.log('📊 Response:');
      console.log(JSON.stringify(data, null, 2));
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.message.includes('ECONNREFUSED')) {
        console.error('❌ Connection refused. Is the dev server running?');
        console.error(`   Start it with: npm run dev`);
      } else {
        console.error('❌ Request failed:', fetchError);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const fileId = process.argv[2];
reIngest(fileId);
