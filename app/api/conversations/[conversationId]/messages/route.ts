// app/api/conversations/[conversationId]/messages/route.ts
// Phase 3, Part 4: Conversation management - Fetch messages for a conversation

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

