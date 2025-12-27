// app/api/favorites/route.ts
// Phase 3.7.6: Get User Favorites API Endpoint
// Returns paginated list of user's favorited chatbots

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/favorites
 * 
 * Returns paginated list of user's favorited chatbots.
 * Same format as /api/chatbots/public response for consistency.
 * 
 * Authentication: Required (uses Clerk auth pattern)
 * 
 * Query Parameters:
 * - page: Page number (default: 1, 1-indexed)
 * - pageSize: Items per page (default: 20)
 * 
 * Response Format:
 * {
 *   chatbots: Array<{
 *     id: string;
 *     slug: string;
 *     title: string;
 *     description: string | null;
 *     imageUrl: string | null;
 *     type: ChatbotType;
 *     priceCents: number;
 *     currency: string;
 *     allowAnonymous: boolean;
 *     createdAt: string;
 *     creator: { id, slug, name, avatarUrl };
 *     rating: { averageRating: number | null, ratingCount: number } | null;
 *     categories: Array<{ id, type, label, slug }>;
 *     favoriteCount: number;
 *     isFavorite: boolean; // Always true for favorites
 *   }>;
 *   pagination: { page, pageSize, totalPages, totalItems };
 * }
 * 
 * @param {Request} req - Next.js request object
 * 
 * @returns {Promise<NextResponse>} JSON response with favorited chatbots
 * @throws {401} If authentication required
 * @throws {404} If user not found
 * @throws {500} If database error occurs
 */
export async function GET(req: Request) {
  try {
    // 1. Authenticate user
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Look up DB user
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

    // 3. Parse query parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    // Validate pagination parameters
    if (page < 1) {
      return NextResponse.json(
        { error: 'Page must be >= 1' },
        { status: 400 }
      );
    }

    if (pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { error: 'Page size must be between 1 and 100' },
        { status: 400 }
      );
    }

    // 4. Calculate pagination
    const skip = (page - 1) * pageSize;

    // 5. Fetch user's favorited chatbots
    const [favorites, totalItems] = await Promise.all([
      prisma.favorited_Chatbots.findMany({
        where: {
          userId: user.id,
        },
        skip,
        take: pageSize,
        orderBy: {
          createdAt: 'desc', // Most recently favorited first
        },
        include: {
          chatbot: {
            include: {
              creator: {
                select: {
                  id: true,
                  slug: true,
                  name: true,
                  avatarUrl: true,
                },
              },
              ratingsAggregate: {
                select: {
                  averageRating: true,
                  ratingCount: true,
                },
              },
              categories: {
                include: {
                  category: {
                    select: {
                      id: true,
                      type: true,
                      label: true,
                      slug: true,
                    },
                  },
                },
              },
              _count: {
                select: {
                  favoritedBy: true,
                },
              },
            },
          },
        },
      }),
      prisma.favorited_Chatbots.count({
        where: {
          userId: user.id,
        },
      }),
    ]);

    // 6. Transform response to match /api/chatbots/public format
    const transformedChatbots = favorites.map((favorite) => {
      const chatbot = favorite.chatbot;
      
      // Convert Decimal averageRating to number
      const averageRating = chatbot.ratingsAggregate?.averageRating
        ? Number(chatbot.ratingsAggregate.averageRating)
        : null;

      return {
        id: chatbot.id,
        slug: chatbot.slug,
        title: chatbot.title,
        description: chatbot.description,
        imageUrl: chatbot.imageUrl,
        type: chatbot.type,
        priceCents: chatbot.priceCents,
        currency: chatbot.currency,
        allowAnonymous: chatbot.allowAnonymous,
        createdAt: chatbot.createdAt.toISOString(),
        creator: {
          id: chatbot.creator.id,
          slug: chatbot.creator.slug,
          name: chatbot.creator.name,
          avatarUrl: chatbot.creator.avatarUrl,
        },
        rating: chatbot.ratingsAggregate
          ? {
              averageRating,
              ratingCount: chatbot.ratingsAggregate.ratingCount,
            }
          : null,
        categories: chatbot.categories.map((cc) => ({
          id: cc.category.id,
          type: cc.category.type,
          label: cc.category.label,
          slug: cc.category.slug,
        })),
        favoriteCount: chatbot._count.favoritedBy,
        isFavorite: true, // Always true for favorites
      };
    });

    // 7. Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / pageSize);

    return NextResponse.json({
      chatbots: transformedChatbots,
      pagination: {
        page,
        pageSize,
        totalPages,
        totalItems,
      },
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return NextResponse.json(
      { error: 'Failed to fetch favorites' },
      { status: 500 }
    );
  }
}

