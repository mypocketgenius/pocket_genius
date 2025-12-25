// __tests__/api/creators/[creatorSlug]/route.test.ts
// Phase 3.7.5: Unit tests for Creator Detail API route
// Tests creator fetching by slug

import { GET } from '@/app/api/creators/[creatorSlug]/route';
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    creator: {
      findUnique: jest.fn(),
    },
  },
}));

describe('GET /api/creators/[creatorSlug]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockCreator = {
    id: 'creator-1',
    slug: 'sun-tzu',
    name: 'Sun Tzu',
    avatarUrl: 'https://example.com/avatar1.jpg',
    bio: 'Ancient Chinese military strategist',
    socialLinks: {
      website: 'https://example.com',
      linkedin: 'https://linkedin.com/in/suntzu',
      x: 'https://x.com/suntzu',
    },
  };

  describe('happy path - returns creator by slug', () => {
    it('should return creator with parsed socialLinks JSON', async () => {
      (prisma.creator.findUnique as jest.Mock).mockResolvedValue({
        ...mockCreator,
        socialLinks: JSON.stringify(mockCreator.socialLinks),
      });

      const params = Promise.resolve({ creatorSlug: 'sun-tzu' });
      const response = await GET(new Request('http://localhost/api/creators/sun-tzu'), { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.creator).toEqual(mockCreator);
      expect(data.creator.socialLinks).toEqual(mockCreator.socialLinks);

      // Verify Prisma was called with correct slug
      expect(prisma.creator.findUnique).toHaveBeenCalledWith({
        where: {
          slug: 'sun-tzu',
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
    });

    it('should return creator with null socialLinks when not provided', async () => {
      const creatorWithoutSocial = {
        ...mockCreator,
        socialLinks: null,
      };
      (prisma.creator.findUnique as jest.Mock).mockResolvedValue(creatorWithoutSocial);

      const params = Promise.resolve({ creatorSlug: 'sun-tzu' });
      const response = await GET(new Request('http://localhost/api/creators/sun-tzu'), { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.creator.socialLinks).toBeNull();
    });

    it('should handle socialLinks that are already objects (not JSON strings)', async () => {
      (prisma.creator.findUnique as jest.Mock).mockResolvedValue(mockCreator);

      const params = Promise.resolve({ creatorSlug: 'sun-tzu' });
      const response = await GET(new Request('http://localhost/api/creators/sun-tzu'), { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.creator.socialLinks).toEqual(mockCreator.socialLinks);
    });

    it('should handle invalid JSON in socialLinks gracefully', async () => {
      (prisma.creator.findUnique as jest.Mock).mockResolvedValue({
        ...mockCreator,
        socialLinks: '{ invalid json }',
      });

      const params = Promise.resolve({ creatorSlug: 'sun-tzu' });
      const response = await GET(new Request('http://localhost/api/creators/sun-tzu'), { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.creator.socialLinks).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should return 400 error when creatorSlug is missing', async () => {
      const params = Promise.resolve({ creatorSlug: '' });
      const response = await GET(new Request('http://localhost/api/creators/'), { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Creator slug is required');
    });

    it('should return 404 error when creator not found', async () => {
      (prisma.creator.findUnique as jest.Mock).mockResolvedValue(null);

      const params = Promise.resolve({ creatorSlug: 'non-existent' });
      const response = await GET(new Request('http://localhost/api/creators/non-existent'), { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Creator not found');
    });

    it('should return 500 error when database query fails', async () => {
      const error = new Error('Database connection failed');
      (prisma.creator.findUnique as jest.Mock).mockRejectedValue(error);

      const params = Promise.resolve({ creatorSlug: 'sun-tzu' });
      const response = await GET(new Request('http://localhost/api/creators/sun-tzu'), { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch creator');
    });
  });
});

