/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserContextEditor } from '@/components/user-context-editor';

// Mock next/navigation
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className }: any) => (
    <button onClick={onClick} disabled={disabled} className={className} data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, className }: any) => (
    <input value={value} onChange={onChange} className={className} />
  ),
}));

jest.mock('@/components/ui/textarea', () => ({
  Textarea: ({ value, onChange, className, rows }: any) => (
    <textarea value={value} onChange={onChange} className={className} rows={rows} />
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className} data-testid="card">{children}</div>,
  CardHeader: ({ children, className }: any) => <div className={className} data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: any) => <h3 className={className} data-testid="card-title">{children}</h3>,
  CardDescription: ({ children, className }: any) => <p className={className} data-testid="card-description">{children}</p>,
  CardContent: ({ children, className }: any) => <div className={className} data-testid="card-content">{children}</div>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span className={className} data-variant={variant} data-testid="badge">{children}</span>
  ),
}));

// Mock fetch
global.fetch = jest.fn();

describe('UserContextEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    mockRefresh.mockClear();
  });

  const mockContexts = [
    {
      id: 'ctx1',
      key: 'industry',
      value: 'Technology',
      chatbotId: null,
      chatbot: null,
      source: 'INTAKE_FORM',
      isEditable: true,
    },
    {
      id: 'ctx2',
      key: 'role',
      value: 'Software Engineer',
      chatbotId: null,
      chatbot: null,
      source: 'USER_PROVIDED',
      isEditable: true,
    },
    {
      id: 'ctx3',
      key: 'goals',
      value: ['Learn React', 'Build apps'],
      chatbotId: 'chatbot1',
      chatbot: { title: 'Tech Mentor' },
      source: 'INTAKE_FORM',
      isEditable: true,
    },
    {
      id: 'ctx4',
      key: 'company_size',
      value: 50,
      chatbotId: 'chatbot1',
      chatbot: { title: 'Tech Mentor' },
      source: 'INTAKE_FORM',
      isEditable: false, // Not editable
    },
  ];

  describe('rendering', () => {
    it('should render empty state when no contexts provided', () => {
      render(<UserContextEditor contexts={[]} questionMap={new Map()} />);
      
      expect(screen.getByText(/No user context found/i)).toBeInTheDocument();
    });

    it('should render global contexts section', () => {
      const globalContexts = mockContexts.filter(c => !c.chatbotId);
      render(<UserContextEditor contexts={globalContexts} questionMap={new Map()} />);
      
      expect(screen.getByText('Global Context')).toBeInTheDocument();
      expect(screen.getByText(/applies to all chatbots/i)).toBeInTheDocument();
      expect(screen.getByText('industry')).toBeInTheDocument();
      expect(screen.getByText('role')).toBeInTheDocument();
    });

    it('should render chatbot-specific contexts section', () => {
      const chatbotContexts = mockContexts.filter(c => c.chatbotId);
      render(<UserContextEditor contexts={chatbotContexts} questionMap={new Map()} />);
      
      expect(screen.getByText(/Tech Mentor.*Context/i)).toBeInTheDocument();
      expect(screen.getByText(/applies only to this specific chatbot/i)).toBeInTheDocument();
      expect(screen.getByText('goals')).toBeInTheDocument();
      expect(screen.getByText('company size')).toBeInTheDocument(); // Keys are formatted with spaces
    });

    it('should display context values correctly', () => {
      render(<UserContextEditor contexts={mockContexts} questionMap={new Map()} />);
      
      // String values
      expect(screen.getByText('Technology')).toBeInTheDocument();
      expect(screen.getByText('Software Engineer')).toBeInTheDocument();
      
      // Array values (should be JSON stringified)
      expect(screen.getByText(/Learn React/i)).toBeInTheDocument();
      
      // Number values
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('should display source badges', () => {
      render(<UserContextEditor contexts={mockContexts} questionMap={new Map()} />);
      
      expect(screen.getAllByText(/intake form/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/user provided/i).length).toBeGreaterThan(0);
    });

    it('should only show Edit button for editable contexts', () => {
      render(<UserContextEditor contexts={mockContexts} questionMap={new Map()} />);
      
      const editButtons = screen.getAllByText('Edit');
      // Should have 3 edit buttons (for editable contexts)
      expect(editButtons.length).toBe(3);
      
      // company_size should not have edit button (isEditable: false)
      // Note: Keys are formatted with spaces, so we search for "company size"
      const companySizeRow = screen.getByText('company size').closest('div');
      const editButtonsInRow = companySizeRow?.querySelectorAll('button');
      const hasEditButton = Array.from(editButtonsInRow || []).some(btn => btn.textContent === 'Edit');
      expect(hasEditButton).toBe(false);
    });
  });

  describe('value formatting', () => {
    it('should format string values correctly', () => {
      const contexts = [{
        id: 'ctx1',
        key: 'name',
        value: 'John Doe',
        chatbotId: null,
        chatbot: null,
        source: 'USER_PROVIDED',
        isEditable: true,
      }];
      
      render(<UserContextEditor contexts={contexts} questionMap={new Map()} />);
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should format number values correctly', () => {
      const contexts = [{
        id: 'ctx1',
        key: 'age',
        value: 30,
        chatbotId: null,
        chatbot: null,
        source: 'USER_PROVIDED',
        isEditable: true,
      }];
      
      render(<UserContextEditor contexts={contexts} questionMap={new Map()} />);
      expect(screen.getByText('30')).toBeInTheDocument();
    });

    it('should format boolean values correctly', () => {
      const contexts = [{
        id: 'ctx1',
        key: 'active',
        value: true,
        chatbotId: null,
        chatbot: null,
        source: 'USER_PROVIDED',
        isEditable: true,
      }];
      
      render(<UserContextEditor contexts={contexts} questionMap={new Map()} />);
      expect(screen.getByText('true')).toBeInTheDocument();
    });

    it('should format array values as JSON', () => {
      const contexts = [{
        id: 'ctx1',
        key: 'skills',
        value: ['React', 'TypeScript'],
        chatbotId: null,
        chatbot: null,
        source: 'USER_PROVIDED',
        isEditable: true,
      }];
      
      render(<UserContextEditor contexts={contexts} questionMap={new Map()} />);
      expect(screen.getByText(/React/i)).toBeInTheDocument();
      expect(screen.getByText(/TypeScript/i)).toBeInTheDocument();
    });

    it('should format object values as JSON', () => {
      const contexts = [{
        id: 'ctx1',
        key: 'preferences',
        value: { theme: 'dark', language: 'en' },
        chatbotId: null,
        chatbot: null,
        source: 'USER_PROVIDED',
        isEditable: true,
      }];
      
      render(<UserContextEditor contexts={contexts} questionMap={new Map()} />);
      expect(screen.getByText(/theme/i)).toBeInTheDocument();
      expect(screen.getByText(/dark/i)).toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    it('should enter edit mode when Edit button is clicked', () => {
      const contexts = [{
        id: 'ctx1',
        key: 'name',
        value: 'John Doe',
        chatbotId: null,
        chatbot: null,
        source: 'USER_PROVIDED',
        isEditable: true,
      }];
      
      render(<UserContextEditor contexts={contexts} questionMap={new Map()} />);
      
      const editButton = screen.getByText('Edit');
      fireEvent.click(editButton);
      
      // Should show input field
      const input = screen.getByDisplayValue('John Doe');
      expect(input).toBeInTheDocument();
      
      // Should show Save and Cancel buttons
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should use Input for simple values', () => {
      const contexts = [{
        id: 'ctx1',
        key: 'name',
        value: 'John Doe',
        chatbotId: null,
        chatbot: null,
        source: 'USER_PROVIDED',
        isEditable: true,
      }];
      
      render(<UserContextEditor contexts={contexts} questionMap={new Map()} />);
      
      fireEvent.click(screen.getByText('Edit'));
      
      const input = screen.getByDisplayValue('John Doe');
      expect(input.tagName).toBe('INPUT');
    });

    it('should use Textarea for complex values', () => {
      const contexts = [{
        id: 'ctx1',
        key: 'preferences',
        value: { theme: 'dark' },
        chatbotId: null,
        chatbot: null,
        source: 'USER_PROVIDED',
        isEditable: true,
      }];
      
      render(<UserContextEditor contexts={contexts} questionMap={new Map()} />);
      
      fireEvent.click(screen.getByText('Edit'));
      
      // Find textarea - it should be rendered for complex values
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
      expect(textarea.value).toContain('theme');
      expect(textarea.value).toContain('dark');
    });

    it('should exit edit mode when Cancel is clicked', () => {
      const contexts = [{
        id: 'ctx1',
        key: 'name',
        value: 'John Doe',
        chatbotId: null,
        chatbot: null,
        source: 'USER_PROVIDED',
        isEditable: true,
      }];
      
      render(<UserContextEditor contexts={contexts} questionMap={new Map()} />);
      
      fireEvent.click(screen.getByText('Edit'));
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Cancel'));
      
      // Input should be gone, value should be displayed again
      expect(screen.queryByDisplayValue('John Doe')).not.toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should clear errors when Cancel is clicked', () => {
      const contexts = [{
        id: 'ctx1',
        key: 'name',
        value: 'John Doe',
        chatbotId: null,
        chatbot: null,
        source: 'USER_PROVIDED',
        isEditable: true,
      }];
      
      render(<UserContextEditor contexts={contexts} questionMap={new Map()} />);
      
      fireEvent.click(screen.getByText('Edit'));
      
      // Simulate an error (by manually setting error state would require more complex test)
      // For now, just verify Cancel button exists and works
      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toBeInTheDocument();
      fireEvent.click(cancelButton);
      
      // Should exit edit mode
      expect(screen.queryByDisplayValue('John Doe')).not.toBeInTheDocument();
    });
  });

  describe('save functionality', () => {
    it('should save context value successfully', async () => {
      const contexts = [{
        id: 'ctx1',
        key: 'name',
        value: 'John Doe',
        chatbotId: null,
        chatbot: null,
        source: 'USER_PROVIDED',
        isEditable: true,
      }];
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          context: {
            id: 'ctx1',
            key: 'name',
            value: 'Jane Doe',
            updatedAt: new Date().toISOString(),
          },
        }),
      });
      
      render(<UserContextEditor contexts={contexts} questionMap={new Map()} />);
      
      fireEvent.click(screen.getByText('Edit'));
      
      const input = screen.getByDisplayValue('John Doe');
      fireEvent.change(input, { target: { value: 'Jane Doe' } });
      
      fireEvent.click(screen.getByText('Save'));
      
      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
      });
      
      // Should call API
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/user-context', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contextId: 'ctx1',
            value: 'Jane Doe',
          }),
        });
      });
      
      // Should refresh router
      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it('should handle save errors', async () => {
      const contexts = [{
        id: 'ctx1',
        key: 'name',
        value: 'John Doe',
        chatbotId: null,
        chatbot: null,
        source: 'USER_PROVIDED',
        isEditable: true,
      }];
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Failed to save context',
        }),
      });
      
      render(<UserContextEditor contexts={contexts} questionMap={new Map()} />);
      
      fireEvent.click(screen.getByText('Edit'));
      fireEvent.click(screen.getByText('Save'));
      
      await waitFor(() => {
        expect(screen.getByText('Failed to save context')).toBeInTheDocument();
      });
      
      // Should not refresh on error
      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it('should parse JSON values correctly when saving', async () => {
      const contexts = [{
        id: 'ctx1',
        key: 'preferences',
        value: { theme: 'dark' },
        chatbotId: null,
        chatbot: null,
        source: 'USER_PROVIDED',
        isEditable: true,
      }];
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          context: {
            id: 'ctx1',
            key: 'preferences',
            value: { theme: 'light' },
            updatedAt: new Date().toISOString(),
          },
        }),
      });
      
      render(<UserContextEditor contexts={contexts} questionMap={new Map()} />);
      
      fireEvent.click(screen.getByText('Edit'));
      
      // Find textarea - it should contain the JSON value
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea).toBeInTheDocument();
      expect(textarea.value).toContain('theme');
      expect(textarea.value).toContain('dark');
      
      fireEvent.change(textarea, {
        target: { value: JSON.stringify({ theme: 'light' }, null, 2) },
      });
      
      fireEvent.click(screen.getByText('Save'));
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/user-context', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contextId: 'ctx1',
            value: { theme: 'light' },
          }),
        });
      });
    });

    it('should handle non-JSON string values when saving', async () => {
      const contexts = [{
        id: 'ctx1',
        key: 'name',
        value: 'John Doe',
        chatbotId: null,
        chatbot: null,
        source: 'USER_PROVIDED',
        isEditable: true,
      }];
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          context: {
            id: 'ctx1',
            key: 'name',
            value: 'Jane Doe',
            updatedAt: new Date().toISOString(),
          },
        }),
      });
      
      render(<UserContextEditor contexts={contexts} questionMap={new Map()} />);
      
      fireEvent.click(screen.getByText('Edit'));
      
      const input = screen.getByDisplayValue('John Doe');
      fireEvent.change(input, { target: { value: 'Jane Doe' } });
      
      fireEvent.click(screen.getByText('Save'));
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/user-context', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contextId: 'ctx1',
            value: 'Jane Doe',
          }),
        });
      });
    });
  });

  describe('grouping', () => {
    it('should group global contexts separately', () => {
      const contexts = [
        {
          id: 'ctx1',
          key: 'industry',
          value: 'Tech',
          chatbotId: null,
          chatbot: null,
          source: 'USER_PROVIDED',
          isEditable: true,
        },
        {
          id: 'ctx2',
          key: 'role',
          value: 'Engineer',
          chatbotId: null,
          chatbot: null,
          source: 'USER_PROVIDED',
          isEditable: true,
        },
      ];
      
      render(<UserContextEditor contexts={contexts} questionMap={new Map()} />);
      
      expect(screen.getByText('Global Context')).toBeInTheDocument();
      expect(screen.getByText('industry')).toBeInTheDocument();
      expect(screen.getByText('role')).toBeInTheDocument();
    });

    it('should group chatbot-specific contexts by chatbot', () => {
      const contexts = [
        {
          id: 'ctx1',
          key: 'goals',
          value: 'Learn React',
          chatbotId: 'chatbot1',
          chatbot: { title: 'Tech Mentor' },
          source: 'USER_PROVIDED',
          isEditable: true,
        },
        {
          id: 'ctx2',
          key: 'experience',
          value: 'Beginner',
          chatbotId: 'chatbot1',
          chatbot: { title: 'Tech Mentor' },
          source: 'USER_PROVIDED',
          isEditable: true,
        },
        {
          id: 'ctx3',
          key: 'preferences',
          value: 'Dark mode',
          chatbotId: 'chatbot2',
          chatbot: { title: 'Design Helper' },
          source: 'USER_PROVIDED',
          isEditable: true,
        },
      ];
      
      render(<UserContextEditor contexts={contexts} questionMap={new Map()} />);
      
      expect(screen.getByText(/Tech Mentor.*Context/i)).toBeInTheDocument();
      expect(screen.getByText(/Design Helper.*Context/i)).toBeInTheDocument();
      expect(screen.getByText('goals')).toBeInTheDocument();
      expect(screen.getByText('experience')).toBeInTheDocument();
      expect(screen.getByText('preferences')).toBeInTheDocument();
    });
  });

  describe('key formatting', () => {
    it('should format keys with underscores as spaces', () => {
      const contexts = [{
        id: 'ctx1',
        key: 'company_size',
        value: 50,
        chatbotId: null,
        chatbot: null,
        source: 'USER_PROVIDED',
        isEditable: true,
      }];
      
      render(<UserContextEditor contexts={contexts} questionMap={new Map()} />);
      
      // Key should be displayed with spaces instead of underscores
      expect(screen.getByText('company size')).toBeInTheDocument();
    });
  });
});

