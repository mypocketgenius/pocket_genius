// app/api/pills/route.ts
// Phase 2: Pills API route
// Returns all pills for a chatbot (system + chatbot-specific)

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/pills?chatbotId=xxx
 * 
 * Returns all pills for a chatbot:
 * - System pills (chatbotId: NULL) - feedback + expansion pills (apply to all chatbots)
 * - Chatbot-specific pills (chatbotId: xxx) - suggested questions (custom per chatbot)
 * 
 * Filters by isActive: true
 * Sorted by pillType (asc) then displayOrder (asc)
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/pills?chatbotId=bot-123');
 * const pills = await response.json();
 * // Returns: [{ id: 'pill-1', pillType: 'feedback', label: 'Helpful', ... }, ...]
 * ```
 * 
 * @param {Request} req - Next.js request object
 * @param {string} req.url - Request URL with chatbotId query parameter
 * 
 * @returns {Promise<NextResponse>} JSON response with array of Pill objects
 * @throws {400} If chatbotId query parameter is missing
 * @throws {404} If chatbot not found
 * @throws {500} If database error occurs
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const chatbotId = searchParams.get('chatbotId');

    if (!chatbotId) {
      return NextResponse.json(
        { error: 'chatbotId query parameter is required' },
        { status: 400 }
      );
    }

    // Verify chatbot exists
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: { id: true },
    });

    if (!chatbot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404 }
      );
    }

    // Fetch system pills (chatbotId: NULL) and chatbot-specific pills
    const pills = await prisma.pill.findMany({
      where: {
        isActive: true,
        OR: [
          { chatbotId: null }, // System pills
          { chatbotId }, // Chatbot-specific pills
        ],
      },
      orderBy: [
        { pillType: 'asc' }, // Group by type: feedback, expansion, suggested
        { displayOrder: 'asc' }, // Then by display order
      ],
    });

    return NextResponse.json(pills);
  } catch (error) {
    console.error('Error fetching pills:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pills' },
      { status: 500 }
    );
  }
}

