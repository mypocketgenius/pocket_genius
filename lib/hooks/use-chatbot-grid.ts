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
    const fetchStartTime = Date.now();
    const cacheKey = `${type}-${pageNum}`;
    
    console.log(`[useChatbotGrid:${type}] Starting fetch - page: ${pageNum}, reset: ${reset}, cacheKey: ${cacheKey}, timestamp: ${new Date().toISOString()}`);
    
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
      console.log(`[useChatbotGrid:${type}] Creating new request for ${cacheKey}`);
      // Create new request promise
      requestPromise = (async () => {
        const apiStartTime = Date.now();
        try {
          const url = `/api/chatbots/public?type=${type}&pageSize=6&page=${pageNum}`;
          console.log(`[useChatbotGrid:${type}] Fetching from API: ${url}`);
          const res = await fetch(url);
          
          const apiTime = Date.now() - apiStartTime;
          console.log(`[useChatbotGrid:${type}] API response received in ${apiTime}ms, status: ${res.status}`);
          
          if (!res.ok) {
            throw new Error(`Failed to fetch ${type} chatbots`);
          }
          
          const data = await res.json();
          console.log(`[useChatbotGrid:${type}] API data parsed, chatbots: ${data.chatbots?.length || 0}, totalTime: ${Date.now() - apiStartTime}ms`);
          return data;
        } catch (err) {
          const apiTime = Date.now() - apiStartTime;
          console.error(`[useChatbotGrid:${type}] API request failed after ${apiTime}ms:`, err);
          throw err;
        } finally {
          // Remove from in-flight requests when done (success or error)
          inFlightRequests.delete(cacheKey);
          console.log(`[useChatbotGrid:${type}] Removed ${cacheKey} from in-flight requests`);
        }
      })();
      
      // Store the promise for deduplication
      inFlightRequests.set(cacheKey, requestPromise);
    } else {
      console.log(`[useChatbotGrid:${type}] Reusing in-flight request for ${cacheKey}`);
    }
    
    try {
      const data = await requestPromise;
      const totalTime = Date.now() - fetchStartTime;
      
      if (reset) {
        setChatbots(data.chatbots);
      } else {
        setChatbots(prev => [...prev, ...data.chatbots]);
      }
      
      setPagination(data.pagination);
      setPage(pageNum);
      setError(null);
      console.log(`[useChatbotGrid:${type}] Fetch completed successfully - chatbots: ${data.chatbots?.length || 0}, totalTime: ${totalTime}ms`);
    } catch (err) {
      const totalTime = Date.now() - fetchStartTime;
      console.error(`[useChatbotGrid:${type}] Fetch failed after ${totalTime}ms:`, err);
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
    // Prevent duplicate initial fetches within the same effect run
    if (hasInitialFetch.current) {
      console.log(`[useChatbotGrid:${type}] Skipping duplicate initial fetch`);
      return;
    }
    hasInitialFetch.current = true;
    
    // Calculate delay based on type priority
    // In development: stagger requests by 200ms per priority level
    // This prevents overwhelming the dev server with 4 simultaneous requests
    // In production: no delay (but deduplication still applies)
    // Check for development mode: Next.js replaces NODE_ENV at build time, or check hostname as fallback
    const priority = TYPE_PRIORITY[type];
    const processEnv = typeof process !== 'undefined' ? process.env.NODE_ENV : 'undefined';
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'undefined';
    const isDevelopment = 
      (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') ||
      (typeof window !== 'undefined' && window.location.hostname === 'localhost');
    const delay = isDevelopment ? priority * 200 : 0;
    
    console.log(`[useChatbotGrid:${type}] Mounting hook - priority: ${priority}, process.env.NODE_ENV: ${processEnv}, hostname: ${hostname}, isDevelopment: ${isDevelopment}, delay: ${delay}ms`);
    
    const timeoutId = setTimeout(() => {
      console.log(`[useChatbotGrid:${type}] Delay completed, starting fetch after ${delay}ms delay`);
      fetchChatbotsByType(1, true);
    }, delay);
    
    return () => {
      clearTimeout(timeoutId);
      // Reset on unmount so component can fetch again if remounted
      hasInitialFetch.current = false;
      console.log(`[useChatbotGrid:${type}] Unmounting hook`);
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

