// __tests__/api/feedback/message/route.test.ts
// Phase 6, Task 2: Integration tests for Feedback API
// Tests counter updates and error handling for message feedback

import { POST } from '@/app/api/feedback/message/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

// Mock all external dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    message: {
      findUnique: jest.fn(),
    },
    message_Feedback: {
      create: jest.fn(),
    },
    chunk_Performance: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

describe('POST /api/feedback/message', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mocks
    (auth as jest.Mock).mockResolvedValue({ userId: null });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
  });

  describe('happy path', () => {
    it('should update chunk performance counters for helpful feedback', async () => {
      const mockMessage = {
        id: 'msg-123',
        role: 'assistant',
        context: {
          chunks: [
            { chunkId: 'chunk-1', sourceId: 'src-1' },
            { chunkId: 'chunk-2', sourceId: 'src-1' },
          ],
        },
        conversation: {
          chatbotId: 'bot-123',
        },
      };

      const mockChunkPerformance = {
        id: 'perf-1',
        chunkId: 'chunk-1',
        sourceId: 'src-1',
        chatbotId: 'bot-123',
        timesUsed: 5,
        helpfulCount: 3,
        notHelpfulCount: 1,
        satisfactionRate: 0.75,
        month: 12,
        year: 2024,
      };

      (prisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.message_Feedback.create as jest.Mock).mockResolvedValue({
        id: 'feedback-1',
      });
      (prisma.chunk_Performance.findUnique as jest.Mock).mockResolvedValue(
        mockChunkPerformance
      );
      (prisma.chunk_Performance.update as jest.Mock).mockResolvedValue({
        ...mockChunkPerformance,
        helpfulCount: 4,
        satisfactionRate: 0.8, // 4/(4+1) = 0.8
      });

      const request = new Request('http://localhost/api/feedback/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg-123',
          feedbackType: 'helpful',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.message_Feedback.create).toHaveBeenCalledWith({
        data: {
          messageId: 'msg-123',
          userId: undefined,
          feedbackType: 'helpful',
        },
      });
      expect(prisma.chunk_Performance.update).toHaveBeenCalled();
      
      // Verify satisfactionRate was computed correctly
      const updateCall = (prisma.chunk_Performance.update as jest.Mock).mock
        .calls[0];
      expect(updateCall[0].data.satisfactionRate).toBe(0.8);
    });

    it('should update chunk performance counters for not_helpful feedback', async () => {
      const mockMessage = {
        id: 'msg-123',
        role: 'assistant',
        context: {
          chunks: [{ chunkId: 'chunk-1', sourceId: 'src-1' }],
        },
        conversation: {
          chatbotId: 'bot-123',
        },
      };

      const mockChunkPerformance = {
        id: 'perf-1',
        chunkId: 'chunk-1',
        sourceUsed: 5,
        helpfulCount: 3,
        notHelpfulCount: 1,
        satisfactionRate: 0.75,
        month: 12,
        year: 2024,
      };

      (prisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.message_Feedback.create as jest.Mock).mockResolvedValue({
        id: 'feedback-1',
      });
      (prisma.chunk_Performance.findUnique as jest.Mock).mockResolvedValue(
        mockChunkPerformance
      );
      (prisma.chunk_Performance.update as jest.Mock).mockResolvedValue({
        ...mockChunkPerformance,
        notHelpfulCount: 2,
        satisfactionRate: 0.6, // 3/(3+2) = 0.6
      });

      const request = new Request('http://localhost/api/feedback/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg-123',
          feedbackType: 'not_helpful',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Verify notHelpfulCount was incremented
      const updateCall = (prisma.chunk_Performance.update as jest.Mock).mock
        .calls[0];
      expect(updateCall[0].data.notHelpfulCount.increment).toBe(1);
    });

    it('should create chunk performance record if it does not exist', async () => {
      const mockMessage = {
        id: 'msg-123',
        role: 'assistant',
        context: {
          chunks: [{ chunkId: 'chunk-1', sourceId: 'src-1' }],
        },
        conversation: {
          chatbotId: 'bot-123',
        },
      };

      (prisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.message_Feedback.create as jest.Mock).mockResolvedValue({
        id: 'feedback-1',
      });
      (prisma.chunk_Performance.findUnique as jest.Mock).mockResolvedValue(
        null
      );
      (prisma.chunk_Performance.create as jest.Mock).mockResolvedValue({
        id: 'perf-1',
        chunkId: 'chunk-1',
        helpfulCount: 1,
        notHelpfulCount: 0,
        satisfactionRate: 1.0,
      });
      (prisma.chunk_Performance.update as jest.Mock).mockResolvedValue({});

      const request = new Request('http://localhost/api/feedback/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg-123',
          feedbackType: 'helpful',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.chunk_Performance.create).toHaveBeenCalled();
    });

    it('should handle authenticated users', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: 'clerk-user-123' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'db-user-123',
      });

      const mockMessage = {
        id: 'msg-123',
        role: 'assistant',
        context: {
          chunks: [{ chunkId: 'chunk-1', sourceId: 'src-1' }],
        },
        conversation: {
          chatbotId: 'bot-123',
        },
      };

      (prisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.message_Feedback.create as jest.Mock).mockResolvedValue({
        id: 'feedback-1',
      });
      (prisma.chunk_Performance.findUnique as jest.Mock).mockResolvedValue({
        id: 'perf-1',
        helpfulCount: 0,
        notHelpfulCount: 0,
      });
      (prisma.chunk_Performance.update as jest.Mock).mockResolvedValue({});

      const request = new Request('http://localhost/api/feedback/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg-123',
          feedbackType: 'helpful',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { clerkId: 'clerk-user-123' },
        select: { id: true },
      });
      expect(prisma.message_Feedback.create).toHaveBeenCalledWith({
        data: {
          messageId: 'msg-123',
          userId: 'db-user-123',
          feedbackType: 'helpful',
        },
      });
    });

    it('should return success if message has no context', async () => {
      const mockMessage = {
        id: 'msg-123',
        role: 'assistant',
        context: null,
        conversation: {
          chatbotId: 'bot-123',
        },
      };

      (prisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.message_Feedback.create as jest.Mock).mockResolvedValue({
        id: 'feedback-1',
      });

      const request = new Request('http://localhost/api/feedback/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg-123',
          feedbackType: 'helpful',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.chunk_Performance.update).not.toHaveBeenCalled();
    });

    it('should return success if message has empty chunks array', async () => {
      const mockMessage = {
        id: 'msg-123',
        role: 'assistant',
        context: {
          chunks: [],
        },
        conversation: {
          chatbotId: 'bot-123',
        },
      };

      (prisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.message_Feedback.create as jest.Mock).mockResolvedValue({
        id: 'feedback-1',
      });

      const request = new Request('http://localhost/api/feedback/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg-123',
          feedbackType: 'helpful',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.chunk_Performance.update).not.toHaveBeenCalled();
    });

    it('should update multiple chunks when message has multiple chunks', async () => {
      const mockMessage = {
        id: 'msg-123',
        role: 'assistant',
        context: {
          chunks: [
            { chunkId: 'chunk-1', sourceId: 'src-1' },
            { chunkId: 'chunk-2', sourceId: 'src-1' },
            { chunkId: 'chunk-3', sourceId: 'src-2' },
          ],
        },
        conversation: {
          chatbotId: 'bot-123',
        },
      };

      (prisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.message_Feedback.create as jest.Mock).mockResolvedValue({
        id: 'feedback-1',
      });
      (prisma.chunk_Performance.findUnique as jest.Mock).mockResolvedValue({
        id: 'perf-1',
        helpfulCount: 0,
        notHelpfulCount: 0,
      });
      (prisma.chunk_Performance.update as jest.Mock).mockResolvedValue({});

      const request = new Request('http://localhost/api/feedback/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg-123',
          feedbackType: 'helpful',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      // Should update all 3 chunks
      expect(prisma.chunk_Performance.update).toHaveBeenCalledTimes(3);
    });
  });

  describe('validation errors', () => {
    it('should return 400 if messageId is missing', async () => {
      const request = new Request('http://localhost/api/feedback/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackType: 'helpful',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('messageId is required');
    });

    it('should return 400 if feedbackType is missing', async () => {
      const request = new Request('http://localhost/api/feedback/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg-123',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("feedbackType must be 'helpful' or 'not_helpful'");
    });

    it('should return 400 if feedbackType is invalid', async () => {
      const request = new Request('http://localhost/api/feedback/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg-123',
          feedbackType: 'invalid',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("feedbackType must be 'helpful' or 'not_helpful'");
    });

    it('should return 404 if message not found', async () => {
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/feedback/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'invalid-msg',
          feedbackType: 'helpful',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Message not found');
    });

    it('should return 400 if feedback is given on user message', async () => {
      (prisma.message.findUnique as jest.Mock).mockResolvedValue({
        id: 'msg-123',
        role: 'user', // User message, not assistant
        conversation: {
          chatbotId: 'bot-123',
        },
      });

      const request = new Request('http://localhost/api/feedback/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg-123',
          feedbackType: 'helpful',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Feedback can only be given on assistant messages');
    });
  });

  describe('satisfactionRate computation', () => {
    it('should compute satisfactionRate correctly for helpful feedback', async () => {
      const mockMessage = {
        id: 'msg-123',
        role: 'assistant',
        context: {
          chunks: [{ chunkId: 'chunk-1', sourceId: 'src-1' }],
        },
        conversation: {
          chatbotId: 'bot-123',
        },
      };

      const mockChunkPerformance = {
        id: 'perf-1',
        helpfulCount: 2,
        notHelpfulCount: 1,
        satisfactionRate: 0.666, // 2/(2+1)
      };

      (prisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.message_Feedback.create as jest.Mock).mockResolvedValue({});
      (prisma.chunk_Performance.findUnique as jest.Mock).mockResolvedValue(
        mockChunkPerformance
      );
      (prisma.chunk_Performance.update as jest.Mock).mockResolvedValue({});

      const request = new Request('http://localhost/api/feedback/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg-123',
          feedbackType: 'helpful',
        }),
      });

      await POST(request);

      // Verify satisfactionRate: (2+1)/(2+1+1) = 3/4 = 0.75
      const updateCall = (prisma.chunk_Performance.update as jest.Mock).mock
        .calls[0];
      expect(updateCall[0].data.satisfactionRate).toBe(0.75);
    });

    it('should compute satisfactionRate correctly for not_helpful feedback', async () => {
      const mockMessage = {
        id: 'msg-123',
        role: 'assistant',
        context: {
          chunks: [{ chunkId: 'chunk-1', sourceId: 'src-1' }],
        },
        conversation: {
          chatbotId: 'bot-123',
        },
      };

      const mockChunkPerformance = {
        id: 'perf-1',
        helpfulCount: 3,
        notHelpfulCount: 1,
        satisfactionRate: 0.75, // 3/(3+1)
      };

      (prisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.message_Feedback.create as jest.Mock).mockResolvedValue({});
      (prisma.chunk_Performance.findUnique as jest.Mock).mockResolvedValue(
        mockChunkPerformance
      );
      (prisma.chunk_Performance.update as jest.Mock).mockResolvedValue({});

      const request = new Request('http://localhost/api/feedback/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg-123',
          feedbackType: 'not_helpful',
        }),
      });

      await POST(request);

      // Verify satisfactionRate: 3/(3+1+1) = 3/5 = 0.6
      const updateCall = (prisma.chunk_Performance.update as jest.Mock).mock
        .calls[0];
      expect(updateCall[0].data.satisfactionRate).toBe(0.6);
    });

    it('should handle satisfactionRate of 0 when no feedback yet', async () => {
      const mockMessage = {
        id: 'msg-123',
        role: 'assistant',
        context: {
          chunks: [{ chunkId: 'chunk-1', sourceId: 'src-1' }],
        },
        conversation: {
          chatbotId: 'bot-123',
        },
      };

      (prisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.message_Feedback.create as jest.Mock).mockResolvedValue({});
      (prisma.chunk_Performance.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.chunk_Performance.create as jest.Mock).mockResolvedValue({
        id: 'perf-1',
        helpfulCount: 0,
        notHelpfulCount: 1,
        satisfactionRate: 0.0,
      });
      (prisma.chunk_Performance.update as jest.Mock).mockResolvedValue({});

      const request = new Request('http://localhost/api/feedback/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg-123',
          feedbackType: 'not_helpful',
        }),
      });

      await POST(request);

      // First feedback should create record with satisfactionRate 0.0
      expect(prisma.chunk_Performance.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          satisfactionRate: 0.0,
        }),
      });
    });
  });

  describe('error handling', () => {
    it('should handle chunk performance creation failures gracefully', async () => {
      const mockMessage = {
        id: 'msg-123',
        role: 'assistant',
        context: {
          chunks: [{ chunkId: 'chunk-1', sourceId: 'src-1' }],
        },
        conversation: {
          chatbotId: 'bot-123',
        },
      };

      (prisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.message_Feedback.create as jest.Mock).mockResolvedValue({});
      (prisma.chunk_Performance.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.chunk_Performance.create as jest.Mock).mockRejectedValue(
        new Error('Foreign key constraint violation')
      );

      const request = new Request('http://localhost/api/feedback/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg-123',
          feedbackType: 'helpful',
        }),
      });

      // Should still return success (feedback was stored)
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle chunk update failures gracefully', async () => {
      const mockMessage = {
        id: 'msg-123',
        role: 'assistant',
        context: {
          chunks: [
            { chunkId: 'chunk-1', sourceId: 'src-1' },
            { chunkId: 'chunk-2', sourceId: 'src-1' },
          ],
        },
        conversation: {
          chatbotId: 'bot-123',
        },
      };

      (prisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.message_Feedback.create as jest.Mock).mockResolvedValue({});
      (prisma.chunk_Performance.findUnique as jest.Mock).mockResolvedValue({
        id: 'perf-1',
        helpfulCount: 0,
        notHelpfulCount: 0,
      });
      (prisma.chunk_Performance.update as jest.Mock)
        .mockRejectedValueOnce(new Error('Update failed'))
        .mockResolvedValueOnce({});

      const request = new Request('http://localhost/api/feedback/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg-123',
          feedbackType: 'helpful',
        }),
      });

      // Should still return success (one chunk update failed, but feedback was stored)
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle duplicate feedback gracefully', async () => {
      const mockMessage = {
        id: 'msg-123',
        role: 'assistant',
        context: {
          chunks: [{ chunkId: 'chunk-1', sourceId: 'src-1' }],
        },
        conversation: {
          chatbotId: 'bot-123',
        },
      };

      (prisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.message_Feedback.create as jest.Mock).mockRejectedValue(
        new Error('Unique constraint violation')
      );

      const request = new Request('http://localhost/api/feedback/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg-123',
          feedbackType: 'helpful',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('Feedback already submitted');
    });
  });
});
