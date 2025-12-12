// app/dashboard/[chatbotId]/page.tsx
// Phase 5, Task 1: Dashboard page for viewing chunk performance
// Displays chunk usage statistics and allows creators to see which content is popular

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import DashboardContent from '@/components/dashboard-content';

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
 * - Authentication check (required)
 * - Creator ownership verification
 * - Chunk usage list with pagination
 * - Sorting by timesUsed or satisfactionRate
 * - Chunk text display (fetched from Pinecone if missing)
 */
export default async function DashboardPage({ params }: DashboardPageProps) {
  // 1. Authenticate user (required for dashboard)
  const { userId: clerkUserId } = await auth();
  
  if (!clerkUserId) {
    redirect('/');
  }

  // Get database user ID
  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });

  if (!user) {
    redirect('/');
  }

  const { chatbotId } = await params;

  // 2. Verify chatbot exists and user owns it (via Creator_User)
  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    include: {
      creator: {
        include: {
          users: {
            where: { userId: user.id },
          },
        },
      },
    },
  });

  if (!chatbot) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Chatbot not found</h1>
          <p className="text-gray-600">The chatbot you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  // Check if user is a member of the creator
  if (!chatbot.creator.users || chatbot.creator.users.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You do not have access to this chatbot's dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardContent chatbotId={chatbotId} chatbotTitle={chatbot.title} />
    </div>
  );
}
