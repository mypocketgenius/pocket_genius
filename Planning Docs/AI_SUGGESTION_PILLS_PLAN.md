# AI-Generated Suggestion Pills Implementation Plan

## Overview

Replace static, seeded suggestion pills with dynamically AI-generated pills that are **personalized to each user's intake responses** and delivered seamlessly after intake completion.

**User Experience Flow:**
1. Existing intake gate logic determines whether intake questions appear
2. After intake completes (or immediately if no intake), welcome message appears as first chat message:
   - Configurable per-chatbot intro + rating CTA appended (e.g., "The Art of War is a classic ancient Chinese work... When our conversation is finished, leave me a rating...")
3. AI-generated personalized pills appear (first 3 visible, "Show More" reveals remaining 6)
4. If generation fails, fallback pills appear instead (3 per chatbot)

**Show More Integration:** The existing `SuggestionPills` component (`components/pills/suggestion-pills.tsx`) already implements Show More with `MAX_VISIBLE_PILLS = 3`. No changes needed—just pass the 9 pills and it handles the rest.

---

## Key Design Decisions

1. **Personalized pills** - Use chatbot context + user's intake responses to generate relevant questions
2. **Cache per conversation** - Store on Conversation model (not Chatbot) since pills are user-specific
3. **Generate during intake completion** - Trigger generation in the PATCH that marks intake complete
4. **Fallback pills on error** - Each chatbot has 3 fallback pills shown only if AI generation fails
5. **Welcome message from DB** - Configurable per-chatbot welcome message shown before pills

---

## Post-Intake Flow (Current vs New)

### Current Flow
```
1. Final hardcoded message: "When our conversation is finished, leave me a rating..."
2. PATCH /api/conversations/{id} → intakeCompleted: true
3. GET /api/pills → fetch static suggestion pills
4. Show pills below final message
5. 1-second delay → transition to chat mode
```

### New Flow
```
1. PATCH /api/conversations/{id} → intakeCompleted: true
   └─ Backend: Generate personalized pills using intake responses
   └─ Backend: Cache pills on Conversation
   └─ Backend: Return pills in response (or fallbacks on error)
2. Show welcome message from DB (chatbot.welcomeMessage) + rating CTA appended
3. Show AI-generated pills (or fallback pills if generation failed)
4. 1-second delay → transition to chat mode
```

---

## Files to Modify/Create

### 1. Prisma Schema: `prisma/schema.prisma`

Add fields to both Chatbot and Conversation models:

```prisma
model Chatbot {
  // ... existing fields ...

  // Welcome message shown after intake completion
  welcomeMessage           String?   // e.g., "The Art of War is a classic ancient Chinese work..."

  // Fallback pills shown if AI generation fails (3 per chatbot)
  fallbackSuggestionPills  Json?     // Array of 3 pill strings
}

model Conversation {
  // ... existing fields ...

  // AI-generated suggestion pills cache (personalized per user)
  suggestionPillsCache     Json?      // Cached array of pill strings
  suggestionPillsCachedAt  DateTime?  // When pills were last generated
}
```

### 2. Create: `lib/pills/openai-pills-generator.ts`

Shared utility for OpenAI JSON-mode pill generation (extracted from follow-up pills).

```typescript
export interface GeneratePillsBaseOptions {
  systemPrompt: string;
  userPrompt: string;
  contextId: string;
  contextType: 'conversation' | 'chatbot';
  responseKey?: string; // 'followUps' or 'suggestions'
  temperature?: number;
}

export async function generatePillsWithOpenAI(options: GeneratePillsBaseOptions): Promise<{
  pills: string[];
  generationTimeMs: number;
  error?: string;
}>

// Default configuration
const DEFAULT_MODEL = 'gpt-4o-mini'; // Cost-effective, sufficient for pill generation
const DEFAULT_TEMPERATURE = 0.7;    // Balanced: personalized but focused
```

### 3. Create: `lib/pills/generate-suggestion-pills.ts`

New module for personalized suggestion pill generation.

```typescript
export interface ChatbotContext {
  id: string;
  title: string;
  description: string | null;
  type: ChatbotType | null;
  creator: { name: string };
  sources: Array<{ title: string }>;
}

export interface IntakeContext {
  responses: Record<string, string>; // questionId → answer
  questions: Array<{ id: string; questionText: string }>;
}

export async function generateSuggestionPills(options: {
  chatbot: ChatbotContext;
  intake: IntakeContext;
  customPrompt?: string; // From configJson.suggestionPillsPrompt
}): Promise<{
  pills: string[];
  generationTimeMs: number;
  error?: string;
}>
```

**Prompt Design:**

System prompt:
```
You are a helpful assistant that generates personalized conversation starter questions for a chatbot. Generate questions that reflect both the chatbot's subject matter AND the user's specific context from their intake responses. Questions should be phrased as if the USER is asking the AI (e.g., "What does [author] say about...", "How can I apply...", "Explain...").
```

User prompt template:
```
A user has just completed intake for [type-specific context].

Chatbot: "[title]"
Description: [description]

User's Context (from intake):
[foreach question/response pair]
- Q: "[questionText]"
  A: "[response]"
[/foreach]

Based on this user's specific situation and interests, generate 9 personalized conversation starter questions. These questions should:
1. Be tailored to the user's stated context and goals
2. Be specific to the chatbot's subject matter
3. Be phrased as the user asking the AI
4. Be 10-25 words each, natural and conversational
5. Help the user get immediate value from this chatbot
6. Be ordered by quality, insight, and relevance to this specific user (best questions first)

Return ONLY a JSON object: {"suggestions": ["question 1", "question 2", ...]}

Note: The first 3 questions are shown initially; remaining 6 appear after "Show More" is clicked.
```

### 4. Modify: `lib/follow-up-pills/generate-pills.ts`

Refactor to use shared `generatePillsWithOpenAI` utility.

### 5. Modify: `app/api/conversations/[conversationId]/route.ts`

Update the PATCH handler to generate suggestion pills when intake completes:

```typescript
// In PATCH handler, after setting intakeCompleted: true

if (body.intakeCompleted === true) {
  // Fetch chatbot context and intake responses
  const chatbot = await prisma.chatbot.findUnique({
    where: { id: conversation.chatbotId },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      configJson: true,
      creator: { select: { name: true } },
      sources: { select: { title: true } },
    }
  });

  const intakeResponses = await prisma.intakeResponse.findMany({
    where: { conversationId },
    include: { question: { select: { id: true, questionText: true } } }
  });

  // Generate personalized pills
  const { pills, generationTimeMs, error } = await generateSuggestionPills({
    chatbot,
    intake: {
      responses: Object.fromEntries(
        intakeResponses.map(r => [r.questionId, r.responseText])
      ),
      questions: intakeResponses.map(r => ({
        id: r.question.id,
        questionText: r.question.questionText,
      })),
    },
    customPrompt: chatbot.configJson?.suggestionPillsPrompt,
  });

  // Determine which pills to return
  const finalPills = (pills.length > 0) ? pills : (chatbot.fallbackSuggestionPills || []);

  // Cache pills on conversation (non-blocking)
  if (pills.length > 0) {
    prisma.conversation.update({
      where: { id: conversationId },
      data: {
        suggestionPillsCache: pills,
        suggestionPillsCachedAt: new Date(),
      },
    }).catch(err => console.error('[suggestion-pills] Cache update failed:', err));
  }

  if (error) {
    console.error(`[suggestion-pills] Generation failed, using fallbacks:`, error);
  } else {
    console.log(`[suggestion-pills] Generated ${pills.length} pills in ${generationTimeMs}ms`);
  }

  // Return pills in response (AI-generated or fallbacks)
  return NextResponse.json({
    ...updatedConversation,
    suggestionPills: finalPills,
  });
}
```

### 6. Modify: `app/api/chatbots/[chatbotId]/welcome/route.ts`

Add welcome message, fallback pills, and **cached pills for returning users**:

```typescript
// Expand chatbot query
const chatbot = await prisma.chatbot.findUnique({
  where: { id: chatbotId },
  select: {
    // ... existing fields ...
    welcomeMessage: true,           // NEW
    fallbackSuggestionPills: true,  // NEW
  }
});

// Check for cached pills on the conversation (for returning users)
let cachedSuggestionPills: string[] | null = null;
if (conversation?.suggestionPillsCache) {
  const cacheAge = conversation.suggestionPillsCachedAt
    ? Date.now() - new Date(conversation.suggestionPillsCachedAt).getTime()
    : Infinity;
  const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  if (cacheAge < CACHE_TTL) {
    cachedSuggestionPills = conversation.suggestionPillsCache as string[];
  }
}

// In response:
return NextResponse.json({
  chatbotName: chatbot.title,
  chatbotPurpose,
  intakeCompleted,
  hasQuestions,
  questions,
  conversation,
  welcomeMessage: chatbot.welcomeMessage,                    // NEW
  fallbackSuggestionPills: chatbot.fallbackSuggestionPills,  // NEW
  cachedSuggestionPills,                                     // NEW - for returning users
});
```

**Note:** The welcome endpoint now returns cached pills for users who completed intake previously. The frontend should use `cachedSuggestionPills` if available, skipping the need to call PATCH again.

### 7. Modify: `hooks/use-intake-gate.ts`

Update WelcomeData interface:

```typescript
export interface WelcomeData {
  chatbotName: string;
  chatbotPurpose: string;
  intakeCompleted: boolean;
  hasQuestions: boolean;
  existingResponses?: Record<string, any>;
  questions?: IntakeQuestion[];
  conversation?: { intakeCompleted: boolean; hasMessages: boolean } | null;
  welcomeMessage?: string;              // NEW
  fallbackSuggestionPills?: string[];   // NEW
  cachedSuggestionPills?: string[];     // NEW - for returning users
}
```

### 8. Modify: `hooks/use-conversational-intake.ts`

**Existing state (no changes needed):**
```typescript
// These already exist at lines 90-91:
const [suggestionPills, setSuggestionPills] = useState<PillType[]>([]);
const [showPills, setShowPills] = useState(false);
```

Update the `showFinalMessage` function to use backend-generated pills:

```typescript
const showFinalMessage = async (convId: string | null) => {
  // Combine welcome message from DB with rating CTA
  const baseWelcome = welcomeData?.welcomeMessage ||
    "Let's get started! Feel free to ask any questions.";
  const ratingCTA = "When our conversation is finished, leave me a rating and you will get free messages for the next AI! Now let's get started...";
  const welcomeMsg = `${baseWelcome}\n\n${ratingCTA}`;

  await addMessage('assistant', welcomeMsg, convId);

  // Mark intake complete and get personalized pills (backend handles fallbacks)
  if (convId) {
    try {
      const response = await fetch(`/api/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeCompleted: true }),
      });

      const data = await response.json();

      // Backend returns AI pills or fallbacks - just display them
      if (data.suggestionPills?.length > 0) {
        setSuggestionPills(data.suggestionPills.map((text: string, i: number) => ({
          id: `suggestion-${i}`,
          pillType: 'suggested',
          label: text,
          prefillText: text,
          displayOrder: i,
          isActive: true,
        })));
        setShowPills(true);
      }
    } catch (err) {
      console.error('[intake] Failed to complete intake:', err);
    }
  }

  // Transition after 1 second
  setTimeout(() => onComplete(convId), 1000);
};
```

### 9. Modify: `components/chat.tsx`

No changes needed for loading indicator. Pills display section remains simple:

```typescript
// In the pills display section, after intake completion:

{intakeHook?.showPills && intakeSuggestionPills.length > 0 && (
  <SuggestionPills
    pills={intakeSuggestionPills}
    onPillClick={handlePillClick}
  />
)}
```

---

## Implementation Sequence

1. **Prisma migration** - Add `welcomeMessage`, `fallbackSuggestionPills` to Chatbot; add `suggestionPillsCache`, `suggestionPillsCachedAt` to Conversation
2. **Create shared utility** (`lib/pills/openai-pills-generator.ts`)
3. **Create suggestion generator** (`lib/pills/generate-suggestion-pills.ts`)
4. **Update welcome endpoint** - Return `welcomeMessage`, `fallbackSuggestionPills`, and `cachedSuggestionPills`
5. **Update conversation PATCH** - Generate personalized pills on intake completion (return fallbacks on error)
6. **Update hooks** - `use-intake-gate.ts` and `use-conversational-intake.ts`
7. **Update chat.tsx** - Consume pills from intake hook (Show More already handled by `SuggestionPills` component)
8. **Add seed data** - Populate welcome messages and fallback pills per chatbot via admin or migration
9. **Test end-to-end**

**Out of scope (follow-up task):** Refactor `lib/follow-up-pills/generate-pills.ts` to use shared utility. The feature works independently without this refactor.

---

## Detailed Implementation Steps

### Step 1: Prisma Schema Migration

1. Open `prisma/schema.prisma`
2. Add to `Chatbot` model:
   ```prisma
   welcomeMessage           String?
   fallbackSuggestionPills  Json?
   ```
3. Add to `Conversation` model:
   ```prisma
   suggestionPillsCache     Json?
   suggestionPillsCachedAt  DateTime?
   ```
4. Run `npx prisma migrate dev --name add_suggestion_pills_fields`
5. Run `npx prisma generate`

### Step 2: Create Shared OpenAI Utility

1. Create file `lib/pills/openai-pills-generator.ts`
2. Implement `GeneratePillsBaseOptions` interface with fields: `systemPrompt`, `userPrompt`, `contextId`, `contextType`, `responseKey`, `temperature`
3. Implement `generatePillsWithOpenAI()` function that:
   - Initializes OpenAI client using `env.OPENAI_API_KEY`
   - Calls `openai.chat.completions.create()` with model `gpt-4o-mini`, `response_format: { type: 'json_object' }`, and provided temperature (default `0.7`)
   - Parses JSON response using the `responseKey` parameter
   - Returns `{ pills: string[], generationTimeMs: number, error?: string }`
   - Wraps in try/catch with proper error logging

### Step 3: Create Suggestion Pills Generator

1. Create file `lib/pills/generate-suggestion-pills.ts`
2. Define interfaces: `ChatbotContext`, `IntakeContext` (as shown in plan section 3)
3. Define system prompt constant (as shown in plan)
4. Implement `generateSuggestionPills()` function that:
   - Builds user prompt from chatbot context + intake Q&A pairs
   - Includes instruction to order questions by quality/relevance
   - Calls `generatePillsWithOpenAI()` with `responseKey: 'suggestions'`
   - Returns result directly

### Step 4: Update Welcome Endpoint

1. Open `app/api/chatbots/[chatbotId]/welcome/route.ts`
2. Add `welcomeMessage` and `fallbackSuggestionPills` to the Prisma select query
3. Add `suggestionPillsCache` and `suggestionPillsCachedAt` to the conversation select query
4. Add cache TTL check logic (7 days) to validate cached pills
5. Add `welcomeMessage`, `fallbackSuggestionPills`, and `cachedSuggestionPills` to the JSON response

### Step 5: Update Conversation PATCH Handler

1. Open `app/api/conversations/[conversationId]/route.ts`
2. Import `generateSuggestionPills` from `lib/pills/generate-suggestion-pills`
3. In the PATCH handler, add logic when `body.intakeCompleted === true`:
   - Fetch chatbot with `id`, `title`, `description`, `type`, `configJson`, `fallbackSuggestionPills`, `creator.name`, `sources.title`
   - Fetch intake responses with `questionId`, `responseText`, and `question.questionText`
   - Call `generateSuggestionPills()` with chatbot and intake context
   - If `error` or `pills.length === 0`, use `chatbot.fallbackSuggestionPills` instead
   - If pills generated successfully, fire-and-forget cache update to `Conversation`
   - Return `{ ...updatedConversation, suggestionPills: finalPills }`

### Step 6: Update use-intake-gate Hook

1. Open `hooks/use-intake-gate.ts`
2. Add to `WelcomeData` interface:
   ```typescript
   welcomeMessage?: string;
   fallbackSuggestionPills?: string[];
   cachedSuggestionPills?: string[];
   ```

### Step 7: Update use-conversational-intake Hook

1. Open `hooks/use-conversational-intake.ts`
2. Accept `welcomeData` as a new parameter (or access via context)
3. Modify `showFinalMessage` function:
   - Build welcome message: `welcomeData.welcomeMessage + "\n\n" + ratingCTA`
   - Change PATCH call to `await fetch()` and capture response
   - Parse `data.suggestionPills` from response
   - Map pills to `PillType[]` format with `id`, `pillType: 'suggested'`, `label`, `prefillText`, `displayOrder`, `isActive`
   - Call `setSuggestionPills()` and `setShowPills(true)`
   - Remove old `GET /api/pills` fetch logic

### Step 8: Update chat.tsx (if needed)

1. Open `components/chat.tsx`
2. Verify `SuggestionPills` component is used for intake pills
3. The component already handles Show More at 3 pills—no changes needed

### Step 9: Add Seed Data

1. Create migration or admin script to populate:
   - `welcomeMessage` for each chatbot (e.g., "The Art of War is a classic ancient Chinese work...")
   - `fallbackSuggestionPills` as JSON array of 3 fallback questions per chatbot

### Step 10: Test End-to-End

1. Start fresh conversation with a chatbot that has intake questions
2. Complete all intake questions
3. Verify: Combined welcome message appears (DB intro + rating CTA)
4. Verify: 3 AI-generated pills appear, ordered by relevance
5. Click "Show More" → verify remaining 6 pills appear
6. Refresh page → verify pills load from cache
7. Test error case: Temporarily break OpenAI call → verify fallback pills appear

---

## Configuration Options

Add to `configJson` for per-chatbot customization:

```typescript
interface ChatbotConfigJson {
  // Existing
  enableFollowUpPills?: boolean;
  followUpPillsPrompt?: string;

  // New
  enableSuggestionPills?: boolean;   // Default: true
  suggestionPillsPrompt?: string;    // Custom prompt override
}
```

---

## Cache Invalidation

**When to invalidate `suggestionPillsCache` on Conversation:**
- When intake responses are edited (if feature exists)
- Manual cache clear via admin

**TTL:** 7 days (pills are personalized, so no need to regenerate unless context changes)

```typescript
const SUGGESTION_PILLS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// Check cache validity
const isCacheValid = conversation.suggestionPillsCachedAt &&
  Date.now() - new Date(conversation.suggestionPillsCachedAt).getTime() < SUGGESTION_PILLS_CACHE_TTL;
```

---

## Error Handling

**If AI generation fails:**
1. Log error with context
2. Return fallback pills from chatbot instead
3. User sees fallback pills, unaware of the error

```typescript
// In PATCH handler
if (error || pills.length === 0) {
  console.error(`[suggestion-pills] Generation failed for conversation ${conversationId}:`, error);
  // Return fallback pills instead
  const fallbackPills = chatbot.fallbackSuggestionPills || [];
  return NextResponse.json({
    ...updatedConversation,
    suggestionPills: fallbackPills,
  });
}

return NextResponse.json({
  ...updatedConversation,
  suggestionPills: pills,
});
```

---

## Verification Checklist

- [ ] Complete intake → welcome message appears as first chat message (DB intro + rating CTA appended)
- [ ] Welcome message uses `chatbot.welcomeMessage` from database (not hardcoded)
- [ ] AI-generated pills appear after welcome message (first 3 visible)
- [ ] Pills are ordered by quality/relevance (best questions first)
- [ ] Click "Show More" → remaining 6 pills appear
- [ ] Click "Show Less" → collapses back to 3 pills
- [ ] Database: `Conversation.suggestionPillsCache` is populated with 9 pills
- [ ] Reload page → pills load from cache via `cachedSuggestionPills` (fast, no PATCH needed)
- [ ] AI generation failure → 3 fallback pills shown instead, no error visible to user
- [ ] Different chatbot types generate contextually relevant pills
- [ ] Pills reference user's intake responses in their phrasing
