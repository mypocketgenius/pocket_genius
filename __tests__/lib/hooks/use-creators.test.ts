// __tests__/lib/hooks/use-creators.test.ts
// Task 2: Comprehensive tests for useCreators hook
// Tests creators fetching, loading states, error handling, and refetch functionality

import { renderHook, act, waitFor } from '@testing-library/react';
import { useCreators } from '@/lib/hooks/use-creators';

// Mock fetch globally
global.fetch = jest.fn();

describe('useCreators', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  const mockCreator = {
    id: 'creator-1',
    slug: 'test-creator',
    name: 'Test Creator',
    avatarUrl: 'https://example.com/avatar.jpg',
    bio: 'Test bio',
    chatbotCount: 5,
  };

  describe('Initial fetch', () => {
    it('should fetch creators on mount', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          creators: [mockCreator],
        }),
      });

      const { result } = renderHook(() => useCreators());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.creators).toEqual([]);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/creators');
      expect(result.current.creators).toEqual([mockCreator]);
      expect(result.current.error).toBeNull();
    });

    it('should handle empty creators array', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          creators: [],
        }),
      });

      const { result } = renderHook(() => useCreators());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.creators).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should handle missing creators field', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useCreators());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.creators).toEqual([]);
    });

    it('should handle API error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useCreators());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Unable to load creators. Please try again.');
      expect(result.current.creators).toEqual([]);
    });

    it('should handle non-ok response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useCreators());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Unable to load creators. Please try again.');
    });
  });

  describe('Refetch functionality', () => {
    it('should refetch creators when refetch is called', async () => {
      const initialCreators = [mockCreator];
      const updatedCreators = [{ ...mockCreator, name: 'Updated Creator' }];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            creators: initialCreators,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            creators: updatedCreators,
          }),
        });

      const { result } = renderHook(() => useCreators());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.creators).toEqual(initialCreators);

      act(() => {
        result.current.refetch();
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.creators).toEqual(updatedCreators);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should clear error on successful refetch', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            creators: [mockCreator],
          }),
        });

      const { result } = renderHook(() => useCreators());

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeNull();
      expect(result.current.creators).toEqual([mockCreator]);
    });
  });
});

