// scripts/check-pinecone-vectors.ts
// Check how many vectors exist in Pinecone for a source

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX!);

async function main() {
  const creatorId = process.argv[2] || 'sun_tzu';
  const sourceId = process.argv[3] || 'art_of_war';

  console.log(`Checking vectors in namespace: creator-${creatorId}`);
  console.log(`Looking for vectors with prefix: ${sourceId}-chunk-\n`);

  const namespace = pineconeIndex.namespace(`creator-${creatorId}`);

  // Get namespace stats
  const stats = await pineconeIndex.describeIndexStats();
  console.log('Index stats:', JSON.stringify(stats, null, 2));

  // List all vectors with the prefix, handling pagination
  let allVectorIds: string[] = [];
  let paginationToken: string | undefined;

  do {
    const response = await namespace.listPaginated({
      prefix: `${sourceId}-chunk-`,
      paginationToken,
    });

    if (response.vectors) {
      allVectorIds = allVectorIds.concat(response.vectors.map((v) => v.id));
    }

    paginationToken = response.pagination?.next;
    console.log(`Fetched batch, total vectors so far: ${allVectorIds.length}`);
  } while (paginationToken);

  console.log(`\nTotal vectors found with prefix "${sourceId}-chunk-": ${allVectorIds.length}`);

  if (allVectorIds.length > 0) {
    console.log('\nFirst 10 vector IDs:');
    allVectorIds.slice(0, 10).forEach((id) => console.log(`  - ${id}`));
    console.log('\nLast 10 vector IDs:');
    allVectorIds.slice(-10).forEach((id) => console.log(`  - ${id}`));
  }
}

main().catch(console.error);
