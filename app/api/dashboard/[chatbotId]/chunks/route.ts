// app/api/dashboard/[chatbotId]/chunks/route.ts
// Phase 5, Task 2: API route for fetching chunk performance data
// Returns chunk usage list with pagination and optional chunk text fetching from Pinecone

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPineconeIndex } from '@/lib/pinecone/client';
import { env } from '@/lib/env';

/**
 * GET /api/dashboard/[chatbotId]/chunks
 * 
 * Fetches chunk performance data for dashboard display:
 * 1. Authenticates user (required for dashboard)
 * 2. Verifies creator owns chatbot
 * 3. Fetches chunk performance records with pagination
 * 4. Optionally fetches chunk text from Pinecone if not cached
 * 
 * Query parameters:
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 20)
 * - sortBy: 'timesUsed' | 'satisfactionRate' (default: 'timesUsed')
 * - order: 'asc' | 'desc' (default: 'desc')
 * - minTimesUsed: Minimum times used filter (default: 5)
 * - fetchText: Whether to fetch missing chunk text from Pinecone (default: false)
 * 
 * Response: { chunks, total, page, pageSize, totalPages }
 */
export async function GET(
  req: Request,
  { params }: { params: { chatbotId: string } }
) {
  try {
    // 1. Authenticate user (required for dashboard)
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get database user ID
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const { chatbotId } = params;

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
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404 }
      );
    }

    // Check if user is a member of the creator
    if (!chatbot.creator.users || chatbot.creator.users.length === 0) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have access to this chatbot' },
        { status: 403 }
      );
    }

    // 3. Parse query parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const sortBy = searchParams.get('sortBy') || 'timesUsed';
    const order = searchParams.get('order') || 'desc';
    const minTimesUsed = parseInt(searchParams.get('minTimesUsed') || '5', 10);
    const fetchText = searchParams.get('fetchText') === 'true';

    // Validate parameters
    if (page < 1) {
      return NextResponse.json(
        { error: 'Page must be >= 1' },
        { status: 400 }
      );
    }

    if (pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { error: 'Page size must be between 1 and 100' },
        { status: 400 }
      );
    }

    if (!['timesUsed', 'satisfactionRate'].includes(sortBy)) {
      return NextResponse.json(
        { error: "sortBy must be 'timesUsed' or 'satisfactionRate'" },
        { status: 400 }
      );
    }

    if (!['asc', 'desc'].includes(order)) {
      return NextResponse.json(
        { error: "order must be 'asc' or 'desc'" },
        { status: 400 }
      );
    }

    // 4. Get current month and year for filtering
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // 5. Calculate pagination
    const skip = (page - 1) * pageSize;

    // 6. Fetch chunk performance records
    const where = {
      chatbotId,
      month,
      year,
      timesUsed: { gte: minTimesUsed },
    };

    const [chunks, total] = await Promise.all([
      prisma.chunk_Performance.findMany({
        where,
        orderBy: {
          [sortBy]: order,
        },
        skip,
        take: pageSize,
        include: {
          source: {
            select: {
              title: true,
            },
          },
        },
      }),
      prisma.chunk_Performance.count({ where }),
    ]);

    // 7. Fetch chunk text from Pinecone if requested and missing
    if (fetchText) {
      const namespace = `chatbot-${chatbotId}`;
      const index = getPineconeIndex(env.PINECONE_INDEX);
      const useNamespaces = process.env.PINECONE_USE_NAMESPACES !== 'false';
      const namespaceIndex = useNamespaces 
        ? index.namespace(namespace)
        : index;

      // Find chunks that need text fetching
      const chunksNeedingText = chunks.filter((chunk) => !chunk.chunkText);

      if (chunksNeedingText.length > 0) {
        // Fetch chunk texts from Pinecone
        const chunkIds = chunksNeedingText.map((chunk) => chunk.chunkId);
        
        try {
          const fetchResponse = await namespaceIndex.fetch(chunkIds);
          
          // Update chunks with text and metadata
          for (const chunk of chunksNeedingText) {
            const vector = fetchResponse.vectors?.[chunk.chunkId];
            
            if (vector?.metadata) {
              const metadata = vector.metadata;
              const chunkText = metadata.text as string;
              const page = metadata.page as number | undefined;
              const section = metadata.section as string | undefined;
              const sourceTitle = metadata.sourceTitle as string | undefined;

              // Update database with cached text
              await prisma.chunk_Performance.update({
                where: { id: chunk.id },
                data: {
                  chunkText,
                  chunkMetadata: {
                    page,
                    section,
                    sourceTitle: sourceTitle || chunk.source.title,
                  },
                },
              });

              // Update in-memory chunk object for response
              chunk.chunkText = chunkText;
              chunk.chunkMetadata = {
                page,
                section,
                sourceTitle: sourceTitle || chunk.source.title,
              };
            }
          }
        } catch (error) {
          console.error('Error fetching chunk text from Pinecone:', error);
          // Continue without failing - chunks without text will show "Text unavailable"
        }
      }
    }

    // 8. Format response
    const totalPages = Math.ceil(total / pageSize);

    return NextResponse.json({
      chunks: chunks.map((chunk) => ({
        id: chunk.id,
        chunkId: chunk.chunkId,
        sourceId: chunk.sourceId,
        sourceTitle: chunk.source.title,
        timesUsed: chunk.timesUsed,
        helpfulCount: chunk.helpfulCount,
        notHelpfulCount: chunk.notHelpfulCount,
        satisfactionRate: chunk.satisfactionRate,
        chunkText: chunk.chunkText,
        chunkMetadata: chunk.chunkMetadata,
        createdAt: chunk.createdAt,
        updatedAt: chunk.updatedAt,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Dashboard chunks API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch chunk performance data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
