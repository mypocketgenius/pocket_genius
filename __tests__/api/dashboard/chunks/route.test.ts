// __tests__/api/dashboard/chunks/route.test.ts
// Phase 5: Tests for dashboard chunks API route
// Tests authentication, pagination, sorting, and chunk text caching

import { GET } from '@/app/api/dashboard/[chatbotId]/chunks/route';
import { prisma } from '@/lib/prisma';
import { getPineconeIndex } from '@/lib/pinecone/client';
import { verifyChatbotOwnership } from '@/lib/auth/chatbot-ownership';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    chunk_Performance: {
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/pinecone/client', () => ({
  getPineconeIndex: jest.fn(),
}));

jest.mock('@/lib/auth/chatbot-ownership', () => ({
  verifyChatbotOwnership: jest.fn(),
}));

jest.mock('@/lib/env', () => ({
  env: {
    PINECONE_INDEX: 'test-index',
  },
}));

describe('GET /api/dashboard/[chatbotId]/chunks', () => {
  const mockChatbotId = 'chatbot_test_123';
  const mockUserId = 'user_test_123';
  const mockCreatorId = 'creator_test_123';
  const mockSourceId = 'source_test_123';

  // Mock date to ensure consistent month/year filtering
  const mockDate = new Date('2024-12-15T10:00:00Z');
  const mockMonth = 12;
  const mockYear = 2024;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
    
    // Default mock for verifyChatbotOwnership
    (verifyChatbotOwnership as jest.Mock).mockResolvedValue({
      userId: mockUserId,
      chatbotId: mockChatbotId,
      chatbot: {
        id: mockChatbotId,
        title: 'Test Chatbot',
        creatorId: mockCreatorId,
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 when user is not authenticated', async () => {
      (verifyChatbotOwnership as jest.Mock).mockRejectedValue(
        new Error('Authentication required')
      );

      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
      expect(verifyChatbotOwnership).toHaveBeenCalledWith(mockChatbotId);
    });

    it('should return 404 when chatbot is not found', async () => {
      (verifyChatbotOwnership as jest.Mock).mockRejectedValue(
        new Error('Chatbot not found')
      );

      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Chatbot not found');
    });

    it('should return 403 when user is unauthorized', async () => {
      (verifyChatbotOwnership as jest.Mock).mockRejectedValue(
        new Error('Unauthorized: You do not have access to this chatbot')
      );

      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Unauthorized');
    });

    it('should verify chatbot ownership before processing', async () => {
      (prisma.chunk_Performance.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.chunk_Performance.count as jest.Mock).mockResolvedValue(0);

      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      await GET(request, { params });

      expect(verifyChatbotOwnership).toHaveBeenCalledWith(mockChatbotId);
    });
  });

  describe('Query Parameter Validation', () => {
    beforeEach(() => {
      (prisma.chunk_Performance.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.chunk_Performance.count as jest.Mock).mockResolvedValue(0);
    });

    it('should return 400 for invalid page number (< 1)', async () => {
      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks?page=0`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Page must be >= 1');
    });

    it('should return 400 for invalid pageSize (< 1)', async () => {
      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks?pageSize=0`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Page size must be between 1 and 100');
    });

    it('should return 400 for invalid pageSize (> 100)', async () => {
      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks?pageSize=101`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Page size must be between 1 and 100');
    });

    it('should return 400 for invalid sortBy', async () => {
      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks?sortBy=invalid`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("sortBy must be 'timesUsed' or 'satisfactionRate'");
    });

    it('should return 400 for invalid order', async () => {
      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks?order=invalid`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("order must be 'asc' or 'desc'");
    });

    it('should use default values when parameters are not provided', async () => {
      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      await GET(request, { params });

      expect(prisma.chunk_Performance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { timesUsed: 'desc' },
          skip: 0,
          take: 20,
        })
      );
    });
  });

  describe('Pagination', () => {
    beforeEach(() => {
      (prisma.chunk_Performance.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.chunk_Performance.count as jest.Mock).mockResolvedValue(50);
    });

    it('should calculate correct skip and take for page 1', async () => {
      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks?page=1&pageSize=20`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      await GET(request, { params });

      expect(prisma.chunk_Performance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        })
      );
    });

    it('should calculate correct skip and take for page 2', async () => {
      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks?page=2&pageSize=20`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      await GET(request, { params });

      expect(prisma.chunk_Performance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
        })
      );
    });

    it('should calculate correct totalPages', async () => {
      (prisma.chunk_Performance.count as jest.Mock).mockResolvedValue(50);

      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks?pageSize=20`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(data.pagination.totalPages).toBe(3); // Math.ceil(50 / 20)
      expect(data.pagination.total).toBe(50);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.pageSize).toBe(20);
    });
  });

  describe('Sorting', () => {
    beforeEach(() => {
      (prisma.chunk_Performance.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.chunk_Performance.count as jest.Mock).mockResolvedValue(0);
    });

    it('should sort by timesUsed descending by default', async () => {
      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      await GET(request, { params });

      expect(prisma.chunk_Performance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { timesUsed: 'desc' },
        })
      );
    });

    it('should sort by timesUsed ascending when specified', async () => {
      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks?sortBy=timesUsed&order=asc`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      await GET(request, { params });

      expect(prisma.chunk_Performance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { timesUsed: 'asc' },
        })
      );
    });

    it('should sort by satisfactionRate descending when specified', async () => {
      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks?sortBy=satisfactionRate&order=desc`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      await GET(request, { params });

      expect(prisma.chunk_Performance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { satisfactionRate: 'desc' },
        })
      );
    });

    it('should sort by satisfactionRate ascending when specified', async () => {
      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks?sortBy=satisfactionRate&order=asc`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      await GET(request, { params });

      expect(prisma.chunk_Performance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { satisfactionRate: 'asc' },
        })
      );
    });
  });

  describe('Filtering', () => {
    beforeEach(() => {
      (prisma.chunk_Performance.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.chunk_Performance.count as jest.Mock).mockResolvedValue(0);
    });

    it('should filter by chatbotId, month, and year', async () => {
      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      await GET(request, { params });

      expect(prisma.chunk_Performance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { chatbotId: mockChatbotId },
              { month: mockMonth },
              { year: mockYear },
            ]),
          }),
        })
      );
    });

    it('should filter by minTimesUsed when provided', async () => {
      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks?minTimesUsed=10`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      await GET(request, { params });

      expect(prisma.chunk_Performance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  { timesUsed: { gte: 10 } },
                ]),
              }),
            ]),
          }),
        })
      );
    });

    it('should include chunks with feedback even if timesUsed < minTimesUsed', async () => {
      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks?minTimesUsed=10`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      await GET(request, { params });

      expect(prisma.chunk_Performance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  { timesUsed: { gte: 10 } },
                  { helpfulCount: { gt: 0 } },
                  { notHelpfulCount: { gt: 0 } },
                ]),
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('Chunk Text Caching (Phase 5, Task 5)', () => {
    const mockChunkWithoutText = {
      id: 'chunk_perf_1',
      chunkId: 'chunk_123',
      sourceId: mockSourceId,
      timesUsed: 10,
      helpfulCount: 5,
      notHelpfulCount: 2,
      satisfactionRate: 0.714,
      chunkText: null,
      chunkMetadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      source: {
        title: 'Test Source',
      },
    };

    const mockChunkWithText = {
      ...mockChunkWithoutText,
      chunkText: 'Cached chunk text',
      chunkMetadata: { page: 1, section: 'Introduction' },
    };

    const mockPineconeVector = {
      id: 'chunk_123',
      metadata: {
        text: 'Fetched chunk text from Pinecone',
        page: 2,
        section: 'Chapter 1',
        sourceTitle: 'Test Source',
      },
    };

    beforeEach(() => {
      const mockIndex = {
        namespace: jest.fn().mockReturnThis(),
        fetch: jest.fn(),
      };
      (getPineconeIndex as jest.Mock).mockReturnValue(mockIndex);
      (prisma.chunk_Performance.count as jest.Mock).mockResolvedValue(1);
    });

    it('should not fetch chunk text when fetchText is false', async () => {
      (prisma.chunk_Performance.findMany as jest.Mock).mockResolvedValue([
        mockChunkWithoutText,
      ]);

      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks?fetchText=false`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      await GET(request, { params });

      expect(getPineconeIndex).not.toHaveBeenCalled();
      expect(prisma.chunk_Performance.update).not.toHaveBeenCalled();
    });

    it('should fetch chunk text from Pinecone when fetchText is true and chunkText is missing', async () => {
      (prisma.chunk_Performance.findMany as jest.Mock).mockResolvedValue([
        mockChunkWithoutText,
      ]);

      const mockIndex = {
        namespace: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue({
          records: {
            chunk_123: mockPineconeVector,
          },
        }),
      };
      (getPineconeIndex as jest.Mock).mockReturnValue(mockIndex);

      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks?fetchText=true`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      await GET(request, { params });

      expect(getPineconeIndex).toHaveBeenCalledWith('test-index');
      expect(mockIndex.namespace).toHaveBeenCalledWith(`chatbot-${mockChatbotId}`);
      expect(mockIndex.fetch).toHaveBeenCalledWith(['chunk_123']);
      expect(prisma.chunk_Performance.update).toHaveBeenCalledWith({
        where: { id: 'chunk_perf_1' },
        data: {
          chunkText: 'Fetched chunk text from Pinecone',
          chunkMetadata: {
            page: 2,
            section: 'Chapter 1',
            sourceTitle: 'Test Source',
          },
        },
      });
    });

    it('should not fetch chunk text when chunkText is already cached', async () => {
      (prisma.chunk_Performance.findMany as jest.Mock).mockResolvedValue([
        mockChunkWithText,
      ]);

      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks?fetchText=true`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      await GET(request, { params });

      expect(getPineconeIndex).not.toHaveBeenCalled();
      expect(prisma.chunk_Performance.update).not.toHaveBeenCalled();
    });

    it('should handle Pinecone fetch errors gracefully', async () => {
      (prisma.chunk_Performance.findMany as jest.Mock).mockResolvedValue([
        mockChunkWithoutText,
      ]);

      const mockIndex = {
        namespace: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockRejectedValue(new Error('Pinecone error')),
      };
      (getPineconeIndex as jest.Mock).mockReturnValue(mockIndex);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks?fetchText=true`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      const response = await GET(request, { params });
      const data = await response.json();

      // Should still return response even if Pinecone fetch fails
      expect(response.status).toBe(200);
      expect(data.chunks).toHaveLength(1);
      expect(data.chunks[0].chunkText).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching chunk text from Pinecone:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should update multiple chunks when multiple chunks need text', async () => {
      const mockChunk2 = {
        ...mockChunkWithoutText,
        id: 'chunk_perf_2',
        chunkId: 'chunk_456',
      };

      (prisma.chunk_Performance.findMany as jest.Mock).mockResolvedValue([
        mockChunkWithoutText,
        mockChunk2,
      ]);

      const mockIndex = {
        namespace: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue({
          records: {
            chunk_123: mockPineconeVector,
            chunk_456: {
              ...mockPineconeVector,
              id: 'chunk_456',
              metadata: {
                ...mockPineconeVector.metadata,
                text: 'Second chunk text',
              },
            },
          },
        }),
      };
      (getPineconeIndex as jest.Mock).mockReturnValue(mockIndex);

      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks?fetchText=true`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      await GET(request, { params });

      expect(prisma.chunk_Performance.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('Response Format', () => {
    const mockChunk = {
      id: 'chunk_perf_1',
      chunkId: 'chunk_123',
      sourceId: mockSourceId,
      timesUsed: 10,
      helpfulCount: 5,
      notHelpfulCount: 2,
      satisfactionRate: 0.714,
      chunkText: 'Test chunk text',
      chunkMetadata: { page: 1, section: 'Introduction' },
      createdAt: new Date('2024-12-01'),
      updatedAt: new Date('2024-12-15'),
      source: {
        title: 'Test Source',
      },
    };

    beforeEach(() => {
      (prisma.chunk_Performance.findMany as jest.Mock).mockResolvedValue([mockChunk]);
      (prisma.chunk_Performance.count as jest.Mock).mockResolvedValue(1);
    });

    it('should return correctly formatted response', async () => {
      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('chunks');
      expect(data).toHaveProperty('pagination');
      expect(data.chunks).toHaveLength(1);
      expect(data.chunks[0]).toEqual({
        id: 'chunk_perf_1',
        chunkId: 'chunk_123',
        sourceId: mockSourceId,
        sourceTitle: 'Test Source',
        timesUsed: 10,
        helpfulCount: 5,
        notHelpfulCount: 2,
        satisfactionRate: 0.714,
        chunkText: 'Test chunk text',
        chunkMetadata: { page: 1, section: 'Introduction' },
        createdAt: mockChunk.createdAt.toISOString(),
        updatedAt: mockChunk.updatedAt.toISOString(),
      });
      expect(data.pagination).toEqual({
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 500 for unexpected errors', async () => {
      (verifyChatbotOwnership as jest.Mock).mockResolvedValue({
        userId: mockUserId,
        chatbotId: mockChatbotId,
        chatbot: {
          id: mockChatbotId,
          title: 'Test Chatbot',
          creatorId: mockCreatorId,
        },
      });
      (prisma.chunk_Performance.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = new Request(
        `http://localhost/api/dashboard/${mockChatbotId}/chunks`
      );
      const params = Promise.resolve({ chatbotId: mockChatbotId });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch chunk performance data');
      expect(data.details).toBe('Database error');
    });
  });
});
