// __tests__/api/user-context/route.test.ts
// Phase 3.10, Step 9: Unit tests for User Context API route
// Tests GET, PATCH, and POST endpoints for user context management

import { GET, PATCH, POST } from '@/app/api/user-context/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { ContextSource } from '@prisma/client';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    user_Context: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Mock Clerk auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

describe('User Context API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUserId = 'user-123';
  const mockClerkUserId = 'clerk-user-123';
  const mockContextId = 'context-123';

  const mockGlobalContext = {
    id: 'context-1',
    userId: mockUserId,
    chatbotId: null,
    key: 'industry',
    value: 'Technology',
    source: ContextSource.INTAKE_FORM,
    isVisible: true,
    isEditable: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    chatbot: null,
  };

  const mockChatbotContext = {
    id: 'context-2',
    userId: mockUserId,
    chatbotId: 'bot-123',
    key: 'role',
    value: 'Founder',
    source: ContextSource.USER_PROVIDED,
    isVisible: true,
    isEditable: true,
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
    chatbot: {
      id: 'bot-123',
      title: 'Test Chatbot',
    },
  };

  describe('GET /api/user-context', () => {
    describe('authentication', () => {
      it('should return 401 if user is not authenticated', async () => {
        (auth as jest.Mock).mockResolvedValue({ userId: null });

        const request = new Request('http://localhost/api/user-context');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Authentication required');
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
      });

      it('should return 404 if user not found in database', async () => {
        (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

        const request = new Request('http://localhost/api/user-context');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('User not found');
        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: { clerkId: mockClerkUserId },
          select: { id: true },
        });
      });
    });

    describe('happy path', () => {
      it('should return all user contexts ordered by chatbotId then key', async () => {
        (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
        (prisma.user_Context.findMany as jest.Mock).mockResolvedValue([
          mockGlobalContext,
          mockChatbotContext,
        ]);

        const request = new Request('http://localhost/api/user-context');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.contexts).toHaveLength(2);
        expect(data.contexts[0]).toMatchObject({
          id: 'context-1',
          key: 'industry',
          value: 'Technology',
          chatbotId: null,
          source: ContextSource.INTAKE_FORM,
        });
        expect(data.contexts[1]).toMatchObject({
          id: 'context-2',
          key: 'role',
          value: 'Founder',
          chatbotId: 'bot-123',
          source: ContextSource.USER_PROVIDED,
        });

        expect(prisma.user_Context.findMany).toHaveBeenCalledWith({
          where: { userId: mockUserId },
          include: {
            chatbot: {
              select: { id: true, title: true },
            },
          },
          orderBy: [
            { chatbotId: 'asc' },
            { key: 'asc' },
          ],
        });
      });

      it('should return empty array when user has no contexts', async () => {
        (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
        (prisma.user_Context.findMany as jest.Mock).mockResolvedValue([]);

        const request = new Request('http://localhost/api/user-context');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.contexts).toEqual([]);
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
        (prisma.user_Context.findMany as jest.Mock).mockRejectedValue(
          new Error('Database error')
        );

        const request = new Request('http://localhost/api/user-context');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to fetch user contexts');
      });
    });
  });

  describe('PATCH /api/user-context', () => {
    describe('authentication', () => {
      it('should return 401 if user is not authenticated', async () => {
        (auth as jest.Mock).mockResolvedValue({ userId: null });

        const request = new Request('http://localhost/api/user-context', {
          method: 'PATCH',
          body: JSON.stringify({ contextId: mockContextId, value: 'New Value' }),
        });
        const response = await PATCH(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Authentication required');
      });

      it('should return 404 if user not found in database', async () => {
        (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

        const request = new Request('http://localhost/api/user-context', {
          method: 'PATCH',
          body: JSON.stringify({ contextId: mockContextId, value: 'New Value' }),
        });
        const response = await PATCH(request);
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('User not found');
      });
    });

    describe('validation', () => {
      it('should return 400 if contextId is missing', async () => {
        (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });

        const request = new Request('http://localhost/api/user-context', {
          method: 'PATCH',
          body: JSON.stringify({ value: 'New Value' }),
        });
        const response = await PATCH(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('contextId is required');
      });

      it('should return 404 if context not found', async () => {
        (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
        (prisma.user_Context.findUnique as jest.Mock).mockResolvedValue(null);

        const request = new Request('http://localhost/api/user-context', {
          method: 'PATCH',
          body: JSON.stringify({ contextId: mockContextId, value: 'New Value' }),
        });
        const response = await PATCH(request);
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('Context not found');
      });

      it('should return 403 if user does not own the context', async () => {
        (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
        (prisma.user_Context.findUnique as jest.Mock).mockResolvedValue({
          ...mockGlobalContext,
          userId: 'different-user-id',
        });

        const request = new Request('http://localhost/api/user-context', {
          method: 'PATCH',
          body: JSON.stringify({ contextId: mockContextId, value: 'New Value' }),
        });
        const response = await PATCH(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toBe('Unauthorized');
      });

      it('should return 403 if context is not editable', async () => {
        (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
        (prisma.user_Context.findUnique as jest.Mock).mockResolvedValue({
          ...mockGlobalContext,
          isEditable: false,
        });

        const request = new Request('http://localhost/api/user-context', {
          method: 'PATCH',
          body: JSON.stringify({ contextId: mockContextId, value: 'New Value' }),
        });
        const response = await PATCH(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toBe('Context is not editable');
      });
    });

    describe('happy path', () => {
      it('should update context value and set source to USER_PROVIDED', async () => {
        const updatedContext = {
          ...mockGlobalContext,
          value: 'Updated Value',
          source: ContextSource.USER_PROVIDED,
          updatedAt: new Date('2024-01-03'),
        };

        (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
        (prisma.user_Context.findUnique as jest.Mock).mockResolvedValue(mockGlobalContext);
        (prisma.user_Context.update as jest.Mock).mockResolvedValue(updatedContext);

        const request = new Request('http://localhost/api/user-context', {
          method: 'PATCH',
          body: JSON.stringify({ contextId: mockContextId, value: 'Updated Value' }),
        });
        const response = await PATCH(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.context).toMatchObject({
          id: 'context-1',
          key: 'industry',
          value: 'Updated Value',
        });

        expect(prisma.user_Context.update).toHaveBeenCalledWith({
          where: { id: mockContextId },
          data: {
            value: 'Updated Value',
            source: ContextSource.USER_PROVIDED,
            updatedAt: expect.any(Date),
          },
        });
      });

      it('should handle complex JSON values', async () => {
        const complexValue = { nested: { data: [1, 2, 3] } };
        const updatedContext = {
          ...mockGlobalContext,
          value: complexValue,
          source: ContextSource.USER_PROVIDED,
          updatedAt: new Date('2024-01-03'),
        };

        (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
        (prisma.user_Context.findUnique as jest.Mock).mockResolvedValue(mockGlobalContext);
        (prisma.user_Context.update as jest.Mock).mockResolvedValue(updatedContext);

        const request = new Request('http://localhost/api/user-context', {
          method: 'PATCH',
          body: JSON.stringify({ contextId: mockContextId, value: complexValue }),
        });
        const response = await PATCH(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.context.value).toEqual(complexValue);
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
        (prisma.user_Context.findUnique as jest.Mock).mockResolvedValue(mockGlobalContext);
        (prisma.user_Context.update as jest.Mock).mockRejectedValue(
          new Error('Database error')
        );

        const request = new Request('http://localhost/api/user-context', {
          method: 'PATCH',
          body: JSON.stringify({ contextId: mockContextId, value: 'New Value' }),
        });
        const response = await PATCH(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to update user context');
      });
    });
  });

  describe('POST /api/user-context', () => {
    describe('authentication', () => {
      it('should return 401 if user is not authenticated', async () => {
        (auth as jest.Mock).mockResolvedValue({ userId: null });

        const request = new Request('http://localhost/api/user-context', {
          method: 'POST',
          body: JSON.stringify({ key: 'new-key', value: 'New Value' }),
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Authentication required');
      });

      it('should return 404 if user not found in database', async () => {
        (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

        const request = new Request('http://localhost/api/user-context', {
          method: 'POST',
          body: JSON.stringify({ key: 'new-key', value: 'New Value' }),
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('User not found');
      });
    });

    describe('validation', () => {
      it('should return 400 if key is missing', async () => {
        (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });

        const request = new Request('http://localhost/api/user-context', {
          method: 'POST',
          body: JSON.stringify({ value: 'New Value' }),
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('key is required');
      });

      it('should return 409 if context with same key already exists', async () => {
        (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
        (prisma.user_Context.findFirst as jest.Mock).mockResolvedValue(mockGlobalContext);

        const request = new Request('http://localhost/api/user-context', {
          method: 'POST',
          body: JSON.stringify({ key: 'industry', value: 'New Value' }),
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error).toBe('Context with this key already exists');

        expect(prisma.user_Context.findFirst).toHaveBeenCalledWith({
          where: {
            userId: mockUserId,
            chatbotId: null,
            key: 'industry',
          },
        });
      });
    });

    describe('happy path', () => {
      it('should create new global context', async () => {
        const newContext = {
          id: 'context-new',
          userId: mockUserId,
          chatbotId: null,
          key: 'new-key',
          value: 'New Value',
          source: ContextSource.USER_PROVIDED,
          isVisible: true,
          isEditable: true,
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-03'),
        };

        (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
        (prisma.user_Context.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.user_Context.create as jest.Mock).mockResolvedValue(newContext);

        const request = new Request('http://localhost/api/user-context', {
          method: 'POST',
          body: JSON.stringify({ key: 'new-key', value: 'New Value' }),
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.context).toMatchObject({
          id: 'context-new',
          userId: mockUserId,
          chatbotId: null,
          key: 'new-key',
          value: 'New Value',
          source: ContextSource.USER_PROVIDED,
          isVisible: true,
          isEditable: true,
        });

        expect(prisma.user_Context.create).toHaveBeenCalledWith({
          data: {
            userId: mockUserId,
            chatbotId: null,
            key: 'new-key',
            value: 'New Value',
            source: ContextSource.USER_PROVIDED,
            isVisible: true,
            isEditable: true,
          },
        });
      });

      it('should create new chatbot-specific context', async () => {
        const newContext = {
          id: 'context-new',
          userId: mockUserId,
          chatbotId: 'bot-123',
          key: 'role',
          value: 'Developer',
          source: ContextSource.USER_PROVIDED,
          isVisible: true,
          isEditable: true,
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-03'),
        };

        (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
        (prisma.user_Context.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.user_Context.create as jest.Mock).mockResolvedValue(newContext);

        const request = new Request('http://localhost/api/user-context', {
          method: 'POST',
          body: JSON.stringify({ chatbotId: 'bot-123', key: 'role', value: 'Developer' }),
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.context).toMatchObject({
          chatbotId: 'bot-123',
          key: 'role',
          value: 'Developer',
        });

        expect(prisma.user_Context.create).toHaveBeenCalledWith({
          data: {
            userId: mockUserId,
            chatbotId: 'bot-123',
            key: 'role',
            value: 'Developer',
            source: ContextSource.USER_PROVIDED,
            isVisible: true,
            isEditable: true,
          },
        });
      });

      it('should handle complex JSON values', async () => {
        const complexValue = { preferences: { theme: 'dark', notifications: true } };
        const newContext = {
          id: 'context-new',
          userId: mockUserId,
          chatbotId: null,
          key: 'preferences',
          value: complexValue,
          source: ContextSource.USER_PROVIDED,
          isVisible: true,
          isEditable: true,
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-03'),
        };

        (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
        (prisma.user_Context.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.user_Context.create as jest.Mock).mockResolvedValue(newContext);

        const request = new Request('http://localhost/api/user-context', {
          method: 'POST',
          body: JSON.stringify({ key: 'preferences', value: complexValue }),
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.context.value).toEqual(complexValue);
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
        (prisma.user_Context.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.user_Context.create as jest.Mock).mockRejectedValue(
          new Error('Database error')
        );

        const request = new Request('http://localhost/api/user-context', {
          method: 'POST',
          body: JSON.stringify({ key: 'new-key', value: 'New Value' }),
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to create user context');
      });
    });
  });
});






