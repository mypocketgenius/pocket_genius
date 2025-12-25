// app/api/creators/[creatorSlug]/route.ts
// Phase 3.7.5: Creator Detail API Endpoint
// Returns creator information by slug

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/creators/[creatorSlug]
 * 
 * Returns creator information by slug.
 * No authentication required - this is a public endpoint.
 * 
 * Response Format:
 * {
 *   creator: {
 *     id: string;
 *     slug: string;
 *     name: string;
 *     avatarUrl: string | null;
 *     bio: string | null;
 *     socialLinks: {
 *       website?: string;
 *       linkedin?: string;
 *       x?: string;
 *       facebook?: string;
 *       tiktok?: string;
 *       masterclass?: string;
 *       youtube?: string;
 *     } | null;
 *   };
 * }
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/creators/john-doe');
 * const data = await response.json();
 * ```
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ creatorSlug: string }> }
) {
  try {
    const { creatorSlug } = await params;

    if (!creatorSlug) {
      return NextResponse.json(
        { error: 'Creator slug is required' },
        { status: 400 }
      );
    }

    const creator = await prisma.creator.findUnique({
      where: {
        slug: creatorSlug,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        avatarUrl: true,
        bio: true,
        socialLinks: true,
      },
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 404 }
      );
    }

    // Parse socialLinks JSON if it exists
    let socialLinks = null;
    if (creator.socialLinks) {
      try {
        socialLinks = typeof creator.socialLinks === 'string'
          ? JSON.parse(creator.socialLinks)
          : creator.socialLinks;
      } catch (error) {
        console.error('Error parsing socialLinks:', error);
        socialLinks = null;
      }
    }

    return NextResponse.json({
      creator: {
        ...creator,
        socialLinks,
      },
    });
  } catch (error) {
    console.error('Error fetching creator:', error);
    return NextResponse.json(
      { error: 'Failed to fetch creator' },
      { status: 500 }
    );
  }
}

