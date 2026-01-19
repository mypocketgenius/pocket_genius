/**
 * @jest-environment jsdom
 */

// __tests__/components/conversational-intake.test.tsx
// Task 6: Component tests for ConversationalIntake component
// Tests all edge cases and functionality (Subtask 6.1, 6.3-6.9)

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ConversationalIntake } from '@/components/conversational-intake';

// Mock Clerk auth
const mockUserId = 'clerk-user-123';
jest.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ userId: mockUserId }),
}));

// Mock theme context
const mockTheme = {
  theme: 'light' as const,
  textColor: '#000000',
  chrome: {
    inputField: '#ffffff',
    input: '#ffffff',
    border: '#cccccc',
  },
  bubbleStyles: {
    light: {
      user: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      userText: '#ffffff',
      text: '#000000',
      shadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
  },
};

jest.mock('@/lib/theme/theme-context', () => ({
  useTheme: () => mockTheme,
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: React.forwardRef(({ onChange, ...props }: any, ref: any) => (
    <input ref={ref} onChange={onChange} {...props} />
  )),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select">{children}</div>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <div>Select...</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value, onClick }: any) => (
    <div onClick={() => onClick?.({ target: { value } })}>{children}</div>
  ),
}));

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, id }: any) => (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  ),
}));

jest.mock('@/components/markdown-renderer', () => ({
  MarkdownRenderer: ({ content }: any) => <div>{content}</div>,
}));

jest.mock('@/components/pills/pill', () => ({
  Pill: ({ pill, onClick }: any) => (
    <button onClick={() => onClick(pill)}>{pill.prefillText}</button>
  ),
}));

jest.mock('@/components/themed-page', () => ({
  ThemedPage: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
}));

// Mock fetch
global.fetch = jest.fn();

// Mock user API
const mockDbUserId = 'db-user-123';

describe('ConversationalIntake', () => {
  const mockOnComplete = jest.fn();
  const mockConversationId = 'conv-123';

  const defaultProps = {
    chatbotId: 'chatbot-123',
    chatbotName: 'Test Chatbot',
    chatbotPurpose: 'integrate lessons into your life',
    questions: [
      {
        id: 'q1',
        questionText: 'What is your name?',
        helperText: null,
        responseType: 'TEXT' as const,
        displayOrder: 1,
        isRequired: true,
        options: null,
      },
      {
        id: 'q2',
        questionText: 'How old are you?',
        helperText: null,
        responseType: 'NUMBER' as const,
        displayOrder: 2,
        isRequired: false,
        options: null,
      },
    ],
    existingResponses: {},
    onComplete: mockOnComplete,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock conversation creation
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/conversations/create') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            conversation: { id: mockConversationId },
          }),
        });
      }
      
      // Mock user current API
      if (url === '/api/user/current') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ userId: mockDbUserId }),
        });
      }
      
      // Mock message creation
      if (url.includes('/api/conversations/') && url.includes('/messages')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            message: {
              id: `msg-${Date.now()}`,
              conversationId: mockConversationId,
              role: 'assistant',
              content: 'Test message',
              createdAt: new Date().toISOString(),
            },
          }),
        });
      }
      
      // Mock intake responses API
      if (url === '/api/intake/responses') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }
      
      // Mock pills API
      if (url.includes('/api/pills')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: 'pill-1',
              prefillText: 'Tell me more',
              pillType: 'suggested',
            },
          ],
        });
      }
      
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
  });

  describe('Welcome message (Subtask 6.1)', () => {
    it('should display welcome message without firstName', async () => {
      await act(async () => {
        render(<ConversationalIntake {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Hi, I'm Test Chatbot AI/i)).toBeInTheDocument();
        expect(screen.getByText(/First, let's personalise your experience/i)).toBeInTheDocument();
      });
    });

    it('should include chatbot purpose in welcome message', async () => {
      await act(async () => {
        render(<ConversationalIntake {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/integrate lessons into your life/i)).toBeInTheDocument();
      });
    });
  });

  describe('Question flow (Subtask 6.4)', () => {
    it('should show welcome + final message + pills when no questions', async () => {
      const props = {
        ...defaultProps,
        questions: [],
      };

      await act(async () => {
        render(<ConversationalIntake {...props} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Hi, I'm Test Chatbot AI/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/When our conversation is finished/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should display questions one at a time', async () => {
      await act(async () => {
        render(<ConversationalIntake {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText('What is your name?')).toBeInTheDocument();
      });

      // Should not show second question yet
      expect(screen.queryByText('How old are you?')).not.toBeInTheDocument();
    });

    it('should show question counter', async () => {
      await act(async () => {
        render(<ConversationalIntake {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Question 1 of 2')).toBeInTheDocument();
      });
    });
  });

  describe('Skip functionality (Subtask 6.5, 6.9)', () => {
    it('should show Skip link for optional questions', async () => {
      await act(async () => {
        render(<ConversationalIntake {...defaultProps} />);
      });

      // Answer first question (required)
      await waitFor(() => {
        expect(screen.getByText('What is your name?')).toBeInTheDocument();
      });

      const textInput = screen.getByPlaceholderText('Type your answer...');
      fireEvent.change(textInput, { target: { value: 'John' } });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Continue'));
      });

      // Second question is optional, should show Skip link
      await waitFor(() => {
        expect(screen.getByText('Skip')).toBeInTheDocument();
      });
    });

    it('should not show Skip link for required questions', async () => {
      await act(async () => {
        render(<ConversationalIntake {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText('What is your name?')).toBeInTheDocument();
      });

      // First question is required, should not show Skip
      expect(screen.queryByText('Skip')).not.toBeInTheDocument();
    });

    it('should handle skip action', async () => {
      await act(async () => {
        render(<ConversationalIntake {...defaultProps} />);
      });

      // Answer first question
      await waitFor(() => {
        expect(screen.getByText('What is your name?')).toBeInTheDocument();
      });

      const textInput = screen.getByPlaceholderText('Type your answer...');
      fireEvent.change(textInput, { target: { value: 'John' } });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Continue'));
      });

      // Skip second question
      await waitFor(() => {
        expect(screen.getByText('Skip')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Skip'));
      });

      await waitFor(() => {
        expect(screen.getByText('(Skipped)')).toBeInTheDocument();
      });
    });
  });

  describe('Verification flow for existing answers (Subtask 6.3, 6.7, 6.8)', () => {
    it('should show verification message for existing answers', async () => {
      const props = {
        ...defaultProps,
        existingResponses: {
          q1: 'John Doe',
        },
      };

      await act(async () => {
        render(<ConversationalIntake {...props} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/This is what I have. Is it still correct?/i)).toBeInTheDocument();
      });

      // Should show saved answer
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Should show Yes and Modify buttons
      expect(screen.getByText('Yes')).toBeInTheDocument();
      expect(screen.getByText('Modify')).toBeInTheDocument();
    });

    it('should handle Yes button click', async () => {
      const props = {
        ...defaultProps,
        existingResponses: {
          q1: 'John Doe',
        },
      };

      await act(async () => {
        render(<ConversationalIntake {...props} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Yes')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Yes'));
      });

      // Should move to next question
      await waitFor(() => {
        expect(screen.getByText('How old are you?')).toBeInTheDocument();
      });
    });

    it('should handle Modify button click and pre-fill input', async () => {
      const props = {
        ...defaultProps,
        existingResponses: {
          q1: 'John Doe',
        },
      };

      await act(async () => {
        render(<ConversationalIntake {...props} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Modify')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Modify'));
      });

      // Should show input with pre-filled value
      await waitFor(() => {
        const input = screen.getByDisplayValue('John Doe');
        expect(input).toBeInTheDocument();
      });
    });
  });

  describe('Error handling (Subtask 6.6)', () => {
    it('should display error message when save fails', async () => {
      // Mock save failure
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/intake/responses') {
          return Promise.resolve({
            ok: false,
            json: async () => ({ error: 'Failed to save response' }),
          });
        }
        // Other mocks remain the same
        if (url === '/api/conversations/create') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ conversation: { id: mockConversationId } }),
          });
        }
        if (url === '/api/user/current') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ userId: mockDbUserId }),
          });
        }
        if (url.includes('/messages')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              message: {
                id: 'msg-1',
                conversationId: mockConversationId,
                role: 'assistant',
                content: 'Test',
                createdAt: new Date().toISOString(),
              },
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      await act(async () => {
        render(<ConversationalIntake {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText('What is your name?')).toBeInTheDocument();
      });

      const textInput = screen.getByPlaceholderText('Type your answer...');
      fireEvent.change(textInput, { target: { value: 'John' } });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Continue'));
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to save response/i)).toBeInTheDocument();
      });

      // Should show Retry button
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should preserve user input during error', async () => {
      // Mock save failure
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/intake/responses') {
          return Promise.resolve({
            ok: false,
            json: async () => ({ error: 'Failed to save' }),
          });
        }
        // Other mocks
        if (url === '/api/conversations/create') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ conversation: { id: mockConversationId } }),
          });
        }
        if (url === '/api/user/current') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ userId: mockDbUserId }),
          });
        }
        if (url.includes('/messages')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              message: {
                id: 'msg-1',
                conversationId: mockConversationId,
                role: 'assistant',
                content: 'Test',
                createdAt: new Date().toISOString(),
              },
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      await act(async () => {
        render(<ConversationalIntake {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText('What is your name?')).toBeInTheDocument();
      });

      const textInput = screen.getByPlaceholderText('Type your answer...');
      fireEvent.change(textInput, { target: { value: 'John' } });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Continue'));
      });

      // Input should still contain user's answer
      await waitFor(() => {
        expect(screen.getByDisplayValue('John')).toBeInTheDocument();
      });
    });
  });

  describe('Input types', () => {
    it('should render TEXT input correctly', async () => {
      await act(async () => {
        render(<ConversationalIntake {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type your answer...')).toBeInTheDocument();
      });
    });

    it('should render NUMBER input correctly', async () => {
      await act(async () => {
        render(<ConversationalIntake {...defaultProps} />);
      });

      // Answer first question
      await waitFor(() => {
        expect(screen.getByText('What is your name?')).toBeInTheDocument();
      });

      const textInput = screen.getByPlaceholderText('Type your answer...');
      fireEvent.change(textInput, { target: { value: 'John' } });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Continue'));
      });

      // Second question is NUMBER type
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter a number...')).toBeInTheDocument();
      });
    });
  });

  describe('Completion callback', () => {
    it('should call onComplete when intake flow finishes', async () => {
      const props = {
        ...defaultProps,
        questions: [],
      };

      await act(async () => {
        render(<ConversationalIntake {...props} />);
      });

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(mockConversationId);
      }, { timeout: 3000 });
    });
  });
});

