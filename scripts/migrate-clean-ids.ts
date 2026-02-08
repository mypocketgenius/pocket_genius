// scripts/migrate-clean-ids.ts
// Migration script to clean up old IDs and re-ingest with proper naming
// Usage: npx tsx scripts/migrate-clean-ids.ts

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

import { prisma } from '../lib/prisma';
import { del, list } from '@vercel/blob';
import { getPineconeIndex } from '../lib/pinecone/client';
import { put } from '@vercel/blob';
import { extractTextFromUrl } from '../lib/extraction/text';
import { smartChunk } from '../lib/chunking/markdown';
import { generateEmbeddings } from '../lib/embeddings';
import { upsertWithRetry, type PineconeVector } from '../lib/pinecone';
import { env } from '../lib/env';

const EMBEDDING_BATCH_SIZE = 100;

// Old IDs to clean up
const OLD_IDS = {
  creator: 'creator_sun_tzu',
  chatbot: 'chatbot_art_of_war',
  sources: ['source_art_of_war', 'source_scrum_guide'],
};

// New clean IDs
const NEW_IDS = {
  creator: 'sun_tzu',
  chatbot: 'art_of_war',
  sources: {
    art_of_war: { title: 'The Art of War', file: './MVP_Sources/The_Art_of_War.md' },
    scrum_guide: { title: 'Scrum Guide 2020', file: './MVP_Sources/scrum_guide_2020.md' },
  },
};

// Old Pinecone namespaces to delete
const OLD_NAMESPACES = [
  'creator-creator_sun_tzu',  // Redundant naming from recent ingestion
  'chatbot-chatbot_art_of_war', // Old chatbot-based namespace (if exists)
];

async function deleteOldBlobFiles() {
  console.log('\n🗑️  Cleaning up old Blob files...');

  try {
    // List all blobs in the sources folder
    const { blobs } = await list({ prefix: 'sources/' });

    // Find blobs with old source IDs
    const oldPrefixes = OLD_IDS.sources.map(id => `sources/${id}/`);
    const blobsToDelete = blobs.filter(blob =>
      oldPrefixes.some(prefix => blob.pathname.startsWith(prefix))
    );

    if (blobsToDelete.length === 0) {
      console.log('   No old blob files found');
      return;
    }

    console.log(`   Found ${blobsToDelete.length} old blob files:`);
    for (const blob of blobsToDelete) {
      console.log(`   - ${blob.pathname}`);
      await del(blob.url);
    }
    console.log('   ✅ Old blob files deleted');
  } catch (error) {
    console.error('   ⚠️  Error cleaning blob files:', error);
  }
}

async function deleteOldPineconeNamespaces() {
  console.log('\n🗑️  Cleaning up old Pinecone namespaces...');

  const index = getPineconeIndex(env.PINECONE_INDEX);

  for (const namespace of OLD_NAMESPACES) {
    try {
      console.log(`   Deleting namespace: ${namespace}`);
      const ns = index.namespace(namespace);
      await ns.deleteAll();
      console.log(`   ✅ Deleted: ${namespace}`);
    } catch (error) {
      // Namespace might not exist, which is fine
      console.log(`   ⚠️  Could not delete ${namespace} (may not exist)`);
    }
  }
}

async function deleteOldDatabaseRecords() {
  console.log('\n🗑️  Cleaning up old database records...');

  // Delete in order to respect foreign key constraints
  // Files, Chatbot_Source, Sources, Chatbot, Creator_User, Creator

  // 1. Delete files for old sources
  for (const sourceId of OLD_IDS.sources) {
    const deleted = await prisma.file.deleteMany({
      where: { sourceId },
    });
    if (deleted.count > 0) {
      console.log(`   Deleted ${deleted.count} files for source ${sourceId}`);
    }
  }

  // 2. Delete Chatbot_Source links
  const chatbotSourceDeleted = await prisma.chatbot_Source.deleteMany({
    where: {
      OR: [
        { chatbotId: OLD_IDS.chatbot },
        { sourceId: { in: OLD_IDS.sources } },
      ],
    },
  });
  if (chatbotSourceDeleted.count > 0) {
    console.log(`   Deleted ${chatbotSourceDeleted.count} chatbot-source links`);
  }

  // 3. Delete sources
  for (const sourceId of OLD_IDS.sources) {
    try {
      await prisma.source.delete({ where: { id: sourceId } });
      console.log(`   Deleted source: ${sourceId}`);
    } catch {
      // Source might not exist
    }
  }

  // 4. Delete chatbot categories
  await prisma.chatbot_Category.deleteMany({
    where: { chatbotId: OLD_IDS.chatbot },
  });

  // 5. Delete chatbot
  try {
    await prisma.chatbot.delete({ where: { id: OLD_IDS.chatbot } });
    console.log(`   Deleted chatbot: ${OLD_IDS.chatbot}`);
  } catch {
    // Chatbot might not exist
  }

  // 6. Delete creator-user links
  await prisma.creator_User.deleteMany({
    where: { creatorId: OLD_IDS.creator },
  });

  // 7. Delete creator
  try {
    await prisma.creator.delete({ where: { id: OLD_IDS.creator } });
    console.log(`   Deleted creator: ${OLD_IDS.creator}`);
  } catch {
    // Creator might not exist
  }

  console.log('   ✅ Old database records cleaned up');
}

async function uploadAndIngestFile(
  sourceId: string,
  sourceTitle: string,
  localPath: string,
  creatorId: string
) {
  console.log(`\n📄 Processing: ${localPath}`);

  // 1. Read local file
  const absolutePath = path.resolve(process.cwd(), localPath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`   ❌ File not found: ${absolutePath}`);
    return;
  }

  const fileContent = fs.readFileSync(absolutePath, 'utf-8');
  const fileName = path.basename(localPath);
  const fileSize = Buffer.byteLength(fileContent, 'utf-8');

  console.log(`   File size: ${(fileSize / 1024).toFixed(2)} KB`);

  // 2. Ensure source exists
  const source = await prisma.source.upsert({
    where: { id: sourceId },
    update: {},
    create: {
      id: sourceId,
      title: sourceTitle,
      creatorId: creatorId,
    },
  });
  console.log(`   ✅ Source ready: ${source.title}`);

  // 3. Upload to Vercel Blob
  console.log(`   ⬆️ Uploading to Vercel Blob...`);
  const blobPath = `sources/${sourceId}/${fileName}`;
  const blob = await put(blobPath, fileContent, {
    access: 'public',
    contentType: 'text/markdown',
  });
  console.log(`   ✅ Uploaded: ${blob.url}`);

  // 4. Create File record
  const fileRecord = await prisma.file.create({
    data: {
      sourceId: sourceId,
      creatorId: creatorId,
      fileName: fileName,
      fileUrl: blob.url,
      fileSize: fileSize,
      status: 'PROCESSING',
    },
  });
  console.log(`   ✅ Created file record: ${fileRecord.id}`);

  // 5. Run ingestion
  console.log(`   🔄 Running ingestion pipeline...`);
  try {
    const text = await extractTextFromUrl(blob.url);
    console.log(`   📝 Extracted ${text.length} characters`);

    const textChunks = smartChunk(text);
    console.log(`   📦 Created ${textChunks.length} chunks`);

    console.log(`   🧠 Generating embeddings...`);
    const chunkTexts = textChunks.map((chunk) => chunk.text);
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < chunkTexts.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = chunkTexts.slice(i, i + EMBEDDING_BATCH_SIZE);
      const batchEmbeddings = await generateEmbeddings(batch);
      allEmbeddings.push(...batchEmbeddings);
      console.log(`      Batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1}: ${batch.length} embeddings`);
    }

    const vectors: PineconeVector[] = textChunks.map((chunk, index) => ({
      id: `${sourceId}-chunk-${index}`,
      values: allEmbeddings[index],
      metadata: {
        text: chunk.text,
        sourceId: sourceId,
        sourceTitle: sourceTitle,
        ...(chunk.page !== undefined && { page: chunk.page }),
        ...(chunk.section !== undefined && { section: chunk.section }),
      },
    }));

    console.log(`   📌 Upserting ${vectors.length} vectors to Pinecone (namespace: creator-${creatorId})...`);
    await upsertWithRetry(vectors, creatorId, 3);

    await prisma.file.update({
      where: { id: fileRecord.id },
      data: { status: 'READY' },
    });

    console.log(`   ✅ Ingestion complete!`);
  } catch (error) {
    await prisma.file.update({
      where: { id: fileRecord.id },
      data: { status: 'ERROR' },
    });
    console.error(`   ❌ Ingestion failed:`, error);
    throw error;
  }
}

async function runSeed() {
  console.log('\n🌱 Running seed to create new records with clean IDs...');

  // Import and run seed logic inline (simplified version)
  const testUser = await prisma.user.findFirst({
    where: { clerkId: process.env.SEED_USER_CLERK_ID },
  });

  if (!testUser) {
    console.log('   ⚠️  Seed user not found. Please run the full seed first.');
    return;
  }

  // Create creator with clean ID
  const creator = await prisma.creator.upsert({
    where: { id: NEW_IDS.creator },
    update: {
      slug: 'sun-tzu',
      bio: 'Ancient Chinese military strategist and philosopher, author of The Art of War.',
      shortBio: 'Ancient Chinese military strategist and philosopher',
    },
    create: {
      id: NEW_IDS.creator,
      name: 'Sun Tzu',
      slug: 'sun-tzu',
      bio: 'Ancient Chinese military strategist and philosopher, author of The Art of War.',
      shortBio: 'Ancient Chinese military strategist and philosopher',
    },
  });
  console.log(`   ✅ Created creator: ${creator.id}`);

  // Link user to creator
  await prisma.creator_User.upsert({
    where: {
      creatorId_userId: {
        creatorId: creator.id,
        userId: testUser.id,
      },
    },
    update: { role: 'OWNER' },
    create: {
      creatorId: creator.id,
      userId: testUser.id,
      role: 'OWNER',
    },
  });
  console.log(`   ✅ Linked user to creator`);

  // Create chatbot with clean ID
  const chatbot = await prisma.chatbot.upsert({
    where: { id: NEW_IDS.chatbot },
    update: {
      slug: 'art-of-war',
      isPublic: true,
      isActive: true,
      allowAnonymous: true,
      publicDashboard: true,
      type: 'DEEP_DIVE',
    },
    create: {
      id: NEW_IDS.chatbot,
      title: 'Art of War Deep Dive',
      creatorId: creator.id,
      slug: 'art-of-war',
      description: 'A deep dive into Sun Tzu\'s timeless military strategy classic.',
      shortDescription: 'Explore timeless military strategy and philosophy with Sun Tzu',
      isPublic: true,
      isActive: true,
      allowAnonymous: true,
      publicDashboard: true,
      type: 'DEEP_DIVE',
      priceCents: 0,
      currency: 'USD',
    },
  });
  console.log(`   ✅ Created chatbot: ${chatbot.id}`);

  return { creator, chatbot };
}

async function main() {
  console.log('🚀 Migration: Clean IDs and Re-ingestion\n');
  console.log('This will:');
  console.log('1. Delete old Blob files (sources/source_*/...)');
  console.log('2. Delete old Pinecone namespaces (creator-creator_*, chatbot-*)');
  console.log('3. Delete old database records');
  console.log('4. Create new records with clean IDs');
  console.log('5. Re-ingest files to new namespace (creator-sun_tzu)');
  console.log('');

  // Step 1: Clean up old blob files
  await deleteOldBlobFiles();

  // Step 2: Clean up old Pinecone namespaces
  await deleteOldPineconeNamespaces();

  // Step 3: Clean up old database records
  await deleteOldDatabaseRecords();

  // Step 4: Create new records with clean IDs
  const seedResult = await runSeed();
  if (!seedResult) {
    throw new Error('Seed failed');
  }

  // Step 5: Upload and ingest files
  for (const [sourceId, config] of Object.entries(NEW_IDS.sources)) {
    await uploadAndIngestFile(
      sourceId,
      config.title,
      config.file,
      seedResult.creator.id
    );

    // Link source to chatbot
    await prisma.chatbot_Source.upsert({
      where: {
        chatbotId_sourceId: {
          chatbotId: seedResult.chatbot.id,
          sourceId: sourceId,
        },
      },
      update: {},
      create: {
        chatbotId: seedResult.chatbot.id,
        sourceId: sourceId,
        isActive: true,
      },
    });
    console.log(`   ✅ Linked source ${sourceId} to chatbot`);
  }

  console.log('\n🎉 Migration complete!');
  console.log(`\nNew namespace: creator-${seedResult.creator.id}`);
  console.log(`Chatbot ID: ${seedResult.chatbot.id}`);
  console.log(`Test at: /chat/${seedResult.chatbot.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
