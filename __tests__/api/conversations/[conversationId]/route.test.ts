// __tests__/api/conversations/[conversationId]/route.test.ts
// Step 6: Integration tests for conversation PATCH endpoint
// Tests marking intake as complete for a conversation

// Mock environment variables first (before importing routes that use env)
jest.mock('@/lib/env', () => ({
  env: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    OPENAI_API_KEY: 'test-openai-key',
    PINECONE_API_KEY: 'test-pinecone-key',
    PINECONE_INDEX: 'test-index',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'test-clerk-pub-key',
    CLERK_SECRET_KEY: 'test-clerk-secret',
    BLOB_READ_WRITE_TOKEN: 'test-blob-token',
    NEXT_PUBLIC_URL: 'http://localhost:3000',
    NODE_ENV: 'test',
  },
}));

// Mock pill generation to avoid OpenAI dependency
jest.mock('@/lib/pills/generate-suggestion-pills', () => ({
  generateSuggestionPills: jest.fn().mockResolvedValue({
    pills: ['Suggestion 1', 'Suggestion 2'],
    generationTimeMs: 100,
    error: null,
  }),
}));

import { PATCH } from '@/app/api/conversations/[conversationId]/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    conversation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    chatbot: {
      findUnique: jest.fn(),
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

describe('Conversation API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockClerkUserId = 'clerk-user-123';
  const mockUserId = 'user-123';
  const mockConversationId = 'conv-123';

  describe('PATCH /api/conversations/[conversationId]', () => {
    it('should mark conversation as intake completed', async () => {
      const mockDate = new Date('2024-01-15T10:00:00.000Z');
      jest.useFakeTimers().setSystemTime(mockDate);

      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
        userId: mockUserId,
        chatbotId: 'bot-123',
      });
      (prisma.conversation.update as jest.Mock).mockResolvedValue({
        id: mockConversationId,
        intakeCompleted: true,
        intakeCompletedAt: mockDate,
      });
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({
        id: 'bot-123',
        title: 'Test Bot',
        description: 'A test chatbot',
        type: null,
        configJson: null,
        fallbackSuggestionPills: [],
        creator: { name: 'Test Creator' },
        sources: [],
      });
      (prisma.intake_Response.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request(`http://localhost/api/conversations/${mockConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeCompleted: true }),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ conversationId: mockConversationId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.conversation.intakeCompleted).toBe(true);
      expect(data.conversation.intakeCompletedAt).toBe('2024-01-15T10:00:00.000Z');
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: mockConversationId },
        data: {
          intakeCompleted: true,
          intakeCompletedAt: mockDate,
        },
        select: {
          id: true,
          intakeCompleted: true,
          intakeCompletedAt: true,
        },
      });

      jest.useRealTimers();
    });

    it('should allow anonymous user to update anonymous conversation', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: null });
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
        userId: null, // Anonymous conversation
        chatbotId: 'bot-123',
      });
      (prisma.conversation.update as jest.Mock).mockResolvedValue({
        id: mockConversationId,
        intakeCompleted: true,
        intakeCompletedAt: new Date(),
      });

      const request = new Request(`http://localhost/api/conversations/${mockConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeCompleted: true }),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ conversationId: mockConversationId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.conversation.intakeCompleted).toBe(true);
    });

    it('should return 404 when conversation not found', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request(`http://localhost/api/conversations/${mockConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeCompleted: true }),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ conversationId: 'nonexistent' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Conversation not found');
    });

    it('should return 403 when user does not own conversation', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
        userId: 'other-user-id', // Different user owns this conversation
        chatbotId: 'bot-123',
      });

      const request = new Request(`http://localhost/api/conversations/${mockConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeCompleted: true }),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ conversationId: mockConversationId }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when no valid fields to update', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
        userId: mockUserId,
        chatbotId: 'bot-123',
      });

      const request = new Request(`http://localhost/api/conversations/${mockConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ someOtherField: 'value' }),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ conversationId: mockConversationId }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No valid fields to update');
    });

    it('should not set intakeCompletedAt when intakeCompleted is false', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
        userId: mockUserId,
        chatbotId: 'bot-123',
      });
      (prisma.conversation.update as jest.Mock).mockResolvedValue({
        id: mockConversationId,
        intakeCompleted: false,
        intakeCompletedAt: null,
      });

      const request = new Request(`http://localhost/api/conversations/${mockConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeCompleted: false }),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ conversationId: mockConversationId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: mockConversationId },
        data: {
          intakeCompleted: false,
          // No intakeCompletedAt
        },
        select: {
          id: true,
          intakeCompleted: true,
          intakeCompletedAt: true,
        },
      });
    });

    it('should return 500 on database error', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.conversation.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new Request(`http://localhost/api/conversations/${mockConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeCompleted: true }),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ conversationId: mockConversationId }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should generate suggestion pills when intake completed by authenticated user', async () => {
      const { generateSuggestionPills } = require('@/lib/pills/generate-suggestion-pills');

      (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
        userId: mockUserId,
        chatbotId: 'bot-123',
      });
      (prisma.conversation.update as jest.Mock).mockResolvedValue({
        id: mockConversationId,
        intakeCompleted: true,
        intakeCompletedAt: new Date(),
      });
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({
        id: 'bot-123',
        title: 'Test Bot',
        description: 'A test chatbot',
        type: null,
        configJson: null,
        fallbackSuggestionPills: [],
        creator: { name: 'Test Creator' },
        sources: [{ source: { title: 'Source 1' } }],
      });
      (prisma.intake_Response.findMany as jest.Mock).mockResolvedValue([
        {
          intakeQuestionId: 'q1',
          value: 'Test answer',
          intakeQuestion: { id: 'q1', questionText: 'What is your name?' },
        },
      ]);

      const request = new Request(`http://localhost/api/conversations/${mockConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeCompleted: true }),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ conversationId: mockConversationId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.suggestionPills).toEqual(['Suggestion 1', 'Suggestion 2']);
      expect(generateSuggestionPills).toHaveBeenCalledWith(
        expect.objectContaining({
          chatbot: expect.objectContaining({ id: 'bot-123' }),
          intake: expect.objectContaining({
            responses: { q1: 'Test answer' },
          }),
        })
      );
    });

    it('should not generate pills for anonymous users', async () => {
      const { generateSuggestionPills } = require('@/lib/pills/generate-suggestion-pills');

      (auth as jest.Mock).mockResolvedValue({ userId: null });
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
        userId: null,
        chatbotId: 'bot-123',
      });
      (prisma.conversation.update as jest.Mock).mockResolvedValue({
        id: mockConversationId,
        intakeCompleted: true,
        intakeCompletedAt: new Date(),
      });

      const request = new Request(`http://localhost/api/conversations/${mockConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeCompleted: true }),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ conversationId: mockConversationId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.suggestionPills).toBeUndefined();
      expect(generateSuggestionPills).not.toHaveBeenCalled();
    });
  });
});
