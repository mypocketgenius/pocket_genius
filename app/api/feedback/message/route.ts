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

    // 8. Update chunk performance counters for each chunk (BATCHED OPERATIONS)
    // Phase 0.1: Optimized to use batched queries instead of sequential loops
    // - helpfulCount +1 for thumbs up
    // - notHelpfulCount +1 for thumbs down
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    // Filter out invalid chunks
    const validChunks = chunks.filter(
      (chunk) => chunk.chunkId && chunk.sourceId
    );

    if (validChunks.length === 0) {
      return NextResponse.json({ success: true });
    }

    try {
      // 1. Get all existing chunk performance records in one query
      const existingRecords = await prisma.chunk_Performance.findMany({
        where: {
          chatbotId,
          month,
          year,
          chunkId: { in: validChunks.map((c) => c.chunkId) },
        },
      });

      // 2. Prepare batch creates and updates
      const existingChunkIds = new Set(
        existingRecords.map((r) => r.chunkId)
      );
      const recordsToCreate = validChunks.filter(
        (chunk) => !existingChunkIds.has(chunk.chunkId)
      );
      const recordsToUpdate = validChunks.filter((chunk) =>
        existingChunkIds.has(chunk.chunkId)
      );

      // 3. Batch create new records
      if (recordsToCreate.length > 0) {
        try {
          await prisma.chunk_Performance.createMany({
            data: recordsToCreate.map((chunk) => ({
              chunkId: chunk.chunkId,
              sourceId: chunk.sourceId,
              chatbotId,
              month,
              year,
              timesUsed: 0,
              helpfulCount: feedbackType === 'helpful' ? 1 : 0,
              notHelpfulCount: feedbackType === 'not_helpful' ? 1 : 0,
              satisfactionRate: feedbackType === 'helpful' ? 1.0 : 0.0,
            })),
            skipDuplicates: true, // Handle race conditions
          });
        } catch (createError) {
          // Log errors but continue - some records may fail due to foreign key constraints
          console.error(
            `Failed to batch create chunk performance records:`,
            createError
          );
        }
      }

      // 4. Batch update existing records (use transaction for atomicity)
      if (recordsToUpdate.length > 0) {
        try {
          await prisma.$transaction(
            recordsToUpdate.map((chunk) => {
              const current = existingRecords.find(
                (r) => r.chunkId === chunk.chunkId
              )!;
              const newHelpfulCount =
                feedbackType === 'helpful'
                  ? current.helpfulCount + 1
                  : current.helpfulCount;
              const newNotHelpfulCount =
                feedbackType === 'not_helpful'
                  ? current.notHelpfulCount + 1
                  : current.notHelpfulCount;
              const totalFeedback = newHelpfulCount + newNotHelpfulCount;
              const satisfactionRate =
                totalFeedback > 0 ? newHelpfulCount / totalFeedback : 0;

              return prisma.chunk_Performance.update({
                where: {
                  chunkId_chatbotId_month_year: {
                    chunkId: chunk.chunkId,
                    chatbotId,
                    month,
                    year,
                  },
                },
                data: {
                  [feedbackType === 'helpful'
                    ? 'helpfulCount'
                    : 'notHelpfulCount']: {
                    increment: 1,
                  },
                  satisfactionRate,
                },
              });
            })
          );
        } catch (updateError) {
          // Log errors but don't fail entire request
          console.error(
            `Failed to batch update chunk performance records:`,
            updateError
          );
        }
      }
    } catch (batchError) {
      // Log error but don't fail feedback submission
      console.error(
        `Error in batched chunk performance update:`,
        batchError
      );
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
