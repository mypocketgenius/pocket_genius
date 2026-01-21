// app/api/conversations/create/route.ts
// Conversational Intake Flow - Create Conversation Endpoint
// POST: Creates a new conversation for a chatbot with proper chatbotVersionId handling

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/conversations/create
 * 
 * Creates a new conversation for a chatbot.
 * Handles chatbotVersionId fallback logic:
 * 1. Use chatbot.currentVersionId if available
 * 2. Otherwise, get first version ordered by versionNumber ASC
 * 3. If no versions exist, create version 1
 * 
 * Authentication: Required (user must be authenticated)
 * 
 * Request Body:
 * {
 *   chatbotId: string;
 * }
 * 
 * Response (Success - 200):
 * {
 *   conversation: {
 *     id: string;
 *     chatbotId: string;
 *     chatbotVersionId: string;
 *     userId: string;
 *     status: 'active' | 'completed';
 *     messageCount: number;
 *     createdAt: string;
 *   };
 * }
 * 
 * Error Responses:
 * - 400 - Missing chatbotId
 * - 401 - Authentication required
 * - 404 - Chatbot not found or user not found
 * - 500 - Server error
 */
export async function POST(req: Request) {
  try {
    // 1. Authenticate user (required)
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Get database user ID
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

    // 3. Parse request body
    const body = await req.json();
    const { chatbotId } = body;

    // 4. Validate required fields
    if (!chatbotId) {
      return NextResponse.json(
        { error: 'Missing required field: chatbotId' },
        { status: 400 }
      );
    }

    // 5. Fetch chatbot with creator relation (needed for version creation fallback)
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      include: {
        creator: {
          include: {
            users: {
              where: { role: 'OWNER' },
              take: 1,
            },
          },
        },
      },
    });

    if (!chatbot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404 }
      );
    }

    // 6. Get chatbot version ID (use current version or first version as fallback)
    let chatbotVersionId: string;
    if (chatbot.currentVersionId) {
      chatbotVersionId = chatbot.currentVersionId;
    } else {
      // Fallback: get first version or create version 1 if none exists
      const versions = await prisma.chatbot_Version.findMany({
        where: { chatbotId },
        orderBy: { versionNumber: 'asc' },
        take: 1,
      });
      
      if (versions.length > 0) {
        chatbotVersionId = versions[0].id;
      } else {
        // Create version 1 for existing chatbot (data migration scenario)
        // This should rarely happen, but handles edge case
        const creatorUserId = chatbot.creator.users[0]?.userId;
        if (!creatorUserId) {
          return NextResponse.json(
            { error: 'Cannot create version: chatbot creator has no associated user' },
            { status: 500 }
          );
        }
        
        const { createChatbotVersion } = await import('@/lib/chatbot/versioning');
        const version1 = await createChatbotVersion(chatbotId, creatorUserId, {
          systemPrompt: chatbot.systemPrompt || 'You are a helpful assistant.',
          configJson: chatbot.configJson,
          ragSettingsJson: chatbot.ragSettingsJson,
          notes: 'Auto-created version 1 for existing chatbot',
        });
        chatbotVersionId = version1.id;
      }
    }
    
    // 7. Create conversation
    const conversation = await prisma.conversation.create({
      data: {
        chatbotId,
        chatbotVersionId,
        userId: user.id,
        status: 'active',
        messageCount: 0,
      },
    });

    // 8. Return created conversation
    return NextResponse.json({
      conversation: {
        id: conversation.id,
        chatbotId: conversation.chatbotId,
        chatbotVersionId: conversation.chatbotVersionId,
        userId: conversation.userId,
        status: conversation.status,
        messageCount: conversation.messageCount,
        createdAt: conversation.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating conversation:', error);

    // Return appropriate error response
    if (error instanceof Error) {
      const errorMessage =
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'An error occurred while creating conversation';

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}




