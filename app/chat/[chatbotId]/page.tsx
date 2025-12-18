// Phase 3, Task 3 & Part 4: Chat page route with conversation management
// Displays the chat interface for a specific chatbot

import { Suspense } from 'react';
import Chat from '@/components/chat';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

interface ChatPageProps {
  params: Promise<{
    chatbotId: string;
  }>;
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
export default async function ChatPage({ params }: ChatPageProps) {
  const { chatbotId } = await params;
  
  // Fetch chatbot title for display in header
  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    select: { title: true },
  });

  // If chatbot doesn't exist, show 404
  if (!chatbot) {
    notFound();
  }
  
  return (
    <div className="h-dvh bg-gray-50 overflow-hidden">
      <Suspense fallback={<div className="flex items-center justify-center h-dvh">Loading chat...</div>}>
        <Chat chatbotId={chatbotId} chatbotTitle={chatbot.title} />
      </Suspense>
    </div>
  );
}
