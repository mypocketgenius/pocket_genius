// app/api/categories/route.ts
// Phase 3.7.4: Categories API Endpoint
// Returns all categories for filter chips

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/categories
 * 
 * Returns all active categories grouped by type.
 * No authentication required - this is a public endpoint.
 * 
 * Response Format:
 * {
 *   categories: Array<{
 *     id: string;
 *     type: CategoryType;
 *     label: string;
 *     slug: string;
 *   }>;
 * }
 */
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: [
        { type: 'asc' },
        { label: 'asc' },
      ],
      select: {
        id: true,
        type: true,
        label: true,
        slug: true,
      },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}










