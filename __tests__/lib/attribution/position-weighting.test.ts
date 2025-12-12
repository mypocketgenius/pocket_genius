// __tests__/lib/attribution/position-weighting.test.ts
// Phase 6, Task 1: Unit tests for calculateChunkWeights function
// Tests position-based weighting logic for chunk attribution

import { calculateChunkWeights, WeightedChunk } from '@/lib/attribution/position-weighting';

describe('calculateChunkWeights', () => {
  describe('basic functionality', () => {
    it('should weight first chunk highest', () => {
      const chunks: WeightedChunk[] = [
        { chunkId: '1' },
        { chunkId: '2' },
        { chunkId: '3' },
      ];
      const weights = calculateChunkWeights(chunks);
      
      expect(weights.length).toBe(3);
      expect(weights[0]).toBeGreaterThan(weights[1]);
      expect(weights[1]).toBeGreaterThan(weights[2]);
    });

    it('should sum to 1.0', () => {
      const chunks: WeightedChunk[] = [
        { chunkId: '1' },
        { chunkId: '2' },
      ];
      const weights = calculateChunkWeights(chunks);
      
      const sum = weights.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 10); // 10 decimal places precision
    });

    it('should return empty array for empty input', () => {
      const chunks: WeightedChunk[] = [];
      const weights = calculateChunkWeights(chunks);
      
      expect(weights).toEqual([]);
    });

    it('should return [1.0] for single chunk', () => {
      const chunks: WeightedChunk[] = [{ chunkId: '1' }];
      const weights = calculateChunkWeights(chunks);
      
      expect(weights).toEqual([1.0]);
    });
  });

  describe('weight distribution', () => {
    it('should give first chunk approximately 66.7% weight for two chunks', () => {
      const chunks: WeightedChunk[] = [
        { chunkId: '1' },
        { chunkId: '2' },
      ];
      const weights = calculateChunkWeights(chunks);
      
      // First chunk: 1/1 = 1.0
      // Second chunk: 1/2 = 0.5
      // Total: 1.5
      // Normalized: [1.0/1.5, 0.5/1.5] = [0.666..., 0.333...]
      expect(weights[0]).toBeCloseTo(2 / 3, 5);
      expect(weights[1]).toBeCloseTo(1 / 3, 5);
    });

    it('should give correct weights for three chunks', () => {
      const chunks: WeightedChunk[] = [
        { chunkId: '1' },
        { chunkId: '2' },
        { chunkId: '3' },
      ];
      const weights = calculateChunkWeights(chunks);
      
      // Raw weights: [1/1, 1/2, 1/3] = [1.0, 0.5, 0.333...]
      // Total: 1 + 0.5 + 0.333... = 1.833...
      // Normalized: [1.0/1.833, 0.5/1.833, 0.333/1.833]
      const sum = weights.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 10);
      
      // First chunk should have highest weight
      expect(weights[0]).toBeGreaterThan(weights[1]);
      expect(weights[1]).toBeGreaterThan(weights[2]);
    });

    it('should give decreasing weights for more chunks', () => {
      const chunks: WeightedChunk[] = [
        { chunkId: '1' },
        { chunkId: '2' },
        { chunkId: '3' },
        { chunkId: '4' },
        { chunkId: '5' },
      ];
      const weights = calculateChunkWeights(chunks);
      
      // All weights should be decreasing
      for (let i = 0; i < weights.length - 1; i++) {
        expect(weights[i]).toBeGreaterThan(weights[i + 1]);
      }
      
      // Sum should be 1.0
      const sum = weights.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });
  });

  describe('edge cases', () => {
    it('should handle chunks with additional metadata', () => {
      const chunks: WeightedChunk[] = [
        { chunkId: '1', sourceId: 'src1', text: 'Text 1' },
        { chunkId: '2', sourceId: 'src2', text: 'Text 2' },
      ];
      const weights = calculateChunkWeights(chunks);
      
      expect(weights.length).toBe(2);
      expect(weights[0]).toBeGreaterThan(weights[1]);
      
      const sum = weights.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it('should handle many chunks (performance test)', () => {
      const chunks: WeightedChunk[] = Array.from({ length: 100 }, (_, i) => ({
        chunkId: `${i + 1}`,
      }));
      
      const weights = calculateChunkWeights(chunks);
      
      expect(weights.length).toBe(100);
      
      // First chunk should have highest weight
      expect(weights[0]).toBeGreaterThan(weights[1]);
      
      // Last chunk should have lowest weight
      expect(weights[weights.length - 1]).toBeLessThan(weights[0]);
      
      // Sum should be 1.0
      const sum = weights.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });
  });

  describe('mathematical correctness', () => {
    it('should use inverse position weighting (1/position)', () => {
      const chunks: WeightedChunk[] = [
        { chunkId: '1' },
        { chunkId: '2' },
        { chunkId: '3' },
      ];
      const weights = calculateChunkWeights(chunks);
      
      // Raw weights should be [1/1, 1/2, 1/3] = [1.0, 0.5, 0.333...]
      // Total = 1 + 0.5 + 0.333... = 1.833...
      // Normalized weights = [1.0/1.833, 0.5/1.833, 0.333/1.833]
      const expectedRawWeights = [1.0, 0.5, 1 / 3];
      const totalRawWeight = expectedRawWeights.reduce((a, b) => a + b, 0);
      const expectedNormalizedWeights = expectedRawWeights.map(
        (w) => w / totalRawWeight
      );
      
      weights.forEach((weight, index) => {
        expect(weight).toBeCloseTo(expectedNormalizedWeights[index], 5);
      });
    });

    it('should ensure all weights are positive', () => {
      const chunks: WeightedChunk[] = [
        { chunkId: '1' },
        { chunkId: '2' },
        { chunkId: '3' },
      ];
      const weights = calculateChunkWeights(chunks);
      
      weights.forEach((weight) => {
        expect(weight).toBeGreaterThan(0);
      });
    });

    it('should ensure weights are between 0 and 1', () => {
      const chunks: WeightedChunk[] = [
        { chunkId: '1' },
        { chunkId: '2' },
        { chunkId: '3' },
      ];
      const weights = calculateChunkWeights(chunks);
      
      weights.forEach((weight) => {
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('real-world scenarios', () => {
    it('should weight RAG retrieval results correctly', () => {
      // Simulate typical RAG retrieval: top 5 chunks
      const chunks: WeightedChunk[] = [
        { chunkId: 'chunk-1', sourceId: 'src-1', relevanceScore: 0.95 },
        { chunkId: 'chunk-2', sourceId: 'src-1', relevanceScore: 0.87 },
        { chunkId: 'chunk-3', sourceId: 'src-2', relevanceScore: 0.82 },
        { chunkId: 'chunk-4', sourceId: 'src-2', relevanceScore: 0.75 },
        { chunkId: 'chunk-5', sourceId: 'src-3', relevanceScore: 0.68 },
      ];
      
      const weights = calculateChunkWeights(chunks);
      
      expect(weights.length).toBe(5);
      
      // First chunk (most relevant) should get highest weight
      expect(weights[0]).toBeGreaterThan(weights[1]);
      
      // Weights should sum to 1.0
      const sum = weights.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });
  });
});
