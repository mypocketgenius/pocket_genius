import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Pinecone } from '@pinecone-database/pinecone';

async function main() {
  const sourceId = process.argv[2];
  const namespace = process.argv[3];
  const count = parseInt(process.argv[4] || '20', 10);

  if (!sourceId || !namespace) {
    console.error('Usage: npx tsx scripts/delete-source-vectors.ts <sourceId> <namespace> [maxChunks]');
    process.exit(1);
  }

  const client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  const index = client.index(process.env.PINECONE_INDEX!);
  const ns = index.namespace(namespace);

  const ids = Array.from({length: count}, (_, i) => `${sourceId}-chunk-${i}`);
  console.log(`Deleting up to ${count} vectors for source "${sourceId}" from namespace "${namespace}"...`);
  await ns.deleteMany(ids);
  console.log('Done.');
}
main().catch(console.error);
