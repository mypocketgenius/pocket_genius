// __tests__/api/events/route.test.ts
// Phase 2: Unit tests for Events API route
// Tests event logging for copy, bookmark, conversation patterns, etc.

import { POST } from '@/app/api/events/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

// Mock external dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    event: {
      create: jest.fn(),
    },
    message: {
      findUnique: jest.fn(),
    },
    conversation: {
      findUnique: jest.fn(),
    },
    bookmark: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

describe('POST /api/events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ userId: null });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
  });

  describe('happy path', () => {
    it('should log copy event', async () => {
      const mockEvent = { id: 'event-1' };
      (prisma.event.create as jest.Mock).mockResolvedValue(mockEvent);

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'copy',
          sessionId: 'session-123',
          chunkIds: ['chunk-1'],
          metadata: {
            messageId: 'msg-123',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.eventId).toBe('event-1');
      expect(prisma.event.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-123',
          userId: null,
          eventType: 'copy',
          chunkIds: ['chunk-1'],
          metadata: { messageId: 'msg-123' },
        },
      });
    });

    it('should log bookmark event and create Bookmark record', async () => {
      const mockEvent = { id: 'event-1' };
      const mockMessage = {
        id: 'msg-123',
        conversationId: 'conv-123',
      };
      const mockConversation = {
        chatbotId: 'bot-123',
      };
      const mockUser = { id: 'user-123' };
      const mockBookmark = { id: 'bookmark-1' };

      (auth as jest.Mock).mockResolvedValue({ userId: 'clerk-123' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.event.create as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(mockConversation);
      (prisma.bookmark.findUnique as jest.Mock).mockResolvedValue(null); // No existing bookmark
      (prisma.bookmark.create as jest.Mock).mockResolvedValue(mockBookmark);

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'bookmark',
          sessionId: 'session-123',
          chunkIds: ['chunk-1'],
          metadata: {
            messageId: 'msg-123',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.bookmark.create).toHaveBeenCalled();
    });

    it('should not create duplicate bookmark', async () => {
      const mockEvent = { id: 'event-1' };
      const mockMessage = {
        id: 'msg-123',
        conversationId: 'conv-123',
      };
      const mockConversation = {
        chatbotId: 'bot-123',
      };
      const mockUser = { id: 'user-123' };
      const existingBookmark = { id: 'bookmark-1' };

      (auth as jest.Mock).mockResolvedValue({ userId: 'clerk-123' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.event.create as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(mockConversation);
      (prisma.bookmark.findUnique as jest.Mock).mockResolvedValue(existingBookmark);

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'bookmark',
          sessionId: 'session-123',
          chunkIds: ['chunk-1'],
          metadata: {
            messageId: 'msg-123',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.bookmark.create).not.toHaveBeenCalled(); // Duplicate prevented
    });
  });

  describe('error handling', () => {
    it('should return 400 if eventType is invalid', async () => {
      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'invalid_type',
          sessionId: 'session-123',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('eventType');
    });

    it('should return 500 on database error', async () => {
      (prisma.event.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'copy',
          sessionId: 'session-123',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to log event');
    });
  });
});

