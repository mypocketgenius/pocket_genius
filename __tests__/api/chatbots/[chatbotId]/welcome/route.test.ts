// __tests__/api/chatbots/[chatbotId]/welcome/route.test.ts
// Task 6: Integration tests for chatbot welcome endpoint
// Tests purpose generation and intake completion check (Subtask 6.2, 6.10)

import { GET } from '@/app/api/chatbots/[chatbotId]/welcome/route';
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
    chatbot_Intake_Question: {
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

// Mock purpose generator
jest.mock('@/lib/chatbot/generate-purpose', () => ({
  generatePurposeText: jest.fn((chatbot) => {
    if (chatbot.type === 'BODY_OF_WORK') {
      return `Integrate the lessons of ${chatbot.creator.name} into your life`;
    }
    if (chatbot.type === 'DEEP_DIVE') {
      const sourceTitle = chatbot.sources?.[0]?.title || chatbot.title;
      return `Integrate the lessons of ${sourceTitle} into your life`;
    }
    if (chatbot.type === 'FRAMEWORK') {
      return `Integrate the lessons of ${chatbot.title} into your life`;
    }
    return 'integrate lessons into your life';
  }),
}));

describe('Chatbot Welcome API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockClerkUserId = 'clerk-user-123';
  const mockUserId = 'user-123';
  const mockChatbotId = 'chatbot-123';

  describe('GET /api/chatbots/[chatbotId]/welcome', () => {
    it('should return 400 if chatbotId is missing', async () => {
      const request = new Request('http://localhost/api/chatbots//welcome');
      const response = await GET(request, { params: Promise.resolve({ chatbotId: '' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Chatbot ID is required');
    });

    it('should return 404 if chatbot not found', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: null });
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request(`http://localhost/api/chatbots/${mockChatbotId}/welcome`);
      const response = await GET(request, { params: Promise.resolve({ chatbotId: mockChatbotId }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Chatbot not found');
    });

    it('should return welcome data for BODY_OF_WORK chatbot', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({
        id: mockChatbotId,
        title: 'The Art of War',
        type: 'BODY_OF_WORK',
        creator: { name: 'Sun Tzu' },
        sources: [],
      });
      (prisma.chatbot_Intake_Question.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.intake_Response.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request(`http://localhost/api/chatbots/${mockChatbotId}/welcome`);
      const response = await GET(request, { params: Promise.resolve({ chatbotId: mockChatbotId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chatbotName).toBe('The Art of War');
      expect(data.chatbotPurpose).toBe('Integrate the lessons of Sun Tzu into your life');
      expect(data.intakeCompleted).toBe(true);
      expect(data.hasQuestions).toBe(false);
    });

    it('should return welcome data for DEEP_DIVE chatbot with source', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({
        id: mockChatbotId,
        title: 'Chatbot Title',
        type: 'DEEP_DIVE',
        creator: { name: 'Author' },
        sources: [{ title: 'The Art of War' }],
      });
      (prisma.chatbot_Intake_Question.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.intake_Response.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request(`http://localhost/api/chatbots/${mockChatbotId}/welcome`);
      const response = await GET(request, { params: Promise.resolve({ chatbotId: mockChatbotId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chatbotPurpose).toBe('Integrate the lessons of The Art of War into your life');
    });

    it('should return welcome data for FRAMEWORK chatbot', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({
        id: mockChatbotId,
        title: 'Framework Name',
        type: 'FRAMEWORK',
        creator: { name: 'Creator' },
        sources: [],
      });
      (prisma.chatbot_Intake_Question.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.intake_Response.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request(`http://localhost/api/chatbots/${mockChatbotId}/welcome`);
      const response = await GET(request, { params: Promise.resolve({ chatbotId: mockChatbotId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chatbotPurpose).toBe('Integrate the lessons of Framework Name into your life');
    });

    it('should return questions when intake not completed', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({
        id: mockChatbotId,
        title: 'Test Chatbot',
        type: 'FRAMEWORK',
        creator: { name: 'Creator' },
        sources: [],
      });
      (prisma.chatbot_Intake_Question.findMany as jest.Mock).mockResolvedValue([
        {
          displayOrder: 1,
          isRequired: true,
          intakeQuestion: {
            id: 'q1',
            questionText: 'What is your name?',
            helperText: null,
            responseType: 'TEXT',
            options: null,
          },
        },
      ]);
      (prisma.intake_Response.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request(`http://localhost/api/chatbots/${mockChatbotId}/welcome`);
      const response = await GET(request, { params: Promise.resolve({ chatbotId: mockChatbotId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.intakeCompleted).toBe(false);
      expect(data.hasQuestions).toBe(true);
      expect(data.questions).toBeDefined();
      expect(data.questions).toHaveLength(1);
      expect(data.questions[0].id).toBe('q1');
      expect(data.questions[0].questionText).toBe('What is your name?');
    });

    it('should return existing responses when user has answered questions', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({
        id: mockChatbotId,
        title: 'Test Chatbot',
        type: 'FRAMEWORK',
        creator: { name: 'Creator' },
        sources: [],
      });
      (prisma.chatbot_Intake_Question.findMany as jest.Mock).mockResolvedValue([
        {
          displayOrder: 1,
          isRequired: true,
          intakeQuestionId: 'q1',
          intakeQuestion: {
            id: 'q1',
            questionText: 'What is your name?',
            helperText: null,
            responseType: 'TEXT',
            options: null,
          },
        },
      ]);
      (prisma.intake_Response.findMany as jest.Mock).mockResolvedValue([
        {
          intakeQuestionId: 'q1',
          value: 'John Doe',
        },
      ]);

      const request = new Request(`http://localhost/api/chatbots/${mockChatbotId}/welcome`);
      const response = await GET(request, { params: Promise.resolve({ chatbotId: mockChatbotId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.intakeCompleted).toBe(true);
      expect(data.existingResponses).toBeDefined();
      expect(data.existingResponses.q1).toBe('John Doe');
    });

    it('should handle anonymous users (not authenticated)', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: null });
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({
        id: mockChatbotId,
        title: 'Test Chatbot',
        type: 'FRAMEWORK',
        creator: { name: 'Creator' },
        sources: [],
      });
      (prisma.chatbot_Intake_Question.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request(`http://localhost/api/chatbots/${mockChatbotId}/welcome`);
      const response = await GET(request, { params: Promise.resolve({ chatbotId: mockChatbotId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.intakeCompleted).toBe(false);
      expect(data.existingResponses).toBeUndefined();
    });

    it('should return 500 on database error', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.chatbot.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new Request(`http://localhost/api/chatbots/${mockChatbotId}/welcome`);
      const response = await GET(request, { params: Promise.resolve({ chatbotId: mockChatbotId }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch chatbot welcome data');
    });
  });
});

