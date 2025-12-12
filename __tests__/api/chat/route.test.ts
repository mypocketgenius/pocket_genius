// __tests__/api/chat/route.test.ts
// Integration tests for chat API route

import { POST } from '@/app/api/chat/route';
import { prisma } from '@/lib/prisma';
import { queryRAG } from '@/lib/rag/query';
import { checkRateLimit } from '@/lib/rate-limit';
import OpenAI from 'openai';

// Mock all dependencies
jest.mock('@/lib/prisma');
jest.mock('@/lib/rag/query');
jest.mock('@/lib/rate-limit');
jest.mock('openai');

describe('POST /api/chat', () => {
  const mockUserId = 'user-123';
  const mockDbUserId = 'db-user-123';
  const mockChatbotId = 'chatbot_art_of_war';
  const mockConversationId = 'conv-123';

  const mockRetrievedChunks = [
    {
      chunkId: 'chunk-1',
      sourceId: 'source-1',
      text: 'Test chunk text',
      page: 1,
      relevanceScore: 0.95,
    },
  ];

  const mockOpenAIStream = {
    [Symbol.asyncIterator]: async function* () {
      yield { choices: [{ delta: { content: 'Test response' } }] };
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Prisma
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockDbUserId });
    (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({
      id: mockChatbotId,
      title: 'Test Chatbot',
    });
    (prisma.conversation.create as jest.Mock).mockResolvedValue({
      id: mockConversationId,
      chatbotId: mockChatbotId,
    });
    (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.message.create as jest.Mock).mockResolvedValue({ id: 'msg-123' });
    (prisma.conversation.update as jest.Mock).mockResolvedValue({});
    (prisma.chunk_Performance.upsert as jest.Mock).mockResolvedValue({});

    // Mock RAG query
    (queryRAG as jest.Mock).mockResolvedValue(mockRetrievedChunks);

    // Mock rate limiting
    (checkRateLimit as jest.Mock).mockResolvedValue(true);

    // Mock OpenAI
    const mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue(mockOpenAIStream),
        },
      },
    };
    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockOpenAI as any);
  });

  it('should create conversation and store messages with context', async () => {
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Test message' }],
        chatbotId: mockChatbotId,
      }),
    });

    // Mock auth to return userId
    jest.spyOn(require('@clerk/nextjs/server'), 'auth').mockResolvedValue({
      userId: mockUserId,
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(prisma.conversation.create).toHaveBeenCalled();
    expect(queryRAG).toHaveBeenCalledWith({
      query: 'Test message',
      namespace: `chatbot-${mockChatbotId}`,
      topK: 5,
    });
    expect(prisma.message.create).toHaveBeenCalledTimes(2); // User + assistant
  });

  it('should check rate limit for authenticated users', async () => {
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Test' }],
        chatbotId: mockChatbotId,
      }),
    });

    jest.spyOn(require('@clerk/nextjs/server'), 'auth').mockResolvedValue({
      userId: mockUserId,
    });

    await POST(request);

    expect(checkRateLimit).toHaveBeenCalledWith(mockDbUserId);
  });

  it('should return 429 when rate limit exceeded', async () => {
    (checkRateLimit as jest.Mock).mockResolvedValue(false);

    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Test' }],
        chatbotId: mockChatbotId,
      }),
    });

    jest.spyOn(require('@clerk/nextjs/server'), 'auth').mockResolvedValue({
      userId: mockUserId,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain('Rate limit exceeded');
  });

  it('should store chunks in message context', async () => {
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Test' }],
        chatbotId: mockChatbotId,
      }),
    });

    jest.spyOn(require('@clerk/nextjs/server'), 'auth').mockResolvedValue({
      userId: mockUserId,
    });

    await POST(request);

    // Check that assistant message was created with context
    const assistantMessageCall = (prisma.message.create as jest.Mock).mock.calls.find(
      (call) => call[0].data.role === 'assistant'
    );

    expect(assistantMessageCall).toBeDefined();
    expect(assistantMessageCall[0].data.context).toEqual({
      chunks: expect.arrayContaining([
        expect.objectContaining({
          chunkId: 'chunk-1',
          sourceId: 'source-1',
          text: 'Test chunk text',
        }),
      ]),
    });
    expect(assistantMessageCall[0].data.sourceIds).toEqual(['source-1']);
  });

  it('should update chunk performance counters', async () => {
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Test' }],
        chatbotId: mockChatbotId,
      }),
    });

    jest.spyOn(require('@clerk/nextjs/server'), 'auth').mockResolvedValue({
      userId: mockUserId,
    });

    await POST(request);

    expect(prisma.chunk_Performance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          chunkId_chatbotId_month_year: {
            chunkId: 'chunk-1',
            chatbotId: mockChatbotId,
            month: expect.any(Number),
            year: expect.any(Number),
          },
        },
        create: expect.objectContaining({
          timesUsed: 1,
        }),
        update: {
          timesUsed: { increment: 1 },
        },
      })
    );
  });

  it('should return 404 for non-existent chatbot', async () => {
    (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Test' }],
        chatbotId: 'invalid-chatbot',
      }),
    });

    jest.spyOn(require('@clerk/nextjs/server'), 'auth').mockResolvedValue({
      userId: mockUserId,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Chatbot not found');
  });

  it('should validate required fields', async () => {
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [],
        chatbotId: mockChatbotId,
      }),
    });

    jest.spyOn(require('@clerk/nextjs/server'), 'auth').mockResolvedValue({
      userId: mockUserId,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Messages');
  });
});
