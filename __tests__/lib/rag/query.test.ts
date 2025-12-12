// __tests__/lib/rag/query.test.ts
// Unit tests for RAG query utility

import { queryRAG } from '@/lib/rag/query';
import { generateEmbedding } from '@/lib/embeddings/openai';
import { getPineconeIndex } from '@/lib/pinecone/client';

// Mock dependencies
jest.mock('@/lib/embeddings/openai');
jest.mock('@/lib/pinecone/client');

describe('RAG Query', () => {
  const mockIndex = {
    namespace: jest.fn(),
    query: jest.fn(),
  };

  const mockNamespaceIndex = {
    query: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getPineconeIndex as jest.Mock).mockReturnValue(mockIndex);
    mockIndex.namespace.mockReturnValue(mockNamespaceIndex);
    (generateEmbedding as jest.Mock).mockResolvedValue(new Array(1536).fill(0.1));
  });

  it('should query Pinecone with correct parameters', async () => {
    const mockMatches = [
      {
        id: 'chunk-1',
        score: 0.95,
        metadata: {
          text: 'Test chunk 1',
          sourceId: 'source-1',
          page: 1,
        },
      },
      {
        id: 'chunk-2',
        score: 0.90,
        metadata: {
          text: 'Test chunk 2',
          sourceId: 'source-1',
          page: 2,
        },
      },
    ];

    mockNamespaceIndex.query.mockResolvedValue({
      matches: mockMatches,
    });

    const result = await queryRAG({
      query: 'test query',
      namespace: 'chatbot-test',
      topK: 5,
    });

    expect(generateEmbedding).toHaveBeenCalledWith('test query');
    expect(mockIndex.namespace).toHaveBeenCalledWith('chatbot-test');
    expect(mockNamespaceIndex.query).toHaveBeenCalledWith({
      vector: expect.any(Array),
      topK: 5,
      includeMetadata: true,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      chunkId: 'chunk-1',
      sourceId: 'source-1',
      text: 'Test chunk 1',
      page: 1,
      section: undefined,
      relevanceScore: 0.95,
    });
  });

  it('should handle empty query', async () => {
    await expect(
      queryRAG({
        query: '',
        namespace: 'chatbot-test',
      })
    ).rejects.toThrow('Query cannot be empty');
  });

  it('should handle Pinecone errors gracefully', async () => {
    mockNamespaceIndex.query.mockRejectedValue(new Error('Pinecone error'));

    await expect(
      queryRAG({
        query: 'test',
        namespace: 'chatbot-test',
      })
    ).rejects.toThrow('RAG query failed');
  });

  it('should use default topK of 5', async () => {
    mockNamespaceIndex.query.mockResolvedValue({ matches: [] });

    await queryRAG({
      query: 'test',
      namespace: 'chatbot-test',
    });

    expect(mockNamespaceIndex.query).toHaveBeenCalledWith(
      expect.objectContaining({
        topK: 5,
      })
    );
  });

  it('should respect custom topK', async () => {
    mockNamespaceIndex.query.mockResolvedValue({ matches: [] });

    await queryRAG({
      query: 'test',
      namespace: 'chatbot-test',
      topK: 10,
    });

    expect(mockNamespaceIndex.query).toHaveBeenCalledWith(
      expect.objectContaining({
        topK: 10,
      })
    );
  });

  it('should handle optional metadata fields', async () => {
    mockNamespaceIndex.query.mockResolvedValue({
      matches: [
        {
          id: 'chunk-1',
          score: 0.95,
          metadata: {
            text: 'Test',
            sourceId: 'source-1',
            // No page or section
          },
        },
      ],
    });

    const result = await queryRAG({
      query: 'test',
      namespace: 'chatbot-test',
    });

    expect(result[0].page).toBeUndefined();
    expect(result[0].section).toBeUndefined();
  });
});
