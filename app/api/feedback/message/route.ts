// app/api/feedback/message/route.ts
// Phase 4, Task 1: Feedback API route for thumbs up/down feedback
// Stores feedback and updates Chunk_Performance counters with satisfactionRate computation

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/feedback/message
 * 
 * Handles message feedback (thumbs up/down):
 * 1. Authenticates user (optional for MVP - allow anonymous users)
 * 2. Validates request body (messageId, feedbackType)
 * 3. Stores feedback in Message_Feedback table
 * 4. Retrieves message with context and conversation
 * 5. Updates Chunk_Performance counters for each chunk
 * 6. Computes and updates satisfactionRate
 * 
 * Request body:
 * - messageId: Required message ID
 * - feedbackType: 'helpful' | 'not_helpful'
 * 
 * Response: { success: true }
 */
export async function POST(req: Request) {
  try {
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

    // 2. Parse and validate request body
    const body = await req.json();
    const { messageId, feedbackType } = body;

    if (!messageId) {
      return NextResponse.json(
        { error: 'messageId is required' },
        { status: 400 }
      );
    }

    if (!feedbackType || !['helpful', 'not_helpful'].includes(feedbackType)) {
      return NextResponse.json(
        { error: "feedbackType must be 'helpful' or 'not_helpful'" },
        { status: 400 }
      );
    }

    // 3. Verify message exists
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // Only allow feedback on assistant messages
    if (message.role !== 'assistant') {
      return NextResponse.json(
        { error: 'Feedback can only be given on assistant messages' },
        { status: 400 }
      );
    }

    // 4. Store feedback in Message_Feedback table
    await prisma.message_Feedback.create({
      data: {
        messageId,
        userId: dbUserId || undefined,
        feedbackType,
      },
    });

    // 5. If message has no context (no chunks), return early
    if (!message.context) {
      return NextResponse.json({ success: true });
    }

    // 6. Extract chunks from message context
    const context = message.context as { chunks?: Array<{ chunkId: string; sourceId: string }> };
    const chunks = context.chunks || [];

    if (chunks.length === 0) {
      return NextResponse.json({ success: true });
    }

    // 7. Get chatbotId from conversation
    const chatbotId = message.conversation.chatbotId;

    // 8. Update chunk performance counters for each chunk
    // Phase 4, Task 3: Update Chunk_Performance counters
    // - helpfulCount +1 for thumbs up
    // - notHelpfulCount +1 for thumbs down
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    for (const chunk of chunks) {
      try {
        // Validate chunk has required fields
        if (!chunk.chunkId || !chunk.sourceId) {
          console.warn(
            `Skipping chunk performance update: missing chunkId or sourceId`,
            { chunkId: chunk.chunkId, sourceId: chunk.sourceId }
          );
          continue;
        }

        // Try to find existing record first
        let current = await prisma.chunk_Performance.findUnique({
          where: {
            chunkId_chatbotId_month_year: {
              chunkId: chunk.chunkId,
              chatbotId,
              month,
              year,
            },
          },
        });

        // If record doesn't exist, try to create it
        // Note: This requires sourceId to exist in Source table (foreign key constraint)
        if (!current) {
          try {
            current = await prisma.chunk_Performance.create({
              data: {
                chunkId: chunk.chunkId,
                sourceId: chunk.sourceId,
                chatbotId,
                timesUsed: 0, // Chunk may have been used but record creation failed
                helpfulCount: feedbackType === 'helpful' ? 1 : 0,
                notHelpfulCount: feedbackType === 'not_helpful' ? 1 : 0,
                satisfactionRate: feedbackType === 'helpful' ? 1.0 : 0.0,
                month,
                year,
              },
            });
          } catch (createError) {
            // If creation fails (e.g., foreign key constraint), log and skip
            console.error(
              `Failed to create chunk performance record for chunk ${chunk.chunkId}:`,
              createError
            );
            // Continue to next chunk - don't fail entire feedback submission
            continue;
          }
        }

        // Calculate new counts after increment
        const newHelpfulCount =
          feedbackType === 'helpful'
            ? current.helpfulCount + 1
            : current.helpfulCount;
        const newNotHelpfulCount =
          feedbackType === 'not_helpful'
            ? current.notHelpfulCount + 1
            : current.notHelpfulCount;

        // Compute satisfaction rate
        const totalFeedback = newHelpfulCount + newNotHelpfulCount;
        const satisfactionRate =
          totalFeedback > 0 ? newHelpfulCount / totalFeedback : 0;

        // Update chunk performance with incremented counter and computed satisfactionRate
        await prisma.chunk_Performance.update({
          where: {
            chunkId_chatbotId_month_year: {
              chunkId: chunk.chunkId,
              chatbotId,
              month,
              year,
            },
          },
          data: {
            [feedbackType === 'helpful' ? 'helpfulCount' : 'notHelpfulCount']: {
              increment: 1,
            },
            satisfactionRate,
          },
        });
      } catch (chunkError) {
        // Log error but continue processing other chunks
        // This prevents one failed chunk update from blocking feedback submission
        console.error(
          `Error updating chunk performance for chunk ${chunk.chunkId}:`,
          chunkError
        );
        // Continue to next chunk - feedback submission should still succeed
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing feedback:', error);
    
    // Handle Prisma errors with more specific messages
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      
      // Check for unique constraint violation (user already gave feedback)
      if (errorMessage.includes('unique constraint') || errorMessage.includes('unique')) {
        return NextResponse.json(
          { error: 'Feedback already submitted for this message' },
          { status: 409 }
        );
      }
      
      // Check for foreign key constraint violation
      if (errorMessage.includes('foreign key') || errorMessage.includes('constraint')) {
        return NextResponse.json(
          { error: 'Invalid message or data reference. Please try again.' },
          { status: 400 }
        );
      }
      
      // Check for record not found
      if (errorMessage.includes('record') && errorMessage.includes('not found')) {
        return NextResponse.json(
          { error: 'Message not found' },
          { status: 404 }
        );
      }
      
      // Return the actual error message in development for debugging
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json(
          { error: `Failed to process feedback: ${error.message}` },
          { status: 500 }
        );
      }
    }

    // Generic error for production
    return NextResponse.json(
      { error: 'Failed to process feedback. Please try again.' },
      { status: 500 }
    );
  }
}
