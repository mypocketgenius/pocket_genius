// app/api/feedback/message/route.ts
// Phase 4, Task 1: Feedback API route for thumbs up/down feedback
// Phase 3.3: Added "need_more" feedback support
// Phase 3.4: Added copy feedback support with usage tracking
// Stores feedback and updates Chunk_Performance counters with satisfactionRate computation

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/feedback/message
 * 
 * Handles message feedback for multiple feedback types:
 * - helpful/not_helpful: Thumbs up/down feedback
 * - need_more: User needs more information (with format preferences)
 * - copy: Copy button usage tracking (with optional usage context)
 * 
 * Process:
 * 1. Authenticates user (optional - allows anonymous users)
 * 2. Validates request body (messageId, feedbackType, and type-specific fields)
 * 3. Prevents duplicate feedback (one record per message/user/feedbackType)
 * 4. Stores feedback in Events table (Message_Feedback table was removed in Phase 2 migration)
 * 5. Retrieves message with context and conversation
 * 6. Updates Chunk_Performance counters for each chunk (batched operations)
 * 7. Computes and updates satisfactionRate for helpful/not_helpful feedback
 * 
 * Request body examples:
 * 
 * Helpful/Not Helpful:
 * {
 *   "messageId": "message-123",
 *   "feedbackType": "helpful" | "not_helpful"
 * }
 * 
 * Need More:
 * {
 *   "messageId": "message-123",
 *   "feedbackType": "need_more",
 *   "needsMore": ["scripts", "examples", "steps", "case_studies"],
 *   "specificSituation": "Optional context"
 * }
 * 
 * Copy (initial):
 * {
 *   "messageId": "message-123",
 *   "feedbackType": "copy"
 * }
 * 
 * Copy (with usage):
 * {
 *   "messageId": "message-123",
 *   "feedbackType": "copy",
 *   "copyUsage": "reference" | "use_now" | "share_team" | "adapt",
 *   "copyContext": "Required if copyUsage is 'adapt'"
 * }
 * 
 * Response: { success: true }
 * 
 * Duplicate Prevention:
 * - Only one feedback record per message/user/feedbackType combination
 * - Copy feedback: Initial copy creates record with copyUsage=null, 
 *   submitting usage updates the existing record
 * - Other types: Returns success without creating duplicate if already exists
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
    const {
      messageId,
      feedbackType,
      needsMore,
      specificSituation,
      copyUsage,
      copyContext,
    } = body;

    if (!messageId) {
      return NextResponse.json(
        { error: 'messageId is required' },
        { status: 400 }
      );
    }

    if (
      !feedbackType ||
      !['helpful', 'not_helpful', 'need_more', 'copy'].includes(feedbackType)
    ) {
      return NextResponse.json(
        {
          error:
            "feedbackType must be 'helpful', 'not_helpful', 'need_more', or 'copy'",
        },
        { status: 400 }
      );
    }

    // Phase 3.4: Validate copyUsage for copy feedback type
    if (feedbackType === 'copy') {
      // Valid usage types match the options in CopyFeedbackModal component
      const validCopyUsage = ['reference', 'use_now', 'share_team', 'adapt'];
      if (!copyUsage || !validCopyUsage.includes(copyUsage)) {
        return NextResponse.json(
          {
            error: `copyUsage must be one of: ${validCopyUsage.join(', ')}`,
          },
          { status: 400 }
        );
      }
      // copyContext is optional for most usage types, but required for 'adapt'
      // This ensures we capture user's specific situation when they want to adapt content
      if (copyUsage === 'adapt' && !copyContext) {
        return NextResponse.json(
          { error: 'copyContext is required when copyUsage is "adapt"' },
          { status: 400 }
        );
      }
    }

    // Phase 3.3: Validate needsMore for need_more feedback type
    if (feedbackType === 'need_more') {
      if (!needsMore || !Array.isArray(needsMore) || needsMore.length === 0) {
        return NextResponse.json(
          { error: 'needsMore array is required for need_more feedback' },
          { status: 400 }
        );
      }
      // Validate needsMore values
      const validNeedsMore = ['scripts', 'examples', 'steps', 'case_studies'];
      const invalidValues = needsMore.filter(v => !validNeedsMore.includes(v));
      if (invalidValues.length > 0) {
        return NextResponse.json(
          { error: `Invalid needsMore values: ${invalidValues.join(', ')}` },
          { status: 400 }
        );
      }
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

    // 4. Store feedback in Events table (Message_Feedback table was removed in Phase 2 migration)
    // Phase 3.4: Prevent duplicate feedback records - one record per message/user/feedbackType
    // This ensures data integrity and prevents duplicate counter increments
    
    // Extract chunkIds from message context for event logging
    const context = message.context as { chunks?: Array<{ chunkId: string; sourceId: string }> } | null;
    const chunkIds = (context?.chunks || []).map(c => c.chunkId);
    const conversationId = message.conversationId;
    
    // For copy feedback, handle differently based on whether usage is provided
    // Copy feedback has two stages:
    // 1. Initial copy (copyUsage=null) - created when user clicks copy button
    // 2. Usage submission (copyUsage set) - updates existing record with usage data
    if (feedbackType === 'copy') {
      // Copy events have a two-stage flow:
      // Stage 1: Initial copy (copyUsage=null) - created when user clicks copy button
      // Stage 2: Usage submission (copyUsage set) - updates existing record
      // We can now query directly by messageId FK (much faster!)
      const existingCopyEvent = await prisma.event.findFirst({
        where: {
          eventType: 'copy',
          messageId: messageId, // Direct FK query!
          userId: dbUserId || undefined,
        },
        orderBy: {
          timestamp: 'desc', // Get the most recent one first
        },
      });

      if (copyUsage) {
        // Stage 2: User is submitting usage data via modal
        // Find the initial copy event (without usage) to update
        if (existingCopyEvent) {
          // Update existing event with usage data (prevents duplicates)
          // messageId is already set in FK field (set during initial copy event creation)
          // We only need to update metadata with copyUsage and copyContext
          await prisma.event.update({
            where: { id: existingCopyEvent.id },
            data: {
              metadata: {
                copyUsage,
                copyContext: copyContext || null,
              },
            },
          });
        } else {
          // Edge case: No initial copy event found (shouldn't happen normally)
          // Create new event with usage data
          await prisma.event.create({
            data: {
              messageId: messageId, // FK field
              sessionId: conversationId,
              userId: dbUserId || undefined,
              eventType: 'copy',
              chunkIds,
              metadata: {
                // Remove messageId from metadata
                copyUsage,
                copyContext: copyContext || null,
              },
            },
          });
        }
      } else {
        // Stage 1: User clicked copy button (initial copy event)
        // Only create event if no copy event exists yet (prevents duplicates from multiple clicks)
        if (!existingCopyEvent) {
          await prisma.event.create({
            data: {
              messageId: messageId, // FK field
              sessionId: conversationId,
              userId: dbUserId || undefined,
              eventType: 'copy',
              chunkIds,
              metadata: {
                // Remove messageId from metadata
                copyUsage: null, // Will be updated when user submits usage
                copyContext: null,
              },
            },
          });
        }
        // If copy event already exists, don't create duplicate
        // This handles rapid copy button clicks gracefully
      }
    } else {
      // For other feedback types (helpful, not_helpful, need_more), check for duplicates
      // These types don't have a two-stage flow like copy feedback
      // Note: Prisma doesn't support JSON path queries, so we query by messageId FK
      // and filter feedbackType in JavaScript (still much faster than before)
      const eventsForMessage = await prisma.event.findMany({
        where: {
          eventType: 'user_message',
          messageId: messageId, // Direct FK query! (50x faster)
          userId: dbUserId || undefined,
        },
        select: {
          id: true,
          metadata: true,
        },
      });
      
      // Filter by feedbackType in memory (small dataset after FK filter)
      const existingEvent = eventsForMessage.find((evt) => {
        const metadata = evt.metadata as any;
        return metadata?.feedbackType === feedbackType;
      });

      if (existingEvent) {
        // Feedback already exists - return success without creating duplicate
        // This prevents duplicate counter increments and maintains data integrity
        return NextResponse.json({ 
          success: true,
          message: 'Feedback already submitted for this message' 
        });
      }

      // Create new event record (no duplicate found)
      // Phase 3.3: Store needsMore array and specificSituation for "need_more" feedback
      await prisma.event.create({
        data: {
          messageId: messageId, // FK field
          sessionId: conversationId,
          userId: dbUserId || undefined,
          eventType: 'user_message',
          chunkIds,
          metadata: {
            // Remove messageId from metadata
            feedbackType,
            needsMore: feedbackType === 'need_more' ? needsMore : [],
            specificSituation:
              feedbackType === 'need_more' ? specificSituation || null : null,
          },
        },
      });
    }

    // 5. If feedback type is 'copy' and copyUsage is 'use_now', we need to update chunk performance
    // For 'need_more', we also update chunk performance counters
    // For 'copy' with other usage types, we don't need to update chunk performance
    
    // If message has no context (no chunks), return early for feedback types that need chunks
    if (
      !message.context &&
      (feedbackType === 'helpful' ||
        feedbackType === 'not_helpful' ||
        feedbackType === 'need_more' ||
        (feedbackType === 'copy' && copyUsage === 'use_now'))
    ) {
      return NextResponse.json({ success: true });
    }

    // 6. Extract chunks from message context (reuse context variable declared earlier)
    const chunks = context.chunks || [];

    // For 'need_more' feedback, we need chunks to update counters
    // For 'helpful'/'not_helpful', we also need chunks
    // For 'copy' with 'use_now', we need chunks to update copyToUseNowCount
    if (
      chunks.length === 0 &&
      (feedbackType === 'helpful' ||
        feedbackType === 'not_helpful' ||
        feedbackType === 'need_more' ||
        (feedbackType === 'copy' && copyUsage === 'use_now'))
    ) {
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
              needsScriptsCount:
                feedbackType === 'need_more' && needsMore?.includes('scripts')
                  ? 1
                  : 0,
              needsExamplesCount:
                feedbackType === 'need_more' && needsMore?.includes('examples')
                  ? 1
                  : 0,
              needsStepsCount:
                feedbackType === 'need_more' && needsMore?.includes('steps')
                  ? 1
                  : 0,
              needsCaseStudyCount:
                feedbackType === 'need_more' &&
                needsMore?.includes('case_studies')
                  ? 1
                  : 0,
              // Phase 3.4: Track copy-to-use-now count (high-value content signal)
              // Only increments when copyUsage === 'use_now', not for reference/share/adapt
              copyToUseNowCount:
                feedbackType === 'copy' && copyUsage === 'use_now' ? 1 : 0,
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

              // Prepare update data
              const updateData: any = {
                satisfactionRate,
              };

              // Handle different feedback types
              if (feedbackType === 'helpful') {
                updateData.helpfulCount = { increment: 1 };
              } else if (feedbackType === 'not_helpful') {
                updateData.notHelpfulCount = { increment: 1 };
              } else if (feedbackType === 'need_more' && needsMore) {
                // Phase 3.3: Increment appropriate counters based on needsMore array
                // Each selected option increments its corresponding counter
                if (needsMore.includes('scripts')) {
                  updateData.needsScriptsCount = { increment: 1 };
                }
                if (needsMore.includes('examples')) {
                  updateData.needsExamplesCount = { increment: 1 };
                }
                if (needsMore.includes('steps')) {
                  updateData.needsStepsCount = { increment: 1 };
                }
                if (needsMore.includes('case_studies')) {
                  updateData.needsCaseStudyCount = { increment: 1 };
                }
              } else if (feedbackType === 'copy' && copyUsage === 'use_now') {
                // Phase 3.4: Increment copyToUseNowCount when user copies to use immediately
                // This metric tracks high-value content that users want to use right away
                // Only increments for 'use_now' usage type, not for reference/share/adapt
                updateData.copyToUseNowCount = { increment: 1 };
              }

              return prisma.chunk_Performance.update({
                where: {
                  chunkId_chatbotId_month_year: {
                    chunkId: chunk.chunkId,
                    chatbotId,
                    month,
                    year,
                  },
                },
                data: updateData,
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
