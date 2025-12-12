// __tests__/lib/rate-limit.test.ts
// Unit tests for rate limiting utility

import { checkRateLimit, getRemainingMessages, RATE_LIMIT } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    message: {
      count: jest.fn(),
    },
  },
}));

describe('Rate Limiting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow request when under rate limit', async () => {
      (prisma.message.count as jest.Mock).mockResolvedValue(5); // 5 messages, limit is 10

      const allowed = await checkRateLimit('user-123');
      expect(allowed).toBe(true);
      expect(prisma.message.count).toHaveBeenCalledWith({
        where: {
          conversation: { userId: 'user-123' },
          role: 'user',
          createdAt: expect.any(Object),
        },
      });
    });

    it('should block request when at rate limit', async () => {
      (prisma.message.count as jest.Mock).mockResolvedValue(10); // At limit

      const allowed = await checkRateLimit('user-123');
      expect(allowed).toBe(false);
    });

    it('should block request when over rate limit', async () => {
      (prisma.message.count as jest.Mock).mockResolvedValue(15); // Over limit

      const allowed = await checkRateLimit('user-123');
      expect(allowed).toBe(false);
    });

    it('should allow anonymous users (null userId)', async () => {
      const allowed = await checkRateLimit(null);
      expect(allowed).toBe(true);
      expect(prisma.message.count).not.toHaveBeenCalled();
    });

    it('should fail open on database error', async () => {
      (prisma.message.count as jest.Mock).mockRejectedValue(new Error('DB error'));

      const allowed = await checkRateLimit('user-123');
      expect(allowed).toBe(true); // Fail open
    });
  });

  describe('getRemainingMessages', () => {
    it('should return correct remaining messages', async () => {
      (prisma.message.count as jest.Mock).mockResolvedValue(3); // 3 messages sent

      const remaining = await getRemainingMessages('user-123');
      expect(remaining).toBe(RATE_LIMIT - 3); // 10 - 3 = 7
    });

    it('should return full limit for anonymous users', async () => {
      const remaining = await getRemainingMessages(null);
      expect(remaining).toBe(RATE_LIMIT);
    });

    it('should return 0 when limit exceeded', async () => {
      (prisma.message.count as jest.Mock).mockResolvedValue(15); // Over limit

      const remaining = await getRemainingMessages('user-123');
      expect(remaining).toBe(0); // Clamped to 0
    });

    it('should fail open on database error', async () => {
      (prisma.message.count as jest.Mock).mockRejectedValue(new Error('DB error'));

      const remaining = await getRemainingMessages('user-123');
      expect(remaining).toBe(RATE_LIMIT); // Fail open
    });
  });
});
