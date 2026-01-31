// lib/ai/gateway.ts
// Vercel AI Gateway configuration
// Provides unified model identifiers for multi-provider AI access

import { createOpenAI } from '@ai-sdk/openai';
import { env } from '@/lib/env';

// Initialize the OpenAI provider for Vercel AI SDK
// Uses AI_GATEWAY_API_KEY in production (Vercel), falls back to OPENAI_API_KEY locally
const isProduction = process.env.NODE_ENV === 'production';
export const openai = createOpenAI({
  apiKey: isProduction && env.AI_GATEWAY_API_KEY ? env.AI_GATEWAY_API_KEY : env.OPENAI_API_KEY,
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
