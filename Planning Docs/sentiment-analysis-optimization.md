# Sentiment Analysis Optimization Problem

## Problem Statement

The current Phase 4.1 sentiment analysis implementation is inefficient and expensive:

### Current Implementation
1. **Per-message analysis**: Every user message triggers a separate API call to analyze sentiment
2. **Async trigger**: After storing user message, a non-blocking API call triggers sentiment analysis
3. **Separate attribution job**: A cron job (every 15 minutes) processes analyses and attributes them to chunks
4. **No filtering**: Analyzes ALL user messages, including:
   - First messages (no bot context to react to)
   - Very short messages ("thanks", "ok", "👍")
   - Single-word acknowledgments

### Problems Identified

1. **Cost inefficiency**: 
   - Each message = 1 API call to GPT-4o-mini (~$0.15/$0.60 per 1M tokens)
   - Many messages provide no meaningful sentiment data
   - First messages can't be attributed (no previous bot response)

2. **Low-value analyses**:
   - Acknowledgments don't provide actionable sentiment
   - Very short messages (< 20 chars) are often noise
   - Messages without bot context can't be attributed to chunks

3. **Attribution complexity**:
   - Must traverse message history to find previous bot message
   - Extract chunks from bot message's `context` JSON field
   - Fragile: Depends on message ordering and context structure

4. **Visible result**: 
   - Sentiment is **aggregated** in `Chunk_Performance` table
   - Dashboard shows: `avgSatisfaction = satisfactionSum / satisfactionCount`
   - Individual message analyses are aggregated, not displayed individually

## Key Insight

**The sentiment is aggregated anyway** - we don't need individual message analyses. We need aggregated sentiment per chunk over time.

## Options Considered

### Option 1: Batch Analysis by Chunk (Recommended Initially)

**Approach**: Collect messages that respond to the same chunks, analyze them together

**Implementation**:
```typescript
// Attribution job collects messages per chunk
const messagesByChunk = groupMessagesByChunk(unattributedMessages);

for (const [chunkId, messages] of messagesByChunk) {
  // Analyze all messages for this chunk in one API call
  const batchAnalysis = await analyzeBatchSentiment(messages);
  // Then attribute to chunk
}
```

**Benefits**:
- ✅ Fewer API calls (1 per chunk instead of 1 per message)
- ✅ Significant cost reduction (e.g., 10 messages → 2 chunks = 2 API calls instead of 10)
- ✅ More context for model (sees multiple reactions together)
- ✅ Better for aggregated sentiment (matches how it's displayed)

**Challenges**:
- ⚠️ Must wait for attribution job to run (15 min delay)
- ⚠️ Need to group messages by chunks they respond to
- ⚠️ Still requires async job processing

---

### Option 2: Analyze During Response Generation

**Approach**: Analyze sentiment as part of the response generation process

**Implementation Options**:

#### Option 2A: Structured Outputs
```typescript
// After streaming completes, make one non-streaming call
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [...conversation],
  response_format: { type: 'json_object' },
  // Get both response quality check and sentiment analysis
});
```

#### Option 2B: Function Calling
```typescript
// Define sentiment analysis function
const functions = [{
  name: 'analyze_sentiment',
  description: 'Analyze user message sentiment',
  parameters: { ... }
}];
// Model calls it automatically during response generation
```

#### Option 2C: Hybrid (Recommended)
```typescript
// 1. Stream response normally (user sees it immediately)
// 2. After streaming completes, immediately analyze sentiment
//    using same conversation context (reuses context, still efficient)
// 3. Store both response and sentiment analysis
```

**Benefits**:
- ✅ Single API call (or two calls but reusing context)
- ✅ Lower latency: Sentiment available immediately
- ✅ Simpler: No need to batch/group messages later
- ✅ Better context: Model sees full conversation when analyzing
- ✅ No async job needed: Sentiment available synchronously

**Challenges**:
- ⚠️ Option 2A/2B: Complex to implement with streaming
- ⚠️ Option 2C: Still two API calls (but more efficient than current)
- ⚠️ Need to handle sentiment analysis failures gracefully (non-blocking)

---

### Option 3: Filter + Batch Hybrid

**Approach**: Combine filtering with batching

**Implementation**:
1. **Filter messages** before analysis:
   - Skip first messages (no bot context)
   - Skip very short messages (< 20 chars)
   - Skip acknowledgments ("thanks", "ok", etc.)
   - Only analyze messages in conversations with 2+ messages

2. **Batch remaining messages** by chunk (Option 1)

**Benefits**:
- ✅ Reduces API calls significantly (60-70% reduction)
- ✅ Focuses on meaningful sentiment data
- ✅ Avoids wasted analyses that can't be attributed

**Challenges**:
- ⚠️ Still requires async job processing
- ⚠️ More complex filtering logic

---

## Current Architecture Context

### Data Flow
```
User Message → Store in DB → Trigger async sentiment analysis
                              ↓
                         Message_Analysis table
                              ↓
                    Attribution Job (every 15 min)
                              ↓
              Message_Analysis_Chunk_Attribution (join table)
                              ↓
                    Chunk_Performance (aggregated)
                              ↓
                    Dashboard (shows avgSatisfaction)
```

### Key Files
- `app/api/chat/route.ts` - Chat API, stores messages, triggers sentiment
- `app/api/analysis/sentiment/route.ts` - Sentiment analysis endpoint
- `app/api/jobs/attribute-sentiment/route.ts` - Attribution job
- `components/dashboard-content.tsx` - Displays aggregated sentiment

### Database Schema
- `Message_Analysis`: Stores individual sentiment analyses
- `Message_Analysis_Chunk_Attribution`: Join table linking analyses to chunks
- `Chunk_Performance`: Aggregated metrics (`satisfactionSum`, `satisfactionCount`)

## Questions for Analysis

1. **Which option provides the best cost/benefit ratio?**
   - Option 1: Batch analysis (fewer calls, but delayed)
   - Option 2: During response (immediate, but more complex)
   - Option 3: Filter + batch (balanced approach)

2. **Is the 15-minute delay acceptable?**
   - Current: Attribution job runs every 15 minutes
   - Option 2C: Sentiment available immediately
   - Does immediate sentiment provide value, or is delayed aggregation sufficient?

3. **How should we handle filtering?**
   - Should we filter messages before analysis?
   - What criteria: message length, conversation length, content type?
   - Or analyze everything and let aggregation handle noise?

4. **Streaming complexity:**
   - Can we integrate sentiment analysis with streaming responses?
   - Or should we keep them separate (stream response, then analyze)?

5. **Cost vs. Latency trade-off:**
   - Option 1: Lower cost, higher latency (15 min delay)
   - Option 2: Higher cost (or same), lower latency (immediate)
   - Which matters more for Alpha?

## Recommendation Needed

Please analyze these options and recommend:
1. Best approach for Alpha (MVP)
2. Best approach for production (scaled)
3. Implementation complexity assessment
4. Cost impact estimates
5. Any hybrid approaches we haven't considered

---

## ✅ RECOMMENDED SOLUTION: Smart Filtering + Immediate Batching

### Why the Proposed Approach is Overcomplicated

The original design has a fundamental flaw: **it tries to solve a problem that doesn't exist**. 

**Key Insight**: The chunks are **already stored** in the assistant message's `context` field. When we store assistant message N+1, we can immediately analyze user message N+1's sentiment about the chunks from assistant message N (which we already have). No message history traversal needed!

### The Batching Efficiency Question

**You're right** - my initial recommendation missed batching efficiencies. Here's the trade-off:

- **Individual analysis**: 1 API call per message (after filtering) = immediate but less efficient
- **Batching**: 1 API call per chunk (multiple messages) = more efficient but requires delay

**Better approach**: Combine filtering + immediate batching for best of both worlds.

### Recommended Architecture: Two Approaches

#### Approach A: Immediate Batching (Recommended for Alpha)

**Batch messages that respond to the same chunks within a short time window** (e.g., 30 seconds):

```
User Message N+1 → Store → Query RAG → Stream Response → Store Assistant Message N+1
                                                              ↓
                                    Check for pending messages responding to same chunks
                                    (within last 30 seconds)
                                                              ↓
                                    If batch exists: Analyze all together (1 API call)
                                    If no batch: Queue for future batching
                                                              ↓
                                    Update Chunk_Performance immediately
```

**Benefits**:
- ✅ Batching efficiency: 1 API call per chunk (not per message)
- ✅ Still relatively immediate: 30-second window (vs 15 minutes)
- ✅ Smart filtering: Only analyze meaningful messages
- ✅ Cost reduction: 60-70% from filtering + additional reduction from batching

**Example**: 10 filtered messages respond to 2 chunks = **2 API calls** (vs 10 individual calls)

#### Approach B: Simple Individual Analysis (Simpler, Less Efficient)

**Analyze each message individually** (original recommendation):

```
User Message N+1 → Store → Query RAG → Stream Response → Store Assistant Message N+1
                                                              ↓
                                    Get previous assistant message N (has chunks in context)
                                    Get current user message N+1
                                    Apply smart filters
                                                              ↓
                                    Analyze sentiment synchronously (non-blocking)
                                    Attribute to chunks from assistant message N
                                                              ↓
                                    Update Chunk_Performance immediately
```

**Benefits**:
- ✅ Simplest to implement
- ✅ Immediate feedback
- ✅ 60-70% cost reduction from filtering
- ⚠️ Less efficient than batching (1 call per message vs 1 per chunk)

### Implementation Flow

**Location**: `app/api/chat/route.ts` - Right after storing assistant message (around line 535)

**Steps**:
1. After storing assistant message N+1, fetch the previous assistant message (N) to get its chunks
2. Get the current user message (N+1) that triggered this response
3. Apply smart filters (skip if first message, too short, or simple acknowledgment)
4. If passes filters, analyze sentiment synchronously (non-blocking via Promise - don't await)
5. Attribute sentiment to chunks from assistant message N's `context.chunks`
6. Update `Chunk_Performance` immediately with sentiment data

### Smart Filtering Logic

**Skip analysis for**:
- ✅ First user message in conversation (no previous chunks to attribute to)
- ✅ Messages < 20 characters
- ✅ Simple acknowledgments: "thanks", "ok", "👍", "got it", "cool", "nice", "perfect"
- ✅ Single-word responses: "yes", "no", "yep", "nope", "sure"
- ✅ Emoji-only messages: "👍", "😊", "✅"

**Result**: 60-70% reduction in API calls while maintaining high-quality sentiment data

### Benefits

1. ✅ **No async jobs** - Synchronous, immediate updates (no 15-minute delay)
2. ✅ **No message history traversal** - Chunks are right there in `context.chunks`
3. ✅ **60-70% cost reduction** - Smart filtering eliminates low-value analyses
4. ✅ **Simpler code** - No cron jobs, no attribution logic, no join tables needed
5. ✅ **Immediate feedback** - Sentiment available instantly for dashboard
6. ✅ **Better context** - Analyze sentiment right after response with full conversation context
7. ✅ **Non-blocking** - User doesn't wait for sentiment analysis (fire-and-forget Promise)

### Comparison Table

| Option | Cost | Latency | Complexity | Code Lines | API Calls (10 msgs → 2 chunks) | Best For |
|--------|------|---------|------------|------------|--------------------------------|----------|
| **Current (Proposed)** | High | 15 min | High | ~500+ | 10 calls | ❌ Overcomplicated |
| Option 1: Batch | Medium | 15 min | Medium | ~300 | 2 calls | ❌ Still delayed |
| Option 2C: During response | Medium | Immediate | Medium | ~200 | 10 calls | ⚠️ More complex |
| Option 3: Filter + Batch | Low-Medium | 15 min | Medium | ~350 | 2 calls (after filtering) | ⚠️ Still delayed |
| **✅ Approach A: Filter + Immediate Batch** | **Lowest** | **30 sec** | **Medium** | **~250** | **2 calls** | ✅ **Best efficiency** |
| **Approach B: Filter + Individual** | **Low** | **Immediate** | **Low** | **~150** | **~4 calls** (after filtering) | ✅ **Simplest** |

**Key Insight**: Approach A gives you batching efficiency (like Option 1) but with only 30-second delay instead of 15 minutes.

### Implementation Details

#### Approach A: Immediate Batching (Recommended)

**Key idea**: Use an in-memory queue that batches messages by chunk within a 30-second window.

**Implementation**:

1. **Create batching queue** (`lib/analysis/sentiment-batch.ts`):
```typescript
// In-memory queue for batching messages
const pendingBatches = new Map<string, {
  messages: Array<{ messageId: string, content: string, botResponse: string }>,
  chunks: any[],
  timestamp: number
}>();

// Process batches every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, batch] of pendingBatches.entries()) {
    if (now - batch.timestamp > 30000) { // 30 seconds
      processBatch(key, batch);
      pendingBatches.delete(key);
    }
  }
}, 5000); // Check every 5 seconds

async function processBatch(key: string, batch: any) {
  // Analyze all messages together
  const analysis = await analyzeBatchSentiment(batch.messages, batch.chunks);
  // Update Chunk_Performance
}
```

2. **In chat route** (after storing assistant message):
```typescript
// After storing assistant message N+1
Promise.resolve().then(async () => {
  try {
    // Get previous assistant message (has chunks)
    const previousAssistant = await getPreviousAssistantMessage(conversationId);
    if (!previousAssistant?.context?.chunks) return;
    
    // Check if message passes filters
    if (!shouldAnalyzeMessage(userMessage.content, isFirstMessage)) return;
    
    // Create batch key from chunk IDs
    const chunkIds = previousAssistant.context.chunks.map(c => c.chunkId).sort().join(',');
    const batchKey = `${conversationId}-${chunkIds}`;
    
    // Add to batch queue
    if (!pendingBatches.has(batchKey)) {
      pendingBatches.set(batchKey, {
        messages: [],
        chunks: previousAssistant.context.chunks,
        timestamp: Date.now()
      });
    }
    
    const batch = pendingBatches.get(batchKey)!;
    batch.messages.push({
      messageId: userMessage.id,
      content: userMessage.content,
      botResponse: previousAssistant.content
    });
    
    // If batch is full (e.g., 5 messages) or old enough, process immediately
    if (batch.messages.length >= 5 || Date.now() - batch.timestamp > 30000) {
      await processBatch(batchKey, batch);
      pendingBatches.delete(batchKey);
    }
  } catch (error) {
    console.error('Error batching sentiment:', error);
  }
});
```

**Benefits**:
- ✅ 1 API call per chunk (not per message)
- ✅ Only 30-second delay (vs 15 minutes)
- ✅ Still gets filtering benefits
- ✅ Automatic batching without cron jobs

#### Approach B: Simple Individual Analysis (Simpler Alternative)

#### 1. Create Sentiment Analysis Utility

**`lib/analysis/sentiment.ts`**:
```typescript
import OpenAI from 'openai';
import { env } from '@/lib/env';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// Simple acknowledgment patterns
const ACKNOWLEDGMENT_PATTERNS = [
  /^(thanks?|thank you|thx|ty)$/i,
  /^(ok|okay|k|got it|gotcha|sure|yep|nope|yes|no|cool|nice|perfect|awesome)$/i,
  /^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+$/u, // Emoji-only
];

export function shouldAnalyzeMessage(content: string, isFirstMessage: boolean): boolean {
  // Skip first messages
  if (isFirstMessage) return false;
  
  // Skip very short messages
  if (content.trim().length < 20) return false;
  
  // Skip simple acknowledgments
  const trimmed = content.trim().toLowerCase();
  if (ACKNOWLEDGMENT_PATTERNS.some(pattern => pattern.test(trimmed))) {
    return false;
  }
  
  return true;
}

export interface SentimentAnalysis {
  sentiment: {
    satisfaction: number; // 0.0-1.0
    confusion: number;    // 0.0-1.0
    frustration: number;  // 0.0-1.0
  };
  intent: 'question' | 'clarification' | 'followup' | 'gratitude' | 'complaint';
}export async function analyzeMessageSentiment(
  userMessage: string,
  botResponse: string
): Promise<SentimentAnalysis> {
  const prompt = `Analyze this user message's sentiment about the bot's response. Return ONLY valid JSON (no markdown, no explanation):

User message: "${userMessage}"
Bot response: "${botResponse}"

Return JSON:
{
  "sentiment": {
    "satisfaction": 0.0-1.0,
    "confusion": 0.0-1.0,
    "frustration": 0.0-1.0
  },
  "intent": "question" | "clarification" | "followup" | "gratitude" | "complaint"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a sentiment analysis tool. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from sentiment analysis');

  try {
    const parsed = JSON.parse(content);
    if (!parsed.sentiment || !parsed.intent) {
      throw new Error('Invalid sentiment analysis structure');
    }
    return parsed as SentimentAnalysis;
  } catch (error) {
    console.error('Failed to parse sentiment analysis:', { content, error });
    throw new Error('Invalid JSON response from sentiment analysis');
  }
}
```

#### 2. Add Sentiment Analysis to Chat Route

**In `app/api/chat/route.ts`** (after storing assistant message, around line 535):

```typescript
// After storing assistant message N+1
// Analyze sentiment of user message N+1 about chunks from assistant message N

// Fire-and-forget: Don't await, don't block user response
Promise.resolve().then(async () => {
  try {
    // Get previous assistant message to extract chunks
    const previousMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 2, // Current assistant + previous assistant
    });

    // Need at least 2 messages (current assistant + previous assistant)
    if (previousMessages.length < 2) return;
    
    const previousAssistantMessage = previousMessages[1]; // Second most recent
    if (previousAssistantMessage.role !== 'assistant') return;
    
    // Get chunks from previous assistant message
    const previousContext = previousAssistantMessage.context as { chunks?: any[] } | null;
    if (!previousContext?.chunks || previousContext.chunks.length === 0) return;
    
    // Get current user message (the one that triggered this response)
    const currentUserMessage = userMessage; // Already stored above
    
    // Apply smart filtering
    const isFirstMessage = previousMessages.length === 2; // Only 2 messages = first user message
    if (!shouldAnalyzeMessage(currentUserMessage.content, isFirstMessage)) {
      return; // Skip analysis
    }
    
    // Analyze sentiment
    const analysis = await analyzeMessageSentiment(
      currentUserMessage.content,
      previousAssistantMessage.content
    );
    
    // Attribute to chunks from previous assistant message
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    
    await Promise.allSettled(
      previousContext.chunks.map((chunk: any) => {
        const weight = chunk.relevanceScore || 1.0; // Use relevance score as weight
        
        return prisma.chunk_Performance.upsert({
          where: {
            chunkId_chatbotId_month_year: {
              chunkId: chunk.chunkId,
              chatbotId,
              month,
              year,
            },
          },
          create: {
            chunkId: chunk.chunkId,
            sourceId: chunk.sourceId,
            chatbotId,
            timesUsed: 0, // Already incremented above
            satisfactionSum: analysis.sentiment.satisfaction * weight,
            satisfactionCount: 1,
            confusionCount: analysis.sentiment.confusion > 0.6 ? 1 : 0,
            month,
            year,
          },
          update: {
            satisfactionSum: { increment: analysis.sentiment.satisfaction * weight },
            satisfactionCount: { increment: 1 },
            confusionCount: { increment: analysis.sentiment.confusion > 0.6 ? 1 : 0 },
          },
        });
      })
    );
  } catch (error) {
    // Log but don't fail - sentiment analysis is non-critical
    console.error('Error analyzing sentiment:', error);
  }
});
```

### Database Schema Updates

**Add sentiment fields to `Chunk_Performance`** (if not already present):
```prisma
model Chunk_Performance {
  // ... existing fields ...
  
  // Sentiment analysis fields
  satisfactionSum    Float @default(0)  // Sum for weighted averaging
  satisfactionCount Int   @default(0)   // Count for averaging
  confusionCount     Int   @default(0)  // Count of confused responses
}
```

**Note**: We can skip `Message_Analysis` and `Message_Analysis_Chunk_Attribution` tables entirely - we don't need to store individual analyses since we're aggregating directly.

### Cost Impact Estimates

**Current (Proposed)**:
- 100 messages/day × 1 API call = 100 calls/day
- Cost: ~$0.015/day (assuming ~100 tokens per call)

**Approach A: Filter + Immediate Batch**:
- 100 messages/day → 35 after filtering → ~7 chunks → **7 calls/day**
- Cost: ~$0.001/day
- **Savings: 93% reduction** (filtering + batching)

**Approach B: Filter + Individual**:
- 100 messages/day × 0.35 (after filtering) = **35 calls/day**
- Cost: ~$0.005/day
- **Savings: 65% reduction** (filtering only)

**Example with 10 messages responding to 2 chunks**:
- Current: 10 API calls
- Approach A: 2 API calls (after filtering: ~4 messages → 2 chunks)
- Approach B: ~4 API calls (after filtering)

### Additional Optimization: Sampling (Optional)

For very high-volume chatbots (>1000 messages/day), consider:
- Analyze every Nth message (e.g., every 3rd message)
- Or: Analyze messages > 50 chars with 100% probability, shorter messages with 50% probability
- Still statistically valid for aggregation

### Next Steps

1. ✅ **Create `lib/analysis/sentiment.ts`** with filtering + analysis functions
2. ✅ **Add sentiment analysis call** in `app/api/chat/route.ts` after assistant message storage
3. ✅ **Update `Chunk_Performance` schema** to add sentiment fields (if not already present)
4. ✅ **Remove async job complexity** - No need for `attribute-sentiment` job or `Message_Analysis` table
5. ✅ **Test with real conversations** to validate filtering accuracy

### Why Approach A is Better Than All Other Options

1. **Most efficient**: 1 API call per chunk (like Option 1) but only 30-second delay (vs 15 minutes)
2. **Still fast**: 30-second delay is acceptable for dashboard updates
3. **Cheapest**: 93% cost reduction (filtering + batching)
4. **Simpler than cron jobs**: In-memory queue vs separate job infrastructure
5. **More accurate**: Better context (analyzes right after response)

### When to Use Each Approach

**Use Approach A (Filter + Immediate Batch)** if:
- ✅ You want maximum efficiency (batching)
- ✅ 30-second delay is acceptable
- ✅ You're okay with slightly more complex code (~250 lines)

**Use Approach B (Filter + Individual)** if:
- ✅ You want simplest implementation (~150 lines)
- ✅ You need immediate feedback (no delay)
- ✅ You're okay with slightly higher cost (still 65% reduction)

### Recommendation

**For Alpha/MVP**: Use **Approach B** (Filter + Individual) - simpler, immediate, still 65% cost reduction

**For Production/Scale**: Use **Approach A** (Filter + Immediate Batch) - maximum efficiency, 93% cost reduction

Both approaches eliminate unnecessary complexity while providing better results at lower cost than the original proposal.