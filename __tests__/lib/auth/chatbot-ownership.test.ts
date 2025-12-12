// __tests__/lib/auth/chatbot-ownership.test.ts
// Phase 5: Tests for chatbot ownership verification utility
// Tests authentication and authorization logic

import { verifyChatbotOwnership } from '@/lib/auth/chatbot-ownership';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

// Mock dependencies
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    chatbot: {
      findUnique: jest.fn(),
    },
  },
}));

describe('verifyChatbotOwnership', () => {
  const mockClerkUserId = 'clerk_user_123';
  const mockDbUserId = 'db_user_123';
  const mockChatbotId = 'chatbot_123';
  const mockCreatorId = 'creator_123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful Verification', () => {
    it('should return chatbot ownership result when user is authorized', async () => {
      (auth as jest.Mock).mockResolvedValue({
        userId: mockClerkUserId,
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockDbUserId,
      });

      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({
        id: mockChatbotId,
        title: 'Test Chatbot',
        creatorId: mockCreatorId,
        creator: {
          users: [
            {
              id: 'creator_user_1',
            },
          ],
        },
      });

      const result = await verifyChatbotOwnership(mockChatbotId);

      expect(result).toEqual({
        userId: mockDbUserId,
        chatbotId: mockChatbotId,
        chatbot: {
          id: mockChatbotId,
          title: 'Test Chatbot',
          creatorId: mockCreatorId,
        },
      });

      expect(auth).toHaveBeenCalled();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { clerkId: mockClerkUserId },
        select: { id: true },
      });
      expect(prisma.chatbot.findUnique).toHaveBeenCalledWith({
        where: { id: mockChatbotId },
        select: expect.objectContaining({
          id: true,
          title: true,
          creatorId: true,
        }),
      });
    });
  });

  describe('Authentication Errors', () => {
    it('should throw error when user is not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue({
        userId: null,
      });

      await expect(verifyChatbotOwnership(mockChatbotId)).rejects.toThrow(
        'Authentication required'
      );

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.chatbot.findUnique).not.toHaveBeenCalled();
    });

    it('should throw error when user is not found in database', async () => {
      (auth as jest.Mock).mockResolvedValue({
        userId: mockClerkUserId,
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(verifyChatbotOwnership(mockChatbotId)).rejects.toThrow(
        'User not found'
      );

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { clerkId: mockClerkUserId },
        select: { id: true },
      });
      expect(prisma.chatbot.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('Authorization Errors', () => {
    beforeEach(() => {
      (auth as jest.Mock).mockResolvedValue({
        userId: mockClerkUserId,
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockDbUserId,
      });
    });

    it('should throw error when chatbot is not found', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(verifyChatbotOwnership(mockChatbotId)).rejects.toThrow(
        'Chatbot not found'
      );

      expect(prisma.chatbot.findUnique).toHaveBeenCalledWith({
        where: { id: mockChatbotId },
        select: expect.any(Object),
      });
    });

    it('should throw error when user is not a member of the creator', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({
        id: mockChatbotId,
        title: 'Test Chatbot',
        creatorId: mockCreatorId,
        creator: {
          users: [], // User is not a member
        },
      });

      await expect(verifyChatbotOwnership(mockChatbotId)).rejects.toThrow(
        'Unauthorized: You do not have access to this chatbot'
      );
    });

    it('should throw error when creator.users is null', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({
        id: mockChatbotId,
        title: 'Test Chatbot',
        creatorId: mockCreatorId,
        creator: {
          users: null,
        },
      });

      await expect(verifyChatbotOwnership(mockChatbotId)).rejects.toThrow(
        'Unauthorized: You do not have access to this chatbot'
      );
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      (auth as jest.Mock).mockResolvedValue({
        userId: mockClerkUserId,
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockDbUserId,
      });
    });

    it('should handle multiple users in creator.users array', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({
        id: mockChatbotId,
        title: 'Test Chatbot',
        creatorId: mockCreatorId,
        creator: {
          users: [
            { id: 'other_user_1' },
            { id: 'creator_user_1' },
            { id: 'other_user_2' },
          ],
        },
      });

      // Should still work if user is in the array
      const result = await verifyChatbotOwnership(mockChatbotId);
      expect(result).toBeDefined();
    });

    it('should query chatbot with correct select fields', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({
        id: mockChatbotId,
        title: 'Test Chatbot',
        creatorId: mockCreatorId,
        creator: {
          users: [{ id: 'creator_user_1' }],
        },
      });

      await verifyChatbotOwnership(mockChatbotId);

      expect(prisma.chatbot.findUnique).toHaveBeenCalledWith({
        where: { id: mockChatbotId },
        select: {
          id: true,
          title: true,
          creatorId: true,
          creator: {
            select: {
              users: {
                where: { userId: mockDbUserId },
                select: { id: true },
              },
            },
          },
        },
      });
    });
  });
});
