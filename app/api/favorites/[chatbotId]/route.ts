// app/api/favorites/[chatbotId]/route.ts
// Phase 3.7.6: Toggle Favorite API Endpoint
// Toggles favorite status for a chatbot (create if not exists, delete if exists)

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/favorites/[chatbotId]
 * 
 * Toggles favorite status for a chatbot.
 * - If favorite doesn't exist: Creates it
 * - If favorite exists: Deletes it
 * 
 * Authentication: Required (uses Clerk auth pattern)
 * 
 * @param {Request} req - Next.js request object
 * @param {Object} params - Route parameters
 * @param {string} params.chatbotId - Chatbot ID to favorite/unfavorite
 * 
 * @returns {Promise<NextResponse>} JSON response with isFavorite boolean
 * @throws {401} If authentication required
 * @throws {404} If user or chatbot not found
 * @throws {500} If database error occurs
 */
export async function POST(
  req: Request,
  { params }: { params: { chatbotId: string } }
) {
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

    // 3. Verify chatbot exists
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: params.chatbotId },
      select: { id: true },
    });

    if (!chatbot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404 }
      );
    }

    // 4. Check if favorite already exists
    const existingFavorite = await prisma.favorited_Chatbots.findUnique({
      where: {
        userId_chatbotId: {
          userId: user.id,
          chatbotId: params.chatbotId,
        },
      },
    });

    // 5. Toggle favorite (create if not exists, delete if exists)
    if (existingFavorite) {
      // Delete favorite
      await prisma.favorited_Chatbots.delete({
        where: {
          userId_chatbotId: {
            userId: user.id,
            chatbotId: params.chatbotId,
          },
        },
      });

      return NextResponse.json({ isFavorite: false });
    } else {
      // Create favorite
      await prisma.favorited_Chatbots.create({
        data: {
          userId: user.id,
          chatbotId: params.chatbotId,
        },
      });

      return NextResponse.json({ isFavorite: true });
    }
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return NextResponse.json(
      { error: 'Failed to toggle favorite' },
      { status: 500 }
    );
  }
}

