'use client';

// components/dashboard-content.tsx
// Phase 5, Task 2: Dashboard content component
// Displays chunk usage list with sorting, pagination, and chunk text display

import { useState, useEffect, useCallback } from 'react';

interface ChunkMetadata {
  page?: number;
  section?: string;
  sourceTitle?: string;
}

interface Chunk {
  id: string;
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  timesUsed: number;
  helpfulCount: number;
  notHelpfulCount: number;
  satisfactionRate: number;
  chunkText: string | null;
  chunkMetadata: ChunkMetadata | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface DashboardContentProps {
  chatbotId: string;
  chatbotTitle: string;
}

/**
 * Dashboard content component that displays chunk performance data
 * 
 * Features:
 * - Chunk usage list sorted by timesUsed or satisfactionRate
 * - Pagination (20 per page)
 * - Chunk text display (fetched from Pinecone if missing)
 * - Loading states and error handling
 * - Sort controls
 */
export default function DashboardContent({ chatbotId, chatbotTitle }: DashboardContentProps) {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'timesUsed' | 'satisfactionRate'>('timesUsed');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  /**
   * Fetches chunk performance data from the API
   */
  const fetchChunks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
        sortBy,
        order,
        minTimesUsed: '5',
        fetchText: 'true', // Always fetch text on first load
      });

      const response = await fetch(`/api/dashboard/${chatbotId}/chunks?${params}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setChunks(data.chunks);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching chunks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chunk data');
    } finally {
      setIsLoading(false);
    }
  }, [page, sortBy, order, chatbotId]);

  // Fetch chunks when page, sortBy, order, or chatbotId changes
  useEffect(() => {
    fetchChunks();
  }, [fetchChunks]);

  /**
   * Handles sort change
   */
  const handleSortChange = (newSortBy: 'timesUsed' | 'satisfactionRate') => {
    if (newSortBy === sortBy) {
      // Toggle order if clicking same sort
      setOrder(order === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(newSortBy);
      setOrder('desc'); // Default to desc for new sort
    }
    setPage(1); // Reset to first page
  };

  /**
   * Formats satisfaction rate as percentage
   */
  const formatSatisfactionRate = (rate: number): string => {
    return `${(rate * 100).toFixed(1)}%`;
  };

  /**
   * Formats date for display
   */
  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">{chatbotTitle}</p>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Sort controls */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Sort by:</span>
          <button
            onClick={() => handleSortChange('timesUsed')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              sortBy === 'timesUsed'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Times Used {sortBy === 'timesUsed' && (order === 'desc' ? '↓' : '↑')}
          </button>
          <button
            onClick={() => handleSortChange('satisfactionRate')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              sortBy === 'satisfactionRate'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Satisfaction Rate {sortBy === 'satisfactionRate' && (order === 'desc' ? '↓' : '↑')}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading chunk data...</p>
        </div>
      )}

      {/* Chunks list */}
      {!isLoading && chunks.length === 0 && !error && (
        <div className="text-center py-12">
          <p className="text-gray-600">No chunk data available yet.</p>
          <p className="text-sm text-gray-500 mt-2">
            Chunks will appear here after they've been used in conversations.
          </p>
        </div>
      )}

      {!isLoading && chunks.length > 0 && (
        <>
          {/* Chunks grid */}
          <div className="space-y-6">
            {chunks.map((chunk) => (
              <div
                key={chunk.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
              >
                {/* Header row */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {chunk.sourceTitle}
                      </h3>
                      {chunk.chunkMetadata?.page && (
                        <span className="text-sm text-gray-500">
                          Page {chunk.chunkMetadata.page}
                        </span>
                      )}
                      {chunk.chunkMetadata?.section && (
                        <span className="text-sm text-gray-500">
                          • {chunk.chunkMetadata.section}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Chunk ID: {chunk.chunkId.slice(0, 50)}...
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {chunk.timesUsed}
                    </div>
                    <div className="text-xs text-gray-500">times used</div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-200">
                  <div>
                    <div className="text-sm text-gray-600">Helpful</div>
                    <div className="text-lg font-semibold text-green-600">
                      {chunk.helpfulCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Not Helpful</div>
                    <div className="text-lg font-semibold text-red-600">
                      {chunk.notHelpfulCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Satisfaction</div>
                    <div className="text-lg font-semibold text-blue-600">
                      {formatSatisfactionRate(chunk.satisfactionRate)}
                    </div>
                  </div>
                </div>

                {/* Chunk text */}
                {chunk.chunkText ? (
                  <div className="mt-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">Chunk Text:</div>
                    <div className="text-sm text-gray-600 bg-gray-50 rounded-md p-3 max-h-48 overflow-y-auto">
                      {chunk.chunkText}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-gray-500 italic">
                    Chunk text unavailable
                  </div>
                )}

                {/* Footer */}
                <div className="mt-4 text-xs text-gray-500">
                  Last updated: {formatDate(chunk.updatedAt)}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                {pagination.total} chunks
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    page === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-gray-700">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= pagination.totalPages}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    page >= pagination.totalPages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
