// app/api/feedback/conversation/route.ts
// Phase 2: Conversation feedback API route
// Creates/updates Conversation_Feedback record (chat ratings)

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/feedback/conversation
 * 
 * Creates/updates Conversation_Feedback record:
 * - One rating per conversation (upsert by conversationId)
 * - Updates Chatbot_Ratings_Aggregate after submission (if rating provided)
 * - Allows anonymous users (userId optional)
 * 
 * @example
 * ```typescript
 * await fetch('/api/feedback/conversation', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     conversationId: 'conv-123',
 *     rating: 5,
 *     userGoal: 'I wanted to learn about leadership principles',
 *     goalAchieved: 'Yes',
 *     timeSaved: '30 minutes'
 *   })
 * });
 * ```
 * 
 * @param {Request} req - Next.js request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.conversationId - Conversation ID (required)
 * @param {number} [req.body.rating] - Star rating 1-5 (optional, but recommended)
 * @param {string} [req.body.userGoal] - What user was trying to accomplish (optional)
 * @param {'Yes' | 'Partially' | 'No'} [req.body.goalAchieved] - Whether goal was achieved (optional)
 * @param {string} [req.body.stillNeed] - What's still missing (optional, shown if Partially/No)
 * @param {'5 minutes' | '30 minutes' | '1 hour' | '2+ hours' | 'Not applicable'} [req.body.timeSaved] - Time saved estimate (optional)
 * 
 * @returns {Promise<NextResponse>} JSON response with success status and feedbackId
 * @throws {400} If conversationId is missing or rating is invalid (1-5)
 * @throws {404} If conversation not found
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
      conversationId,
      rating,
      userGoal,
      goalAchieved,
      stillNeed,
      timeSaved,
    } = body;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    if (rating !== null && rating !== undefined && (rating < 1 || rating > 5)) {
      return NextResponse.json(
        { error: 'rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // 3. Verify conversation exists and get chatbotId
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, chatbotId: true },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // 4. Upsert Conversation_Feedback (one rating per conversation)
    const feedback = await prisma.conversation_Feedback.upsert({
      where: { conversationId },
      update: {
        rating: rating || null,
        userGoal: userGoal || null,
        goalAchieved: goalAchieved || null,
        stillNeed: stillNeed || null,
        timeSaved: timeSaved || null,
        userId: dbUserId,
      },
      create: {
        conversationId,
        userId: dbUserId,
        rating: rating || null,
        userGoal: userGoal || null,
        goalAchieved: goalAchieved || null,
        stillNeed: stillNeed || null,
        timeSaved: timeSaved || null,
      },
    });

    // 5. Update Chatbot_Ratings_Aggregate if rating provided
    if (rating) {
      await updateChatbotRatingsAggregate(conversation.chatbotId);
    }

    return NextResponse.json({
      success: true,
      feedbackId: feedback.id,
    });
  } catch (error) {
    console.error('Error submitting conversation feedback:', error);
    return NextResponse.json(
      { error: 'Failed to submit conversation feedback' },
      { status: 500 }
    );
  }
}

/**
 * Updates Chatbot_Ratings_Aggregate table with latest ratings
 */
async function updateChatbotRatingsAggregate(chatbotId: string) {
  try {
    // Get all ratings for this chatbot
    const ratings = await prisma.conversation_Feedback.findMany({
      where: {
        conversation: {
          chatbotId,
        },
        rating: {
          not: null,
        },
      },
      select: {
        rating: true,
      },
    });

    if (ratings.length === 0) {
      return;
    }

    // Calculate aggregate metrics
    const ratingValues = ratings.map((r) => r.rating!);
    const averageRating = ratingValues.reduce((sum, r) => sum + r, 0) / ratingValues.length;
    const ratingCount = ratingValues.length;

    // Calculate distribution
    const distribution: Record<string, number> = {};
    for (let i = 1; i <= 5; i++) {
      distribution[i.toString()] = ratingValues.filter((r) => r === i).length;
    }

    // Upsert aggregate record
    await prisma.chatbot_Ratings_Aggregate.upsert({
      where: { chatbotId },
      update: {
        averageRating,
        ratingCount,
        ratingDistribution: distribution,
      },
      create: {
        chatbotId,
        averageRating,
        ratingCount,
        ratingDistribution: distribution,
      },
    });
  } catch (error) {
    console.error('Error updating chatbot ratings aggregate:', error);
    // Don't throw - this is a background update, shouldn't fail the main request
  }
}

