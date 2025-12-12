// __tests__/components/dashboard-content.test.tsx
// Phase 5: Tests for dashboard content component
// Tests UI rendering, data fetching, sorting, pagination, and error handling

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardContent from '@/components/dashboard-content';

// Mock fetch globally
global.fetch = jest.fn();

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

describe('DashboardContent Component', () => {
  const mockChatbotId = 'chatbot_test_123';
  const mockChatbotTitle = 'Test Chatbot';

  const mockChunk = {
    id: 'chunk_perf_1',
    chunkId: 'chunk_123',
    sourceId: 'source_123',
    sourceTitle: 'Test Source',
    timesUsed: 10,
    helpfulCount: 5,
    notHelpfulCount: 2,
    satisfactionRate: 0.714,
    chunkText: 'Test chunk text content',
    chunkMetadata: {
      page: 1,
      section: 'Introduction',
    },
    createdAt: '2024-12-01T00:00:00Z',
    updatedAt: '2024-12-15T00:00:00Z',
  };

  const mockPagination = {
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('Initial Load', () => {
    it('should display loading skeleton while fetching data', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    chunks: [],
                    pagination: mockPagination,
                  }),
                }),
              100
            )
          )
      );

      render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      // Should show loading skeletons (check for Skeleton component)
      const skeletons = screen.container.querySelectorAll('[class*="animate-pulse"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should fetch chunks on mount with default parameters', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          chunks: [mockChunk],
          pagination: mockPagination,
        }),
      });

      render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/dashboard/${mockChatbotId}/chunks`)
        );
      });

      const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      const url = new URL(fetchUrl);
      expect(url.searchParams.get('page')).toBe('1');
      expect(url.searchParams.get('pageSize')).toBe('20');
      expect(url.searchParams.get('sortBy')).toBe('timesUsed');
      expect(url.searchParams.get('order')).toBe('desc');
      expect(url.searchParams.get('minTimesUsed')).toBe('5');
      expect(url.searchParams.get('fetchText')).toBe('true'); // First load should fetch text
    });

    it('should display chatbot title', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          chunks: [],
          pagination: mockPagination,
        }),
      });

      render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(mockChatbotTitle)).toBeInTheDocument();
      });
    });
  });

  describe('Data Display', () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          chunks: [mockChunk],
          pagination: mockPagination,
        }),
      });
    });

    it('should display chunk data correctly', async () => {
      render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Source')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument(); // timesUsed
        expect(screen.getByText('5')).toBeInTheDocument(); // helpfulCount
        expect(screen.getByText('2')).toBeInTheDocument(); // notHelpfulCount
        expect(screen.getByText('71.4%')).toBeInTheDocument(); // satisfactionRate
        expect(screen.getByText('Test chunk text content')).toBeInTheDocument();
      });
    });

    it('should display chunk metadata badges', async () => {
      render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Page 1')).toBeInTheDocument();
        expect(screen.getByText('Introduction')).toBeInTheDocument();
      });
    });

    it('should display "Chunk text unavailable" when chunkText is null', async () => {
      const chunkWithoutText = {
        ...mockChunk,
        chunkText: null,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          chunks: [chunkWithoutText],
          pagination: mockPagination,
        }),
      });

      render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByText('Chunk text unavailable')
        ).toBeInTheDocument();
      });
    });

    it('should display empty state when no chunks available', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          chunks: [],
          pagination: { ...mockPagination, total: 0 },
        }),
      });

      render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByText('No chunk data available yet.')
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            "Chunks will appear here after they've been used in conversations."
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe('Sorting', () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          chunks: [mockChunk],
          pagination: mockPagination,
        }),
      });
    });

    it('should change sort to satisfactionRate when clicked', async () => {
      render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Times Used')).toBeInTheDocument();
      });

      const satisfactionButton = screen.getByText(/Satisfaction Rate/);
      fireEvent.click(satisfactionButton);

      await waitFor(() => {
        const fetchUrl = (global.fetch as jest.Mock).mock.calls[1][0];
        const url = new URL(fetchUrl);
        expect(url.searchParams.get('sortBy')).toBe('satisfactionRate');
      });
    });

    it('should toggle order when clicking same sort button', async () => {
      render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Times Used')).toBeInTheDocument();
      });

      const timesUsedButton = screen.getByText(/Times Used/);
      
      // First click should toggle to asc
      fireEvent.click(timesUsedButton);
      
      await waitFor(() => {
        const fetchUrl = (global.fetch as jest.Mock).mock.calls[1][0];
        const url = new URL(fetchUrl);
        expect(url.searchParams.get('order')).toBe('asc');
      });

      // Second click should toggle back to desc
      fireEvent.click(timesUsedButton);
      
      await waitFor(() => {
        const fetchUrl = (global.fetch as jest.Mock).mock.calls[2][0];
        const url = new URL(fetchUrl);
        expect(url.searchParams.get('order')).toBe('desc');
      });
    });

    it('should reset to page 1 when sort changes', async () => {
      // Set up with page 2
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          chunks: [mockChunk],
          pagination: { ...mockPagination, page: 2 },
        }),
      });

      render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Times Used/)).toBeInTheDocument();
      });

      const satisfactionButton = screen.getByText(/Satisfaction Rate/);
      fireEvent.click(satisfactionButton);

      await waitFor(() => {
        const fetchUrl = (global.fetch as jest.Mock).mock.calls[1][0];
        const url = new URL(fetchUrl);
        expect(url.searchParams.get('page')).toBe('1');
      });
    });
  });

  describe('Pagination', () => {
    const mockPaginationMultiPage = {
      page: 1,
      pageSize: 20,
      total: 50,
      totalPages: 3,
    };

    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          chunks: [mockChunk],
          pagination: mockPaginationMultiPage,
        }),
      });
    });

    it('should display pagination controls when totalPages > 1', async () => {
      render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
        expect(screen.getByText(/Showing 1 to/)).toBeInTheDocument();
      });
    });

    it('should navigate to next page when Next button is clicked', async () => {
      render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Next')).toBeInTheDocument();
      });

      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      await waitFor(() => {
        const fetchUrl = (global.fetch as jest.Mock).mock.calls[1][0];
        const url = new URL(fetchUrl);
        expect(url.searchParams.get('page')).toBe('2');
      });
    });

    it('should navigate to previous page when Previous button is clicked', async () => {
      // Start on page 2
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          chunks: [mockChunk],
          pagination: { ...mockPaginationMultiPage, page: 2 },
        }),
      });

      render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Previous')).toBeInTheDocument();
      });

      const previousButton = screen.getByText('Previous');
      fireEvent.click(previousButton);

      await waitFor(() => {
        const fetchUrl = (global.fetch as jest.Mock).mock.calls[1][0];
        const url = new URL(fetchUrl);
        expect(url.searchParams.get('page')).toBe('1');
      });
    });

    it('should disable Previous button on first page', async () => {
      render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      await waitFor(() => {
        const previousButton = screen.getByText('Previous');
        expect(previousButton).toBeDisabled();
      });
    });

    it('should disable Next button on last page', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          chunks: [mockChunk],
          pagination: { ...mockPaginationMultiPage, page: 3 },
        }),
      });

      render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      await waitFor(() => {
        const nextButton = screen.getByText('Next');
        expect(nextButton).toBeDisabled();
      });
    });

    it('should not show pagination when totalPages <= 1', async () => {
      render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Previous')).not.toBeInTheDocument();
        expect(screen.queryByText('Next')).not.toBeInTheDocument();
      });
    });
  });

  describe('Chunk Text Caching (Phase 5, Task 5)', () => {
    it('should fetch chunk text on initial load (fetchText=true)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          chunks: [mockChunk],
          pagination: mockPagination,
        }),
      });

      render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      await waitFor(() => {
        const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
        const url = new URL(fetchUrl);
        expect(url.searchParams.get('fetchText')).toBe('true');
      });
    });

    it('should not fetch chunk text on subsequent loads (fetchText=false)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          chunks: [mockChunk],
          pagination: mockPagination,
        }),
      });

      render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Source')).toBeInTheDocument();
      });

      // Change sort (should not fetch text)
      const satisfactionButton = screen.getByText(/Satisfaction Rate/);
      fireEvent.click(satisfactionButton);

      await waitFor(() => {
        const fetchUrl = (global.fetch as jest.Mock).mock.calls[1][0];
        const url = new URL(fetchUrl);
        expect(url.searchParams.get('fetchText')).toBe('false');
      });
    });

    it('should reset fetchText when chatbotId changes', async () => {
      const { rerender } = render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Change chatbotId
      rerender(
        <DashboardContent
          chatbotId="chatbot_new_123"
          chatbotTitle="New Chatbot"
        />
      );

      await waitFor(() => {
        const fetchUrl = (global.fetch as jest.Mock).mock.calls[
          (global.fetch as jest.Mock).mock.calls.length - 1
        ][0];
        const url = new URL(fetchUrl);
        expect(url.searchParams.get('fetchText')).toBe('true');
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when API request fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({
          error: 'Failed to fetch chunk data',
        }),
      });

      render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(
          screen.getByText(/Failed to fetch chunk data/)
        ).toBeInTheDocument();
      });
    });

    it('should display error message when network error occurs', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });
    });

    it('should handle 401 authentication error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'Authentication required',
        }),
      });

      render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Authentication required/)).toBeInTheDocument();
      });
    });
  });

  describe('Date Formatting', () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          chunks: [mockChunk],
          pagination: mockPagination,
        }),
      });
    });

    it('should format dates correctly', async () => {
      render(
        <DashboardContent
          chatbotId={mockChatbotId}
          chatbotTitle={mockChatbotTitle}
        />
      );

      await waitFor(() => {
        // Check that date is displayed (format may vary by locale)
        const dateText = screen.getByText(/Dec/);
        expect(dateText).toBeInTheDocument();
      });
    });
  });
});
