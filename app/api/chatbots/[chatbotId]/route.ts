// app/api/chatbots/[chatbotId]/route.ts
// Phase 3.9: Chatbot Versioning System
// API route for updating chatbot configuration and creating version snapshots

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { createChatbotVersion } from '@/lib/chatbot/versioning';

/**
 * PATCH /api/chatbots/[chatbotId]
 * 
 * Updates chatbot configuration and creates a new version snapshot.
 * Requires authentication and chatbot ownership.
 * 
 * Request body:
 * - systemPrompt?: string
 * - configJson?: any
 * - ragSettingsJson?: any
 * - notes?: string
 * - changelog?: string
 * - title?: string (non-versioned)
 * - description?: string (non-versioned)
 * - shortDescription?: string (non-versioned)
 * - isPublic?: boolean (non-versioned)
 * 
 * Response: { success: true, version?: Chatbot_Version }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
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
    
    // 2. Get database user
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
    
    // 3. Get chatbot ID from params
    const { chatbotId } = await params;
    
    // 4. Verify chatbot exists and user has permission
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      include: { creator: { include: { users: true } } },
    });
    
    if (!chatbot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404 }
      );
    }
    
    // Check ownership: user must be creator
    const isCreator = chatbot.creator.users.some(
      (cu) => cu.userId === user.id && cu.role === 'OWNER'
    );
    
    if (!isCreator) {
      return NextResponse.json(
        { error: 'Unauthorized: You must be the chatbot creator' },
        { status: 403 }
      );
    }
    
    // 5. Parse request body
    const body = await req.json();
    const {
      systemPrompt,
      configJson,
      ragSettingsJson,
      notes,
      changelog,
      // Non-versioned fields
      title,
      description,
      shortDescription,
      isPublic,
    } = body;
    
    // 6. Create new version if versioned fields changed
    const hasVersionedChanges = systemPrompt !== undefined || configJson !== undefined || ragSettingsJson !== undefined;
    let newVersion = null;
    
    if (hasVersionedChanges) {
      newVersion = await createChatbotVersion(chatbotId, user.id, {
        systemPrompt,
        configJson,
        ragSettingsJson,
        notes,
        changelog,
      });
    }
    
    // 7. Update non-versioned fields
    const nonVersionedUpdates: any = {};
    if (title !== undefined) nonVersionedUpdates.title = title;
    if (description !== undefined) nonVersionedUpdates.description = description;
    if (shortDescription !== undefined) nonVersionedUpdates.shortDescription = shortDescription;
    if (isPublic !== undefined) nonVersionedUpdates.isPublic = isPublic;
    
    if (Object.keys(nonVersionedUpdates).length > 0) {
      await prisma.chatbot.update({
        where: { id: chatbotId },
        data: nonVersionedUpdates,
      });
    }
    
    return NextResponse.json({
      success: true,
      version: newVersion,
    });
  } catch (error) {
    console.error('Error updating chatbot:', error);
    
    if (error instanceof Error) {
      // Handle known errors
      if (error.message === 'Chatbot not found') {
        return NextResponse.json(
          { error: 'Chatbot not found' },
          { status: 404 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to update chatbot' },
      { status: 500 }
    );
  }
}

