// lib/pills/openai-pills-generator.ts
// Shared utility for AI-powered pill generation using Vercel AI SDK
// Used by both follow-up pills and suggestion pills generators

import { generateObject } from 'ai';
import { z } from 'zod';
import { DEFAULT_MINI_MODEL, PILL_TEMPERATURE } from '@/lib/ai/gateway';

// Shared configuration for pill generation
export const PILL_COUNT = 7; // Generate 7 pills (first 3 visible, rest via "Show More")

/**
 * Options for generating pills with AI
 */
export interface GeneratePillsOptions {
  /** System prompt defining the assistant's role */
  systemPrompt: string;
  /** User prompt with specific generation instructions */
  userPrompt: string;
  /** Content to analyze (assistant response or chatbot+intake context) */
  contextMessage: string;
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
 * Generates pills using Vercel AI SDK with JSON mode
 *
 * This shared utility handles:
 * - AI SDK call with consistent model/temperature
 * - Response parsing with the provided responseKey
 * - Timing measurement
 * - Error handling and logging
 *
 * @param options - Generation options
 * @returns Promise with pills array, generation time, and optional error
 *
 * @example
 * ```typescript
 * const result = await generatePillsWithOpenAI({
 *   systemPrompt: SYSTEM_PROMPT,
 *   userPrompt: 'Generate 5 follow-up questions. Return {"pills": [...]}',
 *   contextMessage: assistantResponse,
 * });
 * // Returns: { pills: ["Question 1", "Question 2", ...], generationTimeMs: 500 }
 * ```
 */
// Unified schema for all pill types
const pillsSchema = z.object({
  pills: z.array(z.string()),
});

export async function generatePillsWithOpenAI(
  options: GeneratePillsOptions
): Promise<GeneratePillsResult> {
  const { systemPrompt, userPrompt, contextMessage } = options;
  const startTime = Date.now();

  try {
    const { object } = await generateObject({
      model: DEFAULT_MINI_MODEL,
      schema: pillsSchema,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'assistant', content: contextMessage },
        { role: 'user', content: userPrompt },
      ],
      temperature: PILL_TEMPERATURE,
    });

    const generationTimeMs = Date.now() - startTime;

    console.log(`[openai-pills] Generated ${object.pills.length} pills in ${generationTimeMs}ms`);

    return {
      pills: object.pills,
      generationTimeMs,
    };
  } catch (error) {
    const generationTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[openai-pills] Generation failed:', {
      error: errorMessage,
      contextLength: contextMessage.length,
    });

    return {
      pills: [],
      generationTimeMs,
      error: errorMessage,
    };
  }
}
