// __tests__/lib/pills/log-usage.test.ts
// Phase 4, Task 8: Unit tests for logPillUsage utility function

import { logPillUsage } from '@/lib/pills/log-usage';
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    pill: {
      findUnique: jest.fn(),
    },
    chatbot: {
      findUnique: jest.fn(),
    },
    pill_Usage: {
      create: jest.fn(),
    },
  },
}));

describe('logPillUsage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('should create Pill_Usage record successfully', async () => {
      const mockPill = {
        id: 'pill-1',
        pillType: 'feedback',
      };
      const mockChatbot = { id: 'bot-123' };
      const mockPillUsage = { id: 'usage-123' };

      (prisma.pill.findUnique as jest.Mock).mockResolvedValue(mockPill);
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.pill_Usage.create as jest.Mock).mockResolvedValue(mockPillUsage);

      const result = await logPillUsage({
        pillId: 'pill-1',
        sessionId: 'session-123',
        chatbotId: 'bot-123',
        sourceChunkIds: ['chunk-1', 'chunk-2'],
        prefillText: 'Helpful',
        sentText: 'Helpful',
        wasModified: false,
        userId: 'user-123',
      });

      expect(result.success).toBe(true);
      expect(result.pillUsageId).toBe('usage-123');
      expect(prisma.pill.findUnique).toHaveBeenCalledWith({
        where: { id: 'pill-1' },
        select: { id: true, pillType: true },
      });
      expect(prisma.chatbot.findUnique).toHaveBeenCalledWith({
        where: { id: 'bot-123' },
        select: { id: true },
      });
      expect(prisma.pill_Usage.create).toHaveBeenCalledWith({
        data: {
          pillId: 'pill-1',
          sessionId: 'session-123',
          userId: 'user-123',
          chatbotId: 'bot-123',
          sourceChunkIds: ['chunk-1', 'chunk-2'],
          prefillText: 'Helpful',
          sentText: 'Helpful',
          wasModified: false,
          pairedWithPillId: null,
        },
      });
    });

    it('should handle paired pills', async () => {
      const mockPill = {
        id: 'pill-feedback-1',
        pillType: 'feedback',
      };
      const mockChatbot = { id: 'bot-123' };
      const mockPillUsage = { id: 'usage-123' };

      (prisma.pill.findUnique as jest.Mock).mockResolvedValue(mockPill);
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.pill_Usage.create as jest.Mock).mockResolvedValue(mockPillUsage);

      const result = await logPillUsage({
        pillId: 'pill-feedback-1',
        sessionId: 'session-123',
        chatbotId: 'bot-123',
        sourceChunkIds: ['chunk-1'],
        prefillText: 'Helpful Give me an example',
        sentText: 'Helpful Give me an example',
        wasModified: false,
        pairedWithPillId: 'pill-expansion-1',
        userId: null,
      });

      expect(result.success).toBe(true);
      expect(prisma.pill_Usage.create).toHaveBeenCalledWith({
        data: {
          pillId: 'pill-feedback-1',
          sessionId: 'session-123',
          userId: null,
          chatbotId: 'bot-123',
          sourceChunkIds: ['chunk-1'],
          prefillText: 'Helpful Give me an example',
          sentText: 'Helpful Give me an example',
          wasModified: false,
          pairedWithPillId: 'pill-expansion-1',
        },
      });
    });

    it('should handle anonymous users', async () => {
      const mockPill = {
        id: 'pill-1',
        pillType: 'expansion',
      };
      const mockChatbot = { id: 'bot-123' };
      const mockPillUsage = { id: 'usage-123' };

      (prisma.pill.findUnique as jest.Mock).mockResolvedValue(mockPill);
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.pill_Usage.create as jest.Mock).mockResolvedValue(mockPillUsage);

      const result = await logPillUsage({
        pillId: 'pill-1',
        sessionId: 'session-123',
        chatbotId: 'bot-123',
        prefillText: 'Give me an example',
        sentText: 'Give me an example',
      });

      expect(result.success).toBe(true);
      expect(prisma.pill_Usage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: null,
        }),
      });
    });

    it('should handle empty sourceChunkIds array', async () => {
      const mockPill = {
        id: 'pill-1',
        pillType: 'suggested',
      };
      const mockChatbot = { id: 'bot-123' };
      const mockPillUsage = { id: 'usage-123' };

      (prisma.pill.findUnique as jest.Mock).mockResolvedValue(mockPill);
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.pill_Usage.create as jest.Mock).mockResolvedValue(mockPillUsage);

      const result = await logPillUsage({
        pillId: 'pill-1',
        sessionId: 'session-123',
        chatbotId: 'bot-123',
        prefillText: 'What is this?',
        sentText: 'What is this?',
      });

      expect(result.success).toBe(true);
      expect(prisma.pill_Usage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sourceChunkIds: [],
        }),
      });
    });
  });

  describe('validation errors', () => {
    it('should throw error if pillId is missing', async () => {
      await expect(
        logPillUsage({
          pillId: '',
          sessionId: 'session-123',
          chatbotId: 'bot-123',
          prefillText: 'Test',
          sentText: 'Test',
        })
      ).rejects.toThrow('required');
    });

    it('should throw error if sessionId is missing', async () => {
      await expect(
        logPillUsage({
          pillId: 'pill-1',
          sessionId: '',
          chatbotId: 'bot-123',
          prefillText: 'Test',
          sentText: 'Test',
        })
      ).rejects.toThrow('required');
    });

    it('should throw error if chatbotId is missing', async () => {
      await expect(
        logPillUsage({
          pillId: 'pill-1',
          sessionId: 'session-123',
          chatbotId: '',
          prefillText: 'Test',
          sentText: 'Test',
        })
      ).rejects.toThrow('required');
    });

    it('should throw error if prefillText is missing', async () => {
      await expect(
        logPillUsage({
          pillId: 'pill-1',
          sessionId: 'session-123',
          chatbotId: 'bot-123',
          prefillText: '',
          sentText: 'Test',
        })
      ).rejects.toThrow('required');
    });

    it('should throw error if sentText is missing', async () => {
      await expect(
        logPillUsage({
          pillId: 'pill-1',
          sessionId: 'session-123',
          chatbotId: 'bot-123',
          prefillText: 'Test',
          sentText: '',
        })
      ).rejects.toThrow('required');
    });
  });

  describe('not found errors', () => {
    it('should throw error if pill not found', async () => {
      (prisma.pill.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        logPillUsage({
          pillId: 'invalid-pill',
          sessionId: 'session-123',
          chatbotId: 'bot-123',
          prefillText: 'Test',
          sentText: 'Test',
        })
      ).rejects.toThrow('Pill not found');
    });

    it('should throw error if chatbot not found', async () => {
      (prisma.pill.findUnique as jest.Mock).mockResolvedValue({
        id: 'pill-1',
        pillType: 'feedback',
      });
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        logPillUsage({
          pillId: 'pill-1',
          sessionId: 'session-123',
          chatbotId: 'invalid-bot',
          prefillText: 'Test',
          sentText: 'Test',
        })
      ).rejects.toThrow('Chatbot not found');
    });
  });

  describe('database errors', () => {
    it('should propagate database errors', async () => {
      (prisma.pill.findUnique as jest.Mock).mockResolvedValue({
        id: 'pill-1',
        pillType: 'feedback',
      });
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue({
        id: 'bot-123',
      });
      (prisma.pill_Usage.create as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        logPillUsage({
          pillId: 'pill-1',
          sessionId: 'session-123',
          chatbotId: 'bot-123',
          prefillText: 'Test',
          sentText: 'Test',
        })
      ).rejects.toThrow('Database connection failed');
    });
  });
});

