// lib/ai/gateway.ts
// Vercel AI Gateway configuration
// Provides unified model identifiers for multi-provider AI access

import { createOpenAI } from '@ai-sdk/openai';
import { writeFileSync } from 'fs';
import { env } from '@/lib/env';

// Initialize the OpenAI provider for Vercel AI SDK
// Uses AI_GATEWAY_API_KEY in production (Vercel), falls back to OPENAI_API_KEY locally
const isProduction = process.env.NODE_ENV === 'production';

// DEV DEBUG: Intercept fetch to log the exact OpenAI request payload
// Writes separate files per model so the pills request doesn't overwrite the chat request
let debugCounter = 0;
const debugFetch: typeof globalThis.fetch = async (input, init) => {
  if (!isProduction && init?.body) {
    try {
      const body = JSON.parse(init.body as string);
      const model = body.model || 'unknown';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const debugPath = `./debug-llm-${model}-${timestamp}-${debugCounter++}.json`;
      writeFileSync(debugPath, JSON.stringify(body, null, 2));
      console.log(`[LLM DEBUG] ${model} payload written to ${debugPath} (${JSON.stringify(body).length} bytes)`);
    } catch {
      // non-JSON body (e.g. embeddings), skip
    }
  }
  return globalThis.fetch(input, init);
};

export const openai = createOpenAI({
  apiKey: isProduction && env.AI_GATEWAY_API_KEY ? env.AI_GATEWAY_API_KEY : env.OPENAI_API_KEY,
  fetch: isProduction ? undefined : debugFetch,
});

// Model identifiers for Vercel AI Gateway
// Format: provider instance + model name

// Chat models
export const GPT4O = openai('gpt-4o');
export const GPT4O_MINI = openai('gpt-4o-mini');

// Embedding models
export const EMBEDDING_MODEL = openai.embedding('text-embedding-3-small');

// Default models (easily switchable)
export const DEFAULT_CHAT_MODEL = GPT4O;
export const DEFAULT_MINI_MODEL = GPT4O_MINI;
export const DEFAULT_EMBEDDING_MODEL = EMBEDDING_MODEL;

// Model configuration constants
export const CHAT_TEMPERATURE = 0.7;
export const PILL_TEMPERATURE = 0.7;
