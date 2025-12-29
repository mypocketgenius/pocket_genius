/**
 * @jest-environment jsdom
 * 
 * Tests for Task 9: Migrate Creators Page to Use Theme
 * 
 * These tests verify that the creators page migration was completed correctly:
 * 1. ThemedPage component is imported and used
 * 2. bg-gray-50 class is removed
 * 3. Theme applies correctly to creators page
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/lib/theme/theme-context';
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

// Mock Next.js router and params
jest.mock('next/navigation', () => ({
  useParams: () => ({ creatorSlug: 'test-creator' }),
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock fetch
global.fetch = jest.fn();

// Mock AppHeader
jest.mock('@/components/app-header', () => ({
  AppHeader: () => <div data-testid="app-header">AppHeader</div>,
}));

// Mock ChatbotCard
jest.mock('@/components/chatbot-card', () => ({
  ChatbotCard: () => <div data-testid="chatbot-card">ChatbotCard</div>,
}));

describe('Creators Page Theme Migration - Task 9', () => {
  let creatorsPageFileContent: string;

  beforeAll(() => {
    // Read the creators page file to verify the migration
    const creatorsPageFilePath = path.join(process.cwd(), 'app', 'creators', '[creatorSlug]', 'page.tsx');
    creatorsPageFileContent = fs.readFileSync(creatorsPageFilePath, 'utf-8');
  });

  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        creator: {
          id: 'creator-1',
          slug: 'test-creator',
          name: 'Test Creator',
          avatarUrl: null,
          bio: 'Test bio',
          socialLinks: null,
        },
      }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Import verification', () => {
    it('should import ThemedPage component', () => {
      // Verify ThemedPage is imported
      expect(creatorsPageFileContent).toContain("import { ThemedPage } from '@/components/themed-page'");
    });
  });

  describe('ThemedPage usage', () => {
    it('should use ThemedPage component instead of div with bg-gray-50', () => {
      // Verify ThemedPage is used (opening tag)
      expect(creatorsPageFileContent).toContain('<ThemedPage');
      
      // Verify ThemedPage closes properly (closing tag)
      expect(creatorsPageFileContent).toContain('</ThemedPage>');
    });

    it('should apply min-h-screen className to ThemedPage', () => {
      // Verify min-h-screen is applied to ThemedPage
      expect(creatorsPageFileContent).toContain('className="min-h-screen"');
    });

    it('should not use div with bg-gray-50 for main container', () => {
      // Verify bg-gray-50 is removed from main container
      expect(creatorsPageFileContent).not.toContain('<div className="min-h-screen bg-gray-50">');
    });
  });

  describe('bg-gray-50 removal', () => {
    it('should remove bg-gray-50 class from main container divs', () => {
      // Verify bg-gray-50 is not present in main container divs
      // (may still be present in other elements like avatar placeholder)
      const mainContainerMatches = creatorsPageFileContent.match(/className="min-h-screen bg-gray-50"/g);
      expect(mainContainerMatches).toBeNull();
    });
  });

  describe('Theme application', () => {
    it('should use ThemedPage component which applies theme gradient', () => {
      // Verify ThemedPage is used, which applies theme gradient
      // ThemedPage component handles theme application internally
      expect(creatorsPageFileContent).toContain('<ThemedPage');
      expect(creatorsPageFileContent).toContain('</ThemedPage>');
    });

    it('should apply min-h-screen className for full page coverage', () => {
      // Verify min-h-screen is applied to ThemedPage
      expect(creatorsPageFileContent).toContain('className="min-h-screen"');
    });
  });

  describe('Text color updates', () => {
    it('should use theme-aware text colors instead of hardcoded gray colors for main content', () => {
      // Verify hardcoded text-gray-900 is replaced with theme-aware classes
      // Note: text-gray-600 may still exist in specific UI elements like avatar placeholder
      expect(creatorsPageFileContent).not.toContain('text-gray-900');
      
      // Main content should use opacity classes or theme text color
      // Check that breadcrumb navigation uses opacity instead of text-gray-600
      expect(creatorsPageFileContent).toContain('hover:opacity-80');
    });
  });

  describe('404 error page', () => {
    it('should use ThemedPage for 404 error page', () => {
      // Verify 404 error page also uses ThemedPage
      expect(creatorsPageFileContent).toContain('Creator not found');
      // Check that ThemedPage wraps the 404 content
      const errorPageMatch = creatorsPageFileContent.match(/Creator not found[\s\S]*?ThemedPage/);
      expect(errorPageMatch).toBeTruthy();
    });
  });
});

