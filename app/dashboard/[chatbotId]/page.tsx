// app/dashboard/[chatbotId]/page.tsx
// Phase 5, Task 1: Dashboard page for viewing chunk performance
// Displays chunk usage statistics and allows creators to see which content is popular

import { redirect } from 'next/navigation';
import DashboardContent from '@/components/dashboard-content';
import { ThemedPageWrapper } from '@/components/themed-page-wrapper';
import { verifyChatbotOwnership } from '@/lib/auth/chatbot-ownership';

interface DashboardPageProps {
  params: Promise<{
    chatbotId: string;
  }>;
}

/**
 * Dashboard page that displays chunk performance data
 * 
 * Route: /dashboard/[chatbotId]
 * Example: /dashboard/chatbot_art_of_war
 * 
 * Features:
 * - Authentication check (required) - Phase 5, Task 3
 * - Creator ownership verification - Phase 5, Task 3
 * - Chunk usage list with pagination
 * - Sorting by timesUsed or satisfactionRate
 * - Chunk text display (fetched from Pinecone if missing)
 */
export default async function DashboardPage({ params }: DashboardPageProps) {
  const { chatbotId } = await params;

  try {
    // Verify chatbot ownership (Phase 5, Task 3)
    // This handles authentication and authorization checks
    const { chatbot } = await verifyChatbotOwnership(chatbotId);

    return (
      <ThemedPageWrapper className="min-h-screen">
        <DashboardContent chatbotId={chatbot.id} chatbotTitle={chatbot.title} />
      </ThemedPageWrapper>
    );
  } catch (error) {
    // Handle authentication/authorization errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage === 'Authentication required' || errorMessage === 'User not found') {
      redirect('/');
    }

    if (errorMessage === 'Chatbot not found') {
      return (
        <ThemedPageWrapper className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Chatbot not found</h1>
            <p className="opacity-90">The chatbot you&apos;re looking for doesn&apos;t exist.</p>
          </div>
        </ThemedPageWrapper>
      );
    }

    // Unauthorized access
    return (
      <ThemedPageWrapper className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="opacity-90">You do not have access to this chatbot&apos;s dashboard.</p>
        </div>
      </ThemedPageWrapper>
    );
  }
}
