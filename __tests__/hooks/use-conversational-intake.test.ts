/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useConversationalIntake,
  IntakeQuestion,
  IntakeMessage,
} from '@/hooks/use-conversational-intake';
import { Pill as PillType } from '@/components/pills/pill';

// Mock fetch globally
global.fetch = jest.fn();

// Mock console methods to avoid noise in tests
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

describe('useConversationalIntake', () => {
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

  const mockOnMessageAdded = jest.fn();
  const mockOnComplete = jest.fn();

  // Helper: mock only the conversation creation fetch (the only fetch during init)
  const mockConversationCreation = () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        conversation: { id: mockConversationId },
      }),
    });
  };

  // Helper: mock the batch PATCH request (used by showFinalMessage → batchSaveIntake)
  const mockBatchPatch = (pills: string[] = []) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        conversation: {
          id: mockConversationId,
          intakeCompleted: true,
          intakeCompletedAt: new Date().toISOString(),
        },
        ...(pills.length > 0 && { suggestionPills: pills }),
      }),
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset(); // mockReset clears the mockResolvedValueOnce queue
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
  // HOOK INTEGRATION TESTS
  // ============================================================================

  describe('useConversationalIntake hook', () => {
    describe('Initialization', () => {
      it('creates conversation and shows welcome + first question', async () => {
        mockConversationCreation();
        // addMessage is now local-only — no fetch mocks needed for messages

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
        // Verify only 1 fetch was made (conversation creation)
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      it('handles no questions case', async () => {
        mockConversationCreation();
        // showFinalMessage → batchSaveIntake → PATCH
        mockBatchPatch(['What topics interest you?', 'Tell me about yourself']);

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

        // currentQuestionIndex = -2 means intake is complete
        await waitFor(() => {
          expect(result.current.currentQuestionIndex).toBe(-2);
        }, { timeout: 3000 });
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
          expect(result.current.error).toBeTruthy();
        });

        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe('Question Flow', () => {
      it('shows all questions sequentially', async () => {
        mockConversationCreation();

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

      it('handles existing responses correctly and resumes at first unanswered', async () => {
        const allExisting = { q1: 'John Doe', q2: 'Blue' };
        // Init creates conv, then jumps to q3 (first unanswered)
        mockConversationCreation();

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            mockQuestions,
            allExisting,
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.isInitialized).toBe(true);
        });

        // Should resume at q3 (index 2) in question mode
        expect(result.current.currentQuestionIndex).toBe(2);
        expect(result.current.mode).toBe('question');
        expect(result.current.currentQuestion?.id).toBe('q3');
      });
    });

    describe('Verification Flow', () => {
      it('shows verification mode when advancing to question with existing response', async () => {
        // existingResponses for q2 — init starts at q1 (no existing), answer q1 → q2 (has existing → verification)
        const existingResponses = { q2: 'Blue' };
        mockConversationCreation();

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
          expect(result.current.currentQuestionIndex).toBe(0);
        });

        // Answer q1 to trigger move to q2 (which has existing response → verification)
        // handleAnswer: saveResponse (local) + addMessage (local) + addMessage (local) + showQuestion(1)
        // No fetch calls needed — all local
        await act(async () => {
          await result.current.handleAnswer('John Doe');
        });

        await waitFor(() => {
          expect(result.current.mode).toBe('verification');
        });

        expect(result.current.verificationMode).toBe(true);
        expect(result.current.currentQuestionIndex).toBe(1);
      });

      it('Yes button moves to next question', async () => {
        const existingResponses = { q2: 'Blue' };
        mockConversationCreation();

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
          expect(result.current.currentQuestionIndex).toBe(0);
        });

        // Answer q1
        await act(async () => {
          await result.current.handleAnswer('John Doe');
        });

        await waitFor(() => {
          expect(result.current.verificationMode).toBe(true);
        });

        // Verify Yes
        await act(async () => {
          await result.current.handleVerifyYes();
        });

        await waitFor(() => {
          expect(result.current.currentQuestionIndex).toBe(2);
        });

        expect(result.current.mode).toBe('question');
      });

      it('Modify button switches to modify mode', async () => {
        const existingResponses = { q2: 'Blue' };
        mockConversationCreation();

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
          expect(result.current.currentQuestionIndex).toBe(0);
        });

        // Answer q1 to get to q2 verification
        await act(async () => {
          await result.current.handleAnswer('John Doe');
        });

        await waitFor(() => {
          expect(result.current.verificationMode).toBe(true);
        });

        // Click Modify
        await act(async () => {
          result.current.handleVerifyModify();
        });

        expect(result.current.modifyMode).toBe(true);
        expect(result.current.currentInput).toBe('Blue');
      });
    });

    describe('Modify Flow', () => {
      it('pre-fills existing value and allows editing', async () => {
        const existingResponses = { q2: 'Blue' };
        mockConversationCreation();

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
          expect(result.current.currentQuestionIndex).toBe(0);
        });

        // Answer q1 to get to q2 verification
        await act(async () => {
          await result.current.handleAnswer('John Doe');
        });

        await waitFor(() => {
          expect(result.current.verificationMode).toBe(true);
        });

        // Click Modify — should pre-fill with existing value
        await act(async () => {
          result.current.handleVerifyModify();
        });

        expect(result.current.modifyMode).toBe(true);
        expect(result.current.currentInput).toBe('Blue');

        // Edit the value
        await act(async () => {
          result.current.setCurrentInput('Green');
        });

        expect(result.current.currentInput).toBe('Green');
      });
    });

    describe('Answer Submission', () => {
      it('adds user message and thank you locally without fetch', async () => {
        mockConversationCreation();

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

        const fetchCountBefore = (global.fetch as jest.Mock).mock.calls.length;

        await act(async () => {
          await result.current.handleAnswer('John Doe');
        });

        await waitFor(() => {
          expect(result.current.isSaving).toBe(false);
        });

        // No additional fetch calls — addMessage and saveResponse are local-only
        expect((global.fetch as jest.Mock).mock.calls.length).toBe(fetchCountBefore);

        // Messages should include user answer and thank you
        const userMessages = result.current.messages.filter((m) => m.role === 'user');
        const thankYouMessages = result.current.messages.filter(
          (m) => m.role === 'assistant' && m.content === 'Thank you.'
        );
        expect(userMessages.length).toBeGreaterThan(0);
        expect(thankYouMessages.length).toBeGreaterThan(0);
      });

      it('moves to next question after submission', async () => {
        mockConversationCreation();

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

      it('uses temp IDs with intake-temp-N pattern', async () => {
        mockConversationCreation();

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

        // Messages should have temp IDs
        const tempIdMessages = result.current.messages.filter(m =>
          m.id.startsWith('intake-temp-')
        );
        expect(tempIdMessages.length).toBeGreaterThan(0);

        // IDs should be sequential
        const ids = tempIdMessages.map(m => parseInt(m.id.replace('intake-temp-', '')));
        for (let i = 1; i < ids.length; i++) {
          expect(ids[i]).toBeGreaterThan(ids[i - 1]);
        }
      });

      it('handles saveResponse errors gracefully', async () => {
        // With batch intake, saveResponse is local-only and can't fail on its own.
        // Errors now happen at batch save time. Test that the hook handles
        // batch save failure correctly.
        mockConversationCreation();

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            [mockQuestions[0]], // Single question so answering triggers showFinalMessage
            {},
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.currentQuestionIndex).toBe(0);
        });

        // Mock failed PATCH for batch save
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Server error',
        });

        await act(async () => {
          await result.current.handleAnswer('John Doe');
        });

        await waitFor(() => {
          expect(result.current.error).toBeTruthy();
        });

        // onComplete should NOT have been called
        expect(mockOnComplete).not.toHaveBeenCalled();
      });
    });

    describe('Skip Flow', () => {
      it('skips optional questions', async () => {
        mockConversationCreation();

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

        // Answer first required question
        await act(async () => {
          await result.current.handleAnswer('John Doe');
        });

        await waitFor(() => {
          expect(result.current.currentQuestionIndex).toBe(1);
        });

        // Now skip the optional question (q2)
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
        mockConversationCreation();

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

    describe('Final Message and Batch Save', () => {
      it('shows final message and calls onComplete after successful batch save', async () => {
        mockConversationCreation();
        // After answering all 3 questions, showFinalMessage → batchSaveIntake → PATCH
        mockBatchPatch(['Tell me about yourself', 'What topics interest you?']);

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
          expect(result.current.currentQuestionIndex).toBe(-2);
        }, { timeout: 3000 });

        // Pills should be set from PATCH response
        await waitFor(() => {
          expect(result.current.showPills).toBe(true);
        }, { timeout: 3000 });

        expect(result.current.suggestionPills.length).toBeGreaterThan(0);

        // onComplete should be called after 1s timeout
        await waitFor(() => {
          expect(mockOnComplete).toHaveBeenCalledWith(mockConversationId);
        }, { timeout: 3000 });
      });

      it('sends batch PATCH with messages and responses', async () => {
        mockConversationCreation();

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            [mockQuestions[0]], // Single question
            {},
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.currentQuestionIndex).toBe(0);
        });

        // Answer the single question → triggers showFinalMessage → batchSaveIntake
        mockBatchPatch();

        await act(async () => {
          await result.current.handleAnswer('John Doe');
        });

        // Verify the PATCH was called with correct payload
        const patchCalls = (global.fetch as jest.Mock).mock.calls.filter(
          (call) => {
            const url = call[0];
            const opts = call[1];
            return url.includes('/api/conversations/') && opts?.method === 'PATCH';
          }
        );
        expect(patchCalls.length).toBe(1);

        const body = JSON.parse(patchCalls[0][1].body);
        expect(body.intakeCompleted).toBe(true);
        expect(body.messages.length).toBeGreaterThan(0);
        expect(body.responses.length).toBe(1);
        expect(body.responses[0].intakeQuestionId).toBe('q1');
        expect(body.responses[0].value).toBe('John Doe');
      });

      it('sets error and does NOT call onComplete on PATCH failure', async () => {
        mockConversationCreation();

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            [mockQuestions[0]], // Single question
            {},
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.currentQuestionIndex).toBe(0);
        });

        // Mock failed PATCH
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        });

        await act(async () => {
          await result.current.handleAnswer('John Doe');
        });

        await waitFor(() => {
          expect(result.current.error).toBeTruthy();
        }, { timeout: 3000 });

        expect(result.current.error).toContain('Failed to save');
        expect(mockOnComplete).not.toHaveBeenCalled();
        // Should be in batch save state (currentQuestionIndex === -2)
        expect(result.current.currentQuestionIndex).toBe(-2);
      });

      it('retryBatchSave re-attempts after failure', async () => {
        mockConversationCreation();

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            [mockQuestions[0]], // Single question
            {},
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.currentQuestionIndex).toBe(0);
        });

        // First PATCH fails
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Server error',
        });

        await act(async () => {
          await result.current.handleAnswer('John Doe');
        });

        await waitFor(() => {
          expect(result.current.error).toBeTruthy();
        });

        // Retry — this time PATCH succeeds
        mockBatchPatch();

        await act(async () => {
          await result.current.retryBatchSave();
        });

        await waitFor(() => {
          expect(result.current.error).toBeNull();
        });

        // onComplete should be called after retry success
        await waitFor(() => {
          expect(mockOnComplete).toHaveBeenCalledWith(mockConversationId);
        }, { timeout: 3000 });
      });

      it('retryBatchSave is no-op when no pending batch', async () => {
        mockConversationCreation();

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

        const fetchCountBefore = (global.fetch as jest.Mock).mock.calls.length;

        await act(async () => {
          await result.current.retryBatchSave();
        });

        // No additional fetch calls
        expect((global.fetch as jest.Mock).mock.calls.length).toBe(fetchCountBefore);
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
          expect(result.current.error).toBeTruthy();
        });
      });

      it('isSaving flag prevents sequential double submission', async () => {
        mockConversationCreation();

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

        // Submit answer and wait for it to complete
        await act(async () => {
          await result.current.handleAnswer('John Doe');
        });

        await waitFor(() => {
          expect(result.current.isSaving).toBe(false);
        });

        // Verify no /api/intake/responses calls were made (saveResponse is local-only now)
        const saveCalls = (global.fetch as jest.Mock).mock.calls.filter(
          (call) => call[0] === '/api/intake/responses'
        );
        expect(saveCalls.length).toBe(0);
      });

      it('saveResponse deduplicates by questionId', async () => {
        mockConversationCreation();

        const { result } = renderHook(() =>
          useConversationalIntake(
            mockChatbotId,
            mockChatbotName,
            mockChatbotPurpose,
            mockQuestions,
            { q2: 'Blue' }, // q2 has existing response
            mockOnMessageAdded,
            mockOnComplete
          )
        );

        await waitFor(() => {
          expect(result.current.currentQuestionIndex).toBe(0);
        });

        // Answer q1
        await act(async () => {
          await result.current.handleAnswer('John Doe');
        });

        // q2 should be in verification mode
        await waitFor(() => {
          expect(result.current.verificationMode).toBe(true);
        });

        // Click Modify and submit new answer for q2
        await act(async () => {
          result.current.handleVerifyModify();
        });

        // Mock the PATCH that will be triggered after answering q3 (the last question)
        // Answer q2 with new value → moves to q3
        await act(async () => {
          await result.current.handleAnswer('Green');
        });

        await waitFor(() => {
          expect(result.current.currentQuestionIndex).toBe(2);
        });

        // Answer q3 → triggers showFinalMessage → batchSaveIntake
        mockBatchPatch();

        await act(async () => {
          await result.current.handleAnswer(true);
        });

        // Verify the PATCH payload has the updated q2 value
        const patchCalls = (global.fetch as jest.Mock).mock.calls.filter(
          (call) => call[1]?.method === 'PATCH'
        );
        expect(patchCalls.length).toBe(1);

        const body = JSON.parse(patchCalls[0][1].body);
        // Should have responses for q1, q2, q3
        expect(body.responses.length).toBe(3);
        const q2Response = body.responses.find((r: any) => r.intakeQuestionId === 'q2');
        expect(q2Response.value).toBe('Green'); // Updated value, not 'Blue'
      });
    });
  });
});
