import { useState, useEffect, useCallback, useRef } from 'react';
import { Creator } from '@/lib/types/creator';

interface UseCreatorsReturn {
  creators: Creator[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Request deduplication: Track in-flight requests
const inFlightCreatorsRequest = new Map<string, Promise<any>>();

/**
 * Custom hook for fetching creators from `/api/creators`
 * 
 * Features:
 * - Fetches all creators on mount
 * - Manages loading and error states
 * - Provides refetch function for retry functionality
 * - Request deduplication to prevent duplicate API calls
 * - Staggered loading in development (fires first, before chatbot grids)
 * 
 * @returns Object containing creators array, loading state, error state, and refetch function
 */
export function useCreators(): UseCreatorsReturn {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasInitialFetch = useRef(false);

  const fetchCreators = useCallback(async () => {
    const cacheKey = 'creators';
    setIsLoading(true);
    setError(null);

    // Request deduplication
    let requestPromise = inFlightCreatorsRequest.get(cacheKey);

    if (!requestPromise) {
      requestPromise = (async () => {
        try {
          const res = await fetch('/api/creators');
          if (!res.ok) throw new Error('Failed to fetch creators');
          return await res.json();
        } catch (err) {
          console.error('[useCreators] API request failed:', err);
          throw err;
        } finally {
          inFlightCreatorsRequest.delete(cacheKey);
        }
      })();
      inFlightCreatorsRequest.set(cacheKey, requestPromise);
    }

    try {
      const data = await requestPromise;
      setCreators(data.creators || []);
    } catch (err) {
      console.error('[useCreators] Fetch failed:', err);
      setError('Unable to load creators. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-fetch on mount with slight delay in development
  // Creators load first (before chatbot grids) to show content progressively
  useEffect(() => {
    if (hasInitialFetch.current) return;
    hasInitialFetch.current = true;

    // In development: small delay to avoid overwhelming server
    // In production: fire immediately
    const isDevelopment =
      (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') ||
      (typeof window !== 'undefined' && window.location.hostname === 'localhost');
    const delay = isDevelopment ? 50 : 0;

    const timeoutId = setTimeout(() => fetchCreators(), delay);

    return () => {
      clearTimeout(timeoutId);
      hasInitialFetch.current = false;
    };
  }, [fetchCreators]);

  return {
    creators,
    isLoading,
    error,
    refetch: fetchCreators,
  };
}

