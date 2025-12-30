// app/api/chatbots/public/route.ts
// Phase 3.7.2: Public Chatbots API Endpoint
// Returns public chatbots with filtering, search, and pagination
// Phase 3.7.6: Includes isFavorite field when user is authenticated

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/chatbots/public
 * 
 * Returns paginated list of public chatbots with filtering and search capabilities.
 * No authentication required - this is a public endpoint.
 * 
 * Query Parameters:
 * - page: Page number (default: 1, 1-indexed)
 * - pageSize: Items per page (default: 20)
 * - category: Category ID to filter by
 * - categoryType: CategoryType enum (ROLE, CHALLENGE, STAGE)
 * - creator: Creator ID to filter by
 * - type: ChatbotType enum (BODY_OF_WORK, FRAMEWORK, DEEP_DIVE, ADVISOR_BOARD)
 * - search: Search query (searches title, description, creator name)
 * 
 * Response Format:
 * {
 *   chatbots: Array<{
 *     id: string;
 *     slug: string;
 *     title: string;
 *     description: string | null;
 *     shortDescription: string | null;
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
 *     isFavorite?: boolean; // Only included if user is authenticated
 *   }>;
 *   pagination: { page, pageSize, totalPages, totalItems };
 * }
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/chatbots/public?page=1&pageSize=20&type=DEEP_DIVE');
 * const data = await response.json();
 * ```
 */
export async function GET(req: Request) {
  try {
    // Check authentication (optional - don't require it)
    const { userId: clerkUserId } = await auth();
    let dbUserId: string | null = null;
    
    if (clerkUserId) {
      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { id: true },
      });
      dbUserId = user?.id || null;
    }

    const { searchParams } = new URL(req.url);
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const category = searchParams.get('category');
    const categoryType = searchParams.get('categoryType');
    const creator = searchParams.get('creator');
    const type = searchParams.get('type');
    const search = searchParams.get('search');

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

    // Validate enum values if provided
    if (categoryType && !['ROLE', 'CHALLENGE', 'STAGE'].includes(categoryType)) {
      return NextResponse.json(
        { error: "categoryType must be 'ROLE', 'CHALLENGE', or 'STAGE'" },
        { status: 400 }
      );
    }

    if (type && !['BODY_OF_WORK', 'FRAMEWORK', 'DEEP_DIVE', 'ADVISOR_BOARD'].includes(type)) {
      return NextResponse.json(
        { error: "type must be 'BODY_OF_WORK', 'FRAMEWORK', 'DEEP_DIVE', or 'ADVISOR_BOARD'" },
        { status: 400 }
      );
    }

    // Build base filter: isPublic = true AND isActive = true
    const baseFilters: any[] = [
      { isPublic: true },
      { isActive: true },
    ];

    // Add type filter if provided
    if (type) {
      baseFilters.push({ type });
    }

    // Add creator filter if provided
    if (creator) {
      baseFilters.push({ creatorId: creator });
    }

    // Build search filter if provided
    // Search across title, description, and creator name
    if (search) {
      baseFilters.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { creator: { name: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }

    // Build category filters
    // If category ID provided, filter by Chatbot_Category
    // If categoryType provided, filter by Category type via Chatbot_Category join
    if (category) {
      baseFilters.push({
        categories: {
          some: {
            categoryId: category,
          },
        },
      });
    } else if (categoryType) {
      baseFilters.push({
        categories: {
          some: {
            category: {
              type: categoryType,
            },
          },
        },
      });
    }

    // Combine all filters with AND
    const where = baseFilters.length > 0 ? { AND: baseFilters } : {};

    // Calculate pagination
    const skip = (page - 1) * pageSize;

    // Build include object conditionally
    const includeObj: any = {
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
    };

    // Include favoritedBy relation if user is authenticated
    if (dbUserId) {
      includeObj.favoritedBy = {
        where: { userId: dbUserId },
        select: { id: true },
      };
    }

    // Fetch chatbots and total count in parallel
    const [chatbots, totalItems] = await Promise.all([
      prisma.chatbot.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: {
          createdAt: 'desc', // Most recent first
        },
        include: includeObj,
      }),
      prisma.chatbot.count({ where }),
    ]);

    // Transform response to match spec
    // TypeScript has trouble inferring types from Prisma's conditional include, so we use type assertion
    const transformedChatbots = (chatbots as any[]).map((chatbot: any) => {
      // Convert Decimal averageRating to number
      const ratingsAggregate = chatbot.ratingsAggregate as { averageRating: any; ratingCount: number } | null;
      const averageRating = ratingsAggregate?.averageRating
        ? Number(ratingsAggregate.averageRating)
        : null;

      return {
        id: chatbot.id,
        slug: chatbot.slug,
        title: chatbot.title,
        description: chatbot.description,
        shortDescription: chatbot.shortDescription,
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
        rating: ratingsAggregate
          ? {
              averageRating,
              ratingCount: ratingsAggregate.ratingCount,
            }
          : null,
        categories: chatbot.categories.map((cc: any) => ({
          id: cc.category.id,
          type: cc.category.type,
          label: cc.category.label,
          slug: cc.category.slug,
        })),
        favoriteCount: chatbot._count.favoritedBy,
        // Include isFavorite only if user is authenticated
        ...(dbUserId && 'favoritedBy' in chatbot && Array.isArray(chatbot.favoritedBy) ? {
          isFavorite: chatbot.favoritedBy.length > 0,
        } : {}),
      };
    });

    // Calculate pagination metadata
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
    console.error('Error fetching public chatbots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chatbots' },
      { status: 500 }
    );
  }
}

