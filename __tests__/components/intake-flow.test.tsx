/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntakeFlow } from '@/components/intake-flow';
import { UseConversationalIntakeReturn } from '@/hooks/use-conversational-intake';
import { WelcomeData } from '@/hooks/use-intake-gate';

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ onChange, onKeyDown, ...props }: any) => (
    <input onChange={onChange} onKeyDown={onKeyDown} {...props} />
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <div data-testid="select">{children}</div>
  ),
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => <div data-testid={`select-item-${value}`}>{children}</div>,
  SelectValue: ({ placeholder }: any) => <div data-testid="select-value">{placeholder}</div>,
}));

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ id, checked, onCheckedChange }: any) => (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      data-testid={`checkbox-${id}`}
    />
  ),
}));

describe('IntakeFlow', () => {
  const mockThemeColors = {
    inputField: '#ffffff',
    input: '#f5f5f5',
    border: '#e0e0e0',
    text: '#000000',
  };
  const mockTextColor = '#000000';

  const createMockIntakeHook = (
    overrides: Partial<UseConversationalIntakeReturn> = {}
  ): UseConversationalIntakeReturn => ({
    conversationId: null,
    messages: [],
    currentQuestionIndex: 0,
    verificationMode: false,
    verificationQuestionId: null,
    modifyMode: false,
    currentInput: '',
    isSaving: false,
    error: null,
    suggestionPills: [],
    showPills: false,
    isInitialized: true,
    handleAnswer: jest.fn(),
    handleSkip: jest.fn(),
    handleVerifyYes: jest.fn(),
    handleVerifyModify: jest.fn(),
    setCurrentInput: jest.fn(),
    currentQuestion: null,
    ...overrides,
  });

  const createMockWelcomeData = (
    overrides: Partial<WelcomeData> = {}
  ): WelcomeData => ({
    chatbotName: 'Test Chatbot',
    chatbotPurpose: 'Help you test',
    intakeCompleted: false,
    hasQuestions: true,
    questions: [
      {
        id: 'q1',
        questionText: 'What is your name?',
        helperText: null,
        responseType: 'TEXT',
        displayOrder: 1,
        isRequired: true,
        options: null,
      },
    ],
    ...overrides,
  });

  describe('question counter', () => {
    it('should display question counter when questions exist', () => {
      const mockHook = createMockIntakeHook({ currentQuestionIndex: 0 });
      const mockWelcomeData = createMockWelcomeData({
        questions: [
          {
            id: 'q1',
            questionText: 'Question 1',
            responseType: 'TEXT',
            displayOrder: 1,
            isRequired: true,
          },
          {
            id: 'q2',
            questionText: 'Question 2',
            responseType: 'TEXT',
            displayOrder: 2,
            isRequired: true,
          },
        ],
      });

      render(
        <IntakeFlow
          intakeHook={mockHook}
          welcomeData={mockWelcomeData}
          themeColors={mockThemeColors}
          textColor={mockTextColor}
        />
      );

      expect(screen.getByText('Question 1 of 2')).toBeInTheDocument();
    });

    it('should not display question counter when questions are undefined', () => {
      const mockHook = createMockIntakeHook();
      const mockWelcomeData = createMockWelcomeData({ questions: undefined });

      render(
        <IntakeFlow
          intakeHook={mockHook}
          welcomeData={mockWelcomeData}
          themeColors={mockThemeColors}
          textColor={mockTextColor}
        />
      );

      expect(screen.queryByText(/Question \d+ of \d+/)).not.toBeInTheDocument();
    });
  });

  describe('verification buttons', () => {
    it('should show Yes and Modify buttons when in verification mode', () => {
      const mockHook = createMockIntakeHook({
        verificationMode: true,
        verificationQuestionId: 'q1',
      });
      const mockWelcomeData = createMockWelcomeData();

      render(
        <IntakeFlow
          intakeHook={mockHook}
          welcomeData={mockWelcomeData}
          themeColors={mockThemeColors}
          textColor={mockTextColor}
        />
      );

      expect(screen.getByText('Yes')).toBeInTheDocument();
      expect(screen.getByText('Modify')).toBeInTheDocument();
    });

    it('should call handleVerifyYes when Yes button is clicked', () => {
      const mockHandleVerifyYes = jest.fn();
      const mockHook = createMockIntakeHook({
        verificationMode: true,
        verificationQuestionId: 'q1',
        handleVerifyYes: mockHandleVerifyYes,
      });
      const mockWelcomeData = createMockWelcomeData();

      render(
        <IntakeFlow
          intakeHook={mockHook}
          welcomeData={mockWelcomeData}
          themeColors={mockThemeColors}
          textColor={mockTextColor}
        />
      );

      fireEvent.click(screen.getByText('Yes'));
      expect(mockHandleVerifyYes).toHaveBeenCalledTimes(1);
    });

    it('should call handleVerifyModify when Modify button is clicked', () => {
      const mockHandleVerifyModify = jest.fn();
      const mockHook = createMockIntakeHook({
        verificationMode: true,
        verificationQuestionId: 'q1',
        handleVerifyModify: mockHandleVerifyModify,
      });
      const mockWelcomeData = createMockWelcomeData();

      render(
        <IntakeFlow
          intakeHook={mockHook}
          welcomeData={mockWelcomeData}
          themeColors={mockThemeColors}
          textColor={mockTextColor}
        />
      );

      fireEvent.click(screen.getByText('Modify'));
      expect(mockHandleVerifyModify).toHaveBeenCalledTimes(1);
    });

    it('should disable buttons when isSaving is true', () => {
      const mockHook = createMockIntakeHook({
        verificationMode: true,
        verificationQuestionId: 'q1',
        isSaving: true,
      });
      const mockWelcomeData = createMockWelcomeData();

      render(
        <IntakeFlow
          intakeHook={mockHook}
          welcomeData={mockWelcomeData}
          themeColors={mockThemeColors}
          textColor={mockTextColor}
        />
      );

      const yesButton = screen.getByText('Yes');
      const modifyButton = screen.getByText('Modify');
      expect(yesButton).toBeDisabled();
      expect(modifyButton).toBeDisabled();
    });

    it('should not show verification buttons when not in verification mode', () => {
      const mockHook = createMockIntakeHook({
        verificationMode: false,
        currentQuestion: {
          id: 'q1',
          questionText: 'What is your name?',
          responseType: 'TEXT',
          displayOrder: 1,
          isRequired: true,
        },
      });
      const mockWelcomeData = createMockWelcomeData();

      render(
        <IntakeFlow
          intakeHook={mockHook}
          welcomeData={mockWelcomeData}
          themeColors={mockThemeColors}
          textColor={mockTextColor}
        />
      );

      expect(screen.queryByText('Yes')).not.toBeInTheDocument();
      expect(screen.queryByText('Modify')).not.toBeInTheDocument();
    });
  });

  describe('TEXT question type', () => {
    it('should render textarea for TEXT questions', () => {
      const mockHook = createMockIntakeHook({
        currentQuestion: {
          id: 'q1',
          questionText: 'What is your name?',
          responseType: 'TEXT',
          displayOrder: 1,
          isRequired: true,
        },
      });
      const mockWelcomeData = createMockWelcomeData();

      render(
        <IntakeFlow
          intakeHook={mockHook}
          welcomeData={mockWelcomeData}
          themeColors={mockThemeColors}
          textColor={mockTextColor}
        />
      );

      const textarea = screen.getByPlaceholderText('Type your answer...');
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('should call setCurrentInput when textarea value changes', () => {
      const mockSetCurrentInput = jest.fn();
      const mockHook = createMockIntakeHook({
        currentQuestion: {
          id: 'q1',
          questionText: 'What is your name?',
          responseType: 'TEXT',
          displayOrder: 1,
          isRequired: true,
        },
        setCurrentInput: mockSetCurrentInput,
      });
      const mockWelcomeData = createMockWelcomeData();

      render(
        <IntakeFlow
          intakeHook={mockHook}
          welcomeData={mockWelcomeData}
          themeColors={mockThemeColors}
          textColor={mockTextColor}
        />
      );

      const textarea = screen.getByPlaceholderText('Type your answer...');
      fireEvent.change(textarea, { target: { value: 'John Doe' } });

      expect(mockSetCurrentInput).toHaveBeenCalledWith('John Doe');
    });

    it('should call handleAnswer when Enter is pressed', () => {
      const mockHandleAnswer = jest.fn();
      const mockHook = createMockIntakeHook({
        currentQuestion: {
          id: 'q1',
          questionText: 'What is your name?',
          responseType: 'TEXT',
          displayOrder: 1,
          isRequired: true,
        },
        currentInput: 'John Doe',
        handleAnswer: mockHandleAnswer,
      });
      const mockWelcomeData = createMockWelcomeData();

      render(
        <IntakeFlow
          intakeHook={mockHook}
          welcomeData={mockWelcomeData}
          themeColors={mockThemeColors}
          textColor={mockTextColor}
        />
      );

      const textarea = screen.getByPlaceholderText('Type your answer...');
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      expect(mockHandleAnswer).toHaveBeenCalledWith('John Doe');
    });

    it('should show Skip button for optional questions', () => {
      const mockHook = createMockIntakeHook({
        currentQuestion: {
          id: 'q1',
          questionText: 'What is your name?',
          responseType: 'TEXT',
          displayOrder: 1,
          isRequired: false,
        },
      });
      const mockWelcomeData = createMockWelcomeData();

      render(
        <IntakeFlow
          intakeHook={mockHook}
          welcomeData={mockWelcomeData}
          themeColors={mockThemeColors}
          textColor={mockTextColor}
        />
      );

      expect(screen.getByText('Skip')).toBeInTheDocument();
    });

    it('should not show Skip button for required questions', () => {
      const mockHook = createMockIntakeHook({
        currentQuestion: {
          id: 'q1',
          questionText: 'What is your name?',
          responseType: 'TEXT',
          displayOrder: 1,
          isRequired: true,
        },
      });
      const mockWelcomeData = createMockWelcomeData();

      render(
        <IntakeFlow
          intakeHook={mockHook}
          welcomeData={mockWelcomeData}
          themeColors={mockThemeColors}
          textColor={mockTextColor}
        />
      );

      expect(screen.queryByText('Skip')).not.toBeInTheDocument();
    });
  });

  describe('NUMBER question type', () => {
    it('should render number input for NUMBER questions', () => {
      const mockHook = createMockIntakeHook({
        currentQuestion: {
          id: 'q1',
          questionText: 'What is your age?',
          responseType: 'NUMBER',
          displayOrder: 1,
          isRequired: true,
        },
      });
      const mockWelcomeData = createMockWelcomeData({
        questions: [
          {
            id: 'q1',
            questionText: 'What is your age?',
            responseType: 'NUMBER',
            displayOrder: 1,
            isRequired: true,
          },
        ],
      });

      render(
        <IntakeFlow
          intakeHook={mockHook}
          welcomeData={mockWelcomeData}
          themeColors={mockThemeColors}
          textColor={mockTextColor}
        />
      );

      const input = screen.getByPlaceholderText('Enter a number...');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'number');
    });
  });

  describe('SELECT question type', () => {
    it('should render Select component for SELECT questions', () => {
      const mockHook = createMockIntakeHook({
        currentQuestion: {
          id: 'q1',
          questionText: 'Choose an option',
          responseType: 'SELECT',
          displayOrder: 1,
          isRequired: true,
          options: ['Option 1', 'Option 2'],
        },
      });
      const mockWelcomeData = createMockWelcomeData({
        questions: [
          {
            id: 'q1',
            questionText: 'Choose an option',
            responseType: 'SELECT',
            displayOrder: 1,
            isRequired: true,
            options: ['Option 1', 'Option 2'],
          },
        ],
      });

      render(
        <IntakeFlow
          intakeHook={mockHook}
          welcomeData={mockWelcomeData}
          themeColors={mockThemeColors}
          textColor={mockTextColor}
        />
      );

      expect(screen.getByTestId('select')).toBeInTheDocument();
    });
  });

  describe('MULTI_SELECT question type', () => {
    it('should render checkboxes for MULTI_SELECT questions', () => {
      const mockHook = createMockIntakeHook({
        currentQuestion: {
          id: 'q1',
          questionText: 'Select multiple options',
          responseType: 'MULTI_SELECT',
          displayOrder: 1,
          isRequired: true,
          options: ['Option 1', 'Option 2', 'Option 3'],
        },
        currentInput: [],
      });
      const mockWelcomeData = createMockWelcomeData({
        questions: [
          {
            id: 'q1',
            questionText: 'Select multiple options',
            responseType: 'MULTI_SELECT',
            displayOrder: 1,
            isRequired: true,
            options: ['Option 1', 'Option 2', 'Option 3'],
          },
        ],
      });

      render(
        <IntakeFlow
          intakeHook={mockHook}
          welcomeData={mockWelcomeData}
          themeColors={mockThemeColors}
          textColor={mockTextColor}
        />
      );

      expect(screen.getByTestId('checkbox-q1-0')).toBeInTheDocument();
      expect(screen.getByTestId('checkbox-q1-1')).toBeInTheDocument();
      expect(screen.getByTestId('checkbox-q1-2')).toBeInTheDocument();
    });

    it('should show Continue button when options are selected', () => {
      const mockHook = createMockIntakeHook({
        currentQuestion: {
          id: 'q1',
          questionText: 'Select multiple options',
          responseType: 'MULTI_SELECT',
          displayOrder: 1,
          isRequired: true,
          options: ['Option 1', 'Option 2'],
        },
        currentInput: ['Option 1'],
      });
      const mockWelcomeData = createMockWelcomeData({
        questions: [
          {
            id: 'q1',
            questionText: 'Select multiple options',
            responseType: 'MULTI_SELECT',
            displayOrder: 1,
            isRequired: true,
            options: ['Option 1', 'Option 2'],
          },
        ],
      });

      render(
        <IntakeFlow
          intakeHook={mockHook}
          welcomeData={mockWelcomeData}
          themeColors={mockThemeColors}
          textColor={mockTextColor}
        />
      );

      expect(screen.getByText('Continue')).toBeInTheDocument();
    });
  });

  describe('BOOLEAN question type', () => {
    it('should render checkbox for BOOLEAN questions', () => {
      const mockHook = createMockIntakeHook({
        currentQuestion: {
          id: 'q1',
          questionText: 'Do you agree?',
          responseType: 'BOOLEAN',
          displayOrder: 1,
          isRequired: true,
        },
        currentInput: false,
      });
      const mockWelcomeData = createMockWelcomeData({
        questions: [
          {
            id: 'q1',
            questionText: 'Do you agree?',
            responseType: 'BOOLEAN',
            displayOrder: 1,
            isRequired: true,
          },
        ],
      });

      render(
        <IntakeFlow
          intakeHook={mockHook}
          welcomeData={mockWelcomeData}
          themeColors={mockThemeColors}
          textColor={mockTextColor}
        />
      );

      const checkbox = screen.getByTestId('checkbox-q1');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toHaveAttribute('type', 'checkbox');
    });
  });

  describe('error handling', () => {
    it('should display error message when error exists', () => {
      const mockHook = createMockIntakeHook({
        currentQuestion: {
          id: 'q1',
          questionText: 'What is your name?',
          responseType: 'TEXT',
          displayOrder: 1,
          isRequired: true,
        },
        error: 'Failed to save response',
      });
      const mockWelcomeData = createMockWelcomeData();

      render(
        <IntakeFlow
          intakeHook={mockHook}
          welcomeData={mockWelcomeData}
          themeColors={mockThemeColors}
          textColor={mockTextColor}
        />
      );

      expect(screen.getByText('Failed to save response')).toBeInTheDocument();
    });

    it('should show Retry button for TEXT questions when error exists', () => {
      const mockHandleAnswer = jest.fn();
      const mockHook = createMockIntakeHook({
        currentQuestion: {
          id: 'q1',
          questionText: 'What is your name?',
          responseType: 'TEXT',
          displayOrder: 1,
          isRequired: true,
        },
        error: 'Failed to save response',
        currentInput: 'John Doe',
        handleAnswer: mockHandleAnswer,
      });
      const mockWelcomeData = createMockWelcomeData();

      render(
        <IntakeFlow
          intakeHook={mockHook}
          welcomeData={mockWelcomeData}
          themeColors={mockThemeColors}
          textColor={mockTextColor}
        />
      );

      const retryButton = screen.getByText('Retry');
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(mockHandleAnswer).toHaveBeenCalledWith('John Doe');
    });
  });
});

