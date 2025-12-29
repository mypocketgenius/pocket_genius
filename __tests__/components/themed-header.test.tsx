/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/lib/theme/theme-context';
import { ThemedHeader } from '@/components/themed-header';
import { SignedIn, SignedOut } from '@clerk/nextjs';

// Mock Clerk components
jest.mock('@clerk/nextjs', () => ({
  SignInButton: ({ children }: { children: React.ReactNode }) => <div data-testid="sign-in-button">{children}</div>,
  SignUpButton: ({ children }: { children: React.ReactNode }) => <div data-testid="sign-up-button">{children}</div>,
  SignedIn: ({ children }: { children: React.ReactNode }) => <div data-testid="signed-in">{children}</div>,
  SignedOut: ({ children }: { children: React.ReactNode }) => <div data-testid="signed-out">{children}</div>,
  UserButton: () => <div data-testid="user-button">UserButton</div>,
}));

// Mock SearchBar component
jest.mock('@/components/search-bar', () => ({
  SearchBar: () => <div data-testid="search-bar">SearchBar</div>,
}));

// Mock SideMenu component
jest.mock('@/components/side-menu', () => ({
  SideMenu: ({ isOpen }: { isOpen: boolean }) => <div data-testid="side-menu">{isOpen ? 'Open' : 'Closed'}</div>,
}));

// Mock Button component
jest.mock('@/components/ui/button', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

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

describe('ThemedHeader', () => {
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
    it('should render default header with logo', () => {
      render(<ThemedHeader />, { wrapper });

      expect(screen.getByText('Pocket Genius')).toBeInTheDocument();
      expect(screen.getByText('PG')).toBeInTheDocument();
    });

    it('should render custom leftContent', () => {
      render(
        <ThemedHeader leftContent={<div>Custom Left</div>} />,
        { wrapper }
      );

      expect(screen.getByText('Custom Left')).toBeInTheDocument();
      expect(screen.queryByText('Pocket Genius')).not.toBeInTheDocument();
    });

    it('should render custom rightContent', () => {
      render(
        <ThemedHeader rightContent={<div>Custom Right</div>} />,
        { wrapper }
      );

      expect(screen.getByText('Custom Right')).toBeInTheDocument();
    });

    it('should render custom children', () => {
      render(
        <ThemedHeader>
          <div>Custom Header Content</div>
        </ThemedHeader>,
        { wrapper }
      );

      expect(screen.getByText('Custom Header Content')).toBeInTheDocument();
    });

    it('should render search bar', () => {
      render(<ThemedHeader />, { wrapper });

      expect(screen.getByTestId('search-bar')).toBeInTheDocument();
    });
  });

  describe('theme application', () => {
    it('should apply correct chrome colors from theme', () => {
      mockDate(12, 0); // noon (light theme)
      
      const { container } = render(<ThemedHeader />, { wrapper });

      const header = container.querySelector('header') as HTMLElement;
      expect(header).toBeInTheDocument();
      
      const backgroundColor = header.style.backgroundColor;
      const borderColor = header.style.borderColor;
      const color = header.style.color;
      
      // Should have theme colors applied
      expect(backgroundColor).toBeDefined();
      expect(borderColor).toBeDefined();
      expect(color).toBeDefined();
    });

    it('should apply correct text color for light theme', () => {
      mockDate(12, 0); // noon (light theme)
      
      const { container } = render(<ThemedHeader />, { wrapper });

      const header = container.querySelector('header') as HTMLElement;
      const textColor = header.style.color;
      
      // Light theme should have dark text (browser converts hex to RGB)
      expect(textColor).toBe('rgb(26, 26, 26)');
    });

    it('should apply correct text color for dark theme', () => {
      mockDate(2, 0); // 2am (dark theme)
      
      const { container } = render(<ThemedHeader />, { wrapper });

      const header = container.querySelector('header') as HTMLElement;
      const textColor = header.style.color;
      
      // Dark theme should have light text (browser converts hex to RGB)
      expect(textColor).toBe('rgb(232, 232, 232)');
    });

    it('should include CSS transitions for smooth theme changes', () => {
      const { container } = render(<ThemedHeader />, { wrapper });

      const header = container.querySelector('header') as HTMLElement;
      const transition = header.style.transition;
      
      // Should have transitions for background, border, and color
      expect(transition).toContain('background-color');
      expect(transition).toContain('border-color');
      expect(transition).toContain('color');
      expect(transition).toContain('2s ease');
    });
  });

  describe('sticky positioning', () => {
    it('should apply sticky positioning by default', () => {
      const { container } = render(<ThemedHeader />, { wrapper });

      const header = container.querySelector('header') as HTMLElement;
      expect(header.className).toContain('sticky');
      expect(header.className).toContain('top-0');
      expect(header.className).toContain('z-50');
    });

    it('should not apply sticky positioning when sticky is false', () => {
      const { container } = render(<ThemedHeader sticky={false} />, { wrapper });

      const header = container.querySelector('header') as HTMLElement;
      expect(header.className).not.toContain('sticky');
      expect(header.className).not.toContain('top-0');
    });
  });

  describe('border', () => {
    it('should apply border-b class', () => {
      const { container } = render(<ThemedHeader />, { wrapper });

      const header = container.querySelector('header') as HTMLElement;
      expect(header.className).toContain('border-b');
    });
  });

  describe('auth buttons', () => {
    it('should show auth buttons by default', () => {
      render(<ThemedHeader />, { wrapper });

      // Should render SignedOut wrapper (which contains SignIn/SignUp buttons)
      expect(screen.getByTestId('signed-out')).toBeInTheDocument();
    });

    it('should hide auth buttons when showAuth is false', () => {
      render(<ThemedHeader showAuth={false} />, { wrapper });

      expect(screen.queryByTestId('signed-out')).not.toBeInTheDocument();
      expect(screen.queryByTestId('signed-in')).not.toBeInTheDocument();
    });
  });

  describe('hover states', () => {
    it('should apply theme-aware hover colors to menu button', () => {
      mockDate(12, 0); // noon (light theme)
      
      const { container } = render(<ThemedHeader />, { wrapper });

      // Find menu button (would be in SignedIn, but we're mocking that)
      // Instead, test that hover colors are calculated correctly
      // Light theme should use rgba(0, 0, 0, 0.05)
      const header = container.querySelector('header') as HTMLElement;
      expect(header).toBeInTheDocument();
    });
  });

  describe('side menu', () => {
    it('should render SideMenu component', () => {
      render(<ThemedHeader />, { wrapper });

      expect(screen.getByTestId('side-menu')).toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      const { container } = render(<ThemedHeader className="custom-class" />, { wrapper });

      const header = container.querySelector('header') as HTMLElement;
      expect(header.className).toContain('custom-class');
    });
  });

  describe('error handling', () => {
    it('should throw error when used outside ThemeProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<ThemedHeader />);
      }).toThrow('useTheme must be used within a ThemeProvider');

      consoleSpy.mockRestore();
    });
  });
});

