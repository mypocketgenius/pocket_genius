// lib/rag/query.ts
// Phase 3, Task 1: RAG query utility
// Generates query embedding and retrieves relevant chunks from Pinecone

import OpenAI from 'openai';
import { generateEmbedding } from '@/lib/embeddings/openai';
import { getPineconeIndex } from '@/lib/pinecone/client';
import { env } from '@/lib/env';

/**
 * Retrieved chunk structure from Pinecone
 * Contains chunk metadata and relevance score
 */
export interface RetrievedChunk {
  chunkId: string;
  sourceId: string;
  text: string;
  page?: number;
  section?: string;
  relevanceScore: number;
}

/**
 * Query Pinecone for relevant chunks using RAG
 * 
 * @param params - Query parameters
 * @param params.query - User's query text
 * @param params.namespace - Pinecone namespace (e.g., "chatbot-{chatbotId}")
 * @param params.topK - Number of top chunks to retrieve (default: 5)
 * @param params.filter - Optional metadata filter for Pinecone query
 * @returns Array of retrieved chunks with metadata
 * 
 * @example
 * ```typescript
 * const chunks = await queryRAG({
 *   query: "What is the art of war?",
 *   namespace: "chatbot-art-of-war",
 *   topK: 5,
 * });
 * ```
 */
export async function queryRAG(params: {
  query: string;
  namespace: string;
  topK?: number;
  filter?: Record<string, any>;
}): Promise<RetrievedChunk[]> {
  const { query, namespace, topK = 5, filter } = params;

  // Validate query is not empty
  if (!query || query.trim().length === 0) {
    throw new Error('Query cannot be empty');
  }

  try {
    // 1. Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // 2. Get Pinecone index instance
    const index = getPineconeIndex(env.PINECONE_INDEX);

    // 3. Query Pinecone namespace (respect PINECONE_USE_NAMESPACES setting)
    // IMPORTANT: Must match the same logic used in upsertWithRetry
    // If namespaces are disabled, use default namespace (empty string)
    const useNamespaces = process.env.PINECONE_USE_NAMESPACES !== 'false';
    const namespaceIndex = useNamespaces 
      ? index.namespace(namespace)
      : index; // Use default namespace if namespaces disabled
    
    const queryResponse = await namespaceIndex.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      ...(filter && { filter }),
    });

    // 4. Transform Pinecone results to RetrievedChunk format
    const chunks: RetrievedChunk[] = queryResponse.matches.map((match) => {
      const metadata = match.metadata || {};
      
      return {
        chunkId: match.id,
        sourceId: metadata.sourceId as string,
        text: metadata.text as string,
        page: metadata.page as number | undefined,
        section: metadata.section as string | undefined,
        relevanceScore: match.score || 0,
      };
    });

    return chunks;
  } catch (error) {
    // Preserve OpenAI API errors so they can be properly handled upstream
    if (error instanceof OpenAI.APIError) {
      // Re-throw OpenAI errors as-is so status codes can be checked
      throw error;
    }
    
    // Provide helpful error messages for other errors
    if (error instanceof Error) {
      throw new Error(`RAG query failed: ${error.message}`);
    }
    throw error;
  }
}
