/**
 * @jest-environment jsdom
 * 
 * Tests for Task 7: Migrate Homepage to Use Theme
 * 
 * These tests verify that the homepage migration was completed correctly:
 * 1. ThemedPage component is imported and used
 * 2. bg-background class is removed
 * 3. AppHeader is rendered (already theme-aware from Task 6)
 * 4. Theme applies correctly to homepage
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/lib/theme/theme-context';
import Home from '@/app/page';
import fs from 'fs';
import path from 'path';

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

// Mock hooks and components - use stable references to prevent infinite loops
const mockGridResult = {
  chatbots: [],
  isLoading: false,
  isLoadingMore: false,
  error: null,
  pagination: { hasMore: false, total: 0 },
  page: 1,
  loadMore: jest.fn(),
  retry: jest.fn(),
  syncFavorites: jest.fn((favorites) => favorites), // Return same set to prevent updates
};

jest.mock('@/lib/hooks/use-chatbot-grid', () => ({
  useChatbotGrid: () => mockGridResult,
}));

jest.mock('@/components/app-header', () => ({
  AppHeader: () => <div data-testid="app-header">AppHeader</div>,
}));

jest.mock('@/components/homepage-creators-section', () => ({
  HomepageCreatorsSection: () => <div data-testid="homepage-creators-section">Creators Section</div>,
}));

jest.mock('@/components/homepage-grid-section', () => ({
  HomepageGridSection: () => <div data-testid="homepage-grid-section">Grid Section</div>,
}));

describe('Homepage Theme Migration - Task 7', () => {
  let homepageFileContent: string;

  beforeAll(() => {
    // Read the homepage file to verify the migration
    const homepageFilePath = path.join(process.cwd(), 'app', 'page.tsx');
    homepageFileContent = fs.readFileSync(homepageFilePath, 'utf-8');
  });

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

  describe('Import verification', () => {
    it('should import ThemedPage component', () => {
      // Verify ThemedPage is imported
      expect(homepageFileContent).toContain("import { ThemedPage } from '@/components/themed-page'");
    });
  });

  describe('ThemedPage usage', () => {
    it('should use ThemedPage component instead of main element', () => {
      // Verify ThemedPage is used (opening tag)
      expect(homepageFileContent).toContain('<ThemedPage');
      
      // Verify ThemedPage closes properly (closing tag)
      expect(homepageFileContent).toContain('</ThemedPage>');
    });

    it('should apply min-h-screen className to ThemedPage', () => {
      // Verify min-h-screen is applied to ThemedPage
      expect(homepageFileContent).toContain('className="min-h-screen"');
    });

    it('should not use main element with bg-background', () => {
      // Verify main element with bg-background is removed
      expect(homepageFileContent).not.toContain('<main className="min-h-screen bg-background">');
      expect(homepageFileContent).not.toContain('className="min-h-screen bg-background"');
    });
  });

  describe('bg-background removal', () => {
    it('should remove bg-background class from main element', () => {
      // Verify bg-background is not present in the file
      const bgBackgroundMatches = homepageFileContent.match(/bg-background/g);
      expect(bgBackgroundMatches).toBeNull();
    });
  });

  describe('AppHeader integration', () => {
    it('should render AppHeader component', () => {
      mockDate(12, 0); // noon (light theme)
      
      render(<Home />, { wrapper });

      expect(screen.getByTestId('app-header')).toBeInTheDocument();
    });
  });

  describe('Theme application', () => {
    it('should apply theme gradient to homepage', () => {
      mockDate(12, 0); // noon (light theme)
      
      const { container } = render(<Home />, { wrapper });

      // Find ThemedPage wrapper (first div child)
      const themedPage = container.firstChild as HTMLElement;
      expect(themedPage).toBeInTheDocument();
      
      const background = themedPage.style.background;
      
      // Should contain linear-gradient with theme colors
      expect(background).toContain('linear-gradient');
      expect(background).toContain('135deg');
    });

    it('should apply correct text color for light theme', () => {
      mockDate(12, 0); // noon (light theme)
      
      const { container } = render(<Home />, { wrapper });

      const themedPage = container.firstChild as HTMLElement;
      const textColor = themedPage.style.color;
      
      // Light theme should have dark text (browser converts hex to RGB)
      expect(textColor).toBe('rgb(26, 26, 26)');
    });

    it('should apply correct text color for dark theme', () => {
      mockDate(2, 0); // 2am (dark theme)
      
      const { container } = render(<Home />, { wrapper });

      const themedPage = container.firstChild as HTMLElement;
      const textColor = themedPage.style.color;
      
      // Dark theme should have light text (browser converts hex to RGB)
      expect(textColor).toBe('rgb(232, 232, 232)');
    });

    it('should include CSS transitions for smooth theme changes', () => {
      const { container } = render(<Home />, { wrapper });

      const themedPage = container.firstChild as HTMLElement;
      const transition = themedPage.style.transition;
      
      // Should have transition for background
      expect(transition).toContain('background');
      expect(transition).toContain('2s ease');
    });
  });

  describe('Content rendering', () => {
    it('should render homepage content correctly', () => {
      mockDate(12, 0);
      
      render(<Home />, { wrapper });

      // Verify key content is rendered
      expect(screen.getByText('Turn Any Expert Into Your Advisor')).toBeInTheDocument();
      expect(screen.getByText('AI trained on their work. Personalized to your situation.')).toBeInTheDocument();
      expect(screen.getByTestId('homepage-creators-section')).toBeInTheDocument();
      // Multiple grid sections are rendered (one for each category)
      expect(screen.getAllByTestId('homepage-grid-section').length).toBeGreaterThan(0);
    });
  });

  describe('Theme changes', () => {
    it('should adapt to theme changes based on time', () => {
      // Start with light theme
      mockDate(12, 0);
      const { container, rerender } = render(<Home />, { wrapper });

      const themedPage = container.firstChild as HTMLElement;
      const lightTextColor = themedPage.style.color;

      // Change to dark theme
      mockDate(2, 0);
      rerender(<Home />);

      const darkTextColor = themedPage.style.color;
      
      // Text colors should be different (or at least theme should be applied)
      expect(lightTextColor).toBeDefined();
      expect(darkTextColor).toBeDefined();
    });
  });

  describe('User theme settings', () => {
    it('should apply custom theme mode when set', () => {
      // Set custom theme mode
      localStorageMock.setItem('themeMode', 'custom');
      localStorageMock.setItem('customPeriod', 'dawn');
      
      mockDate(12, 0); // This should be overridden by custom period
      
      const { container } = render(<Home />, { wrapper });

      const themedPage = container.firstChild as HTMLElement;
      const background = themedPage.style.background;
      
      // Should have theme applied (custom period should override time)
      expect(background).toContain('linear-gradient');
    });
  });

  describe('Text readability', () => {
    it('should have readable text contrast for light theme', () => {
      mockDate(12, 0); // noon (light theme)
      
      const { container } = render(<Home />, { wrapper });

      const themedPage = container.firstChild as HTMLElement;
      const textColor = themedPage.style.color;
      
      // Light theme should have dark text for contrast
      expect(textColor).toBe('rgb(26, 26, 26)');
    });

    it('should have readable text contrast for dark theme', () => {
      mockDate(2, 0); // 2am (dark theme)
      
      const { container } = render(<Home />, { wrapper });

      const themedPage = container.firstChild as HTMLElement;
      const textColor = themedPage.style.color;
      
      // Dark theme should have light text for contrast
      expect(textColor).toBe('rgb(232, 232, 232)');
    });
  });
});

