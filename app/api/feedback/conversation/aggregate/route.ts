// app/api/feedback/conversation/aggregate/route.ts
// Phase 2: Conversation feedback aggregate API route
// Returns aggregate rating for chatbot

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/feedback/conversation/aggregate?chatbotId=xxx
 * 
 * Returns aggregate rating for chatbot from Chatbot_Ratings_Aggregate table
 * 
 * Response:
 * {
 *   "averageRating": 4.5,
 *   "ratingCount": 100,
 *   "ratingDistribution": {
 *     "1": 5,
 *     "2": 10,
 *     "3": 25,
 *     "4": 40,
 *     "5": 20
 *   }
 * }
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

    // Get aggregate ratings
    const aggregate = await prisma.chatbot_Ratings_Aggregate.findUnique({
      where: { chatbotId },
    });

    if (!aggregate) {
      // Return default values if no ratings yet
      return NextResponse.json({
        averageRating: 0,
        ratingCount: 0,
        ratingDistribution: {
          '1': 0,
          '2': 0,
          '3': 0,
          '4': 0,
          '5': 0,
        },
      });
    }

    return NextResponse.json({
      averageRating: aggregate.averageRating.toNumber(),
      ratingCount: aggregate.ratingCount,
      ratingDistribution: aggregate.ratingDistribution as Record<string, number>,
    });
  } catch (error) {
    console.error('Error fetching conversation feedback aggregate:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation feedback aggregate' },
      { status: 500 }
    );
  }
}

