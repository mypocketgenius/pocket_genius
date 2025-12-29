// lib/chatbot/versioning.ts
// Phase 3.9: Chatbot Versioning System
// Utility functions for creating and managing chatbot versions

import { prisma } from '@/lib/prisma';

export interface VersionChanges {
  systemPrompt?: string;
  configJson?: any;
  ragSettingsJson?: any;
  notes?: string;
  changelog?: string;
}

/**
 * Creates a new chatbot version snapshot.
 * 
 * This function:
 * 1. Gets the current chatbot state
 * 2. Determines the next version number
 * 3. Deactivates the current version (if exists)
 * 4. Creates a new version snapshot with current state + changes
 * 5. Updates the chatbot to point to the new version
 * 6. Updates chatbot's current fields if changed
 * 
 * @param chatbotId - The ID of the chatbot to version
 * @param userId - The ID of the user creating the version
 * @param changes - The changes to apply (systemPrompt, configJson, ragSettingsJson, notes, changelog)
 * @returns The newly created Chatbot_Version
 */
export async function createChatbotVersion(
  chatbotId: string,
  userId: string,
  changes: VersionChanges
) {
  // Get chatbot with latest version
  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    include: { 
      versions: { 
        orderBy: { versionNumber: 'desc' }, 
        take: 1 
      } 
    },
  });
  
  if (!chatbot) {
    throw new Error('Chatbot not found');
  }
  
  // Validate required fields exist (for new chatbots, these may be null initially)
  // We'll use defaults if they don't exist
  const systemPrompt = changes.systemPrompt ?? chatbot.systemPrompt ?? 'You are a helpful assistant.';
  const modelProvider = chatbot.modelProvider ?? 'openai';
  const modelName = chatbot.modelName ?? 'gpt-4o';
  const pineconeNs = chatbot.pineconeNs ?? '';
  const vectorNamespace = chatbot.vectorNamespace ?? '';
  
  // Determine next version number
  const nextVersionNumber = chatbot.versions[0]?.versionNumber 
    ? chatbot.versions[0].versionNumber + 1 
    : 1;
  
  // Deactivate current version if it exists
  if (chatbot.currentVersionId) {
    await prisma.chatbot_Version.update({
      where: { id: chatbot.currentVersionId },
      data: { deactivatedAt: new Date() },
    });
  }
  
  // Create new version (snapshot current state + changes)
  const newVersion = await prisma.chatbot_Version.create({
    data: {
      chatbotId,
      versionNumber: nextVersionNumber,
      title: chatbot.title,
      description: chatbot.description,
      systemPrompt,
      modelProvider,
      modelName,
      pineconeNs,
      vectorNamespace,
      configJson: changes.configJson ?? chatbot.configJson,
      ragSettingsJson: changes.ragSettingsJson ?? chatbot.ragSettingsJson,
      ingestionRunIds: chatbot.ingestionRunIds || [],
      allowAnonymous: chatbot.allowAnonymous,
      priceCents: chatbot.priceCents,
      currency: chatbot.currency,
      type: chatbot.type || 'DEEP_DIVE',
      notes: changes.notes,
      changelog: changes.changelog,
      createdByUserId: userId,
      activatedAt: new Date(),
    },
  });
  
  // Update chatbot to point to new version AND update current fields
  await prisma.chatbot.update({
    where: { id: chatbotId },
    data: {
      currentVersionId: newVersion.id,
      // Update current fields if changed
      ...(changes.systemPrompt && { systemPrompt: changes.systemPrompt }),
      ...(changes.configJson && { configJson: changes.configJson }),
      ...(changes.ragSettingsJson && { ragSettingsJson: changes.ragSettingsJson }),
    },
  });
  
  return newVersion;
}

