// lib/attribution/position-weighting.ts
// Phase 6, Task 1: Position weighting utility for chunk attribution
// Calculates weights for chunks based on their position in retrieval results
// First chunk gets highest weight (most relevant), subsequent chunks get decreasing weights

/**
 * Interface for chunks that need weighting
 * Only requires chunkId for identification, but can include additional metadata
 */
export interface WeightedChunk {
  chunkId: string;
  [key: string]: unknown; // Allow additional properties
}

/**
 * Calculates position-based weights for chunks
 * Uses inverse position weighting: first chunk gets weight 1/1, second gets 1/2, third gets 1/3, etc.
 * Weights are normalized to sum to 1.0
 * 
 * @param chunks - Array of chunks to weight
 * @returns Array of weights corresponding to each chunk position (sums to 1.0)
 * 
 * @example
 * ```typescript
 * const chunks = [{ chunkId: '1' }, { chunkId: '2' }, { chunkId: '3' }];
 * const weights = calculateChunkWeights(chunks);
 * // Returns [0.545, 0.273, 0.182] (approximately)
 * // First chunk gets highest weight, weights sum to 1.0
 * ```
 */
export function calculateChunkWeights(chunks: WeightedChunk[]): number[] {
  // Handle empty array
  if (chunks.length === 0) {
    return [];
  }

  // Handle single chunk - return weight of 1.0
  if (chunks.length === 1) {
    return [1.0];
  }

  // Calculate raw weights using inverse position (1/position)
  // First chunk (index 0) gets weight 1/1 = 1.0
  // Second chunk (index 1) gets weight 1/2 = 0.5
  // Third chunk (index 2) gets weight 1/3 = 0.333...
  const rawWeights = chunks.map((_, index) => 1 / (index + 1));

  // Calculate total weight for normalization
  const totalWeight = rawWeights.reduce((sum, weight) => sum + weight, 0);

  // Normalize weights to sum to 1.0
  const normalizedWeights = rawWeights.map((weight) => weight / totalWeight);

  return normalizedWeights;
}
