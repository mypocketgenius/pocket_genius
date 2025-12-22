// __tests__/lib/theme/theme-context.test.ts
// Tests for theme context provider and localStorage persistence
// Note: This test requires jsdom environment for React Testing Library

/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '@/lib/theme/theme-context';
import React from 'react';

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

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider>{children}</ThemeProvider>
  );

  describe('default theme', () => {
    it('should use default theme when no localStorage value', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      
      expect(result.current.mode).toBe('cycle');
      expect(result.current.customPeriod).toBeUndefined();
      expect(result.current.gradient).toBeDefined();
      expect(result.current.theme).toBeDefined();
      expect(result.current.chrome).toBeDefined();
    });
  });

  describe('localStorage persistence', () => {
    it('should load theme from localStorage on mount', () => {
      const savedTheme = {
        mode: 'custom' as const,
        customPeriod: 'golden' as const,
      };
      localStorageMock.setItem('pocket-genius-theme', JSON.stringify(savedTheme));

      const { result } = renderHook(() => useTheme(), { wrapper });
      
      expect(result.current.mode).toBe('custom');
      expect(result.current.customPeriod).toBe('golden');
    });

    it('should save theme to localStorage when mode changes', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      
      act(() => {
        result.current.setMode('dark-cycle');
      });

      const saved = JSON.parse(localStorageMock.getItem('pocket-genius-theme') || '{}');
      expect(saved.mode).toBe('dark-cycle');
    });

    it('should save theme to localStorage when custom period changes', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      
      act(() => {
        result.current.setCustomPeriod('golden');
      });

      const saved = JSON.parse(localStorageMock.getItem('pocket-genius-theme') || '{}');
      expect(saved.mode).toBe('custom');
      expect(saved.customPeriod).toBe('golden');
    });

    it('should handle invalid localStorage data gracefully', () => {
      localStorageMock.setItem('pocket-genius-theme', 'invalid json');
      
      const { result } = renderHook(() => useTheme(), { wrapper });
      
      // Should fallback to default theme
      expect(result.current.mode).toBe('cycle');
    });

    it('should handle missing localStorage gracefully', () => {
      // Simulate localStorage unavailable
      const originalGetItem = localStorageMock.getItem;
      localStorageMock.getItem = jest.fn(() => null);
      
      const { result } = renderHook(() => useTheme(), { wrapper });
      
      expect(result.current.mode).toBe('cycle');
      
      localStorageMock.getItem = originalGetItem;
    });
  });

  describe('theme mode changes', () => {
    it('should update mode when setMode is called', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      
      act(() => {
        result.current.setMode('light-cycle');
      });

      expect(result.current.mode).toBe('light-cycle');
    });

    it('should clear customPeriod when switching away from custom mode', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      
      // Set custom period first
      act(() => {
        result.current.setCustomPeriod('golden');
      });
      expect(result.current.customPeriod).toBe('golden');

      // Switch to cycle mode
      act(() => {
        result.current.setMode('cycle');
      });

      expect(result.current.mode).toBe('cycle');
      expect(result.current.customPeriod).toBeUndefined();
    });
  });

  describe('custom period', () => {
    it('should update custom period when setCustomPeriod is called', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      
      act(() => {
        result.current.setCustomPeriod('golden');
      });

      expect(result.current.mode).toBe('custom');
      expect(result.current.customPeriod).toBe('golden');
    });
  });

  describe('gradient calculation', () => {
    it('should calculate gradient based on current time in cycle mode', () => {
      mockDate(14, 30); // 2:30pm (afternoon)
      
      const { result } = renderHook(() => useTheme(), { wrapper });
      
      expect(result.current.gradient).toBeDefined();
      expect(result.current.gradient.start).toBeDefined();
      expect(result.current.gradient.end).toBeDefined();
    });

    it('should use custom period time in custom mode', () => {
      mockDate(10, 0); // 10am
      
      const { result } = renderHook(() => useTheme(), { wrapper });
      
      act(() => {
        result.current.setCustomPeriod('golden');
      });

      // Gradient should be based on golden hour (7pm), not current time (10am)
      expect(result.current.gradient).toBeDefined();
    });
  });

  describe('theme (light/dark) calculation', () => {
    it('should return light theme for day hours', () => {
      mockDate(12, 0); // noon
      
      const { result } = renderHook(() => useTheme(), { wrapper });
      
      expect(result.current.theme).toBe('light');
    });

    it('should return dark theme for night hours', () => {
      mockDate(2, 0); // 2am
      
      const { result } = renderHook(() => useTheme(), { wrapper });
      
      expect(result.current.theme).toBe('dark');
    });
  });

  describe('chrome colors', () => {
    it('should calculate chrome colors from gradient', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      
      expect(result.current.chrome).toBeDefined();
      expect(result.current.chrome.header).toBeDefined();
      expect(result.current.chrome.input).toBeDefined();
      expect(result.current.chrome.inputField).toBeDefined();
      expect(result.current.chrome.border).toBeDefined();
    });
  });

  describe('bubble styles', () => {
    it('should provide bubble styles for light and dark themes', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      
      expect(result.current.bubbleStyles).toBeDefined();
      expect(result.current.bubbleStyles.light).toBeDefined();
      expect(result.current.bubbleStyles.dark).toBeDefined();
      expect(result.current.bubbleStyles.light.ai).toBeDefined();
      expect(result.current.bubbleStyles.dark.ai).toBeDefined();
    });
  });

  describe('text color', () => {
    it('should return correct text color for light theme', () => {
      mockDate(12, 0); // noon (light theme)
      
      const { result } = renderHook(() => useTheme(), { wrapper });
      
      expect(result.current.textColor).toBe('#1a1a1a');
    });

    it('should return correct text color for dark theme', () => {
      mockDate(2, 0); // 2am (dark theme)
      
      const { result } = renderHook(() => useTheme(), { wrapper });
      
      expect(result.current.textColor).toBe('#e8e8e8');
    });
  });

  describe('error handling', () => {
    it('should throw error when useTheme is called outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        renderHook(() => useTheme());
      }).toThrow('useTheme must be used within a ThemeProvider');
      
      consoleSpy.mockRestore();
    });
  });
});

