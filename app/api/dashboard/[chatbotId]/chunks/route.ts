// app/api/dashboard/[chatbotId]/chunks/route.ts
// Phase 5, Task 2: API route for fetching chunk performance data
// Returns chunk usage list with pagination and optional chunk text fetching from Pinecone

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPineconeIndex } from '@/lib/pinecone/client';
import { env } from '@/lib/env';
import { verifyChatbotOwnership } from '@/lib/auth/chatbot-ownership';

/**
 * GET /api/dashboard/[chatbotId]/chunks
 * 
 * Fetches chunk performance data for dashboard display:
 * 1. Authenticates user (required for dashboard) - Phase 5, Task 3
 * 2. Verifies creator owns chatbot - Phase 5, Task 3
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
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { chatbotId } = await params;

    // Verify chatbot ownership (Phase 5, Task 3)
    // This handles authentication and authorization checks
    await verifyChatbotOwnership(chatbotId);

    // 3. Parse query parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const sortBy = searchParams.get('sortBy') || 'timesUsed';
    const order = searchParams.get('order') || 'desc';
    // Default to 1 to show all chunks that have been used at least once
    // This ensures early-stage data is visible before chunks accumulate 5+ uses
    const minTimesUsed = parseInt(searchParams.get('minTimesUsed') || '1', 10);
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

    // 4. Calculate pagination
    const skip = (page - 1) * pageSize;

    // 5. Fetch chunk performance records
    // Show chunks that either:
    // - Have been used >= minTimesUsed times, OR
    // - Have feedback (helpfulCount > 0 OR notHelpfulCount > 0)
    // This ensures chunks with feedback are always visible, even if they haven't been used much
    // NOTE: Removed month/year filter to show all chunks across all time periods
    // Chunk_Performance tracks data by month/year, so same chunk may appear multiple times
    // (one record per month/year combination)
    const where = {
      AND: [
        { chatbotId },
        {
          OR: [
            { timesUsed: { gte: minTimesUsed } },
            { helpfulCount: { gt: 0 } },
            { notHelpfulCount: { gt: 0 } },
          ],
        },
      ],
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
    // Phase 5, Task 5: Cache chunk text on first dashboard view
    // This populates chunkText and chunkMetadata in Chunk_Performance table
    // from Pinecone, so subsequent views can use cached data
    if (fetchText) {
      const namespace = `chatbot-${chatbotId}`;
      const index = getPineconeIndex(env.PINECONE_INDEX);
      const useNamespaces = process.env.PINECONE_USE_NAMESPACES !== 'false';
      const namespaceIndex = useNamespaces
        ? index.namespace(namespace)
        : index;

      // Find chunks that need text fetching (only those without cached chunkText)
      const chunksNeedingText = chunks.filter((chunk) => !chunk.chunkText);

      if (chunksNeedingText.length > 0) {
        // Fetch chunk texts from Pinecone
        const chunkIds = chunksNeedingText.map((chunk) => chunk.chunkId);
        
        try {
          const fetchResponse = await namespaceIndex.fetch(chunkIds);
          
          // Update chunks with text and metadata
          for (const chunk of chunksNeedingText) {
            const vector = fetchResponse.records?.[chunk.chunkId];
            
            if (vector?.metadata) {
              const metadata = vector.metadata;
              const chunkText = metadata.text as string;
              const page = metadata.page as number | undefined;
              const section = metadata.section as string | undefined;
              const sourceTitle = metadata.sourceTitle as string | undefined;

              // Phase 5, Task 5: Update database with cached text
              // This ensures chunk text is available for future dashboard views
              // without needing to fetch from Pinecone again
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
    
    // Handle authentication/authorization errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage === 'Authentication required' || errorMessage === 'User not found') {
      return NextResponse.json(
        { error: errorMessage },
        { status: 401 }
      );
    }

    if (errorMessage === 'Chatbot not found') {
      return NextResponse.json(
        { error: errorMessage },
        { status: 404 }
      );
    }

    if (errorMessage.includes('Unauthorized')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 403 }
      );
    }
    
    // Generic server error
    return NextResponse.json(
      { 
        error: 'Failed to fetch chunk performance data',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
