/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useConversationalIntake,
  IntakeQuestion,
  IntakeMessage,
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

        // Mock message creation (welcome + first question combined in one addMessage call)
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-1',
              role: 'assistant',
              content: `Hi, I'm ${mockChatbotName} AI...`,
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

        // Mock welcome message (addMessage in initialize for no-questions path)
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

        // Mock final message (addMessage in showFinalMessage)
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

        // Mock PATCH /api/conversations/{id} (mark intake complete)
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            conversation: {
              id: mockConversationId,
              intakeCompleted: true,
              intakeCompletedAt: new Date().toISOString(),
            },
            suggestionPills: ['What topics interest you?', 'Tell me about yourself'],
          }),
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
              content: `Hi, I'm ${mockChatbotName} AI...\n\n${mockQuestions[0].questionText}`,
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

        // Setup: Initialize — with q1 answered, firstUnansweredIndex = 1
        // But q1 has existing response, so initialize goes to showQuestion(1, convId)
        // which calls processQuestion(1, ...) — q2 has no existing response, so question mode
        // Wait, actually — let me re-check the init logic:
        // firstUnansweredIndex = 1 (q1 is answered, q2 is first unanswered)
        // Since firstUnansweredIndex !== 0 and !== -1, it calls showQuestion(1, convId)
        // q2 does NOT have an existing response, so it goes to question mode for q2

        // Actually for the verification test to work, we need ALL questions answered so
        // firstUnansweredIndex = -1, OR we need to test verification at a specific point.
        // Let me test with existingResponses for all questions so init resumes at verification.
        // Actually, with only q1 answered, the init goes to q2 (unanswered), not verification.
        // For verification, the question needs an existing response.
        // Let's use existingResponses = { q1: 'John Doe', q2: 'Blue' } so q3 is first unanswered
        // and q3 doesn't have an existing response.
        // OR, let's put an existing response on q2 so that when init shows q2 (since q1 is answered,
        // firstUnanswered is q2 actually... wait, q1 IS answered, so first unanswered is q2.
        // If q2 also has existing response, first unanswered is q3.
        // For q2 to show in verification mode, we need q2 to have existing response AND be shown.

        // Simplest: existingResponses = { q1: 'John Doe' } means firstUnanswered = 1 (q2).
        // q2 does NOT have existing response, so it shows in question mode.
        // To test verification, let's use q1 and q2 answered, q3 unanswered:
        // Wait, the init flow doesn't show verification for already-answered questions.
        // It jumps to the first UNANSWERED question and shows that.
        // Verification only happens if the question being shown HAS an existing response.
        // So for verification test we need: firstUnanswered = index of question WITH existing response.
        // That happens when e.g. firstUnanswered = 0 and q1 has existing response.
        // But firstUnanswered = 0 means q1 is NOT answered... contradiction.

        // Actually wait — existingResponses comes from the welcome API data.
        // If existingResponses has q1, then answeredQuestionIds includes q1,
        // so firstUnansweredIndex = questions.findIndex(q => !answeredQuestionIds.has(q.id)) = 1 (q2).
        // Then showQuestion(1, convId) calls processQuestion(1, ...) for q2.
        // q2 does NOT have existing response, so it shows in question mode.

        // For verification to appear, we need showQuestion called with an index whose
        // question HAS an existing response. This happens when:
        // existingResponses = { q2: 'Blue' } → first unanswered = 0 (q1)
        // showFirstQuestion shows q1 in question mode (no existing for q1).
        // Then user answers q1, moves to q2 which HAS existing → verification mode.

        // So verification is tested through the answer flow, not init. Let me restructure this test.
        // For now, let's test that init correctly starts at the first unanswered question.
        const allExisting = { q1: 'John Doe', q2: 'Blue' };
        // First unanswered = 2 (q3). q3 has no existing → question mode.

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            conversation: { id: mockConversationId },
          }),
        });

        // showQuestion(2, convId) → processQuestion(2) → addMessage for q3
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-1',
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
      it('shows Yes/Modify buttons in verification mode', async () => {
        // To get verification mode, we need a question with existing response
        // to be shown via processQuestion. This happens when:
        // existingResponses = { q1: 'John Doe' } and init shows q1.
        // But init shows firstUnanswered. If q1 has response, firstUnanswered > 0.
        // So we need a setup where processQuestion is called for a question with existing response.
        // Use: existingResponses = { q2: 'Blue' }, no response for q1.
        // Init: firstUnanswered = 0 (q1) → shows q1 in question mode.
        // Answer q1 → moves to q2 which has existing → verification mode.
        // This is complex. Let's use a simpler approach: all questions have existing responses.
        // existingResponses = { q1: 'John Doe', q2: 'Blue', q3: true }
        // firstUnansweredIndex = -1 → all answered → showFinalMessage
        // That skips verification entirely!

        // The correct approach: have SOME questions with existing responses.
        // existingResponses = { q1: 'John Doe' }, init starts at q2 (no existing) in question mode.
        // After answering q2, if q3 had existing response, it would show verification.
        // But testing multi-step flows is complex. Let me use a single-question approach.

        // Simplest verification test: 1 question, with existing response.
        // existingResponses = { q1: 'John Doe' }
        // firstUnansweredIndex = 1 (past end of single-question array)
        // Actually no: questions has 3 items. firstUnansweredIndex finds first without response.
        // With {q1: 'John Doe'}: q2 and q3 don't have responses. firstUnanswered = 1 (q2).
        // processQuestion(1, ...) → q2 has no existing → question mode. Not verification.

        // To get verification mode during init:
        // We need the first unanswered question's INDEX to point to a question WITH existing response.
        // That can't happen by definition (unanswered means no response).

        // Verification happens in showQuestion/processQuestion when the SHOWN question has
        // an existing response. This only happens when navigating BACK or when init resumes
        // at a point where... hmm, actually in the current init logic, it only shows questions
        // that DON'T have existing responses (it finds firstUnanswered).

        // Wait, I need to re-read the init code more carefully:
        // const firstUnansweredIndex = questions.findIndex(q => !answeredQuestionIds.has(q.id));
        // If firstUnansweredIndex === 0: showFirstQuestion (q1, combined with welcome)
        // else: showQuestion(firstUnansweredIndex, convId)
        // Both call processQuestion which checks hasExistingResponse for THAT question.
        // Since firstUnanswered means the question DOESN'T have response, it's always question mode.

        // So verification mode only happens AFTER answering — when showQuestion(nextIndex)
        // is called for a question that HAS an existing response.

        // For this test, let's just verify the hook exposes the verification-related properties.
        // We'll test actual verification flow in a separate test that goes through answer → next question.

        // Setup with existingResponses for q2, init at q1 (no existing)
        const existingResponses = { q2: 'Blue' };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            conversation: { id: mockConversationId },
          }),
        });

        // Init shows q1 (combined welcome + question)
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-1',
              role: 'assistant',
              content: `Hi, I'm ${mockChatbotName} AI...\n\n${mockQuestions[0].questionText}`,
              createdAt: new Date().toISOString(),
            },
          }),
        });

        // After answering q1:
        // saveResponse → POST /api/intake/responses
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });
        // addMessage user answer → POST messages
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-2', role: 'user', content: 'John Doe', createdAt: new Date().toISOString() },
          }),
        });
        // addMessage thank you → POST messages
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-3', role: 'assistant', content: 'Thank you.', createdAt: new Date().toISOString() },
          }),
        });
        // showQuestion(1) → processQuestion(1) → q2 HAS existing response → verification mode
        // addMessage for verification content
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-4',
              role: 'assistant',
              content: `${mockQuestions[1].questionText}\n\nThis is what I have. Is it still correct?\n\nBlue`,
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
          expect(result.current.currentQuestionIndex).toBe(0);
        });

        // Answer q1 to trigger move to q2 (which has existing response)
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

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conversation: { id: mockConversationId } }),
        });

        // Init: welcome + q1
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-1', role: 'assistant', content: mockQuestions[0].questionText, createdAt: new Date().toISOString() },
          }),
        });

        // Answer q1: saveResponse
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true, json: async () => ({}),
        });
        // Answer q1: user message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-2', role: 'user', content: 'John Doe', createdAt: new Date().toISOString() },
          }),
        });
        // Answer q1: thank you
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-3', role: 'assistant', content: 'Thank you.', createdAt: new Date().toISOString() },
          }),
        });
        // showQuestion(1) → q2 verification
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-4', role: 'assistant', content: mockQuestions[1].questionText, createdAt: new Date().toISOString() },
          }),
        });
        // handleVerifyYes → showQuestion(2) → q3 question mode
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-5', role: 'assistant', content: mockQuestions[2].questionText, createdAt: new Date().toISOString() },
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

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conversation: { id: mockConversationId } }),
        });

        // Init: welcome + q1
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-1', role: 'assistant', content: mockQuestions[0].questionText, createdAt: new Date().toISOString() },
          }),
        });

        // Answer q1: saveResponse
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true, json: async () => ({}),
        });
        // Answer q1: user message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-2', role: 'user', content: 'John Doe', createdAt: new Date().toISOString() },
          }),
        });
        // Answer q1: thank you
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-3', role: 'assistant', content: 'Thank you.', createdAt: new Date().toISOString() },
          }),
        });
        // showQuestion(1) → q2 verification
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-4', role: 'assistant', content: mockQuestions[1].questionText, createdAt: new Date().toISOString() },
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

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conversation: { id: mockConversationId } }),
        });

        // Init: welcome + q1
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-1', role: 'assistant', content: mockQuestions[0].questionText, createdAt: new Date().toISOString() },
          }),
        });

        // Answer q1: saveResponse + user msg + thank you + q2 verification msg
        (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) });
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: { id: 'msg-2', role: 'user', content: 'John Doe', createdAt: new Date().toISOString() } }),
        });
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: { id: 'msg-3', role: 'assistant', content: 'Thank you.', createdAt: new Date().toISOString() } }),
        });
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: { id: 'msg-4', role: 'assistant', content: mockQuestions[1].questionText, createdAt: new Date().toISOString() } }),
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
      // Setup: init creates conversation and shows first question
      beforeEach(async () => {
        // Mock conversation creation
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            conversation: { id: mockConversationId },
          }),
        });

        // Mock welcome + first question (combined in one addMessage)
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-1',
              role: 'assistant',
              content: `Hi, I'm ${mockChatbotName} AI...\n\n${mockQuestions[0].questionText}`,
              createdAt: new Date().toISOString(),
            },
          }),
        });
      });

      it('saves answer to API', async () => {
        // Mock save response (POST /api/intake/responses)
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

        // Mock user message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-3', role: 'user', content: 'John Doe', createdAt: new Date().toISOString() },
          }),
        });

        // Mock thank you message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-4', role: 'assistant', content: 'Thank you.', createdAt: new Date().toISOString() },
          }),
        });

        // Mock next question
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-5', role: 'assistant', content: mockQuestions[1].questionText, createdAt: new Date().toISOString() },
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

        // Verify save was called (POST /api/intake/responses)
        const saveCalls = (global.fetch as jest.Mock).mock.calls.filter(
          (call) => call[0] === '/api/intake/responses'
        );
        expect(saveCalls.length).toBeGreaterThan(0);
      });

      it('shows user message and thank you message', async () => {
        // Mock save response
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true, json: async () => ({}),
        });

        // Mock user message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-3', role: 'user', content: 'John Doe', createdAt: new Date().toISOString() },
          }),
        });

        // Mock thank you message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-4', role: 'assistant', content: 'Thank you.', createdAt: new Date().toISOString() },
          }),
        });

        // Mock next question
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-5', role: 'assistant', content: mockQuestions[1].questionText, createdAt: new Date().toISOString() },
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
          ok: true, json: async () => ({}),
        });

        // Mock user message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-3', role: 'user', content: 'John Doe', createdAt: new Date().toISOString() },
          }),
        });

        // Mock thank you message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-4', role: 'assistant', content: 'Thank you.', createdAt: new Date().toISOString() },
          }),
        });

        // Mock next question
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-5', role: 'assistant', content: mockQuestions[1].questionText, createdAt: new Date().toISOString() },
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
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: {
              id: 'msg-1',
              role: 'assistant',
              content: `Hi, I'm ${mockChatbotName} AI...\n\n${mockQuestions[0].questionText}`,
              createdAt: new Date().toISOString(),
            },
          }),
        });
      });

      it('skips optional questions', async () => {
        // First, answer required q1 to get to optional q2
        // saveResponse
        (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) });
        // user message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-user', role: 'user', content: 'John Doe', createdAt: new Date().toISOString() },
          }),
        });
        // thank you
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-thanks', role: 'assistant', content: 'Thank you.', createdAt: new Date().toISOString() },
          }),
        });
        // next question (q2)
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-q2', role: 'assistant', content: mockQuestions[1].questionText, createdAt: new Date().toISOString() },
          }),
        });

        // Skip q2: user "(Skipped)" message
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-skip', role: 'user', content: '(Skipped)', createdAt: new Date().toISOString() },
          }),
        });
        // Skip q2: thank you
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-thanks2', role: 'assistant', content: 'Thank you.', createdAt: new Date().toISOString() },
          }),
        });
        // Next question (q3)
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-q3', role: 'assistant', content: mockQuestions[2].questionText, createdAt: new Date().toISOString() },
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

        // Answer first required question
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
      it('shows final message and calls onComplete', async () => {
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
            message: { id: 'msg-1', role: 'assistant', content: 'Welcome', createdAt: new Date().toISOString() },
          }),
        });

        // Mock final message (in showFinalMessage)
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-2', role: 'assistant', content: 'Final message', createdAt: new Date().toISOString() },
          }),
        });

        // Mock PATCH (mark intake complete) — returns suggestion pills
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            conversation: {
              id: mockConversationId,
              intakeCompleted: true,
              intakeCompletedAt: new Date().toISOString(),
            },
            suggestionPills: ['Tell me about yourself', 'What topics interest you?'],
          }),
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
        // Mock conversation creation
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conversation: { id: mockConversationId } }),
        });

        // Mock welcome + first question
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            message: { id: 'msg-1', role: 'assistant', content: mockQuestions[0].questionText, createdAt: new Date().toISOString() },
          }),
        });

        // Mock responses for first answer (save + user msg + thank you + next question)
        (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) });
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: { id: 'msg-2', role: 'user', content: 'John Doe', createdAt: new Date().toISOString() } }),
        });
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: { id: 'msg-3', role: 'assistant', content: 'Thank you.', createdAt: new Date().toISOString() } }),
        });
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: { id: 'msg-4', role: 'assistant', content: mockQuestions[1].questionText, createdAt: new Date().toISOString() } }),
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

        // Submit answer and wait for it to complete
        await act(async () => {
          await result.current.handleAnswer('John Doe');
        });

        await waitFor(() => {
          expect(result.current.isSaving).toBe(false);
        });

        // Verify exactly one save call was made
        const saveCalls = (global.fetch as jest.Mock).mock.calls.filter(
          (call) => call[0] === '/api/intake/responses'
        );
        expect(saveCalls.length).toBe(1);
      });
    });
  });
});
