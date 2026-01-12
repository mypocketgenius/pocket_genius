// scripts/fix-art-of-war-intake-questions.ts
// Deletes test question and converts all Art of War questions to TEXT type

import dotenv from 'dotenv';
import path from 'path';
import { Prisma } from '@prisma/client';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

import { prisma } from '../lib/prisma';

const CHATBOT_ID = 'chatbot_art_of_war';

async function main() {
  console.log('🔧 Fixing Art of War intake questions...');

  // 1. Find and delete test question
  console.log('\n1. Finding test question...');
  const testQuestion = await prisma.intake_Question.findFirst({
    where: {
      OR: [
        { slug: 'test' },
        { questionText: { contains: 'Test', mode: 'insensitive' } },
      ],
    },
    include: {
      chatbots: {
        where: { chatbotId: CHATBOT_ID },
      },
    },
  });

  if (testQuestion) {
    console.log(`  Found test question: ${testQuestion.slug} - "${testQuestion.questionText}"`);
    
    // Delete associations first
    if (testQuestion.chatbots.length > 0) {
      await prisma.chatbot_Intake_Question.deleteMany({
        where: { intakeQuestionId: testQuestion.id },
      });
      console.log(`  ✅ Deleted ${testQuestion.chatbots.length} association(s)`);
    }
    
    // Delete the question
    await prisma.intake_Question.delete({
      where: { id: testQuestion.id },
    });
    console.log(`  ✅ Deleted test question`);
  } else {
    console.log('  ℹ️  No test question found');
  }

  // 2. Update all Art of War questions to TEXT type
  console.log('\n2. Converting questions to TEXT type...');
  
  // Get all questions associated with chatbot_art_of_war
  const associations = await prisma.chatbot_Intake_Question.findMany({
    where: { chatbotId: CHATBOT_ID },
    include: {
      intakeQuestion: true,
    },
  });

  console.log(`  Found ${associations.length} questions to update`);

  for (const association of associations) {
    const question = association.intakeQuestion;
    
    // Skip if already TEXT type
    if (question.responseType === 'TEXT') {
      console.log(`  ⏭️  Skipping "${question.slug}" (already TEXT)`);
      continue;
    }

    // Update to TEXT type and remove options
    await prisma.intake_Question.update({
      where: { id: question.id },
      data: {
        responseType: 'TEXT',
        options: Prisma.JsonNull,
      },
    });
    
    console.log(`  ✅ Updated "${question.slug}" to TEXT type`);
  }

  console.log('\n🎉 Fix completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Fix failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

