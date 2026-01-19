// scripts/verify-production.ts
// Script to verify production setup is complete
// Usage: npx tsx scripts/verify-production.ts

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables (expects production DATABASE_URL)
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
}

import { prisma } from '../lib/prisma';

const EXPECTED_IDS = {
  creator: 'creator_sun_tzu',
  chatbot: 'chatbot_art_of_war',
  source: 'source_art_of_war',
};

async function verifyProduction() {
  console.log('🔍 Verifying production setup...\n');

  const checks = {
    user: false,
    creator: false,
    creatorUser: false,
    chatbot: false,
    source: false,
    file: false,
    fileReady: false,
  };

  try {
    // Check User exists
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      checks.user = true;
      console.log('✅ User exists');
    } else {
      console.log('❌ No users found');
    }

    // Check Creator exists
    const creator = await prisma.creator.findUnique({
      where: { id: EXPECTED_IDS.creator },
    });
    if (creator) {
      checks.creator = true;
      console.log(`✅ Creator exists: ${creator.name}`);
    } else {
      console.log(`❌ Creator not found: ${EXPECTED_IDS.creator}`);
    }

    // Check Creator_User link exists
    const creatorUserCount = await prisma.creator_User.count({
      where: { creatorId: EXPECTED_IDS.creator },
    });
    if (creatorUserCount > 0) {
      checks.creatorUser = true;
      console.log('✅ Creator-User link exists');
    } else {
      console.log('❌ Creator-User link not found');
    }

    // Check Chatbot exists
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: EXPECTED_IDS.chatbot },
    });
    if (chatbot) {
      checks.chatbot = true;
      console.log(`✅ Chatbot exists: ${chatbot.title}`);
    } else {
      console.log(`❌ Chatbot not found: ${EXPECTED_IDS.chatbot}`);
    }

    // Check Source exists
    const source = await prisma.source.findUnique({
      where: { id: EXPECTED_IDS.source },
    });
    if (source) {
      checks.source = true;
      console.log(`✅ Source exists: ${source.title}`);
    } else {
      console.log(`❌ Source not found: ${EXPECTED_IDS.source}`);
    }

    // Check File exists
    const files = await prisma.file.findMany({
      where: { sourceId: EXPECTED_IDS.source },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    if (files.length > 0) {
      checks.file = true;
      const file = files[0];
      console.log(`✅ File exists: ${file.fileName}`);
      console.log(`   Status: ${file.status}`);
      console.log(`   Size: ${(file.fileSize / 1024).toFixed(2)} KB`);
      console.log(`   URL: ${file.fileUrl}`);

      if (file.status === 'READY') {
        checks.fileReady = true;
        console.log('✅ File is ready (ingestion complete)');
      } else if (file.status === 'PROCESSING') {
        console.log('⏳ File is still processing...');
      } else {
        console.log(`⚠️  File status is ${file.status} (expected READY)`);
      }
    } else {
      console.log('❌ No files found for source');
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log(`   Database seeded: ${checks.user && checks.creator && checks.chatbot && checks.source ? '✅' : '❌'}`);
    console.log(`   File uploaded: ${checks.file ? '✅' : '❌'}`);
    console.log(`   Ingestion complete: ${checks.fileReady ? '✅' : '❌'}`);

    const allComplete =
      checks.user &&
      checks.creator &&
      checks.creatorUser &&
      checks.chatbot &&
      checks.source &&
      checks.file &&
      checks.fileReady;

    if (allComplete) {
      console.log('\n🎉 Production setup is complete!');
      console.log(`\n🚀 Next steps:`);
      console.log(`   1. Test chat: https://your-app.vercel.app/chat/${EXPECTED_IDS.chatbot}`);
      console.log(`   2. Check dashboard: https://your-app.vercel.app/dashboard/${EXPECTED_IDS.chatbot}`);
    } else {
      console.log('\n⚠️  Production setup is incomplete.');
      console.log(`\n📝 Missing:`);
      if (!checks.user) console.log('   - Users');
      if (!checks.creator) console.log('   - Creator');
      if (!checks.creatorUser) console.log('   - Creator-User link');
      if (!checks.chatbot) console.log('   - Chatbot');
      if (!checks.source) console.log('   - Source');
      if (!checks.file) console.log('   - File upload');
      if (!checks.fileReady) console.log('   - File ingestion (file exists but not READY)');
      console.log(`\n📖 See PRODUCTION_SETUP.md for setup instructions.`);
    }
  } catch (error) {
    console.error('❌ Verification failed:', error);
    if (error instanceof Error) {
      console.error('   Error:', error.message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyProduction();









