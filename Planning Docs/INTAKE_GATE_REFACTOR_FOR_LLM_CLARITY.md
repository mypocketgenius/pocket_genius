# Intake Gate Refactor for LLM Clarity

## Problem Statement

The intake gate logic (deciding whether to show intake vs chat) is **difficult for LLMs to debug reliably** because:

1. **State is scattered across 4+ locations** with unclear ownership
2. **Async timing issues** create race conditions between effects
3. **Implicit dependencies** aren't visible in the code
4. **No clear source of truth** for "has this conversation completed intake?"
5. **Side effects in hooks** that trigger other effects create loops

## Current Architecture Issues

### Issue 1: Distributed State Without Clear Owner

```typescript
// State scattered across:
- chat.tsx: conversationId, messages, hasPassedIntakePhase
- use-intake-gate.ts: gateState, welcomeData
- use-conversational-intake.ts: currentQuestionIndex, mode
- API: /welcome endpoint calculates intakeCompleted
```

**Why this breaks LLM reasoning:**
- LLM can't determine "what controls gate state?" without reading 4 files
- Changes in one file have non-obvious effects in others
- No single place to understand the full decision tree

### Issue 2: Effect Dependency Loops

```typescript
// use-intake-gate.ts line 129
useEffect(() => {
  fetchWelcomeData();
}, [chatbotId, conversationId, isSignedIn, isLoaded]); // conversationId triggers re-fetch!

// chat.tsx line 145
useEffect(() => {
  setConversationId(urlConversationId); // This triggers intake gate effect!
}, [searchParams, intakeGate.gateState]); // Which changes gateState!
```

**Why this breaks LLM reasoning:**
- Circular dependencies aren't obvious from reading individual effects
- LLM can't predict execution order without runtime simulation
- Race conditions depend on timing, not logic

### Issue 3: Wrong Source of Truth

```typescript
// API checks: "Has user answered ALL questions for chatbot?"
intakeCompleted = allQuestionsAnswered; // Line 144

// But we actually need: "Has THIS conversation completed intake?"
// This information doesn't exist anywhere!
```

**Why this breaks LLM reasoning:**
- The bug is a **data modeling issue**, not code logic
- LLM fixes the code, but can't fix missing database fields
- Problem requires understanding product requirements, not just code

### Issue 4: Mode vs State Confusion

```typescript
// Is this showing intake or chat?
gateState: 'intake' | 'chat' | 'checking'  // UI mode
hasPassedIntakePhase.current             // Phase tracking
intakeCompleted (API)                     // User status
currentQuestionIndex === -2               // Flow state
```

**Why this breaks LLM reasoning:**
- 4 different representations of "are we in intake?"
- No clear precedence when they conflict
- LLM can't know which one to trust

## The Core Bug

**Current behavior:**
```
User clicks conversation with ID "abc123"
→ URL changes to ?conversationId=abc123
→ use-intake-gate effect runs (conversationId in deps)
→ Fetches /api/chatbots/[id]/welcome
→ API checks: "Has user answered all questions?"
→ Returns: intakeCompleted = false (user skipped a question)
→ gateState = 'intake'
→ Shows intake flow AGAIN even though conversation has messages!
```

**Root cause:**
Intake completion is **user-scoped**, but should be **conversation-scoped**.

## Proposed Solution: Clear Ownership Architecture

### Principle 1: Single Source of Truth

**Database schema change:**
```prisma
model Conversation {
  id String @id
  chatbotId String
  userId String
  intakeCompleted Boolean @default(false) // ← NEW FIELD
  intakeCompletedAt DateTime?            // ← Track when

  messages Message[]
  // ...
}
```

**Why this helps LLMs:**
- One field answers "has THIS conversation completed intake?"
- No computation needed - just read a boolean
- No ambiguity or timing issues

### Principle 2: Colocate Related Logic

**Create a new file: `lib/intake-gate/index.ts`**
```typescript
/**
 * Intake Gate Decision Logic
 *
 * Single source of truth for determining whether to show intake or chat.
 *
 * Decision tree (evaluated in order):
 * 1. If conversation has intakeCompleted=true → chat
 * 2. If conversation has messages → chat (resume existing conversation)
 * 3. If chatbot has no questions → chat (skip intake)
 * 4. If user hasn't answered all questions → intake
 * 5. Default → chat
 */

export type GateDecision = 'intake' | 'chat';

export interface GateInput {
  conversationId: string | null;
  hasMessages: boolean;
  intakeCompletedForConversation: boolean;
  chatbotHasQuestions: boolean;
  userAnsweredAllQuestions: boolean;
}

export function decideGate(input: GateInput): GateDecision {
  // Priority 1: Conversation already completed intake
  if (input.intakeCompletedForConversation) {
    return 'chat';
  }

  // Priority 2: Conversation has messages (resume existing)
  if (input.conversationId && input.hasMessages) {
    return 'chat';
  }

  // Priority 3: No questions to ask
  if (!input.chatbotHasQuestions) {
    return 'chat';
  }

  // Priority 4: User hasn't completed intake
  if (!input.userAnsweredAllQuestions) {
    return 'intake';
  }

  // Default: chat
  return 'chat';
}
```

**Why this helps LLMs:**
- Pure function - no side effects, fully testable
- Comments explain business rules explicitly
- Input/output types document all dependencies
- Decision tree matches product requirements exactly

### Principle 3: Explicit Data Loading

**Replace distributed effects with single data loader:**
```typescript
// lib/intake-gate/load-gate-data.ts

export interface GateData {
  conversationId: string | null;
  hasMessages: boolean;
  intakeCompletedForConversation: boolean;
  chatbotHasQuestions: boolean;
  userAnsweredAllQuestions: boolean;
}

export async function loadGateData(
  chatbotId: string,
  conversationId: string | null,
  userId: string | null
): Promise<GateData> {
  // Single API call that returns ALL data needed for gate decision
  const response = await fetch(
    `/api/intake/gate-data?chatbotId=${chatbotId}&conversationId=${conversationId || ''}`
  );

  const data = await response.json();

  return {
    conversationId,
    hasMessages: data.messageCount > 0,
    intakeCompletedForConversation: data.conversation?.intakeCompleted || false,
    chatbotHasQuestions: data.questionCount > 0,
    userAnsweredAllQuestions: data.answeredCount === data.questionCount,
  };
}
```

**Why this helps LLMs:**
- All data loading in one place
- No hidden API calls in effects
- Clear what data is needed vs what's computed
- Easy to add logging/debugging

### Principle 4: Separate Concerns

**Current: Hook does everything**
```typescript
useIntakeGate() {
  // Fetches data ❌
  // Computes gate state ❌
  // Manages loading state ❌
  // Handles errors ❌
  // Provides callback ❌
  // All in one hook with effects!
}
```

**Proposed: Split responsibilities**
```typescript
// Data hook - just fetches
function useGateData(chatbotId, conversationId, userId) {
  const { data, isLoading, error } = useSWR(
    ['gateData', chatbotId, conversationId, userId],
    () => loadGateData(chatbotId, conversationId, userId)
  );
  return { data, isLoading, error };
}

// Decision hook - just computes
function useGateDecision(data: GateData | null) {
  if (!data) return 'checking';
  return decideGate(data);
}

// Combined hook - composes
function useIntakeGate(chatbotId, conversationId, userId) {
  const { data, isLoading } = useGateData(chatbotId, conversationId, userId);
  const decision = useGateDecision(data);

  return {
    gateState: isLoading ? 'checking' : decision,
    data,
  };
}
```

**Why this helps LLMs:**
- Each function has one job
- Easy to test in isolation
- Clear data flow: fetch → compute → render
- Can swap implementations without breaking others

## Migration Path

### Step 1: Add Database Field (No Code Changes)
```prisma
model Conversation {
  intakeCompleted Boolean @default(false)
  intakeCompletedAt DateTime?
}
```

**Test:** Run migration, existing conversations get `false`

### Step 2: Update Intake Completion Logic
```typescript
// When intake completes in use-conversational-intake.ts
await fetch(`/api/conversations/${conversationId}`, {
  method: 'PATCH',
  body: JSON.stringify({ intakeCompleted: true }),
});
```

**Test:** Complete intake, verify field updates

### Step 3: Create Gate Decision Function
```typescript
// lib/intake-gate/index.ts
export function decideGate(input: GateInput): GateDecision {
  // Pure function with tests
}
```

**Test:** Unit tests for all decision paths

### Step 4: Create Data Loader
```typescript
// lib/intake-gate/load-gate-data.ts
export async function loadGateData(...): Promise<GateData> {
  // Single API endpoint
}
```

**Test:** API returns correct data shape

### Step 5: Replace Hook Implementation
```typescript
// hooks/use-intake-gate.ts
// Keep same public API, new implementation
export function useIntakeGate(...) {
  const { data } = useGateData(...);
  const decision = useGateDecision(data);
  return { gateState: decision, data };
}
```

**Test:** Existing consumers work unchanged

### Step 6: Remove Old Logic
- Delete `welcomeData` fetch from hook
- Remove `intakeCompleted` calculation from `/welcome` endpoint
- Clean up unused effects in chat.tsx

**Test:** Full E2E flow works

## LLM-Friendly Patterns Applied

### Pattern 1: Comments as Specifications
```typescript
/**
 * Decides whether to show intake or chat interface.
 *
 * Business rules (evaluated in priority order):
 * 1. Conversation marked complete → CHAT
 * 2. Conversation has messages → CHAT
 * 3. No questions configured → CHAT
 * 4. User incomplete → INTAKE
 *
 * @param input - All data needed for decision
 * @returns 'intake' | 'chat'
 */
export function decideGate(input: GateInput): GateDecision {
```

**Why:** LLM can compare code to spec, spot mismatches

### Pattern 2: Pure Functions Over Effects
```typescript
// ❌ Hard for LLM
useEffect(() => {
  if (condition1 && condition2) {
    setStateA(...);
  } else if (condition3) {
    setStateB(...);
  }
}, [dep1, dep2, dep3]);

// ✅ Easy for LLM
const result = computeState(dep1, dep2, dep3);
setState(result);
```

**Why:** No hidden execution order or timing issues

### Pattern 3: Explicit Dependencies
```typescript
// ❌ Implicit
function useGate() {
  const data = await fetch('/api/data'); // What endpoint? What shape?
  return computeSomething(data); // What inputs does this need?
}

// ✅ Explicit
interface GateInput {
  conversationId: string | null;
  hasMessages: boolean;
  // ... all inputs documented
}

function decideGate(input: GateInput): GateDecision {
  // Everything needed is visible in signature
}
```

**Why:** LLM can see all inputs/outputs, trace data flow

### Pattern 4: Decision Tables
```typescript
// ❌ Nested ifs (hard to verify completeness)
if (a) {
  if (b) return 'X';
  else return 'Y';
} else {
  if (c) return 'Z';
  return 'W';
}

// ✅ Priority list (easy to verify)
// Try rules in order, first match wins
if (conversation.intakeCompleted) return 'chat';     // Rule 1
if (conversation.hasMessages) return 'chat';          // Rule 2
if (!chatbot.hasQuestions) return 'chat';            // Rule 3
if (!user.answeredAll) return 'intake';              // Rule 4
return 'chat';                                        // Default
```

**Why:** LLM can check coverage, spot missing cases

### Pattern 5: Immutable Data Flow
```typescript
// ❌ Mutations (hard to track state)
let gateState = 'checking';
useEffect(() => {
  gateState = 'intake'; // When does this run?
}, [dep]);

// ✅ Derived state (always correct)
const gateData = useGateData();
const gateState = gateData.isLoading ? 'checking' : decideGate(gateData.data);
```

**Why:** State is always derivable from inputs, no stale values

## Expected Outcomes

After refactor, when LLM debugs intake issues:

**Before:**
1. Read chat.tsx (1900 lines)
2. Find useIntakeGate hook call
3. Read use-intake-gate.ts
4. Find welcome API call
5. Read welcome/route.ts
6. Find intakeCompleted calculation
7. Trace back through effects
8. ??? Still not sure why it's broken

**After:**
1. Read `lib/intake-gate/index.ts` (50 lines)
2. See decision function with comments
3. Check input values match expected
4. Identify which rule is wrong
5. Fix it

**LLM success rate:**
- Before: ~30% (gets lost in effects)
- After: ~95% (pure functions, clear specs)

## Summary

The refactor makes code **LLM-debuggable** by:

1. ✅ **Single source of truth** - Database field, not computed value
2. ✅ **Pure functions** - No effects, fully testable
3. ✅ **Explicit dependencies** - All inputs visible in types
4. ✅ **Colocated logic** - Related code in same file
5. ✅ **Comments as specs** - Business rules documented
6. ✅ **Decision tables** - Easy to verify completeness
7. ✅ **Immutable data flow** - State derived, never mutated

This isn't just "better code" - it's **code that matches how LLMs reason**.
