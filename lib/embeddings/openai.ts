// lib/embeddings/openai.ts
// Phase 2, Task 6: Generate embeddings using OpenAI text-embedding-3-small
// Provides utilities for generating embeddings from text for RAG pipeline

import OpenAI from 'openai';
import { env } from '@/lib/env';

// Initialize OpenAI client with type-safe API key
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

/**
 * Generates embeddings for multiple texts in a single API call
 * Uses OpenAI text-embedding-3-small model (1536 dimensions)
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

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: validTexts,
    });

    // Map response data to array of embedding vectors
    return response.data.map((item) => item.embedding);
  } catch (error) {
    // Preserve OpenAI API errors so they can be properly handled upstream
    // This allows callers to check status codes (e.g., 429 for quota errors)
    if (error instanceof OpenAI.APIError) {
      throw error;
    }
    throw error;
  }
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

  const embeddings = await generateEmbeddings([text]);
  return embeddings[0];
}
