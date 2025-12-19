// lib/pills/log-usage.ts
// Phase 4, Task 8: Shared utility function for logging pill usage
// Extracted from /api/pills/usage/route.ts for reuse in chat API

import { prisma } from '@/lib/prisma';

/**
 * Interface for pill usage logging parameters
 */
export interface LogPillUsageParams {
  pillId: string;
  sessionId: string;
  chatbotId: string;
  sourceChunkIds?: string[];
  prefillText: string;
  sentText: string;
  wasModified?: boolean;
  pairedWithPillId?: string | null;
  userId?: string | null;
}

/**
 * Logs pill usage by creating a Pill_Usage record
 * 
 * This function handles:
 * - Verifying pill and chatbot exist
 * - Creating Pill_Usage record with all metadata
 * - Linking to paired pill if combined (feedback + expansion)
 * 
 * @param {LogPillUsageParams} params - Pill usage parameters
 * @param {string} params.pillId - ID of the pill that was used (required)
 * @param {string} params.sessionId - Conversation/session ID (required)
 * @param {string} params.chatbotId - ID of the chatbot (required)
 * @param {string[]} [params.sourceChunkIds=[]] - Array of chunk IDs from message context
 * @param {string} params.prefillText - Text that was prefilled in input (required)
 * @param {string} params.sentText - Text that was actually sent (required)
 * @param {boolean} [params.wasModified=false] - Whether user modified prefilled text
 * @param {string | null} [params.pairedWithPillId] - ID of paired pill if combined (feedback + expansion)
 * @param {string | null} [params.userId] - Database user ID (optional, for anonymous users)
 * 
 * @returns {Promise<{ success: true; pillUsageId: string }>} Success response with pill usage ID
 * @throws {Error} If pill or chatbot not found, or if database error occurs
 * 
 * @example
 * ```typescript
 * const result = await logPillUsage({
 *   pillId: 'pill-123',
 *   sessionId: 'conversation-456',
 *   chatbotId: 'chatbot-789',
 *   sourceChunkIds: ['chunk-1', 'chunk-2'],
 *   prefillText: 'Helpful',
 *   sentText: 'Helpful',
 *   wasModified: false,
 *   pairedWithPillId: 'pill-456',
 *   userId: 'user-123'
 * });
 * ```
 */
export async function logPillUsage(params: LogPillUsageParams): Promise<{ success: true; pillUsageId: string }> {
  const {
    pillId,
    sessionId,
    chatbotId,
    sourceChunkIds = [],
    prefillText,
    sentText,
    wasModified = false,
    pairedWithPillId = null,
    userId = null,
  } = params;

  // Validate required fields
  if (!pillId || !sessionId || !chatbotId || !prefillText || !sentText) {
    throw new Error('pillId, sessionId, chatbotId, prefillText, and sentText are required');
  }

  // Verify pill exists
  const pill = await prisma.pill.findUnique({
    where: { id: pillId },
    select: { id: true, pillType: true },
  });

  if (!pill) {
    throw new Error('Pill not found');
  }

  // Verify chatbot exists
  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    select: { id: true },
  });

  if (!chatbot) {
    throw new Error('Chatbot not found');
  }

  // Create Pill_Usage record
  const pillUsage = await prisma.pill_Usage.create({
    data: {
      pillId,
      sessionId,
      userId,
      chatbotId,
      sourceChunkIds: Array.isArray(sourceChunkIds) ? sourceChunkIds : [],
      prefillText,
      sentText,
      wasModified,
      pairedWithPillId: pairedWithPillId || null,
    },
  });

  return {
    success: true,
    pillUsageId: pillUsage.id,
  };
}

