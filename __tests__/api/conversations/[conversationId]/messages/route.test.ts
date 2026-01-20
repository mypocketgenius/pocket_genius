// __tests__/api/conversations/[conversationId]/messages/route.test.ts
// Task 6: Integration tests for conversation messages POST endpoint
// Tests conversation creation with chatbotVersionId (Subtask 6.10)

import { POST } from '@/app/api/conversations/[conversationId]/messages/route';
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
    message: {
      create: jest.fn(),
    },
  },
}));

// Mock Clerk auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

describe('POST /api/conversations/[conversationId]/messages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockClerkUserId = 'clerk-user-123';
  const mockUserId = 'user-123';
  const mockConversationId = 'conv-123';

  it('should return 400 if conversationId is missing', async () => {
    const request = new Request('http://localhost/api/conversations//messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'user', content: 'Test message' }),
    });

    const response = await POST(request, { params: Promise.resolve({ conversationId: '' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Conversation ID is required');
  });

  it('should return 401 if user is not authenticated', async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: null });

    const request = new Request(`http://localhost/api/conversations/${mockConversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'user', content: 'Test message' }),
    });

    const response = await POST(request, { params: Promise.resolve({ conversationId: mockConversationId }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  it('should return 404 if user not found', async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new Request(`http://localhost/api/conversations/${mockConversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'user', content: 'Test message' }),
    });

    const response = await POST(request, { params: Promise.resolve({ conversationId: mockConversationId }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('User not found');
  });

  it('should return 400 if role is missing', async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });

    const request = new Request(`http://localhost/api/conversations/${mockConversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Test message' }),
    });

    const response = await POST(request, { params: Promise.resolve({ conversationId: mockConversationId }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing required fields: role and content are required');
  });

  it('should return 400 if content is missing', async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });

    const request = new Request(`http://localhost/api/conversations/${mockConversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'user' }),
    });

    const response = await POST(request, { params: Promise.resolve({ conversationId: mockConversationId }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing required fields: role and content are required');
  });

  it('should return 400 if role is invalid', async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });

    const request = new Request(`http://localhost/api/conversations/${mockConversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'invalid', content: 'Test message' }),
    });

    const response = await POST(request, { params: Promise.resolve({ conversationId: mockConversationId }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid role: must be "user" or "assistant"');
  });

  it('should return 404 if conversation not found', async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
    (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new Request(`http://localhost/api/conversations/${mockConversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'user', content: 'Test message' }),
    });

    const response = await POST(request, { params: Promise.resolve({ conversationId: mockConversationId }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Conversation not found');
  });

  it('should return 403 if conversation does not belong to user', async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
    (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
      id: mockConversationId,
      userId: 'other-user-id',
    });

    const request = new Request(`http://localhost/api/conversations/${mockConversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'user', content: 'Test message' }),
    });

    const response = await POST(request, { params: Promise.resolve({ conversationId: mockConversationId }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Unauthorized: Conversation does not belong to user');
  });

  it('should create user message successfully', async () => {
    const mockMessage = {
      id: 'msg-123',
      conversationId: mockConversationId,
      userId: mockUserId,
      role: 'user',
      content: 'Test message',
      context: null,
      followUpPills: [],
      sourceIds: [],
      createdAt: new Date('2024-01-01T00:00:00Z'),
    };

    (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
    (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
      id: mockConversationId,
      userId: mockUserId,
    });
    (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);
    (prisma.conversation.update as jest.Mock).mockResolvedValue({});

    const request = new Request(`http://localhost/api/conversations/${mockConversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'user', content: 'Test message' }),
    });

    const response = await POST(request, { params: Promise.resolve({ conversationId: mockConversationId }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBeDefined();
    expect(data.message.id).toBe('msg-123');
    expect(data.message.role).toBe('user');
    expect(data.message.content).toBe('Test message');
    expect(data.message.userId).toBe(mockUserId);
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: {
        conversationId: mockConversationId,
        userId: mockUserId,
        role: 'user',
        content: 'Test message',
        context: null,
        followUpPills: [],
        sourceIds: [],
      },
    });
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: mockConversationId },
      data: {
        messageCount: { increment: 1 },
        updatedAt: expect.any(Date),
      },
    });
  });

  it('should create assistant message with null userId', async () => {
    const mockMessage = {
      id: 'msg-123',
      conversationId: mockConversationId,
      userId: null,
      role: 'assistant',
      content: 'Assistant message',
      context: null,
      followUpPills: [],
      sourceIds: [],
      createdAt: new Date('2024-01-01T00:00:00Z'),
    };

    (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
    (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
      id: mockConversationId,
      userId: mockUserId,
    });
    (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);
    (prisma.conversation.update as jest.Mock).mockResolvedValue({});

    const request = new Request(`http://localhost/api/conversations/${mockConversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'assistant', content: 'Assistant message' }),
    });

    const response = await POST(request, { params: Promise.resolve({ conversationId: mockConversationId }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message.role).toBe('assistant');
    expect(data.message.userId).toBeNull();
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: {
        conversationId: mockConversationId,
        userId: null, // Assistant messages have null userId
        role: 'assistant',
        content: 'Assistant message',
        context: null,
        followUpPills: [],
        sourceIds: [],
      },
    });
  });

  it('should return 500 on database error', async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
    (prisma.conversation.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

    const request = new Request(`http://localhost/api/conversations/${mockConversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'user', content: 'Test message' }),
    });

    const response = await POST(request, { params: Promise.resolve({ conversationId: mockConversationId }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});


