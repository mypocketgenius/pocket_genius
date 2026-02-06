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
 * Checks rate limit and returns both allowed status and remaining count
 * in a single DB query (previously two separate functions ran the same query).
 *
 * @param userId - Database user ID to check
 * @returns { allowed, remaining, limit }
 */
export async function checkRateLimit(userId: string | null): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
}> {
  if (!userId) {
    return { allowed: true, remaining: RATE_LIMIT, limit: RATE_LIMIT };
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

    return {
      allowed: recentMessages < RATE_LIMIT,
      remaining: Math.max(0, RATE_LIMIT - recentMessages),
      limit: RATE_LIMIT,
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return { allowed: true, remaining: RATE_LIMIT, limit: RATE_LIMIT };
  }
}
