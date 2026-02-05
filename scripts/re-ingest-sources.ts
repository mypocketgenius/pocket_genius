// scripts/re-ingest-sources.ts
// Deletes vectors from Pinecone and re-triggers ingestion for specified sources
// Usage: npx tsx scripts/re-ingest-sources.ts "Art of War" "Scrum Guide"

// Load env first before any other imports
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pinecone } from '@pinecone-database/pinecone';

// Create Prisma client directly (avoid lib/prisma which may import lib/env)
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Create Pinecone client directly
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX!);

async function main() {
  const sourceTitles = process.argv.slice(2);

  if (sourceTitles.length === 0) {
    console.log('Usage: npx tsx scripts/re-ingest-sources.ts "Source Title 1" "Source Title 2"');
    console.log('\nAvailable sources:');
    const sources = await prisma.source.findMany({
      select: { id: true, title: true, creatorId: true },
    });
    sources.forEach((s) => console.log(`  - "${s.title}" (id: ${s.id}, creatorId: ${s.creatorId})`));
    process.exit(0);
  }

  console.log(`Looking for sources: ${sourceTitles.join(', ')}\n`);

  // Find sources by title (case-insensitive partial match)
  const sources = await prisma.source.findMany({
    where: {
      OR: sourceTitles.map((title) => ({
        title: { contains: title, mode: 'insensitive' as const },
      })),
    },
    include: {
      files: true,
    },
  });

  if (sources.length === 0) {
    console.log('No matching sources found.');
    process.exit(1);
  }

  console.log(`Found ${sources.length} source(s):\n`);

  for (const source of sources) {
    console.log(`Processing: "${source.title}" (id: ${source.id})`);
    console.log(`  Creator ID: ${source.creatorId}`);
    console.log(`  Files: ${source.files.length}`);

    // 1. Delete vectors from Pinecone
    const namespace = pineconeIndex.namespace(`creator-${source.creatorId}`);

    try {
      // Delete by ID prefix (all chunks for this source)
      console.log(`  Deleting vectors with prefix: ${source.id}-chunk-*`);

      // List ALL vectors with pagination
      let allVectorIds: string[] = [];
      let paginationToken: string | undefined;

      do {
        const response = await namespace.listPaginated({
          prefix: `${source.id}-chunk-`,
          paginationToken,
        });

        if (response.vectors) {
          allVectorIds = allVectorIds.concat(
            response.vectors.map((v) => v.id).filter((id): id is string => id !== undefined)
          );
        }

        paginationToken = response.pagination?.next;
      } while (paginationToken);

      if (allVectorIds.length > 0) {
        console.log(`  Found ${allVectorIds.length} vectors to delete`);

        // Delete in batches of 100
        for (let i = 0; i < allVectorIds.length; i += 100) {
          const batch = allVectorIds.slice(i, i + 100);
          await namespace.deleteMany(batch);
          console.log(`  Deleted batch ${Math.floor(i / 100) + 1} (${batch.length} vectors)`);
        }
        console.log(`  Successfully deleted all ${allVectorIds.length} vectors`);
      } else {
        console.log('  No vectors found with that prefix (may have been deleted already)');
      }
    } catch (error) {
      console.log(`  Error deleting vectors: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Continue anyway - vectors might not exist
    }

    // 2. Reset file statuses to PENDING
    for (const file of source.files) {
      await prisma.file.update({
        where: { id: file.id },
        data: { status: 'PENDING' },
      });
      console.log(`  Reset file "${file.fileName}" to PENDING`);
    }

    console.log('');
  }

  console.log('Done! Now you need to re-trigger ingestion for these files.');
  console.log('You can do this by:');
  console.log('  1. Visiting the admin/sources page and clicking "Reprocess" on each file');
  console.log('  2. Or running: curl -X POST http://localhost:3000/api/ingestion/trigger -H "Content-Type: application/json" -d \'{"fileId": "<FILE_ID>"}\'');

  // Show file IDs for manual ingestion
  console.log('\nFile IDs for manual ingestion:');
  for (const source of sources) {
    for (const file of source.files) {
      console.log(`  - ${file.id} (${file.fileName})`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
