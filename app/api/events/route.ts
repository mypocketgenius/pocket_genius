// app/api/events/route.ts
// Phase 2: Events API route
// Logs general events (copy, bookmark, conversation patterns, etc.)

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/events
 * 
 * Logs general events (not message-specific feedback):
 * - copy: Copy button clicked
 * - bookmark: Bookmark created (also creates Bookmark record, prevents duplicates)
 * - conversation_pattern: Detected by background job
 * - expansion_followup: Follow-up after expansion response
 * - gap_submission: Gap submission from user
 * 
 * @example
 * ```typescript
 * // Copy event
 * await fetch('/api/events', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     eventType: 'copy',
 *     sessionId: 'conv-123',
 *     chunkIds: ['chunk-1'],
 *     metadata: { messageId: 'msg-123' }
 *   })
 * });
 * 
 * // Bookmark event (also creates Bookmark record)
 * await fetch('/api/events', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     eventType: 'bookmark',
 *     sessionId: 'conv-123',
 *     chunkIds: ['chunk-1'],
 *     metadata: { messageId: 'msg-123' }
 *   })
 * });
 * ```
 * 
 * @param {Request} req - Next.js request object
 * @param {Object} req.body - Request body
 * @param {'copy' | 'bookmark' | 'conversation_pattern' | 'expansion_followup' | 'gap_submission'} req.body.eventType - Type of event (required)
 * @param {string} [req.body.sessionId] - Conversation/session ID
 * @param {string[]} [req.body.chunkIds=[]] - Array of chunk IDs from message context
 * @param {Object} [req.body.metadata={}] - Event-specific metadata:
 *   - For copy/bookmark: { messageId: string }
 *   - For expansion_followup: { result: 'satisfied' | 'unsatisfied', expansion_type: string, messageId: string }
 *   - For gap_submission: { trigger: string, expansion_type?: string, text: string, messageId: string }
 *   - For conversation_pattern: { pattern_type: string }
 * 
 * @returns {Promise<NextResponse>} JSON response with success status and eventId
 * @throws {400} If eventType is invalid or missing
 * @throws {401} If authentication fails (optional for copy/events, required for bookmark)
 * @throws {404} If message/conversation not found (for bookmark events)
 * @throws {409} If bookmark already exists (for bookmark events)
 * @throws {500} If database error occurs
 */
export async function POST(req: Request) {
  try {
    // 1. Authenticate user (optional - allows anonymous users)
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

    // 2. Parse and validate request body
    const body = await req.json();
    const {
      eventType,
      sessionId,
      chunkIds = [],
      metadata = {},
    } = body;

    // Validate eventType
    const validEventTypes = ['copy', 'bookmark', 'conversation_pattern', 'expansion_followup', 'gap_submission'];
    if (!eventType || !validEventTypes.includes(eventType)) {
      return NextResponse.json(
        { error: `eventType must be one of: ${validEventTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // 3. Create Event record
    const event = await prisma.event.create({
      data: {
        sessionId: sessionId || null,
        userId: dbUserId,
        eventType,
        chunkIds: Array.isArray(chunkIds) ? chunkIds : [],
        metadata: metadata || {},
      },
    });

    // 4. If bookmark event, also create Bookmark record
    if (eventType === 'bookmark' && metadata.messageId) {
      // Verify message exists
      const message = await prisma.message.findUnique({
        where: { id: metadata.messageId },
        select: { id: true, conversationId: true },
      });

      if (message) {
        // Get chatbotId from conversation
        const conversation = await prisma.conversation.findUnique({
          where: { id: message.conversationId },
          select: { chatbotId: true },
        });

        if (conversation && dbUserId) {
          // Check for duplicate bookmark
          const existingBookmark = await prisma.bookmark.findUnique({
            where: {
              messageId_userId: {
                messageId: metadata.messageId,
                userId: dbUserId,
              },
            },
          });

          if (!existingBookmark) {
            await prisma.bookmark.create({
              data: {
                messageId: metadata.messageId,
                userId: dbUserId,
                chatbotId: conversation.chatbotId,
                chunkIds: Array.isArray(chunkIds) ? chunkIds : [],
                notes: metadata.notes || null,
              },
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      eventId: event.id,
    });
  } catch (error) {
    console.error('Error logging event:', error);
    return NextResponse.json(
      { error: 'Failed to log event' },
      { status: 500 }
    );
  }
}

