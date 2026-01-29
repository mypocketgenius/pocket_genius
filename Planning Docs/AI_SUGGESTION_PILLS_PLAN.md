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

Minimal shared utility for OpenAI JSON-mode pill generation. Handles only the common mechanics—each pill generator builds its own prompts and context.

```typescript
export interface GeneratePillsOptions {
  systemPrompt: string;
  userPrompt: string;
  contextMessage: string;  // The content to analyze (assistant response or chatbot+intake context)
  responseKey: string;     // 'followUps' or 'suggestions'
}

export async function generatePillsWithOpenAI(options: GeneratePillsOptions): Promise<{
  pills: string[];
  generationTimeMs: number;
  error?: string;
}>

// Shared configuration (used by both follow-up and suggestion pills)
const MODEL = 'gpt-4o-mini';    // Cost-effective, sufficient for pill generation
const TEMPERATURE = 0.7;        // Balanced: personalized but focused
const PILL_COUNT = 9;           // Generate 9 pills (first 3 visible, rest via "Show More")
```

**What this utility handles:**
- OpenAI client initialization
- JSON-mode API call with consistent model/temperature
- Response parsing with the provided `responseKey`
- Timing measurement
- Error handling and logging

**What each pill generator handles:**
- Building domain-specific system prompts
- Building domain-specific user prompts
- Assembling context from their specific inputs (assistant response vs chatbot+intake)

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

### 4. Refactor: `lib/follow-up-pills/generate-pills.ts`

Refactor existing follow-up pills to use the shared `generatePillsWithOpenAI` utility:

```typescript
import { generatePillsWithOpenAI } from '@/lib/pills/openai-pills-generator';

// Keep existing interfaces and prompts (DEFAULT_PILLS_PROMPT, PILLS_SYSTEM_PROMPT)

export async function generateFollowUpPills(options: GeneratePillsOptions): Promise<GeneratePillsResult> {
  const { assistantResponse, configJson, intakeResponses } = options;

  // Check if feature is disabled (existing logic)
  if (configJson?.enableFollowUpPills === false) {
    return { pills: [], generationTimeMs: 0 };
  }

  // Build context message (existing logic)
  let contextMessage = assistantResponse;
  if (intakeResponses?.length > 0) {
    const intakeContext = intakeResponses
      .map(({ question, answer }) => `Q: ${question}\nA: ${answer}`)
      .join('\n\n');
    contextMessage = `User's Intake Responses:\n${intakeContext}\n\n---\n\nAssistant's Response:\n${assistantResponse}`;
  }

  // Use shared utility
  return generatePillsWithOpenAI({
    systemPrompt: PILLS_SYSTEM_PROMPT,
    userPrompt: configJson?.followUpPillsPrompt || DEFAULT_PILLS_PROMPT,
    contextMessage,
    responseKey: 'followUps',
  });
}
```

**Benefits of this refactor:**
- Single source of truth for model, temperature, and error handling
- Follow-up pills now generate 9 pills (matching suggestion pills)
- Consistent behavior across both pill types

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

1. ✅ **Prisma migration** - Add `welcomeMessage`, `fallbackSuggestionPills` to Chatbot; add `suggestionPillsCache`, `suggestionPillsCachedAt` to Conversation
2. ✅ **Create shared utility** (`lib/pills/openai-pills-generator.ts`) - Minimal utility for OpenAI JSON-mode calls
3. ✅ **Refactor follow-up pills** (`lib/follow-up-pills/generate-pills.ts`) - Use shared utility, update to 9 pills
4. ✅ **Create suggestion generator** (`lib/pills/generate-suggestion-pills.ts`) - Uses shared utility
5. ✅ **Update welcome endpoint** - Return `welcomeMessage`, `fallbackSuggestionPills`, and `cachedSuggestionPills`
6. ✅ **Update conversation PATCH** - Generate personalized pills on intake completion (return fallbacks on error)
7. ✅ **Update hooks** - `use-intake-gate.ts` and `use-conversational-intake.ts`
8. ✅ **Update chat.tsx** - Consume pills from intake hook (Show More already handled by `SuggestionPills` component)
9. ✅ **Remove old pills fetch** - Stop loading suggestion pills from `/api/pills` in chat.tsx
10. ✅ **Use cached pills for returning users** - Display `cachedSuggestionPills` from welcome data instead of old DB pills
11. ✅ **Replace initialSuggestionPills displays** - Update all display locations to use AI-generated pills
12. **Add seed data** - Populate welcome messages and fallback pills per chatbot via admin or migration
13. **Test end-to-end**

---

## Detailed Implementation Steps

### Step 1: Prisma Schema Migration ✅ COMPLETED

**Implemented:** Added fields to `prisma/schema.prisma`:
- `Chatbot` model: `welcomeMessage String?`, `fallbackSuggestionPills Json?`
- `Conversation` model: `suggestionPillsCache Json?`, `suggestionPillsCachedAt DateTime?`

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

### Step 2: Create Shared OpenAI Utility ✅ COMPLETED

**Implemented:** Created `lib/pills/openai-pills-generator.ts` with:
- Shared constants: `MODEL = 'gpt-4o-mini'`, `TEMPERATURE = 0.7`, `PILL_COUNT = 9` (exported)
- `GeneratePillsOptions` interface with `systemPrompt`, `userPrompt`, `contextMessage`, `responseKey`
- `GeneratePillsResult` interface with `pills`, `generationTimeMs`, `error?`
- `generatePillsWithOpenAI()` function that handles OpenAI client, JSON mode, timing, parsing, and error logging

1. Create file `lib/pills/openai-pills-generator.ts`
2. Define shared constants:
   ```typescript
   const MODEL = 'gpt-4o-mini';
   const TEMPERATURE = 0.7;
   const PILL_COUNT = 9;
   ```
3. Implement `GeneratePillsOptions` interface:
   ```typescript
   export interface GeneratePillsOptions {
     systemPrompt: string;
     userPrompt: string;
     contextMessage: string;
     responseKey: string;
   }
   ```
4. Implement `generatePillsWithOpenAI()` function that:
   - Initializes OpenAI client using `env.OPENAI_API_KEY`
   - Records start time for timing measurement
   - Calls `openai.chat.completions.create()` with:
     - `model: MODEL`
     - `response_format: { type: 'json_object' }`
     - `temperature: TEMPERATURE`
     - Messages: system prompt, context as assistant message, user prompt as user message
   - Parses JSON response using the `responseKey` parameter
   - Returns `{ pills: string[], generationTimeMs: number, error?: string }`
   - Wraps in try/catch with error logging

### Step 3: Refactor Follow-Up Pills ✅ COMPLETED

**Implemented:** Refactored `lib/follow-up-pills/generate-pills.ts` to:
- Import and use `generatePillsWithOpenAI` from shared utility
- Removed local OpenAI client initialization and direct API call
- Updated `DEFAULT_PILLS_PROMPT` to request 9 pills (uses `PILL_COUNT` constant)
- Added instruction to order questions by quality/relevance with "Show More" note
- Simplified function by delegating timing/error handling to shared utility
- Re-exported `GeneratePillsResult` for backward compatibility

1. Open `lib/follow-up-pills/generate-pills.ts`
2. Import `generatePillsWithOpenAI` from `@/lib/pills/openai-pills-generator`
3. Remove local OpenAI client initialization (lines 13-15)
4. Keep existing prompts (`DEFAULT_PILLS_PROMPT`, `PILLS_SYSTEM_PROMPT`)
5. Keep existing context building logic (intake responses formatting)
6. Replace the `openai.chat.completions.create()` call with:
   ```typescript
   return generatePillsWithOpenAI({
     systemPrompt: PILLS_SYSTEM_PROMPT,
     userPrompt: customPillsPrompt || DEFAULT_PILLS_PROMPT,
     contextMessage,
     responseKey: 'followUps',
   });
   ```
7. Remove local timing and error handling (now in shared utility)
8. Update `DEFAULT_PILLS_PROMPT` to request 9 pills instead of 7

### Step 4: Create Suggestion Pills Generator ✅ COMPLETED

**Implemented:** Created `lib/pills/generate-suggestion-pills.ts` with:
- `ChatbotContext` interface: id, title, description, type, creator, sources
- `IntakeContext` interface: responses (Record<string, string>), questions array
- `GenerateSuggestionPillsOptions` interface for function input
- `SUGGESTION_SYSTEM_PROMPT` constant for personalized pill generation
- `getTypeContext()` helper: returns type-specific descriptions (BODY_OF_WORK, FRAMEWORK, DEEP_DIVE, ADVISOR_BOARD)
- `buildUserPrompt()` helper: constructs detailed prompt with chatbot metadata, sources, and intake Q&A pairs
- `generateSuggestionPills()` function: uses shared utility with `responseKey: 'suggestions'`
- Supports custom prompt override via `customPrompt` option

1. Create file `lib/pills/generate-suggestion-pills.ts`
2. Import `generatePillsWithOpenAI` from `./openai-pills-generator`
3. Define interfaces: `ChatbotContext`, `IntakeContext` (as shown in plan section 3)
4. Define `SUGGESTION_SYSTEM_PROMPT` constant
5. Implement `generateSuggestionPills()` function that:
   - Builds `contextMessage` from chatbot metadata (title, description, type)
   - Builds `userPrompt` incorporating intake Q&A pairs
   - Includes instruction to order questions by quality/relevance
   - Calls `generatePillsWithOpenAI()` with `responseKey: 'suggestions'`
   - Returns result directly

### Step 5: Update Welcome Endpoint ✅ COMPLETED

**Implemented:** Updated `app/api/chatbots/[chatbotId]/welcome/route.ts` with:
- Added `SUGGESTION_PILLS_CACHE_TTL` constant (7 days in milliseconds)
- Updated chatbot Prisma select query to include `welcomeMessage` and `fallbackSuggestionPills`
- Updated conversation select query to include `suggestionPillsCache` and `suggestionPillsCachedAt`
- Added cache validation logic (Step 8) that checks if cached pills exist and are within TTL
- Updated JSON response to include `welcomeMessage`, `fallbackSuggestionPills`, and `cachedSuggestionPills`
- Updated JSDoc to document the new response fields

1. Open `app/api/chatbots/[chatbotId]/welcome/route.ts`
2. Add `welcomeMessage` and `fallbackSuggestionPills` to the Prisma select query
3. Add `suggestionPillsCache` and `suggestionPillsCachedAt` to the conversation select query
4. Add cache TTL check logic (7 days) to validate cached pills
5. Add `welcomeMessage`, `fallbackSuggestionPills`, and `cachedSuggestionPills` to the JSON response

### Step 6: Update Conversation PATCH Handler ✅ COMPLETED

**Implemented:** Updated `app/api/conversations/[conversationId]/route.ts` with:
- Imported `generateSuggestionPills` and `ChatbotType`
- Updated conversation query to include `chatbotId` for pill generation
- Added pill generation logic when `intakeCompleted === true` and user is authenticated:
  - Fetches chatbot with full context (id, title, description, type, configJson, fallbackSuggestionPills, creator, sources)
  - Fetches intake responses from `Intake_Response` with included `intakeQuestion` relation
  - Builds intake context with responses map and questions array
  - Supports custom prompt override from `configJson.suggestionPillsPrompt`
  - Calls `generateSuggestionPills()` with chatbot and intake context
  - On success: returns AI pills, logs generation time, caches pills (fire-and-forget)
  - On failure/empty: uses `fallbackSuggestionPills` from chatbot
  - Wrapped in try/catch to not fail entire request if pill generation errors
- Updated response to include optional `suggestionPills` array
- Updated JSDoc to document new response format

1. Open `app/api/conversations/[conversationId]/route.ts`
2. Import `generateSuggestionPills` from `lib/pills/generate-suggestion-pills`
3. In the PATCH handler, add logic when `body.intakeCompleted === true`:
   - Fetch chatbot with `id`, `title`, `description`, `type`, `configJson`, `fallbackSuggestionPills`, `creator.name`, `sources.title`
   - Fetch intake responses with `questionId`, `responseText`, and `question.questionText`
   - Call `generateSuggestionPills()` with chatbot and intake context
   - If `error` or `pills.length === 0`, use `chatbot.fallbackSuggestionPills` instead
   - If pills generated successfully, fire-and-forget cache update to `Conversation`
   - Return `{ ...updatedConversation, suggestionPills: finalPills }`

### Step 7: Update use-intake-gate Hook ✅ COMPLETED

**Implemented:** Updated `hooks/use-intake-gate.ts`:
- Added `welcomeMessage?: string` to WelcomeData interface
- Added `fallbackSuggestionPills?: string[]` to WelcomeData interface
- Added `cachedSuggestionPills?: string[]` to WelcomeData interface

1. Open `hooks/use-intake-gate.ts`
2. Add to `WelcomeData` interface:
   ```typescript
   welcomeMessage?: string;
   fallbackSuggestionPills?: string[];
   cachedSuggestionPills?: string[];
   ```

### Step 8: Update use-conversational-intake Hook ✅ COMPLETED

**Implemented:** Updated `hooks/use-conversational-intake.ts`:
- Added `welcomeMessage?: string` parameter to hook function signature
- Updated JSDoc to document the new parameter
- Rewrote `showFinalMessage` function to:
  - Build welcome message using chatbot's `welcomeMessage` with default fallback
  - Append rating CTA to the welcome message
  - Changed PATCH call to `await fetch()` to capture response
  - Parse `data.suggestionPills` from response
  - Map pills to `PillType[]` format with proper structure
  - Removed old `GET /api/pills` fetch logic
  - Always transitions after 1 second (moved outside try/catch)

**Also updated:** `components/chat.tsx`:
- Updated `useConversationalIntake` call to pass `welcomeMessage` parameter from `intakeGate.welcomeData`

1. Open `hooks/use-conversational-intake.ts`
2. Accept `welcomeData` as a new parameter (or access via context)
3. Modify `showFinalMessage` function:
   - Build welcome message: `welcomeData.welcomeMessage + "\n\n" + ratingCTA`
   - Change PATCH call to `await fetch()` and capture response
   - Parse `data.suggestionPills` from response
   - Map pills to `PillType[]` format with `id`, `pillType: 'suggested'`, `label`, `prefillText`, `displayOrder`, `isActive`
   - Call `setSuggestionPills()` and `setShowPills(true)`
   - Remove old `GET /api/pills` fetch logic

### Step 9: Remove Old Pills Fetch from chat.tsx ✅ COMPLETED

**Problem:** The `useEffect` at lines 389-412 in `chat.tsx` still fetches pills from `GET /api/pills?chatbotId=...` when `gateState` changes to 'chat'. This loads old database pills (from the `Pill` table) into `initialSuggestionPills`, overriding the new AI-generated pills system.

**Solution:** Modify the pills fetch to only load system pills (feedback + expansion), NOT suggestion pills. The suggestion pills should come exclusively from:
- Fresh intake completion → AI-generated pills via PATCH response
- Returning users → `cachedSuggestionPills` from welcome data

1. Open `components/chat.tsx`
2. Locate the `useEffect` that fetches `/api/pills` (lines 389-412)
3. Keep the fetch for system pills (feedback, expansion) but remove the suggestion pills logic:
   ```typescript
   // Remove or comment out:
   const suggestedPills = loadedPills.filter((p: PillType) => p.pillType === 'suggested');
   setInitialSuggestionPills(suggestedPills);
   ```
4. The `pills` state can still hold feedback/expansion pills for other uses
5. Remove the `initialSuggestionPills` state variable entirely - it's no longer needed since all suggestion pills flow through `intakeSuggestionPills`

**Implemented:**
- Modified the pills fetch useEffect to filter OUT suggestion pills: `loadedPills.filter((p: PillType) => p.pillType !== 'suggested')`
- Removed the `setInitialSuggestionPills(suggestedPills)` call entirely
- Added comments explaining that suggestion pills now come from AI generation (PATCH response or cached)
- The `initialSuggestionPills` state variable remains (always empty `[]`) - will be removed in step 11 when displays are updated

### Step 10: Use Cached Pills for Returning Users ✅ COMPLETED

**Problem:** The welcome endpoint returns `cachedSuggestionPills` for returning users, but this data is never used in the frontend. Instead, `initialSuggestionPills` (from old DB) is displayed.

**Solution:** When a returning user loads the chat (intake already completed, has cached pills), populate `intakeSuggestionPills` from `cachedSuggestionPills` in welcome data.

1. Open `components/chat.tsx`
2. Add a new `useEffect` that checks for cached pills when welcome data loads:
   ```typescript
   // Load cached suggestion pills for returning users
   useEffect(() => {
     if (
       intakeGate.gateState === 'chat' &&
       intakeGate.welcomeData?.cachedSuggestionPills?.length > 0 &&
       intakeSuggestionPills.length === 0 // Don't override if already set
     ) {
       const cachedPills = intakeGate.welcomeData.cachedSuggestionPills;
       const mappedPills: PillType[] = cachedPills.map((text, index) => ({
         id: `suggestion-${index}`,
         pillType: 'suggested' as const,
         label: text,
         prefillText: text,
         displayOrder: index,
         isActive: true,
       }));
       setIntakeSuggestionPills(mappedPills);
     }
   }, [intakeGate.gateState, intakeGate.welcomeData?.cachedSuggestionPills]);
   ```
3. This ensures returning users see their cached AI pills, not old DB pills

**Implemented:**
- Added new `useEffect` after the intake hook pills sync effect (around line 1080)
- Checks conditions: `gateState === 'chat'`, cached pills exist, and `intakeSuggestionPills` is empty (to avoid overriding fresh intake pills)
- Maps cached pill strings to `PillType[]` format with proper structure (id, pillType, label, prefillText, displayOrder, isActive)
- Added `intakeSuggestionPills.length` to dependency array to ensure proper reactivity

### Step 11: Replace initialSuggestionPills Displays ✅ COMPLETED

**Problem:** There are two display locations using `initialSuggestionPills` (old DB pills):
- Line 1243-1249: Empty state for returning users
- Line 1325-1329: Above first user message

**Solution:** Replace these displays to use `intakeSuggestionPills` instead, which now contains either:
- Fresh AI-generated pills (from intake completion PATCH)
- Cached AI pills (from welcome data for returning users)

1. Open `components/chat.tsx`
2. At line 1243-1249 (empty state display), change:
   ```typescript
   // FROM:
   {initialSuggestionPills.length > 0 && (
     <SuggestionPills
       pills={initialSuggestionPills}
       ...
     />
   )}

   // TO:
   {intakeSuggestionPills.length > 0 && (
     <SuggestionPills
       pills={intakeSuggestionPills}
       ...
     />
   )}
   ```
3. At line 1325-1329 (above first user message), change similarly:
   ```typescript
   // FROM:
   {isFirstUserMessage && initialSuggestionPills.length > 0 && (
     <SuggestionPills
       pills={initialSuggestionPills}
       ...
     />
   )}

   // TO:
   {isFirstUserMessage && intakeSuggestionPills.length > 0 && (
     <SuggestionPills
       pills={intakeSuggestionPills}
       ...
     />
   )}
   ```
4. Consider removing the `initialSuggestionPills` state entirely if no longer needed
5. Verify the display at line 1448-1454 (after final intake message) still works correctly

**Implemented:**
- Removed `initialSuggestionPills` state variable entirely (was at line 96)
- Updated comment for `intakeSuggestionPills` to reflect its unified role as the single source for all suggestion pills
- Replaced `initialSuggestionPills` → `intakeSuggestionPills` at empty state display (beneath "Edit Your Context" button)
- Replaced `initialSuggestionPills` → `intakeSuggestionPills` at "above first user message" display
- Verified third display location (after final intake message) already used `intakeSuggestionPills`
- Confirmed no remaining references to `initialSuggestionPills` in the codebase

### Step 12: Add Seed Data

1. Create migration or admin script to populate:
   - `welcomeMessage` for each chatbot (e.g., "The Art of War is a classic ancient Chinese work...")
   - `fallbackSuggestionPills` as JSON array of 3 fallback questions per chatbot

### Step 13: Test End-to-End

1. **Fresh intake flow:**
   - Start fresh conversation with a chatbot that has intake questions
   - Complete all intake questions
   - Verify: Combined welcome message appears (DB intro + rating CTA)
   - Verify: 3 AI-generated pills appear, ordered by relevance
   - Click "Show More" → verify remaining 6 pills appear

2. **Returning user flow:**
   - Refresh page after completing intake
   - Verify: Pills load from `cachedSuggestionPills` (fast, no PATCH needed)
   - Verify: These are the SAME AI-generated pills, not old DB pills

3. **Error handling:**
   - Test error case: Temporarily break OpenAI call → verify fallback pills appear

4. **Verify old pills removed:**
   - Confirm no suggestion pills from `Pill` table are displayed
   - Only AI-generated (or fallback) pills should appear

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

### Fresh Intake Flow
- [ ] Complete intake → welcome message appears as first chat message (DB intro + rating CTA appended)
- [ ] Welcome message uses `chatbot.welcomeMessage` from database (not hardcoded)
- [ ] AI-generated pills appear after welcome message (first 3 visible)
- [ ] Pills are ordered by quality/relevance (best questions first)
- [ ] Click "Show More" → remaining 6 pills appear
- [ ] Click "Show Less" → collapses back to 3 pills
- [ ] Database: `Conversation.suggestionPillsCache` is populated with 9 pills
- [ ] Pills reference user's intake responses in their phrasing

### Returning User Flow
- [ ] Reload page → pills load from cache via `cachedSuggestionPills` (fast, no PATCH needed)
- [ ] Cached pills are displayed in `intakeSuggestionPills`, NOT from old `Pill` table
- [ ] Empty state (no messages) shows AI pills, not old DB pills
- [ ] Pills persist correctly across page refreshes

### Error Handling
- [ ] AI generation failure → fallback pills shown instead, no error visible to user
- [ ] Different chatbot types generate contextually relevant pills

### Old System Removal
- [ ] `/api/pills` no longer returns suggestion pills for the chatbot (only feedback/expansion)
- [ ] `initialSuggestionPills` state is no longer populated with old DB pills
- [ ] No suggestion pills from `Pill` database table are displayed anywhere
- [ ] All suggestion pill displays use `intakeSuggestionPills` state

---

## Phase 2: Async Pill Loading with Skeleton UI

### Problem Statement

The current implementation blocks the entire chat screen while AI-generated suggestion pills are loading. When a returning user (intake completed, no cached pills) visits the chat page:

1. `useIntakeGate` fetches `/api/chatbots/[chatbotId]/welcome`
2. **Welcome API blocks waiting for AI pill generation** (lines 222-303 in `welcome/route.ts`)
3. User sees loading spinner until pills are ready
4. Only then does the chat screen appear

This creates a poor user experience - the main content is delayed for a secondary feature.

### Solution: Separate Pill Loading with Skeleton UI

Decouple pill loading from the welcome API so the screen appears immediately, with a skeleton placeholder for pills that populates when ready.

**User Experience (After):**
1. User navigates to chat
2. Screen appears immediately with welcome message
3. Skeleton pills animate **after the welcome message** (only location)
4. Pills fade in when loaded (typically 1-2 seconds)

**Key Design Decision:** Skeleton only appears in ONE location - after the welcome message. The other pill display locations (empty state, above first user message) don't show skeletons because:
- They only render when `intakeSuggestionPills.length > 0`
- By the time these render, pills are already loaded
- This prevents skeleton flicker in multiple places

---

### Implementation Steps

#### Step 14: Remove Blocking Pill Generation from Welcome API ✅ COMPLETED

**File:** `app/api/chatbots/[chatbotId]/welcome/route.ts`

**Changes:**
1. Remove the entire blocking pill generation block (lines 222-303)
2. Keep returning `cachedSuggestionPills` if available (this is already fast - just a DB read)
3. Keep returning `fallbackSuggestionPills` (also just a DB read)
4. Remove `generatedSuggestionPills` from response - this will come from the new endpoint

**Before:**
```typescript
// Step 9: Generate AI pills for returning users (BLOCKING - 1-3 seconds)
let generatedSuggestionPills: string[] | undefined = undefined;
if (intakeCompleted && !cachedSuggestionPills && dbUserId) {
  // ... 80 lines of blocking AI generation ...
}
```

**After:**
```typescript
// Removed: AI pill generation moved to dedicated async endpoint
// Pills are now fetched separately after screen loads
```

**Also remove from response object (line ~332):**
```typescript
// DELETE this line:
generatedSuggestionPills,
```

**Implemented:** Removed the entire blocking pill generation block (~80 lines) from welcome/route.ts. The API no longer blocks on AI pill generation - it only returns fast DB reads (`cachedSuggestionPills`, `fallbackSuggestionPills`). AI pill generation will be handled by a dedicated async endpoint in Step 15.

---

#### Step 14.5: Update WelcomeData Interface ✅ COMPLETED

**File:** `hooks/use-intake-gate.ts`

**Changes:** Remove `generatedSuggestionPills` from the interface since it's no longer returned by the welcome API.

```typescript
export interface WelcomeData {
  chatbotName: string;
  chatbotPurpose: string;
  intakeCompleted: boolean;
  hasQuestions: boolean;
  existingResponses?: Record<string, any>;
  questions?: IntakeQuestion[];
  conversation?: { intakeCompleted: boolean; hasMessages: boolean } | null;
  welcomeMessage?: string;
  fallbackSuggestionPills?: string[];
  cachedSuggestionPills?: string[];
  // REMOVED: generatedSuggestionPills - now fetched async from dedicated endpoint
}
```

**Implemented:** Removed `generatedSuggestionPills` from WelcomeData interface in use-intake-gate.ts. Also updated the Step 10 useEffect in chat.tsx to remove references to `generatedSuggestionPills`, simplifying the priority logic from `cached > generated > fallback` to `cached > fallback`. Added explanatory comments noting that async pill generation will be implemented in Steps 15-17.

---

#### Step 15: Create Suggestion Pills API Endpoint ✅ COMPLETED

**File:** `app/api/chatbots/[chatbotId]/suggestion-pills/route.ts` (NEW)

**Purpose:** Dedicated endpoint for fetching/generating suggestion pills. Called after screen loads.

**Behavior:**
1. Check for cached pills on conversation → return immediately if valid
2. If no cache, generate pills using `generateSuggestionPills()`
3. Cache result on conversation (fire-and-forget)
4. Return pills (or fallbacks on error)

```typescript
// app/api/chatbots/[chatbotId]/suggestion-pills/route.ts

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { generateSuggestionPills } from '@/lib/pills/generate-suggestion-pills';

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * GET /api/chatbots/[chatbotId]/suggestion-pills
 *
 * Query params:
 * - conversationId (optional): Check cache on this conversation
 *
 * Returns:
 * - pills: string[] - AI-generated or fallback pills
 * - source: 'cached' | 'generated' | 'fallback'
 * - generationTimeMs?: number - Only present if source is 'generated'
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { chatbotId } = await params;
    const url = new URL(request.url);
    const conversationId = url.searchParams.get('conversationId');

    // 1. Authenticate
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 2. Check for cached pills on conversation
    if (conversationId) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          suggestionPillsCache: true,
          suggestionPillsCachedAt: true,
        },
      });

      if (conversation?.suggestionPillsCache) {
        const cacheAge = conversation.suggestionPillsCachedAt
          ? Date.now() - new Date(conversation.suggestionPillsCachedAt).getTime()
          : Infinity;

        if (cacheAge < CACHE_TTL) {
          return NextResponse.json({
            pills: conversation.suggestionPillsCache as string[],
            source: 'cached',
          });
        }
      }
    }

    // 3. Fetch chatbot for generation
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        configJson: true,
        fallbackSuggestionPills: true,
        creator: { select: { name: true } },
        sources: { select: { title: true } },
      },
    });

    if (!chatbot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }

    // 4. Fetch intake responses
    const intakeResponses = await prisma.intake_Response.findMany({
      where: {
        userId: user.id,
        chatbotId,
      },
      include: {
        intakeQuestion: {
          select: { id: true, questionText: true },
        },
      },
    });

    // 5. Generate pills
    type ChatbotType = 'BODY_OF_WORK' | 'FRAMEWORK' | 'DEEP_DIVE' | 'ADVISOR_BOARD';

    const intakeContext = {
      responses: Object.fromEntries(
        intakeResponses.map((r) => [
          r.intakeQuestionId,
          typeof r.value === 'string' ? r.value : JSON.stringify(r.value),
        ])
      ),
      questions: intakeResponses.map((r) => ({
        id: r.intakeQuestion.id,
        questionText: r.intakeQuestion.questionText,
      })),
    };

    const configJson = chatbot.configJson as Record<string, unknown> | null;
    const customPrompt = configJson?.suggestionPillsPrompt as string | undefined;

    const { pills, generationTimeMs, error } = await generateSuggestionPills({
      chatbot: {
        id: chatbot.id,
        title: chatbot.title,
        description: chatbot.description,
        type: chatbot.type as ChatbotType | null,
        creator: chatbot.creator,
        sources: chatbot.sources,
      },
      intake: intakeContext,
      customPrompt,
    });

    // 6. Handle result
    if (pills.length > 0) {
      // Cache pills (fire-and-forget)
      if (conversationId) {
        prisma.conversation.update({
          where: { id: conversationId },
          data: {
            suggestionPillsCache: pills,
            suggestionPillsCachedAt: new Date(),
          },
        }).catch((err) => console.error('[suggestion-pills] Cache update failed:', err));
      }

      console.log(`[suggestion-pills] Generated ${pills.length} pills in ${generationTimeMs}ms`);

      return NextResponse.json({
        pills,
        source: 'generated',
        generationTimeMs,
      });
    }

    // 7. Fallback
    if (error) {
      console.error(`[suggestion-pills] Generation failed:`, error);
    }

    const fallbackPills = (chatbot.fallbackSuggestionPills as string[]) || [];
    return NextResponse.json({
      pills: fallbackPills,
      source: 'fallback',
    });

  } catch (error) {
    console.error('[suggestion-pills] Endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestion pills' },
      { status: 500 }
    );
  }
}
```

**Implemented:** Created `app/api/chatbots/[chatbotId]/suggestion-pills/route.ts` with:
- GET endpoint that accepts optional `conversationId` query parameter
- Authentication check using Clerk's `auth()` function
- 7-day cache TTL check on conversation's `suggestionPillsCache`
- Returns cached pills immediately if valid cache exists (source: 'cached')
- Fetches chatbot context (title, description, type, creator, sources, configJson, fallbackSuggestionPills)
- Fetches user's intake responses with question text
- Calls `generateSuggestionPills()` with chatbot and intake context
- Supports custom prompt override from `configJson.suggestionPillsPrompt`
- On successful generation: returns pills (source: 'generated'), logs timing, and fire-and-forget caches to conversation
- On failure/empty pills: returns `fallbackSuggestionPills` (source: 'fallback')
- Response includes `pills` (string[]), `source` ('cached' | 'generated' | 'fallback'), and optional `generationTimeMs`
- Full error handling with appropriate HTTP status codes (401, 404, 500)

---

#### Step 16: Create Skeleton Pills Component ✅ COMPLETED

**File:** `components/pills/suggestion-pills-skeleton.tsx` (NEW)

**Purpose:** Animated placeholder that matches the layout of actual suggestion pills.

**Implemented:** Created `components/pills/suggestion-pills-skeleton.tsx` with:
- `SuggestionPillsSkeletonProps` interface with optional `count` (default 3) and `className` props
- Uses `useTheme()` hook to access theme colors (`theme.chrome.border`) for consistent theming
- Renders flexbox container matching `SuggestionPills` layout (`flex flex-wrap gap-2 justify-center`)
- Generates pill placeholders with varied Tailwind widths (`w-48`, `w-56`, `w-40`, `w-52`, `w-44`, `w-60`) for natural appearance
- Each skeleton pill uses `h-10 rounded-full animate-pulse` for pill-like shape and animation
- Staggered animation delays (`animationDelay: ${index * 100}ms`) for visual interest
- Background color from `theme.chrome.border` at 50% opacity for subtle appearance

```typescript
// components/pills/suggestion-pills-skeleton.tsx

'use client';

import { useTheme } from '@/lib/theme/theme-context';

interface SuggestionPillsSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Skeleton loader for suggestion pills
 * Displays animated placeholder pills while actual pills are loading
 */
export function SuggestionPillsSkeleton({
  count = 3,
  className = ''
}: SuggestionPillsSkeletonProps) {
  const theme = useTheme();

  // Generate varied widths for natural appearance
  const widths = ['w-48', 'w-56', 'w-40', 'w-52', 'w-44', 'w-60'];

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`
            ${widths[index % widths.length]}
            h-10
            rounded-full
            animate-pulse
          `}
          style={{
            backgroundColor: theme.chrome.border,
            opacity: 0.5,
            animationDelay: `${index * 100}ms`,
          }}
        />
      ))}
    </div>
  );
}
```

---

#### Step 17: Consolidate Pill Loading in Chat Component (REPLACES Step 10) ✅ COMPLETED

**File:** `components/chat.tsx`

**Important:** This step REPLACES the existing Step 10 useEffect (lines 1105-1138). Delete that useEffect and use this consolidated version instead.

**Implemented:**
- Imported `SuggestionPillsSkeleton` from `./pills/suggestion-pills-skeleton`
- Added new state and refs for async pill loading:
  - `isPillsLoading` state for tracking loading status
  - `isPillsFetchingRef` ref to guard against duplicate fetches
  - `prevConversationIdRef` ref to track conversation changes
- Added `mapPillStrings` helper function (takes `chatbotId` as parameter to avoid stale closures)
- Deleted the old Step 10 useEffect and replaced with consolidated version that handles three scenarios:
  1. Fresh intake completion → pills come from intakeHook (unchanged)
  2. Returning user with cached pills → use cached pills immediately (fast path)
  3. Returning user without cached pills → async fetch from `/api/chatbots/[chatbotId]/suggestion-pills` endpoint (slow path)
- Uses `AbortController` for proper fetch cleanup on unmount/dependency change
- Uses refs instead of state in dependency array to prevent re-trigger loops
- Clears pills when `conversationId` changes via `prevConversationIdRef`
- Updated pill display location (after welcome message in empty state) to show `SuggestionPillsSkeleton` while `isPillsLoading` is true
- Skeleton only displays in ONE location (after welcome message) as per design decision
- Fixed TypeScript errors by extracting optional arrays to local variables before length checks

**Changes:**

1. Add new state and ref for pill loading (near other pill state, around line 97):
```typescript
const [isPillsLoading, setIsPillsLoading] = useState(false);
const isPillsFetchingRef = useRef(false); // Guard against duplicate fetches
const prevConversationIdRef = useRef<string | null>(null); // Track conversation changes
```

2. Add helper function for mapping pill strings to PillType (before the useEffects).
   **Note:** Takes `chatbotId` as parameter to avoid stale closure issues:
```typescript
// Helper to map pill strings to PillType objects
const mapPillStrings = (pills: string[], targetChatbotId: string): PillType[] =>
  pills.map((text, index) => ({
    id: `suggestion-${index}`,
    chatbotId: targetChatbotId,
    pillType: 'suggested' as const,
    label: text,
    prefillText: text,
    displayOrder: index,
    isActive: true,
  }));
```

3. **DELETE the existing Step 10 useEffect** (lines 1105-1138) and **REPLACE** with this consolidated version:
```typescript
// Consolidated pill loading for returning users (REPLACES Step 10)
// Handles three scenarios:
// 1. Fresh intake completion → pills come from intakeHook (unchanged)
// 2. Returning user with cached pills → use cached pills (fast path, no fetch)
// 3. Returning user without cached pills → async fetch from endpoint (slow path)
useEffect(() => {
  // Clear pills when conversation changes (user switched conversations)
  if (conversationId !== prevConversationIdRef.current) {
    prevConversationIdRef.current = conversationId;
    // Only clear if switching TO a different conversation (not initial load)
    if (prevConversationIdRef.current !== null && intakeSuggestionPills.length > 0) {
      setIntakeSuggestionPills([]);
    }
  }

  // Skip if pills already loaded (from fresh intake or previous load)
  if (intakeSuggestionPills.length > 0) return;

  // Skip if not in chat mode or intake not completed
  if (intakeGate.gateState !== 'chat' || !intakeGate.welcomeData?.intakeCompleted) return;

  // Skip if already fetching (use ref to avoid dependency array issues)
  if (isPillsFetchingRef.current) return;

  // FAST PATH: Cached pills available from welcome data
  if (intakeGate.welcomeData.cachedSuggestionPills?.length > 0) {
    setIntakeSuggestionPills(mapPillStrings(intakeGate.welcomeData.cachedSuggestionPills, chatbotId));
    return;
  }

  // SLOW PATH: No cached pills - fetch from dedicated endpoint
  const controller = new AbortController();

  const fetchPillsAsync = async () => {
    isPillsFetchingRef.current = true;
    setIsPillsLoading(true);

    try {
      const url = conversationId
        ? `/api/chatbots/${chatbotId}/suggestion-pills?conversationId=${conversationId}`
        : `/api/chatbots/${chatbotId}/suggestion-pills`;

      const response = await fetch(url, { signal: controller.signal });
      if (response.ok) {
        const data = await response.json();
        if (data.pills?.length > 0) {
          setIntakeSuggestionPills(mapPillStrings(data.pills, chatbotId));
          return;
        }
      }

      // Fetch failed or empty - try fallbacks
      if (intakeGate.welcomeData?.fallbackSuggestionPills?.length > 0) {
        setIntakeSuggestionPills(mapPillStrings(intakeGate.welcomeData.fallbackSuggestionPills, chatbotId));
      }
    } catch (error) {
      // Ignore abort errors (expected on cleanup)
      if (error instanceof Error && error.name === 'AbortError') return;

      console.error('[chat] Failed to fetch suggestion pills:', error);
      // Use fallback pills on error
      if (intakeGate.welcomeData?.fallbackSuggestionPills?.length > 0) {
        setIntakeSuggestionPills(mapPillStrings(intakeGate.welcomeData.fallbackSuggestionPills, chatbotId));
      }
    } finally {
      isPillsFetchingRef.current = false;
      setIsPillsLoading(false);
    }
  };

  fetchPillsAsync();

  // Cleanup: abort fetch if component unmounts or dependencies change
  return () => {
    controller.abort();
  };
}, [
  intakeGate.gateState,
  intakeGate.welcomeData?.intakeCompleted,
  intakeGate.welcomeData?.cachedSuggestionPills,
  intakeGate.welcomeData?.fallbackSuggestionPills,
  intakeSuggestionPills.length,
  chatbotId,
  conversationId,
  // Note: isPillsLoading removed from deps - using ref instead to prevent re-trigger loops
]);
```

4. Import the skeleton component (with other pill imports, around line 16):
```typescript
import { SuggestionPillsSkeleton } from './pills/suggestion-pills-skeleton';
```

5. Update the **single** pill display location (after welcome message, around line 1448) to show skeleton while loading:
```typescript
{/* Suggestion Pills - shown after welcome message */}
{isPillsLoading ? (
  <SuggestionPillsSkeleton count={3} className="mt-4 w-full" />
) : intakeSuggestionPills.length > 0 ? (
  <SuggestionPills
    pills={intakeSuggestionPills}
    onPillClick={handlePillClick}
    className="mt-4 w-full"
  />
) : null}
```

**Skeleton Display Location:** Only show skeleton in ONE location - after the welcome message. The other two pill display locations (empty state, above first user message) should NOT show skeletons since they only appear after pills are already loaded.

---

#### Step 18: Code to Remove (Explicit Cleanup) ✅ COMPLETED (as part of Step 17)

**File:** `components/chat.tsx`

**Implemented:** The cleanup was done as part of Step 17 implementation:
- Deleted the old Step 10 useEffect (the one with `cachedSuggestionPills > generatedSuggestionPills > fallbackSuggestionPills` priority)
- Replaced with the new consolidated useEffect that handles all three scenarios
- Added new refs (`isPillsFetchingRef`, `prevConversationIdRef`) as specified
- `generatedSuggestionPills` was already removed from WelcomeData interface in Step 14.5
- Verified no remaining TypeScript references to `generatedSuggestionPills` (only comment in use-intake-gate.ts explaining removal)

**Delete the following code (already done):**

1. **Delete the old Step 10 useEffect** (lines 1105-1138):
```typescript
// DELETE THIS ENTIRE BLOCK:
// Load suggestion pills for returning users (Step 10)
// Priority: cachedSuggestionPills > generatedSuggestionPills > fallbackSuggestionPills
// This handles:
// - Returning to existing conversation: use cached AI-generated pills
// - Starting new conversation (intake complete): use freshly generated pills
// - Fallback: use chatbot's fallback pills if generation failed
useEffect(() => {
  if (
    intakeGate.gateState === 'chat' &&
    intakeGate.welcomeData?.intakeCompleted &&
    intakeSuggestionPills.length === 0
  ) {
    const pillsToUse =
      (intakeGate.welcomeData.cachedSuggestionPills && intakeGate.welcomeData.cachedSuggestionPills.length > 0)
        ? intakeGate.welcomeData.cachedSuggestionPills
        : (intakeGate.welcomeData.generatedSuggestionPills && intakeGate.welcomeData.generatedSuggestionPills.length > 0)
          ? intakeGate.welcomeData.generatedSuggestionPills
          : intakeGate.welcomeData.fallbackSuggestionPills;

    if (pillsToUse && pillsToUse.length > 0) {
      const mappedPills: PillType[] = pillsToUse.map((text: string, index: number) => ({
        id: `suggestion-${index}`,
        chatbotId: chatbotId,
        pillType: 'suggested' as const,
        label: text,
        prefillText: text,
        displayOrder: index,
        isActive: true,
      }));
      setIntakeSuggestionPills(mappedPills);
    }
  }
}, [intakeGate.gateState, intakeGate.welcomeData?.intakeCompleted, intakeGate.welcomeData?.cachedSuggestionPills, intakeGate.welcomeData?.generatedSuggestionPills, intakeGate.welcomeData?.fallbackSuggestionPills, intakeSuggestionPills.length, chatbotId]);
```

2. **Add new refs** (near other refs, around line 108):
```typescript
const isPillsFetchingRef = useRef(false);
const prevConversationIdRef = useRef<string | null>(null);
```

**File:** `hooks/use-intake-gate.ts`

**Remove from WelcomeData interface** (line 30):
```typescript
// DELETE THIS LINE:
generatedSuggestionPills?: string[]; // AI-generated pills for returning users starting new conversation
```

**Verification:** After these changes, run TypeScript to ensure no remaining references to `generatedSuggestionPills`:
```bash
npx tsc --noEmit
# or search: grep -r "generatedSuggestionPills" --include="*.ts" --include="*.tsx"
```

---

### Implementation Sequence (Phase 2)

| Step | File | Description | Status |
|------|------|-------------|--------|
| 14 | `welcome/route.ts` | Remove blocking pill generation (lines 222-303) and `generatedSuggestionPills` from response | ✅ |
| 14.5 | `use-intake-gate.ts` | Remove `generatedSuggestionPills` from WelcomeData interface | ✅ |
| 15 | `suggestion-pills/route.ts` | Create new dedicated pills endpoint | ✅ |
| 16 | `suggestion-pills-skeleton.tsx` | Create skeleton component | ✅ |
| 17 | `chat.tsx` | Add consolidated pill loading with async fetch + skeleton (REPLACES Step 10) | ✅ |
| 18 | `chat.tsx`, `use-intake-gate.ts` | Delete old useEffect, add refs, remove `generatedSuggestionPills` references | ✅ |

**Recommended implementation order:**
1. **15 → 16** (can be tested independently, no breaking changes)
2. **14 + 14.5** (removes blocking, temporarily breaks returning user flow)
3. **17 + 18 together** (restores functionality with new async pattern)

**Key implementation details in Step 17:**
- Uses `AbortController` for fetch cleanup on unmount/dependency change
- Uses `isPillsFetchingRef` (ref) instead of state in dependency array to prevent re-trigger loops
- Clears pills when `conversationId` changes via `prevConversationIdRef`
- Passes `chatbotId` explicitly to `mapPillStrings` to avoid stale closures

---

### Verification Checklist (Phase 2)

#### Screen Load Performance
- [ ] Chat screen appears immediately (no blocking on pills)
- [ ] Welcome message is visible before pills load
- [ ] Skeleton pills animate in the pills area (after welcome message only)

#### Skeleton UI
- [ ] Skeleton appears ONLY after welcome message (not in empty state or above first message)
- [ ] Skeleton pill count matches expected (3 visible)
- [ ] Skeleton animates smoothly (pulse effect)
- [ ] Skeleton respects theme colors

#### Pill Loading Scenarios
- [ ] **Fresh intake completion:** Pills appear from PATCH response (no skeleton, no fetch)
- [ ] **Returning user WITH cached pills:** Pills appear instantly from welcome data (no skeleton)
- [ ] **Returning user WITHOUT cached pills:** Skeleton shows, then pills appear after async fetch
- [ ] **Generation error:** Fallback pills appear (no error visible to user)

#### Data Flow
- [ ] Welcome API no longer returns `generatedSuggestionPills`
- [ ] WelcomeData interface no longer has `generatedSuggestionPills`
- [ ] Old Step 10 useEffect has been deleted
- [ ] New consolidated useEffect handles all three scenarios

#### Edge Cases
- [ ] No duplicate pill fetches (guards: `isPillsFetchingRef`, `intakeSuggestionPills.length > 0`)
- [ ] Works correctly when navigating between conversations (pills cleared on conversation change)
- [ ] Works correctly on page refresh
- [ ] Works correctly when starting new conversation after completing intake
- [ ] No TypeScript errors from removed `generatedSuggestionPills` references
- [ ] Fetch is aborted on unmount (no "set state after unmount" warnings)
- [ ] Fetch is aborted when conversation changes mid-request

---

### Known Limitations & Future Improvements

1. **No loading timeout**: If the async fetch hangs indefinitely, the skeleton will show forever. Consider adding a timeout (e.g., 5 seconds) that falls back to fallback pills:
   ```typescript
   const FETCH_TIMEOUT_MS = 5000;
   const timeoutId = setTimeout(() => {
     controller.abort();
     // Use fallback pills
   }, FETCH_TIMEOUT_MS);
   // Clear in finally: clearTimeout(timeoutId);
   ```

2. **Consider SWR/React Query**: For production, a data-fetching library would handle caching, deduplication, and revalidation more robustly than manual `useState` + `useEffect`.

3. **No retry logic**: If the fetch fails once, we immediately fall back. Could add exponential backoff retry for transient errors.
