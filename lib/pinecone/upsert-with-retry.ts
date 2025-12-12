// lib/pinecone/upsert-with-retry.ts
// Phase 2, Task 7: Upsert vectors to Pinecone with retry logic
// Implements exponential backoff retry strategy for resilient vector upserts

import { getPineconeIndex } from './client';
import { env } from '@/lib/env';

/**
 * Vector record structure for Pinecone upsert
 * Matches Pinecone's expected format for vector data
 */
export interface PineconeVector {
  id: string;
  values: number[];
  metadata?: {
    text: string;
    sourceId: string;
    sourceTitle?: string;
    page?: number;
    section?: string;
    [key: string]: unknown; // Allow additional metadata fields
  };
}

/**
 * Upserts vectors to Pinecone with retry logic and exponential backoff
 * Retries up to maxRetries times if the upsert fails
 * Uses explicit namespace convention: `chatbot-${chatbotId}`
 * 
 * @param vectors - Array of vectors to upsert
 * @param chatbotId - Chatbot ID used to construct namespace
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @throws Error if all retry attempts fail
 * 
 * @example
 * ```typescript
 * const vectors = [
 *   {
 *     id: 'chunk-1',
 *     values: [0.1, 0.2, 0.3, ...],
 *     metadata: { text: '...', sourceId: 'src-1', page: 1 }
 *   }
 * ];
 * await upsertWithRetry(vectors, 'chatbot-123', 3);
 * ```
 */
export async function upsertWithRetry(
  vectors: PineconeVector[],
  chatbotId: string,
  maxRetries: number = 3
): Promise<void> {
  // Validate inputs
  if (!vectors || vectors.length === 0) {
    throw new Error('Vectors array cannot be empty');
  }
  if (!chatbotId || chatbotId.trim().length === 0) {
    throw new Error('chatbotId is required');
  }

  // Use explicit namespace convention to prevent collisions
  // Format: "chatbot-{chatbotId}" (e.g., "chatbot-art-of-war")
  // This prevents collision if you later add other namespace types
  // (e.g., "questions-art-of-war" for future question clustering)
  const namespace = `chatbot-${chatbotId}`;

  // Get Pinecone index instance
  const index = getPineconeIndex(env.PINECONE_INDEX);
  
  // IMPORTANT: Pinecone Starter plan doesn't support namespaces!
  // If you're on Starter plan, use the default namespace (empty string)
  // For production/paid plans, use the namespace
  // Check PINECONE_USE_NAMESPACES env var to control this behavior
  const useNamespaces = process.env.PINECONE_USE_NAMESPACES !== 'false';
  const namespaceIndex = useNamespaces 
    ? index.namespace(namespace)
    : index; // Use default namespace for Starter plan

  // Retry loop with exponential backoff
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Attempt upsert
      await namespaceIndex.upsert(vectors);
      
      // Log success for debugging
      if (attempt === 1) {
        console.log(
          `✅ Successfully upserted ${vectors.length} vectors to Pinecone` +
          (useNamespaces ? ` (namespace: ${namespace})` : ' (default namespace)')
        );
      }
      
      // Success - return immediately
      return;
    } catch (error) {
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(
          `Pinecone upsert failed after ${maxRetries} attempts: ${errorMessage}`
        );
      }

      // Calculate exponential backoff delay
      // Attempt 1: 2^1 * 1000 = 2000ms (2 seconds)
      // Attempt 2: 2^2 * 1000 = 4000ms (4 seconds)
      // Attempt 3: 2^3 * 1000 = 8000ms (8 seconds)
      const delay = Math.pow(2, attempt) * 1000;
      
      console.warn(
        `Pinecone upsert attempt ${attempt} failed. Retrying in ${delay}ms...`,
        error instanceof Error ? error.message : error
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
