// app/api/intake/responses/route.ts
// Phase 3.10: User Intake Forms - API Routes
// POST: Create an intake response and sync to User_Context

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/intake/responses
 * 
 * Creates an intake response for a user and syncs it to User_Context.
 * Requires authentication.
 * 
 * Request Body:
 * {
 *   userId: string;                    // Database user ID (not Clerk ID)
 *   intakeQuestionId: string;          // ID of the intake question
 *   chatbotId?: string;                // Optional chatbot ID
 *   value: any;                        // JSON value (string, number, array, etc.)
 *   reusableAcrossFrameworks?: boolean; // If true, syncs to global User_Context
 * }
 * 
 * Response Format:
 * {
 *   response: {
 *     id: string;
 *     intakeQuestionId: string;
 *     userId: string;
 *     chatbotId: string | null;
 *     value: any;
 *     reusableAcrossFrameworks: boolean;
 *     createdAt: string;
 *     updatedAt: string;
 *   };
 * }
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Get database user
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 3. Parse request body
    const body = await request.json();
    const {
      userId: providedUserId,
      intakeQuestionId,
      chatbotId,
      value,
      reusableAcrossFrameworks = false,
    } = body;

    // 4. Validate required fields
    if (!intakeQuestionId || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: intakeQuestionId, value' },
        { status: 400 }
      );
    }

    // 5. Verify userId matches authenticated user (security check)
    if (providedUserId && providedUserId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized: userId does not match authenticated user' },
        { status: 403 }
      );
    }

    // Use authenticated user's ID
    const dbUserId = user.id;

    // 6. Validate chatbotId is provided (required for association check)
    if (!chatbotId) {
      return NextResponse.json(
        { error: 'chatbotId is required' },
        { status: 400 }
      );
    }

    // 7. Verify intake question exists and get its slug
    const question = await prisma.intake_Question.findUnique({
      where: { id: intakeQuestionId },
      select: {
        id: true,
        slug: true,
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: 'Intake question not found' },
        { status: 404 }
      );
    }

    // 8. Verify chatbot exists
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: { id: true },
    });

    if (!chatbot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404 }
      );
    }

    // 9. Verify chatbot-question association exists via junction table
    const association = await prisma.chatbot_Intake_Question.findUnique({
      where: {
        intakeQuestionId_chatbotId: {
          intakeQuestionId: intakeQuestionId,
          chatbotId: chatbotId,
        },
      },
    });

    if (!association) {
      return NextResponse.json(
        { error: 'Question is not associated with this chatbot' },
        { status: 400 }
      );
    }

    const finalChatbotId = chatbotId;

    // 10. Create intake response
    const response = await prisma.intake_Response.create({
      data: {
        userId: dbUserId,
        intakeQuestionId,
        chatbotId: finalChatbotId,
        value,
        reusableAcrossFrameworks,
      },
    });

    // 11. Sync to User_Context
    // If reusableAcrossFrameworks is true, set chatbotId to null (global context)
    // Otherwise, use the chatbotId (chatbot-specific context)
    const targetChatbotId = reusableAcrossFrameworks ? null : finalChatbotId;

    await prisma.user_Context.upsert({
      where: {
        userId_chatbotId_key: {
          userId: dbUserId,
          chatbotId: targetChatbotId,
          key: question.slug,
        },
      },
      create: {
        userId: dbUserId,
        chatbotId: targetChatbotId,
        key: question.slug,
        value,
        source: 'INTAKE_FORM',
        isVisible: true,
        isEditable: true,
      },
      update: {
        value,
        source: 'INTAKE_FORM',
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ response });
  } catch (error) {
    console.error('Error creating intake response:', error);

    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A response for this question already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create intake response' },
      { status: 500 }
    );
  }
}




