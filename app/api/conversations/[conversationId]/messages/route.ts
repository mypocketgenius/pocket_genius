// app/api/conversations/[conversationId]/messages/route.ts
// Phase 3, Part 4: Conversation management - Fetch messages for a conversation
// Conversational Intake Flow - Create messages in a conversation

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
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

    // 2. Verify conversation exists and get status
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        chatbotId: true,
        userId: true,
        status: true,
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

    // 4. Fetch messages ordered by creation time, including context
    // Note: Message_Feedback table was removed in Phase 2 migration to pill-based system
    // Feedback is now tracked via Pill_Usage and Events tables
    const messages = await prisma.message.findMany({
      where: { conversationId },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
        context: true, // Phase 4: Include context for source attribution
        sourceIds: true, // Phase 4: Include sourceIds to enrich context with source titles
        followUpPills: true, // Follow-up pills (separate from RAG context)
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Phase 4: Fetch source titles for messages that need enrichment
    const allSourceIds = new Set<string>();
    messages.forEach((msg) => {
      if (msg.sourceIds && Array.isArray(msg.sourceIds)) {
        msg.sourceIds.forEach((id) => allSourceIds.add(id));
      }
      // Also check context for sourceIds (for older messages)
      if (msg.context && typeof msg.context === 'object') {
        const context = msg.context as Record<string, unknown>;
        const chunks = context.chunks as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(chunks)) {
          chunks.forEach((chunk) => {
            const sourceId = chunk.sourceId as string | undefined;
            if (sourceId) {
              allSourceIds.add(sourceId);
            }
          });
        }
      }
    });

    const sourceTitlesMap = new Map<string, string>();
    if (allSourceIds.size > 0) {
      try {
        const sources = await prisma.source.findMany({
          where: {
            id: { in: Array.from(allSourceIds) },
          },
          select: {
            id: true,
            title: true,
          },
        });
        sources.forEach((source) => {
          sourceTitlesMap.set(source.id, source.title);
        });
      } catch (error) {
        console.error('Error fetching source titles for messages:', error);
        // Continue without source titles - attribution won't show but won't break
      }
    }

    // Phase 4: Enrich messages with sourceTitle in context if missing
    const enrichedMessages = messages.map((msg) => {
      // Enrich context with sourceTitle if missing
      let enrichedContext = msg.context;
      if (msg.context && typeof msg.context === 'object') {
        const context = msg.context as Record<string, unknown>;
        const chunks = context.chunks as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(chunks)) {
          // Check if any chunks are missing sourceTitle
          const needsEnrichment = chunks.some(
            (chunk) => !chunk.sourceTitle && chunk.sourceId
          );
          
          if (needsEnrichment) {
            enrichedContext = {
              ...context,
              chunks: chunks.map((chunk) => {
                const sourceId = chunk.sourceId as string | undefined;
                const sourceTitle = chunk.sourceTitle as string | undefined;
                if (sourceId && !sourceTitle && sourceTitlesMap.has(sourceId)) {
                  return {
                    ...chunk,
                    sourceTitle: sourceTitlesMap.get(sourceId),
                  };
                }
                return chunk;
              }),
            } as Prisma.JsonValue;
          }
        }
      }
      
      return {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
        context: enrichedContext, // Phase 4: Include enriched context for source attribution
        followUpPills: msg.followUpPills || [], // Follow-up pills (separate from RAG context)
      };
    });

    return NextResponse.json({ 
      messages: enrichedMessages,
      conversationStatus: conversation.status,
    });
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

/**
 * POST /api/conversations/[conversationId]/messages
 * 
 * Creates a new message in a conversation. Used by useConversationalIntake hook
 * to save welcome messages, questions, answers, "Thank you." messages, and final intro messages.
 * 
 * Authentication: Required (user must be authenticated)
 * 
 * Request Body:
 * {
 *   role: 'user' | 'assistant';
 *   content: string;
 *   // Note: userId is derived from authenticated user, not passed in request body
 * }
 * 
 * Response (Success - 200):
 * {
 *   message: {
 *     id: string;
 *     conversationId: string;
 *     userId: string | null;
 *     role: 'user' | 'assistant';
 *     content: string;
 *     context: Prisma.JsonValue | null;
 *     followUpPills: string[];
 *     sourceIds: string[];
 *     createdAt: string;
 *   };
 * }
 * 
 * Error Responses:
 * - 400 - Missing required fields (role, content)
 * - 401 - Authentication required
 * - 403 - Conversation does not belong to user
 * - 404 - Conversation not found
 * - 500 - Server error
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  let conversationId: string | undefined;
  try {
    const paramsData = await params;
    conversationId = paramsData.conversationId;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    // 1. Authenticate user (required)
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Get database user ID
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
    const body = await req.json();
    const { role, content } = body;

    // 4. Validate required fields
    if (!role || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: role and content are required' },
        { status: 400 }
      );
    }

    // Validate role
    if (role !== 'user' && role !== 'assistant') {
      return NextResponse.json(
        { error: 'Invalid role: must be "user" or "assistant"' },
        { status: 400 }
      );
    }

    // 5. Verify conversation exists and belongs to authenticated user
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Verify conversation belongs to user
    // If conversation.userId is null, set it to current user (edge case handling)
    // If conversation.userId exists and doesn't match, deny access
    if (conversation.userId === null) {
      // Update conversation to set userId (shouldn't happen with current create endpoint, but handle gracefully)
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { userId: user.id },
      });
    } else if (conversation.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized: Conversation does not belong to user' },
        { status: 403 }
      );
    }

    // 6. Create message in database
    // For intake messages:
    // - context: Prisma.JsonNull (no RAG context for intake messages)
    // - followUpPills: [] (no follow-up pills for intake messages)
    // - sourceIds: [] (no sources for intake messages)
    // - userId: user.id for user messages, null for assistant messages
    const message = await prisma.message.create({
      data: {
        conversationId,
        userId: role === 'user' ? user.id : null, // null for assistant messages
        role,
        content,
        context: Prisma.JsonNull, // No RAG context for intake messages
        followUpPills: [], // No follow-up pills for intake messages
        sourceIds: [], // No sources for intake messages
      },
    });

    // 7. Update conversation:
    // - Increment messageCount by 1
    // - Update updatedAt to current timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        messageCount: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    // 8. Return created message
    return NextResponse.json({
      message: {
        id: message.id,
        conversationId: message.conversationId,
        userId: message.userId,
        role: message.role as 'user' | 'assistant',
        content: message.content,
        context: message.context,
        followUpPills: message.followUpPills,
        sourceIds: message.sourceIds,
        createdAt: message.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating message:', {
      error,
      conversationId: conversationId || 'unknown',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Return appropriate error response
    if (error instanceof Error) {
      const errorMessage =
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'An error occurred while creating message';

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

