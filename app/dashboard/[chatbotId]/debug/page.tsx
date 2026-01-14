// app/dashboard/[chatbotId]/debug/page.tsx
// Diagnostic page to help debug feedback quantity mismatches
// Compares Events counts with Chunk_Performance aggregates

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ThemedPageWrapper } from '@/components/themed-page-wrapper';
import { verifyChatbotOwnership } from '@/lib/auth/chatbot-ownership';

interface DebugPageProps {
  params: Promise<{
    chatbotId: string;
  }>;
}

/**
 * Debug page that compares Events counts with Chunk_Performance aggregates
 * Helps identify why dashboard quantities don't match Events table
 * 
 * Route: /dashboard/[chatbotId]/debug
 * 
 * Features:
 * - Authentication check (required) - Phase 5, Task 3
 * - Creator ownership verification - Phase 5, Task 3
 * - Compares raw Events counts with Chunk_Performance aggregates
 * - Shows breakdown by month/year
 * 
 * Note: Message_Feedback table was removed in Phase 2 migration.
 * Feedback is now tracked via Events table (eventType: 'user_message' with feedbackType in metadata).
 */
export default async function DebugPage({ params }: DebugPageProps) {
  const { chatbotId } = await params;

  try {
    // Verify chatbot ownership (Phase 5, Task 3)
    // This handles authentication and authorization checks
    const { chatbot } = await verifyChatbotOwnership(chatbotId);

    // Get current month/year (same as dashboard filter)
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Count Events records for this chatbot (Message_Feedback table was removed in Phase 2)
    // Get all conversations for this chatbot
    const conversations = await prisma.conversation.findMany({
      where: { chatbotId },
      select: { id: true },
    });
    const conversationIds = conversations.map((c) => c.id);

    const messages = await prisma.message.findMany({
      where: {
        conversationId: { in: conversationIds },
        role: 'assistant', // Only assistant messages can have feedback
      },
      select: { id: true },
    });
    const messageIds = messages.map((m) => m.id);

    // Fetch all user_message events for these messages
    // Direct FK query using messageId (much faster than filtering in JavaScript!)
    const feedbackForMessages = await prisma.event.findMany({
      where: {
        eventType: 'user_message',
        messageId: { in: messageIds }, // Direct FK query!
        sessionId: { in: conversationIds },
      },
      select: {
        id: true,
        messageId: true,
        metadata: true,
      },
    });

    const totalFeedback = feedbackForMessages.length;
    const helpfulFeedback = feedbackForMessages.filter((evt) => {
      const metadata = evt.metadata as any;
      return metadata?.feedbackType === 'helpful';
    }).length;
    const notHelpfulFeedback = feedbackForMessages.filter((evt) => {
      const metadata = evt.metadata as any;
      return metadata?.feedbackType === 'not_helpful';
    }).length;

    // Get Chunk_Performance aggregates for current month/year
    const chunkPerformanceCurrentMonth = await prisma.chunk_Performance.aggregate({
      where: {
        chatbotId,
        month: currentMonth,
        year: currentYear,
      },
      _sum: {
        helpfulCount: true,
        notHelpfulCount: true,
        timesUsed: true,
      },
      _count: {
        id: true,
      },
    });

    // Get Chunk_Performance aggregates for ALL months/years
    const chunkPerformanceAllTime = await prisma.chunk_Performance.aggregate({
      where: {
        chatbotId,
      },
      _sum: {
        helpfulCount: true,
        notHelpfulCount: true,
        timesUsed: true,
      },
      _count: {
        id: true,
      },
    });

    // Get breakdown by month/year
    const chunkPerformanceByMonth = await prisma.chunk_Performance.groupBy({
      by: ['month', 'year'],
      where: {
        chatbotId,
      },
      _sum: {
        helpfulCount: true,
        notHelpfulCount: true,
        timesUsed: true,
      },
      _count: {
        id: true,
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
      ],
    });

    // Count chunks filtered by timesUsed >= 5 (dashboard filter)
    const chunksWithMinUsage = await prisma.chunk_Performance.count({
      where: {
        chatbotId,
        month: currentMonth,
        year: currentYear,
        timesUsed: { gte: 5 },
      },
    });

    return (
      <ThemedPageWrapper className="min-h-screen py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Dashboard Debug</h1>
            <p className="opacity-90">{chatbot.title}</p>
          <p className="text-sm opacity-70 mt-2">
            Current filter: Month {currentMonth}/{currentYear}
          </p>
        </div>

        {/* Events Feedback Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Events Feedback (Raw Counts)</h2>
          <p className="text-sm opacity-70 mb-4">
            Note: Message_Feedback table was removed in Phase 2. Feedback is now tracked via Events table.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
              <div className="text-sm opacity-80">Total Feedback</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalFeedback}</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
              <div className="text-sm opacity-80">Helpful</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{helpfulFeedback}</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4">
              <div className="text-sm opacity-80">Not Helpful</div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{notHelpfulFeedback}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-sm opacity-80">Messages</div>
              <div className="text-2xl font-bold text-gray-600 dark:text-gray-300">{messageIds.length}</div>
            </div>
          </div>
        </div>

        {/* Chunk Performance - Current Month */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Chunk Performance - Current Month ({currentMonth}/{currentYear})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-sm opacity-80">Total Chunks</div>
              <div className="text-2xl font-bold">
                {chunkPerformanceCurrentMonth._count.id}
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
              <div className="text-sm opacity-80">Total Helpful</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {chunkPerformanceCurrentMonth._sum.helpfulCount || 0}
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4">
              <div className="text-sm opacity-80">Total Not Helpful</div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {chunkPerformanceCurrentMonth._sum.notHelpfulCount || 0}
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
              <div className="text-sm opacity-80">Total Times Used</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {chunkPerformanceCurrentMonth._sum.timesUsed || 0}
              </div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-4">
              <div className="text-sm opacity-80">Chunks (timesUsed ≥ 5)</div>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{chunksWithMinUsage}</div>
              <div className="text-xs opacity-70 mt-1">(Dashboard filter)</div>
            </div>
          </div>
        </div>

        {/* Chunk Performance - All Time */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Chunk Performance - All Time</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-sm opacity-80">Total Chunks</div>
              <div className="text-2xl font-bold">
                {chunkPerformanceAllTime._count.id}
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
              <div className="text-sm opacity-80">Total Helpful</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {chunkPerformanceAllTime._sum.helpfulCount || 0}
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4">
              <div className="text-sm opacity-80">Total Not Helpful</div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {chunkPerformanceAllTime._sum.notHelpfulCount || 0}
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
              <div className="text-sm opacity-80">Total Times Used</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {chunkPerformanceAllTime._sum.timesUsed || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown by Month */}
        {chunkPerformanceByMonth.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Breakdown by Month/Year</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium opacity-70 uppercase tracking-wider">
                      Month/Year
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium opacity-70 uppercase tracking-wider">
                      Chunks
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium opacity-70 uppercase tracking-wider">
                      Helpful
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium opacity-70 uppercase tracking-wider">
                      Not Helpful
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium opacity-70 uppercase tracking-wider">
                      Times Used
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {chunkPerformanceByMonth.map((group, idx) => (
                    <tr
                      key={`${group.year}-${group.month}`}
                      className={idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {group.month}/{group.year}
                        {group.month === currentMonth && group.year === currentYear && (
                          <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Current)</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm opacity-80">
                        {group._count.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400 font-medium">
                        {group._sum.helpfulCount || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 dark:text-red-400 font-medium">
                        {group._sum.notHelpfulCount || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400 font-medium">
                        {group._sum.timesUsed || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Explanation */}
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-yellow-900 dark:text-yellow-200 mb-4">Why Quantities Might Not Match</h2>
          <div className="space-y-3 text-sm text-yellow-800 dark:text-yellow-200">
            <div>
              <strong className="font-semibold">1. Month/Year Filtering:</strong> Dashboard only shows chunks
              from month {currentMonth}/{currentYear}. Feedback from other months won&apos;t appear.
            </div>
            <div>
              <strong className="font-semibold">2. One-to-Many Relationship:</strong> One message feedback can
              affect multiple chunks (typically 5 chunks per message). So feedback counts are distributed
              across chunks.
            </div>
            <div>
              <strong className="font-semibold">3. Times Used Filter:</strong> Dashboard filters by{' '}
              <code className="bg-yellow-100 dark:bg-yellow-900/50 px-1 rounded">timesUsed &gt;= 5</code>. Chunks below this
              threshold won&apos;t appear even if they have feedback.
            </div>
            <div>
              <strong className="font-semibold">4. Aggregation Level:</strong> Dashboard aggregates feedback
              per chunk per month, not per message. Same chunk in multiple messages accumulates counts.
            </div>
          </div>
        </div>

        {/* Back to Dashboard Link */}
        <div className="mt-6">
          <a
            href={`/dashboard/${chatbotId}`}
            className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            ← Back to Dashboard
          </a>
          </div>
        </div>
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
