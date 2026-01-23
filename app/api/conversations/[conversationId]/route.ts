// app/api/conversations/[conversationId]/route.ts
// PATCH endpoint to update conversation fields (e.g., intakeCompleted)

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/conversations/[conversationId]
 *
 * Updates conversation fields. Currently supports:
 * - intakeCompleted: boolean - marks intake as complete for this conversation
 *
 * Authentication: Optional - allows update if:
 * - User owns the conversation, OR
 * - Conversation is anonymous (userId is null)
 *
 * Request Body:
 * {
 *   intakeCompleted?: boolean;
 * }
 *
 * Response (Success - 200):
 * {
 *   conversation: {
 *     id: string;
 *     intakeCompleted: boolean;
 *     intakeCompletedAt: string | null;
 *   };
 * }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params;
    const { userId: clerkUserId } = await auth();
    const body = await request.json();

    // Get database user ID if authenticated
    let dbUserId: string | null = null;
    if (clerkUserId) {
      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { id: true },
      });
      dbUserId = user?.id || null;
    }

    // Validate conversation exists
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { userId: true },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Allow update if user owns conversation or conversation is anonymous
    if (conversation.userId && conversation.userId !== dbUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Build update data - only allow specific fields
    const updateData: { intakeCompleted?: boolean; intakeCompletedAt?: Date } = {};

    if (typeof body.intakeCompleted === 'boolean') {
      updateData.intakeCompleted = body.intakeCompleted;
      if (body.intakeCompleted) {
        updateData.intakeCompletedAt = new Date();
      }
    }

    // Only update if there's something to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
      select: {
        id: true,
        intakeCompleted: true,
        intakeCompletedAt: true,
      },
    });

    return NextResponse.json({
      conversation: {
        id: updated.id,
        intakeCompleted: updated.intakeCompleted,
        intakeCompletedAt: updated.intakeCompletedAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('[PATCH conversation] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
