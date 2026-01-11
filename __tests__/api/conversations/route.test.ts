// __tests__/api/conversations/route.test.ts
// Side Menu Button Feature: Unit tests for Get User Conversations API route
// Tests fetching user's conversations with chatbot and creator details

import { GET } from '@/app/api/conversations/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    conversation: {
      findMany: jest.fn(),
    },
  },
}));

// Mock Clerk auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

describe('GET /api/conversations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUserId = 'user-123';
  const mockClerkUserId = 'clerk-user-123';

  const mockConversation = {
    id: 'conv-123',
    chatbotId: 'bot-123',
    userId: mockUserId,
    messageCount: 5,
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    createdAt: new Date('2024-01-01T10:00:00Z'),
    chatbot: {
      id: 'bot-123',
      title: 'The Art of War',
      type: 'DEEP_DIVE',
      creator: {
        id: 'creator-1',
        name: 'Sun Tzu',
        slug: 'sun-tzu',
      },
    },
  };

  const mockConversation2 = {
    id: 'conv-456',
    chatbotId: 'bot-456',
    userId: mockUserId,
    messageCount: 3,
    updatedAt: new Date('2024-01-10T10:00:00Z'),
    createdAt: new Date('2024-01-05T10:00:00Z'),
    chatbot: {
      id: 'bot-456',
      title: 'Strategy Guide',
      type: 'FRAMEWORK',
      creator: {
        id: 'creator-2',
        name: 'Strategy Expert',
        slug: 'strategy-expert',
      },
    },
  };

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: null });

      const request = new Request('http://localhost/api/conversations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.conversation.findMany).not.toHaveBeenCalled();
    });

    it('should return 404 if user not found in database', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/conversations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { clerkId: mockClerkUserId },
        select: { id: true },
      });
      expect(prisma.conversation.findMany).not.toHaveBeenCalled();
    });
  });

  describe('happy path', () => {
    it('should return conversations ordered by updatedAt DESC', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.conversation.findMany as jest.Mock).mockResolvedValue([
        mockConversation,
        mockConversation2,
      ]);

      const request = new Request('http://localhost/api/conversations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.conversations).toHaveLength(2);
      
      // Verify conversations are ordered by updatedAt DESC (most recent first)
      expect(data.conversations[0].id).toBe('conv-123'); // Updated Jan 15
      expect(data.conversations[1].id).toBe('conv-456'); // Updated Jan 10
      
      // Verify first conversation structure
      expect(data.conversations[0]).toMatchObject({
        id: 'conv-123',
        chatbotId: 'bot-123',
        chatbot: {
          id: 'bot-123',
          title: 'The Art of War',
          type: 'DEEP_DIVE',
          creator: {
            id: 'creator-1',
            name: 'Sun Tzu',
            slug: 'sun-tzu',
          },
        },
        updatedAt: '2024-01-15T10:00:00.000Z',
        createdAt: '2024-01-01T10:00:00.000Z',
        messageCount: 5,
      });

      // Verify Prisma query
      expect(prisma.conversation.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        include: {
          chatbot: {
            select: {
              id: true,
              title: true,
              type: true,
              creator: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      });
    });

    it('should return empty array when user has no conversations', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.conversation.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request('http://localhost/api/conversations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.conversations).toHaveLength(0);
      expect(Array.isArray(data.conversations)).toBe(true);
    });

    it('should handle null chatbot type', async () => {
      const conversationWithNullType = {
        ...mockConversation,
        chatbot: {
          ...mockConversation.chatbot,
          type: null,
        },
      };

      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.conversation.findMany as jest.Mock).mockResolvedValue([
        conversationWithNullType,
      ]);

      const request = new Request('http://localhost/api/conversations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.conversations[0].chatbot.type).toBeNull();
    });

    it('should handle null creator slug', async () => {
      const conversationWithNullSlug = {
        ...mockConversation,
        chatbot: {
          ...mockConversation.chatbot,
          creator: {
            ...mockConversation.chatbot.creator,
            slug: null,
          },
        },
      };

      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.conversation.findMany as jest.Mock).mockResolvedValue([
        conversationWithNullSlug,
      ]);

      const request = new Request('http://localhost/api/conversations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.conversations[0].chatbot.creator.slug).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should return 500 on database error', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.conversation.findMany as jest.Mock).mockRejectedValue(
        new Error('Database connection error')
      );

      const request = new Request('http://localhost/api/conversations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch conversations');
    });

    it('should return detailed error message in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      const dbError = new Error('Database connection error');
      (prisma.conversation.findMany as jest.Mock).mockRejectedValue(dbError);

      const request = new Request('http://localhost/api/conversations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database connection error');

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle non-Error exceptions', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.conversation.findMany as jest.Mock).mockRejectedValue('String error');

      const request = new Request('http://localhost/api/conversations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch conversations');
    });
  });
});





