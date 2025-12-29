/**
 * @jest-environment jsdom
 * 
 * Tests for Task 9: Migrate Debug Page to Use Theme
 * 
 * These tests verify that the debug page migration was completed correctly:
 * 1. ThemedPageWrapper component is imported and used
 * 2. bg-gray-50 and bg-white classes are removed/replaced
 * 3. Theme applies correctly to debug page
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

describe('Debug Page Theme Migration - Task 9', () => {
  let debugPageFileContent: string;

  beforeAll(() => {
    // Read the debug page file to verify the migration
    const debugPageFilePath = path.join(process.cwd(), 'app', 'dashboard', '[chatbotId]', 'debug', 'page.tsx');
    debugPageFileContent = fs.readFileSync(debugPageFilePath, 'utf-8');
  });

  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('Import verification', () => {
    it('should import ThemedPageWrapper component', () => {
      // Verify ThemedPageWrapper is imported
      expect(debugPageFileContent).toContain("import { ThemedPageWrapper } from '@/components/themed-page-wrapper'");
    });
  });

  describe('ThemedPageWrapper usage', () => {
    it('should use ThemedPageWrapper component instead of div with bg-gray-50', () => {
      // Verify ThemedPageWrapper is used (opening tag)
      expect(debugPageFileContent).toContain('<ThemedPageWrapper');
      
      // Verify ThemedPageWrapper closes properly (closing tag)
      expect(debugPageFileContent).toContain('</ThemedPageWrapper>');
    });

    it('should apply min-h-screen className to ThemedPageWrapper', () => {
      // Verify min-h-screen is applied to ThemedPageWrapper
      expect(debugPageFileContent).toContain('className="min-h-screen');
    });

    it('should not use div with bg-gray-50 for main container', () => {
      // Verify bg-gray-50 is removed from main container
      expect(debugPageFileContent).not.toContain('<div className="min-h-screen bg-gray-50 py-8">');
    });
  });

  describe('bg-gray-50 removal', () => {
    it('should remove bg-gray-50 class from main container divs', () => {
      // Verify bg-gray-50 is not present in main container divs
      const mainContainerMatches = debugPageFileContent.match(/className="min-h-screen bg-gray-50"/g);
      expect(mainContainerMatches).toBeNull();
    });
  });

  describe('Card background updates', () => {
    it('should replace bg-white with theme-aware dark mode classes', () => {
      // Verify bg-white is replaced with dark mode aware classes
      expect(debugPageFileContent).toContain('bg-white dark:bg-gray-800');
    });

    it('should replace bg-gray-50 with theme-aware dark mode classes', () => {
      // Verify bg-gray-50 is replaced with dark mode aware classes in cards
      expect(debugPageFileContent).toContain('bg-gray-50 dark:bg-gray-700');
    });
  });

  describe('Text color updates', () => {
    it('should use theme-aware text colors instead of hardcoded gray colors', () => {
      // Verify hardcoded text-gray-900 is replaced with theme-aware classes
      // Note: text-gray-600 may still exist in specific UI elements (like table headers)
      // but main content should use opacity classes or theme text color
      expect(debugPageFileContent).not.toContain('text-gray-900');
      
      // Main content should use opacity classes
      expect(debugPageFileContent).toContain('opacity-90');
      expect(debugPageFileContent).toContain('opacity-80');
    });

    it('should use opacity classes for text colors', () => {
      // Verify opacity classes are used for theme-aware text
      expect(debugPageFileContent).toContain('opacity-90');
      expect(debugPageFileContent).toContain('opacity-80');
      expect(debugPageFileContent).toContain('opacity-70');
    });
  });

  describe('Border color updates', () => {
    it('should use theme-aware border colors', () => {
      // Verify borders use dark mode aware classes
      expect(debugPageFileContent).toContain('border-gray-200 dark:border-gray-700');
    });
  });

  describe('Error pages', () => {
    it('should use ThemedPageWrapper for "Chatbot not found" error page', () => {
      // Verify error page uses ThemedPageWrapper
      expect(debugPageFileContent).toContain('Chatbot not found');
      // Check that ThemedPageWrapper wraps the error content
      const errorPageMatch = debugPageFileContent.match(/Chatbot not found[\s\S]*?ThemedPageWrapper/);
      expect(errorPageMatch).toBeTruthy();
    });

    it('should use ThemedPageWrapper for "Access Denied" error page', () => {
      // Verify error page uses ThemedPageWrapper
      expect(debugPageFileContent).toContain('Access Denied');
      // Check that ThemedPageWrapper wraps the error content
      const errorPageMatch = debugPageFileContent.match(/Access Denied[\s\S]*?ThemedPageWrapper/);
      expect(errorPageMatch).toBeTruthy();
    });
  });
});

