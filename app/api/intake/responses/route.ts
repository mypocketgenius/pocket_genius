// app/api/intake/responses/route.ts
// Phase 3.10: User Intake Forms - API Routes
// POST: Create an intake response and sync to User_Context
// DELETE: Delete an intake response and corresponding User_Context

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

/**
 * DELETE /api/intake/responses
 * 
 * Deletes an intake response for a user and the corresponding User_Context entry.
 * Requires authentication.
 * 
 * Request Body:
 * {
 *   userId: string;                    // Database user ID (not Clerk ID)
 *   chatbotId: string | null | '';     // Chatbot ID (null or empty string for global context)
 *   questionSlug: string;               // Question slug (matches User_Context.key)
 * }
 * 
 * Response Format:
 * {
 *   success: boolean;
 *   message: string;
 * }
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
    const {
      userId: providedUserId,
      chatbotId,
      questionSlug,
    } = body;

    // 4. Validate required fields
    if (!questionSlug) {
      return NextResponse.json(
        { error: 'Missing required field: questionSlug' },
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

    // 6. Find intake question by slug
    const question = await prisma.intake_Question.findFirst({
      where: { slug: questionSlug },
      select: { id: true },
    });

    if (!question) {
      return NextResponse.json(
        { error: 'Intake question not found' },
        { status: 404 }
      );
    }

    // 7. Find intake response
    // Note: User_Context.chatbotId might be null (global) even if Intake_Response.chatbotId is set
    // So we need to search for Intake_Response without filtering by chatbotId first
    // Then match based on the question and user
    
    // First, try to find with the provided chatbotId (if any)
    const normalizedChatbotId = chatbotId !== undefined && chatbotId !== '' 
      ? chatbotId 
      : undefined;
    
    let intakeResponse = await prisma.intake_Response.findFirst({
      where: {
        userId: dbUserId,
        intakeQuestionId: question.id,
        ...(normalizedChatbotId !== undefined && { chatbotId: normalizedChatbotId }),
      },
      select: { id: true, chatbotId: true },
    });

    // If not found and chatbotId was null/empty (global context), try finding any response for this question
    // This handles the case where reusableAcrossFrameworks was true
    if (!intakeResponse && (chatbotId === '' || chatbotId === null || chatbotId === undefined)) {
      intakeResponse = await prisma.intake_Response.findFirst({
        where: {
          userId: dbUserId,
          intakeQuestionId: question.id,
        },
        select: { id: true, chatbotId: true },
      });
    }

    if (!intakeResponse) {
      return NextResponse.json(
        { error: 'Intake response not found' },
        { status: 404 }
      );
    }

    // 8. Delete intake response
    await prisma.intake_Response.delete({
      where: { id: intakeResponse.id },
    });

    // 9. Delete corresponding User_Context entry
    // Use chatbotId from the request (which matches User_Context.chatbotId)
    // For global context, User_Context has chatbotId = null
    // For chatbot-specific context, User_Context has the same chatbotId
    const finalChatbotId = chatbotId !== undefined && chatbotId !== ''
      ? chatbotId
      : null;

    // Try to delete User_Context - it may not exist if it was already deleted
    try {
      await prisma.user_Context.delete({
        where: {
          userId_chatbotId_key: {
            userId: dbUserId,
            chatbotId: finalChatbotId,
            key: questionSlug,
          },
        },
      });
    } catch (error) {
      // User_Context might not exist, which is okay
      // Log but don't fail the request
      console.log('User_Context not found or already deleted:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Intake response deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting intake response:', error);

    return NextResponse.json(
      { error: 'Failed to delete intake response' },
      { status: 500 }
    );
  }
}




