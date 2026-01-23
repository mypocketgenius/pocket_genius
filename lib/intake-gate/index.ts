/**
 * Intake Gate Decision Logic
 *
 * Single source of truth for determining whether to show intake or chat.
 *
 * DECISION TREE (evaluated in priority order):
 * 1. Conversation marked intakeCompleted=true → CHAT
 * 2. Conversation has messages → CHAT (resume existing)
 * 3. Chatbot has no questions → CHAT (skip intake)
 * 4. User hasn't answered all questions → INTAKE
 * 5. Default → CHAT
 *
 * @see INTAKE_GATE_REFACTOR_FOR_LLM_CLARITY.md for design rationale
 */

import type { GateDecision, GateInput } from './types';

export * from './types';

export function decideGate(input: GateInput): GateDecision {
  // Rule 1: Conversation already marked complete
  if (input.intakeCompletedForConversation) {
    return 'chat';
  }

  // Rule 2: Conversation has messages (resume existing conversation)
  if (input.conversationId && input.hasMessages) {
    return 'chat';
  }

  // Rule 3: Chatbot has no questions configured
  if (!input.chatbotHasQuestions) {
    return 'chat';
  }

  // Rule 4: User hasn't completed intake for this chatbot
  if (!input.userAnsweredAllQuestions) {
    return 'intake';
  }

  // Rule 5: Default to chat
  return 'chat';
}
