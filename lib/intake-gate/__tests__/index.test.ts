import { decideGate } from '../index';

describe('decideGate', () => {
  it('returns chat when conversation marked complete', () => {
    expect(decideGate({
      conversationId: 'abc',
      hasMessages: false,
      intakeCompletedForConversation: true,
      chatbotHasQuestions: true,
      userAnsweredAllQuestions: false,
    })).toBe('chat');
  });

  it('returns chat when conversation has messages', () => {
    expect(decideGate({
      conversationId: 'abc',
      hasMessages: true,
      intakeCompletedForConversation: false,
      chatbotHasQuestions: true,
      userAnsweredAllQuestions: false,
    })).toBe('chat');
  });

  it('returns chat when no questions configured', () => {
    expect(decideGate({
      conversationId: null,
      hasMessages: false,
      intakeCompletedForConversation: false,
      chatbotHasQuestions: false,
      userAnsweredAllQuestions: false,
    })).toBe('chat');
  });

  it('returns intake when user has not answered all questions', () => {
    expect(decideGate({
      conversationId: null,
      hasMessages: false,
      intakeCompletedForConversation: false,
      chatbotHasQuestions: true,
      userAnsweredAllQuestions: false,
    })).toBe('intake');
  });

  it('returns chat when user has answered all questions', () => {
    expect(decideGate({
      conversationId: null,
      hasMessages: false,
      intakeCompletedForConversation: false,
      chatbotHasQuestions: true,
      userAnsweredAllQuestions: true,
    })).toBe('chat');
  });
});
