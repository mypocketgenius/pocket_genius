/**
 * @jest-environment jsdom
 * 
 * Tests for Task 4: Refactor Chat Page to Use ThemedPage
 * 
 * These tests verify that the chat.tsx refactor was completed correctly:
 * 1. ThemedPage component is imported
 * 2. Messages container uses ThemedPage instead of inline gradient
 * 3. Redundant background gradient was removed
 * 4. iOS-specific styles are preserved
 */

import fs from 'fs';
import path from 'path';

describe('Chat Component Refactor - Task 4', () => {
  let chatFileContent: string;

  beforeAll(() => {
    // Read the chat.tsx file to verify the refactor
    const chatFilePath = path.join(process.cwd(), 'components', 'chat.tsx');
    chatFileContent = fs.readFileSync(chatFilePath, 'utf-8');
  });

  describe('Import verification', () => {
    it('should import ThemedPage component', () => {
      // Verify ThemedPage is imported
      expect(chatFileContent).toContain("import { ThemedPage } from './themed-page'");
    });
  });

  describe('ThemedPage usage', () => {
    it('should use ThemedPage component for messages container', () => {
      // Verify ThemedPage is used (opening tag)
      expect(chatFileContent).toContain('<ThemedPage');
      
      // Verify ThemedPage closes properly (closing tag)
      expect(chatFileContent).toContain('</ThemedPage>');
    });

    it('should apply correct className to ThemedPage', () => {
      // Verify the messages container classes are preserved
      expect(chatFileContent).toContain('className="flex-1 overflow-y-auto p-4 space-y-4 sky-gradient-transition"');
    });

    it('should preserve iOS-specific scrolling styles via scrollable prop', () => {
      // Verify scrollable prop is used (explicit intent for iOS scrolling)
      expect(chatFileContent).toContain('scrollable');
      // Verify it's used on ThemedPage component
      expect(chatFileContent).toMatch(/<ThemedPage[^>]*scrollable/);
    });
  });

  describe('Redundant code removal', () => {
    it('should remove inline background gradient from messages container', () => {
      // Verify the old inline gradient pattern is NOT present
      // Old pattern: style={{ background: `linear-gradient(135deg, ${skyGradient.start}, ${skyGradient.end})` }}
      const inlineGradientPattern = /background:\s*`linear-gradient\(135deg,\s*\$\{skyGradient\.start\},\s*\$\{skyGradient\.end\}\)`/;
      expect(chatFileContent).not.toMatch(inlineGradientPattern);
    });

    it('should not have duplicate background styles on messages container', () => {
      // Count occurrences of ThemedPage - should appear exactly twice (opening and closing)
      const themedPageOpenTags = (chatFileContent.match(/<ThemedPage/g) || []).length;
      const themedPageCloseTags = (chatFileContent.match(/<\/ThemedPage>/g) || []).length;
      
      // Should have exactly one opening and one closing tag
      expect(themedPageOpenTags).toBe(1);
      expect(themedPageCloseTags).toBe(1);
    });
  });

  describe('Code structure verification', () => {
    it('should have ThemedPage wrapping messages content', () => {
      // Verify ThemedPage appears after the header comment
      const messagesContainerIndex = chatFileContent.indexOf('{/* Messages container */}');
      const themedPageIndex = chatFileContent.indexOf('<ThemedPage', messagesContainerIndex);
      
      expect(messagesContainerIndex).toBeGreaterThan(-1);
      expect(themedPageIndex).toBeGreaterThan(messagesContainerIndex);
      
      // Verify ThemedPage appears before input area
      const inputAreaIndex = chatFileContent.indexOf('{/* Phase 4: Input area');
      expect(themedPageIndex).toBeLessThan(inputAreaIndex);
    });

    it('should maintain outer container structure', () => {
      // Verify outer container still uses chromeColors.header
      expect(chatFileContent).toContain('style={{ backgroundColor: chromeColors.header }}');
    });

    it('should maintain input area structure', () => {
      // Verify input area still uses chromeColors.input
      expect(chatFileContent).toContain('chromeColors.input');
    });
  });
});

