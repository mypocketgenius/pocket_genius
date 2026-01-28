// lib/pills/openai-pills-generator.ts
// Shared utility for OpenAI JSON-mode pill generation
// Used by both follow-up pills and suggestion pills generators

import OpenAI from 'openai';
import { env } from '@/lib/env';

// Shared configuration for pill generation
const MODEL = 'gpt-4o-mini'; // Cost-effective, sufficient for pill generation
const TEMPERATURE = 0.7; // Balanced: personalized but focused
export const PILL_COUNT = 7; // Generate 7 pills (first 3 visible, rest via "Show More")

// Initialize OpenAI client with type-safe API key
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

/**
 * Options for generating pills with OpenAI
 */
export interface GeneratePillsOptions {
  /** System prompt defining the assistant's role */
  systemPrompt: string;
  /** User prompt with specific generation instructions */
  userPrompt: string;
  /** Content to analyze (assistant response or chatbot+intake context) */
  contextMessage: string;
  /** Key to extract pills from JSON response ('followUps' or 'suggestions') */
  responseKey: string;
}

/**
 * Result from pill generation
 */
export interface GeneratePillsResult {
  /** Array of generated pill strings */
  pills: string[];
  /** Time taken to generate pills in milliseconds */
  generationTimeMs: number;
  /** Error message if generation failed */
  error?: string;
}

/**
 * Generates pills using OpenAI with JSON mode
 *
 * This shared utility handles:
 * - OpenAI client initialization
 * - JSON-mode API call with consistent model/temperature
 * - Response parsing with the provided responseKey
 * - Timing measurement
 * - Error handling and logging
 *
 * @param options - Generation options
 * @returns Promise with pills array, generation time, and optional error
 *
 * @example
 * ```typescript
 * // For follow-up pills
 * const result = await generatePillsWithOpenAI({
 *   systemPrompt: FOLLOW_UP_SYSTEM_PROMPT,
 *   userPrompt: customPrompt || DEFAULT_PROMPT,
 *   contextMessage: assistantResponse,
 *   responseKey: 'followUps',
 * });
 *
 * // For suggestion pills
 * const result = await generatePillsWithOpenAI({
 *   systemPrompt: SUGGESTION_SYSTEM_PROMPT,
 *   userPrompt: buildUserPrompt(chatbot, intake),
 *   contextMessage: chatbotContext,
 *   responseKey: 'suggestions',
 * });
 * ```
 */
export async function generatePillsWithOpenAI(
  options: GeneratePillsOptions
): Promise<GeneratePillsResult> {
  const { systemPrompt, userPrompt, contextMessage, responseKey } = options;
  const startTime = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'assistant', content: contextMessage },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: TEMPERATURE,
    });

    const generationTimeMs = Date.now() - startTime;
    const content = response.choices[0]?.message?.content;

    if (!content) {
      console.error('[openai-pills] Empty response from OpenAI');
      return {
        pills: [],
        generationTimeMs,
        error: 'Empty response from OpenAI',
      };
    }

    const parsedData = JSON.parse(content);
    const pills = Array.isArray(parsedData[responseKey]) ? parsedData[responseKey] : [];

    console.log(`[openai-pills] Generated ${pills.length} pills in ${generationTimeMs}ms`);

    return {
      pills,
      generationTimeMs,
    };
  } catch (error) {
    const generationTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[openai-pills] Generation failed:', {
      error: errorMessage,
      responseKey,
      contextLength: contextMessage.length,
    });

    return {
      pills: [],
      generationTimeMs,
      error: errorMessage,
    };
  }
}
