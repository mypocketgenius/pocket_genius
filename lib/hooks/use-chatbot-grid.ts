import { useState, useEffect, useCallback } from 'react';
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

/**
 * Custom hook for fetching and managing chatbot grids by type
 * 
 * Features:
 * - Fetches chatbots by type from `/api/chatbots/public`
 * - Manages pagination state
 * - Handles loading and error states
 * - Provides "Load More" functionality
 * - Syncs favorites from API responses
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

  const fetchChatbotsByType = useCallback(async (pageNum: number, reset: boolean) => {
    if (reset) {
      setIsLoading(true);
      setError(null);
    } else {
      setIsLoadingMore(true);
    }
    
    try {
      const res = await fetch(`/api/chatbots/public?type=${type}&pageSize=6&page=${pageNum}`);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch ${type} chatbots`);
      }
      
      const data = await res.json();
      
      if (reset) {
        setChatbots(data.chatbots);
      } else {
        setChatbots(prev => [...prev, ...data.chatbots]);
      }
      
      setPagination(data.pagination);
      setPage(pageNum);
      setError(null);
    } catch (err) {
      console.error(`Error fetching ${type}:`, err);
      setError(`Unable to load ${type.toLowerCase()}. Please try again.`);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [type]);

  // Auto-fetch on mount - fires independently for each hook instance
  useEffect(() => {
    fetchChatbotsByType(1, true);
  }, [fetchChatbotsByType]);

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

