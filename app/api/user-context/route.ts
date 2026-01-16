// app/api/user-context/route.ts
// Phase 3.10, Step 9: User Context API
// GET: Fetch user contexts
// PATCH: Update user context value
// POST: Create new user context

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { ContextSource } from '@prisma/client';

/**
 * GET /api/user-context
 * 
 * Fetches all user contexts for the authenticated user.
 * Requires authentication.
 * 
 * Response Format:
 * {
 *   contexts: Array<{
 *     id: string;
 *     key: string;
 *     value: any;
 *     chatbotId: string | null;
 *     source: ContextSource;
 *     isVisible: boolean;
 *     isEditable: boolean;
 *     createdAt: string;
 *     updatedAt: string;
 *   }>;
 * }
 */
export async function GET(request: Request) {
  try {
    // 1. Authenticate user
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Get database user
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 3. Parse optional chatbotId query parameter
    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get('chatbotId');

    // 4. Build where clause - filter by chatbotId if provided
    const whereClause: { userId: string; chatbotId?: string } = {
      userId: user.id,
    };

    if (chatbotId) {
      // Filter to only chatbot-specific contexts (exclude global contexts where chatbotId IS NULL)
      whereClause.chatbotId = chatbotId;
    }
    // If chatbotId not provided, return all contexts (existing behavior for backward compatibility)

    // 5. Fetch user contexts with optional filtering
    const contexts = await prisma.user_Context.findMany({
      where: whereClause,
      include: {
        chatbot: {
          select: { id: true, title: true },
        },
      },
      orderBy: [
        { chatbotId: 'asc' }, // Global context first (null) - only relevant when chatbotId not provided
        { key: 'asc' },
      ],
    });

    return NextResponse.json({ contexts });
  } catch (error) {
    console.error('Error fetching user contexts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user contexts' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user-context
 * 
 * Updates a user context value.
 * Requires authentication and ownership of the context.
 * Only updates if context is editable.
 * 
 * Request Body:
 * {
 *   contextId: string;
 *   value: any;  // New value (will be stored as JSON)
 * }
 * 
 * Response Format:
 * {
 *   success: boolean;
 *   context?: {
 *     id: string;
 *     key: string;
 *     value: any;
 *     updatedAt: string;
 *   };
 * }
 */
export async function PATCH(request: Request) {
  try {
    // 1. Authenticate user
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Get database user
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 3. Parse request body
    const body = await request.json();
    const { contextId, value } = body;

    if (!contextId) {
      return NextResponse.json(
        { error: 'contextId is required' },
        { status: 400 }
      );
    }

    // 4. Fetch context and verify ownership
    const context = await prisma.user_Context.findUnique({
      where: { id: contextId },
    });

    if (!context) {
      return NextResponse.json(
        { error: 'Context not found' },
        { status: 404 }
      );
    }

    // 5. Verify ownership and editability
    if (context.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    if (!context.isEditable) {
      return NextResponse.json(
        { error: 'Context is not editable' },
        { status: 403 }
      );
    }

    // 6. Update context value
    const updatedContext = await prisma.user_Context.update({
      where: { id: contextId },
      data: {
        value, // Prisma will handle JSON serialization
        source: ContextSource.USER_PROVIDED, // Mark as user-provided when edited
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      context: {
        id: updatedContext.id,
        key: updatedContext.key,
        value: updatedContext.value,
        updatedAt: updatedContext.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error updating user context:', error);
    return NextResponse.json(
      { error: 'Failed to update user context' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user-context
 * 
 * Creates a new user context.
 * Requires authentication.
 * 
 * Request Body:
 * {
 *   chatbotId?: string | null;  // Optional chatbot ID (null for global context)
 *   key: string;                 // Context key (e.g., 'industry', 'role')
 *   value: any;                  // Context value (will be stored as JSON)
 * }
 * 
 * Response Format:
 * {
 *   context: {
 *     id: string;
 *     userId: string;
 *     chatbotId: string | null;
 *     key: string;
 *     value: any;
 *     source: ContextSource;
 *     isVisible: boolean;
 *     isEditable: boolean;
 *     createdAt: string;
 *     updatedAt: string;
 *   };
 * }
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Get database user
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 3. Parse request body
    const body = await request.json();
    const { chatbotId, key, value } = body;

    if (!key) {
      return NextResponse.json(
        { error: 'key is required' },
        { status: 400 }
      );
    }

    // 4. Check if context already exists (unique constraint: userId, chatbotId, key)
    const existingContext = await prisma.user_Context.findFirst({
      where: {
        userId: user.id,
        chatbotId: chatbotId || null,
        key,
      },
    });

    if (existingContext) {
      return NextResponse.json(
        { error: 'Context with this key already exists' },
        { status: 409 } // Conflict
      );
    }

    // 5. Create new context
    const context = await prisma.user_Context.create({
      data: {
        userId: user.id,
        chatbotId: chatbotId || null,
        key,
        value, // Prisma will handle JSON serialization
        source: ContextSource.USER_PROVIDED,
        isVisible: true,
        isEditable: true,
      },
    });

    return NextResponse.json({
      context: {
        id: context.id,
        userId: context.userId,
        chatbotId: context.chatbotId,
        key: context.key,
        value: context.value,
        source: context.source,
        isVisible: context.isVisible,
        isEditable: context.isEditable,
        createdAt: context.createdAt.toISOString(),
        updatedAt: context.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating user context:', error);
    return NextResponse.json(
      { error: 'Failed to create user context' },
      { status: 500 }
    );
  }
}

