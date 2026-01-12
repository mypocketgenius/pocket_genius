// scripts/seed-art-of-war-intake-questions.ts
// Seeds intake questions for the Art of War chatbot
// Uses Prisma directly following the API pattern

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

const questions = [
  {
    slug: 'role',
    questionText: 'What is your role in the startup?',
    helperText: 'This helps us tailor advice to your specific responsibilities and decision-making scope.',
    responseType: 'TEXT' as const,
    displayOrder: 1,
    isRequired: true,
  },
  {
    slug: 'company_stage',
    questionText: 'What stage is your startup currently in?',
    helperText: 'Understanding your company\'s stage helps us provide contextually relevant strategic advice.',
    responseType: 'TEXT' as const,
    displayOrder: 2,
    isRequired: true,
  },
  {
    slug: 'primary_challenge',
    questionText: 'What is your primary business challenge right now?',
    helperText: 'This helps us focus on the strategic areas where you need guidance.',
    responseType: 'TEXT' as const,
    displayOrder: 3,
    isRequired: true,
  },
  {
    slug: 'team_size',
    questionText: 'How many people are in your immediate team or department?',
    helperText: 'This helps us understand your organizational context and leadership scope.',
    responseType: 'TEXT' as const,
    displayOrder: 4,
    isRequired: true,
  },
  {
    slug: 'competitive_landscape',
    questionText: 'How would you describe your competitive landscape?',
    helperText: 'Understanding your competitive environment helps us apply Sun Tzu\'s principles about knowing your enemy and the terrain.',
    responseType: 'TEXT' as const,
    displayOrder: 5,
    isRequired: true,
  },
];

async function main() {
  console.log('🌱 Starting Art of War intake questions seed...');

  // Validate required environment variables
  if (!process.env.SEED_USER_CLERK_ID) {
    throw new Error(
      'SEED_USER_CLERK_ID environment variable is required.\n' +
      'Add it to your .env.local file. Get your Clerk ID from Clerk dashboard → Users → Your User'
    );
  }

  // Get seed user
  const seedUser = await prisma.user.findUnique({
    where: { clerkId: process.env.SEED_USER_CLERK_ID },
    select: { id: true },
  });

  if (!seedUser) {
    throw new Error(
      `User with Clerk ID ${process.env.SEED_USER_CLERK_ID} not found. ` +
      'Please run the main seed script first to create the user.'
    );
  }

  console.log(`✅ Found seed user: ${seedUser.id}`);

  // Verify chatbot exists
  const chatbot = await prisma.chatbot.findUnique({
    where: { id: CHATBOT_ID },
    select: { id: true },
  });

  if (!chatbot) {
    throw new Error(
      `Chatbot ${CHATBOT_ID} not found. ` +
      'Please run the main seed script first to create the chatbot.'
    );
  }

  console.log(`✅ Found chatbot: ${CHATBOT_ID}`);

  // Create questions and associations
  for (const questionData of questions) {
    const { displayOrder, isRequired, ...questionFields } = questionData;

    // Check if question already exists (by slug)
    let question = await prisma.intake_Question.findUnique({
      where: { slug: questionData.slug },
    });

    if (question) {
      console.log(`  ⚠️  Question "${questionData.slug}" already exists, updating...`);
      // Update existing question
      question = await prisma.intake_Question.update({
        where: { id: question.id },
        data: {
          questionText: questionFields.questionText,
          helperText: questionFields.helperText,
          responseType: questionFields.responseType,
          options: Prisma.JsonNull, // Remove options for TEXT type
        },
      });
    } else {
      // Create new question
      question = await prisma.intake_Question.create({
        data: {
          slug: questionFields.slug,
          questionText: questionFields.questionText,
          helperText: questionFields.helperText,
          responseType: questionFields.responseType,
          options: Prisma.JsonNull, // No options for TEXT type
          createdByUserId: seedUser.id,
        },
      });
      console.log(`  ✅ Created question: ${questionData.slug}`);
    }

    // Check if association already exists
    const existingAssociation = await prisma.chatbot_Intake_Question.findUnique({
      where: {
        intakeQuestionId_chatbotId: {
          intakeQuestionId: question.id,
          chatbotId: CHATBOT_ID,
        },
      },
    });

    if (existingAssociation) {
      // Update existing association
      await prisma.chatbot_Intake_Question.update({
        where: { id: existingAssociation.id },
        data: {
          displayOrder,
          isRequired,
        },
      });
      console.log(`  ✅ Updated association for "${questionData.slug}"`);
    } else {
      // Create new association
      await prisma.chatbot_Intake_Question.create({
        data: {
          chatbotId: CHATBOT_ID,
          intakeQuestionId: question.id,
          displayOrder,
          isRequired,
        },
      });
      console.log(`  ✅ Created association for "${questionData.slug}"`);
    }
  }

  console.log('\n🎉 Art of War intake questions seed completed successfully!');
  console.log(`\nSummary:`);
  console.log(`  - Created/updated ${questions.length} questions`);
  console.log(`  - Associated all questions with ${CHATBOT_ID}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Visit /chat/${CHATBOT_ID} to see the intake form`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

