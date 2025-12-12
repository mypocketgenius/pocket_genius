// Seed script for MVP - Phase 1, Task 11
// Creates test user, creator, chatbot, and source for development
// Uses environment variables to avoid committing real credentials to git

// Load environment variables FIRST (before importing Prisma)
// This ensures DATABASE_URL is available when Prisma Client is instantiated
// Works even if dotenv-cli doesn't properly set env vars for tsx
import dotenv from 'dotenv';
import path from 'path';

// Try .env.local first (Next.js convention), then .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

// Debug: Verify DATABASE_URL is loaded (only log first few chars for security)
if (process.env.DATABASE_URL) {
  const dbUrlPreview = process.env.DATABASE_URL.substring(0, 20) + '...';
  console.log(`✓ DATABASE_URL loaded (length: ${process.env.DATABASE_URL.length}, preview: ${dbUrlPreview})`);
} else {
  console.error('✗ DATABASE_URL not found in environment variables');
}

// Use the Prisma singleton from lib/prisma.ts which handles env vars correctly
// This ensures consistency with the rest of the application
import { prisma } from '../lib/prisma';

async function main() {
  console.log('🌱 Starting seed...');

  // Validate required environment variables
  if (!process.env.SEED_USER_CLERK_ID) {
    throw new Error(
      'SEED_USER_CLERK_ID environment variable is required.\n' +
      'Add it to your .env.local file. Get your Clerk ID from Clerk dashboard → Users → Your User'
    );
  }
  if (!process.env.SEED_USER_EMAIL) {
    throw new Error(
      'SEED_USER_EMAIL environment variable is required.\n' +
      'Add it to your .env.local file.'
    );
  }

  // Create test user using YOUR Clerk account
  // This allows you to actually log in and test the dashboard
  // For production: Create real user via Clerk UI first, then manually link to creator
  const testUser = await prisma.user.upsert({
    where: { clerkId: process.env.SEED_USER_CLERK_ID },
    update: {},
    create: {
      clerkId: process.env.SEED_USER_CLERK_ID,
      email: process.env.SEED_USER_EMAIL,
      firstName: process.env.SEED_USER_FIRST_NAME || undefined,
      lastName: process.env.SEED_USER_LAST_NAME || undefined,
    },
  });

  console.log('✅ Created test user:', testUser.email);

  // Create creator
  const creator = await prisma.creator.upsert({
    where: { id: 'creator_sun_tzu' },
    update: {},
    create: {
      id: 'creator_sun_tzu',
      name: 'Sun Tzu',
    },
  });

  console.log('✅ Created creator:', creator.name);

  // Link user to creator via Creator_User
  await prisma.creator_User.upsert({
    where: {
      creatorId_userId: {
        creatorId: creator.id,
        userId: testUser.id,
      },
    },
    update: {
      role: 'OWNER',
    },
    create: {
      creatorId: creator.id,
      userId: testUser.id,
      role: 'OWNER',
    },
  });

  console.log('✅ Linked user to creator');

  // Create chatbot
  const chatbot = await prisma.chatbot.upsert({
    where: { id: 'chatbot_art_of_war' },
    update: {},
    create: {
      id: 'chatbot_art_of_war',
      title: 'Art of War Deep Dive',
      creatorId: creator.id,
    },
  });

  console.log('✅ Created chatbot:', chatbot.title);

  // Create source
  const source = await prisma.source.upsert({
    where: { id: 'source_art_of_war' },
    update: {},
    create: {
      id: 'source_art_of_war',
      title: 'The Art of War',
      creatorId: creator.id,
      chatbotId: chatbot.id,
    },
  });

  console.log('✅ Created source:', source.title);

  console.log('\n🎉 Seed completed successfully!');
  console.log('\nSummary:');
  console.log(`  - User: ${testUser.email} (${testUser.clerkId})`);
  console.log(`  - Creator: ${creator.name}`);
  console.log(`  - Chatbot: ${chatbot.title}`);
  console.log(`  - Source: ${source.title}`);
  console.log('\nNext steps:');
  console.log('  1. Upload Art of War PDF to this source');
  console.log('  2. Wait for ingestion to complete');
  console.log(`  3. Visit /chat/${chatbot.id} to test`);
  console.log(`  4. Visit /dashboard/${chatbot.id} to see analytics`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
