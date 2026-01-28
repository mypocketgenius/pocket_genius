// lib/pills/generate-suggestion-pills.ts
// Suggestion pills generation module
// Generates AI-powered personalized conversation starter questions
// based on chatbot context and user's intake responses

import {
  generatePillsWithOpenAI,
  GeneratePillsResult,
  PILL_COUNT,
} from './openai-pills-generator';
import { ChatbotType } from '@/lib/types/chatbot';

/**
 * Chatbot context for suggestion pill generation
 */
export interface ChatbotContext {
  id: string;
  title: string;
  description: string | null;
  type: ChatbotType | null;
  creator: { name: string };
  sources: Array<{ title: string }>;
}

/**
 * User's intake context for personalization
 */
export interface IntakeContext {
  /** Map of questionId to user's answer */
  responses: Record<string, string>;
  /** Array of intake questions */
  questions: Array<{ id: string; questionText: string }>;
}

/**
 * Options for generating suggestion pills
 */
export interface GenerateSuggestionPillsOptions {
  /** Chatbot metadata for context */
  chatbot: ChatbotContext;
  /** User's intake responses for personalization */
  intake: IntakeContext;
  /** Optional custom prompt override from configJson.suggestionPillsPrompt */
  customPrompt?: string;
}

const SUGGESTION_SYSTEM_PROMPT = `You are a helpful assistant that generates personalized conversation starter questions for a chatbot. Generate questions that reflect both the chatbot's subject matter AND the user's specific context from their intake responses. Questions should be phrased as if the USER is asking the AI (e.g., "What does [author] say about...", "How can I apply...", "Explain...").`;

/**
 * Get type-specific context description for the chatbot
 */
function getTypeContext(type: ChatbotType | null): string {
  switch (type) {
    case 'BODY_OF_WORK':
      return 'a chatbot based on an author\'s body of work (books, writings, teachings)';
    case 'FRAMEWORK':
      return 'a chatbot teaching a specific framework or methodology';
    case 'DEEP_DIVE':
      return 'a chatbot for deep exploration of a specific topic';
    case 'ADVISOR_BOARD':
      return 'a chatbot simulating an advisory board of experts';
    default:
      return 'a knowledge-based chatbot';
  }
}

/**
 * Build the user prompt with chatbot and intake context
 */
function buildUserPrompt(
  chatbot: ChatbotContext,
  intake: IntakeContext
): string {
  const typeContext = getTypeContext(chatbot.type);

  // Build intake Q&A section
  const intakeSection = intake.questions
    .map((q) => {
      const answer = intake.responses[q.id] || 'No response';
      return `- Q: "${q.questionText}"\n  A: "${answer}"`;
    })
    .join('\n');

  // Build sources section if available
  const sourcesSection =
    chatbot.sources.length > 0
      ? `\nSource Materials: ${chatbot.sources.map((s) => s.title).join(', ')}`
      : '';

  return `A user has just completed intake for ${typeContext}.

Chatbot: "${chatbot.title}"
Created by: ${chatbot.creator.name}
Description: ${chatbot.description || 'No description available'}${sourcesSection}

User's Context (from intake):
${intakeSection || 'No intake responses provided'}

Based on this user's specific situation and interests, generate ${PILL_COUNT} personalized conversation starter questions. These questions should:
1. Be tailored to the user's stated context and goals
2. Be specific to the chatbot's subject matter
3. Be phrased as the user asking the AI
4. Be 10-25 words each, natural and conversational
5. Help the user get immediate value from this chatbot
6. Be ordered by quality, insight, and relevance to this specific user (best questions first)

Return ONLY a JSON object: {"suggestions": ["question 1", "question 2", ...]}

Note: The first 3 questions are shown initially; remaining ${PILL_COUNT - 3} appear after "Show More" is clicked.`;
}

/**
 * Generates personalized suggestion pills based on chatbot context and user intake
 *
 * @param options - Generation options
 * @param options.chatbot - Chatbot metadata (title, description, type, creator, sources)
 * @param options.intake - User's intake responses (questions and answers)
 * @param options.customPrompt - Optional custom prompt override
 * @returns Promise with pills array, generation time, and optional error
 *
 * @example
 * ```typescript
 * const result = await generateSuggestionPills({
 *   chatbot: {
 *     id: 'chatbot-123',
 *     title: 'The Art of War',
 *     description: 'Ancient Chinese military strategy...',
 *     type: 'BODY_OF_WORK',
 *     creator: { name: 'Sun Tzu' },
 *     sources: [{ title: 'The Art of War' }],
 *   },
 *   intake: {
 *     responses: { 'q1': 'Team leadership', 'q2': 'Tech startup' },
 *     questions: [
 *       { id: 'q1', questionText: 'What challenges do you face?' },
 *       { id: 'q2', questionText: 'What industry are you in?' },
 *     ],
 *   },
 * });
 * // Returns: { pills: ["How can I apply...", ...], generationTimeMs: 850 }
 * ```
 */
export async function generateSuggestionPills(
  options: GenerateSuggestionPillsOptions
): Promise<GeneratePillsResult> {
  const { chatbot, intake, customPrompt } = options;

  // Build context message from chatbot metadata
  const contextMessage = `Chatbot: ${chatbot.title}
Type: ${chatbot.type || 'General'}
Creator: ${chatbot.creator.name}
Description: ${chatbot.description || 'No description'}
Sources: ${chatbot.sources.map((s) => s.title).join(', ') || 'None'}`;

  // Use custom prompt if provided, otherwise build default user prompt
  const userPrompt = customPrompt?.trim()
    ? customPrompt
    : buildUserPrompt(chatbot, intake);

  // Use shared utility for OpenAI call
  return generatePillsWithOpenAI({
    systemPrompt: SUGGESTION_SYSTEM_PROMPT,
    userPrompt,
    contextMessage,
    responseKey: 'suggestions',
  });
}
