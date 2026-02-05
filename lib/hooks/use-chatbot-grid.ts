import { useState, useEffect, useCallback, useRef } from 'react';
import { Chatbot, ChatbotType } from '@/lib/types/chatbot';

// Pagination type matching API response format
export interface Pagination {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

interface UseChatbotGridReturn {
  chatbots: Chatbot[];
  page: number;
  pagination: Pagination | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  loadMore: () => void;
  retry: () => void;
  syncFavorites: (favorites: Set<string>) => Set<string>;
}

// Request deduplication: Track in-flight requests by cache key
// This prevents duplicate requests if the component re-renders or hooks are called multiple times
const inFlightRequests = new Map<string, Promise<any>>();

// Priority order for chatbot types (used for staggered loading)
// Lower index = higher priority = loads first
const TYPE_PRIORITY: Record<ChatbotType, number> = {
  FRAMEWORK: 0,
  DEEP_DIVE: 1,
  BODY_OF_WORK: 2,
  ADVISOR_BOARD: 3,
};

/**
 * Custom hook for fetching and managing chatbot grids by type
 * 
 * Features:
 * - Fetches chatbots by type from `/api/chatbots/public`
 * - Manages pagination state
 * - Handles loading and error states
 * - Provides "Load More" functionality
 * - Syncs favorites from API responses
 * - Request deduplication to prevent duplicate API calls
 * - Staggered loading in development to avoid overwhelming the dev server
 * 
 * @param type - The chatbot type to fetch (FRAMEWORK, DEEP_DIVE, BODY_OF_WORK, ADVISOR_BOARD)
 * @returns Object containing chatbots array, pagination info, loading states, and control functions
 */
export function useChatbotGrid(type: ChatbotType): UseChatbotGridReturn {
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track if initial fetch has been triggered to prevent duplicate calls
  const hasInitialFetch = useRef(false);

  const fetchChatbotsByType = useCallback(async (pageNum: number, reset: boolean) => {
    const cacheKey = `${type}-${pageNum}`;

    if (reset) {
      setIsLoading(true);
      setError(null);
    } else {
      setIsLoadingMore(true);
    }

    // Check if there's already an in-flight request for this cache key
    // If so, reuse the existing promise to avoid duplicate requests
    let requestPromise = inFlightRequests.get(cacheKey);

    if (!requestPromise) {
      requestPromise = (async () => {
        try {
          const url = `/api/chatbots/public?type=${type}&pageSize=6&page=${pageNum}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed to fetch ${type} chatbots`);
          return await res.json();
        } catch (err) {
          console.error(`[useChatbotGrid:${type}] API request failed:`, err);
          throw err;
        } finally {
          inFlightRequests.delete(cacheKey);
        }
      })();
      inFlightRequests.set(cacheKey, requestPromise);
    }

    try {
      const data = await requestPromise;
      if (reset) {
        setChatbots(data.chatbots);
      } else {
        setChatbots(prev => [...prev, ...data.chatbots]);
      }
      setPagination(data.pagination);
      setPage(pageNum);
      setError(null);
    } catch (err) {
      console.error(`[useChatbotGrid:${type}] Fetch failed:`, err);
      setError(`Unable to load ${type.toLowerCase()}. Please try again.`);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [type]);

  // Auto-fetch on mount with staggered loading
  // Stagger requests in development to avoid overwhelming the dev server
  // In production, requests fire immediately but are still deduplicated
  useEffect(() => {
    if (hasInitialFetch.current) return;
    hasInitialFetch.current = true;

    // Calculate delay based on type priority
    // In development: stagger requests by 200ms per priority level
    const priority = TYPE_PRIORITY[type];
    const isDevelopment =
      (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') ||
      (typeof window !== 'undefined' && window.location.hostname === 'localhost');
    const delay = isDevelopment ? priority * 200 : 0;

    const timeoutId = setTimeout(() => fetchChatbotsByType(1, true), delay);

    return () => {
      clearTimeout(timeoutId);
      hasInitialFetch.current = false;
    };
  }, [type, fetchChatbotsByType]);

  const loadMore = useCallback(() => {
    if (pagination && page < pagination.totalPages) {
      fetchChatbotsByType(page + 1, false);
    }
  }, [pagination, page, fetchChatbotsByType]);

  const retry = useCallback(() => {
    fetchChatbotsByType(1, true); // Reset to page 1 on retry
  }, [fetchChatbotsByType]);

  // Extract favorites from chatbots array and merge with existing favorites
  // This allows parent component to sync favorites from all grids
  const syncFavorites = useCallback((favorites: Set<string>) => {
    const newFavorites = new Set<string>();
    chatbots.forEach(chatbot => {
      if (chatbot.isFavorite) {
        newFavorites.add(chatbot.id);
      }
    });
    // Merge: don't remove existing favorites, only add new ones from this grid
    const merged = new Set(favorites);
    newFavorites.forEach(id => merged.add(id));
    return merged;
  }, [chatbots]);

  return {
    chatbots,
    page,
    pagination,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
    retry,
    syncFavorites,
  };
}

