// lib/embeddings/index.ts
// Embedding generation using Vercel AI SDK
// Provides utilities for generating embeddings from text for RAG pipeline

import { embed, embedMany } from 'ai';
import { DEFAULT_EMBEDDING_MODEL } from '@/lib/ai/gateway';

/**
 * Generates embeddings for multiple texts in a single API call
 * Uses OpenAI text-embedding-3-small model (1536 dimensions) via Vercel AI SDK
 *
 * @param texts - Array of text strings to embed
 * @returns Array of embedding vectors (each is an array of numbers)
 *
 * @example
 * ```typescript
 * const texts = ['Hello world', 'How are you?'];
 * const embeddings = await generateEmbeddings(texts);
 * // Returns [[0.1, 0.2, ...], [0.3, 0.4, ...]]
 * ```
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  // Validate that all texts are non-empty
  const validTexts = texts.filter((text) => text && text.trim().length > 0);
  if (validTexts.length === 0) {
    throw new Error('At least one non-empty text is required for embedding generation');
  }

  const { embeddings } = await embedMany({
    model: DEFAULT_EMBEDDING_MODEL,
    values: validTexts,
  });

  return embeddings;
}

/**
 * Generates embedding for a single text string
 * Convenience wrapper around generateEmbeddings for single text
 *
 * @param text - Text string to embed
 * @returns Embedding vector (array of numbers)
 *
 * @example
 * ```typescript
 * const embedding = await generateEmbedding('Hello world');
 * // Returns [0.1, 0.2, 0.3, ...] (1536 dimensions)
 * ```
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  const { embedding } = await embed({
    model: DEFAULT_EMBEDDING_MODEL,
    value: text,
  });

  return embedding;
}
