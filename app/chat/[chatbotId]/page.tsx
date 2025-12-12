// Phase 3, Task 3: Chat page route
// Displays the chat interface for a specific chatbot

import Chat from '@/components/chat';

interface ChatPageProps {
  params: {
    chatbotId: string;
  };
}

/**
 * Chat page that displays the chat interface for a specific chatbot
 * 
 * Route: /chat/[chatbotId]
 * Example: /chat/chatbot_art_of_war
 */
export default function ChatPage({ params }: ChatPageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Chat chatbotId={params.chatbotId} />
    </div>
  );
}
