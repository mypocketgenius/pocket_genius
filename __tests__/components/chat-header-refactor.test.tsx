/**
 * @jest-environment jsdom
 * 
 * Tests for Task 5: Refactor Chat Header to Use ChatHeader Component
 * 
 * These tests verify that the chat.tsx refactor was completed correctly:
 * 1. ChatHeader component is imported
 * 2. Header JSX replaced with ChatHeader component
 * 3. Inline chrome color styles removed from header
 * 4. All props passed correctly to ChatHeader
 */

import fs from 'fs';
import path from 'path';

describe('Chat Component Refactor - Task 5', () => {
  let chatFileContent: string;

  beforeAll(() => {
    // Read the chat.tsx file to verify the refactor
    const chatFilePath = path.join(process.cwd(), 'components', 'chat.tsx');
    chatFileContent = fs.readFileSync(chatFilePath, 'utf-8');
  });

  describe('Import verification', () => {
    it('should import ChatHeader component', () => {
      // Verify ChatHeader is imported
      expect(chatFileContent).toContain("import { ChatHeader } from './chat-header'");
    });
  });

  describe('ChatHeader usage', () => {
    it('should use ChatHeader component for header', () => {
      // Verify ChatHeader is used (opening tag)
      expect(chatFileContent).toContain('<ChatHeader');
    });

    it('should pass required props to ChatHeader', () => {
      // Verify all required props are passed
      expect(chatFileContent).toContain('chatbotTitle={chatbotTitle}');
      expect(chatFileContent).toContain('conversationId={conversationId}');
      expect(chatFileContent).toContain('chatbotId={chatbotId}');
      expect(chatFileContent).toContain('messages={messages}');
      expect(chatFileContent).toContain('error={error}');
      expect(chatFileContent).toContain('onBack={() => router.back()}');
      expect(chatFileContent).toContain('onMenuClick={() => setSideMenuOpen(true)}');
      expect(chatFileContent).toContain('isSignedIn={isSignedIn}');
    });
  });

  describe('Redundant code removal', () => {
    it('should remove inline header chrome color styles', () => {
      // Verify the old inline chrome color pattern is NOT present in header
      // Old pattern: style={{ backgroundColor: chromeColors.header, borderColor: chromeColors.border, color: chromeTextColor }}
      // This should not appear in a header div anymore
      
      // Check that we don't have the old header div with inline styles
      const oldHeaderPattern = /className="app-header border-b px-4 py-2\.5"\s+style=\{\{\s*backgroundColor:\s*chromeColors\.header,\s*borderColor:\s*chromeColors\.border,\s*color:\s*chromeTextColor,\s*\}\}/;
      expect(chatFileContent).not.toMatch(oldHeaderPattern);
    });

    it('should not have duplicate header elements', () => {
      // Count occurrences of app-header class - should only appear in ChatHeader component file, not in chat.tsx
      const appHeaderMatches = chatFileContent.match(/className="app-header/g);
      
      // app-header should not appear in chat.tsx anymore (it's now in ChatHeader component)
      expect(appHeaderMatches).toBeNull();
    });

    it('should remove inline back button styles from header', () => {
      // Verify back button with inline styles is not in chat.tsx
      // Old pattern: style={{ color: chromeTextColor }}
      const backButtonPattern = /<button[^>]*onClick=\{\(\) => router\.back\(\)\}[^>]*style=\{\{\s*color:\s*chromeTextColor,\s*\}\}/;
      expect(chatFileContent).not.toMatch(backButtonPattern);
    });

    it('should remove inline menu button styles from header', () => {
      // Verify menu button with inline styles is not in chat.tsx
      const menuButtonPattern = /<button[^>]*onClick=\{\(\) => setSideMenuOpen\(true\)\}[^>]*style=\{\{\s*color:\s*chromeTextColor,\s*\}\}/;
      expect(chatFileContent).not.toMatch(menuButtonPattern);
    });
  });

  describe('Code structure verification', () => {
    it('should have ChatHeader component in correct location', () => {
      // Verify ChatHeader appears after the header comment
      const headerCommentIndex = chatFileContent.indexOf('{/* Header */}');
      const chatHeaderIndex = chatFileContent.indexOf('<ChatHeader', headerCommentIndex);
      
      expect(headerCommentIndex).toBeGreaterThan(-1);
      expect(chatHeaderIndex).toBeGreaterThan(headerCommentIndex);
      
      // Verify ChatHeader appears before messages container
      const messagesContainerIndex = chatFileContent.indexOf('{/* Messages container */}');
      expect(chatHeaderIndex).toBeLessThan(messagesContainerIndex);
    });

    it('should maintain outer container structure', () => {
      // Verify outer container still uses chromeColors.header
      expect(chatFileContent).toContain('style={{ backgroundColor: chromeColors.header }}');
    });

    it('should not have ArrowLeft import if not used elsewhere', () => {
      // ArrowLeft should only be imported if used elsewhere in the file
      // Since it's now in ChatHeader, check if it's still imported
      const arrowLeftUsage = chatFileContent.match(/ArrowLeft/g);
      // ArrowLeft should not appear in chat.tsx anymore (only in ChatHeader component)
      if (arrowLeftUsage) {
        // If it appears, it should only be in the import statement, not in JSX
        const arrowLeftInJSX = chatFileContent.match(/<ArrowLeft/);
        expect(arrowLeftInJSX).toBeNull();
      }
    });

    it('should not have Menu import if not used elsewhere', () => {
      // Menu should only be imported if used elsewhere in the file
      // Since it's now in ChatHeader, check if it's still imported
      const menuUsage = chatFileContent.match(/Menu/g);
      // Menu should not appear in chat.tsx anymore (only in ChatHeader component)
      if (menuUsage) {
        // If it appears, it should only be in the import statement, not in JSX
        const menuInJSX = chatFileContent.match(/<Menu/);
        expect(menuInJSX).toBeNull();
      }
    });
  });

  describe('Functionality preservation', () => {
    it('should preserve router.back() call', () => {
      // Verify router.back() is still called via onBack prop
      expect(chatFileContent).toContain('onBack={() => router.back()}');
    });

    it('should preserve side menu toggle', () => {
      // Verify setSideMenuOpen(true) is still called via onMenuClick prop
      expect(chatFileContent).toContain('onMenuClick={() => setSideMenuOpen(true)}');
    });

    it('should preserve error display', () => {
      // Verify error prop is passed to ChatHeader
      expect(chatFileContent).toContain('error={error}');
    });

    it('should preserve star rating functionality', () => {
      // Verify conversationId and messages are passed for star rating
      expect(chatFileContent).toContain('conversationId={conversationId}');
      expect(chatFileContent).toContain('messages={messages}');
    });
  });
});

