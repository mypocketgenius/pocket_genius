// __tests__/api/intake/questions/[questionId]/chatbots/route.test.ts
// Phase 3.10: Unit tests for Intake Questions Association API route
// Tests POST, DELETE, and PATCH endpoints for associating questions with chatbots

import { POST, DELETE, PATCH } from '@/app/api/intake/questions/[questionId]/chatbots/route';
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
      findMany: jest.fn(),
    },
    intake_Question: {
      findUnique: jest.fn(),
    },
    chatbot_Intake_Question: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock Clerk auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

describe('Intake Questions Association API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockClerkUserId = 'clerk-user-123';
  const mockUserId = 'user-123';
  const mockQuestionId = 'question-123';
  const mockChatbotId = 'chatbot-123';
  const mockChatbotId2 = 'chatbot-456';
  const mockCreatorId = 'creator-123';

  const mockQuestion = {
    id: mockQuestionId,
    slug: 'industry',
    questionText: 'What industry are you in?',
  };

  const mockChatbot = {
    id: mockChatbotId,
    title: 'Test Chatbot',
    creatorId: mockCreatorId,
    creator: {
      users: [{ id: 'creator-user-1', userId: mockUserId }],
    },
  };

  const mockAssociation = {
    id: 'association-123',
    chatbotId: mockChatbotId,
    intakeQuestionId: mockQuestionId,
    displayOrder: 1,
    isRequired: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  describe('POST /api/intake/questions/[questionId]/chatbots', () => {
    const mockRequestBody = {
      chatbotAssociations: [
        {
          chatbotId: mockChatbotId,
          displayOrder: 1,
          isRequired: true,
        },
      ],
    };

    it('should return 401 if user is not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: null });

      const request = new Request('http://localhost/api/intake/questions/q1/chatbots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await POST(request, { params: Promise.resolve({ questionId: mockQuestionId }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('should return 404 if question not found', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/intake/questions/q1/chatbots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await POST(request, { params: Promise.resolve({ questionId: mockQuestionId }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Question not found');
    });

    it('should return 400 if chatbotAssociations is missing or empty', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findUnique as jest.Mock).mockResolvedValue(mockQuestion);

      const request = new Request('http://localhost/api/intake/questions/q1/chatbots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatbotAssociations: [] }),
      });
      const response = await POST(request, { params: Promise.resolve({ questionId: mockQuestionId }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('chatbotAssociations');
    });

    it('should return 404 if chatbot not found', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findUnique as jest.Mock).mockResolvedValue(mockQuestion);
      (prisma.chatbot.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request('http://localhost/api/intake/questions/q1/chatbots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await POST(request, { params: Promise.resolve({ questionId: mockQuestionId }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Chatbots not found');
    });

    it('should return 403 if user is not a member of Creator', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findUnique as jest.Mock).mockResolvedValue(mockQuestion);
      (prisma.chatbot.findMany as jest.Mock).mockResolvedValue([
        {
          ...mockChatbot,
          creator: { users: [] }, // No users
        },
      ]);

      const request = new Request('http://localhost/api/intake/questions/q1/chatbots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await POST(request, { params: Promise.resolve({ questionId: mockQuestionId }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Unauthorized');
    });

    it('should create association successfully', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findUnique as jest.Mock).mockResolvedValue(mockQuestion);
      (prisma.chatbot.findMany as jest.Mock).mockResolvedValue([mockChatbot]);
      (prisma.chatbot_Intake_Question.create as jest.Mock).mockResolvedValue(mockAssociation);

      const request = new Request('http://localhost/api/intake/questions/q1/chatbots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await POST(request, { params: Promise.resolve({ questionId: mockQuestionId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.associations).toHaveLength(1);
      expect(data.associations[0]).toMatchObject({
        id: mockAssociation.id,
        chatbotId: mockChatbotId,
        intakeQuestionId: mockQuestionId,
        displayOrder: 1,
        isRequired: true,
      });
    });

    it('should create multiple associations in single request', async () => {
      const mockChatbot2 = {
        ...mockChatbot,
        id: mockChatbotId2,
        creator: {
          users: [{ id: 'creator-user-2', userId: mockUserId }],
        },
      };
      const mockAssociation2 = {
        ...mockAssociation,
        id: 'association-456',
        chatbotId: mockChatbotId2,
        displayOrder: 2,
      };

      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findUnique as jest.Mock).mockResolvedValue(mockQuestion);
      (prisma.chatbot.findMany as jest.Mock).mockResolvedValue([mockChatbot, mockChatbot2]);
      (prisma.chatbot_Intake_Question.create as jest.Mock)
        .mockResolvedValueOnce(mockAssociation)
        .mockResolvedValueOnce(mockAssociation2);

      const multiBody = {
        chatbotAssociations: [
          { chatbotId: mockChatbotId, displayOrder: 1, isRequired: true },
          { chatbotId: mockChatbotId2, displayOrder: 2, isRequired: false },
        ],
      };

      const request = new Request('http://localhost/api/intake/questions/q1/chatbots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(multiBody),
      });
      const response = await POST(request, { params: Promise.resolve({ questionId: mockQuestionId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.associations).toHaveLength(2);
      expect(prisma.chatbot_Intake_Question.create).toHaveBeenCalledTimes(2);
    });

    it('should return 409 if association already exists', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findUnique as jest.Mock).mockResolvedValue(mockQuestion);
      (prisma.chatbot.findMany as jest.Mock).mockResolvedValue([mockChatbot]);
      (prisma.chatbot_Intake_Question.create as jest.Mock).mockRejectedValue(
        new Error('Unique constraint failed')
      );

      const request = new Request('http://localhost/api/intake/questions/q1/chatbots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await POST(request, { params: Promise.resolve({ questionId: mockQuestionId }) });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('Association already exists');
    });
  });

  describe('DELETE /api/intake/questions/[questionId]/chatbots', () => {
    const mockRequestBody = {
      chatbotId: mockChatbotId,
    };

    it('should return 401 if user is not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: null });

      const request = new Request('http://localhost/api/intake/questions/q1/chatbots', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await DELETE(request, { params: Promise.resolve({ questionId: mockQuestionId }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('should return 404 if question not found', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/intake/questions/q1/chatbots', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await DELETE(request, { params: Promise.resolve({ questionId: mockQuestionId }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Question not found');
    });

    it('should return 400 if chatbotId is missing', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findUnique as jest.Mock).mockResolvedValue(mockQuestion);

      const request = new Request('http://localhost/api/intake/questions/q1/chatbots', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const response = await DELETE(request, { params: Promise.resolve({ questionId: mockQuestionId }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('chatbotId is required');
    });

    it('should return 404 if chatbot not found', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findUnique as jest.Mock).mockResolvedValue(mockQuestion);
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/intake/questions/q1/chatbots', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await DELETE(request, { params: Promise.resolve({ questionId: mockQuestionId }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Chatbot not found');
    });

    it('should return 404 if association not found', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findUnique as jest.Mock).mockResolvedValue(mockQuestion);
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.chatbot_Intake_Question.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/intake/questions/q1/chatbots', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await DELETE(request, { params: Promise.resolve({ questionId: mockQuestionId }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Association not found');
    });

    it('should remove association successfully', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findUnique as jest.Mock).mockResolvedValue(mockQuestion);
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.chatbot_Intake_Question.findUnique as jest.Mock).mockResolvedValue(mockAssociation);
      (prisma.chatbot_Intake_Question.delete as jest.Mock).mockResolvedValue(mockAssociation);

      const request = new Request('http://localhost/api/intake/questions/q1/chatbots', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await DELETE(request, { params: Promise.resolve({ questionId: mockQuestionId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Association removed successfully');
      expect(prisma.chatbot_Intake_Question.delete).toHaveBeenCalledWith({
        where: { id: mockAssociation.id },
      });
    });
  });

  describe('PATCH /api/intake/questions/[questionId]/chatbots', () => {
    const mockRequestBody = {
      chatbotId: mockChatbotId,
      displayOrder: 2,
      isRequired: false,
    };

    it('should return 401 if user is not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: null });

      const request = new Request('http://localhost/api/intake/questions/q1/chatbots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await PATCH(request, { params: Promise.resolve({ questionId: mockQuestionId }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('should return 400 if neither displayOrder nor isRequired provided', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findUnique as jest.Mock).mockResolvedValue(mockQuestion);

      const request = new Request('http://localhost/api/intake/questions/q1/chatbots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatbotId: mockChatbotId }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ questionId: mockQuestionId }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('At least one of displayOrder or isRequired');
    });

    it('should update displayOrder successfully', async () => {
      const updatedAssociation = {
        ...mockAssociation,
        displayOrder: 2,
        updatedAt: new Date('2024-01-02'),
      };

      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findUnique as jest.Mock).mockResolvedValue(mockQuestion);
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.chatbot_Intake_Question.findUnique as jest.Mock).mockResolvedValue(mockAssociation);
      (prisma.chatbot_Intake_Question.update as jest.Mock).mockResolvedValue(updatedAssociation);

      const request = new Request('http://localhost/api/intake/questions/q1/chatbots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatbotId: mockChatbotId, displayOrder: 2 }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ questionId: mockQuestionId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.association.displayOrder).toBe(2);
      expect(prisma.chatbot_Intake_Question.update).toHaveBeenCalledWith({
        where: { id: mockAssociation.id },
        data: { displayOrder: 2 },
      });
    });

    it('should update isRequired successfully', async () => {
      const updatedAssociation = {
        ...mockAssociation,
        isRequired: false,
        updatedAt: new Date('2024-01-02'),
      };

      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findUnique as jest.Mock).mockResolvedValue(mockQuestion);
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.chatbot_Intake_Question.findUnique as jest.Mock).mockResolvedValue(mockAssociation);
      (prisma.chatbot_Intake_Question.update as jest.Mock).mockResolvedValue(updatedAssociation);

      const request = new Request('http://localhost/api/intake/questions/q1/chatbots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatbotId: mockChatbotId, isRequired: false }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ questionId: mockQuestionId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.association.isRequired).toBe(false);
      expect(prisma.chatbot_Intake_Question.update).toHaveBeenCalledWith({
        where: { id: mockAssociation.id },
        data: { isRequired: false },
      });
    });

    it('should update both displayOrder and isRequired successfully', async () => {
      const updatedAssociation = {
        ...mockAssociation,
        displayOrder: 3,
        isRequired: false,
        updatedAt: new Date('2024-01-02'),
      };

      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.intake_Question.findUnique as jest.Mock).mockResolvedValue(mockQuestion);
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.chatbot_Intake_Question.findUnique as jest.Mock).mockResolvedValue(mockAssociation);
      (prisma.chatbot_Intake_Question.update as jest.Mock).mockResolvedValue(updatedAssociation);

      const request = new Request('http://localhost/api/intake/questions/q1/chatbots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRequestBody),
      });
      const response = await PATCH(request, { params: Promise.resolve({ questionId: mockQuestionId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.association.displayOrder).toBe(3);
      expect(data.association.isRequired).toBe(false);
      expect(prisma.chatbot_Intake_Question.update).toHaveBeenCalledWith({
        where: { id: mockAssociation.id },
        data: { displayOrder: 2, isRequired: false },
      });
    });
  });
});

