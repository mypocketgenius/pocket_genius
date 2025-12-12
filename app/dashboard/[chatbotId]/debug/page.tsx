// app/dashboard/[chatbotId]/debug/page.tsx
// Diagnostic page to help debug feedback quantity mismatches
// Compares Message_Feedback counts with Chunk_Performance aggregates

import { auth, redirect } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

interface DebugPageProps {
  params: Promise<{
    chatbotId: string;
  }>;
}

/**
 * Debug page that compares Message_Feedback counts with Chunk_Performance aggregates
 * Helps identify why dashboard quantities don't match Message_Feedback table
 * 
 * Route: /dashboard/[chatbotId]/debug
 */
export default async function DebugPage({ params }: DebugPageProps) {
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

  // 2. Verify chatbot exists and user owns it
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

  // 3. Get current month/year (same as dashboard filter)
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // 4. Count Message_Feedback records for this chatbot
  // Get all messages for this chatbot's conversations
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

  // Count feedback by type
  const [totalFeedback, helpfulFeedback, notHelpfulFeedback] = await Promise.all([
    prisma.message_Feedback.count({
      where: { messageId: { in: messageIds } },
    }),
    prisma.message_Feedback.count({
      where: {
        messageId: { in: messageIds },
        feedbackType: 'helpful',
      },
    }),
    prisma.message_Feedback.count({
      where: {
        messageId: { in: messageIds },
        feedbackType: 'not_helpful',
      },
    }),
  ]);

  // 5. Get Chunk_Performance aggregates for current month/year
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

  // 6. Get Chunk_Performance aggregates for ALL months/years
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

  // 7. Get breakdown by month/year
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

  // 8. Count chunks filtered by timesUsed >= 5 (dashboard filter)
  const chunksWithMinUsage = await prisma.chunk_Performance.count({
    where: {
      chatbotId,
      month: currentMonth,
      year: currentYear,
      timesUsed: { gte: 5 },
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard Debug</h1>
          <p className="text-gray-600">{chatbot.title}</p>
          <p className="text-sm text-gray-500 mt-2">
            Current filter: Month {currentMonth}/{currentYear}
          </p>
        </div>

        {/* Message Feedback Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Message Feedback (Raw Counts)</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Total Feedback</div>
              <div className="text-2xl font-bold text-blue-600">{totalFeedback}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Helpful</div>
              <div className="text-2xl font-bold text-green-600">{helpfulFeedback}</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Not Helpful</div>
              <div className="text-2xl font-bold text-red-600">{notHelpfulFeedback}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Messages</div>
              <div className="text-2xl font-bold text-gray-600">{messageIds.length}</div>
            </div>
          </div>
        </div>

        {/* Chunk Performance - Current Month */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Chunk Performance - Current Month ({currentMonth}/{currentYear})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Total Chunks</div>
              <div className="text-2xl font-bold text-gray-900">
                {chunkPerformanceCurrentMonth._count.id}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Total Helpful</div>
              <div className="text-2xl font-bold text-green-600">
                {chunkPerformanceCurrentMonth._sum.helpfulCount || 0}
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Total Not Helpful</div>
              <div className="text-2xl font-bold text-red-600">
                {chunkPerformanceCurrentMonth._sum.notHelpfulCount || 0}
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Total Times Used</div>
              <div className="text-2xl font-bold text-blue-600">
                {chunkPerformanceCurrentMonth._sum.timesUsed || 0}
              </div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Chunks (timesUsed ≥ 5)</div>
              <div className="text-2xl font-bold text-yellow-600">{chunksWithMinUsage}</div>
              <div className="text-xs text-gray-500 mt-1">(Dashboard filter)</div>
            </div>
          </div>
        </div>

        {/* Chunk Performance - All Time */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Chunk Performance - All Time</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Total Chunks</div>
              <div className="text-2xl font-bold text-gray-900">
                {chunkPerformanceAllTime._count.id}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Total Helpful</div>
              <div className="text-2xl font-bold text-green-600">
                {chunkPerformanceAllTime._sum.helpfulCount || 0}
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Total Not Helpful</div>
              <div className="text-2xl font-bold text-red-600">
                {chunkPerformanceAllTime._sum.notHelpfulCount || 0}
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Total Times Used</div>
              <div className="text-2xl font-bold text-blue-600">
                {chunkPerformanceAllTime._sum.timesUsed || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown by Month */}
        {chunkPerformanceByMonth.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Breakdown by Month/Year</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Month/Year
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Chunks
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Helpful
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Not Helpful
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Times Used
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {chunkPerformanceByMonth.map((group, idx) => (
                    <tr
                      key={`${group.year}-${group.month}`}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {group.month}/{group.year}
                        {group.month === currentMonth && group.year === currentYear && (
                          <span className="ml-2 text-xs text-blue-600">(Current)</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {group._count.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                        {group._sum.helpfulCount || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                        {group._sum.notHelpfulCount || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-yellow-900 mb-4">Why Quantities Might Not Match</h2>
          <div className="space-y-3 text-sm text-yellow-800">
            <div>
              <strong className="font-semibold">1. Month/Year Filtering:</strong> Dashboard only shows chunks
              from month {currentMonth}/{currentYear}. Feedback from other months won't appear.
            </div>
            <div>
              <strong className="font-semibold">2. One-to-Many Relationship:</strong> One message feedback can
              affect multiple chunks (typically 5 chunks per message). So feedback counts are distributed
              across chunks.
            </div>
            <div>
              <strong className="font-semibold">3. Times Used Filter:</strong> Dashboard filters by{' '}
              <code className="bg-yellow-100 px-1 rounded">timesUsed &gt;= 5</code>. Chunks below this
              threshold won't appear even if they have feedback.
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
    </div>
  );
}
