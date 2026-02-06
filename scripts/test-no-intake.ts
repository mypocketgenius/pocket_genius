// scripts/test-no-intake.ts
// Temporarily removes intake responses for your user on the Art of War chatbot,
// so you can test the {intake.SLUG} → "(not provided)" fallback path.
// Restores them automatically after you press Enter.

import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

const CHATBOT_ID = 'art_of_war';

async function main() {
  // Find the user (use SEED_USER_CLERK_ID or first user)
  const clerkId = process.env.SEED_USER_CLERK_ID;
  const user = clerkId
    ? await prisma.user.findUnique({ where: { clerkId }, select: { id: true, email: true } })
    : await prisma.user.findFirst({ select: { id: true, email: true } });

  if (!user) {
    console.error('No user found');
    process.exit(1);
  }

  console.log(`User: ${user.email} (${user.id})`);

  // Fetch current intake responses
  const responses = await prisma.intake_Response.findMany({
    where: { userId: user.id, chatbotId: CHATBOT_ID },
    include: { intakeQuestion: { select: { slug: true } } },
  });

  if (responses.length === 0) {
    console.log('No intake responses found — already in the "no intake" state.');
    console.log('Go send a message to the Art of War chatbot and check the logs.');
    await prisma.$disconnect();
    return;
  }

  console.log(`\nFound ${responses.length} intake responses:`);
  for (const r of responses) {
    console.log(`  - ${r.intakeQuestion.slug}: ${JSON.stringify(r.value)}`);
  }

  // Save backup
  const backup = responses.map((r) => ({
    id: r.id,
    userId: r.userId,
    intakeQuestionId: r.intakeQuestionId,
    chatbotId: r.chatbotId,
    value: r.value === null ? Prisma.JsonNull : (r.value as Prisma.InputJsonValue),
    reusableAcrossFrameworks: r.reusableAcrossFrameworks,
  }));

  // Delete them
  const deleted = await prisma.intake_Response.deleteMany({
    where: { userId: user.id, chatbotId: CHATBOT_ID },
  });
  console.log(`\nDeleted ${deleted.count} intake responses.`);
  console.log('\n>>> Go test now: send a message to Art of War chatbot <<<');
  console.log('>>> Check logs for: intakeResponsePairs: 0 pairs <<<');
  console.log('>>> Check logs for: (not provided) in the prompt <<<\n');

  // Wait for user to press Enter
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise<void>((resolve) => {
    rl.question('Press Enter to restore intake responses...', () => {
      rl.close();
      resolve();
    });
  });

  // Restore them
  for (const b of backup) {
    await prisma.intake_Response.create({ data: b });
  }
  console.log(`\nRestored ${backup.length} intake responses.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
