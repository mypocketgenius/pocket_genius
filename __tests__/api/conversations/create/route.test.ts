// __tests__/api/conversations/create/route.test.ts
// Task 6: Integration tests for conversation creation endpoint
// Tests conversation creation with chatbotVersionId (Subtask 6.10)

import { POST } from '@/app/api/conversations/create/route';
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
    chatbot_Version: {
      findMany: jest.fn(),
    },
    conversation: {
      create: jest.fn(),
    },
  },
}));

// Mock Clerk auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

// Mock versioning utility
jest.mock('@/lib/chatbot/versioning', () => ({
  createChatbotVersion: jest.fn(),
}));

describe('POST /api/conversations/create', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockClerkUserId = 'clerk-user-123';
  const mockUserId = 'user-123';
  const mockChatbotId = 'chatbot-123';
  const mockVersionId = 'version-123';

  it('should return 401 if user is not authenticated', async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: null });

    const request = new Request('http://localhost/api/conversations/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatbotId: mockChatbotId }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  it('should return 404 if user not found', async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new Request('http://localhost/api/conversations/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatbotId: mockChatbotId }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('User not found');
  });

  it('should return 400 if chatbotId is missing', async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });

    const request = new Request('http://localhost/api/conversations/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing required field: chatbotId');
  });

  it('should return 404 if chatbot not found', async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
    (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new Request('http://localhost/api/conversations/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatbotId: mockChatbotId }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Chatbot not found');
  });

  it('should create conversation with currentVersionId', async () => {
    const mockConversation = {
      id: 'conv-123',
      chatbotId: mockChatbotId,
      chatbotVersionId: mockVersionId,
      userId: mockUserId,
      status: 'active' as const,
      messageCount: 0,
      createdAt: new Date('2024-01-01T00:00:00Z'),
    };

    (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
    (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({
      id: mockChatbotId,
      currentVersionId: mockVersionId,
      creator: {
        users: [{ userId: 'creator-user-id' }],
      },
    });
    (prisma.conversation.create as jest.Mock).mockResolvedValue(mockConversation);

    const request = new Request('http://localhost/api/conversations/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatbotId: mockChatbotId }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.conversation).toBeDefined();
    expect(data.conversation.chatbotVersionId).toBe(mockVersionId);
    expect(prisma.conversation.create).toHaveBeenCalledWith({
      data: {
        chatbotId: mockChatbotId,
        chatbotVersionId: mockVersionId,
        userId: mockUserId,
        status: 'active',
        messageCount: 0,
      },
    });
  });

  it('should create conversation with first version when currentVersionId is null', async () => {
    const mockConversation = {
      id: 'conv-123',
      chatbotId: mockChatbotId,
      chatbotVersionId: mockVersionId,
      userId: mockUserId,
      status: 'active' as const,
      messageCount: 0,
      createdAt: new Date('2024-01-01T00:00:00Z'),
    };

    (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
    (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({
      id: mockChatbotId,
      currentVersionId: null,
      systemPrompt: 'Test prompt',
      configJson: null,
      ragSettingsJson: null,
      creator: {
        users: [{ userId: 'creator-user-id' }],
      },
    });
    (prisma.chatbot_Version.findMany as jest.Mock).mockResolvedValue([
      {
        id: mockVersionId,
        versionNumber: 1,
      },
    ]);
    (prisma.conversation.create as jest.Mock).mockResolvedValue(mockConversation);

    const request = new Request('http://localhost/api/conversations/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatbotId: mockChatbotId }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.conversation.chatbotVersionId).toBe(mockVersionId);
    expect(prisma.chatbot_Version.findMany).toHaveBeenCalledWith({
      where: { chatbotId: mockChatbotId },
      orderBy: { versionNumber: 'asc' },
      take: 1,
    });
  });

  it('should create version 1 when no versions exist', async () => {
    const { createChatbotVersion } = await import('@/lib/chatbot/versioning');
    const mockNewVersion = {
      id: 'new-version-123',
      chatbotId: mockChatbotId,
      versionNumber: 1,
    };

    const mockConversation = {
      id: 'conv-123',
      chatbotId: mockChatbotId,
      chatbotVersionId: 'new-version-123',
      userId: mockUserId,
      status: 'active' as const,
      messageCount: 0,
      createdAt: new Date('2024-01-01T00:00:00Z'),
    };

    (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
    (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({
      id: mockChatbotId,
      currentVersionId: null,
      systemPrompt: 'Test prompt',
      configJson: null,
      ragSettingsJson: null,
      creator: {
        users: [{ userId: 'creator-user-id' }],
      },
    });
    (prisma.chatbot_Version.findMany as jest.Mock).mockResolvedValue([]);
    (createChatbotVersion as jest.Mock).mockResolvedValue(mockNewVersion);
    (prisma.conversation.create as jest.Mock).mockResolvedValue(mockConversation);

    const request = new Request('http://localhost/api/conversations/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatbotId: mockChatbotId }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.conversation.chatbotVersionId).toBe('new-version-123');
    expect(createChatbotVersion).toHaveBeenCalledWith(
      mockChatbotId,
      'creator-user-id',
      expect.objectContaining({
        systemPrompt: 'Test prompt',
        notes: 'Auto-created version 1 for existing chatbot',
      })
    );
  });

  it('should return 500 on database error', async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: mockClerkUserId });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUserId });
    (prisma.chatbot.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

    const request = new Request('http://localhost/api/conversations/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatbotId: mockChatbotId }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});


