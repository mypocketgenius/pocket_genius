// __tests__/api/favorites/[chatbotId]/route.test.ts
// Phase 3.7.6: Unit tests for Toggle Favorite API route
// Tests favorite toggle functionality with authentication

import { POST } from '@/app/api/favorites/[chatbotId]/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    chatbot: {
      findUnique: jest.fn(),
    },
    favorited_Chatbots: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

// Mock Clerk auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

describe('POST /api/favorites/[chatbotId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUserId = 'user-123';
  const mockClerkUserId = 'clerk-user-123';
  const mockChatbotId = 'bot-123';

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: null });

      const request = new Request('http://localhost/api/favorites/bot-123', {
        method: 'POST',
      });
      const response = await POST(request, { params: { chatbotId: mockChatbotId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should return 404 if user not found in database', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/favorites/bot-123', {
        method: 'POST',
      });
      const response = await POST(request, { params: { chatbotId: mockChatbotId } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { clerkId: mockClerkUserId },
        select: { id: true },
      });
    });
  });

  describe('chatbot validation', () => {
    it('should return 404 if chatbot not found', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/favorites/bot-123', {
        method: 'POST',
      });
      const response = await POST(request, { params: { chatbotId: mockChatbotId } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Chatbot not found');
      expect(prisma.chatbot.findUnique).toHaveBeenCalledWith({
        where: { id: mockChatbotId },
        select: { id: true },
      });
    });
  });

  describe('toggle favorite - create favorite', () => {
    it('should create favorite when it does not exist', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({ id: mockChatbotId });
      (prisma.favorited_Chatbots.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.favorited_Chatbots.create as jest.Mock).mockResolvedValue({
        id: 'favorite-123',
        userId: mockUserId,
        chatbotId: mockChatbotId,
      });

      const request = new Request('http://localhost/api/favorites/bot-123', {
        method: 'POST',
      });
      const response = await POST(request, { params: { chatbotId: mockChatbotId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isFavorite).toBe(true);
      expect(prisma.favorited_Chatbots.findUnique).toHaveBeenCalledWith({
        where: {
          userId_chatbotId: {
            userId: mockUserId,
            chatbotId: mockChatbotId,
          },
        },
      });
      expect(prisma.favorited_Chatbots.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          chatbotId: mockChatbotId,
        },
      });
      expect(prisma.favorited_Chatbots.delete).not.toHaveBeenCalled();
    });
  });

  describe('toggle favorite - delete favorite', () => {
    it('should delete favorite when it exists', async () => {
      const mockFavorite = {
        id: 'favorite-123',
        userId: mockUserId,
        chatbotId: mockChatbotId,
      };

      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({ id: mockChatbotId });
      (prisma.favorited_Chatbots.findUnique as jest.Mock).mockResolvedValue(mockFavorite);
      (prisma.favorited_Chatbots.delete as jest.Mock).mockResolvedValue(mockFavorite);

      const request = new Request('http://localhost/api/favorites/bot-123', {
        method: 'POST',
      });
      const response = await POST(request, { params: { chatbotId: mockChatbotId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isFavorite).toBe(false);
      expect(prisma.favorited_Chatbots.findUnique).toHaveBeenCalledWith({
        where: {
          userId_chatbotId: {
            userId: mockUserId,
            chatbotId: mockChatbotId,
          },
        },
      });
      expect(prisma.favorited_Chatbots.delete).toHaveBeenCalledWith({
        where: {
          userId_chatbotId: {
            userId: mockUserId,
            chatbotId: mockChatbotId,
          },
        },
      });
      expect(prisma.favorited_Chatbots.create).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should return 500 on database error', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.chatbot.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost/api/favorites/bot-123', {
        method: 'POST',
      });
      const response = await POST(request, { params: { chatbotId: mockChatbotId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to toggle favorite');
    });
  });
});

