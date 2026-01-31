// lib/follow-up-pills/generate-pills.ts
// Follow-up pills generation module
// Generates AI-powered follow-up questions based on assistant responses
// Refactored to use shared OpenAI utility for consistent pill generation

import {
  generatePillsWithOpenAI,
  GeneratePillsResult,
  PILL_COUNT,
} from '@/lib/pills/openai-pills-generator';

const DEFAULT_PILLS_PROMPT = `Based on the assistant's response above and the user's intake responses (if provided), generate ${PILL_COUNT} follow-up questions that the USER can ask TO THE AI to continue the conversation. These questions should be phrased as if the user is asking the AI (e.g., "Tell me more about...", "What are examples of...", "How can I..."). Consider the user's intake responses when generating relevant follow-up questions. Do NOT generate questions that ask the user about themselves (e.g., avoid "what do you think..." or "how well do you know..."). Return ONLY a JSON object with this exact structure: {"pills": ["question 1", "question 2", "question 3"]}. Each question should be 5-15 words, natural and conversational, directly related to the assistant's response and user context, and actionable. Order questions by quality and relevance (best questions first). Note: The first 3 questions are shown initially; remaining questions appear after "Show More" is clicked.`;

const PILLS_SYSTEM_PROMPT = `You are a helpful assistant that generates follow-up questions that users can ask to continue a conversation. Generate questions phrased as if the USER is asking the AI (e.g., "Tell me more about...", "Explain...", "What are examples of..."). These questions should help users explore the topic further by asking the AI for more information, examples, or explanations. Do NOT generate questions that ask the user about themselves or their knowledge.`;

export interface GeneratePillsOptions {
  assistantResponse: string;
  configJson: Record<string, any> | null;
  chatbotId: string;
  conversationId: string;
  intakeResponses?: Array<{ question: string; answer: string }>;
}

// Re-export for backward compatibility
export type { GeneratePillsResult };

/**
 * Generates follow-up pills based on assistant response and user intake responses
 * Uses shared OpenAI utility with gpt-4o-mini for cost-effective generation
 *
 * @param options - Generation options
 * @param options.assistantResponse - The assistant's response text
 * @param options.configJson - Chatbot configuration JSON (may contain enableFollowUpPills and followUpPillsPrompt)
 * @param options.chatbotId - Chatbot ID for logging
 * @param options.conversationId - Conversation ID for logging
 * @param options.intakeResponses - Optional array of user's intake question responses (question/answer pairs)
 * @returns Promise with pills array, generation time, and optional error
 *
 * @example
 * ```typescript
 * const result = await generateFollowUpPills({
 *   assistantResponse: "The Art of War emphasizes strategic positioning...",
 *   configJson: { enableFollowUpPills: true },
 *   chatbotId: "chatbot-123",
 *   conversationId: "conv-456",
 *   intakeResponses: [
 *     { question: "What is your company size?", answer: "50-100 employees" },
 *     { question: "What industry are you in?", answer: "Technology" }
 *   ],
 * });
 * // Returns: { pills: ["Tell me more about...", "Give examples..."], generationTimeMs: 850 }
 * ```
 */
export async function generateFollowUpPills(
  options: GeneratePillsOptions
): Promise<GeneratePillsResult> {
  const { assistantResponse, configJson, intakeResponses } = options;

  // Check if feature is disabled (enabled by default)
  if (configJson?.enableFollowUpPills === false) {
    return {
      pills: [],
      generationTimeMs: 0,
    };
  }

  // Get chatbot-specific follow-up pills prompt from configJson
  const customPillsPrompt = configJson?.followUpPillsPrompt;

  // Use custom prompt if provided, otherwise use default
  const userPrompt =
    customPillsPrompt && customPillsPrompt.trim() !== ''
      ? customPillsPrompt
      : DEFAULT_PILLS_PROMPT;

  // Build context message with intake responses if available
  let contextMessage = assistantResponse;
  if (intakeResponses && intakeResponses.length > 0) {
    const intakeContext = intakeResponses
      .map(({ question, answer }) => `Q: ${question}\nA: ${answer}`)
      .join('\n\n');
    contextMessage = `User's Intake Responses:\n${intakeContext}\n\n---\n\nAssistant's Response:\n${assistantResponse}`;
  }

  // Use shared utility for OpenAI call
  return generatePillsWithOpenAI({
    systemPrompt: PILLS_SYSTEM_PROMPT,
    userPrompt,
    contextMessage,
  });
}
