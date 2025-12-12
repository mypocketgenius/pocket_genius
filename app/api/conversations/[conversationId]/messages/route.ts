// app/api/conversations/[conversationId]/messages/route.ts
// Phase 3, Part 4: Conversation management - Fetch messages for a conversation

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/conversations/[conversationId]/messages
 * 
 * Fetches all messages for a specific conversation:
 * 1. Authenticates user (optional for MVP - allow anonymous users)
 * 2. Verifies conversation exists
 * 3. Verifies user has access to conversation
 * 4. Returns messages ordered by creation time
 * 
 * Response: Array of message objects with id, role, content, createdAt
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    // 1. Authenticate user (optional for MVP - allow anonymous users)
    const { userId: clerkUserId } = await auth();
    
    // Get database user ID if authenticated
    let dbUserId: string | null = null;
    if (clerkUserId) {
      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { id: true },
      });
      dbUserId = user?.id || null;
    }

    // 2. Verify conversation exists
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        chatbotId: true,
        userId: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // 3. Verify user has access to conversation (if authenticated)
    if (dbUserId && conversation.userId && conversation.userId !== dbUserId) {
      return NextResponse.json(
        { error: 'Unauthorized access to conversation' },
        { status: 403 }
      );
    }

    // 4. Fetch messages ordered by creation time, including feedback
    const messages = await prisma.message.findMany({
      where: { conversationId },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
        messageFeedbacks: {
          select: {
            feedbackType: true,
            userId: true,
          },
          orderBy: {
            createdAt: 'desc', // Get most recent feedback first
          },
          take: 1, // Only need the most recent feedback per message
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Transform messages to include feedbackType (most recent feedback)
    const messagesWithFeedback = messages.map((msg) => {
      const feedback = msg.messageFeedbacks[0];
      return {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
        feedbackType: feedback?.feedbackType || null,
      };
    });

    return NextResponse.json({ messages: messagesWithFeedback });
  } catch (error) {
    console.error('Get conversation messages error:', error);

    // Return appropriate error response
    if (error instanceof Error) {
      const errorMessage =
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'An error occurred while fetching messages';

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
