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
      upsert: jest.fn(),
    },
    message: {
      createMany: jest.fn(),
    },
    intake_Question: {
      findMany: jest.fn(),
    },
    chatbot_Intake_Question: {
      findMany: jest.fn(),
    },
    user_Context: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
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

  describe('Batch Intake (Issues 1+3)', () => {
    const setupAuthAndConversation = () => {
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
        sources: [],
      });
      (prisma.intake_Response.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);
    };

    it('should batch-create messages and responses in transaction', async () => {
      setupAuthAndConversation();
      (prisma.intake_Question.findMany as jest.Mock).mockResolvedValue([
        { id: 'q1', slug: 'user_name' },
      ]);
      (prisma.chatbot_Intake_Question.findMany as jest.Mock).mockResolvedValue([
        { intakeQuestionId: 'q1' },
      ]);

      const request = new Request(`http://localhost/api/conversations/${mockConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intakeCompleted: true,
          messages: [
            { role: 'assistant', content: 'What is your name?', createdAt: '2024-01-15T10:00:00.000Z' },
            { role: 'user', content: 'John', createdAt: '2024-01-15T10:00:01.000Z' },
            { role: 'assistant', content: 'Thank you.', createdAt: '2024-01-15T10:00:02.000Z' },
          ],
          responses: [
            { intakeQuestionId: 'q1', value: 'John' },
          ],
        }),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ conversationId: mockConversationId }),
      });

      expect(response.status).toBe(200);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // Transaction should contain: createMany + increment + upsert response + upsert context
      const txOps = (prisma.$transaction as jest.Mock).mock.calls[0][0];
      expect(txOps.length).toBe(4); // createMany, increment, response upsert, context upsert
    });

    it('should handle messages-only batch (no responses)', async () => {
      setupAuthAndConversation();

      const request = new Request(`http://localhost/api/conversations/${mockConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intakeCompleted: true,
          messages: [
            { role: 'assistant', content: 'Welcome!', createdAt: '2024-01-15T10:00:00.000Z' },
          ],
          responses: [],
        }),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ conversationId: mockConversationId }),
      });

      expect(response.status).toBe(200);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const txOps = (prisma.$transaction as jest.Mock).mock.calls[0][0];
      expect(txOps.length).toBe(2); // createMany + increment only
    });

    it('should handle responses-only batch (no messages)', async () => {
      setupAuthAndConversation();
      (prisma.intake_Question.findMany as jest.Mock).mockResolvedValue([
        { id: 'q1', slug: 'user_name' },
      ]);
      (prisma.chatbot_Intake_Question.findMany as jest.Mock).mockResolvedValue([
        { intakeQuestionId: 'q1' },
      ]);

      const request = new Request(`http://localhost/api/conversations/${mockConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intakeCompleted: true,
          messages: [],
          responses: [
            { intakeQuestionId: 'q1', value: 'John' },
          ],
        }),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ conversationId: mockConversationId }),
      });

      expect(response.status).toBe(200);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const txOps = (prisma.$transaction as jest.Mock).mock.calls[0][0];
      expect(txOps.length).toBe(2); // response upsert + context upsert
    });

    it('should validate message roles', async () => {
      setupAuthAndConversation();

      const request = new Request(`http://localhost/api/conversations/${mockConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intakeCompleted: true,
          messages: [
            { role: 'system', content: 'Invalid role', createdAt: '2024-01-15T10:00:00.000Z' },
            { role: 'assistant', content: 'Valid message', createdAt: '2024-01-15T10:00:01.000Z' },
          ],
          responses: [],
        }),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ conversationId: mockConversationId }),
      });

      expect(response.status).toBe(200);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // Should only include the valid message in createMany
      const txOps = (prisma.$transaction as jest.Mock).mock.calls[0][0];
      expect(txOps.length).toBe(2); // createMany (1 valid msg) + increment
    });

    it('should skip responses for invalid question-chatbot associations', async () => {
      setupAuthAndConversation();
      (prisma.intake_Question.findMany as jest.Mock).mockResolvedValue([
        { id: 'q1', slug: 'user_name' },
      ]);
      // q-invalid is NOT associated with this chatbot
      (prisma.chatbot_Intake_Question.findMany as jest.Mock).mockResolvedValue([
        { intakeQuestionId: 'q1' },
      ]);

      const request = new Request(`http://localhost/api/conversations/${mockConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intakeCompleted: true,
          messages: [],
          responses: [
            { intakeQuestionId: 'q1', value: 'John' },
            { intakeQuestionId: 'q-invalid', value: 'Should be skipped' },
          ],
        }),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ conversationId: mockConversationId }),
      });

      expect(response.status).toBe(200);
      const txOps = (prisma.$transaction as jest.Mock).mock.calls[0][0];
      // Only q1 should have upserts (response + context), q-invalid skipped
      expect(txOps.length).toBe(2); // response upsert + context upsert for q1 only
    });

    it('should skip response processing for anonymous users', async () => {
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
        body: JSON.stringify({
          intakeCompleted: true,
          messages: [
            { role: 'assistant', content: 'Welcome!', createdAt: '2024-01-15T10:00:00.000Z' },
          ],
          responses: [
            { intakeQuestionId: 'q1', value: 'John' },
          ],
        }),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ conversationId: mockConversationId }),
      });

      expect(response.status).toBe(200);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // Only messages should be in transaction, no response upserts (dbUserId is null)
      const txOps = (prisma.$transaction as jest.Mock).mock.calls[0][0];
      expect(txOps.length).toBe(2); // createMany + increment only
    });

    it('should return 200 with empty message/response arrays', async () => {
      setupAuthAndConversation();

      const request = new Request(`http://localhost/api/conversations/${mockConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intakeCompleted: true,
          messages: [],
          responses: [],
        }),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ conversationId: mockConversationId }),
      });

      expect(response.status).toBe(200);
      // No transaction needed for empty arrays
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should preserve message ordering via createdAt', async () => {
      setupAuthAndConversation();

      const timestamps = [
        '2024-01-15T10:00:00.000Z',
        '2024-01-15T10:00:01.000Z',
        '2024-01-15T10:00:02.000Z',
      ];

      const request = new Request(`http://localhost/api/conversations/${mockConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intakeCompleted: true,
          messages: [
            { role: 'assistant', content: 'Question 1', createdAt: timestamps[0] },
            { role: 'user', content: 'Answer 1', createdAt: timestamps[1] },
            { role: 'assistant', content: 'Thank you.', createdAt: timestamps[2] },
          ],
          responses: [],
        }),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ conversationId: mockConversationId }),
      });

      expect(response.status).toBe(200);
      // Verify createMany was called with explicit timestamps
      const txOps = (prisma.$transaction as jest.Mock).mock.calls[0][0];
      // txOps[0] is the createMany promise — we can verify it was called
      expect(prisma.message.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ createdAt: new Date(timestamps[0]) }),
          expect.objectContaining({ createdAt: new Date(timestamps[1]) }),
          expect.objectContaining({ createdAt: new Date(timestamps[2]) }),
        ]),
      });
    });

    it('should return 500 on transaction failure', async () => {
      setupAuthAndConversation();
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('Transaction failed'));

      const request = new Request(`http://localhost/api/conversations/${mockConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intakeCompleted: true,
          messages: [
            { role: 'assistant', content: 'Hello', createdAt: '2024-01-15T10:00:00.000Z' },
          ],
          responses: [],
        }),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ conversationId: mockConversationId }),
      });

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Internal server error' });
    });
  });
});
