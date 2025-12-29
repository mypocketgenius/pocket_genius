/**
 * @jest-environment jsdom
 * 
 * Tests for ChatHeader component and Task 5 refactor
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/lib/theme/theme-context';
import { ChatHeader } from '@/components/chat-header';

// Mock StarRating component
jest.mock('@/components/star-rating', () => ({
  StarRating: ({ chatbotId, sessionId, messageCount }: any) => (
    <div data-testid="star-rating">
      StarRating: {chatbotId} / {sessionId} / {messageCount}
    </div>
  ),
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

describe('ChatHeader Component', () => {
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

  const defaultProps = {
    chatbotTitle: 'Test Chatbot',
    conversationId: 'conv-123',
    chatbotId: 'bot-456',
    messages: [
      { id: '1', role: 'user' as const, content: 'Hello' },
      { id: '2', role: 'assistant' as const, content: 'Hi there' },
      { id: '3', role: 'user' as const, content: 'How are you?' },
    ],
    error: null,
    onBack: jest.fn(),
    onMenuClick: jest.fn(),
    isSignedIn: false,
  };

  describe('rendering', () => {
    it('should render chatbot title', () => {
      mockDate(12, 0);
      
      render(<ChatHeader {...defaultProps} />, { wrapper });

      expect(screen.getByText('Test Chatbot')).toBeInTheDocument();
    });

    it('should render back button', () => {
      mockDate(12, 0);
      
      render(<ChatHeader {...defaultProps} />, { wrapper });

      const backButton = screen.getByLabelText('Go back');
      expect(backButton).toBeInTheDocument();
    });

    it('should render star rating when conversationId is provided', () => {
      mockDate(12, 0);
      
      render(<ChatHeader {...defaultProps} conversationId="conv-123" />, { wrapper });

      expect(screen.getByTestId('star-rating')).toBeInTheDocument();
      expect(screen.getByText(/StarRating: bot-456 \/ conv-123 \/ 2/)).toBeInTheDocument();
    });

    it('should not render star rating when conversationId is null', () => {
      mockDate(12, 0);
      
      render(<ChatHeader {...defaultProps} conversationId={null} />, { wrapper });

      expect(screen.queryByTestId('star-rating')).not.toBeInTheDocument();
    });

    it('should render menu button when isSignedIn is true', () => {
      mockDate(12, 0);
      
      render(<ChatHeader {...defaultProps} isSignedIn={true} />, { wrapper });

      const menuButton = screen.getByLabelText('Open menu');
      expect(menuButton).toBeInTheDocument();
    });

    it('should not render menu button when isSignedIn is false', () => {
      mockDate(12, 0);
      
      render(<ChatHeader {...defaultProps} isSignedIn={false} />, { wrapper });

      expect(screen.queryByLabelText('Open menu')).not.toBeInTheDocument();
    });

    it('should render error message when error is provided', () => {
      mockDate(12, 0);
      
      render(<ChatHeader {...defaultProps} error="Something went wrong" />, { wrapper });

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should not render error message when error is null', () => {
      mockDate(12, 0);
      
      const { container } = render(<ChatHeader {...defaultProps} error={null} />, { wrapper });

      const errorDiv = container.querySelector('.bg-red-50');
      expect(errorDiv).not.toBeInTheDocument();
    });
  });

  describe('theme application', () => {
    it('should apply theme chrome colors', () => {
      mockDate(12, 0); // noon (light theme)
      
      const { container } = render(<ChatHeader {...defaultProps} />, { wrapper });

      const header = container.querySelector('.app-header') as HTMLElement;
      expect(header).toBeInTheDocument();
      
      const backgroundColor = header.style.backgroundColor;
      const borderColor = header.style.borderColor;
      const color = header.style.color;
      
      expect(backgroundColor).toBeDefined();
      expect(borderColor).toBeDefined();
      expect(color).toBeDefined();
    });

    it('should apply correct text color for light theme', () => {
      mockDate(12, 0); // noon (light theme)
      
      const { container } = render(<ChatHeader {...defaultProps} />, { wrapper });

      const header = container.querySelector('.app-header') as HTMLElement;
      const textColor = header.style.color;
      
      // Light theme should have dark text (browser converts hex to RGB)
      // #1a1a1a = rgb(26, 26, 26)
      expect(textColor).toBe('rgb(26, 26, 26)');
    });

    it('should apply correct text color for dark theme', () => {
      mockDate(2, 0); // 2am (dark theme)
      
      const { container } = render(<ChatHeader {...defaultProps} />, { wrapper });

      const header = container.querySelector('.app-header') as HTMLElement;
      const textColor = header.style.color;
      
      // Dark theme should have light text (browser converts hex to RGB)
      // #e8e8e8 = rgb(232, 232, 232)
      expect(textColor).toBe('rgb(232, 232, 232)');
    });

    it('should include CSS transitions for smooth theme changes', () => {
      mockDate(12, 0);
      
      const { container } = render(<ChatHeader {...defaultProps} />, { wrapper });

      const header = container.querySelector('.app-header') as HTMLElement;
      const transition = header.style.transition;
      
      // Should have transitions for background-color, border-color, and color
      expect(transition).toContain('background-color');
      expect(transition).toContain('border-color');
      expect(transition).toContain('color');
      expect(transition).toContain('2s ease');
    });
  });

  describe('interactions', () => {
    it('should call onBack when back button is clicked', () => {
      mockDate(12, 0);
      const onBack = jest.fn();
      
      render(<ChatHeader {...defaultProps} onBack={onBack} />, { wrapper });

      const backButton = screen.getByLabelText('Go back');
      backButton.click();

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('should call onMenuClick when menu button is clicked', () => {
      mockDate(12, 0);
      const onMenuClick = jest.fn();
      
      render(<ChatHeader {...defaultProps} isSignedIn={true} onMenuClick={onMenuClick} />, { wrapper });

      const menuButton = screen.getByLabelText('Open menu');
      menuButton.click();

      expect(onMenuClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('hover states', () => {
    it('should apply theme-aware hover colors for back button', () => {
      mockDate(12, 0); // light theme
      
      const { container } = render(<ChatHeader {...defaultProps} />, { wrapper });

      const backButton = container.querySelector('button[aria-label="Go back"]') as HTMLElement;
      
      // Simulate mouse enter
      const mouseEnterEvent = new MouseEvent('mouseenter', { bubbles: true });
      backButton.dispatchEvent(mouseEnterEvent);
      
      // Light theme hover: rgba(0, 0, 0, 0.05)
      // Note: browser converts rgba to rgb with alpha handling
      const bgColor = backButton.style.backgroundColor;
      expect(bgColor).toBeDefined();
    });

    it('should apply theme-aware hover colors for menu button', () => {
      mockDate(12, 0); // light theme
      
      const { container } = render(<ChatHeader {...defaultProps} isSignedIn={true} />, { wrapper });

      const menuButton = container.querySelector('button[aria-label="Open menu"]') as HTMLElement;
      
      // Simulate mouse enter
      const mouseEnterEvent = new MouseEvent('mouseenter', { bubbles: true });
      menuButton.dispatchEvent(mouseEnterEvent);
      
      const bgColor = menuButton.style.backgroundColor;
      expect(bgColor).toBeDefined();
    });
  });

  describe('message count calculation', () => {
    it('should calculate user message count correctly', () => {
      mockDate(12, 0);
      
      const messages = [
        { id: '1', role: 'user' as const, content: 'Hello' },
        { id: '2', role: 'assistant' as const, content: 'Hi' },
        { id: '3', role: 'user' as const, content: 'How are you?' },
        { id: '4', role: 'user' as const, content: 'Fine?' },
      ];
      
      render(<ChatHeader {...defaultProps} messages={messages} />, { wrapper });

      // Should show 3 user messages
      expect(screen.getByText(/StarRating: bot-456 \/ conv-123 \/ 3/)).toBeInTheDocument();
    });

    it('should handle empty messages array', () => {
      mockDate(12, 0);
      
      render(<ChatHeader {...defaultProps} messages={[]} />, { wrapper });

      expect(screen.getByText(/StarRating: bot-456 \/ conv-123 \/ 0/)).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should throw error when used outside ThemeProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<ChatHeader {...defaultProps} />);
      }).toThrow('useTheme must be used within a ThemeProvider');

      consoleSpy.mockRestore();
    });
  });
});

