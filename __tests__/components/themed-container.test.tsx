/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/lib/theme/theme-context';
import { ThemedContainer } from '@/components/themed-container';

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

describe('ThemedContainer', () => {
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
        <ThemedContainer>
          <div>Test Content</div>
        </ThemedContainer>,
        { wrapper }
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should accept and apply className prop', () => {
      const { container } = render(
        <ThemedContainer className="p-4 rounded-lg custom-class">
          <div>Test Content</div>
        </ThemedContainer>,
        { wrapper }
      );

      const containerDiv = container.firstChild as HTMLElement;
      expect(containerDiv).toHaveClass('p-4');
      expect(containerDiv).toHaveClass('rounded-lg');
      expect(containerDiv).toHaveClass('custom-class');
    });
  });

  describe('variant: default', () => {
    it('should have transparent background for default variant', () => {
      const { container } = render(
        <ThemedContainer variant="default">
          <div>Test Content</div>
        </ThemedContainer>,
        { wrapper }
      );

      const containerDiv = container.firstChild as HTMLElement;
      expect(containerDiv.style.backgroundColor).toBe('transparent');
    });

    it('should apply text color from theme', () => {
      mockDate(12, 0); // noon (light theme)
      
      const { container } = render(
        <ThemedContainer variant="default">
          <div>Test Content</div>
        </ThemedContainer>,
        { wrapper }
      );

      const containerDiv = container.firstChild as HTMLElement;
      // Light theme should have dark text (browser converts hex to RGB)
      expect(containerDiv.style.color).toBe('rgb(26, 26, 26)');
    });

    it('should apply border color from theme', () => {
      const { container } = render(
        <ThemedContainer variant="default">
          <div>Test Content</div>
        </ThemedContainer>,
        { wrapper }
      );

      const containerDiv = container.firstChild as HTMLElement;
      const borderColor = containerDiv.style.borderColor;
      // Border color should be defined (HSL format)
      expect(borderColor).toBeDefined();
      expect(borderColor).not.toBe('');
    });
  });

  describe('variant: card', () => {
    it('should use gradient end color for card variant', () => {
      const { container } = render(
        <ThemedContainer variant="card">
          <div>Test Content</div>
        </ThemedContainer>,
        { wrapper }
      );

      const containerDiv = container.firstChild as HTMLElement;
      const backgroundColor = containerDiv.style.backgroundColor;
      
      // Card should use gradient end color (browser converts HSL to RGB)
      expect(backgroundColor).toBeDefined();
      expect(backgroundColor).not.toBe('transparent');
      // Should be a valid color (RGB format after browser conversion)
      expect(backgroundColor).toMatch(/^(rgb|rgba)\(/);
    });

    it('should apply text color from theme', () => {
      mockDate(12, 0); // noon (light theme)
      
      const { container } = render(
        <ThemedContainer variant="card">
          <div>Test Content</div>
        </ThemedContainer>,
        { wrapper }
      );

      const containerDiv = container.firstChild as HTMLElement;
      // Light theme should have dark text (browser converts hex to RGB)
      expect(containerDiv.style.color).toBe('rgb(26, 26, 26)');
    });

    it('should apply border color from theme', () => {
      const { container } = render(
        <ThemedContainer variant="card">
          <div>Test Content</div>
        </ThemedContainer>,
        { wrapper }
      );

      const containerDiv = container.firstChild as HTMLElement;
      const borderColor = containerDiv.style.borderColor;
      // Border color should be defined
      expect(borderColor).toBeDefined();
      expect(borderColor).not.toBe('');
    });
  });

  describe('variant: input', () => {
    it('should use theme.chrome.input for input variant', () => {
      const { container } = render(
        <ThemedContainer variant="input">
          <div>Test Content</div>
        </ThemedContainer>,
        { wrapper }
      );

      const containerDiv = container.firstChild as HTMLElement;
      const backgroundColor = containerDiv.style.backgroundColor;
      
      // Input should use chrome.input color (browser converts HSL to RGB)
      expect(backgroundColor).toBeDefined();
      expect(backgroundColor).not.toBe('transparent');
      // Should be a valid color (RGB format after browser conversion)
      expect(backgroundColor).toMatch(/^(rgb|rgba)\(/);
    });

    it('should apply text color from theme', () => {
      mockDate(12, 0); // noon (light theme)
      
      const { container } = render(
        <ThemedContainer variant="input">
          <div>Test Content</div>
        </ThemedContainer>,
        { wrapper }
      );

      const containerDiv = container.firstChild as HTMLElement;
      // Light theme should have dark text (browser converts hex to RGB)
      expect(containerDiv.style.color).toBe('rgb(26, 26, 26)');
    });

    it('should apply border color from theme', () => {
      const { container } = render(
        <ThemedContainer variant="input">
          <div>Test Content</div>
        </ThemedContainer>,
        { wrapper }
      );

      const containerDiv = container.firstChild as HTMLElement;
      const borderColor = containerDiv.style.borderColor;
      // Border color should be defined
      expect(borderColor).toBeDefined();
      expect(borderColor).not.toBe('');
    });
  });

  describe('transitions', () => {
    it('should include CSS transitions for smooth theme changes', () => {
      const { container } = render(
        <ThemedContainer>
          <div>Test Content</div>
        </ThemedContainer>,
        { wrapper }
      );

      const containerDiv = container.firstChild as HTMLElement;
      const transition = containerDiv.style.transition;
      
      // Should have transitions for background, color, and border
      expect(transition).toContain('background-color');
      expect(transition).toContain('color');
      expect(transition).toContain('border-color');
      expect(transition).toContain('2s ease');
    });
  });

  describe('theme changes', () => {
    it('should apply correct text color for dark theme', () => {
      // Test with dark theme directly
      mockDate(2, 0); // 2am (dark theme)
      
      const { container } = render(
        <ThemedContainer>
          <div>Test Content</div>
        </ThemedContainer>,
        { wrapper }
      );

      const containerDiv = container.firstChild as HTMLElement;
      // Dark theme text (browser converts hex to RGB)
      expect(containerDiv.style.color).toBe('rgb(232, 232, 232)');
      
      // Verify it's different from light theme
      expect(containerDiv.style.color).not.toBe('rgb(26, 26, 26)');
    });

    it('should update background color for card variant when theme changes', () => {
      mockDate(6, 0); // 6am (dawn)
      
      const { container } = render(
        <ThemedContainer variant="card">
          <div>Test Content</div>
        </ThemedContainer>,
        { wrapper }
      );

      const containerDiv = container.firstChild as HTMLElement;
      const background = containerDiv.style.backgroundColor;

      // Background should be defined and valid (RGB format after browser conversion)
      expect(background).toBeDefined();
      expect(background).not.toBe('transparent');
      expect(background).toMatch(/^(rgb|rgba)\(/);
    });
  });

  describe('error handling', () => {
    it('should throw error when used outside ThemeProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(
          <ThemedContainer>
            <div>Test Content</div>
          </ThemedContainer>
        );
      }).toThrow('useTheme must be used within a ThemeProvider');

      consoleSpy.mockRestore();
    });
  });
});

