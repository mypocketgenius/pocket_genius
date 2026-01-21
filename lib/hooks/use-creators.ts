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
    const fetchStartTime = Date.now();
    const cacheKey = 'creators';
    
    console.log(`[useCreators] Starting fetch - cacheKey: ${cacheKey}, timestamp: ${new Date().toISOString()}`);
    setIsLoading(true);
    setError(null);
    
    // Request deduplication
    let requestPromise = inFlightCreatorsRequest.get(cacheKey);
    
    if (!requestPromise) {
      console.log(`[useCreators] Creating new request for ${cacheKey}`);
      requestPromise = (async () => {
        const apiStartTime = Date.now();
        try {
          console.log(`[useCreators] Fetching from API: /api/creators`);
          const res = await fetch('/api/creators');
          const apiTime = Date.now() - apiStartTime;
          console.log(`[useCreators] API response received in ${apiTime}ms, status: ${res.status}`);
          
          if (!res.ok) throw new Error('Failed to fetch creators');
          const data = await res.json();
          console.log(`[useCreators] API data parsed, creators: ${data.creators?.length || 0}, totalTime: ${Date.now() - apiStartTime}ms`);
          return data;
        } catch (err) {
          const apiTime = Date.now() - apiStartTime;
          console.error(`[useCreators] API request failed after ${apiTime}ms:`, err);
          throw err;
        } finally {
          inFlightCreatorsRequest.delete(cacheKey);
          console.log(`[useCreators] Removed ${cacheKey} from in-flight requests`);
        }
      })();
      inFlightCreatorsRequest.set(cacheKey, requestPromise);
    } else {
      console.log(`[useCreators] Reusing in-flight request for ${cacheKey}`);
    }
    
    try {
      const data = await requestPromise;
      const totalTime = Date.now() - fetchStartTime;
      setCreators(data.creators || []);
      console.log(`[useCreators] Fetch completed successfully - creators: ${data.creators?.length || 0}, totalTime: ${totalTime}ms`);
    } catch (err) {
      const totalTime = Date.now() - fetchStartTime;
      console.error(`[useCreators] Fetch failed after ${totalTime}ms:`, err);
      setError('Unable to load creators. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-fetch on mount with slight delay in development
  // Creators load first (before chatbot grids) to show content progressively
  useEffect(() => {
    if (hasInitialFetch.current) {
      console.log(`[useCreators] Skipping duplicate initial fetch`);
      return;
    }
    hasInitialFetch.current = true;
    
    // In development: small delay to avoid overwhelming server
    // In production: fire immediately
    const processEnv = typeof process !== 'undefined' ? process.env.NODE_ENV : 'undefined';
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'undefined';
    const isDevelopment = 
      (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') ||
      (typeof window !== 'undefined' && window.location.hostname === 'localhost');
    const delay = isDevelopment ? 50 : 0; // Small delay, fires before chatbot grids
    
    console.log(`[useCreators] Mounting hook - process.env.NODE_ENV: ${processEnv}, hostname: ${hostname}, isDevelopment: ${isDevelopment}, delay: ${delay}ms`);
    
    const timeoutId = setTimeout(() => {
      console.log(`[useCreators] Delay completed, starting fetch after ${delay}ms delay`);
      fetchCreators();
    }, delay);
    
    return () => {
      clearTimeout(timeoutId);
      hasInitialFetch.current = false;
      console.log(`[useCreators] Unmounting hook`);
    };
  }, [fetchCreators]);

  return {
    creators,
    isLoading,
    error,
    refetch: fetchCreators,
  };
}

