// app/api/creators/route.ts
// Phase 3.7.4: Creators API Endpoint
// Returns all creators for filter dropdown

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/creators
 * 
 * Returns all creators that have at least one public chatbot.
 * No authentication required - this is a public endpoint.
 * 
 * Response Format:
 * {
 *   creators: Array<{
 *     id: string;
 *     slug: string;
 *     name: string;
 *     avatarUrl: string | null;
 *   }>;
 * }
 */
export async function GET() {
  try {
    const creators = await prisma.creator.findMany({
      where: {
        chatbots: {
          some: {
            isPublic: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        slug: true,
        name: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({ creators });
  } catch (error) {
    console.error('Error fetching creators:', error);
    return NextResponse.json(
      { error: 'Failed to fetch creators' },
      { status: 500 }
    );
  }
}

