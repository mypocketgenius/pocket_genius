// scripts/check-pinecone-vectors.ts
// Check for vectors in both default namespace and chatbot namespace
// Usage: npx dotenv-cli -e .env.local -- npx tsx scripts/check-pinecone-vectors.ts

// Load environment variables FIRST
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

import { getPineconeIndex } from '../lib/pinecone/client';
import { env } from '../lib/env';

const CHATBOT_ID = 'chatbot_art_of_war';
const EXPECTED_NAMESPACE = `chatbot-${CHATBOT_ID}`;

async function checkVectors() {
  console.log('🔍 Checking Pinecone for vectors...\n');

  const index = getPineconeIndex(env.PINECONE_INDEX);
  
  // Check default namespace
  console.log('1️⃣ Checking default namespace (no namespace):');
  try {
    const dummyVector = new Array(1536).fill(0.1); // Small non-zero values
    const defaultQuery = await index.query({
      vector: dummyVector,
      topK: 10,
      includeMetadata: true,
    });
    console.log(`   Found ${defaultQuery.matches.length} vectors in default namespace`);
    if (defaultQuery.matches.length > 0) {
      console.log('   Sample vector IDs:');
      defaultQuery.matches.slice(0, 3).forEach(m => {
        console.log(`     - ${m.id} (score: ${m.score?.toFixed(4)})`);
      });
    }
  } catch (error) {
    console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
  console.log('');

  // Check chatbot namespace
  console.log(`2️⃣ Checking namespace "${EXPECTED_NAMESPACE}":`);
  try {
    const namespaceIndex = index.namespace(EXPECTED_NAMESPACE);
    const dummyVector = new Array(1536).fill(0.1);
    const namespaceQuery = await namespaceIndex.query({
      vector: dummyVector,
      topK: 10,
      includeMetadata: true,
    });
    console.log(`   Found ${namespaceQuery.matches.length} vectors in namespace`);
    if (namespaceQuery.matches.length > 0) {
      console.log('   Sample vector IDs:');
      namespaceQuery.matches.slice(0, 3).forEach(m => {
        console.log(`     - ${m.id} (score: ${m.score?.toFixed(4)})`);
        if (m.metadata) {
          console.log(`       Metadata: sourceId=${m.metadata.sourceId}, page=${m.metadata.page}`);
        }
      });
    }
  } catch (error) {
    console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
  console.log('');

  // Get index stats
  console.log('3️⃣ Index Statistics:');
  try {
    const stats = await index.describeIndexStats();
    console.log(`   Total vectors: ${stats.totalRecordCount || 0}`);
    if (stats.namespaces) {
      console.log('   Namespace breakdown:');
      Object.entries(stats.namespaces).forEach(([ns, nsStats]: [string, any]) => {
        console.log(`     "${ns}": ${nsStats.vectorCount || 0} vectors`);
      });
    }
  } catch (error) {
    console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

checkVectors().catch(console.error);
