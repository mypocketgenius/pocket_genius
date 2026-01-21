/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useConversationalIntake,
  intakeReducer,
  createInitialIntakeState,
  IntakeQuestion,
  IntakeMessage,
  IntakeAction,
} from '@/hooks/use-conversational-intake';
import { useAuth } from '@clerk/nextjs';
import { Pill as PillType } from '@/components/pills/pill';

// Mock Clerk's useAuth
jest.mock('@clerk/nextjs', () => ({
  useAuth: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock console methods to avoid noise in tests
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

describe('useConversationalIntake', () => {
  const mockUserId = 'user-123';
  const mockChatbotId = 'chatbot-123';
  const mockChatbotName = 'Test Chatbot';
  const mockChatbotPurpose = 'Help you test';
  const mockConversationId = 'conv-123';

  const mockQuestions: IntakeQuestion[] = [
    {
      id: 'q1',
      questionText: 'What is your name?',
      helperText: null,
      responseType: 'TEXT',
      displayOrder: 1,
      isRequired: true,
      options: null,
    },
    {
      id: 'q2',
      questionText: 'What is your favorite color?',
      helperText: null,
      responseType: 'SELECT',
      displayOrder: 2,
      isRequired: false,
      options: ['Red', 'Blue', 'Green'],
    },
    {
      id: 'q3',
      questionText: 'Do you like testing?',
      helperText: null,
      responseType: 'BOOLEAN',
      displayOrder: 3,
      isRequired: true,
      options: null,
    },
  ];

  const mockPills: PillType[] = [
    {
      id: 'pill-1',
      text: 'Test Pill',
      pillType: 'suggested',
      chatbotId: mockChatbotId,
    },
  ];

  const mockOnMessageAdded = jest.fn();
  const mockOnComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    (useAuth as jest.Mock).mockReturnValue({
      userId: mockUserId,
    });
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();
    consoleLogSpy.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  // ============================================================================
  // REDUCER TESTS
  // ============================================================================

  describe('intakeReducer', () => {
    describe('Initialization actions', () => {
      it('handles INIT_START', () => {
        const state = createInitialIntakeState();
        const action: IntakeAction = {
          type: 'INIT_START',
          payload: {
            chatbotId: mockChatbotId,
            chatbotName: mockChatbotName,
            chatbotPurpose: mockChatbotPurpose,
            questions: mockQuestions,
            existingResponses: {},
          },
        };
        const newState = intakeReducer(state, action);
        expect(newState.phase).toBe('initializing');
        expect(newState.chatbotId).toBe(mockChatbotId);
        expect(newState.chatbotName).toBe(mockChatbotName);
        expect(newState.chatbotPurpose).toBe(mockChatbotPurpose);
        expect(newState.questions).toEqual(mockQuestions);
        expect(newState.error).toBeNull();
      });

      it('handles INIT_CONVERSATION_CREATED', () => {
        const state = createInitialIntakeState();
        const action: IntakeAction = {
          type: 'INIT_CONVERSATION_CREATED',
          payload: { conversationId: mockConversationId },
        };
        const newState = intakeReducer(state, action);
        expect(newState.conversationId).toBe(mockConversationId);
      });

      it('handles INIT_COMPLETE with questions', () => {
        const state = {
          ...createInitialIntakeState(),
          questions: mockQuestions,
        };
        const action: IntakeAction = { type: 'INIT_COMPLETE' };
        const newState = intakeReducer(state, action);
        expect(newState.phase).toBe('welcome');
        expect(newState.isInitialized).toBe(true);
      });

      it('handles INIT_COMPLETE without questions', () => {
        const state = createInitialIntakeState();
        const action: IntakeAction = { type: 'INIT_COMPLETE' };
        const newState = intakeReducer(state, action);
        expect(newState.phase).toBe('final');
        expect(newState.isInitialized).toBe(true);
      });

      it('handles INIT_ERROR', () => {
        const state = createInitialIntakeState();
        const action: IntakeAction = {
          type: 'INIT_ERROR',
          payload: { error: 'Initialization failed' },
        };
        const newState = intakeReducer(state, action);
        expect(newState.phase).toBe('completed');
        expect(newState.error).toBe('Initialization failed');
        expect(newState.isInitialized).toBe(true);
      });
    });

    describe('Question flow actions', () => {
      it('handles SHOW_WELCOME', () => {
        const state = createInitialIntakeState();
        const action: IntakeAction = {
          type: 'SHOW_WELCOME',
          payload: { conversationId: mockConversationId },
        };
        const newState = intakeReducer(state, action);
        expect(newState.phase).toBe('welcome');
        expect(newState.currentQuestionIndex).toBe(-1);
        expect(newState.mode).toBe('question');
        expect(newState.currentInput).toBe('');
        expect(newState.error).toBeNull();
      });

      it('handles SHOW_QUESTION', () => {
        const state = {
          ...createInitialIntakeState(),
          questions: mockQuestions,
        };
        const action: IntakeAction = {
          type: 'SHOW_QUESTION',
          payload: { index: 0, hasExisting: false },
        };
        const newState = intakeReducer(state, action);
        expect(newState.phase).toBe('question');
        expect(newState.currentQuestionIndex).toBe(0);
        expect(newState.mode).toBe('question');
        expect(newState.currentInput).toBe('');
        expect(newState.error).toBeNull();
      });

      it('handles SHOW_QUESTION with invalid index', () => {
        const state = {
          ...createInitialIntakeState(),
          questions: mockQuestions,
        };
        const action: IntakeAction = {
          type: 'SHOW_QUESTION',
          payload: { index: 999, hasExisting: false },
        };
        const newState = intakeReducer(state, action);
        expect(newState).toBe(state); // Should return unchanged state
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it('handles SHOW_VERIFICATION', () => {
        const state = {
          ...createInitialIntakeState(),
          questions: mockQuestions,
        };
        const action: IntakeAction = {
          type: 'SHOW_VERIFICATION',
          payload: { index: 0, existingValue: 'John Doe' },
        };
        const newState = intakeReducer(state, action);
        expect(newState.phase).toBe('verification');
        expect(newState.currentQuestionIndex).toBe(0);
        expect(newState.mode).toBe('verification');
        expect(newState.currentInput).toBe('');
        expect(newState.error).toBeNull();
      });

      it('handles ENTER_MODIFY_MODE', () => {
        const state = {
          ...createInitialIntakeState(),
          questions: mockQuestions,
          currentQuestionIndex: 0,
        };
        const action: IntakeAction = {
          type: 'ENTER_MODIFY_MODE',
          payload: { existingValue: 'John Doe' },
        };
        const newState = intakeReducer(state, action);
        expect(newState.phase).toBe('modify');
        expect(newState.mode).toBe('modify');
        expect(newState.currentInput).toBe('John Doe');
        expect(newState.error).toBeNull();
      });

      it('handles SHOW_FINAL_MESSAGE', () => {
        const state = createInitialIntakeState();
        const action: IntakeAction = {
          type: 'SHOW_FINAL_MESSAGE',
          payload: { conversationId: mockConversationId },
        };
        const newState = intakeReducer(state, action);
        expect(newState.phase).toBe('final');
        expect(newState.currentQuestionIndex).toBe(-2);
        expect(newState.mode).toBe('question');
        expect(newState.currentInput).toBe('');
        expect(newState.error).toBeNull();
      });
    });

    describe('User interaction actions', () => {
      it('handles SET_INPUT', () => {
        const state = createInitialIntakeState();
        const action: IntakeAction = {
          type: 'SET_INPUT',
          payload: { value: 'Test input' },
        };
        const newState = intakeReducer(state, action);
        expect(newState.currentInput).toBe('Test input');
        expect(newState.error).toBeNull();
      });

      it('handles SUBMIT_ANSWER_START', () => {
        const state = createInitialIntakeState();
        const action: IntakeAction = {
          type: 'SUBMIT_ANSWER_START',
          payload: { value: 'Answer' },
        };
        const newState = intakeReducer(state, action);
        expect(newState.phase).toBe('saving');
        expect(newState.isSaving).toBe(true);
        expect(newState.error).toBeNull();
      });

      it('handles SUBMIT_ANSWER_SUCCESS', () => {
        const state = {
          ...createInitialIntakeState(),
          isSaving: true,
        };
        const message: IntakeMessage = {
          id: 'msg-1',
          role: 'user',
          content: 'Answer',
        };
        const action: IntakeAction = {
          type: 'SUBMIT_ANSWER_SUCCESS',
          payload: { questionId: 'q1', value: 'Answer', message },
        };
        const newState = intakeReducer(state, action);
        expect(newState.isSaving).toBe(false);
        expect(newState.phase).toBe('question');
        expect(newState.currentInput).toBe('');
        expect(newState.error).toBeNull();
      });

      it('handles SUBMIT_ANSWER_ERROR in modify mode', () => {
        const state = {
          ...createInitialIntakeState(),
          mode: 'modify',
          isSaving: true,
          errorRetryCount: 0,
        };
        const action: IntakeAction = {
          type: 'SUBMIT_ANSWER_ERROR',
          payload: { error: 'Save failed' },
        };
        const newState = intakeReducer(state, action);
        expect(newState.isSaving).toBe(false);
        expect(newState.phase).toBe('modify');
        expect(newState.error).toBe('Save failed');
        expect(newState.errorRetryCount).toBe(1);
      });

      it('handles SUBMIT_ANSWER_ERROR in question mode', () => {
        const state = {
          ...createInitialIntakeState(),
          mode: 'question',
          isSaving: true,
          errorRetryCount: 0,
        };
        const action: IntakeAction = {
          type: 'SUBMIT_ANSWER_ERROR',
          payload: { error: 'Save failed' },
        };
        const newState = intakeReducer(state, action);
        expect(newState.isSaving).toBe(false);
        expect(newState.phase).toBe('question');
        expect(newState.error).toBe('Save failed');
        expect(newState.errorRetryCount).toBe(1);
      });

      it('handles VERIFY_YES', () => {
        const state = {
          ...createInitialIntakeState(),
          phase: 'verification',
          currentQuestionIndex: 0,
        };
        const action: IntakeAction = { type: 'VERIFY_YES' };
        const newState = intakeReducer(state, action);
        expect(newState.phase).toBe('question');
        expect(newState.mode).toBe('question');
        expect(newState.currentInput).toBe('');
        expect(newState.error).toBeNull();
      });

      it('handles VERIFY_YES outside verification phase', () => {
        const state = {
          ...createInitialIntakeState(),
          phase: 'question',
        };
        const action: IntakeAction = { type: 'VERIFY_YES' };
        const newState = intakeReducer(state, action);
        expect(newState).toBe(state); // Should return unchanged state
        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it('handles VERIFY_MODIFY', () => {
        const state = {
          ...createInitialIntakeState(),
          phase: 'verification',
          currentQuestionIndex: 0,
          questions: mockQuestions,
          existingResponses: { q1: 'John Doe' },
        };
        const action: IntakeAction = { type: 'VERIFY_MODIFY' };
        const newState = intakeReducer(state, action);
        expect(newState.phase).toBe('modify');
        expect(newState.mode).toBe('modify');
        expect(newState.currentInput).toBe('John Doe');
        expect(newState.error).toBeNull();
      });

      it('handles VERIFY_MODIFY outside verification phase', () => {
        const state = {
          ...createInitialIntakeState(),
          phase: 'question',
        };
        const action: IntakeAction = { type: 'VERIFY_MODIFY' };
        const newState = intakeReducer(state, action);
        expect(newState).toBe(state); // Should return unchanged state
        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it('handles SKIP_START', () => {
        const state = createInitialIntakeState();
        const action: IntakeAction = { type: 'SKIP_START' };
        const newState = intakeReducer(state, action);
        expect(newState.isSaving).toBe(true);
        expect(newState.error).toBeNull();
      });

      it('handles SKIP_SUCCESS', () => {
        const state = {
          ...createInitialIntakeState(),
          isSaving: true,
        };
        const message: IntakeMessage = {
          id: 'msg-1',
          role: 'user',
          content: '(Skipped)',
        };
        const action: IntakeAction = {
          type: 'SKIP_SUCCESS',
          payload: { message },
        };
        const newState = intakeReducer(state, action);
        expect(newState.isSaving).toBe(false);
        expect(newState.phase).toBe('question');
        expect(newState.error).toBeNull();
      });

      it('handles SKIP_ERROR', () => {
        const state = {
          ...createInitialIntakeState(),
          isSaving: true,
        };
        const action: IntakeAction = {
          type: 'SKIP_ERROR',
          payload: { error: 'Skip failed' },
        };
        const newState = intakeReducer(state, action);
        expect(newState.isSaving).toBe(false);
        expect(newState.error).toBe('Skip failed');
      });
    });

    describe('Message management actions', () => {
      it('handles ADD_MESSAGE', () => {
        const state = createInitialIntakeState();
        const message: IntakeMessage = {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
        };
        const action: IntakeAction = {
          type: 'ADD_MESSAGE',
          payload: { message },
        };
        const newState = intakeReducer(state, action);
        expect(newState.messages).toHaveLength(1);
        expect(newState.messages[0]).toEqual(message);
      });

      it('handles ADD_MESSAGE with duplicate ID', () => {
        const message: IntakeMessage = {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
        };
        const state = {
          ...createInitialIntakeState(),
          messages: [message],
        };
        const action: IntakeAction = {
          type: 'ADD_MESSAGE',
          payload: { message },
        };
        const newState = intakeReducer(state, action);
        expect(newState.messages).toHaveLength(1); // Should not add duplicate
        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it('handles ADD_MESSAGES', () => {
        const state = createInitialIntakeState();
        const messages: IntakeMessage[] = [
          { id: 'msg-1', role: 'user', content: 'Hello' },
          { id: 'msg-2', role: 'assistant', content: 'Hi' },
        ];
        const action: IntakeAction = {
          type: 'ADD_MESSAGES',
          payload: { messages },
        };
        const newState = intakeReducer(state, action);
        expect(newState.messages).toHaveLength(2);
        expect(newState.messages).toEqual(messages);
      });

      it('handles ADD_MESSAGES with duplicates', () => {
        const existingMessage: IntakeMessage = {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
        };
        const state = {
          ...createInitialIntakeState(),
          messages: [existingMessage],
        };
        const newMessages: IntakeMessage[] = [
          existingMessage, // Duplicate
          { id: 'msg-2', role: 'assistant', content: 'Hi' },
        ];
        const action: IntakeAction = {
          type: 'ADD_MESSAGES',
          payload: { messages: newMessages },
        };
        const newState = intakeReducer(state, action);
        expect(newState.messages).toHaveLength(2); // Should only add new message
        expect(newState.messages[0]).toEqual(existingMessage);
        expect(newState.messages[1]).toEqual(newMessages[1]);
      });
    });

    describe('Progression actions', () => {
      it('handles MOVE_TO_NEXT_QUESTION when not at end', () => {
        const state = {
          ...createInitialIntakeState(),
          questions: mockQuestions,
          currentQuestionIndex: 0,
        };
        const action: IntakeAction = { type: 'MOVE_TO_NEXT_QUESTION' };
        const newState = intakeReducer(state, action);
        // Should return state unchanged (handlers will dispatch SHOW_QUESTION/SHOW_VERIFICATION)
        expect(newState).toEqual(state);
      });

      it('handles MOVE_TO_NEXT_QUESTION when at end', () => {
        const state = {
          ...createInitialIntakeState(),
          questions: mockQuestions,
          currentQuestionIndex: mockQuestions.length - 1,
        };
        const action: IntakeAction = { type: 'MOVE_TO_NEXT_QUESTION' };
        const newState = intakeReducer(state, action);
        expect(newState.phase).toBe('final');
        expect(newState.currentQuestionIndex).toBe(-2);
      });

      it('handles COMPLETE_INTAKE', () => {
        const state = createInitialIntakeState();
        const action: IntakeAction = {
          type: 'COMPLETE_INTAKE',
          payload: { pills: mockPills },
        };
        const newState = intakeReducer(state, action);
        expect(newState.phase).toBe('completed');
        expect(newState.suggestionPills).toEqual(mockPills);
        expect(newState.showPills).toBe(true);
      });
    });

    describe('Error handling actions', () => {
      it('handles SET_ERROR', () => {
        const state = createInitialIntakeState();
        const action: IntakeAction = {
          type: 'SET_ERROR',
          payload: { error: 'Test error' },
        };
        const newState = intakeReducer(state, action);
        expect(newState.error).toBe('Test error');
      });

      it('handles SET_ERROR with null', () => {
        const state = {
          ...createInitialIntakeState(),
          error: 'Previous error',
        };
        const action: IntakeAction = {
          type: 'SET_ERROR',
          payload: { error: null },
        };
        const newState = intakeReducer(state, action);
        expect(newState.error).toBeNull();
      });

      it('handles CLEAR_ERROR', () => {
        const state = {
          ...createInitialIntakeState(),
          error: 'Test error',
          errorRetryCount: 5,
        };
        const action: IntakeAction = { type: 'CLEAR_ERROR' };
        const newState = intakeReducer(state, action);
        expect(newState.error).toBeNull();
        expect(newState.errorRetryCount).toBe(0);
      });

      it('handles RETRY_OPERATION', () => {
        const state = {
          ...createInitialIntakeState(),
          error: 'Test error',
          errorRetryCount: 5,
        };
        const action: IntakeAction = { type: 'RETRY_OPERATION' };
        const newState = intakeReducer(state, action);
        expect(newState.error).toBeNull();
        expect(newState.errorRetryCount).toBe(0);
      });
    });

    describe('Loading state actions', () => {
      it('handles SET_SAVING', () => {
        const state = createInitialIntakeState();
        const action: IntakeAction = {
          type: 'SET_SAVING',
          payload: { isSaving: true },
        };
        const newState = intakeReducer(state, action);
        expect(newState.isSaving).toBe(true);
      });

      it('handles SET_LOADING_NEXT', () => {
        const state = createInitialIntakeState();
        const action: IntakeAction = {
          type: 'SET_LOADING_NEXT',
          payload: { isLoading: true },
        };
        const newState = intakeReducer(state, action);
        expect(newState.isLoadingNextQuestion).toBe(true);
      });
    });
  });

  // ============================================================================
  // HOOK INTEGRATION TESTS
  // ============================================================================

  describe('useConversationalIntake hook', () => {
    describe('Initialization', () => {
      it('creates conversation and shows welcome + first question', async () => {
        // Mock conversation creation
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            conversation: { id: mockConversationId },
          }),
        });

        // Mock message creation (welcome + first question)
        (global.fetch as jest.Mock)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              message: {
                id: 'msg-1',
                role: 'assistant',
                content: `Hi, I'm ${mockChatbotName} AI...`,
                createdAt: new Date().toISOString(),
              },
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              message: {
                id: 'msg-2',
                role: 'assistant',
                content: mockQuestions[0].questionText,
                createdAt: new Date().toISOString(),
              },
            }),
          });

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            mockQuestions,
            {},
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.isInitialized).toBe(true);
        });

        expect(result.current.conversationId).toBe(mockConversationId);
        expect(result.current.currentQuestionIndex).toBe(0);
        expect(result.current.mode).toBe('question');
        expect(mockOnMessageAdded).toHaveBeenCalled();
      });

      it('handles no questions case', async () => {
        // Mock conversation creation
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            conversation: { id: mockConversationId },
          }),
        });

        // Mock welcome message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-1',
              role: 'assistant',
              content: 'Welcome',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        // Mock final message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-2',
              role: 'assistant',
              content: 'Final message',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        // Mock pills fetch
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockPills,
        });

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            [],
            {},
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.isInitialized).toBe(true);
        });

        await waitFor(() => {
          expect(result.current.phase).toBe('final');
        }, { timeout: 3000 });

        expect(result.current.currentQuestionIndex).toBe(-2);
      });

      it('handles initialization errors', async () => {
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            mockQuestions,
            {},
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.isInitialized).toBe(true);
        });

        expect(result.current.error).toBeTruthy();
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe('Question Flow', () => {
      it('shows all questions sequentially', async () => {
        // Setup: Initialize
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            conversation: { id: mockConversationId },
          }),
        });

        (global.fetch as jest.Mock)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              message: {
                id: 'msg-1',
                role: 'assistant',
                content: 'Welcome',
                createdAt: new Date().toISOString(),
              },
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              message: {
                id: 'msg-2',
                role: 'assistant',
                content: mockQuestions[0].questionText,
                createdAt: new Date().toISOString(),
              },
            }),
          });

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            mockQuestions,
            {},
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.currentQuestionIndex).toBe(0);
        });

        expect(result.current.currentQuestion?.id).toBe('q1');
      });

      it('handles existing responses correctly and shows verification', async () => {
        const existingResponses = { q1: 'John Doe' };

        // Setup: Initialize
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            conversation: { id: mockConversationId },
          }),
        });

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-1',
              role: 'assistant',
              content: 'Welcome\n\nWhat is your name?\n\nThis is what I have. Is it still correct?\n\n<answer>John Doe</answer>',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            mockQuestions,
            existingResponses,
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.isInitialized).toBe(true);
        });

        await waitFor(() => {
          expect(result.current.mode).toBe('verification');
        });

        expect(result.current.verificationMode).toBe(true);
        expect(result.current.currentQuestionIndex).toBe(0);
      });
    });

    describe('Verification Flow', () => {
      beforeEach(async () => {
        const existingResponses = { q1: 'John Doe' };

        // Setup: Initialize to verification state
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            conversation: { id: mockConversationId },
          }),
        });

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-1',
              role: 'assistant',
              content: 'Welcome\n\nWhat is your name?\n\nThis is what I have. Is it still correct?\n\n<answer>John Doe</answer>',
              createdAt: new Date().toISOString(),
            },
          }),
        });
      });

      it('shows Yes/Modify buttons in verification mode', async () => {
        const existingResponses = { q1: 'John Doe' };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            conversation: { id: mockConversationId },
          }),
        });

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-1',
              role: 'assistant',
              content: 'Welcome\n\nWhat is your name?\n\nThis is what I have. Is it still correct?\n\n<answer>John Doe</answer>',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            mockQuestions,
            existingResponses,
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.verificationMode).toBe(true);
        });

        expect(result.current.mode).toBe('verification');
      });

      it('Yes button moves to next question', async () => {
        const existingResponses = { q1: 'John Doe' };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            conversation: { id: mockConversationId },
          }),
        });

        (global.fetch as jest.Mock)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              message: {
                id: 'msg-1',
                role: 'assistant',
                content: 'Welcome\n\nWhat is your name?\n\nThis is what I have. Is it still correct?\n\n<answer>John Doe</answer>',
                createdAt: new Date().toISOString(),
              },
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              message: {
                id: 'msg-2',
                role: 'assistant',
                content: mockQuestions[1].questionText,
                createdAt: new Date().toISOString(),
              },
            }),
          });

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            mockQuestions,
            existingResponses,
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.verificationMode).toBe(true);
        });

        await act(async () => {
          result.current.handleVerifyYes();
        });

        await waitFor(() => {
          expect(result.current.currentQuestionIndex).toBe(1);
        });
      });

      it('Modify button switches to modify mode', async () => {
        const existingResponses = { q1: 'John Doe' };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            conversation: { id: mockConversationId },
          }),
        });

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-1',
              role: 'assistant',
              content: 'Welcome\n\nWhat is your name?\n\nThis is what I have. Is it still correct?\n\n<answer>John Doe</answer>',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            mockQuestions,
            existingResponses,
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.verificationMode).toBe(true);
        });

        await act(async () => {
          result.current.handleVerifyModify();
        });

        expect(result.current.modifyMode).toBe(true);
        expect(result.current.currentInput).toBe('John Doe');
      });
    });

    describe('Modify Flow', () => {
      it('pre-fills existing value and allows editing', async () => {
        const existingResponses = { q1: 'John Doe' };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            conversation: { id: mockConversationId },
          }),
        });

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-1',
              role: 'assistant',
              content: 'Welcome\n\nWhat is your name?\n\nThis is what I have. Is it still correct?\n\n<answer>John Doe</answer>',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            mockQuestions,
            existingResponses,
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.verificationMode).toBe(true);
        });

        await act(async () => {
          result.current.handleVerifyModify();
        });

        expect(result.current.modifyMode).toBe(true);
        expect(result.current.currentInput).toBe('John Doe');

        // Edit the value
        await act(async () => {
          result.current.setCurrentInput('Jane Doe');
        });

        expect(result.current.currentInput).toBe('Jane Doe');
      });

      it('saves modified value and shows verification again', async () => {
        const existingResponses = { q1: 'John Doe' };

        // Mock user API call
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ userId: 'db-user-123' }),
        });

        // Mock conversation creation
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            conversation: { id: mockConversationId },
          }),
        });

        // Mock welcome message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-1',
              role: 'assistant',
              content: 'Welcome\n\nWhat is your name?\n\nThis is what I have. Is it still correct?\n\n<answer>John Doe</answer>',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        // Mock save response
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

        // Mock user message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-2',
              role: 'user',
              content: 'Jane Doe',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        // Mock thank you message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-3',
              role: 'assistant',
              content: 'Thank you.',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        // Mock next question
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-4',
              role: 'assistant',
              content: mockQuestions[1].questionText,
              createdAt: new Date().toISOString(),
            },
          }),
        });

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            mockQuestions,
            existingResponses,
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.verificationMode).toBe(true);
        });

        await act(async () => {
          result.current.handleVerifyModify();
        });

        await act(async () => {
          result.current.setCurrentInput('Jane Doe');
        });

        await act(async () => {
          await result.current.handleAnswer('Jane Doe');
        });

        await waitFor(() => {
          expect(result.current.isSaving).toBe(false);
        });

        expect(result.current.currentQuestionIndex).toBe(1);
      });
    });

    describe('Answer Submission', () => {
      beforeEach(async () => {
        // Mock user API call
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ userId: 'db-user-123' }),
        });

        // Mock conversation creation
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            conversation: { id: mockConversationId },
          }),
        });

        // Mock welcome + first question
        (global.fetch as jest.Mock)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              message: {
                id: 'msg-1',
                role: 'assistant',
                content: 'Welcome',
                createdAt: new Date().toISOString(),
              },
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              message: {
                id: 'msg-2',
                role: 'assistant',
                content: mockQuestions[0].questionText,
                createdAt: new Date().toISOString(),
              },
            }),
          });
      });

      it('saves answer to API', async () => {
        // Mock save response
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

        // Mock user message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-3',
              role: 'user',
              content: 'John Doe',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        // Mock thank you message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-4',
              role: 'assistant',
              content: 'Thank you.',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        // Mock next question
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-5',
              role: 'assistant',
              content: mockQuestions[1].questionText,
              createdAt: new Date().toISOString(),
            },
          }),
        });

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            mockQuestions,
            {},
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.currentQuestionIndex).toBe(0);
        });

        await act(async () => {
          await result.current.handleAnswer('John Doe');
        });

        await waitFor(() => {
          expect(result.current.isSaving).toBe(false);
        });

        // Verify save was called
        const saveCalls = (global.fetch as jest.Mock).mock.calls.filter(
          (call) => call[0] === '/api/intake/responses'
        );
        expect(saveCalls.length).toBeGreaterThan(0);
      });

      it('shows user message and thank you message', async () => {
        // Mock save response
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

        // Mock user message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-3',
              role: 'user',
              content: 'John Doe',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        // Mock thank you message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-4',
              role: 'assistant',
              content: 'Thank you.',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        // Mock next question
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-5',
              role: 'assistant',
              content: mockQuestions[1].questionText,
              createdAt: new Date().toISOString(),
            },
          }),
        });

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            mockQuestions,
            {},
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.currentQuestionIndex).toBe(0);
        });

        await act(async () => {
          await result.current.handleAnswer('John Doe');
        });

        await waitFor(() => {
          expect(result.current.messages.length).toBeGreaterThan(2);
        });

        const userMessages = result.current.messages.filter((m) => m.role === 'user');
        const thankYouMessages = result.current.messages.filter(
          (m) => m.role === 'assistant' && m.content === 'Thank you.'
        );

        expect(userMessages.length).toBeGreaterThan(0);
        expect(thankYouMessages.length).toBeGreaterThan(0);
      });

      it('moves to next question after submission', async () => {
        // Mock save response
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

        // Mock user message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-3',
              role: 'user',
              content: 'John Doe',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        // Mock thank you message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-4',
              role: 'assistant',
              content: 'Thank you.',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        // Mock next question
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-5',
              role: 'assistant',
              content: mockQuestions[1].questionText,
              createdAt: new Date().toISOString(),
            },
          }),
        });

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            mockQuestions,
            {},
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.currentQuestionIndex).toBe(0);
        });

        await act(async () => {
          await result.current.handleAnswer('John Doe');
        });

        await waitFor(() => {
          expect(result.current.currentQuestionIndex).toBe(1);
        });

        expect(result.current.currentQuestion?.id).toBe('q2');
      });

      it('handles errors correctly', async () => {
        // Mock save response error
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Save failed' }),
        });

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            mockQuestions,
            {},
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.currentQuestionIndex).toBe(0);
        });

        await act(async () => {
          await result.current.handleAnswer('John Doe');
        });

        await waitFor(() => {
          expect(result.current.error).toBeTruthy();
        });

        expect(result.current.isSaving).toBe(false);
      });
    });

    describe('Skip Flow', () => {
      beforeEach(async () => {
        // Mock conversation creation
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            conversation: { id: mockConversationId },
          }),
        });

        // Mock welcome + first question
        (global.fetch as jest.Mock)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              message: {
                id: 'msg-1',
                role: 'assistant',
                content: 'Welcome',
                createdAt: new Date().toISOString(),
              },
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              message: {
                id: 'msg-2',
                role: 'assistant',
                content: mockQuestions[0].questionText,
                createdAt: new Date().toISOString(),
              },
            }),
          });
      });

      it('skips optional questions', async () => {
        // Move to optional question (q2)
        // Mock next question
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-3',
              role: 'assistant',
              content: mockQuestions[1].questionText,
              createdAt: new Date().toISOString(),
            },
          }),
        });

        // Mock skip message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-4',
              role: 'user',
              content: '(Skipped)',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        // Mock thank you message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-5',
              role: 'assistant',
              content: 'Thank you.',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        // Mock next question
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-6',
              role: 'assistant',
              content: mockQuestions[2].questionText,
              createdAt: new Date().toISOString(),
            },
          }),
        });

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            mockQuestions,
            {},
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.currentQuestionIndex).toBe(0);
        });

        // Answer first question to move to optional one
        // Mock user API call
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ userId: 'db-user-123' }),
        });

        // Mock save response
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

        // Mock user message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-user',
              role: 'user',
              content: 'John Doe',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        // Mock thank you message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-thanks',
              role: 'assistant',
              content: 'Thank you.',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        await act(async () => {
          await result.current.handleAnswer('John Doe');
        });

        await waitFor(() => {
          expect(result.current.currentQuestionIndex).toBe(1);
        });

        // Now skip the optional question
        await act(async () => {
          await result.current.handleSkip();
        });

        await waitFor(() => {
          expect(result.current.isSaving).toBe(false);
        });

        const skipMessages = result.current.messages.filter(
          (m) => m.content === '(Skipped)'
        );
        expect(skipMessages.length).toBeGreaterThan(0);
      });

      it('prevents skipping required questions', async () => {
        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            mockQuestions,
            {},
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.currentQuestionIndex).toBe(0);
        });

        // Try to skip required question (q1)
        await act(async () => {
          await result.current.handleSkip();
        });

        expect(result.current.error).toBeTruthy();
        expect(result.current.error).toContain('required');
      });
    });

    describe('Final Message', () => {
      it('shows final message and loads suggestion pills', async () => {
        // Mock conversation creation
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            conversation: { id: mockConversationId },
          }),
        });

        // Mock welcome message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-1',
              role: 'assistant',
              content: 'Welcome',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        // Mock final message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-2',
              role: 'assistant',
              content: 'Final message',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        // Mock pills fetch
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockPills,
        });

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            [],
            {},
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.isInitialized).toBe(true);
        });

        await waitFor(() => {
          expect(result.current.showPills).toBe(true);
        }, { timeout: 3000 });

        expect(result.current.suggestionPills).toEqual(mockPills);
      });

      it('calls onComplete callback', async () => {
        // Mock conversation creation
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            conversation: { id: mockConversationId },
          }),
        });

        // Mock welcome message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-1',
              role: 'assistant',
              content: 'Welcome',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        // Mock final message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-2',
              role: 'assistant',
              content: 'Final message',
              createdAt: new Date().toISOString(),
            },
          }),
        });

        // Mock pills fetch
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockPills,
        });

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            [],
            {},
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.isInitialized).toBe(true);
        });

        await waitFor(() => {
          expect(mockOnComplete).toHaveBeenCalledWith(mockConversationId);
        }, { timeout: 3000 });
      });
    });

    describe('Edge Cases', () => {
      it('handles network failures', async () => {
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            mockQuestions,
            {},
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.isInitialized).toBe(true);
        });

        expect(result.current.error).toBeTruthy();
      });

      it('handles message deduplication', async () => {
        const message: IntakeMessage = {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
        };

        const state = {
          ...createInitialIntakeState(),
          messages: [message],
        };

        const action: IntakeAction = {
          type: 'ADD_MESSAGE',
          payload: { message },
        };
        const newState = intakeReducer(state, action);

        expect(newState.messages).toHaveLength(1);
        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it('handles concurrent actions by preventing double submission', async () => {
        // Mock user API call
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({ userId: 'db-user-123' }),
        });

        // Mock conversation creation
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            conversation: { id: mockConversationId },
          }),
        });

        // Mock welcome + first question
        (global.fetch as jest.Mock)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              message: {
                id: 'msg-1',
                role: 'assistant',
                content: 'Welcome',
                createdAt: new Date().toISOString(),
              },
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              message: {
                id: 'msg-2',
                role: 'assistant',
                content: mockQuestions[0].questionText,
                createdAt: new Date().toISOString(),
              },
            }),
          });

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            mockQuestions,
            {},
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.currentQuestionIndex).toBe(0);
        });

        // Try to submit twice concurrently
        const promise1 = result.current.handleAnswer('John Doe');
        const promise2 = result.current.handleAnswer('John Doe');

        await Promise.all([promise1, promise2]);

        // Should only have one save call
        const saveCalls = (global.fetch as jest.Mock).mock.calls.filter(
          (call) => call[0] === '/api/intake/responses'
        );
        expect(saveCalls.length).toBeLessThanOrEqual(1);
      });

      it('handles missing data gracefully', async () => {
        const state = {
          ...createInitialIntakeState(),
          questions: mockQuestions,
        };

        const action: IntakeAction = {
          type: 'SHOW_QUESTION',
          payload: { index: 999, hasExisting: false },
        };
        const newState = intakeReducer(state, action);

        expect(newState).toBe(state); // Should return unchanged state
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe('UI Features', () => {
      it('shows typing indicator during question loading', async () => {
        // Mock conversation creation
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            conversation: { id: mockConversationId },
          }),
        });

        // Mock welcome + first question (with delay)
        (global.fetch as jest.Mock)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              message: {
                id: 'msg-1',
                role: 'assistant',
                content: 'Welcome',
                createdAt: new Date().toISOString(),
              },
            }),
          })
          .mockImplementationOnce(
            () =>
              new Promise((resolve) =>
                setTimeout(
                  () =>
                    resolve({
                      ok: true,
                      json: async () => ({
                        message: {
                          id: 'msg-2',
                          role: 'assistant',
                          content: mockQuestions[0].questionText,
                          createdAt: new Date().toISOString(),
                        },
                      }),
                    }),
                  100
                )
              )
          );

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            mockQuestions,
            {},
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.isLoadingNextQuestion).toBe(true);
        });

        await waitFor(() => {
          expect(result.current.isLoadingNextQuestion).toBe(false);
        });
      });
    });
  });
});

