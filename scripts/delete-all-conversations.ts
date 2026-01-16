// scripts/delete-all-conversations.ts
// Script to delete all conversations for testing conversation management logic
// This will cascade delete all related messages and conversation feedback

import { prisma } from '@/lib/prisma';

async function deleteAllConversations() {
  console.log('⚠️  WARNING: This will delete ALL conversations from the database.');
  console.log('This will also cascade delete all related messages and conversation feedback.\n');
  
  try {
    // Count conversations before deletion
    const countBefore = await prisma.conversation.count();
    console.log(`Found ${countBefore} conversations to delete.\n`);
    
    if (countBefore === 0) {
      console.log('✅ No conversations found. Nothing to delete.');
      return;
    }
    
    // Delete all conversations (cascade will handle messages and feedback)
    console.log('Deleting all conversations...');
    const result = await prisma.conversation.deleteMany({});
    
    console.log(`\n✅ Successfully deleted ${result.count} conversations.`);
    
    // Verify deletion
    const countAfter = await prisma.conversation.count();
    if (countAfter === 0) {
      console.log('✅ Verification: All conversations deleted successfully.');
    } else {
      console.log(`⚠️  Warning: ${countAfter} conversations still remain.`);
    }
    
    // Also check messages (should be 0 due to cascade)
    const messageCount = await prisma.message.count();
    console.log(`📊 Remaining messages: ${messageCount} (should be 0 due to cascade delete)`);
    
    // Also check conversation feedback (should be 0 due to cascade)
    const feedbackCount = await prisma.conversation_Feedback.count();
    console.log(`📊 Remaining conversation feedback: ${feedbackCount} (should be 0 due to cascade delete)`);
    
  } catch (error) {
    console.error('❌ Error deleting conversations:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllConversations()
  .then(() => {
    console.log('\n✅ Script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

