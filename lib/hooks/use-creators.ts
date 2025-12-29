import { useState, useEffect, useCallback } from 'react';
import { Creator } from '@/lib/types/creator';

interface UseCreatorsReturn {
  creators: Creator[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Custom hook for fetching creators from `/api/creators`
 * 
 * Features:
 * - Fetches all creators on mount
 * - Manages loading and error states
 * - Provides refetch function for retry functionality
 * 
 * @returns Object containing creators array, loading state, error state, and refetch function
 */
export function useCreators(): UseCreatorsReturn {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCreators = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('[useCreators] Fetching creators...');
      const res = await fetch('/api/creators');
      console.log('[useCreators] Response:', res.status, res.ok);
      if (!res.ok) throw new Error('Failed to fetch creators');
      const data = await res.json();
      console.log('[useCreators] Data:', data);
      setCreators(data.creators || []);
    } catch (err) {
      console.error('Error fetching creators:', err);
      setError('Unable to load creators. Please try again.');
    } finally {
      console.log('[useCreators] Setting isLoading=false');
      setIsLoading(false);
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    fetchCreators();
  }, [fetchCreators]);

  return {
    creators,
    isLoading,
    error,
    refetch: fetchCreators,
  };
}

