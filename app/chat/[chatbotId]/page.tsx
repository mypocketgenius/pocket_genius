// Phase 3, Task 3 & Part 4: Chat page route with conversation management
// Displays the chat interface for a specific chatbot

import { Suspense } from 'react';
import Chat from '@/components/chat';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { Prisma } from '@prisma/client';

interface ChatPageProps {
  params: Promise<{
    chatbotId: string;
  }>;
  searchParams: Promise<{
    conversationId?: string;
    new?: string;
  }>;
}

/**
 * Retry database query with exponential backoff
 */
async function retryDatabaseQuery<T>(
  query: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | unknown;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await query();
    } catch (error) {
      lastError = error;
      
      // Check if it's a connection error that might be transient
      const isConnectionError =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P1001' || error.code === 'P1008') ||
        (error instanceof Error &&
          (error.message.includes("Can't reach database server") ||
           error.message.includes('ECONNREFUSED') ||
           error.message.includes('timeout')));
      
      // Only retry on connection errors
      if (!isConnectionError || attempt === maxRetries - 1) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
    }
  }
  
  throw lastError;
}

/**
 * Chat page that displays the chat interface for a specific chatbot
 * 
 * Route: /chat/[chatbotId]
 * Example: /chat/chatbot_art_of_war
 * 
 * Supports conversationId query parameter for loading existing conversations
 * Example: /chat/chatbot_art_of_war?conversationId=conv_123
 */
export default async function ChatPage({ params, searchParams }: ChatPageProps) {
  const { chatbotId } = await params;
  const { conversationId, new: isNew } = await searchParams;
  
  try {
    // Fetch chatbot title for display in header with retry logic
    const chatbot = await retryDatabaseQuery(() =>
      prisma.chatbot.findUnique({
        where: { id: chatbotId },
        select: { title: true },
      })
    );

    // If chatbot doesn't exist, show 404
    if (!chatbot) {
      notFound();
    }
    
    return (
      <div className="h-dvh bg-gray-50 overflow-hidden">
        {/* Key forces remount when URL params change - fixes Next.js App Router navigation issue */}
        <Suspense fallback={<div className="flex items-center justify-center h-dvh">Loading chat...</div>}>
          <Chat
            key={`${chatbotId}-${conversationId ?? 'new'}-${isNew ?? ''}`}
            chatbotId={chatbotId}
            chatbotTitle={chatbot.title}
          />
        </Suspense>
      </div>
    );
  } catch (error) {
    // Handle database connection errors gracefully
    const isConnectionError =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P1001' || error.code === 'P1008') ||
      (error instanceof Error &&
        (error.message.includes("Can't reach database server") ||
         error.message.includes('ECONNREFUSED') ||
         error.message.includes('timeout')));
    
    if (isConnectionError) {
      // Show user-friendly error page
      return (
        <div className="flex items-center justify-center h-dvh bg-gray-50">
          <div className="text-center max-w-md p-6">
            <h1 className="text-2xl font-bold mb-4">Connection Error</h1>
            <p className="text-gray-600 mb-4">
              We&apos;re having trouble connecting to the database. This is usually a temporary issue.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Please try refreshing the page in a few moments.
            </p>
            <a
              href={`/chat/${chatbotId}`}
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh Page
            </a>
          </div>
        </div>
      );
    }
    
    // Re-throw other errors (will be handled by Next.js error boundary)
    throw error;
  }
}
