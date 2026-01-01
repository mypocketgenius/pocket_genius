// __tests__/api/intake/questions/route.test.ts
// Phase 3.10: Unit tests for Intake Questions API route
// Tests GET and POST endpoints for intake questions

import { GET, POST } from '@/app/api/intake/questions/route';
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
    intake_Question: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Mock Clerk auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

describe('Intake Questions API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockClerkUserId = 'clerk-user-123';
  const mockUserId = 'user-123';
  const mockChatbotId = 'chatbot-123';

  const mockQuestion = {
    id: 'question-123',
    chatbotId: mockChatbotId,
    slug: 'industry',
    questionText: 'What industry are you in?',
    helperText: 'Select your primary industry',
    responseType: 'SELECT',
    displayOrder: 1,
    isRequired: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  describe('GET /api/intake/questions', () => {
    it('should return 400 if chatbotId is missing', async () => {
      const request = new Request('http://localhost/api/intake/questions');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('chatbotId query parameter is required');
    });

    it('should return 404 if chatbot not found', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request(`http://localhost/api/intake/questions?chatbotId=${mockChatbotId}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Chatbot not found');
    });

    it('should return questions for a chatbot', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({ id: mockChatbotId });
      (prisma.intake_Question.findMany as jest.Mock).mockResolvedValue([mockQuestion]);

      const request = new Request(`http://localhost/api/intake/questions?chatbotId=${mockChatbotId}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.questions).toHaveLength(1);
      expect(data.questions[0]).toMatchObject({
        id: mockQuestion.id,
        chatbotId: mockQuestion.chatbotId,
        slug: mockQuestion.slug,
        questionText: mockQuestion.questionText,
      });
      expect(prisma.intake_Question.findMany).toHaveBeenCalledWith({
        where: { chatbotId: mockChatbotId },
        orderBy: { displayOrder: 'asc' },
      });
    });

    it('should return empty array if no questions exist', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({ id: mockChatbotId });
      (prisma.intake_Question.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request(`http://localhost/api/intake/questions?chatbotId=${mockChatbotId}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.questions).toEqual([]);
    });

    it('should return 500 on database error', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new Request(`http://localhost/api/intake/questions?chatbotId=${mockChatbotId}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch intake questions');
    });
  });

  describe('POST /api/intake/questions', () => {
    const mockRequestBody = {
      chatbotId: mockChatbotId,
      slug: 'industry',
      questionText: 'What industry are you in?',
      helperText: 'Select your primary industry',
      responseType: 'SELECT',
      displayOrder: 1,
      isRequired: true,
    };

    it('should return 401 if user is not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: null });

      const request = new Request('http://localhost/api/intake/questions', {
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

      const request = new Request('http://localhost/api/intake/questions', {
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

      const request = new Request('http://localhost/api/intake/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatbotId: mockChatbotId }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required fields');
    });

    it('should return 400 if responseType is invalid', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({
        id: mockChatbotId,
        creator: {
          users: [{ userId: mockUserId, role: 'OWNER' }],
        },
      });

      const invalidBody = { ...mockRequestBody, responseType: 'INVALID' };
      const request = new Request('http://localhost/api/intake/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidBody),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid responseType');
    });

    it('should return 404 if chatbot not found', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/intake/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Chatbot not found');
    });

    it('should return 403 if user is not creator', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({
        id: mockChatbotId,
        creator: {
          users: [], // No users with OWNER role
        },
      });

      const request = new Request('http://localhost/api/intake/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Unauthorized');
    });

    it('should create intake question successfully', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({
        id: mockChatbotId,
        creator: {
          users: [{ userId: mockUserId, role: 'OWNER' }],
        },
      });
      (prisma.intake_Question.create as jest.Mock).mockResolvedValue(mockQuestion);

      const request = new Request('http://localhost/api/intake/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.question).toMatchObject({
        id: mockQuestion.id,
        chatbotId: mockQuestion.chatbotId,
        slug: mockQuestion.slug,
        questionText: mockQuestion.questionText,
      });
      expect(prisma.intake_Question.create).toHaveBeenCalledWith({
        data: {
          chatbotId: mockChatbotId,
          slug: mockRequestBody.slug,
          questionText: mockRequestBody.questionText,
          helperText: mockRequestBody.helperText,
          responseType: mockRequestBody.responseType,
          displayOrder: mockRequestBody.displayOrder,
          isRequired: mockRequestBody.isRequired,
        },
      });
    });

    it('should return 409 if duplicate slug exists', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({
        id: mockChatbotId,
        creator: {
          users: [{ userId: mockUserId, role: 'OWNER' }],
        },
      });
      (prisma.intake_Question.create as jest.Mock).mockRejectedValue(
        new Error('Unique constraint failed')
      );

      const request = new Request('http://localhost/api/intake/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('slug already exists');
    });

    it('should return 500 on unexpected error', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.chatbot.findUnique as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

      const request = new Request('http://localhost/api/intake/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create intake question');
    });
  });
});

