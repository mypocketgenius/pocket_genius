// scripts/verify-chatbot-versioning-migration.ts
// Verification script for chatbot versioning migration
// Checks that all chatbots have versions and all conversations have chatbotVersionId

import { prisma } from '@/lib/prisma';

async function verifyMigration() {
  console.log('Chatbot Versioning Migration Verification');
  console.log('==========================================\n');

  try {
    // Check chatbot count
    const chatbotCount = await prisma.chatbot.count();
    console.log(`Total chatbots: ${chatbotCount}`);

    // Check chatbots with versions
    const chatbotsWithVersions = await prisma.chatbot.count({
      where: { currentVersionId: { not: null } },
    });
    console.log(`Chatbots with versions: ${chatbotsWithVersions}`);

    // Check conversation count
    const conversationCount = await prisma.conversation.count();
    console.log(`Total conversations: ${conversationCount}`);

    // Check conversations with chatbotVersionId (use raw query to check for non-null)
    const conversationsWithVersionResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint as count FROM "Conversation" WHERE "chatbotVersionId" IS NOT NULL
    `;
    const conversationsWithVersion = Number(conversationsWithVersionResult[0]?.count || 0);
    console.log(`Conversations with chatbotVersionId: ${conversationsWithVersion}`);

    // Check version count
    const versionCount = await prisma.chatbot_Version.count();
    console.log(`Total versions: ${versionCount}`);

    // Check for chatbots without versions
    const chatbotsWithoutVersions = await prisma.chatbot.findMany({
      where: { currentVersionId: null },
      select: { id: true, title: true },
    });

    // Check for conversations without chatbotVersionId (use raw query)
    const conversationsWithoutVersionResult = await prisma.$queryRaw<Array<{ id: string; chatbotId: string }>>`
      SELECT id, "chatbotId" FROM "Conversation" WHERE "chatbotVersionId" IS NULL LIMIT 10
    `;
    const conversationsWithoutVersion = conversationsWithoutVersionResult;

    console.log('\nVerification Results:');
    console.log('====================');

    if (chatbotsWithVersions === chatbotCount && chatbotsWithVersions > 0) {
      console.log('✅ All chatbots have versions');
    } else if (chatbotsWithVersions === 0) {
      console.log('❌ No chatbots have versions (data migration script may not have run)');
    } else {
      console.log(`⚠️  ${chatbotCount - chatbotsWithVersions} chatbots missing versions:`);
      chatbotsWithoutVersions.forEach((c) => {
        console.log(`   - ${c.title} (${c.id})`);
      });
    }

    if (conversationsWithVersion === conversationCount && conversationsWithVersion > 0) {
      console.log('✅ All conversations have chatbotVersionId');
    } else if (conversationsWithVersion === 0 && conversationCount > 0) {
      console.log('❌ No conversations have chatbotVersionId (data migration script may not have run)');
    } else if (conversationsWithoutVersion.length > 0) {
      console.log(`⚠️  ${conversationCount - conversationsWithVersion} conversations missing chatbotVersionId (showing first 10):`);
      conversationsWithoutVersion.forEach((c) => {
        console.log(`   - Conversation ${c.id} (chatbot: ${c.chatbotId})`);
      });
    } else if (conversationCount === 0) {
      console.log('ℹ️  No conversations found (this is OK if no chats have been created yet)');
    }

    if (versionCount > 0) {
      console.log(`✅ ${versionCount} versions created`);
    } else {
      console.log('❌ No versions found (data migration script may not have run)');
    }

    // Overall status
    console.log('\nOverall Status:');
    console.log('===============');
    const allGood =
      chatbotsWithVersions === chatbotCount &&
      (conversationsWithVersion === conversationCount || conversationCount === 0) &&
      versionCount > 0;

    if (allGood) {
      console.log('✅ Migration verification complete!');
      console.log('✅ All chatbots have versions');
      if (conversationCount > 0) {
        console.log('✅ All conversations have chatbotVersionId');
      }
      process.exit(0);
    } else {
      console.log('❌ Migration verification failed!');
      console.log('Please check the issues above and run the data migration script if needed:');
      console.log('  npx tsx prisma/migrations/add_chatbot_versioning_data.ts');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error during verification:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyMigration();

