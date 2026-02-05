// scripts/ingest-local-file.ts
// Direct ingestion of a local file without Vercel Blob
// Usage: npx tsx scripts/ingest-local-file.ts

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { chunkText } from '../lib/chunking/text';
import { generateEmbeddings } from '../lib/embeddings';
import { upsertWithRetry, type PineconeVector } from '../lib/pinecone';

const EMBEDDING_BATCH_SIZE = 100;

interface IngestConfig {
  filePath: string;
  sourceId: string;
  sourceTitle: string;
  creatorId: string;
}

async function ingestLocalFile(config: IngestConfig) {
  const { filePath, sourceId, sourceTitle, creatorId } = config;

  console.log('📄 Ingesting local file:', filePath);
  console.log('   Source ID:', sourceId);
  console.log('   Creator ID:', creatorId);
  console.log('');

  // 1. Read local file
  console.log('1. Reading file...');
  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }
  const text = fs.readFileSync(absolutePath, 'utf-8');
  console.log(`   Read ${text.length} characters`);

  // 2. Create/update source record
  console.log('2. Creating source record...');
  const source = await prisma.source.upsert({
    where: { id: sourceId },
    update: { title: sourceTitle },
    create: {
      id: sourceId,
      title: sourceTitle,
      creatorId: creatorId,
    },
  });
  console.log('   Source:', source.id);

  // 3. Chunk text
  console.log('3. Chunking text...');
  const textChunks = chunkText(text, 1000);
  console.log(`   Created ${textChunks.length} chunks`);

  // 4. Generate embeddings
  console.log('4. Generating embeddings...');
  const chunkTexts = textChunks.map((chunk) => chunk.text);
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < chunkTexts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = chunkTexts.slice(i, i + EMBEDDING_BATCH_SIZE);
    console.log(`   Processing batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1}...`);
    const batchEmbeddings = await generateEmbeddings(batch);
    allEmbeddings.push(...batchEmbeddings);
  }
  console.log(`   Generated ${allEmbeddings.length} embeddings`);

  // 5. Prepare vectors
  console.log('5. Preparing vectors...');
  const vectors: PineconeVector[] = textChunks.map((chunk, index) => ({
    id: `${sourceId}-chunk-${index}`,
    values: allEmbeddings[index],
    metadata: {
      text: chunk.text,
      sourceId: sourceId,
      sourceTitle: sourceTitle,
      page: chunk.page,
    },
  }));

  // 6. Upsert to Pinecone
  console.log('6. Upserting to Pinecone...');
  console.log(`   Namespace: creator-${creatorId}`);
  await upsertWithRetry(vectors, creatorId, 3);
  console.log(`   Upserted ${vectors.length} vectors`);

  // 7. Create file record (for tracking)
  console.log('7. Creating file record...');
  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(absolutePath).size;

  const file = await prisma.file.upsert({
    where: { id: `file_${sourceId}` },
    update: { status: 'READY' },
    create: {
      id: `file_${sourceId}`,
      sourceId: sourceId,
      creatorId: creatorId,
      fileName: fileName,
      fileUrl: `local://${absolutePath}`, // Placeholder for local files
      fileSize: fileSize,
      status: 'READY',
    },
  });
  console.log('   File:', file.id);

  console.log('\n✅ Ingestion complete!');
  console.log(`   Vectors in namespace: creator-${creatorId}`);

  return {
    sourceId,
    fileId: file.id,
    chunksCreated: textChunks.length,
    vectorsUpserted: vectors.length,
  };
}

// Run for scrum guide
ingestLocalFile({
  filePath: 'MVP_Sources/scrum_guide_2020.md',
  sourceId: 'scrum_guide',
  sourceTitle: 'Scrum Guide 2020',
  creatorId: 'scrum_genius',
})
  .then((result) => {
    console.log('\nResult:', result);
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect());
