// lib/rate-limit.ts
// Phase 3, Task 2: Rate limiting utility
// Prevents API abuse by limiting messages per user per time window

import { prisma } from './prisma';

/**
 * Rate limit configuration
 * Limits users to 10 messages per minute
 */
export const RATE_LIMIT = 10; // messages per minute
const WINDOW_MS = 60 * 1000; // 1 minute in milliseconds

/**
 * Checks if a user has exceeded the rate limit
 * 
 * @param userId - User ID to check (can be Clerk user ID or database user ID)
 * @returns true if user is within rate limit, false if exceeded
 * 
 * @example
 * ```typescript
 * const allowed = await checkRateLimit(userId);
 * if (!allowed) {
 *   return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
 * }
 * ```
 */
export async function checkRateLimit(userId: string | null): Promise<boolean> {
  // If no userId provided, allow the request (for anonymous users, consider different limits)
  // For MVP, we'll allow anonymous users but track by conversation
  if (!userId) {
    return true; // Anonymous users - could implement IP-based limiting later
  }

  try {
    // Calculate the time window (1 minute ago)
    const oneMinuteAgo = new Date(Date.now() - WINDOW_MS);

    // Count recent user messages in the last minute
    const recentMessages = await prisma.message.count({
      where: {
        conversation: {
          userId: userId,
        },
        role: 'user',
        createdAt: {
          gte: oneMinuteAgo,
        },
      },
    });

    // Return true if under limit, false if exceeded
    return recentMessages < RATE_LIMIT;
  } catch (error) {
    // On error, allow the request (fail open) but log the error
    console.error('Rate limit check failed:', error);
    return true;
  }
}

/**
 * Gets the number of messages remaining in the current rate limit window
 * Useful for returning rate limit headers to the client
 * 
 * @param userId - User ID to check
 * @returns Number of messages remaining (0 if limit exceeded)
 */
export async function getRemainingMessages(userId: string | null): Promise<number> {
  if (!userId) {
    return RATE_LIMIT; // Anonymous users get full limit
  }

  try {
    const oneMinuteAgo = new Date(Date.now() - WINDOW_MS);
    const recentMessages = await prisma.message.count({
      where: {
        conversation: {
          userId: userId,
        },
        role: 'user',
        createdAt: {
          gte: oneMinuteAgo,
        },
      },
    });

    return Math.max(0, RATE_LIMIT - recentMessages);
  } catch (error) {
    console.error('Get remaining messages failed:', error);
    return RATE_LIMIT; // Fail open
  }
}
