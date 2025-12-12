// lib/auth/chatbot-ownership.ts
// Phase 5, Task 3: Reusable authentication utility for verifying chatbot ownership
// Ensures creators can only access dashboards for chatbots they own

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * Result of chatbot ownership verification
 */
export interface ChatbotOwnershipResult {
  userId: string;
  chatbotId: string;
  chatbot: {
    id: string;
    title: string;
    creatorId: string;
  };
}

/**
 * Verifies that the authenticated user owns the specified chatbot
 * 
 * This function:
 * 1. Authenticates the user via Clerk
 * 2. Gets the database user ID
 * 3. Verifies the chatbot exists
 * 4. Checks if the user is a member of the creator that owns the chatbot
 * 
 * @param chatbotId - The ID of the chatbot to verify ownership for
 * @returns ChatbotOwnershipResult if authorized
 * @throws Error with appropriate message if unauthorized or chatbot not found
 * 
 * @example
 * ```typescript
 * // In a server component
 * try {
 *   const { chatbot } = await verifyChatbotOwnership(chatbotId);
 *   // User is authorized, proceed with dashboard logic
 * } catch (error) {
 *   // Handle unauthorized access
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // In an API route
 * try {
 *   const { chatbot } = await verifyChatbotOwnership(chatbotId);
 *   return NextResponse.json({ data: chatbot });
 * } catch (error) {
 *   return NextResponse.json(
 *     { error: error.message },
 *     { status: error.message.includes('not found') ? 404 : 403 }
 *   );
 * }
 * ```
 */
export async function verifyChatbotOwnership(
  chatbotId: string
): Promise<ChatbotOwnershipResult> {
  // 1. Authenticate user (required for dashboard)
  const { userId: clerkUserId } = await auth();
  
  if (!clerkUserId) {
    throw new Error('Authentication required');
  }

  // 2. Get database user ID
  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // 3. Verify chatbot exists and user owns it (via Creator_User)
  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    select: {
      id: true,
      title: true,
      creatorId: true,
      creator: {
        select: {
          users: {
            where: { userId: user.id },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!chatbot) {
    throw new Error('Chatbot not found');
  }

  // 4. Check if user is a member of the creator
  if (!chatbot.creator.users || chatbot.creator.users.length === 0) {
    throw new Error('Unauthorized: You do not have access to this chatbot');
  }

  return {
    userId: user.id,
    chatbotId: chatbot.id,
    chatbot: {
      id: chatbot.id,
      title: chatbot.title,
      creatorId: chatbot.creatorId,
    },
  };
}
