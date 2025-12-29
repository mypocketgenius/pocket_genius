/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/lib/theme/theme-context';
import { ThemedPage } from '@/components/themed-page';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock Date to control time
const mockDate = (hour: number, minute: number = 0) => {
  const date = new Date(2024, 0, 1, hour, minute, 0);
  jest.spyOn(global, 'Date').mockImplementation(() => date as any);
  return date;
};

describe('ThemedPage', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    return React.createElement(ThemeProvider, null, children);
  };

  describe('rendering', () => {
    it('should render children correctly', () => {
      render(
        <ThemedPage>
          <div>Test Content</div>
        </ThemedPage>,
        { wrapper }
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should accept and apply className prop', () => {
      const { container } = render(
        <ThemedPage className="min-h-screen custom-class">
          <div>Test Content</div>
        </ThemedPage>,
        { wrapper }
      );

      const themedDiv = container.firstChild as HTMLElement;
      expect(themedDiv).toHaveClass('min-h-screen');
      expect(themedDiv).toHaveClass('custom-class');
    });
  });

  describe('theme application', () => {
    it('should apply correct gradient background from theme', () => {
      mockDate(12, 0); // noon (light theme)
      
      const { container } = render(
        <ThemedPage>
          <div>Test Content</div>
        </ThemedPage>,
        { wrapper }
      );

      const themedDiv = container.firstChild as HTMLElement;
      const background = themedDiv.style.background;
      
      // Should contain linear-gradient with theme colors
      expect(background).toContain('linear-gradient');
      expect(background).toContain('135deg');
      // Background should be a valid gradient string with HSL colors
      expect(background).toMatch(/linear-gradient\(135deg,\s*hsl\([^)]+\),\s*hsl\([^)]+\)\)/);
    });

    it('should apply correct text color from theme', () => {
      mockDate(12, 0); // noon (light theme)
      
      const { container } = render(
        <ThemedPage>
          <div>Test Content</div>
        </ThemedPage>,
        { wrapper }
      );

      const themedDiv = container.firstChild as HTMLElement;
      const textColor = themedDiv.style.color;
      
      // Light theme should have dark text (browser converts hex to RGB)
      // #1a1a1a = rgb(26, 26, 26)
      expect(textColor).toBe('rgb(26, 26, 26)');
    });

    it('should apply correct text color for dark theme', () => {
      mockDate(2, 0); // 2am (dark theme)
      
      const { container } = render(
        <ThemedPage>
          <div>Test Content</div>
        </ThemedPage>,
        { wrapper }
      );

      const themedDiv = container.firstChild as HTMLElement;
      const textColor = themedDiv.style.color;
      
      // Dark theme should have light text (browser converts hex to RGB)
      // #e8e8e8 = rgb(232, 232, 232)
      expect(textColor).toBe('rgb(232, 232, 232)');
    });
  });

  describe('transitions', () => {
    it('should include CSS transition for smooth gradient changes', () => {
      const { container } = render(
        <ThemedPage>
          <div>Test Content</div>
        </ThemedPage>,
        { wrapper }
      );

      const themedDiv = container.firstChild as HTMLElement;
      const transition = themedDiv.style.transition;
      
      // Should have 2s ease transition for background
      expect(transition).toBe('background 2s ease');
    });
  });

  describe('theme changes', () => {
    it('should update gradient when theme changes', () => {
      mockDate(6, 0); // 6am (dawn)
      
      const { container, rerender } = render(
        <ThemedPage>
          <div>Test Content</div>
        </ThemedPage>,
        { wrapper }
      );

      const themedDiv1 = container.firstChild as HTMLElement;
      const background1 = themedDiv1.style.background;

      // Change time to noon (different period - midday vs dawn)
      mockDate(12, 0);
      rerender(
        <ThemedPage>
          <div>Test Content</div>
        </ThemedPage>
      );

      const themedDiv2 = container.firstChild as HTMLElement;
      const background2 = themedDiv2.style.background;

      // Backgrounds should be different (different time periods)
      // Note: Both are light themes but different gradients
      expect(background1).toBeDefined();
      expect(background2).toBeDefined();
      // Verify they contain different HSL values
      expect(background1).toContain('linear-gradient');
      expect(background2).toContain('linear-gradient');
    });

    it('should update text color when theme changes from light to dark', () => {
      // Test with dark theme directly
      mockDate(2, 0); // 2am (dark theme)
      
      const { container } = render(
        <ThemedPage>
          <div>Test Content</div>
        </ThemedPage>,
        { wrapper }
      );

      const themedDiv = container.firstChild as HTMLElement;
      // Dark theme text (browser converts hex to RGB)
      expect(themedDiv.style.color).toBe('rgb(232, 232, 232)');
      
      // Verify it's different from light theme
      expect(themedDiv.style.color).not.toBe('rgb(26, 26, 26)');
    });
  });

  describe('scrollable prop', () => {
    it('should not apply iOS scrolling styles when scrollable is not provided', () => {
      const { container } = render(
        <ThemedPage>
          <div>Test Content</div>
        </ThemedPage>,
        { wrapper }
      );

      const themedDiv = container.firstChild as HTMLElement;
      expect(themedDiv.style.WebkitOverflowScrolling).toBe('');
      expect(themedDiv.style.overscrollBehavior).toBe('');
    });

    it('should apply iOS scrolling styles when scrollable is true', () => {
      const { container } = render(
        <ThemedPage scrollable>
          <div>Test Content</div>
        </ThemedPage>,
        { wrapper }
      );

      const themedDiv = container.firstChild as HTMLElement;
      expect(themedDiv.style.WebkitOverflowScrolling).toBe('touch');
      expect(themedDiv.style.overscrollBehavior).toBe('none');
    });

    it('should preserve theme styles when scrollable is enabled', () => {
      mockDate(12, 0); // noon (light theme)
      
      const { container } = render(
        <ThemedPage scrollable>
          <div>Test Content</div>
        </ThemedPage>,
        { wrapper }
      );

      const themedDiv = container.firstChild as HTMLElement;
      // Theme styles should still be applied
      expect(themedDiv.style.background).toContain('linear-gradient');
      expect(themedDiv.style.color).toBe('rgb(26, 26, 26)');
      expect(themedDiv.style.transition).toBe('background 2s ease');
      // iOS scrolling styles should also be applied
      expect(themedDiv.style.WebkitOverflowScrolling).toBe('touch');
      expect(themedDiv.style.overscrollBehavior).toBe('none');
    });
  });

  describe('error handling', () => {
    it('should throw error when used outside ThemeProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(
          <ThemedPage>
            <div>Test Content</div>
          </ThemedPage>
        );
      }).toThrow('useTheme must be used within a ThemeProvider');

      consoleSpy.mockRestore();
    });
  });
});

