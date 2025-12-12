// lib/pinecone/client.ts
// Phase 2, Task 7: Pinecone client initialization
// Provides singleton Pinecone client instance for vector database operations

import { Pinecone } from '@pinecone-database/pinecone';
import { env } from '@/lib/env';

/**
 * Pinecone client singleton
 * Initialized once and reused across the application
 */
let pineconeClient: Pinecone | null = null;

/**
 * Gets or creates the Pinecone client instance
 * Uses environment variables for API key configuration
 * 
 * @returns Pinecone client instance
 * 
 * @example
 * ```typescript
 * const client = getPineconeClient();
 * const index = client.index('my-index');
 * ```
 */
export function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: env.PINECONE_API_KEY,
    });
  }
  return pineconeClient;
}

/**
 * Gets a Pinecone index instance
 * Convenience function that combines client and index access
 * 
 * @param indexName - Optional index name (defaults to env.PINECONE_INDEX)
 * @returns Pinecone index instance
 * 
 * @example
 * ```typescript
 * const index = getPineconeIndex();
 * const namespace = index.namespace('my-namespace');
 * ```
 */
export function getPineconeIndex(indexName?: string) {
  const client = getPineconeClient();
  return client.index(indexName || env.PINECONE_INDEX);
}
