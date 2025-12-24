// __tests__/api/chatbots/[chatbotId]/reviews/route.test.ts
// Phase 3.7.3: Unit tests for Chatbot Reviews API route
// Tests fetching reviews (Conversation_Feedback) for a specific chatbot

import { GET } from '@/app/api/chatbots/[chatbotId]/reviews/route';
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    chatbot: {
      findUnique: jest.fn(),
    },
    conversation_Feedback: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe('GET /api/chatbots/[chatbotId]/reviews', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const chatbotId = 'bot-123';
  const mockChatbot = {
    id: chatbotId,
  };

  const mockReview = {
    id: 'review-1',
    userId: 'user-1',
    rating: 5,
    userGoal: 'I wanted to learn about strategy',
    stillNeed: null,
    timeSaved: '30 minutes',
    createdAt: new Date('2024-01-01'),
    user: {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      username: null,
    },
  };

  const mockAnonymousReview = {
    id: 'review-2',
    userId: null,
    rating: 4,
    userGoal: null,
    stillNeed: 'More examples would help',
    timeSaved: '1 hour',
    createdAt: new Date('2024-01-02'),
    user: null,
  };

  describe('happy path - returns reviews', () => {
    it('should return paginated reviews with default pagination', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.conversation_Feedback.findMany as jest.Mock).mockResolvedValue([
        mockReview,
      ]);
      (prisma.conversation_Feedback.count as jest.Mock).mockResolvedValue(1);

      const params = Promise.resolve({ chatbotId });
      const request = new Request(
        `http://localhost/api/chatbots/${chatbotId}/reviews`
      );
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.reviews).toHaveLength(1);
      expect(data.reviews[0]).toMatchObject({
        id: 'review-1',
        userId: 'user-1',
        userName: 'John Doe',
        rating: 5,
        comment: 'I wanted to learn about strategy',
        timeSaved: '30 minutes',
      });
      expect(data.pagination).toMatchObject({
        page: 1,
        pageSize: 5,
        totalPages: 1,
        totalItems: 1,
      });
    });

    it('should include all required fields', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.conversation_Feedback.findMany as jest.Mock).mockResolvedValue([
        mockReview,
      ]);
      (prisma.conversation_Feedback.count as jest.Mock).mockResolvedValue(1);

      const params = Promise.resolve({ chatbotId });
      const request = new Request(
        `http://localhost/api/chatbots/${chatbotId}/reviews`
      );
      const response = await GET(request, { params });
      const data = await response.json();

      const review = data.reviews[0];
      expect(review).toHaveProperty('id');
      expect(review).toHaveProperty('userId');
      expect(review).toHaveProperty('userName');
      expect(review).toHaveProperty('rating');
      expect(review).toHaveProperty('comment');
      expect(review).toHaveProperty('timeSaved');
      expect(review).toHaveProperty('createdAt');
    });

    it('should show "Anonymous" for reviews without userId', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.conversation_Feedback.findMany as jest.Mock).mockResolvedValue([
        mockAnonymousReview,
      ]);
      (prisma.conversation_Feedback.count as jest.Mock).mockResolvedValue(1);

      const params = Promise.resolve({ chatbotId });
      const request = new Request(
        `http://localhost/api/chatbots/${chatbotId}/reviews`
      );
      const response = await GET(request, { params });
      const data = await response.json();

      expect(data.reviews[0].userId).toBeNull();
      expect(data.reviews[0].userName).toBeNull(); // Will be displayed as "Anonymous" in UI
    });

    it('should use username if firstName/lastName not available', async () => {
      const reviewWithUsername = {
        ...mockReview,
        user: {
          id: 'user-1',
          firstName: null,
          lastName: null,
          username: 'johndoe',
        },
      };

      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.conversation_Feedback.findMany as jest.Mock).mockResolvedValue([
        reviewWithUsername,
      ]);
      (prisma.conversation_Feedback.count as jest.Mock).mockResolvedValue(1);

      const params = Promise.resolve({ chatbotId });
      const request = new Request(
        `http://localhost/api/chatbots/${chatbotId}/reviews`
      );
      const response = await GET(request, { params });
      const data = await response.json();

      expect(data.reviews[0].userName).toBe('johndoe');
    });

    it('should prefer userGoal over stillNeed for comment', async () => {
      const reviewWithBoth = {
        ...mockReview,
        userGoal: 'Primary goal',
        stillNeed: 'Secondary need',
      };

      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.conversation_Feedback.findMany as jest.Mock).mockResolvedValue([
        reviewWithBoth,
      ]);
      (prisma.conversation_Feedback.count as jest.Mock).mockResolvedValue(1);

      const params = Promise.resolve({ chatbotId });
      const request = new Request(
        `http://localhost/api/chatbots/${chatbotId}/reviews`
      );
      const response = await GET(request, { params });
      const data = await response.json();

      expect(data.reviews[0].comment).toBe('Primary goal');
    });

    it('should use stillNeed if userGoal is null', async () => {
      const reviewWithStillNeed = {
        ...mockReview,
        userGoal: null,
        stillNeed: 'What is still missing',
      };

      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.conversation_Feedback.findMany as jest.Mock).mockResolvedValue([
        reviewWithStillNeed,
      ]);
      (prisma.conversation_Feedback.count as jest.Mock).mockResolvedValue(1);

      const params = Promise.resolve({ chatbotId });
      const request = new Request(
        `http://localhost/api/chatbots/${chatbotId}/reviews`
      );
      const response = await GET(request, { params });
      const data = await response.json();

      expect(data.reviews[0].comment).toBe('What is still missing');
    });
  });

  describe('pagination', () => {
    it('should handle custom page and pageSize', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.conversation_Feedback.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.conversation_Feedback.count as jest.Mock).mockResolvedValue(50);

      const params = Promise.resolve({ chatbotId });
      const request = new Request(
        `http://localhost/api/chatbots/${chatbotId}/reviews?page=2&pageSize=10`
      );
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination).toMatchObject({
        page: 2,
        pageSize: 10,
        totalPages: 5,
        totalItems: 50,
      });

      expect(prisma.conversation_Feedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('should calculate totalPages correctly', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.conversation_Feedback.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.conversation_Feedback.count as jest.Mock).mockResolvedValue(25);

      const params = Promise.resolve({ chatbotId });
      const request = new Request(
        `http://localhost/api/chatbots/${chatbotId}/reviews?pageSize=10`
      );
      const response = await GET(request, { params });
      const data = await response.json();

      expect(data.pagination.totalPages).toBe(3); // Math.ceil(25/10) = 3
    });
  });

  describe('sorting', () => {
    it('should sort by recent (default)', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.conversation_Feedback.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.conversation_Feedback.count as jest.Mock).mockResolvedValue(0);

      const params = Promise.resolve({ chatbotId });
      const request = new Request(
        `http://localhost/api/chatbots/${chatbotId}/reviews`
      );
      await GET(request, { params });

      expect(prisma.conversation_Feedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should sort by rating_high', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.conversation_Feedback.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.conversation_Feedback.count as jest.Mock).mockResolvedValue(0);

      const params = Promise.resolve({ chatbotId });
      const request = new Request(
        `http://localhost/api/chatbots/${chatbotId}/reviews?sort=rating_high`
      );
      await GET(request, { params });

      expect(prisma.conversation_Feedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { rating: 'desc' },
        })
      );
    });

    it('should sort by rating_low', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.conversation_Feedback.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.conversation_Feedback.count as jest.Mock).mockResolvedValue(0);

      const params = Promise.resolve({ chatbotId });
      const request = new Request(
        `http://localhost/api/chatbots/${chatbotId}/reviews?sort=rating_low`
      );
      await GET(request, { params });

      expect(prisma.conversation_Feedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { rating: 'asc' },
        })
      );
    });
  });

  describe('filtering - only reviews with rating or comment', () => {
    it('should only include reviews with rating or comment', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.conversation_Feedback.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.conversation_Feedback.count as jest.Mock).mockResolvedValue(0);

      const params = Promise.resolve({ chatbotId });
      const request = new Request(
        `http://localhost/api/chatbots/${chatbotId}/reviews`
      );
      await GET(request, { params });

      expect(prisma.conversation_Feedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            conversation: {
              chatbotId,
            },
            OR: [
              { rating: { not: null } },
              { userGoal: { not: null } },
              { stillNeed: { not: null } },
            ],
          }),
        })
      );
    });
  });

  describe('empty results', () => {
    it('should handle empty results gracefully', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.conversation_Feedback.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.conversation_Feedback.count as jest.Mock).mockResolvedValue(0);

      const params = Promise.resolve({ chatbotId });
      const request = new Request(
        `http://localhost/api/chatbots/${chatbotId}/reviews`
      );
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.reviews).toEqual([]);
      expect(data.pagination.totalItems).toBe(0);
      expect(data.pagination.totalPages).toBe(0);
    });
  });

  describe('error handling - invalid params', () => {
    it('should return 400 if page < 1', async () => {
      const params = Promise.resolve({ chatbotId });
      const request = new Request(
        `http://localhost/api/chatbots/${chatbotId}/reviews?page=0`
      );
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Page must be >= 1');
    });

    it('should return 400 if pageSize < 1', async () => {
      const params = Promise.resolve({ chatbotId });
      const request = new Request(
        `http://localhost/api/chatbots/${chatbotId}/reviews?pageSize=0`
      );
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Page size must be between 1 and 50');
    });

    it('should return 400 if pageSize > 50', async () => {
      const params = Promise.resolve({ chatbotId });
      const request = new Request(
        `http://localhost/api/chatbots/${chatbotId}/reviews?pageSize=51`
      );
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Page size must be between 1 and 50');
    });

    it('should return 400 if invalid sort', async () => {
      const params = Promise.resolve({ chatbotId });
      const request = new Request(
        `http://localhost/api/chatbots/${chatbotId}/reviews?sort=invalid`
      );
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain(
        "sort must be 'recent', 'rating_high', or 'rating_low'"
      );
    });
  });

  describe('error handling - chatbot not found', () => {
    it('should return 404 if chatbot does not exist', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(null);

      const params = Promise.resolve({ chatbotId });
      const request = new Request(
        `http://localhost/api/chatbots/${chatbotId}/reviews`
      );
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Chatbot not found');
    });
  });

  describe('error handling - database errors', () => {
    it('should return 500 on database error', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.conversation_Feedback.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const params = Promise.resolve({ chatbotId });
      const request = new Request(
        `http://localhost/api/chatbots/${chatbotId}/reviews`
      );
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to fetch reviews');
    });
  });

  describe('date formatting', () => {
    it('should format createdAt as ISO string', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.conversation_Feedback.findMany as jest.Mock).mockResolvedValue([
        mockReview,
      ]);
      (prisma.conversation_Feedback.count as jest.Mock).mockResolvedValue(1);

      const params = Promise.resolve({ chatbotId });
      const request = new Request(
        `http://localhost/api/chatbots/${chatbotId}/reviews`
      );
      const response = await GET(request, { params });
      const data = await response.json();

      expect(data.reviews[0].createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(typeof data.reviews[0].createdAt).toBe('string');
    });
  });
});

