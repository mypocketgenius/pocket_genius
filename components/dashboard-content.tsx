'use client';

// components/dashboard-content.tsx
// Phase 5, Task 2: Dashboard content component
// Phase 5, Task 4: Updated to use shadcn/ui components
// Displays chunk usage list with sorting, pagination, and chunk text display

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchBar } from '@/components/search-bar';

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
  const router = useRouter();
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'timesUsed' | 'satisfactionRate'>('timesUsed');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [hasInitialLoad, setHasInitialLoad] = useState(false); // Track if initial load completed

  /**
   * Fetches chunk performance data from the API
   * Phase 5, Task 5: Cache chunk text on first dashboard view only
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
        minTimesUsed: '1', // Show all chunks that have been used at least once
        // Only fetch text from Pinecone on initial dashboard view
        // After that, use cached chunkText from database
        fetchText: (!hasInitialLoad).toString(),
      });

      const response = await fetch(`/api/dashboard/${chatbotId}/chunks?${params}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setChunks(data.chunks);
      setPagination(data.pagination);
      
      // Mark initial load as complete after first successful fetch
      if (!hasInitialLoad) {
        setHasInitialLoad(true);
      }
    } catch (err) {
      console.error('Error fetching chunks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chunk data');
    } finally {
      setIsLoading(false);
    }
  }, [page, sortBy, order, chatbotId, hasInitialLoad]);

  // Reset initial load flag when chatbotId changes
  // This ensures chunk text is fetched for each chatbot on first view
  useEffect(() => {
    setHasInitialLoad(false);
  }, [chatbotId]);

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
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors flex-shrink-0"
              aria-label="Go back"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-3xl font-bold">Dashboard</h1>
          </div>
          
          {/* Search bar */}
          <SearchBar
            variant="inline"
          />
        </div>
        <p className="text-muted-foreground">{chatbotTitle}</p>
        
      </div>

      {/* Error message */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Sort controls */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
          <Button
            onClick={() => handleSortChange('timesUsed')}
            variant={sortBy === 'timesUsed' ? 'default' : 'outline'}
            size="sm"
          >
            Times Used {sortBy === 'timesUsed' && (order === 'desc' ? '↓' : '↑')}
          </Button>
          <Button
            onClick={() => handleSortChange('satisfactionRate')}
            variant={sortBy === 'satisfactionRate' ? 'default' : 'outline'}
            size="sm"
          >
            Satisfaction Rate {sortBy === 'satisfactionRate' && (order === 'desc' ? '↓' : '↑')}
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </div>
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Chunks list */}
      {!isLoading && chunks.length === 0 && !error && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">No chunk data available yet.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Chunks will appear here after they&apos;ve been used in conversations.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && chunks.length > 0 && (
        <>
          {/* Chunks grid */}
          <div className="space-y-6">
            {chunks.map((chunk) => (
              <Card key={chunk.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <CardTitle className="text-lg">{chunk.sourceTitle}</CardTitle>
                        {chunk.chunkMetadata?.page && (
                          <Badge variant="outline">Page {chunk.chunkMetadata.page}</Badge>
                        )}
                        {chunk.chunkMetadata?.section && (
                          <Badge variant="secondary">{chunk.chunkMetadata.section}</Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs">
                        Chunk ID: {chunk.chunkId.slice(0, 50)}...
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{chunk.timesUsed}</div>
                      <div className="text-xs text-muted-foreground">times used</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b">
                    <div>
                      <div className="text-sm text-muted-foreground">Helpful</div>
                      <div className="text-lg font-semibold text-green-600">
                        {chunk.helpfulCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Not Helpful</div>
                      <div className="text-lg font-semibold text-destructive">
                        {chunk.notHelpfulCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Satisfaction</div>
                      <div className="text-lg font-semibold text-primary">
                        {formatSatisfactionRate(chunk.satisfactionRate)}
                      </div>
                    </div>
                  </div>

                  {/* Chunk text */}
                  {chunk.chunkText ? (
                    <div className="mt-4">
                      <div className="text-sm font-medium mb-2">Chunk Text:</div>
                      <div className="text-sm text-muted-foreground bg-muted rounded-md p-3 max-h-48 overflow-y-auto">
                        {chunk.chunkText}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 text-sm text-muted-foreground italic">
                      Chunk text unavailable
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <CardDescription className="text-xs">
                    Last updated: {formatDate(chunk.updatedAt)}
                  </CardDescription>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                {pagination.total} chunks
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  variant="outline"
                  size="sm"
                >
                  Previous
                </Button>
                <span className="px-4 py-2 text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= pagination.totalPages}
                  variant="outline"
                  size="sm"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
