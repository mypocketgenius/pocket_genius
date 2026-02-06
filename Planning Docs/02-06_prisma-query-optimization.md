# Prisma Query Optimization Audit

**Date:** 2026-02-06
**Scope:** Full user flow — homepage → intake → first chat message
**Evidence:** Terminal logs from real session + source code audit

---

## Assessment — What to Tackle

### Definitely do (high impact, low risk)

| # | Issue | Queries Saved | Time Est | Risk |
|---|-------|--------------|----------|------|
| 5 | SourceAttribution `/api/intake/completion` fetch → pass prop | ~10/flow | ~15 min | None |
| 4 | Merge rate limit functions into one | 1/chat msg | ~10 min | None |
| 2 | Remove `/api/user/current` call from `saveResponse()` | 3/flow + 3 RTTs | ~15 min | None |

These are all isolated, low-risk, and take under an hour combined. Gets ~109 → ~95 queries.

### Worth doing next (high impact, medium risk)

| # | Issue | Queries Saved | Risk |
|---|-------|--------------|------|
| 1 | Batch intake messages (defer persistence) | ~38/flow | Message loss if PATCH fails — mitigate with localStorage backup |
| 3 | Batch intake responses | ~12-15/flow | Coupled with Issue 1 |

Issues 1 + 3 should be done together as a single batch-intake feature. Gets ~95 → ~50 queries.

### Can wait

| # | Issue | Queries Saved | Why wait |
|---|-------|--------------|----------|
| 7 | Return message IDs from chat stream | 3/chat msg | Requires streaming protocol change + careful testing |
| 6 | Reduce chatbot `include` depth | ~3-6/flow | Low impact, risk of under-selecting |

---

## Current State

A single user completing a 3-question intake and sending their first chat message generates **~109 DB queries**. This should be closer to **30-40**.

---

## Client-Side Flow Sequence

This is the exact sequence of API calls made during a normal user flow (homepage → intake → chat). Understanding this is critical for optimizing — the calls cascade from component mounts and hook callbacks.

```
1. User lands on chat page
   └─ IntakeGateProvider mounts
      └─ GET /api/chatbots/[id]/welcome        (5 queries, ~3790ms)
         Returns: questions, existingResponses, welcomeMessage, intakeCompleted

2. Intake flow starts (useConversationalIntake hook initializes)
   └─ POST /api/conversations/create            (4 queries, ~2782ms)
      Returns: conversation.id
   └─ For each question (3 questions = 10 messages total):
      │  Question flow: assistant question msg + user answer + "Thank you." + next question
      │  Each message = individual POST:
      ├─ POST /api/conversations/[id]/messages   (4 queries each, ~1100-2200ms)
      ├─ POST /api/conversations/[id]/messages
      ├─ POST /api/conversations/[id]/messages
      │  ... repeated ~10 times total
      │
      │  For each NEW answer (not verification):
      ├─ GET /api/user/current                   (1 query, ~2700ms)
      └─ POST /api/intake/responses              (6 queries, ~2000ms)
         ... repeated per question

3. Intake completes
   └─ POST /api/conversations/[id]/messages      (final welcome msg, 4 queries)
   └─ PATCH /api/conversations/[id]              (7 queries, ~10800ms)
      Sets intakeCompleted=true, generates AI suggestion pills

4. Chat view mounts
   ├─ GET /api/conversations/[id]/messages       (3 queries, ~1100ms) [reload all msgs]
   ├─ GET /api/pills?chatbotId=...               (2 queries, ~1087ms)
   └─ GET /api/intake/completion (per SourceAttribution mount, 2+ times)
                                                  (5 queries each, ~2500ms)

5. User sends first chat message
   └─ POST /api/chat                             (~14 queries, ~22000ms)
      Includes: auth, rate limit x2, chatbot fetch, conversation fetch,
      sourceIds backfill, user msg insert, RAG query, source fetch,
      intake response fetch, AI stream, assistant msg insert,
      conversation update, chunk_performance upserts x5
   └─ GET /api/conversations/[id]/messages       (3 queries, ~1700ms) [reload for real IDs]
```

### Observed Response Times (from terminal logs)

| Route | Time | Notes |
|-------|------|-------|
| `GET /api/chatbots/[id]/welcome` | 3790ms | 5 queries + joining intake questions/responses |
| `POST /api/conversations/create` | 2782ms | 4 queries including creator.users join |
| `POST /api/conversations/[id]/messages` | 1100-2200ms | 4 queries per call, called ~10x during intake |
| `GET /api/user/current` | 1954-3311ms | Single query but Clerk auth overhead |
| `POST /api/intake/responses` | 1855-3327ms | 6 queries per question answer |
| `PATCH /api/conversations/[id]` | 10804ms | 7 queries + OpenAI pill generation (~4s) |
| `POST /api/chat` | 22025ms | ~14 queries + RAG + OpenAI stream + pill gen |
| `GET /api/pills` | 1087ms | 2 queries |
| `GET /api/intake/completion` | 1839-2579ms | 5 queries, called 2+ times |
| `GET /api/conversations/[id]/messages` | 1133-1708ms | 3 queries per call |

### Query Count by Route (New Answers, 3 Questions)

| Step | Route | Calls | Queries/Call | Total |
|------|-------|-------|-------------|-------|
| 1 | `GET /api/chatbots/[id]/welcome` | 1 | 5 | **5** |
| 2 | `GET /api/user/current` | 3 | 1 | **3** |
| 3 | `POST /api/conversations/create` | 1 | 4 | **4** |
| 4 | `POST /api/intake/responses` | 3 | 6 | **18** |
| 5 | `POST /api/conversations/[id]/messages` (intake msgs) | 10 | 4 | **40** |
| 6 | `PATCH /api/conversations/[id]` (intake complete) | 1 | 7 | **7** |
| 7 | `GET /api/pills` | 1 | 2 | **2** |
| 8 | `GET /api/conversations/[id]/messages` (reload) | 1 | 3 | **3** |
| 9 | `POST /api/chat` | 1 | ~14 | **14** |
| 10 | `GET /api/conversations/[id]/messages` (reload after chat) | 1 | 3 | **3** |
| 11 | `GET /api/intake/completion` (SourceAttribution) | 2+ | 5 | **10+** |
| | | | **TOTAL** | **~109** |

---

## Issue 1: Intake messages saved one-at-a-time

**Impact:** ~30 excess queries
**Complexity:** Medium

### The Problem

`addMessage()` in `hooks/use-conversational-intake.ts` fires an individual `POST /api/conversations/[id]/messages` for every single message during intake. For 3 questions, the intake generates ~10 messages (welcome+question, answer, "Thank you.", next question, answer, "Thank you.", ..., final message).

**Current code — `hooks/use-conversational-intake.ts:103`:**
```ts
const addMessage = useCallback(async (role: 'user' | 'assistant', content: string, convId: string): Promise<IntakeMessage> => {
    const response = await fetch(`/api/conversations/${convId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, content }),
    });
    // ... returns saved message
}, [onMessageAdded]);
```

This is called from `handleAnswer()` (line 374), `handleSkip()` (line 408), `processQuestion()` (line 260), and `showFinalMessage()` (line 189).

**Example from `handleAnswer()` at line 382-385 — three sequential POSTs per answer:**
```ts
await saveResponse(question.id, value);                             // POST /api/intake/responses
await addMessage('user', formatAnswerForDisplay(question, value), conversationId!);  // POST messages
await addMessage('assistant', 'Thank you.', conversationId!);       // POST messages
// then showQuestion() calls addMessage again for the next question  // POST messages
```

**Each POST to `/api/conversations/[id]/messages/route.ts` runs 4 queries:**
```
Query 1: prisma.user.findUnique({ where: { clerkId } })          — resolve user (line 268)
Query 2: prisma.conversation.findUnique({ where: { id } })        — verify ownership (line 301)
Query 3: prisma.message.create({ data: { ... } })                 — insert message (line 338)
Query 4: prisma.conversation.update({ messageCount: +1 })         — increment count (line 353)
```

**Total: 10 POSTs × 4 queries = 40 queries just for intake messages.**

---

## Issue 2: User ID re-resolved in every API call

**Impact:** ~12-15 excess queries
**Complexity:** Low

### The Problem

Every API route independently resolves the Clerk ID to a database user ID. The same query runs ~15 times in a single flow:

```ts
// This exact pattern appears in EVERY route:
const { userId: clerkUserId } = await auth();
const user = await prisma.user.findUnique({
  where: { clerkId: clerkUserId },
  select: { id: true },
});
```

**Routes that do this (with line numbers):**
| Route | File | Line |
|-------|------|------|
| `GET /api/user/current` | `app/api/user/current/route.ts` | (entire purpose of route) |
| `POST /api/intake/responses` | `app/api/intake/responses/route.ts` | 51 |
| `POST /api/conversations/create` | `app/api/conversations/create/route.ts` | ~40 |
| `POST /api/conversations/[id]/messages` | `app/api/conversations/[conversationId]/messages/route.ts` | 268 |
| `GET /api/conversations/[id]/messages` | `app/api/conversations/[conversationId]/messages/route.ts` | 41 |
| `POST /api/chat` | `app/api/chat/route.ts` | 58 |
| `GET /api/chatbots/[id]/welcome` | `app/api/chatbots/[chatbotId]/welcome/route.ts` | ~40 |
| `GET /api/intake/completion` | `app/api/intake/completion/route.ts` | ~30 |
| `PATCH /api/conversations/[id]` | `app/api/conversations/[conversationId]/route.ts` | 52 |

Additionally, the `saveResponse()` function in the client explicitly calls `/api/user/current` before each `/api/intake/responses` POST:

```ts
// hooks/use-conversational-intake.ts:348
const saveResponse = useCallback(async (questionId: string, value: any) => {
    const userResponse = await fetch('/api/user/current');  // <-- extra round trip
    const userData = await userResponse.json();
    const dbUserId = userData.userId;

    const response = await fetch('/api/intake/responses', {
      method: 'POST',
      body: JSON.stringify({ userId: dbUserId, intakeQuestionId: questionId, ... }),
    });
}, [clerkUserId, chatbotId]);
```

The `POST /api/intake/responses` route already resolves the user from auth (line 51), so the client-side `userId` field is redundant — it's only used for a security check at line 82 that compares it to the already-resolved user.

### Recommendation

**Quick win (no API changes):** The `saveResponse()` function should stop calling `/api/user/current`. The intake/responses route already authenticates and resolves the user — the `userId` body field is redundant.

```ts
// hooks/use-conversational-intake.ts — REMOVE the /api/user/current fetch:
const saveResponse = useCallback(async (questionId: string, value: any) => {
    const response = await fetch('/api/intake/responses', {
      method: 'POST',
      body: JSON.stringify({ intakeQuestionId: questionId, chatbotId, value, reusableAcrossFrameworks: false }),
    });
}, [chatbotId]);
```

The `POST /api/intake/responses` route should remove the `providedUserId` check (line 82) and always use the auth-resolved `dbUserId`.

**Saves: 3 GET /api/user/current calls = 3 queries + 3 network round-trips.**

**Deeper fix (cache across routes):** Create an auth helper that caches the DB user ID per-request:

```ts
// lib/auth-helpers.ts
const userIdCache = new Map<string, { id: string; expiry: number }>();

export async function getDbUserId(clerkUserId: string): Promise<string | null> {
  const cached = userIdCache.get(clerkUserId);
  if (cached && cached.expiry > Date.now()) return cached.id;

  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
  if (user) {
    userIdCache.set(clerkUserId, { id: user.id, expiry: Date.now() + 60000 }); // 1min TTL
  }
  return user?.id || null;
}
```

Then replace `prisma.user.findUnique({ where: { clerkId } })` with `getDbUserId(clerkUserId)` in all routes.

**Files to modify:**
- `hooks/use-conversational-intake.ts` — `saveResponse()` at line 343
- `app/api/intake/responses/route.ts` — remove `providedUserId` check at line 82
- New: `lib/auth-helpers.ts` (optional deeper fix)
- All API routes listed above (for deeper fix)

---

## Issue 3: Intake responses submitted one-at-a-time

**Impact:** ~12-15 excess queries
**Complexity:** Medium

### The Problem

Each intake answer triggers `saveResponse()` which calls `/api/intake/responses` individually. For 3 questions = 3 POSTs.

**Current code — `app/api/intake/responses/route.ts` POST handler (6 queries per call):**
```ts
// Query 1: Resolve user (line 51)
const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId } });

// Query 2: Verify question exists (line 101)
const question = await prisma.intake_Question.findUnique({ where: { id: intakeQuestionId } });

// Query 3: Verify chatbot exists (line 117)
const chatbot = await prisma.chatbot.findUnique({ where: { id: chatbotId } });

// Query 4: Verify question belongs to chatbot (line 130)
const association = await prisma.chatbot_Intake_Question.findUnique({
  where: { intakeQuestionId_chatbotId: { intakeQuestionId, chatbotId } },
});

// Query 5: Upsert response (line 149)
const response = await prisma.intake_Response.upsert({ ... });

// Query 6: Sync to User_Context (line 176)
await prisma.user_Context.upsert({ ... });
```

**Total: 3 questions × (1 user/current + 6 intake/responses) = 21 queries.**

---

### Combined Implementation Plan: Batch Intake (Issues 1 + 3)

**Impact:** ~50 excess queries saved (messages: ~38, responses: ~15)
**Complexity:** Medium
**Files to modify:**
- `hooks/use-conversational-intake.ts` — `addMessage()`, `saveResponse()`, `showFinalMessage()`
- `app/api/conversations/[conversationId]/route.ts` — PATCH handler
- `components/chat.tsx` — `onComplete` callback (post-intake reload)

#### Overview

Defer ALL intake persistence (messages + responses) to client state during intake. On intake completion, batch-persist everything in a single PATCH request wrapped in a Prisma `$transaction`. The existing individual `POST /api/intake/responses` and `POST /api/conversations/[id]/messages` routes remain untouched (they're still used outside intake).

#### Step 1: Client — Make `addMessage()` local-only

**File:** `hooks/use-conversational-intake.ts` — `addMessage()` (line 103)

Change from async network call to synchronous local state update. Key details:

- **Temp IDs:** Use an incrementing counter (`intake-temp-0`, `intake-temp-1`, ...) NOT `Date.now()` — two messages in the same ms would collide.
- **Preserve `createdAt`:** Store the client-side timestamp with each pending message. This is critical because `createMany` gives all rows the same `@default(now())`, which breaks the post-intake reload sort (chat.tsx:1042). Explicit timestamps preserve ordering.
- **Return type changes from `Promise<IntakeMessage>` to `IntakeMessage`** — all 4 callers (`handleAnswer`, `handleSkip`, `processQuestion`, `showFinalMessage`) currently `await` it. Remove those `await` keywords.
- **Add a ref:** `pendingMessagesRef = useRef<PendingMessage[]>([])` where `PendingMessage = { role: string; content: string; createdAt: string }`. ISO string for safe JSON serialization.

```ts
// New ref (add near other refs, ~line 100)
const messageCounterRef = useRef(0);
const pendingMessagesRef = useRef<{ role: string; content: string; createdAt: string }[]>([]);

// Replace addMessage (line 103)
const addMessage = useCallback((role: 'user' | 'assistant', content: string, _convId: string): IntakeMessage => {
  const now = new Date();
  const newMessage: IntakeMessage = {
    id: `intake-temp-${messageCounterRef.current++}`,
    role,
    content,
    createdAt: now,
  };

  // Accumulate for batch save
  pendingMessagesRef.current.push({ role, content, createdAt: now.toISOString() });

  // Update local state + notify parent
  setMessages(prev => [...prev, newMessage]);
  onMessageAdded(newMessage);
  return newMessage;
}, [onMessageAdded]);
```

**Callers to update** (remove `await` since `addMessage` is no longer async):
- `processQuestion()` line 299: `await addMessage(...)` → `addMessage(...)`
- `processQuestion()` line 312: `await addMessage(...)` → `addMessage(...)`
- `handleAnswer()` line 384: `await addMessage(...)` → `addMessage(...)`
- `handleAnswer()` line 385: `await addMessage(...)` → `addMessage(...)`
- `handleSkip()` line 423: `await addMessage(...)` → `addMessage(...)`
- `handleSkip()` line 424: `await addMessage(...)` → `addMessage(...)`
- `showFinalMessage()` line 198: `await addMessage(...)` → `addMessage(...)`
- `initialize()` line 566: `await addMessage(...)` → `addMessage(...)`

#### Step 2: Client — Make `saveResponse()` local-only

**File:** `hooks/use-conversational-intake.ts` — `saveResponse()` (line 343)

Accumulate responses in a ref instead of POSTing individually.

- **Add a ref:** `pendingResponsesRef = useRef<PendingResponse[]>([])` where `PendingResponse = { intakeQuestionId: string; value: any }`.
- **Note:** `handleVerifyYes` does NOT call `saveResponse` — it just advances to the next question. So `pendingResponsesRef` only contains new/modified answers, which is correct (verified answers don't need re-saving).
- Remove the `clerkUserId` check since it's no longer making network calls.

```ts
// New ref (add near pendingMessagesRef)
const pendingResponsesRef = useRef<{ intakeQuestionId: string; value: any }[]>([]);

// Replace saveResponse (line 343)
const saveResponse = useCallback((questionId: string, value: any) => {
  // Check for existing entry for this question (handles modify case)
  const existingIndex = pendingResponsesRef.current.findIndex(r => r.intakeQuestionId === questionId);
  if (existingIndex >= 0) {
    pendingResponsesRef.current[existingIndex].value = value;
  } else {
    pendingResponsesRef.current.push({ intakeQuestionId: questionId, value });
  }
}, []);
```

**Callers to update** (remove `await` since `saveResponse` is no longer async):
- `handleAnswer()` line 383: `await saveResponse(...)` → `saveResponse(...)`

#### Step 3: Client — Send batch in `showFinalMessage()`

**File:** `hooks/use-conversational-intake.ts` — `showFinalMessage()` (line 189)

Replace the current PATCH body to include messages and responses. Critical change: **do NOT call `onComplete` if the PATCH fails** — currently it always calls `onComplete` via setTimeout (line 253), which would transition to chat with no persisted data.

```ts
const showFinalMessage = useCallback(async (convId: string) => {
  // Build and display final message locally (same as current)
  const baseWelcome = (welcomeMessage || "Let's get started! Feel free to ask any questions.").replace(/\\n/g, '\n');
  const ratingCTA = "When our conversation is finished, leave me a rating and you will get free messages for the next AI! Now let's get started...";
  const finalMessage = `${baseWelcome}\n\n${ratingCTA}`;
  addMessage('assistant', finalMessage, convId); // no await — local-only

  setCurrentQuestionIndex(-2);

  if (convId) {
    try {
      const response = await fetch(`/api/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intakeCompleted: true,
          messages: pendingMessagesRef.current,
          responses: pendingResponsesRef.current,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Handle suggestion pills (same as current, lines 223-241)
        if (data.suggestionPills?.length > 0) {
          const mappedPills: PillType[] = data.suggestionPills.map(
            (text: string, index: number) => ({
              id: `suggestion-${index}`,
              chatbotId,
              pillType: 'suggested' as const,
              label: text,
              prefillText: text,
              displayOrder: index,
              isActive: true,
            })
          );
          setSuggestionPills(mappedPills);
          setShowPills(true);
        }
        // Clear pending data
        pendingMessagesRef.current = [];
        pendingResponsesRef.current = [];
        // Only transition on success
        setTimeout(() => onComplete(convId), 1000);
      } else {
        const errorText = await response.text();
        console.error('[Intake] Batch save failed:', response.status, errorText);
        setError('Failed to save your responses. Please try again.');
        // Do NOT call onComplete — stay in intake state
      }
    } catch (err) {
      console.error('[Intake] Batch save error:', err);
      setError('Failed to save your responses. Please check your connection and try again.');
      // Do NOT call onComplete — stay in intake state
    }
  }
}, [welcomeMessage, addMessage, onComplete, chatbotId]);
```

#### Step 4: Server — Accept batch data in PATCH handler

**File:** `app/api/conversations/[conversationId]/route.ts`

Add message + response batch processing BEFORE the existing pill generation logic. Wrap the critical persistence in a `$transaction` so it's all-or-nothing.

**New accepted body fields:**
```ts
{
  intakeCompleted?: boolean;
  messages?: { role: string; content: string; createdAt: string }[];
  responses?: { intakeQuestionId: string; value: any }[];
}
```

**Add after line 78 (after authorization check), before the `updateData` build:**

```ts
// --- Batch intake persistence (Issues 1+3) ---
const { messages: batchMessages, responses: batchResponses } = body;

if (batchMessages?.length > 0 || batchResponses?.length > 0) {
  // Build transaction operations
  const txOps: any[] = [];

  // 1. Batch create messages with explicit createdAt for correct ordering
  if (batchMessages?.length > 0) {
    // Validate messages array
    const validMessages = batchMessages.filter(
      (msg: any) => (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string'
    );
    if (validMessages.length > 0) {
      txOps.push(
        prisma.message.createMany({
          data: validMessages.map((msg: any) => ({
            conversationId,
            userId: msg.role === 'user' ? dbUserId : null,
            role: msg.role,
            content: msg.content,
            context: null,         // Not Prisma.JsonNull — createMany uses raw null
            followUpPills: [],
            sourceIds: [],
            createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
          })),
        })
      );
      txOps.push(
        prisma.conversation.update({
          where: { id: conversationId },
          data: { messageCount: { increment: validMessages.length } },
        })
      );
    }
  }

  // 2. Batch upsert responses + User_Context sync
  if (batchResponses?.length > 0 && dbUserId) {
    // Bulk-fetch question slugs (needed for User_Context keys)
    const questionIds = batchResponses.map((r: any) => r.intakeQuestionId);
    const questions = await prisma.intake_Question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, slug: true },
    });
    const slugMap = new Map(questions.map(q => [q.id, q.slug]));

    // Bulk-validate question-chatbot associations
    const associations = await prisma.chatbot_Intake_Question.findMany({
      where: { chatbotId: conversation.chatbotId, intakeQuestionId: { in: questionIds } },
      select: { intakeQuestionId: true },
    });
    const validQuestionIds = new Set(associations.map(a => a.intakeQuestionId));

    for (const r of batchResponses) {
      if (!validQuestionIds.has(r.intakeQuestionId)) continue; // skip invalid
      const slug = slugMap.get(r.intakeQuestionId);
      if (!slug) continue;

      txOps.push(
        prisma.intake_Response.upsert({
          where: {
            userId_intakeQuestionId_chatbotId: {
              userId: dbUserId,
              intakeQuestionId: r.intakeQuestionId,
              chatbotId: conversation.chatbotId,
            },
          },
          create: {
            userId: dbUserId,
            intakeQuestionId: r.intakeQuestionId,
            chatbotId: conversation.chatbotId,
            value: r.value,
            reusableAcrossFrameworks: false,
          },
          update: { value: r.value, updatedAt: new Date() },
        })
      );
      txOps.push(
        prisma.user_Context.upsert({
          where: {
            userId_chatbotId_key: {
              userId: dbUserId,
              chatbotId: conversation.chatbotId,
              key: slug,
            },
          },
          create: {
            userId: dbUserId,
            chatbotId: conversation.chatbotId,
            key: slug,
            value: r.value,
            source: 'INTAKE_FORM',
            isVisible: true,
            isEditable: true,
          },
          update: { value: r.value, source: 'INTAKE_FORM', updatedAt: new Date() },
        })
      );
    }
  }

  // Execute all persistence in one transaction
  if (txOps.length > 0) {
    await prisma.$transaction(txOps);
  }
}
// --- End batch intake persistence ---
```

**Note:** The existing `updateData`/`intakeCompleted` logic (lines 81-106) remains unchanged below this block. The conversation update for `intakeCompleted` + pill generation still runs as before. The responses are now in the DB before pill generation reads them (line 142), so pills see the latest intake data.

**Also update the `conversation.findUnique` select (line 62)** to include `chatbotId` — it already does, so no change needed there.

#### Step 5: Client — Fix post-intake message reload

**File:** `components/chat.tsx` — `onComplete` callback (~line 1006)

The current reload at lines 1016-1064 merges API messages with local messages by ID. With temp IDs (`intake-temp-0`, etc.), the API-fetched messages (which now have real cuid IDs) won't match, causing every message to appear twice.

**Fix:** Replace the merge logic with a full replacement. After batch save, the API has the canonical message set.

```ts
// Replace lines 1016-1064 with:
try {
  const response = await fetch(`/api/conversations/${convId}/messages`);
  if (response.ok) {
    const data = await response.json();
    const loadedMessages: Message[] = data.messages.map((msg: any) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
      context: msg.context || undefined,
      followUpPills: msg.followUpPills || undefined,
    }));
    // Full replacement — temp IDs don't match DB IDs after batch save
    setMessages(loadedMessages);
  }
} catch (error) {
  console.error('[Chat] Error reloading messages after intake completion', error);
  // Keep existing local messages as fallback — they display correctly even with temp IDs
}
```

#### Edge Cases and Risks

| Scenario | Behavior | Mitigation |
|----------|----------|------------|
| **PATCH fails** (network/server error) | Messages + responses exist only in client state. User stays in intake view with error message. | `showFinalMessage` does NOT call `onComplete` on failure. User can retry (pending refs still populated). |
| **Browser refresh mid-intake** | All unpersisted messages + responses lost. | Acceptable — intake is short (~60s for 3 questions). User restarts intake; existing responses from previous sessions are preserved via `existingResponses`. |
| **User modifies an answer** | `saveResponse` updates the existing entry in `pendingResponsesRef` (findIndex by questionId). | Handled via the dedup logic in Step 2. |
| **`handleVerifyYes` path** | Does NOT call `saveResponse` — just advances to next question. Verified answers already exist in DB from previous sessions. | `pendingResponsesRef` only contains new/modified answers. Correct by design. |
| **Transaction partially fails** | `$transaction` is all-or-nothing. Either all messages + responses persist, or none do. | Prisma interactive transaction rollback. Client retries the whole batch. |

#### Query Count Impact

| Before | After |
|--------|-------|
| 10 message POSTs × 4 queries = **40** | `createMany` + count update = **2** |
| 3 response POSTs × 6 queries = **18** | 2 bulk fetches + N upserts in txn = **~8** (for 3 questions) |
| 3 `/api/user/current` calls = **3** | **0** (responses don't hit separate route) |
| **Total: ~61 queries** | **Total: ~10 queries** |

---

## Issue 4: Rate limit runs the same count query twice

**Impact:** 1 excess query per chat message
**Complexity:** Low

### The Problem

**`lib/rate-limit.ts` — two functions that run the identical query:**
```ts
// checkRateLimit (line 40):
const recentMessages = await prisma.message.count({
  where: { conversation: { userId }, role: 'user', createdAt: { gte: oneMinuteAgo } },
});
return recentMessages < RATE_LIMIT;

// getRemainingMessages (line 75):
const recentMessages = await prisma.message.count({
  where: { conversation: { userId }, role: 'user', createdAt: { gte: oneMinuteAgo } },
});
return Math.max(0, RATE_LIMIT - recentMessages);
```

**Called sequentially in `app/api/chat/route.ts:135-136`:**
```ts
const allowed = await checkRateLimit(dbUserId);
const remainingMessages = await getRemainingMessages(dbUserId);
```

### Recommendation

Replace both with a single function:

```ts
// lib/rate-limit.ts
export async function checkRateLimit(userId: string | null): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
}> {
  if (!userId) return { allowed: true, remaining: RATE_LIMIT, limit: RATE_LIMIT };

  try {
    const oneMinuteAgo = new Date(Date.now() - WINDOW_MS);
    const recentMessages = await prisma.message.count({
      where: { conversation: { userId }, role: 'user', createdAt: { gte: oneMinuteAgo } },
    });
    return {
      allowed: recentMessages < RATE_LIMIT,
      remaining: Math.max(0, RATE_LIMIT - recentMessages),
      limit: RATE_LIMIT,
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return { allowed: true, remaining: RATE_LIMIT, limit: RATE_LIMIT };
  }
}
```

**Update `app/api/chat/route.ts:135-136`:**
```ts
const { allowed, remaining, limit } = await checkRateLimit(dbUserId);
// Use `remaining` in headers, `allowed` for 429 check
```

**Files to modify:**
- `lib/rate-limit.ts` — merge `checkRateLimit()` and `getRemainingMessages()`
- `app/api/chat/route.ts` — update call site (~line 135)

---

## Issue 5: SourceAttribution calls `/api/intake/completion` on every mount

**Impact:** ~10 excess queries (5 per call, 2+ calls)
**Complexity:** Low

### The Problem

**`components/source-attribution.tsx:55-68`:**
```tsx
useEffect(() => {
    const checkIntakeCompletion = async () => {
      try {
        const response = await fetch(`/api/intake/completion?chatbotId=${chatbotId}`);
        if (response.ok) {
          const data = await response.json();
          setHasCompletedIntake(data.completed && data.hasQuestions);
        }
      } catch (error) {
        console.error('Error checking intake completion:', error);
      }
    };
    checkIntakeCompletion();
  }, [chatbotId]);
```

`SourceAttribution` is rendered once per assistant message that has context (inside the message list in `chat.tsx`). Each instance independently fetches intake completion status. The `/api/intake/completion` endpoint runs 5 queries per call (user, chatbot, creator, chatbot sources, intake questions + responses).

The intake completion status is **already available** in the parent Chat component from `intakeGate.welcomeData.intakeCompleted`.

### Recommendation

1. Remove the `useEffect` fetch from `source-attribution.tsx`
2. Add a `hasCompletedIntake` prop to `SourceAttribution`
3. In `chat.tsx`, pass the value from the intake gate

```tsx
// components/source-attribution.tsx — CHANGE:
interface SourceAttributionProps {
  chunkIds: string[];
  chatbotId: string;
  messageContext?: Prisma.JsonValue;
  textColor?: string;
  hasCompletedIntake?: boolean;  // NEW: passed from parent
}

export function SourceAttribution({
  chunkIds, chatbotId, messageContext, textColor = '#4b5563',
  hasCompletedIntake = false,  // NEW: default false
}: SourceAttributionProps) {
  // REMOVE: the entire useEffect that fetches /api/intake/completion
  // REMOVE: const [hasCompletedIntake, setHasCompletedIntake] = useState(false);
  // ... rest unchanged
}
```

**Files to modify:**
- `components/source-attribution.tsx` — remove useEffect, add prop (lines 53-68)
- `components/chat.tsx` — pass `hasCompletedIntake` where SourceAttribution is rendered

---

## Issue 6: Chatbot data re-fetched with heavy includes across routes

**Impact:** ~6-8 excess queries
**Complexity:** Medium-High

### The Problem

The same chatbot is fetched with `include: { creator: { include: { users } } }` in multiple routes during a single flow:

| Route | File:Line | What it fetches | What it actually needs |
|-------|-----------|-----------------|----------------------|
| `POST /api/conversations/create` | `conversations/create/route.ts:~82` | Full chatbot + creator + users | chatbot.currentVersionId, creatorId |
| `POST /api/chat` | `chat/route.ts:109` | Full chatbot + creator + users | systemPrompt, configJson, creatorId, ragSettings |
| `GET /api/chatbots/[id]/welcome` | `chatbots/[id]/welcome/route.ts:~106` | Full chatbot + creator + sources + questions | welcomeMessage, questions, type |
| `PATCH /api/conversations/[id]` | `conversations/[id]/route.ts:119` | chatbot + creator + sources | title, description, type, fallbackPills |

Each includes a multi-table JOIN (Chatbot → Creator → Creator_User). The `creator.users` data is only needed in `conversations/create` (to create a fallback chatbot version if none exists — an edge case).

### Recommendation (short-term)

Reduce `include` depth where the full tree isn't needed:

- **PATCH handler (line 119):** Already uses `select` correctly — no change needed.
- **Chat route (line 109):** Remove `creator.users` include — only needs `creatorId` for namespace:
  ```ts
  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    // Only select what's needed:
    select: {
      id: true, title: true, creatorId: true, slug: true, description: true,
      systemPrompt: true, configJson: true, ragSettingsJson: true,
      currentVersionId: true, pineconeNs: true, vectorNamespace: true,
    },
  });
  ```

### Recommendation (longer-term)

Have the welcome endpoint return chatbot config data to the client, which passes it to subsequent routes. This eliminates re-fetching entirely.

**Files to modify:**
- `app/api/chat/route.ts` — line 109, reduce to select
- `app/api/conversations/create/route.ts` — reduce include depth

---

## Issue 7: Messages reloaded after every chat send

**Impact:** 3 queries per chat message (ongoing)
**Complexity:** Medium

### The Problem

**`components/chat.tsx:623-659` — after every `sendMessage()`:**
```tsx
// Reload messages to get real database IDs (fixes feedback button issue)
if (newConversationId || conversationId) {
    await new Promise(resolve => setTimeout(resolve, 100)); // artificial delay

    try {
      const messagesResponse = await fetch(
        `/api/conversations/${newConversationId || conversationId}/messages`
      );
      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();
        const loadedMessages = messagesData.messages.map((msg: any) => ({ ... }));
        setMessages(loadedMessages);
      }
    } catch (reloadError) {
      console.warn('Failed to reload messages with real IDs:', reloadError);
    }
}
```

The comment explains why: the UI needs real database IDs for bookmark/feedback features, but the client-generated IDs (e.g., `user-1738850000000`) don't match. So after every chat message, the entire message history is re-fetched.

The GET messages route runs 3 queries (user lookup, conversation lookup, message findMany + optional source title lookup).

### Recommendation

The chat route already creates both the user message and assistant message in the database. Return their IDs in the streaming response:

1. The user message ID is created at `chat/route.ts:311` — include it in a header:
   ```ts
   'X-User-Message-Id': userMessage.id,
   ```

2. The assistant message ID is created at `chat/route.ts:603` — it's already sent via the `__PILLS__` JSON payload. Extend this to always send the message ID:
   ```ts
   // At end of stream, always send:
   controller.enqueue(encoder.encode(`\n\n__META__${JSON.stringify({
     userMessageId: userMessage.id,
     assistantMessageId: assistantMessage.id,
     pills: followUpPills,
   })}`));
   ```

3. In `chat.tsx`, parse the metadata and patch local message IDs instead of reloading.

**Files to modify:**
- `app/api/chat/route.ts` — return message IDs in stream metadata (lines 311, 603)
- `components/chat.tsx` — parse IDs from stream, patch local state (lines 623-659)

---

## Prioritized Action Plan

### Phase 1: Quick wins (low complexity, high impact)

| # | Action | Queries Saved | Files |
|---|--------|--------------|-------|
| 1 | Remove `/api/intake/completion` fetch from SourceAttribution (Issue 5) | ~10/flow | `source-attribution.tsx`, `chat.tsx` |
| 2 | Merge rate limit functions into one (Issue 4) | 1/chat msg | `lib/rate-limit.ts`, `chat/route.ts` |
| 3 | Remove `/api/user/current` call from `saveResponse()` (Issue 2) | 3/flow | `use-conversational-intake.ts`, `intake/responses/route.ts` |

### Phase 2: Batch intake (Issues 1+3 combined, single implementation)

| # | Action | Queries Saved | Files |
|---|--------|--------------|-------|
| 4 | Defer all intake persistence, batch-save on completion | ~51/flow | `use-conversational-intake.ts`, `conversations/[id]/route.ts`, `chat.tsx` |

See "Combined Implementation Plan: Batch Intake (Issues 1 + 3)" in Issue 3 section for full 5-step plan.

### Phase 3: Structural improvements (higher complexity)

| # | Action | Queries Saved | Files |
|---|--------|--------------|-------|
| 5 | Return message IDs from chat stream (Issue 7) | 3/chat msg | `chat/route.ts`, `chat.tsx` |
| 6 | Reduce chatbot `include` depth in chat route (Issue 6) | ~3/flow | `chat/route.ts` |

### Expected Results

| Metric | Before | After Phase 1 | After Phase 2 | After Phase 3 |
|--------|--------|---------------|---------------|---------------|
| Total queries (full flow) | ~109 | ~95 | ~44 | ~38 |
| Intake API calls | ~16 | ~13 | ~1 | ~1 |
| Redundant user lookups | ~15 | ~12 | ~1 | ~1 |

### Risk Notes

- **Batch intake (Issues 1+3):** If PATCH fails, messages + responses are lost. Mitigated by: (1) `showFinalMessage` does NOT call `onComplete` on failure, keeping user in intake state with error message; (2) pending refs remain populated for retry; (3) `$transaction` ensures all-or-nothing persistence.
- **Issue 2 (user ID caching):** In-memory cache won't work across serverless invocations in production. The client-side approach (stop calling `/api/user/current`) is safer.
- **Issue 5 (SourceAttribution):** The `hasCompletedIntake` prop might be stale if intake completes mid-conversation. For the current flow this doesn't happen (intake always completes before chat), so this is safe.
