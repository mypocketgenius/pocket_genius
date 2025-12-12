// scripts/diagnose-pinecone.ts
// Diagnostic script to check Pinecone namespace and vector counts
// Usage: npx dotenv-cli -e .env.local -- npx tsx scripts/diagnose-pinecone.ts
// Or: npx tsx scripts/diagnose-pinecone.ts (if using dotenv-cli wrapper)

// Load environment variables FIRST before any imports
// Use require for synchronous loading (works in both CommonJS and ESM via tsx)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

// Load .env.local first (Next.js convention), then .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

// Now import modules that use environment variables
import { getPineconeIndex } from '../lib/pinecone/client';
import { env } from '../lib/env';
import { prisma } from '../lib/prisma';

const CHATBOT_ID = 'chatbot_art_of_war'; // From seed data

async function diagnosePinecone() {
  console.log('🔍 Diagnosing Pinecone Configuration...\n');

  // 1. Check environment variables
  console.log('📋 Environment Configuration:');
  console.log(`   PINECONE_INDEX: ${env.PINECONE_INDEX}`);
  console.log(`   PINECONE_USE_NAMESPACES: ${process.env.PINECONE_USE_NAMESPACES ?? 'not set (defaults to true)'}`);
  const useNamespaces = process.env.PINECONE_USE_NAMESPACES !== 'false';
  console.log(`   → Using namespaces: ${useNamespaces ? 'YES' : 'NO'}`);
  console.log('');

  // 2. Check database for files
  console.log('📊 Database Files:');
  const files = await prisma.file.findMany({
    include: {
      source: {
        include: {
          chatbot: true,
        },
      },
    },
  });

  if (files.length === 0) {
    console.log('   ⚠️  No files found in database');
    console.log('   💡 Upload a file first using /api/files/upload');
  } else {
    files.forEach((file) => {
      console.log(`   - ${file.fileName}`);
      console.log(`     Status: ${file.status}`);
      console.log(`     Source: ${file.source?.title || 'N/A'}`);
      console.log(`     Chatbot: ${file.source?.chatbot?.title || 'N/A'}`);
      console.log(`     Size: ${(file.fileSize / 1024).toFixed(2)} KB`);
      console.log('');
    });
  }

  // 3. Check Pinecone index
  console.log('🔍 Pinecone Index Check:');
  try {
    const index = getPineconeIndex(env.PINECONE_INDEX);
    const indexStats = await index.describeIndexStats();
    
    console.log(`   Index: ${env.PINECONE_INDEX}`);
    console.log(`   Total vectors: ${indexStats.totalRecordCount || 0}`);
    console.log(`   Dimension: ${indexStats.dimension || 'N/A'}`);
    console.log('');

    // Check namespaces
    if (indexStats.namespaces) {
      console.log('   Namespaces:');
      const namespaceEntries = Object.entries(indexStats.namespaces);
      if (namespaceEntries.length === 0) {
        console.log('     ⚠️  No namespaces found (or using default namespace)');
      } else {
        namespaceEntries.forEach(([ns, stats]: [string, any]) => {
          const vectorCount = stats.vectorCount || 0;
          console.log(`     - "${ns}": ${vectorCount} vectors`);
        });
      }
    } else {
      console.log('   ⚠️  Namespace stats not available (might be Starter plan)');
    }
    console.log('');

    // 4. Check expected namespace
    const expectedNamespace = `chatbot-${CHATBOT_ID}`;
    console.log(`🎯 Expected Namespace: "${expectedNamespace}"`);
    
    if (useNamespaces) {
      console.log(`   → Will query namespace: "${expectedNamespace}"`);
      
      // Try to query the namespace to see if it exists
      try {
        const namespaceIndex = index.namespace(expectedNamespace);
        // Try a simple query to see if namespace exists
        // Use a dummy vector of correct dimension (1536 for text-embedding-3-small)
        const dummyVector = new Array(1536).fill(0);
        const testQuery = await namespaceIndex.query({
          vector: dummyVector,
          topK: 1,
          includeMetadata: false,
        });
        console.log(`   ✅ Namespace exists and is queryable`);
        console.log(`   📊 Vectors in namespace: ${testQuery.matches.length > 0 ? 'Found vectors' : 'No vectors found'}`);
      } catch (error) {
        console.log(`   ❌ Error querying namespace: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      console.log(`   → Will query default namespace (no namespace)`);
      
      // Try to query default namespace
      try {
        const dummyVector = new Array(1536).fill(0);
        const testQuery = await index.query({
          vector: dummyVector,
          topK: 1,
          includeMetadata: false,
        });
        console.log(`   ✅ Default namespace is queryable`);
        console.log(`   📊 Vectors in default namespace: ${testQuery.matches.length > 0 ? 'Found vectors' : 'No vectors found'}`);
      } catch (error) {
        console.log(`   ❌ Error querying default namespace: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    console.log('');

    // 5. Recommendations
    console.log('💡 Recommendations:');
    
    if (files.length === 0) {
      console.log('   1. Upload a file first');
    } else {
      const readyFiles = files.filter(f => f.status === 'READY');
      const processingFiles = files.filter(f => f.status === 'PROCESSING');
      const errorFiles = files.filter(f => f.status === 'ERROR');
      const pendingFiles = files.filter(f => f.status === 'PENDING');

      if (pendingFiles.length > 0) {
        console.log(`   1. ${pendingFiles.length} file(s) are PENDING - trigger ingestion`);
        pendingFiles.forEach(f => {
          console.log(`      - ${f.fileName} (ID: ${f.id})`);
        });
      }

      if (processingFiles.length > 0) {
        console.log(`   2. ${processingFiles.length} file(s) are PROCESSING - wait for completion`);
      }

      if (errorFiles.length > 0) {
        console.log(`   3. ${errorFiles.length} file(s) have ERROR status - check logs`);
        errorFiles.forEach(f => {
          console.log(`      - ${f.fileName} (ID: ${f.id})`);
        });
      }

      if (readyFiles.length > 0 && indexStats.totalRecordCount === 0) {
        console.log(`   4. ⚠️  Files are READY but Pinecone has no vectors`);
        console.log(`      → Check if PINECONE_USE_NAMESPACES matches between upsert and query`);
        console.log(`      → Verify ingestion actually completed successfully`);
        console.log(`      → Check server logs for errors during ingestion`);
      }

      if (readyFiles.length > 0 && indexStats.totalRecordCount > 0) {
        const expectedNs = useNamespaces ? expectedNamespace : '(default)';
        console.log(`   5. ✅ Files are READY and Pinecone has ${indexStats.totalRecordCount} vectors`);
        console.log(`      → Check namespace "${expectedNs}" for your chatbot's vectors`);
      }
    }

  } catch (error) {
    console.error('❌ Error checking Pinecone:', error instanceof Error ? error.message : error);
    console.error('   → Check your PINECONE_API_KEY and PINECONE_INDEX environment variables');
  }

  await prisma.$disconnect();
}

diagnosePinecone()
  .catch((error) => {
    console.error('❌ Diagnostic failed:', error);
    process.exit(1);
  });
