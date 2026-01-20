// __tests__/api/intake/completion/route.test.ts
// Phase 3.10: Unit tests for Intake Completion API route
// Tests GET endpoint for checking intake form completion status

import { GET } from '@/app/api/intake/completion/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    intake_Question: {
      findMany: jest.fn(),
    },
    intake_Response: {
      findMany: jest.fn(),
    },
  },
}));

// Mock Clerk auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

describe('Intake Completion API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockClerkUserId = 'clerk-user-123';
  const mockUserId = 'user-123';
  const mockChatbotId = 'chatbot-123';

  describe('GET /api/intake/completion', () => {
    it('should return not completed if user is not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: null });

      const request = new Request(`http://localhost/api/intake/completion?chatbotId=${mockChatbotId}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.completed).toBe(false);
      expect(data.hasQuestions).toBe(false);
      expect(data.reason).toBe('not_authenticated');
    });

    it('should return not completed if user not found', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request(`http://localhost/api/intake/completion?chatbotId=${mockChatbotId}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.completed).toBe(false);
      expect(data.hasQuestions).toBe(false);
      expect(data.reason).toBe('user_not_found');
    });

    it('should return 400 if chatbotId is missing', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });

      const request = new Request('http://localhost/api/intake/completion');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('chatbotId query parameter is required');
    });

    it('should return completed if no questions exist', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request(`http://localhost/api/intake/completion?chatbotId=${mockChatbotId}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.completed).toBe(true);
      expect(data.hasQuestions).toBe(false);
    });

    it('should return completed if all required questions are answered', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findMany as jest.Mock).mockResolvedValue([
        { id: 'q1', isRequired: true },
        { id: 'q2', isRequired: true },
        { id: 'q3', isRequired: false },
      ]);
      (prisma.intake_Response.findMany as jest.Mock).mockResolvedValue([
        { intakeQuestionId: 'q1' },
        { intakeQuestionId: 'q2' },
        { intakeQuestionId: 'q3' },
      ]);

      const request = new Request(`http://localhost/api/intake/completion?chatbotId=${mockChatbotId}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.completed).toBe(true);
      expect(data.hasQuestions).toBe(true);
      expect(data.answeredCount).toBe(3);
      expect(data.totalCount).toBe(3);
      expect(data.requiredCount).toBe(2);
      expect(data.answeredRequiredCount).toBe(2);
    });

    it('should return not completed if required questions are missing', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findMany as jest.Mock).mockResolvedValue([
        { id: 'q1', isRequired: true },
        { id: 'q2', isRequired: true },
        { id: 'q3', isRequired: false },
      ]);
      (prisma.intake_Response.findMany as jest.Mock).mockResolvedValue([
        { intakeQuestionId: 'q1' }, // Only one required question answered
        { intakeQuestionId: 'q3' },
      ]);

      const request = new Request(`http://localhost/api/intake/completion?chatbotId=${mockChatbotId}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.completed).toBe(false);
      expect(data.hasQuestions).toBe(true);
      expect(data.answeredCount).toBe(2);
      expect(data.totalCount).toBe(3);
      expect(data.requiredCount).toBe(2);
      expect(data.answeredRequiredCount).toBe(1);
    });

    it('should return completed if no required questions exist', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findMany as jest.Mock).mockResolvedValue([
        { id: 'q1', isRequired: false },
        { id: 'q2', isRequired: false },
      ]);
      (prisma.intake_Response.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request(`http://localhost/api/intake/completion?chatbotId=${mockChatbotId}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.completed).toBe(true);
      expect(data.hasQuestions).toBe(true);
      expect(data.requiredCount).toBe(0);
    });

    it('should return 500 on database error', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new Request(`http://localhost/api/intake/completion?chatbotId=${mockChatbotId}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to check intake completion');
    });
  });
});









