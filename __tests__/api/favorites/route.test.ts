// __tests__/api/favorites/route.test.ts
// Phase 3.7.6: Unit tests for Get User Favorites API route
// Tests fetching user's favorited chatbots with pagination

import { GET } from '@/app/api/favorites/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

// Mock Decimal-like object for testing
class MockDecimal {
  constructor(public value: string) {}
  toNumber() {
    return parseFloat(this.value);
  }
  toString() {
    return this.value;
  }
}

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    favorited_Chatbots: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Mock Clerk auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

describe('GET /api/favorites', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUserId = 'user-123';
  const mockClerkUserId = 'clerk-user-123';

  const mockFavorite = {
    id: 'favorite-123',
    userId: mockUserId,
    chatbotId: 'bot-123',
    createdAt: new Date('2024-01-01'),
    chatbot: {
      id: 'bot-123',
      slug: 'art-of-war',
      title: 'The Art of War',
      description: 'A classic text on strategy',
      imageUrl: null,
      type: 'DEEP_DIVE',
      priceCents: 0,
      currency: 'USD',
      allowAnonymous: true,
      createdAt: new Date('2024-01-01'),
      creator: {
        id: 'creator-1',
        slug: 'sun-tzu',
        name: 'Sun Tzu',
        avatarUrl: 'https://example.com/avatar.jpg',
      },
      ratingsAggregate: {
        averageRating: new MockDecimal('4.5'),
        ratingCount: 10,
      },
      categories: [
        {
          category: {
            id: 'cat-1',
            type: 'ROLE',
            label: 'Founder',
            slug: 'founder',
          },
        },
      ],
      _count: {
        favoritedBy: 5,
      },
    },
  };

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: null });

      const request = new Request('http://localhost/api/favorites');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should return 404 if user not found in database', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/favorites');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { clerkId: mockClerkUserId },
        select: { id: true },
      });
    });
  });

  describe('happy path', () => {
    it('should return paginated favorites with default pagination', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.favorited_Chatbots.findMany as jest.Mock).mockResolvedValue([mockFavorite]);
      (prisma.favorited_Chatbots.count as jest.Mock).mockResolvedValue(1);

      const request = new Request('http://localhost/api/favorites');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chatbots).toHaveLength(1);
      expect(data.chatbots[0]).toMatchObject({
        id: 'bot-123',
        slug: 'art-of-war',
        title: 'The Art of War',
        description: 'A classic text on strategy',
        imageUrl: null,
        type: 'DEEP_DIVE',
        priceCents: 0,
        currency: 'USD',
        allowAnonymous: true,
        creator: {
          id: 'creator-1',
          slug: 'sun-tzu',
          name: 'Sun Tzu',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
        rating: {
          averageRating: 4.5,
          ratingCount: 10,
        },
        categories: [
          {
            id: 'cat-1',
            type: 'ROLE',
            label: 'Founder',
            slug: 'founder',
          },
        ],
        favoriteCount: 5,
        isFavorite: true, // Always true for favorites
      });
      expect(data.pagination).toMatchObject({
        page: 1,
        pageSize: 20,
        totalPages: 1,
        totalItems: 1,
      });
    });

    it('should handle custom pagination parameters', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.favorited_Chatbots.findMany as jest.Mock).mockResolvedValue([mockFavorite]);
      (prisma.favorited_Chatbots.count as jest.Mock).mockResolvedValue(25);

      const request = new Request('http://localhost/api/favorites?page=2&pageSize=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination).toMatchObject({
        page: 2,
        pageSize: 10,
        totalPages: 3,
        totalItems: 25,
      });
      expect(prisma.favorited_Chatbots.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        skip: 10,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should return empty array when user has no favorites', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.favorited_Chatbots.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.favorited_Chatbots.count as jest.Mock).mockResolvedValue(0);

      const request = new Request('http://localhost/api/favorites');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chatbots).toHaveLength(0);
      expect(data.pagination).toMatchObject({
        page: 1,
        pageSize: 20,
        totalPages: 0,
        totalItems: 0,
      });
    });
  });

  describe('pagination validation', () => {
    it('should return 400 if page is less than 1', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });

      const request = new Request('http://localhost/api/favorites?page=0');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Page must be >= 1');
    });

    it('should return 400 if pageSize is less than 1', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });

      const request = new Request('http://localhost/api/favorites?pageSize=0');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Page size must be between 1 and 100');
    });

    it('should return 400 if pageSize is greater than 100', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });

      const request = new Request('http://localhost/api/favorites?pageSize=101');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Page size must be between 1 and 100');
    });
  });

  describe('error handling', () => {
    it('should return 500 on database error', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.favorited_Chatbots.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = new Request('http://localhost/api/favorites');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch favorites');
    });
  });
});

