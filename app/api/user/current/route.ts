// app/api/user/current/route.ts
// Get current authenticated user's database ID
// Used by client components to get database user ID from Clerk authentication

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/user/current
 * 
 * Returns the current authenticated user's database ID.
 * Requires authentication.
 * 
 * Response Format:
 * {
 *   userId: string;  // Database user ID (not Clerk ID)
 * }
 */
export async function GET() {
  try {
    // 1. Authenticate user
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Get database user
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

    return NextResponse.json({ userId: user.id });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch current user' },
      { status: 500 }
    );
  }
}









