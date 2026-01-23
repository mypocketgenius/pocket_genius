// __tests__/lib/intake-gate/index.test.ts
// Step 6: Unit tests for decideGate() function
// Tests the pure gate decision logic for intake flow

import { decideGate } from '@/lib/intake-gate';
import type { GateInput } from '@/lib/intake-gate/types';

describe('decideGate', () => {
  // Helper to create base input with sensible defaults
  const createInput = (overrides: Partial<GateInput> = {}): GateInput => ({
    conversationId: null,
    hasMessages: false,
    intakeCompletedForConversation: false,
    chatbotHasQuestions: true,
    userAnsweredAllQuestions: false,
    ...overrides,
  });

  describe('Rule 1: Conversation marked complete', () => {
    it('returns chat when intakeCompletedForConversation is true', () => {
      const input = createInput({
        conversationId: 'conv-123',
        intakeCompletedForConversation: true,
        chatbotHasQuestions: true,
        userAnsweredAllQuestions: false,
      });

      expect(decideGate(input)).toBe('chat');
    });

    it('returns chat when intakeCompletedForConversation is true even without conversationId', () => {
      // Edge case: shouldn't happen in practice, but logic should still hold
      const input = createInput({
        conversationId: null,
        intakeCompletedForConversation: true,
      });

      expect(decideGate(input)).toBe('chat');
    });
  });

  describe('Rule 2: Conversation has messages', () => {
    it('returns chat when conversation has messages', () => {
      const input = createInput({
        conversationId: 'conv-123',
        hasMessages: true,
        intakeCompletedForConversation: false,
        chatbotHasQuestions: true,
        userAnsweredAllQuestions: false,
      });

      expect(decideGate(input)).toBe('chat');
    });

    it('does not return chat for hasMessages without conversationId', () => {
      // If there's no conversationId, hasMessages shouldn't matter
      const input = createInput({
        conversationId: null,
        hasMessages: true,
        intakeCompletedForConversation: false,
        chatbotHasQuestions: true,
        userAnsweredAllQuestions: false,
      });

      // Should fall through to Rule 4 since no conversationId
      expect(decideGate(input)).toBe('intake');
    });
  });

  describe('Rule 3: Chatbot has no questions', () => {
    it('returns chat when chatbot has no questions configured', () => {
      const input = createInput({
        conversationId: null,
        hasMessages: false,
        intakeCompletedForConversation: false,
        chatbotHasQuestions: false,
        userAnsweredAllQuestions: false,
      });

      expect(decideGate(input)).toBe('chat');
    });

    it('returns chat when chatbot has no questions even with existing conversation', () => {
      const input = createInput({
        conversationId: 'conv-123',
        hasMessages: false,
        intakeCompletedForConversation: false,
        chatbotHasQuestions: false,
        userAnsweredAllQuestions: false,
      });

      expect(decideGate(input)).toBe('chat');
    });
  });

  describe('Rule 4: User has not answered all questions', () => {
    it('returns intake when user has not answered all questions', () => {
      const input = createInput({
        conversationId: null,
        hasMessages: false,
        intakeCompletedForConversation: false,
        chatbotHasQuestions: true,
        userAnsweredAllQuestions: false,
      });

      expect(decideGate(input)).toBe('intake');
    });

    it('returns intake for new conversation with unanswered questions', () => {
      const input = createInput({
        conversationId: 'new-conv-123',
        hasMessages: false,
        intakeCompletedForConversation: false,
        chatbotHasQuestions: true,
        userAnsweredAllQuestions: false,
      });

      expect(decideGate(input)).toBe('intake');
    });
  });

  describe('Rule 5: Default - User has answered all questions', () => {
    it('returns chat when user has answered all questions', () => {
      const input = createInput({
        conversationId: null,
        hasMessages: false,
        intakeCompletedForConversation: false,
        chatbotHasQuestions: true,
        userAnsweredAllQuestions: true,
      });

      expect(decideGate(input)).toBe('chat');
    });

    it('returns chat when user has answered all questions with existing conversation', () => {
      const input = createInput({
        conversationId: 'conv-123',
        hasMessages: false,
        intakeCompletedForConversation: false,
        chatbotHasQuestions: true,
        userAnsweredAllQuestions: true,
      });

      expect(decideGate(input)).toBe('chat');
    });
  });

  describe('Priority order', () => {
    it('Rule 1 takes priority over Rule 2', () => {
      const input = createInput({
        conversationId: 'conv-123',
        hasMessages: true,
        intakeCompletedForConversation: true, // Rule 1
        chatbotHasQuestions: true,
        userAnsweredAllQuestions: false,
      });

      // Both Rule 1 and Rule 2 would return 'chat', so this confirms Rule 1 is checked
      expect(decideGate(input)).toBe('chat');
    });

    it('Rule 2 takes priority over Rule 4', () => {
      const input = createInput({
        conversationId: 'conv-123',
        hasMessages: true, // Rule 2
        intakeCompletedForConversation: false,
        chatbotHasQuestions: true,
        userAnsweredAllQuestions: false, // Would trigger Rule 4 if reached
      });

      expect(decideGate(input)).toBe('chat');
    });

    it('Rule 3 takes priority over Rule 4', () => {
      const input = createInput({
        conversationId: null,
        hasMessages: false,
        intakeCompletedForConversation: false,
        chatbotHasQuestions: false, // Rule 3
        userAnsweredAllQuestions: false, // Would trigger Rule 4 if reached
      });

      expect(decideGate(input)).toBe('chat');
    });
  });

  describe('Integration scenarios', () => {
    it('new conversation with questions and unanswered -> intake', () => {
      const input = createInput({
        conversationId: null,
        hasMessages: false,
        intakeCompletedForConversation: false,
        chatbotHasQuestions: true,
        userAnsweredAllQuestions: false,
      });

      expect(decideGate(input)).toBe('intake');
    });

    it('new conversation without questions -> chat', () => {
      const input = createInput({
        conversationId: null,
        hasMessages: false,
        intakeCompletedForConversation: false,
        chatbotHasQuestions: false,
        userAnsweredAllQuestions: false,
      });

      expect(decideGate(input)).toBe('chat');
    });

    it('existing conversation with messages -> chat (resume)', () => {
      const input = createInput({
        conversationId: 'existing-conv',
        hasMessages: true,
        intakeCompletedForConversation: false,
        chatbotHasQuestions: true,
        userAnsweredAllQuestions: false,
      });

      expect(decideGate(input)).toBe('chat');
    });

    it('completed intake conversation -> chat', () => {
      const input = createInput({
        conversationId: 'completed-conv',
        hasMessages: false,
        intakeCompletedForConversation: true,
        chatbotHasQuestions: true,
        userAnsweredAllQuestions: false,
      });

      expect(decideGate(input)).toBe('chat');
    });

    it('user already answered all questions for chatbot -> chat', () => {
      const input = createInput({
        conversationId: null,
        hasMessages: false,
        intakeCompletedForConversation: false,
        chatbotHasQuestions: true,
        userAnsweredAllQuestions: true,
      });

      expect(decideGate(input)).toBe('chat');
    });
  });
});
