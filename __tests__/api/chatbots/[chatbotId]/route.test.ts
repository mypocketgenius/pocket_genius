// __tests__/api/chatbots/[chatbotId]/route.test.ts
// Phase 3.9: Unit tests for Chatbot Update API route

import { PATCH } from '@/app/api/chatbots/[chatbotId]/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { createChatbotVersion } from '@/lib/chatbot/versioning';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    chatbot: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock Clerk auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

// Mock versioning utility
jest.mock('@/lib/chatbot/versioning', () => ({
  createChatbotVersion: jest.fn(),
}));

describe('PATCH /api/chatbots/[chatbotId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUserId = 'user-123';
  const mockClerkUserId = 'clerk-user-123';
  const mockChatbotId = 'bot-123';
  const mockCreatorId = 'creator-123';

  const mockUser = {
    id: mockUserId,
  };

  const mockChatbot = {
    id: mockChatbotId,
    title: 'Test Chatbot',
    description: 'Test Description',
    creator: {
      id: mockCreatorId,
      users: [
        {
          userId: mockUserId,
          role: 'OWNER',
        },
      ],
    },
  };

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: null });

      const request = new Request('http://localhost/api/chatbots/bot-123', {
        method: 'PATCH',
        body: JSON.stringify({}),
      });
      const response = await PATCH(request, { params: Promise.resolve({ chatbotId: mockChatbotId }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('should return 404 if user not found in database', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/chatbots/bot-123', {
        method: 'PATCH',
        body: JSON.stringify({}),
      });
      const response = await PATCH(request, { params: Promise.resolve({ chatbotId: mockChatbotId }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });
  });

  describe('authorization', () => {
    beforeEach(() => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    });

    it('should return 404 if chatbot not found', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/chatbots/bot-123', {
        method: 'PATCH',
        body: JSON.stringify({}),
      });
      const response = await PATCH(request, { params: Promise.resolve({ chatbotId: mockChatbotId }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Chatbot not found');
    });

    it('should return 403 if user is not the creator', async () => {
      const chatbotWithDifferentCreator = {
        ...mockChatbot,
        creator: {
          id: mockCreatorId,
          users: [
            {
              userId: 'different-user',
              role: 'OWNER',
            },
          ],
        },
      };

      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(chatbotWithDifferentCreator);

      const request = new Request('http://localhost/api/chatbots/bot-123', {
        method: 'PATCH',
        body: JSON.stringify({}),
      });
      const response = await PATCH(request, { params: Promise.resolve({ chatbotId: mockChatbotId }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized: You must be the chatbot creator');
    });
  });

  describe('version creation', () => {
    beforeEach(() => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
    });

    it('should create version when versioned fields change', async () => {
      const mockVersion = {
        id: 'version-1',
        versionNumber: 1,
        systemPrompt: 'Updated prompt',
      };

      (createChatbotVersion as jest.Mock).mockResolvedValue(mockVersion);

      const request = new Request('http://localhost/api/chatbots/bot-123', {
        method: 'PATCH',
        body: JSON.stringify({
          systemPrompt: 'Updated prompt',
        }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ chatbotId: mockChatbotId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.version).toEqual(mockVersion);
      expect(createChatbotVersion).toHaveBeenCalledWith(
        mockChatbotId,
        mockUserId,
        expect.objectContaining({
          systemPrompt: 'Updated prompt',
        })
      );
    });

    it('should not create version when only non-versioned fields change', async () => {
      (prisma.chatbot.update as jest.Mock).mockResolvedValue(mockChatbot);

      const request = new Request('http://localhost/api/chatbots/bot-123', {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Updated Title',
          description: 'Updated Description',
        }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ chatbotId: mockChatbotId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.version).toBeNull();
      expect(createChatbotVersion).not.toHaveBeenCalled();
      expect(prisma.chatbot.update).toHaveBeenCalledWith({
        where: { id: mockChatbotId },
        data: {
          title: 'Updated Title',
          description: 'Updated Description',
        },
      });
    });

    it('should handle both versioned and non-versioned field changes', async () => {
      const mockVersion = {
        id: 'version-1',
        versionNumber: 1,
      };

      (createChatbotVersion as jest.Mock).mockResolvedValue(mockVersion);
      (prisma.chatbot.update as jest.Mock).mockResolvedValue(mockChatbot);

      const request = new Request('http://localhost/api/chatbots/bot-123', {
        method: 'PATCH',
        body: JSON.stringify({
          systemPrompt: 'Updated prompt',
          title: 'Updated Title',
        }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ chatbotId: mockChatbotId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.version).toEqual(mockVersion);
      expect(createChatbotVersion).toHaveBeenCalled();
      expect(prisma.chatbot.update).toHaveBeenCalledWith({
        where: { id: mockChatbotId },
        data: {
          title: 'Updated Title',
        },
      });
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
    });

    it('should return 500 on unexpected error', async () => {
      (createChatbotVersion as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost/api/chatbots/bot-123', {
        method: 'PATCH',
        body: JSON.stringify({
          systemPrompt: 'Updated prompt',
        }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ chatbotId: mockChatbotId }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update chatbot');
    });
  });
});

