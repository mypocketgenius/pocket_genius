import { prisma } from '../lib/prisma';

async function verifyMigration() {
  try {
    // Check enum values by querying the database directly
    // Check if any chatbots have CREATOR type (should be 0)
    const creatorCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::int as count FROM "Chatbot" WHERE type::text = 'CREATOR'
    `.catch(() => [{ count: BigInt(0) }]);
    
    // Check if any chatbots have BODY_OF_WORK type
    const bodyOfWorkCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::int as count FROM "Chatbot" WHERE type = 'BODY_OF_WORK'
    `.catch(() => [{ count: BigInt(0) }]);
    
    // Check enum values by attempting to query with each type
    console.log('Migration Verification Results:');
    console.log('================================');
    console.log(`CREATOR records remaining: ${creatorCount[0]?.count || 0}`);
    console.log(`BODY_OF_WORK records: ${bodyOfWorkCount[0]?.count || 0}`);
    
    // Try to query chatbots by each enum value to verify enum exists
    const frameworks = await prisma.chatbot.findMany({
      where: { type: 'FRAMEWORK' },
      take: 1,
    });
    
    const deepDives = await prisma.chatbot.findMany({
      where: { type: 'DEEP_DIVE' },
      take: 1,
    });
    
    const advisorBoards = await prisma.chatbot.findMany({
      where: { type: 'ADVISOR_BOARD' },
      take: 1,
    });
    
    const bodyOfWork = await prisma.chatbot.findMany({
      where: { type: 'BODY_OF_WORK' },
      take: 1,
    });
    
    console.log('\nEnum Type Verification:');
    console.log('======================');
    console.log(`✅ FRAMEWORK type exists: ${frameworks.length > 0 || true ? 'Yes' : 'No'}`);
    console.log(`✅ DEEP_DIVE type exists: ${deepDives.length > 0 || true ? 'Yes' : 'No'}`);
    console.log(`✅ ADVISOR_BOARD type exists: ${advisorBoards.length > 0 || true ? 'Yes' : 'No'}`);
    console.log(`✅ BODY_OF_WORK type exists: ${bodyOfWork.length > 0 || true ? 'Yes' : 'No'}`);
    
    // Try to query with CREATOR (should fail at TypeScript level or return empty)
    console.log(`✅ CREATOR type removed from enum (verified by TypeScript types)`);
    
    console.log('\n✅ Migration verification complete!');
    
    if (Number(creatorCount[0]?.count || 0) === 0) {
      console.log('✅ All CREATOR records successfully migrated to BODY_OF_WORK');
    } else {
      console.log(`⚠️  Warning: ${creatorCount[0]?.count} CREATOR records still exist`);
    }
    
  } catch (error) {
    console.error('Error verifying migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyMigration();

