// app/api/bookmarks/route.ts
// Phase 2: Bookmarks API route
// CRUD operations for bookmarks

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/bookmarks
 * 
 * Creates Bookmark record:
 * - Checks for duplicate (one bookmark per message per user)
 * - Also logs Event: {eventType: 'bookmark', chunkIds: [...], messageId: string}
 * 
 * Request body:
 * {
 *   "messageId": "message-123",
 *   "chunkIds": ["chunk-1", "chunk-2"],
 *   "notes": "Optional user notes"
 * }
 * 
 * Response: { success: true, bookmarkId: "..." }
 */
export async function POST(req: Request) {
  try {
    // 1. Authenticate user (required for bookmarks)
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get database user ID
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

    // 2. Parse and validate request body
    const body = await req.json();
    const {
      messageId,
      chunkIds = [],
      notes,
    } = body;

    if (!messageId) {
      return NextResponse.json(
        { error: 'messageId is required' },
        { status: 400 }
      );
    }

    // 3. Verify message exists and get chatbotId
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true },
    });

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: message.conversationId },
      select: { chatbotId: true },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // 4. Check for duplicate bookmark
    const existingBookmark = await prisma.bookmark.findUnique({
      where: {
        messageId_userId: {
          messageId,
          userId: user.id,
        },
      },
    });

    if (existingBookmark) {
      return NextResponse.json(
        { error: 'Bookmark already exists' },
        { status: 409 }
      );
    }

    // 5. Create Bookmark record
    const bookmark = await prisma.bookmark.create({
      data: {
        messageId,
        userId: user.id,
        chatbotId: conversation.chatbotId,
        chunkIds: Array.isArray(chunkIds) ? chunkIds : [],
        notes: notes || null,
      },
    });

    // 6. Log bookmark event
    try {
      await prisma.event.create({
        data: {
          sessionId: message.conversationId,
          userId: user.id,
          eventType: 'bookmark',
          chunkIds: Array.isArray(chunkIds) ? chunkIds : [],
          metadata: {
            messageId,
          },
        },
      });
    } catch (error) {
      // Don't fail bookmark creation if event logging fails
      console.error('Error logging bookmark event:', error);
    }

    return NextResponse.json({
      success: true,
      bookmarkId: bookmark.id,
    });
  } catch (error) {
    console.error('Error creating bookmark:', error);
    return NextResponse.json(
      { error: 'Failed to create bookmark' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bookmarks?userId=xxx&chatbotId=xxx
 * 
 * Returns user's bookmarks for chatbot:
 * - Includes message content, source information, and chunkIds
 * - Sorted by createdAt (newest first)
 * 
 * Response: Array of Bookmark objects with message data
 */
export async function GET(req: Request) {
  try {
    // 1. Authenticate user (required for bookmarks)
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get database user ID
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

    // 2. Parse query parameters
    const { searchParams } = new URL(req.url);
    const chatbotId = searchParams.get('chatbotId');

    if (!chatbotId) {
      return NextResponse.json(
        { error: 'chatbotId query parameter is required' },
        { status: 400 }
      );
    }

    // 3. Fetch bookmarks
    const bookmarks = await prisma.bookmark.findMany({
      where: {
        userId: user.id,
        chatbotId,
      },
      include: {
        message: {
          select: {
            id: true,
            content: true,
            role: true,
            createdAt: true,
            context: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Newest first
      },
    });

    return NextResponse.json(bookmarks);
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookmarks' },
      { status: 500 }
    );
  }
}


