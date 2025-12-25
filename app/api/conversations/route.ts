// app/api/conversations/route.ts
// Side Menu Button Feature: Get User Conversations API Endpoint
// Returns all conversations for the authenticated user with chatbot and creator details

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/conversations
 * 
 * Fetches all conversations for the authenticated user, including chatbot details:
 * 1. Authenticates user via Clerk (required)
 * 2. Looks up database user ID
 * 3. Queries conversations filtered by userId
 * 4. Includes chatbot relation with creator relation
 * 5. Orders by updatedAt DESC (most recent first)
 * 6. Returns formatted response
 * 
 * Response Format:
 * {
 *   conversations: Array<{
 *     id: string;
 *     chatbotId: string;
 *     chatbot: {
 *       id: string;
 *       title: string;
 *       type: ChatbotType | null;
 *       creator: {
 *         id: string;
 *         name: string;
 *         slug: string;
 *       };
 *     };
 *     updatedAt: string; // ISO string for sorting by recent
 *     createdAt: string; // ISO string
 *     messageCount: number;
 *   }>;
 * }
 * 
 * @param {Request} req - Next.js request object
 * 
 * @returns {Promise<NextResponse>} JSON response with conversations array
 * @throws {401} If authentication required
 * @throws {404} If user not found
 * @throws {500} If database error occurs
 */
export async function GET(req: Request) {
  try {
    // 1. Authenticate user (required for conversations)
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Look up database user ID
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

    // 3. Query conversations with chatbot and creator relations
    // Filter by userId and order by updatedAt DESC (most recent first)
    const conversations = await prisma.conversation.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        chatbot: {
          select: {
            id: true,
            title: true,
            type: true,
            creator: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    // 4. Transform response to match plan format
    const formattedConversations = conversations.map((conversation) => ({
      id: conversation.id,
      chatbotId: conversation.chatbotId,
      chatbot: {
        id: conversation.chatbot.id,
        title: conversation.chatbot.title,
        type: conversation.chatbot.type,
        creator: {
          id: conversation.chatbot.creator.id,
          name: conversation.chatbot.creator.name,
          slug: conversation.chatbot.creator.slug || null,
        },
      },
      updatedAt: conversation.updatedAt.toISOString(),
      createdAt: conversation.createdAt.toISOString(),
      messageCount: conversation.messageCount,
    }));

    return NextResponse.json({
      conversations: formattedConversations,
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    
    // Return appropriate error response
    if (error instanceof Error) {
      const errorMessage =
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Failed to fetch conversations';

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

