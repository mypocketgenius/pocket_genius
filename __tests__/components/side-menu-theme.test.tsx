/**
 * @jest-environment jsdom
 * 
 * Tests for Task 10: Migrate Side Menu to Use Theme
 * 
 * These tests verify that the side menu theme migration was completed correctly:
 * 1. SideMenu uses useTheme() hook
 * 2. Sidebar background uses theme.chrome.header
 * 3. Text colors use theme.textColor
 * 4. Hover states are theme-aware
 * 5. Borders use theme.chrome.border
 * 6. SideMenuItem uses theme colors
 */

import fs from 'fs';
import path from 'path';

describe('SideMenu Theme Migration - Task 10', () => {
  let sideMenuContent: string;
  let sideMenuItemContent: string;

  beforeAll(() => {
    // Read the component files to verify the migration
    const sideMenuPath = path.join(process.cwd(), 'components', 'side-menu.tsx');
    const sideMenuItemPath = path.join(process.cwd(), 'components', 'side-menu-item.tsx');
    sideMenuContent = fs.readFileSync(sideMenuPath, 'utf-8');
    sideMenuItemContent = fs.readFileSync(sideMenuItemPath, 'utf-8');
  });

  describe('SideMenu component theme usage', () => {
    it('should import useTheme hook', () => {
      expect(sideMenuContent).toContain("import { useTheme } from '../lib/theme/theme-context'");
    });

    it('should use useTheme() hook', () => {
      expect(sideMenuContent).toMatch(/const\s+theme\s*=\s*useTheme\(\)/);
    });

    it('should apply theme.chrome.header as sidebar background', () => {
      // Check that bg-white is removed from sidebar
      const sidebarMatch = sideMenuContent.match(/className="fixed top-0 right-0[^"]*"/);
      if (sidebarMatch) {
        expect(sidebarMatch[0]).not.toContain('bg-white');
      }

      // Check that theme.chrome.header is used
      expect(sideMenuContent).toContain('theme.chrome.header');
    });

    it('should apply theme.textColor for text', () => {
      expect(sideMenuContent).toContain('theme.textColor');
    });

    it('should include CSS transitions for smooth theme changes', () => {
      expect(sideMenuContent).toMatch(/transition.*2s ease/);
    });

    it('should apply theme.chrome.border for borders', () => {
      expect(sideMenuContent).toContain('theme.chrome.border');
    });

    it('should use theme-aware hover states', () => {
      expect(sideMenuContent).toContain('hoverBgColor');
      expect(sideMenuContent).toContain('onMouseEnter');
      expect(sideMenuContent).toContain('onMouseLeave');
    });

    it('should remove hardcoded text-gray-* classes', () => {
      // Check that text-gray-* classes are not present in key areas
      expect(sideMenuContent).not.toMatch(/text-gray-500|text-gray-600|text-gray-700/);
    });

    it('should remove hardcoded bg-gray-* classes from buttons', () => {
      // Check that hover:bg-gray-* classes are not present
      expect(sideMenuContent).not.toMatch(/hover:bg-gray-50|hover:bg-gray-100|hover:bg-gray-200/);
      expect(sideMenuContent).not.toMatch(/bg-gray-100|bg-gray-200/);
    });
  });

  describe('SideMenuItem component theme usage', () => {
    it('should import useTheme hook', () => {
      expect(sideMenuItemContent).toContain("import { useTheme } from '../lib/theme/theme-context'");
    });

    it('should use useTheme() hook', () => {
      expect(sideMenuItemContent).toMatch(/const\s+theme\s*=\s*useTheme\(\)/);
    });

    it('should apply theme.textColor for text', () => {
      expect(sideMenuItemContent).toContain('theme.textColor');
    });

    it('should use theme-aware hover states', () => {
      expect(sideMenuItemContent).toContain('hoverBgColor');
      expect(sideMenuItemContent).toContain('onMouseEnter');
      expect(sideMenuItemContent).toContain('onMouseLeave');
    });

    it('should remove hardcoded text-gray-* classes', () => {
      expect(sideMenuItemContent).not.toMatch(/text-gray-500|text-gray-600/);
    });

    it('should remove hardcoded hover:bg-gray-* classes', () => {
      expect(sideMenuItemContent).not.toMatch(/hover:bg-gray-/);
    });
  });

  describe('Code structure verification', () => {
    it('should import useTheme hook', () => {
      const fs = require('fs');
      const path = require('path');
      const sideMenuContent = fs.readFileSync(
        path.join(process.cwd(), 'components', 'side-menu.tsx'),
        'utf-8'
      );

      expect(sideMenuContent).toContain("import { useTheme } from '../lib/theme/theme-context'");
    });

    it('should use theme.chrome.header instead of bg-white', () => {
      const fs = require('fs');
      const path = require('path');
      const sideMenuContent = fs.readFileSync(
        path.join(process.cwd(), 'components', 'side-menu.tsx'),
        'utf-8'
      );

      // Check that bg-white is removed from sidebar
      const sidebarMatch = sideMenuContent.match(/className="fixed top-0 right-0[^"]*"/);
      if (sidebarMatch) {
        expect(sidebarMatch[0]).not.toContain('bg-white');
      }

      // Check that theme.chrome.header is used
      expect(sideMenuContent).toContain('theme.chrome.header');
    });

    it('should use theme.textColor instead of text-gray-*', () => {
      const fs = require('fs');
      const path = require('path');
      const sideMenuContent = fs.readFileSync(
        path.join(process.cwd(), 'components', 'side-menu.tsx'),
        'utf-8'
      );

      expect(sideMenuContent).toContain('theme.textColor');
    });

    it('should use theme.chrome.border for borders', () => {
      const fs = require('fs');
      const path = require('path');
      const sideMenuContent = fs.readFileSync(
        path.join(process.cwd(), 'components', 'side-menu.tsx'),
        'utf-8'
      );

      expect(sideMenuContent).toContain('theme.chrome.border');
    });

    it('should use hoverBgColor for theme-aware hover states', () => {
      const fs = require('fs');
      const path = require('path');
      const sideMenuContent = fs.readFileSync(
        path.join(process.cwd(), 'components', 'side-menu.tsx'),
        'utf-8'
      );

      expect(sideMenuContent).toContain('hoverBgColor');
      expect(sideMenuContent).toContain('onMouseEnter');
      expect(sideMenuContent).toContain('onMouseLeave');
    });

    it('should have SideMenuItem import useTheme hook', () => {
      const fs = require('fs');
      const path = require('path');
      const sideMenuItemContent = fs.readFileSync(
        path.join(process.cwd(), 'components', 'side-menu-item.tsx'),
        'utf-8'
      );

      expect(sideMenuItemContent).toContain("import { useTheme } from '../lib/theme/theme-context'");
    });
  });
});

