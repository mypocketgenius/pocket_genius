// Reset user intake data - deletes all intake responses and user contexts for a specific user
import { prisma } from '../lib/prisma.js';

async function resetUserIntakeData() {
  try {
    // Your user ID from the database queries above
    const userId = 'cmj256oei0000chlu8qmj8fs0';

    console.log(`Resetting intake data for user ${userId}...\n`);

    // 1. Delete all User_Context records
    console.log('Deleting User_Context records...');
    const deletedContexts = await prisma.user_Context.deleteMany({
      where: { userId },
    });
    console.log(`✓ Deleted ${deletedContexts.count} User_Context records`);

    // 2. Delete all Intake_Response records
    console.log('\nDeleting Intake_Response records...');
    const deletedResponses = await prisma.intake_Response.deleteMany({
      where: { userId },
    });
    console.log(`✓ Deleted ${deletedResponses.count} Intake_Response records`);

    // 3. Verify deletion
    console.log('\n=== Verification ===');
    const remainingContexts = await prisma.user_Context.count({
      where: { userId },
    });
    const remainingResponses = await prisma.intake_Response.count({
      where: { userId },
    });

    console.log(`Remaining User_Context records: ${remainingContexts}`);
    console.log(`Remaining Intake_Response records: ${remainingResponses}`);

    if (remainingContexts === 0 && remainingResponses === 0) {
      console.log('\n✓ Successfully reset! You can now test as a new user.');
    } else {
      console.log('\n⚠ Warning: Some records may not have been deleted.');
    }
  } catch (error) {
    console.error('Error resetting user intake data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetUserIntakeData();
