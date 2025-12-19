// app/api/pills/usage/route.ts
// Phase 2: Pill usage API route
// Logs pill usage when message is sent

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/pills/usage
 * 
 * Logs pill usage when message is sent:
 * - Creates Pill_Usage record to track pill usage
 * - Links to paired pill if combined (feedback + expansion)
 * - Also creates Message_Feedback record if feedback pill used (for backward compatibility)
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/pills/usage', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     pillId: 'pill-123',
 *     sessionId: 'conversation-456',
 *     chatbotId: 'chatbot-789',
 *     sourceChunkIds: ['chunk-1'],
 *     prefillText: 'Helpful',
 *     sentText: 'Helpful',
 *     wasModified: false,
 *     messageId: 'message-123'
 *   })
 * });
 * ```
 * 
 * @param {Request} req - Next.js request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.pillId - ID of the pill that was used (required)
 * @param {string} req.body.sessionId - Conversation/session ID (required)
 * @param {string} req.body.chatbotId - ID of the chatbot (required)
 * @param {string[]} [req.body.sourceChunkIds=[]] - Array of chunk IDs from message context
 * @param {string} req.body.prefillText - Text that was prefilled in input (required)
 * @param {string} req.body.sentText - Text that was actually sent (required)
 * @param {boolean} [req.body.wasModified=false] - Whether user modified prefilled text
 * @param {string} [req.body.pairedWithPillId] - ID of paired pill if combined (feedback + expansion)
 * @param {string} [req.body.messageId] - Message ID (required if feedback pill)
 * 
 * @returns {Promise<NextResponse>} JSON response with success status and pillUsageId
 * @throws {400} If required fields are missing
 * @throws {401} If authentication fails (optional, allows anonymous users)
 * @throws {404} If pill or chatbot not found
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
      pillId,
      sessionId,
      chatbotId,
      sourceChunkIds = [],
      prefillText,
      sentText,
      wasModified = false,
      pairedWithPillId,
      messageId,
    } = body;

    if (!pillId || !sessionId || !chatbotId || !prefillText || !sentText) {
      return NextResponse.json(
        { error: 'pillId, sessionId, chatbotId, prefillText, and sentText are required' },
        { status: 400 }
      );
    }

    // 3. Verify pill exists
    const pill = await prisma.pill.findUnique({
      where: { id: pillId },
      select: { id: true, pillType: true },
    });

    if (!pill) {
      return NextResponse.json(
        { error: 'Pill not found' },
        { status: 404 }
      );
    }

    // 4. Verify chatbot exists
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

    // 5. Create Pill_Usage record
    const pillUsage = await prisma.pill_Usage.create({
      data: {
        pillId,
        sessionId,
        userId: dbUserId,
        chatbotId,
        sourceChunkIds: Array.isArray(sourceChunkIds) ? sourceChunkIds : [],
        prefillText,
        sentText,
        wasModified,
        pairedWithPillId: pairedWithPillId || null,
      },
    });

    // 6. If feedback pill used and messageId provided, create Message_Feedback record
    if (pill.pillType === 'feedback' && messageId) {
      const feedbackType = pill.label.toLowerCase().includes('not') ? 'not_helpful' : 'helpful';
      
      // Check if feedback already exists (prevent duplicates)
      const existingFeedback = await prisma.message_Feedback.findFirst({
        where: {
          messageId,
          userId: dbUserId,
          feedbackType,
        },
      });

      if (!existingFeedback) {
        await prisma.message_Feedback.create({
          data: {
            messageId,
            userId: dbUserId,
            feedbackType,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      pillUsageId: pillUsage.id,
    });
  } catch (error) {
    console.error('Error logging pill usage:', error);
    return NextResponse.json(
      { error: 'Failed to log pill usage' },
      { status: 500 }
    );
  }
}

