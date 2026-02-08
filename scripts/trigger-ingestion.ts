// scripts/trigger-ingestion.ts
// Directly trigger ingestion for files without going through the API (no auth needed)
// Usage: npx tsx scripts/trigger-ingestion.ts <fileId1> <fileId2> ...

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

// Create clients directly
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Import chunking (doesn't use env validation)
import { smartChunk } from '../lib/chunking/markdown';

const EMBEDDING_BATCH_SIZE = 100;

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });
  return response.data.map((d) => d.embedding);
}

async function processFile(fileId: string) {
  console.log(`\nProcessing file: ${fileId}`);

  // Get file with source
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    include: { source: true },
  });

  if (!file) {
    console.log(`  File not found: ${fileId}`);
    return;
  }

  console.log(`  File: ${file.fileName}`);
  console.log(`  Source: ${file.source.title}`);
  console.log(`  Status: ${file.status}`);

  // Update status to PROCESSING
  await prisma.file.update({
    where: { id: fileId },
    data: { status: 'PROCESSING' },
  });

  try {
    // Fetch file content from Vercel Blob or local file
    console.log(`  Fetching content from: ${file.fileUrl}`);
    let text: string;
    if (file.fileUrl.startsWith('local://')) {
      // Handle local files
      const fs = await import('fs/promises');
      const localPath = file.fileUrl.replace('local://', '');
      text = await fs.readFile(localPath, 'utf-8');
    } else {
      // Handle remote URLs (Vercel Blob)
      const response = await fetch(file.fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }
      text = await response.text();
    }
    console.log(`  Text length: ${text.length} characters`);

    // Chunk the text
    const textChunks = smartChunk(text);
    console.log(`  Chunks created: ${textChunks.length}`);

    // Generate embeddings in batches
    console.log(`  Generating embeddings...`);
    const chunkTexts = textChunks.map((chunk) => chunk.text);
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < chunkTexts.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = chunkTexts.slice(i, i + EMBEDDING_BATCH_SIZE);
      const batchEmbeddings = await generateEmbeddings(batch);
      allEmbeddings.push(...batchEmbeddings);
      console.log(`    Batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1}: ${batch.length} embeddings`);
    }

    // Prepare vectors
    const vectors = textChunks.map((chunk, index) => ({
      id: `${file.sourceId}-chunk-${index}`,
      values: allEmbeddings[index],
      metadata: {
        text: chunk.text,
        sourceId: file.sourceId,
        sourceTitle: file.source.title,
        ...(chunk.page !== undefined && { page: chunk.page }),
        ...(chunk.section !== undefined && { section: chunk.section }),
      },
    }));

    // Upsert to Pinecone
    console.log(`  Upserting ${vectors.length} vectors to Pinecone...`);
    const namespace = pineconeIndex.namespace(`creator-${file.source.creatorId}`);

    // Upsert in batches of 100
    for (let i = 0; i < vectors.length; i += 100) {
      const batch = vectors.slice(i, i + 100);
      await namespace.upsert(batch);
      console.log(`    Batch ${Math.floor(i / 100) + 1}: ${batch.length} vectors`);
    }

    // Update status to READY
    await prisma.file.update({
      where: { id: fileId },
      data: { status: 'READY' },
    });

    console.log(`  ✓ Done! Status: READY`);
  } catch (error) {
    console.error(`  ✗ Error:`, error instanceof Error ? error.message : error);
    await prisma.file.update({
      where: { id: fileId },
      data: { status: 'ERROR' },
    });
  }
}

async function main() {
  const fileIds = process.argv.slice(2);

  if (fileIds.length === 0) {
    console.log('Usage: npx tsx scripts/trigger-ingestion.ts <fileId1> <fileId2> ...');
    console.log('\nPending files:');
    const pendingFiles = await prisma.file.findMany({
      where: { status: 'PENDING' },
      include: { source: true },
    });
    pendingFiles.forEach((f) =>
      console.log(`  - ${f.id} (${f.fileName}) - Source: ${f.source.title}`)
    );
    process.exit(0);
  }

  for (const fileId of fileIds) {
    await processFile(fileId);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
