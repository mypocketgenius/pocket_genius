// __tests__/api/pills/usage/route.test.ts
// Phase 2: Unit tests for Pill Usage API route
// Tests pill usage logging and Message_Feedback creation

import { POST } from '@/app/api/pills/usage/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

// Mock external dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    pill: {
      findUnique: jest.fn(),
    },
    chatbot: {
      findUnique: jest.fn(),
    },
    pill_Usage: {
      create: jest.fn(),
    },
    message_Feedback: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

describe('POST /api/pills/usage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ userId: null });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
  });

  describe('happy path', () => {
    it('should create Pill_Usage record for expansion pill', async () => {
      const mockPill = {
        id: 'pill-1',
        pillType: 'expansion',
      };
      const mockChatbot = { id: 'bot-123' };
      const mockPillUsage = { id: 'usage-1' };

      (prisma.pill.findUnique as jest.Mock).mockResolvedValue(mockPill);
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.pill_Usage.create as jest.Mock).mockResolvedValue(mockPillUsage);

      const request = new Request('http://localhost/api/pills/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pillId: 'pill-1',
          sessionId: 'session-123',
          chatbotId: 'bot-123',
          sourceChunkIds: ['chunk-1'],
          prefillText: 'Give me an example',
          sentText: 'Give me an example',
          wasModified: false,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.pillUsageId).toBe('usage-1');
      expect(prisma.pill_Usage.create).toHaveBeenCalled();
      expect(prisma.message_Feedback.create).not.toHaveBeenCalled(); // Not a feedback pill
    });

    it('should create Pill_Usage and Message_Feedback for feedback pill', async () => {
      const mockPill = {
        id: 'pill-2',
        pillType: 'feedback',
        label: 'Helpful',
      };
      const mockChatbot = { id: 'bot-123' };
      const mockPillUsage = { id: 'usage-2' };

      (prisma.pill.findUnique as jest.Mock).mockResolvedValue(mockPill);
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.pill_Usage.create as jest.Mock).mockResolvedValue(mockPillUsage);
      (prisma.message_Feedback.findFirst as jest.Mock).mockResolvedValue(null); // No existing feedback

      const request = new Request('http://localhost/api/pills/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pillId: 'pill-2',
          sessionId: 'session-123',
          chatbotId: 'bot-123',
          sourceChunkIds: ['chunk-1'],
          prefillText: 'Helpful',
          sentText: 'Helpful',
          wasModified: false,
          messageId: 'msg-123',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.message_Feedback.create).toHaveBeenCalledWith({
        data: {
          messageId: 'msg-123',
          userId: null,
          feedbackType: 'helpful',
        },
      });
    });

    it('should not create duplicate Message_Feedback', async () => {
      const mockPill = {
        id: 'pill-2',
        pillType: 'feedback',
        label: 'Helpful',
      };
      const mockChatbot = { id: 'bot-123' };
      const mockPillUsage = { id: 'usage-2' };
      const existingFeedback = { id: 'feedback-1' };

      (prisma.pill.findUnique as jest.Mock).mockResolvedValue(mockPill);
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.pill_Usage.create as jest.Mock).mockResolvedValue(mockPillUsage);
      (prisma.message_Feedback.findFirst as jest.Mock).mockResolvedValue(existingFeedback);

      const request = new Request('http://localhost/api/pills/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pillId: 'pill-2',
          sessionId: 'session-123',
          chatbotId: 'bot-123',
          prefillText: 'Helpful',
          sentText: 'Helpful',
          messageId: 'msg-123',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.message_Feedback.create).not.toHaveBeenCalled(); // Duplicate prevented
    });
  });

  describe('error handling', () => {
    it('should return 400 if required fields are missing', async () => {
      const request = new Request('http://localhost/api/pills/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pillId: 'pill-1',
          // Missing required fields
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('should return 404 if pill not found', async () => {
      (prisma.pill.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/pills/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pillId: 'invalid',
          sessionId: 'session-123',
          chatbotId: 'bot-123',
          prefillText: 'test',
          sentText: 'test',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Pill not found');
    });

    it('should return 500 on database error', async () => {
      (prisma.pill.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost/api/pills/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pillId: 'pill-1',
          sessionId: 'session-123',
          chatbotId: 'bot-123',
          prefillText: 'test',
          sentText: 'test',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to log pill usage');
    });
  });
});

