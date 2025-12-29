// __tests__/lib/hooks/use-chatbot-grid.test.ts
// Task 2: Comprehensive tests for useChatbotGrid hook
// Tests chatbot grid fetching, pagination, loading states, error handling, and favorites sync

import { renderHook, act, waitFor } from '@testing-library/react';
import { useChatbotGrid } from '@/lib/hooks/use-chatbot-grid';
import { ChatbotType } from '@/lib/types/chatbot';

// Mock fetch globally
global.fetch = jest.fn();

describe('useChatbotGrid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  const mockChatbot = {
    id: 'test-id',
    name: 'Test Chatbot',
    slug: 'test-chatbot',
    description: 'Test description',
    avatarUrl: null,
    type: 'FRAMEWORK' as ChatbotType,
    favoriteCount: 0,
    isFavorite: false,
  };

  const mockPagination = {
    page: 1,
    pageSize: 6,
    totalPages: 2,
    totalItems: 12,
  };

  describe('Initial fetch', () => {
    it('should fetch chatbots on mount', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chatbots: [mockChatbot],
          pagination: mockPagination,
        }),
      });

      const { result } = renderHook(() => useChatbotGrid('FRAMEWORK'));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.chatbots).toEqual([]);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/chatbots/public?type=FRAMEWORK&pageSize=6&page=1'
      );
      expect(result.current.chatbots).toEqual([mockChatbot]);
      expect(result.current.pagination).toEqual(mockPagination);
      expect(result.current.page).toBe(1);
      expect(result.current.error).toBeNull();
    });

    it('should handle API error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useChatbotGrid('FRAMEWORK'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Unable to load framework. Please try again.');
      expect(result.current.chatbots).toEqual([]);
    });

    it('should handle non-ok response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useChatbotGrid('DEEP_DIVE'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Unable to load deep_dive. Please try again.');
    });
  });

  describe('Load More functionality', () => {
    it('should load more chatbots when loadMore is called', async () => {
      const page1Chatbots = [{ ...mockChatbot, id: '1' }];
      const page2Chatbots = [{ ...mockChatbot, id: '2' }];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            chatbots: page1Chatbots,
            pagination: { ...mockPagination, page: 1 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            chatbots: page2Chatbots,
            pagination: { ...mockPagination, page: 2 },
          }),
        });

      const { result } = renderHook(() => useChatbotGrid('FRAMEWORK'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.chatbots).toEqual(page1Chatbots);

      act(() => {
        result.current.loadMore();
      });

      expect(result.current.isLoadingMore).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoadingMore).toBe(false);
      });

      expect(result.current.chatbots).toEqual([...page1Chatbots, ...page2Chatbots]);
      expect(result.current.page).toBe(2);
    });

    it('should not load more if already on last page', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chatbots: [mockChatbot],
          pagination: { ...mockPagination, page: 1, totalPages: 1 },
        }),
      });

      const { result } = renderHook(() => useChatbotGrid('FRAMEWORK'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = (global.fetch as jest.Mock).mock.calls.length;

      act(() => {
        result.current.loadMore();
      });

      // Should not make another fetch call
      await waitFor(() => {
        expect((global.fetch as jest.Mock).mock.calls.length).toBe(initialCallCount);
      });
    });
  });

  describe('Retry functionality', () => {
    it('should reset to page 1 on retry', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            chatbots: [mockChatbot],
            pagination: mockPagination,
          }),
        });

      const { result } = renderHook(() => useChatbotGrid('FRAMEWORK'));

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      act(() => {
        result.current.retry();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeNull();
      expect(result.current.chatbots).toEqual([mockChatbot]);
      expect(result.current.page).toBe(1);
    });
  });

  describe('Favorites sync', () => {
    it('should sync favorites from chatbots array', async () => {
      const chatbotWithFavorite = { ...mockChatbot, id: 'fav-1', isFavorite: true };
      const chatbotWithoutFavorite = { ...mockChatbot, id: 'fav-2', isFavorite: false };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chatbots: [chatbotWithFavorite, chatbotWithoutFavorite],
          pagination: mockPagination,
        }),
      });

      const { result } = renderHook(() => useChatbotGrid('FRAMEWORK'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const existingFavorites = new Set<string>(['existing-id']);
      const syncedFavorites = result.current.syncFavorites(existingFavorites);

      expect(syncedFavorites.has('fav-1')).toBe(true);
      expect(syncedFavorites.has('fav-2')).toBe(false);
      expect(syncedFavorites.has('existing-id')).toBe(true); // Should preserve existing
    });

    it('should merge favorites without removing existing ones', async () => {
      const chatbotWithFavorite = { ...mockChatbot, id: 'new-fav', isFavorite: true };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chatbots: [chatbotWithFavorite],
          pagination: mockPagination,
        }),
      });

      const { result } = renderHook(() => useChatbotGrid('FRAMEWORK'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const existingFavorites = new Set<string>(['existing-1', 'existing-2']);
      const syncedFavorites = result.current.syncFavorites(existingFavorites);

      expect(syncedFavorites.size).toBe(3);
      expect(syncedFavorites.has('existing-1')).toBe(true);
      expect(syncedFavorites.has('existing-2')).toBe(true);
      expect(syncedFavorites.has('new-fav')).toBe(true);
    });
  });

  describe('Different chatbot types', () => {
    it('should fetch correct type for FRAMEWORK', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chatbots: [],
          pagination: mockPagination,
        }),
      });

      renderHook(() => useChatbotGrid('FRAMEWORK'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/chatbots/public?type=FRAMEWORK&pageSize=6&page=1'
        );
      });
    });

    it('should fetch correct type for DEEP_DIVE', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chatbots: [],
          pagination: mockPagination,
        }),
      });

      renderHook(() => useChatbotGrid('DEEP_DIVE'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/chatbots/public?type=DEEP_DIVE&pageSize=6&page=1'
        );
      });
    });

    it('should fetch correct type for BODY_OF_WORK', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chatbots: [],
          pagination: mockPagination,
        }),
      });

      renderHook(() => useChatbotGrid('BODY_OF_WORK'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/chatbots/public?type=BODY_OF_WORK&pageSize=6&page=1'
        );
      });
    });

    it('should fetch correct type for ADVISOR_BOARD', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chatbots: [],
          pagination: mockPagination,
        }),
      });

      renderHook(() => useChatbotGrid('ADVISOR_BOARD'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/chatbots/public?type=ADVISOR_BOARD&pageSize=6&page=1'
        );
      });
    });
  });
});

