// __tests__/api/intake/responses/route.test.ts
// Phase 3.10: Unit tests for Intake Responses API route
// Tests POST endpoint for creating intake responses and syncing to User_Context

import { POST } from '@/app/api/intake/responses/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { ContextSource } from '@prisma/client';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    intake_Question: {
      findUnique: jest.fn(),
    },
    intake_Response: {
      create: jest.fn(),
    },
    user_Context: {
      upsert: jest.fn(),
    },
  },
}));

// Mock Clerk auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

describe('Intake Responses API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockClerkUserId = 'clerk-user-123';
  const mockUserId = 'user-123';
  const mockChatbotId = 'chatbot-123';
  const mockQuestionId = 'question-123';

  const mockQuestion = {
    id: mockQuestionId,
    slug: 'industry',
    chatbotId: mockChatbotId,
  };

  const mockResponse = {
    id: 'response-123',
    userId: mockUserId,
    intakeQuestionId: mockQuestionId,
    chatbotId: mockChatbotId,
    value: 'Technology',
    reusableAcrossFrameworks: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  describe('POST /api/intake/responses', () => {
    const mockRequestBody = {
      userId: mockUserId,
      intakeQuestionId: mockQuestionId,
      chatbotId: mockChatbotId,
      value: 'Technology',
      reusableAcrossFrameworks: false,
    };

    it('should return 401 if user is not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: null });

      const request = new Request('http://localhost/api/intake/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('should return 404 if user not found', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/intake/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should return 400 if required fields are missing', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });

      const request = new Request('http://localhost/api/intake/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: mockUserId }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required fields');
    });

    it('should return 403 if userId does not match authenticated user', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });

      const invalidBody = { ...mockRequestBody, userId: 'different-user-id' };
      const request = new Request('http://localhost/api/intake/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidBody),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('userId does not match');
    });

    it('should return 404 if intake question not found', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/intake/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Intake question not found');
    });

    it('should return 400 if chatbotId does not match question chatbotId', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findUnique as jest.Mock).mockResolvedValue(mockQuestion);

      const invalidBody = { ...mockRequestBody, chatbotId: 'different-chatbot-id' };
      const request = new Request('http://localhost/api/intake/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidBody),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('chatbotId does not match');
    });

    it('should create intake response and sync to chatbot-specific User_Context', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findUnique as jest.Mock).mockResolvedValue(mockQuestion);
      (prisma.intake_Response.create as jest.Mock).mockResolvedValue(mockResponse);
      (prisma.user_Context.upsert as jest.Mock).mockResolvedValue({
        id: 'context-123',
        userId: mockUserId,
        chatbotId: mockChatbotId,
        key: mockQuestion.slug,
        value: mockRequestBody.value,
        source: ContextSource.INTAKE_FORM,
      });

      const request = new Request('http://localhost/api/intake/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.response).toMatchObject({
        id: mockResponse.id,
        userId: mockResponse.userId,
        intakeQuestionId: mockResponse.intakeQuestionId,
      });
      expect(prisma.intake_Response.create).toHaveBeenCalled();
      expect(prisma.user_Context.upsert).toHaveBeenCalledWith({
        where: {
          userId_chatbotId_key: {
            userId: mockUserId,
            chatbotId: mockChatbotId,
            key: mockQuestion.slug,
          },
        },
        create: {
          userId: mockUserId,
          chatbotId: mockChatbotId,
          key: mockQuestion.slug,
          value: mockRequestBody.value,
          source: ContextSource.INTAKE_FORM,
          isVisible: true,
          isEditable: true,
        },
        update: {
          value: mockRequestBody.value,
          source: ContextSource.INTAKE_FORM,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should sync to global User_Context if reusableAcrossFrameworks is true', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findUnique as jest.Mock).mockResolvedValue(mockQuestion);
      (prisma.intake_Response.create as jest.Mock).mockResolvedValue(mockResponse);
      (prisma.user_Context.upsert as jest.Mock).mockResolvedValue({
        id: 'context-123',
        userId: mockUserId,
        chatbotId: null,
        key: mockQuestion.slug,
        value: mockRequestBody.value,
        source: ContextSource.INTAKE_FORM,
      });

      const globalBody = { ...mockRequestBody, reusableAcrossFrameworks: true };
      const request = new Request('http://localhost/api/intake/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(globalBody),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.user_Context.upsert).toHaveBeenCalledWith({
        where: {
          userId_chatbotId_key: {
            userId: mockUserId,
            chatbotId: null, // Global context
            key: mockQuestion.slug,
          },
        },
        create: expect.objectContaining({
          chatbotId: null,
        }),
        update: expect.any(Object),
      });
    });

    it('should use question chatbotId if chatbotId not provided', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findUnique as jest.Mock).mockResolvedValue(mockQuestion);
      (prisma.intake_Response.create as jest.Mock).mockResolvedValue(mockResponse);
      (prisma.user_Context.upsert as jest.Mock).mockResolvedValue({});

      const bodyWithoutChatbotId = {
        userId: mockUserId,
        intakeQuestionId: mockQuestionId,
        value: 'Technology',
      };
      const request = new Request('http://localhost/api/intake/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyWithoutChatbotId),
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(prisma.intake_Response.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          chatbotId: mockChatbotId, // Uses question's chatbotId
        }),
      });
    });

    it('should return 409 if duplicate response exists', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findUnique as jest.Mock).mockResolvedValue(mockQuestion);
      (prisma.intake_Response.create as jest.Mock).mockRejectedValue(
        new Error('Unique constraint failed')
      );

      const request = new Request('http://localhost/api/intake/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('already exists');
    });

    it('should return 500 on unexpected error', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

      const request = new Request('http://localhost/api/intake/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create intake response');
    });
  });
});


