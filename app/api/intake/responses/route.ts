// app/api/intake/responses/route.ts
// Phase 3.10: User Intake Forms - API Routes
// POST: Create or update an intake response and sync to User_Context

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/intake/responses
 *
 * Creates or updates an intake response for a user and syncs it to User_Context.
 * Uses upsert to handle both new responses and modifications to existing ones.
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

    // Use authenticated user's ID (no need for client-provided userId)
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

    // 10. Create or update intake response (upsert to handle modifications)
    const response = await prisma.intake_Response.upsert({
      where: {
        userId_intakeQuestionId_chatbotId: {
          userId: dbUserId,
          intakeQuestionId,
          chatbotId: finalChatbotId,
        },
      },
      create: {
        userId: dbUserId,
        intakeQuestionId,
        chatbotId: finalChatbotId,
        value,
        reusableAcrossFrameworks,
      },
      update: {
        value,
        reusableAcrossFrameworks,
        updatedAt: new Date(),
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
    console.error('Error saving intake response:', error);

    // Handle unique constraint violation (safety net - should not occur with upsert)
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A response for this question already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to save intake response' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/intake/responses
 *
 * Deletes an intake response and removes the corresponding User_Context entry.
 * Requires authentication.
 *
 * Request Body:
 * {
 *   chatbotId: string;      // Chatbot ID (empty string for global User_Context)
 *   questionSlug: string;   // The question slug (key)
 * }
 *
 * Note: When User_Context.chatbotId is null (global), the corresponding
 * Intake_Response has reusableAcrossFrameworks=true but stores the actual
 * chatbotId it was created under. We handle this mismatch by looking up
 * based on the reusableAcrossFrameworks flag.
 */
export async function DELETE(request: Request) {
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
    const { chatbotId, questionSlug } = body;

    if (!questionSlug) {
      return NextResponse.json(
        { error: 'Missing required field: questionSlug' },
        { status: 400 }
      );
    }

    // 4. Find the intake question by slug
    const question = await prisma.intake_Question.findUnique({
      where: { slug: questionSlug },
      select: { id: true },
    });

    if (!question) {
      return NextResponse.json(
        { error: 'Intake question not found' },
        { status: 404 }
      );
    }

    // 5. Determine if this is a global context (User_Context.chatbotId is null)
    const isGlobalContext = chatbotId === '' || chatbotId === null || chatbotId === undefined;

    // 6. Find the intake response
    // If global context: look for response with reusableAcrossFrameworks=true
    // If chatbot-specific: look for response with that chatbotId
    let response;
    if (isGlobalContext) {
      // Global User_Context means the Intake_Response has reusableAcrossFrameworks=true
      response = await prisma.intake_Response.findFirst({
        where: {
          userId: user.id,
          intakeQuestionId: question.id,
          reusableAcrossFrameworks: true,
        },
      });
    } else {
      // Chatbot-specific User_Context
      response = await prisma.intake_Response.findFirst({
        where: {
          userId: user.id,
          intakeQuestionId: question.id,
          chatbotId: chatbotId,
          reusableAcrossFrameworks: false,
        },
      });
    }

    if (!response) {
      return NextResponse.json(
        { error: 'Intake response not found' },
        { status: 404 }
      );
    }

    // 7. Delete both records in a transaction for consistency
    const targetUserContextChatbotId = isGlobalContext ? null : chatbotId;

    await prisma.$transaction([
      prisma.intake_Response.delete({
        where: { id: response.id },
      }),
      prisma.user_Context.deleteMany({
        where: {
          userId: user.id,
          chatbotId: targetUserContextChatbotId,
          key: questionSlug,
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting intake response:', error);
    return NextResponse.json(
      { error: 'Failed to delete intake response' },
      { status: 500 }
    );
  }
}




