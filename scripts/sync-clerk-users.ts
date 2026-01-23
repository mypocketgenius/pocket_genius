// scripts/sync-clerk-users.ts
// One-time script to sync existing Clerk users to the local database
// Run with: npx tsx scripts/sync-clerk-users.ts

import { createClerkClient } from '@clerk/backend';
import { prisma } from '@/lib/prisma';

// Create Clerk client for backend operations
const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

async function syncClerkUsers() {
  try {
    console.log('Syncing Clerk users to local database...\n');

    // Verify Clerk secret key is available
    if (!process.env.CLERK_SECRET_KEY) {
      throw new Error('CLERK_SECRET_KEY is not set in environment variables');
    }

    // Fetch all users from Clerk (paginated)
    let allUsers: Awaited<ReturnType<typeof clerk.users.getUserList>>['data'] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const { data: users } = await clerk.users.getUserList({
        limit,
        offset,
      });

      if (users.length === 0) break;

      allUsers = allUsers.concat(users);
      offset += limit;

      // Safety check to prevent infinite loop
      if (offset > 10000) {
        console.warn('Warning: Reached 10,000 user limit, stopping pagination');
        break;
      }
    }

    console.log(`Found ${allUsers.length} users in Clerk\n`);

    if (allUsers.length === 0) {
      console.log('No users to sync.');
      return;
    }

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of allUsers) {
      try {
        const primaryEmail = user.emailAddresses.find(
          e => e.id === user.primaryEmailAddressId
        )?.emailAddress;

        const result = await prisma.user.upsert({
          where: { clerkId: user.id },
          update: {
            email: primaryEmail || '',
            firstName: user.firstName,
            lastName: user.lastName,
          },
          create: {
            clerkId: user.id,
            email: primaryEmail || '',
            firstName: user.firstName,
            lastName: user.lastName,
          },
        });

        // Check if this was a create or update
        const existingUser = await prisma.user.findUnique({
          where: { clerkId: user.id },
          select: { createdAt: true, id: true },
        });

        // If createdAt is very recent (within last second), it was likely just created
        const wasCreated = existingUser &&
          (Date.now() - existingUser.createdAt.getTime()) < 1000;

        if (wasCreated) {
          synced++;
          console.log(`+ Created: ${user.id} (${primaryEmail || 'no email'})`);
        } else {
          skipped++;
          console.log(`= Updated: ${user.id} (${primaryEmail || 'no email'})`);
        }
      } catch (error) {
        errors++;
        console.error(`x Failed: ${user.id}:`, error);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('Sync complete!');
    console.log(`  Created: ${synced}`);
    console.log(`  Updated: ${skipped}`);
    console.log(`  Errors:  ${errors}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
syncClerkUsers()
  .then(() => {
    console.log('\nScript completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript failed:', error);
    process.exit(1);
  });
