// __tests__/api/pills/route.test.ts
// Phase 2: Unit tests for Pills API route
// Tests pill fetching for chatbots (system + chatbot-specific)

import { GET } from '@/app/api/pills/route';
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    chatbot: {
      findUnique: jest.fn(),
    },
    pill: {
      findMany: jest.fn(),
    },
  },
}));

describe('GET /api/pills', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('should return system pills and chatbot-specific pills', async () => {
      const mockChatbot = { id: 'bot-123' };
      const mockPills = [
        {
          id: 'pill-1',
          chatbotId: null,
          pillType: 'feedback',
          label: 'Helpful',
          prefillText: 'Helpful',
          displayOrder: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'pill-2',
          chatbotId: 'bot-123',
          pillType: 'suggested',
          label: 'What is this?',
          prefillText: 'What is this?',
          displayOrder: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(mockChatbot);
      (prisma.pill.findMany as jest.Mock).mockResolvedValue(mockPills);

      const request = new Request('http://localhost/api/pills?chatbotId=bot-123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Dates are serialized to strings in JSON responses, so compare structure without dates
      expect(data).toHaveLength(2);
      expect(data[0]).toMatchObject({
        id: 'pill-1',
        chatbotId: null,
        pillType: 'feedback',
        label: 'Helpful',
        prefillText: 'Helpful',
        displayOrder: 0,
        isActive: true,
      });
      expect(data[1]).toMatchObject({
        id: 'pill-2',
        chatbotId: 'bot-123',
        pillType: 'suggested',
        label: 'What is this?',
        prefillText: 'What is this?',
        displayOrder: 0,
        isActive: true,
      });
      expect(prisma.pill.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          OR: [
            { chatbotId: null },
            { chatbotId: 'bot-123' },
          ],
        },
        orderBy: [
          { pillType: 'asc' },
          { displayOrder: 'asc' },
        ],
      });
    });
  });

  describe('error handling', () => {
    it('should return 400 if chatbotId is missing', async () => {
      const request = new Request('http://localhost/api/pills');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('chatbotId');
    });

    it('should return 404 if chatbot not found', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/pills?chatbotId=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('should return 500 on database error', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost/api/pills?chatbotId=bot-123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to fetch pills');
    });
  });
});

