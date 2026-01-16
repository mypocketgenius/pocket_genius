// lib/follow-up-pills/generate-pills.ts
// Follow-up pills generation module
// Generates AI-powered follow-up questions based on assistant responses

import OpenAI from 'openai';
import { env } from '@/lib/env';

const DEFAULT_PILLS_PROMPT = `Based on the assistant's response above and the user's intake responses (if provided), generate 2-4 follow-up questions that the USER can ask TO THE AI to continue the conversation. These questions should be phrased as if the user is asking the AI (e.g., "Tell me more about...", "What are examples of...", "How can I..."). Consider the user's intake responses when generating relevant follow-up questions. Do NOT generate questions that ask the user about themselves (e.g., avoid "what do you think..." or "how well do you know..."). Return ONLY a JSON object with this exact structure: {"followUps": ["question 1", "question 2", "question 3"]}. Each question should be 5-15 words, natural and conversational, directly related to the assistant's response and user context, and actionable.`;

const PILLS_SYSTEM_PROMPT = `You are a helpful assistant that generates follow-up questions that users can ask to continue a conversation. Generate questions phrased as if the USER is asking the AI (e.g., "Tell me more about...", "Explain...", "What are examples of..."). These questions should help users explore the topic further by asking the AI for more information, examples, or explanations. Do NOT generate questions that ask the user about themselves or their knowledge.`;

// Initialize OpenAI client with type-safe API key
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export interface GeneratePillsOptions {
  assistantResponse: string;
  configJson: Record<string, any> | null;
  chatbotId: string;
  conversationId: string;
  intakeResponses?: Array<{ question: string; answer: string }>; // User's intake question responses
}

export interface GeneratePillsResult {
  pills: string[];
  generationTimeMs: number;
  error?: string;
}

/**
 * Generates follow-up pills based on assistant response and user intake responses
 * Uses GPT-4o with JSON mode for reliable structured output
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
  const { assistantResponse, configJson, chatbotId, conversationId, intakeResponses } = options;
  const startTime = Date.now();
  
  // Check if feature is disabled (enabled by default)
  const isFeatureDisabled = configJson?.enableFollowUpPills === false;
  
  if (isFeatureDisabled) {
    return {
      pills: [],
      generationTimeMs: 0,
    };
  }
  
  try {
    // Get chatbot-specific follow-up pills prompt from configJson
    const customPillsPrompt = configJson?.followUpPillsPrompt;
    
    // Use custom prompt if provided, otherwise use default
    const pillsPrompt = (customPillsPrompt && customPillsPrompt.trim() !== '') 
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
    
    const pillsResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: PILLS_SYSTEM_PROMPT },
        // Include intake responses context along with assistant response
        { role: 'assistant', content: contextMessage },
        { role: 'user', content: pillsPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    const pillsData = JSON.parse(pillsResponse.choices[0].message.content || '{}');
    const pills = Array.isArray(pillsData.followUps) ? pillsData.followUps : [];
    
    const generationTime = Date.now() - startTime;
    console.log(`Follow-up pills generated in ${generationTime}ms: ${pills.length} pills`);
    
    return {
      pills,
      generationTimeMs: generationTime,
    };
  } catch (error) {
    const generationTime = Date.now() - startTime;
    console.error('Error generating follow-up pills:', error);
    console.error('Pill generation error details:', {
      error: error instanceof Error ? error.message : String(error),
      chatbotId,
      conversationId,
      responseLength: assistantResponse.length,
    });
    
    return {
      pills: [],
      generationTimeMs: generationTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

