// scripts/check-vector-metadata.ts
// Check metadata of vectors to verify page field is not present

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX!);

async function main() {
  const creatorId = process.argv[2] || 'sun_tzu';
  const sourceId = process.argv[3] || 'art_of_war';

  console.log(`Checking metadata in namespace: creator-${creatorId}`);
  console.log(`For source: ${sourceId}\n`);

  const namespace = pineconeIndex.namespace(`creator-${creatorId}`);

  // Fetch a few vectors to check their metadata
  const vectorIds = [
    `${sourceId}-chunk-0`,
    `${sourceId}-chunk-1`,
    `${sourceId}-chunk-10`,
  ];

  const result = await namespace.fetch(vectorIds);

  for (const [id, vector] of Object.entries(result.records || {})) {
    console.log(`Vector: ${id}`);
    console.log(`  Metadata keys: ${Object.keys(vector.metadata || {}).join(', ')}`);
    console.log(`  Has 'page' field: ${'page' in (vector.metadata || {})}`);
    if ('page' in (vector.metadata || {})) {
      console.log(`  Page value: ${(vector.metadata as Record<string, unknown>).page}`);
    }
    console.log('');
  }
}

main().catch(console.error);
