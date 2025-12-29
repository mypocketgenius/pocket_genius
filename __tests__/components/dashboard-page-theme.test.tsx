/**
 * @jest-environment jsdom
 * 
 * Tests for Task 9: Migrate Dashboard Page to Use Theme
 * 
 * These tests verify that the dashboard page migration was completed correctly:
 * 1. ThemedPageWrapper component is imported and used
 * 2. bg-gray-50 class is removed
 * 3. Theme applies correctly to dashboard page
 */

import React from 'react';
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

describe('Dashboard Page Theme Migration - Task 9', () => {
  let dashboardPageFileContent: string;

  beforeAll(() => {
    // Read the dashboard page file to verify the migration
    const dashboardPageFilePath = path.join(process.cwd(), 'app', 'dashboard', '[chatbotId]', 'page.tsx');
    dashboardPageFileContent = fs.readFileSync(dashboardPageFilePath, 'utf-8');
  });

  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('Import verification', () => {
    it('should import ThemedPageWrapper component', () => {
      // Verify ThemedPageWrapper is imported
      expect(dashboardPageFileContent).toContain("import { ThemedPageWrapper } from '@/components/themed-page-wrapper'");
    });
  });

  describe('ThemedPageWrapper usage', () => {
    it('should use ThemedPageWrapper component instead of div with bg-gray-50', () => {
      // Verify ThemedPageWrapper is used (opening tag)
      expect(dashboardPageFileContent).toContain('<ThemedPageWrapper');
      
      // Verify ThemedPageWrapper closes properly (closing tag)
      expect(dashboardPageFileContent).toContain('</ThemedPageWrapper>');
    });

    it('should apply min-h-screen className to ThemedPageWrapper', () => {
      // Verify min-h-screen is applied to ThemedPageWrapper
      expect(dashboardPageFileContent).toContain('className="min-h-screen"');
    });

    it('should not use div with bg-gray-50 for main container', () => {
      // Verify bg-gray-50 is removed from main container
      expect(dashboardPageFileContent).not.toContain('<div className="min-h-screen bg-gray-50">');
    });
  });

  describe('bg-gray-50 removal', () => {
    it('should remove bg-gray-50 class from main container divs', () => {
      // Verify bg-gray-50 is not present in main container divs
      const mainContainerMatches = dashboardPageFileContent.match(/className="min-h-screen bg-gray-50"/g);
      expect(mainContainerMatches).toBeNull();
    });
  });

  describe('Error pages', () => {
    it('should use ThemedPageWrapper for "Chatbot not found" error page', () => {
      // Verify error page uses ThemedPageWrapper
      expect(dashboardPageFileContent).toContain('Chatbot not found');
      // Check that ThemedPageWrapper wraps the error content
      const errorPageMatch = dashboardPageFileContent.match(/Chatbot not found[\s\S]*?ThemedPageWrapper/);
      expect(errorPageMatch).toBeTruthy();
    });

    it('should use ThemedPageWrapper for "Access Denied" error page', () => {
      // Verify error page uses ThemedPageWrapper
      expect(dashboardPageFileContent).toContain('Access Denied');
      // Check that ThemedPageWrapper wraps the error content
      const errorPageMatch = dashboardPageFileContent.match(/Access Denied[\s\S]*?ThemedPageWrapper/);
      expect(errorPageMatch).toBeTruthy();
    });
  });

  describe('Text color updates', () => {
    it('should use theme-aware text colors instead of hardcoded gray colors', () => {
      // Verify hardcoded text-gray-900, text-gray-600 are replaced with theme-aware classes
      // The file should use opacity classes or theme text color instead
      expect(dashboardPageFileContent).not.toContain('text-gray-900');
      expect(dashboardPageFileContent).not.toContain('text-gray-600');
    });
  });
});

