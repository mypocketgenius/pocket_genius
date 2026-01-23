/**
 * Intake Gate Types
 *
 * Centralized types for the intake gate decision system.
 */

export type GateDecision = 'intake' | 'chat';

export interface GateInput {
  /** The conversation ID from URL, or null if new conversation */
  conversationId: string | null;

  /** Whether the conversation has any messages */
  hasMessages: boolean;

  /** Whether THIS conversation has completed intake (from DB field) */
  intakeCompletedForConversation: boolean;

  /** Whether the chatbot has any intake questions configured */
  chatbotHasQuestions: boolean;

  /** Whether the user has answered ALL questions for this chatbot (legacy check) */
  userAnsweredAllQuestions: boolean;
}

export interface IntakeQuestion {
  id: string;
  questionText: string;
  helperText?: string;
  responseType: 'TEXT' | 'NUMBER' | 'SELECT' | 'MULTI_SELECT' | 'BOOLEAN';
  displayOrder: number;
  isRequired: boolean;
  options?: string[];
}

export interface GateData extends GateInput {
  /** Chatbot display name */
  chatbotName: string;

  /** Generated purpose text */
  chatbotPurpose: string;

  /** User's existing intake responses */
  existingResponses: Record<string, any>;

  /** Intake questions for this chatbot */
  questions: IntakeQuestion[];
}
