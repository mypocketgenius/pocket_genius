// app/api/chatbots/[chatbotId]/reviews/route.ts
// Phase 3.7.3: Chatbot Reviews API Endpoint
// Returns reviews (Conversation_Feedback) for a specific chatbot

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/chatbots/[chatbotId]/reviews
 * 
 * Returns paginated list of reviews (Conversation_Feedback) for a chatbot.
 * No authentication required - this is a public endpoint.
 * 
 * Query Parameters:
 * - page: Page number (default: 1, 1-indexed)
 * - pageSize: Items per page (default: 5)
 * - sort: Sort order - "recent" (default), "rating_high", "rating_low"
 * 
 * Response Format:
 * {
 *   reviews: Array<{
 *     id: string;
 *     userId: string | null;
 *     userName: string | null;
 *     rating: number | null;
 *     comment: string | null; // From userGoal or stillNeed fields
 *     timeSaved: string | null;
 *     createdAt: string;
 *   }>;
 *   pagination: { page, pageSize, totalPages, totalItems };
 * }
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/chatbots/chatbot_123/reviews?page=1&pageSize=5&sort=recent');
 * const data = await response.json();
 * ```
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { chatbotId } = await params;
    const { searchParams } = new URL(req.url);
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '5', 10);
    const sort = searchParams.get('sort') || 'recent';

    // Validate pagination parameters
    if (page < 1) {
      return NextResponse.json(
        { error: 'Page must be >= 1' },
        { status: 400 }
      );
    }

    if (pageSize < 1 || pageSize > 50) {
      return NextResponse.json(
        { error: 'Page size must be between 1 and 50' },
        { status: 400 }
      );
    }

    // Validate sort parameter
    if (!['recent', 'rating_high', 'rating_low'].includes(sort)) {
      return NextResponse.json(
        { error: "sort must be 'recent', 'rating_high', or 'rating_low'" },
        { status: 400 }
      );
    }

    // Verify chatbot exists
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

    // Build orderBy based on sort parameter
    let orderBy: any = {};
    if (sort === 'recent') {
      orderBy = { createdAt: 'desc' };
    } else if (sort === 'rating_high') {
      orderBy = { rating: 'desc' };
    } else if (sort === 'rating_low') {
      orderBy = { rating: 'asc' };
    }

    // Calculate pagination
    const skip = (page - 1) * pageSize;

    // Fetch reviews and total count in parallel
    const [reviews, totalItems] = await Promise.all([
      prisma.conversation_Feedback.findMany({
        where: {
          conversation: {
            chatbotId,
          },
          // Only include reviews with rating or comment
          OR: [
            { rating: { not: null } },
            { userGoal: { not: null } },
            { stillNeed: { not: null } },
          ],
        },
        skip,
        take: pageSize,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
        },
      }),
      prisma.conversation_Feedback.count({
        where: {
          conversation: {
            chatbotId,
          },
          OR: [
            { rating: { not: null } },
            { userGoal: { not: null } },
            { stillNeed: { not: null } },
          ],
        },
      }),
    ]);

    // Transform reviews to match response format
    const transformedReviews = reviews.map((review) => {
      // Get user name - use firstName + lastName, or username, or "Anonymous"
      let userName: string | null = null;
      if (review.user) {
        if (review.user.firstName || review.user.lastName) {
          userName = [review.user.firstName, review.user.lastName]
            .filter(Boolean)
            .join(' ');
        } else if (review.user.username) {
          userName = review.user.username;
        }
      }
      // If userId is null or user not found, show "Anonymous"
      if (!review.userId || !userName) {
        userName = null; // Will be displayed as "Anonymous" in UI
      }

      // Comment comes from userGoal or stillNeed (prefer userGoal, fallback to stillNeed)
      const comment = review.userGoal || review.stillNeed || null;

      return {
        id: review.id,
        userId: review.userId,
        userName,
        rating: review.rating,
        comment,
        timeSaved: review.timeSaved,
        createdAt: review.createdAt.toISOString(),
      };
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / pageSize);

    return NextResponse.json({
      reviews: transformedReviews,
      pagination: {
        page,
        pageSize,
        totalPages,
        totalItems,
      },
    });
  } catch (error) {
    console.error('Error fetching chatbot reviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

