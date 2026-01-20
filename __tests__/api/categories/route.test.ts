// __tests__/api/categories/route.test.ts
// Phase 3.7.4: Unit tests for Categories API route
// Tests category fetching for filter chips

import { GET } from '@/app/api/categories/route';
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    category: {
      findMany: jest.fn(),
    },
  },
}));

describe('GET /api/categories', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockCategories = [
    {
      id: 'cat-1',
      type: 'ROLE',
      label: 'Founder',
      slug: 'founder',
    },
    {
      id: 'cat-2',
      type: 'ROLE',
      label: 'Product Manager',
      slug: 'product-manager',
    },
    {
      id: 'cat-3',
      type: 'CHALLENGE',
      label: 'Customer Acquisition',
      slug: 'customer-acquisition',
    },
    {
      id: 'cat-4',
      type: 'STAGE',
      label: 'Early Stage',
      slug: 'early-stage',
    },
  ];

  describe('happy path - returns all categories', () => {
    it('should return all categories sorted by type and label', async () => {
      (prisma.category.findMany as jest.Mock).mockResolvedValue(mockCategories);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.categories).toHaveLength(4);
      expect(data.categories).toEqual(mockCategories);

      // Verify Prisma was called with correct orderBy
      expect(prisma.category.findMany).toHaveBeenCalledWith({
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
    });

    it('should return empty array when no categories exist', async () => {
      (prisma.category.findMany as jest.Mock).mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.categories).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should return 500 error when database query fails', async () => {
      const error = new Error('Database connection failed');
      (prisma.category.findMany as jest.Mock).mockRejectedValue(error);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch categories');
    });
  });
});










