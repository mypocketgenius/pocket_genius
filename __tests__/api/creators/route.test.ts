// __tests__/api/creators/route.test.ts
// Phase 3.7.4: Unit tests for Creators API route
// Tests creator fetching for filter dropdown

import { GET } from '@/app/api/creators/route';
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    creator: {
      findMany: jest.fn(),
    },
  },
}));

describe('GET /api/creators', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockCreators = [
    {
      id: 'creator-1',
      slug: 'sun-tzu',
      name: 'Sun Tzu',
      avatarUrl: 'https://example.com/avatar1.jpg',
      bio: 'Ancient Chinese military strategist and philosopher.',
      _count: {
        chatbots: 5,
      },
    },
    {
      id: 'creator-2',
      slug: 'machiavelli',
      name: 'Niccolò Machiavelli',
      avatarUrl: null,
      bio: null,
      _count: {
        chatbots: 3,
      },
    },
  ];

  describe('happy path - returns creators with public chatbots', () => {
    it('should return creators sorted by name', async () => {
      (prisma.creator.findMany as jest.Mock).mockResolvedValue(mockCreators);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.creators).toHaveLength(2);
      
      // Verify transformed response includes bio and chatbotCount
      expect(data.creators[0]).toEqual({
        id: 'creator-1',
        slug: 'sun-tzu',
        name: 'Sun Tzu',
        avatarUrl: 'https://example.com/avatar1.jpg',
        bio: 'Ancient Chinese military strategist and philosopher.',
        chatbotCount: 5,
      });
      expect(data.creators[1]).toEqual({
        id: 'creator-2',
        slug: 'machiavelli',
        name: 'Niccolò Machiavelli',
        avatarUrl: null,
        bio: null,
        chatbotCount: 3,
      });

      // Verify Prisma was called with correct filters and orderBy
      expect(prisma.creator.findMany).toHaveBeenCalledWith({
        where: {
          chatbots: {
            some: {
              isPublic: true,
              isActive: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
        select: {
          id: true,
          slug: true,
          name: true,
          avatarUrl: true,
          bio: true,
          _count: {
            select: {
              chatbots: {
                where: {
                  isPublic: true,
                  isActive: true,
                },
              },
            },
          },
        },
      });
    });

    it('should return empty array when no creators have public chatbots', async () => {
      (prisma.creator.findMany as jest.Mock).mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.creators).toEqual([]);
    });

    it('should include bio and chatbotCount in response', async () => {
      (prisma.creator.findMany as jest.Mock).mockResolvedValue([mockCreators[0]]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.creators[0]).toHaveProperty('bio');
      expect(data.creators[0]).toHaveProperty('chatbotCount');
      expect(data.creators[0].chatbotCount).toBe(5);
    });

    it('should only return creators with public and active chatbots', async () => {
      (prisma.creator.findMany as jest.Mock).mockResolvedValue([mockCreators[0]]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.creators).toHaveLength(1);

      // Verify the filter includes both isPublic and isActive
      const callArgs = (prisma.creator.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.chatbots.some).toEqual({
        isPublic: true,
        isActive: true,
      });
      
      // Verify chatbotCount only counts public and active chatbots
      const countCallArgs = callArgs.select._count.select.chatbots.where;
      expect(countCallArgs).toEqual({
        isPublic: true,
        isActive: true,
      });
    });
  });

  describe('error handling', () => {
    it('should return 500 error when database query fails', async () => {
      const error = new Error('Database connection failed');
      (prisma.creator.findMany as jest.Mock).mockRejectedValue(error);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch creators');
    });
  });
});

