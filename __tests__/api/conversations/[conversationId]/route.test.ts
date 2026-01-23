// __tests__/api/conversations/[conversationId]/route.test.ts
// Step 6: Integration tests for conversation PATCH endpoint
// Tests marking intake as complete for a conversation

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
      });
      (prisma.conversation.update as jest.Mock).mockResolvedValue({
        id: mockConversationId,
        intakeCompleted: true,
        intakeCompletedAt: mockDate,
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
  });
});
