// __tests__/api/chatbots/public/route.test.ts
// Phase 3.7.2: Unit tests for Public Chatbots API route
// Tests public chatbot fetching with filtering, search, and pagination

import { GET } from '@/app/api/chatbots/public/route';
import { prisma } from '@/lib/prisma';

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
    chatbot: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe('GET /api/chatbots/public', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockChatbot = {
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
  };

  describe('happy path - returns chatbots when no filters', () => {
    it('should return paginated chatbots with default pagination', async () => {
      (prisma.chatbot.findMany as jest.Mock).mockResolvedValue([mockChatbot]);
      (prisma.chatbot.count as jest.Mock).mockResolvedValue(1);

      const request = new Request('http://localhost/api/chatbots/public');
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
      });
      expect(data.pagination).toMatchObject({
        page: 1,
        pageSize: 20,
        totalPages: 1,
        totalItems: 1,
      });

      // Verify base filters applied
      expect(prisma.chatbot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { isPublic: true },
              { isActive: true },
            ]),
          }),
          skip: 0,
          take: 20,
        })
      );
    });

    it('should include all required fields', async () => {
      (prisma.chatbot.findMany as jest.Mock).mockResolvedValue([mockChatbot]);
      (prisma.chatbot.count as jest.Mock).mockResolvedValue(1);

      const request = new Request('http://localhost/api/chatbots/public');
      const response = await GET(request);
      const data = await response.json();

      const chatbot = data.chatbots[0];
      expect(chatbot).toHaveProperty('id');
      expect(chatbot).toHaveProperty('slug');
      expect(chatbot).toHaveProperty('title');
      expect(chatbot).toHaveProperty('description');
      expect(chatbot).toHaveProperty('imageUrl');
      expect(chatbot).toHaveProperty('type');
      expect(chatbot).toHaveProperty('priceCents');
      expect(chatbot).toHaveProperty('currency');
      expect(chatbot).toHaveProperty('allowAnonymous');
      expect(chatbot).toHaveProperty('createdAt');
      expect(chatbot).toHaveProperty('creator');
      expect(chatbot).toHaveProperty('rating');
      expect(chatbot).toHaveProperty('categories');
      expect(chatbot).toHaveProperty('favoriteCount');
    });
  });

  describe('pagination', () => {
    it('should handle custom page and pageSize', async () => {
      (prisma.chatbot.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.chatbot.count as jest.Mock).mockResolvedValue(50);

      const request = new Request('http://localhost/api/chatbots/public?page=2&pageSize=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination).toMatchObject({
        page: 2,
        pageSize: 10,
        totalPages: 5,
        totalItems: 50,
      });

      expect(prisma.chatbot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('should calculate totalPages correctly', async () => {
      (prisma.chatbot.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.chatbot.count as jest.Mock).mockResolvedValue(25);

      const request = new Request('http://localhost/api/chatbots/public?pageSize=10');
      const response = await GET(request);
      const data = await response.json();

      expect(data.pagination.totalPages).toBe(3); // Math.ceil(25/10) = 3
    });
  });

  describe('filters', () => {
    it('should filter by category', async () => {
      (prisma.chatbot.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.chatbot.count as jest.Mock).mockResolvedValue(0);

      const request = new Request('http://localhost/api/chatbots/public?category=cat-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.chatbot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { isPublic: true },
              { isActive: true },
              {
                categories: {
                  some: {
                    categoryId: 'cat-1',
                  },
                },
              },
            ]),
          }),
        })
      );
    });

    it('should filter by categoryType', async () => {
      (prisma.chatbot.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.chatbot.count as jest.Mock).mockResolvedValue(0);

      const request = new Request('http://localhost/api/chatbots/public?categoryType=ROLE');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.chatbot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              {
                categories: {
                  some: {
                    category: {
                      type: 'ROLE',
                    },
                  },
                },
              },
            ]),
          }),
        })
      );
    });

    it('should filter by creator', async () => {
      (prisma.chatbot.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.chatbot.count as jest.Mock).mockResolvedValue(0);

      const request = new Request('http://localhost/api/chatbots/public?creator=creator-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.chatbot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { creatorId: 'creator-1' },
            ]),
          }),
        })
      );
    });

    it('should filter by type', async () => {
      (prisma.chatbot.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.chatbot.count as jest.Mock).mockResolvedValue(0);

      const request = new Request('http://localhost/api/chatbots/public?type=DEEP_DIVE');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.chatbot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { type: 'DEEP_DIVE' },
            ]),
          }),
        })
      );
    });

    it('should search across title, description, and creator name', async () => {
      (prisma.chatbot.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.chatbot.count as jest.Mock).mockResolvedValue(0);

      const request = new Request('http://localhost/api/chatbots/public?search=war');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.chatbot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              {
                OR: [
                  { title: { contains: 'war', mode: 'insensitive' } },
                  { description: { contains: 'war', mode: 'insensitive' } },
                  { creator: { name: { contains: 'war', mode: 'insensitive' } } },
                ],
              },
            ]),
          }),
        })
      );
    });
  });

  describe('empty results', () => {
    it('should handle empty results gracefully', async () => {
      (prisma.chatbot.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.chatbot.count as jest.Mock).mockResolvedValue(0);

      const request = new Request('http://localhost/api/chatbots/public');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chatbots).toEqual([]);
      expect(data.pagination.totalItems).toBe(0);
      expect(data.pagination.totalPages).toBe(0);
    });
  });

  describe('error handling - invalid params', () => {
    it('should return 400 if page < 1', async () => {
      const request = new Request('http://localhost/api/chatbots/public?page=0');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Page must be >= 1');
    });

    it('should return 400 if pageSize < 1', async () => {
      const request = new Request('http://localhost/api/chatbots/public?pageSize=0');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Page size must be between 1 and 100');
    });

    it('should return 400 if pageSize > 100', async () => {
      const request = new Request('http://localhost/api/chatbots/public?pageSize=101');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Page size must be between 1 and 100');
    });

    it('should return 400 if invalid categoryType', async () => {
      const request = new Request('http://localhost/api/chatbots/public?categoryType=INVALID');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("categoryType must be 'ROLE', 'CHALLENGE', or 'STAGE'");
    });

    it('should return 400 if invalid type', async () => {
      const request = new Request('http://localhost/api/chatbots/public?type=INVALID');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("type must be 'BODY_OF_WORK', 'FRAMEWORK', 'DEEP_DIVE', or 'ADVISOR_BOARD'");
    });
  });

  describe('error handling - database errors', () => {
    it('should return 500 on database error', async () => {
      (prisma.chatbot.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost/api/chatbots/public');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to fetch chatbots');
    });
  });

  describe('rating conversion', () => {
    it('should convert Decimal averageRating to number', async () => {
      const chatbotWithRating = {
        ...mockChatbot,
        ratingsAggregate: {
          averageRating: new MockDecimal('3.75'),
          ratingCount: 8,
        },
      };

      (prisma.chatbot.findMany as jest.Mock).mockResolvedValue([chatbotWithRating]);
      (prisma.chatbot.count as jest.Mock).mockResolvedValue(1);

      const request = new Request('http://localhost/api/chatbots/public');
      const response = await GET(request);
      const data = await response.json();

      expect(data.chatbots[0].rating.averageRating).toBe(3.75);
      expect(typeof data.chatbots[0].rating.averageRating).toBe('number');
    });

    it('should handle null rating gracefully', async () => {
      const chatbotWithoutRating = {
        ...mockChatbot,
        ratingsAggregate: null,
      };

      (prisma.chatbot.findMany as jest.Mock).mockResolvedValue([chatbotWithoutRating]);
      (prisma.chatbot.count as jest.Mock).mockResolvedValue(1);

      const request = new Request('http://localhost/api/chatbots/public');
      const response = await GET(request);
      const data = await response.json();

      expect(data.chatbots[0].rating).toBeNull();
    });
  });
});

