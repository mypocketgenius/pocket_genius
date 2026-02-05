// scripts/upload-local-to-blob.ts
// Upload local files to Vercel Blob and update database records
// Usage: npx tsx scripts/upload-local-to-blob.ts

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { put } from '@vercel/blob';
import * as fs from 'fs/promises';

// Create Prisma client
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Looking for files with local:// URLs...\n');

  // Find all files with local:// URLs
  const localFiles = await prisma.file.findMany({
    where: {
      fileUrl: { startsWith: 'local://' },
    },
    include: { source: true },
  });

  if (localFiles.length === 0) {
    console.log('No files with local:// URLs found.');
    return;
  }

  console.log(`Found ${localFiles.length} file(s) to upload:\n`);

  for (const file of localFiles) {
    console.log(`Processing: ${file.fileName}`);
    console.log(`  Source: ${file.source.title}`);
    console.log(`  Current URL: ${file.fileUrl}`);

    const localPath = file.fileUrl.replace('local://', '');

    try {
      // Read the local file
      const content = await fs.readFile(localPath);
      console.log(`  File size: ${content.length} bytes`);

      // Upload to Vercel Blob
      const blobPath = `sources/${file.sourceId}/${file.fileName}`;
      console.log(`  Uploading to: ${blobPath}`);

      const blob = await put(blobPath, content, {
        access: 'public',
        contentType: 'text/plain',
      });

      console.log(`  Blob URL: ${blob.url}`);

      // Update the database record
      await prisma.file.update({
        where: { id: file.id },
        data: {
          fileUrl: blob.url,
          fileSize: content.length,
          status: 'PENDING', // Reset to pending for re-ingestion
        },
      });

      console.log(`  ✓ Updated database record\n`);
    } catch (error) {
      console.error(`  ✗ Error: ${error instanceof Error ? error.message : error}\n`);
    }
  }

  console.log('Done! Run the trigger-ingestion script to re-ingest the files.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
