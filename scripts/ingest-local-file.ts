// scripts/ingest-local-file.ts
// Ingestion of a local file - uploads to Vercel Blob then processes
// Usage: npx tsx scripts/ingest-local-file.ts

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import fs from 'fs';
import path from 'path';
import { put } from '@vercel/blob';
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
  authors?: string;
  year?: number;
  license?: string;
  licenseUrl?: string;
  sourceUrl?: string;
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
    update: {
      title: sourceTitle,
      authors: config.authors,
      year: config.year,
      license: config.license,
      licenseUrl: config.licenseUrl,
      sourceUrl: config.sourceUrl,
    },
    create: {
      id: sourceId,
      title: sourceTitle,
      creatorId: creatorId,
      authors: config.authors,
      year: config.year,
      license: config.license,
      licenseUrl: config.licenseUrl,
      sourceUrl: config.sourceUrl,
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
      ...(chunk.page !== undefined && { page: chunk.page }),
    },
  }));

  // 6. Upsert to Pinecone
  console.log('6. Upserting to Pinecone...');
  console.log(`   Namespace: creator-${creatorId}`);
  await upsertWithRetry(vectors, creatorId, 3);
  console.log(`   Upserted ${vectors.length} vectors`);

  // 7. Upload to Vercel Blob
  console.log('7. Uploading to Vercel Blob...');
  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(absolutePath).size;
  const fileContent = fs.readFileSync(absolutePath);
  const blobPath = `sources/${sourceId}/${fileName}`;

  const blob = await put(blobPath, fileContent, {
    access: 'public',
    contentType: 'text/plain',
    allowOverwrite: true,
  });
  console.log(`   Uploaded to: ${blob.url}`);

  // 8. Create file record
  console.log('8. Creating file record...');
  const file = await prisma.file.upsert({
    where: { id: `file_${sourceId}` },
    update: {
      status: 'READY',
      fileUrl: blob.url,
      fileSize: fileSize,
    },
    create: {
      id: `file_${sourceId}`,
      sourceId: sourceId,
      creatorId: creatorId,
      fileName: fileName,
      fileUrl: blob.url,
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

// Choose which source to ingest based on CLI arg, or default to scrum guide
const SOURCE_CONFIGS: Record<string, IngestConfig> = {
  scrum_guide: {
    filePath: 'MVP_Sources/scrum_guide_2020.md',
    sourceId: 'scrum_guide',
    sourceTitle: 'Scrum Guide 2020',
    creatorId: 'scrum_genius',
    authors: 'Ken Schwaber & Jeff Sutherland',
    year: 2020,
    license: 'CC-BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourceUrl: 'https://scrumguides.org/scrum-guide.html',
  },
  ebm_guide: {
    filePath: 'MVP_Sources/The_Evidence_Based_Management_Guide.md',
    sourceId: 'ebm_guide',
    sourceTitle: 'The Evidence-Based Management Guide',
    creatorId: 'scrum_genius',
    authors: 'Scrum.org, Ken Schwaber & Christina Schwaber',
    year: 2024,
    license: 'CC-BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourceUrl: 'https://www.scrum.org/resources/evidence-based-management-guide',
  },
  nexus_guide: {
    filePath: 'MVP_Sources/Nexus_Guide.md',
    sourceId: 'nexus_guide',
    sourceTitle: 'The Nexus Guide',
    creatorId: 'scrum_genius',
    authors: 'Ken Schwaber & Scrum.org',
    year: 2021,
    license: 'CC-BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourceUrl: 'https://www.scrum.org/resources/nexus-guide',
  },
  invest_framework: {
    filePath: 'MVP_Sources/INVEST_1.md',
    sourceId: 'invest_framework',
    sourceTitle: 'INVEST Framework for User Story Quality',
    creatorId: 'scrum_genius',
  },
};

const sourceKey = process.argv[2] || 'scrum_guide';
const config = SOURCE_CONFIGS[sourceKey];

if (!config) {
  console.error(`Unknown source: ${sourceKey}`);
  console.error(`Available sources: ${Object.keys(SOURCE_CONFIGS).join(', ')}`);
  process.exit(1);
}

ingestLocalFile(config)
  .then((result) => {
    console.log('\nResult:', result);
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect());
