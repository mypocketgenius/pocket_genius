// Phase 3, Task 3 & Part 4: Chat page route with conversation management
// Displays the chat interface for a specific chatbot

import { Suspense } from 'react';
import Chat from '@/components/chat';

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
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading chat...</div>}>
        <Chat chatbotId={chatbotId} />
      </Suspense>
    </div>
  );
}
