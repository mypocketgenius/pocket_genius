// __tests__/api/jobs/update-chunk-performance/route.test.ts
// Phase 4, Task 10: Tests for background job that aggregates Events and Pill_Usage into Chunk_Performance

import { POST } from '@/app/api/jobs/update-chunk-performance/route';
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    event: {
      findMany: jest.fn(),
    },
    pill_Usage: {
      findMany: jest.fn(),
    },
    conversation: {
      findUnique: jest.fn(),
    },
    chunk_Performance: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
    },
  },
}));

describe('POST /api/jobs/update-chunk-performance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console.log to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('happy path', () => {
    it('should process copy events and update copyToUseNowCount', async () => {
      const now = new Date();
      const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      // Mock Events
      (prisma.event.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'event-1',
          eventType: 'copy',
          chunkIds: ['chunk-1', 'chunk-2'],
          metadata: { copyUsage: 'use_now', messageId: 'msg-1' },
          sessionId: 'conv-1',
        },
      ]);

      // Mock Pill_Usage (empty)
      (prisma.pill_Usage.findMany as jest.Mock).mockResolvedValue([]);

      // Mock Conversation lookup
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
        chatbotId: 'bot-1',
      });

      // Mock existing Chunk_Performance records
      (prisma.chunk_Performance.findMany as jest.Mock).mockResolvedValue([
        {
          chunkId: 'chunk-1',
          sourceId: 'src-1',
          chatbotId: 'bot-1',
        },
        {
          chunkId: 'chunk-2',
          sourceId: 'src-1',
          chatbotId: 'bot-1',
        },
      ]);

      // Mock upsert
      (prisma.chunk_Performance.upsert as jest.Mock).mockResolvedValue({
        id: 'perf-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new Request('http://localhost/api/jobs/update-chunk-performance', {
        method: 'POST',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.processed.events).toBe(1);
      expect(data.processed.pillUsages).toBe(0);
      
      // Verify copyToUseNowCount was incremented
      expect(prisma.chunk_Performance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            copyToUseNowCount: { increment: 1 },
          }),
        })
      );
    });

    it('should process Pill_Usage with helpful feedback and update helpfulCount', async () => {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      // Mock Events (empty)
      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);

      // Mock Pill_Usage with helpful feedback
      (prisma.pill_Usage.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'usage-1',
          pillId: 'pill_helpful_system',
          sourceChunkIds: ['chunk-1'],
          chatbotId: 'bot-1',
          pill: {
            id: 'pill_helpful_system',
            pillType: 'feedback',
            label: 'Helpful',
          },
        },
      ]);

      // Mock existing Chunk_Performance records
      (prisma.chunk_Performance.findMany as jest.Mock).mockResolvedValue([
        {
          chunkId: 'chunk-1',
          sourceId: 'src-1',
          chatbotId: 'bot-1',
        },
      ]);

      // Mock upsert
      (prisma.chunk_Performance.upsert as jest.Mock).mockResolvedValue({
        id: 'perf-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock findUnique for satisfactionRate recalculation
      (prisma.chunk_Performance.findUnique as jest.Mock).mockResolvedValue({
        helpfulCount: 1,
        notHelpfulCount: 0,
      });

      // Mock update for satisfactionRate
      (prisma.chunk_Performance.update as jest.Mock).mockResolvedValue({});

      const request = new Request('http://localhost/api/jobs/update-chunk-performance', {
        method: 'POST',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Verify helpfulCount was incremented
      expect(prisma.chunk_Performance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            helpfulCount: { increment: 1 },
          }),
        })
      );

      // Verify satisfactionRate was recalculated
      expect(prisma.chunk_Performance.findUnique).toHaveBeenCalled();
      expect(prisma.chunk_Performance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            satisfactionRate: 1, // 1/(1+0) = 1
          }),
        })
      );
    });

    it('should process expansion pills and update appropriate counters', async () => {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      // Mock Events (empty)
      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);

      // Mock Pill_Usage with expansion pills
      (prisma.pill_Usage.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'usage-1',
          pillId: 'pill_example_system',
          sourceChunkIds: ['chunk-1'],
          chatbotId: 'bot-1',
          pill: {
            id: 'pill_example_system',
            pillType: 'expansion',
            label: 'Give me an example',
          },
        },
        {
          id: 'usage-2',
          pillId: 'pill_how_to_use_system',
          sourceChunkIds: ['chunk-1'],
          chatbotId: 'bot-1',
          pill: {
            id: 'pill_how_to_use_system',
            pillType: 'expansion',
            label: 'How would I actually use this?',
          },
        },
      ]);

      // Mock existing Chunk_Performance records
      (prisma.chunk_Performance.findMany as jest.Mock).mockResolvedValue([
        {
          chunkId: 'chunk-1',
          sourceId: 'src-1',
          chatbotId: 'bot-1',
        },
      ]);

      // Mock upsert
      (prisma.chunk_Performance.upsert as jest.Mock).mockResolvedValue({
        id: 'perf-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock findUnique for satisfactionRate recalculation
      (prisma.chunk_Performance.findUnique as jest.Mock).mockResolvedValue({
        helpfulCount: 0,
        notHelpfulCount: 0,
      });

      const request = new Request('http://localhost/api/jobs/update-chunk-performance', {
        method: 'POST',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Verify needsExamplesCount and needsStepsCount were incremented
      const upsertCalls = (prisma.chunk_Performance.upsert as jest.Mock).mock.calls;
      expect(upsertCalls.length).toBeGreaterThan(0);
      
      // Check that at least one call includes both counters
      const hasExampleCounter = upsertCalls.some((call) =>
        call[0].update?.needsExamplesCount?.increment === 1
      );
      const hasStepsCounter = upsertCalls.some((call) =>
        call[0].update?.needsStepsCount?.increment === 1
      );
      
      expect(hasExampleCounter).toBe(true);
      expect(hasStepsCounter).toBe(true);
    });

    it('should skip copy events without copyUsage="use_now"', async () => {
      // Mock Events with copy event that doesn't have use_now
      (prisma.event.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'event-1',
          eventType: 'copy',
          chunkIds: ['chunk-1'],
          metadata: { copyUsage: 'reference', messageId: 'msg-1' },
          sessionId: 'conv-1',
        },
      ]);

      // Mock Pill_Usage (empty)
      (prisma.pill_Usage.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request('http://localhost/api/jobs/update-chunk-performance', {
        method: 'POST',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Verify no Chunk_Performance updates were made
      expect(prisma.chunk_Performance.upsert).not.toHaveBeenCalled();
    });

    it('should handle missing sourceId by querying Messages', async () => {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      // Mock Events
      (prisma.event.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'event-1',
          eventType: 'copy',
          chunkIds: ['chunk-new'],
          metadata: { copyUsage: 'use_now', messageId: 'msg-1' },
          sessionId: 'conv-1',
        },
      ]);

      // Mock Pill_Usage (empty)
      (prisma.pill_Usage.findMany as jest.Mock).mockResolvedValue([]);

      // Mock Conversation lookup
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
        chatbotId: 'bot-1',
      });

      // Mock existing Chunk_Performance records (empty - chunk not found)
      (prisma.chunk_Performance.findMany as jest.Mock).mockResolvedValue([]);

      // Mock Messages to find sourceId
      (prisma.message.findMany as jest.Mock).mockResolvedValue([
        {
          context: {
            chunks: [
              {
                chunkId: 'chunk-new',
                sourceId: 'src-1',
              },
            ],
          },
          conversation: {
            chatbotId: 'bot-1',
          },
        },
      ]);

      // Mock upsert
      (prisma.chunk_Performance.upsert as jest.Mock).mockResolvedValue({
        id: 'perf-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new Request('http://localhost/api/jobs/update-chunk-performance', {
        method: 'POST',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Verify Messages were queried to find sourceId
      expect(prisma.message.findMany).toHaveBeenCalled();
      
      // Verify Chunk_Performance was created with correct sourceId
      expect(prisma.chunk_Performance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            sourceId: 'src-1',
            chatbotId: 'bot-1',
          }),
        })
      );
    });

    it('should recalculate satisfactionRate correctly', async () => {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      // Mock Events (empty)
      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);

      // Mock Pill_Usage with both helpful and not_helpful
      (prisma.pill_Usage.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'usage-1',
          pillId: 'pill_helpful_system',
          sourceChunkIds: ['chunk-1'],
          chatbotId: 'bot-1',
          pill: {
            id: 'pill_helpful_system',
            pillType: 'feedback',
            label: 'Helpful',
          },
        },
        {
          id: 'usage-2',
          pillId: 'pill_not_helpful_system',
          sourceChunkIds: ['chunk-1'],
          chatbotId: 'bot-1',
          pill: {
            id: 'pill_not_helpful_system',
            pillType: 'feedback',
            label: 'Not helpful',
          },
        },
      ]);

      // Mock existing Chunk_Performance records
      (prisma.chunk_Performance.findMany as jest.Mock).mockResolvedValue([
        {
          chunkId: 'chunk-1',
          sourceId: 'src-1',
          chatbotId: 'bot-1',
        },
      ]);

      // Mock upsert
      (prisma.chunk_Performance.upsert as jest.Mock).mockResolvedValue({
        id: 'perf-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock findUnique for satisfactionRate recalculation
      // Simulate existing counts: 2 helpful, 1 not_helpful
      // After increment: 3 helpful, 2 not_helpful
      // Expected satisfactionRate: 3/(3+2) = 0.6
      (prisma.chunk_Performance.findUnique as jest.Mock).mockResolvedValue({
        helpfulCount: 3,
        notHelpfulCount: 2,
      });

      // Mock update for satisfactionRate
      (prisma.chunk_Performance.update as jest.Mock).mockResolvedValue({});

      const request = new Request('http://localhost/api/jobs/update-chunk-performance', {
        method: 'POST',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Verify satisfactionRate was recalculated correctly
      expect(prisma.chunk_Performance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            satisfactionRate: 0.6, // 3/(3+2) = 0.6
          }),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      (prisma.event.findMany as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new Request('http://localhost/api/jobs/update-chunk-performance', {
        method: 'POST',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update chunk performance');
      expect(data.details).toContain('Database connection failed');
    });

    it('should skip chunks with missing sourceId or chatbotId', async () => {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      // Mock Events
      (prisma.event.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'event-1',
          eventType: 'copy',
          chunkIds: ['chunk-1'],
          metadata: { copyUsage: 'use_now', messageId: 'msg-1' },
          sessionId: 'conv-1',
        },
      ]);

      // Mock Pill_Usage (empty)
      (prisma.pill_Usage.findMany as jest.Mock).mockResolvedValue([]);

      // Mock Conversation lookup
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
        chatbotId: 'bot-1',
      });

      // Mock existing Chunk_Performance records (empty - chunk not found)
      (prisma.chunk_Performance.findMany as jest.Mock).mockResolvedValue([]);

      // Mock Messages (empty - sourceId not found)
      (prisma.message.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request('http://localhost/api/jobs/update-chunk-performance', {
        method: 'POST',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Verify no Chunk_Performance updates were made (chunk skipped)
      expect(prisma.chunk_Performance.upsert).not.toHaveBeenCalled();
      
      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Skipping chunk chunk-1')
      );
    });
  });
});


