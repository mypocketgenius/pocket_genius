// __tests__/lib/chatbot/versioning.test.ts
// Phase 3.9: Unit tests for chatbot versioning utility

import { createChatbotVersion } from '@/lib/chatbot/versioning';
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    chatbot: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    chatbot_Version: {
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('createChatbotVersion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockChatbotId = 'bot-123';
  const mockUserId = 'user-123';
  const mockCurrentVersionId = 'version-1';

  const mockChatbot = {
    id: mockChatbotId,
    title: 'Test Chatbot',
    description: 'Test Description',
    systemPrompt: 'You are a helpful assistant.',
    modelProvider: 'openai',
    modelName: 'gpt-4o',
    pineconeNs: 'test-namespace',
    vectorNamespace: 'test-vector',
    configJson: { temperature: 0.7 },
    ragSettingsJson: { topK: 5 },
    ingestionRunIds: ['run-1'],
    allowAnonymous: true,
    priceCents: 0,
    currency: 'USD',
    type: 'DEEP_DIVE' as const,
    currentVersionId: mockCurrentVersionId,
    versions: [],
  };

  describe('happy path', () => {
    it('should create version 1 for chatbot with no existing versions', async () => {
      const chatbotWithoutVersion = {
        ...mockChatbot,
        currentVersionId: null,
        versions: [],
      };

      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(chatbotWithoutVersion);
      const mockVersion = {
        id: 'version-1',
        versionNumber: 1,
        chatbotId: mockChatbotId,
        title: chatbotWithoutVersion.title,
        description: chatbotWithoutVersion.description,
        systemPrompt: 'Updated prompt',
        modelProvider: chatbotWithoutVersion.modelProvider,
        modelName: chatbotWithoutVersion.modelName,
        pineconeNs: chatbotWithoutVersion.pineconeNs,
        vectorNamespace: chatbotWithoutVersion.vectorNamespace,
        configJson: { temperature: 0.8 },
        ragSettingsJson: chatbotWithoutVersion.ragSettingsJson,
        ingestionRunIds: chatbotWithoutVersion.ingestionRunIds,
        allowAnonymous: chatbotWithoutVersion.allowAnonymous,
        priceCents: chatbotWithoutVersion.priceCents,
        currency: chatbotWithoutVersion.currency,
        type: chatbotWithoutVersion.type,
        createdByUserId: mockUserId,
        activatedAt: new Date(),
      };
      (prisma.chatbot_Version.create as jest.Mock).mockResolvedValue(mockVersion);
      (prisma.chatbot.update as jest.Mock).mockResolvedValue(chatbotWithoutVersion);

      const changes = {
        systemPrompt: 'Updated prompt',
        configJson: { temperature: 0.8 },
      };

      const result = await createChatbotVersion(mockChatbotId, mockUserId, changes);

      expect(prisma.chatbot.findUnique).toHaveBeenCalledWith({
        where: { id: mockChatbotId },
        include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
      });

      expect(prisma.chatbot_Version.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          chatbotId: mockChatbotId,
          versionNumber: 1,
          systemPrompt: 'Updated prompt',
          configJson: { temperature: 0.8 },
          createdByUserId: mockUserId,
          activatedAt: expect.any(Date),
        }),
      });

      expect(prisma.chatbot.update).toHaveBeenCalledWith({
        where: { id: mockChatbotId },
        data: expect.objectContaining({
          currentVersionId: 'version-1',
          systemPrompt: 'Updated prompt',
          configJson: { temperature: 0.8 },
        }),
      });

      expect(result.versionNumber).toBe(1);
    });

    it('should create version 2 for chatbot with existing version', async () => {
      const chatbotWithVersion = {
        ...mockChatbot,
        versions: [{ versionNumber: 1 }],
      };

      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(chatbotWithVersion);
      (prisma.chatbot_Version.update as jest.Mock).mockResolvedValue({});
      (prisma.chatbot_Version.create as jest.Mock).mockResolvedValue({
        id: 'version-2',
        versionNumber: 2,
        ...chatbotWithVersion,
      });
      (prisma.chatbot.update as jest.Mock).mockResolvedValue(chatbotWithVersion);

      const changes = {
        systemPrompt: 'Updated prompt v2',
      };

      const result = await createChatbotVersion(mockChatbotId, mockUserId, changes);

      expect(prisma.chatbot_Version.update).toHaveBeenCalledWith({
        where: { id: mockCurrentVersionId },
        data: { deactivatedAt: expect.any(Date) },
      });

      expect(prisma.chatbot_Version.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          versionNumber: 2,
          systemPrompt: 'Updated prompt v2',
        }),
      });

      expect(result.versionNumber).toBe(2);
    });

    it('should use defaults for missing fields', async () => {
      const chatbotWithDefaults = {
        ...mockChatbot,
        systemPrompt: null,
        modelProvider: null,
        modelName: null,
        pineconeNs: null,
        vectorNamespace: null,
        currentVersionId: null,
        versions: [],
      };

      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(chatbotWithDefaults);
      (prisma.chatbot_Version.create as jest.Mock).mockResolvedValue({
        id: 'version-1',
        versionNumber: 1,
      });
      (prisma.chatbot.update as jest.Mock).mockResolvedValue(chatbotWithDefaults);

      await createChatbotVersion(mockChatbotId, mockUserId, {});

      expect(prisma.chatbot_Version.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          systemPrompt: 'You are a helpful assistant.',
          modelProvider: 'openai',
          modelName: 'gpt-4o',
          pineconeNs: '',
          vectorNamespace: '',
        }),
      });
    });
  });

  describe('error handling', () => {
    it('should throw error if chatbot not found', async () => {
      (prisma.chatbot.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        createChatbotVersion(mockChatbotId, mockUserId, {})
      ).rejects.toThrow('Chatbot not found');
    });
  });
});

