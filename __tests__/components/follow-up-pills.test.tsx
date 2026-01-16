/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/lib/theme/theme-context';
import { FollowUpPills } from '@/components/follow-up-pills';

// Mock theme hooks
jest.mock('@/lib/theme/theme-context', () => ({
  ...jest.requireActual('@/lib/theme/theme-context'),
  useTheme: jest.fn(),
}));

jest.mock('@/lib/theme/pill-colors', () => ({
  getPillColors: jest.fn(() => ({
    secondaryAccent: 'hsl(200, 50%, 60%)',
    success: 'hsl(150, 40%, 50%)',
    error: 'hsl(10, 50%, 55%)',
    neutral: 'hsl(180, 20%, 50%)',
  })),
}));

jest.mock('@/lib/theme/pill-styles', () => ({
  getSuggestionPillStyles: jest.fn(() => ({
    backgroundColor: 'rgba(200, 200, 200, 0.12)',
    color: 'hsl(200, 50%, 60%)',
    fontWeight: '400',
    padding: '10px 16px',
    borderRadius: '9999px',
    fontSize: '0.875rem',
    border: 'none',
  })),
}));

jest.mock('@/lib/theme/config', () => ({
  getCurrentPeriod: jest.fn(() => 'midday'),
}));

describe('FollowUpPills', () => {
  const mockOnPillClick = jest.fn();
  const defaultProps = {
    pills: ['Tell me more about this', 'Give examples', 'How would I apply this?'],
    messageId: 'msg-123',
    conversationId: 'conv-456',
    chunkIds: ['chunk-1', 'chunk-2'],
    onPillClick: mockOnPillClick,
  };

  const mockTheme = {
    gradient: [0, 0, 0],
    textColor: '#000000',
    theme: 'light' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const { useTheme } = require('@/lib/theme/theme-context');
    useTheme.mockReturnValue(mockTheme);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    return React.createElement(ThemeProvider, null, children);
  };

  describe('rendering', () => {
    it('should render pills correctly', () => {
      render(<FollowUpPills {...defaultProps} />, { wrapper });

      expect(screen.getByText('Tell me more about this')).toBeInTheDocument();
      expect(screen.getByText('Give examples')).toBeInTheDocument();
      expect(screen.getByText('How would I apply this?')).toBeInTheDocument();
    });

    it('should not render when pills array is empty', () => {
      const { container } = render(
        <FollowUpPills {...defaultProps} pills={[]} />,
        { wrapper }
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render correct number of pills', () => {
      const pills = ['Question 1', 'Question 2', 'Question 3', 'Question 4'];
      render(<FollowUpPills {...defaultProps} pills={pills} />, { wrapper });

      pills.forEach(pill => {
        expect(screen.getByText(pill)).toBeInTheDocument();
      });
    });

    it('should have correct aria-label for accessibility', () => {
      render(<FollowUpPills {...defaultProps} />, { wrapper });

      const firstPill = screen.getByText('Tell me more about this');
      expect(firstPill).toHaveAttribute('aria-label', 'Follow-up: Tell me more about this');
    });

    it('should render pills as buttons', () => {
      render(<FollowUpPills {...defaultProps} />, { wrapper });

      const pills = screen.getAllByRole('button');
      expect(pills).toHaveLength(3);
      pills.forEach(pill => {
        expect(pill.tagName).toBe('BUTTON');
      });
    });
  });

  describe('click handling', () => {
    it('should call onPillClick when pill is clicked', () => {
      render(<FollowUpPills {...defaultProps} />, { wrapper });

      const firstPill = screen.getByText('Tell me more about this');
      fireEvent.click(firstPill);

      expect(mockOnPillClick).toHaveBeenCalledTimes(1);
      expect(mockOnPillClick).toHaveBeenCalledWith('Tell me more about this');
    });

    it('should call onPillClick with correct pill text for each pill', () => {
      render(<FollowUpPills {...defaultProps} />, { wrapper });

      const pills = ['Tell me more about this', 'Give examples', 'How would I apply this?'];
      
      pills.forEach(pillText => {
        const pill = screen.getByText(pillText);
        fireEvent.click(pill);
      });

      expect(mockOnPillClick).toHaveBeenCalledTimes(3);
      expect(mockOnPillClick).toHaveBeenNthCalledWith(1, 'Tell me more about this');
      expect(mockOnPillClick).toHaveBeenNthCalledWith(2, 'Give examples');
      expect(mockOnPillClick).toHaveBeenNthCalledWith(3, 'How would I apply this?');
    });

    it('should not call onPillClick when disabled', () => {
      render(<FollowUpPills {...defaultProps} disabled={true} />, { wrapper });

      const firstPill = screen.getByText('Tell me more about this');
      fireEvent.click(firstPill);

      expect(mockOnPillClick).not.toHaveBeenCalled();
    });

    it('should disable buttons when disabled prop is true', () => {
      render(<FollowUpPills {...defaultProps} disabled={true} />, { wrapper });

      const pills = screen.getAllByRole('button');
      pills.forEach(pill => {
        expect(pill).toBeDisabled();
      });
    });

    it('should enable buttons when disabled prop is false', () => {
      render(<FollowUpPills {...defaultProps} disabled={false} />, { wrapper });

      const pills = screen.getAllByRole('button');
      pills.forEach(pill => {
        expect(pill).not.toBeDisabled();
      });
    });

    it('should enable buttons by default when disabled prop is not provided', () => {
      render(<FollowUpPills {...defaultProps} />, { wrapper });

      const pills = screen.getAllByRole('button');
      pills.forEach(pill => {
        expect(pill).not.toBeDisabled();
      });
    });
  });

  describe('styling', () => {
    it('should use suggestion pill styles with isPrimary: true', () => {
      const { getSuggestionPillStyles } = require('@/lib/theme/pill-styles');
      
      render(<FollowUpPills {...defaultProps} />, { wrapper });

      expect(getSuggestionPillStyles).toHaveBeenCalled();
      const callArgs = getSuggestionPillStyles.mock.calls[0];
      
      // Verify isPrimary is true (second argument)
      expect(callArgs[1]).toBe(true);
      // Verify isSelected is false (third argument)
      expect(callArgs[2]).toBe(false);
    });

    it('should apply styles from getSuggestionPillStyles', () => {
      const { getSuggestionPillStyles } = require('@/lib/theme/pill-styles');
      const mockStyles = {
        backgroundColor: 'rgba(200, 200, 200, 0.12)',
        color: 'hsl(200, 50%, 60%)',
        fontWeight: '400',
      };
      
      getSuggestionPillStyles.mockReturnValue(mockStyles);

      render(<FollowUpPills {...defaultProps} />, { wrapper });

      const firstPill = screen.getByText('Tell me more about this');
      expect(firstPill).toHaveStyle(mockStyles);
    });

    it('should have correct CSS classes for layout', () => {
      const { container } = render(<FollowUpPills {...defaultProps} />, { wrapper });

      const pillsContainer = container.querySelector('div');
      expect(pillsContainer).toHaveClass('flex', 'gap-2', 'overflow-x-auto', 'overflow-y-hidden', 'pb-1', 'scrollbar-hide', 'mt-2');
    });

    it('should have correct CSS classes for pills', () => {
      render(<FollowUpPills {...defaultProps} />, { wrapper });

      const pills = screen.getAllByRole('button');
      pills.forEach(pill => {
        expect(pill).toHaveClass(
          'flex-shrink-0',
          'active:scale-95',
          'px-4',
          'py-2',
          'rounded-full',
          'text-sm',
          'font-medium',
          'transition-all'
        );
      });
    });
  });

  describe('edge cases', () => {
    it('should handle single pill', () => {
      render(<FollowUpPills {...defaultProps} pills={['Single question']} />, { wrapper });

      expect(screen.getByText('Single question')).toBeInTheDocument();
      expect(screen.getAllByRole('button')).toHaveLength(1);
    });

    it('should handle many pills (horizontal scroll)', () => {
      const manyPills = Array.from({ length: 10 }, (_, i) => `Question ${i + 1}`);
      render(<FollowUpPills {...defaultProps} pills={manyPills} />, { wrapper });

      expect(screen.getAllByRole('button')).toHaveLength(10);
      manyPills.forEach(pill => {
        expect(screen.getByText(pill)).toBeInTheDocument();
      });
    });

    it('should handle pills with special characters', () => {
      const specialPills = [
        'Tell me more about "strategic positioning"',
        'How about $100?',
        'What\'s next?',
      ];
      
      render(<FollowUpPills {...defaultProps} pills={specialPills} />, { wrapper });

      specialPills.forEach(pill => {
        expect(screen.getByText(pill)).toBeInTheDocument();
      });
    });

    it('should handle very long pill text', () => {
      const longPill = 'This is a very long pill text that might overflow the container and should be handled gracefully';
      render(<FollowUpPills {...defaultProps} pills={[longPill]} />, { wrapper });

      expect(screen.getByText(longPill)).toBeInTheDocument();
    });

    it('should use correct key for each pill (index-based)', () => {
      const { container } = render(<FollowUpPills {...defaultProps} />, { wrapper });

      // React uses keys internally, but we can verify pills render in order
      const pills = screen.getAllByRole('button');
      expect(pills[0]).toHaveTextContent('Tell me more about this');
      expect(pills[1]).toHaveTextContent('Give examples');
      expect(pills[2]).toHaveTextContent('How would I apply this?');
    });
  });

  describe('props validation', () => {
    it('should accept all required props', () => {
      expect(() => {
        render(<FollowUpPills {...defaultProps} />, { wrapper });
      }).not.toThrow();
    });

    it('should handle undefined disabled prop (defaults to false)', () => {
      const propsWithoutDisabled = { ...defaultProps };
      delete (propsWithoutDisabled as any).disabled;

      expect(() => {
        render(<FollowUpPills {...propsWithoutDisabled} />, { wrapper });
      }).not.toThrow();
    });
  });
});

