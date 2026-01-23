# Intake Gate Refactor - Implementation Checklist

> **Reference:** See `INTAKE_GATE_REFACTOR_FOR_LLM_CLARITY.md` for design rationale.
> **Note:** All existing conversations can be deleted before migration.

---

## Pre-Implementation: Current State Summary

### Files to Modify
| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Add `intakeCompleted` field to Conversation |
| `hooks/use-intake-gate.ts` | Replace effect-based logic with pure function |
| `hooks/use-conversational-intake.ts` | Mark conversation complete on intake finish |
| `app/api/chatbots/[chatbotId]/welcome/route.ts` | Add conversation-scoped completion check |
| `app/api/conversations/[conversationId]/route.ts` | Add PATCH endpoint for intakeCompleted |

### Files to Create
| File | Purpose |
|------|---------|
| `lib/intake-gate/index.ts` | Pure `decideGate()` function |
| `lib/intake-gate/types.ts` | Shared types for gate logic |

### Current Public API (Must Preserve)
```typescript
// hooks/use-intake-gate.ts - Lines 43-60
export interface UseIntakeGateReturn {
  gateState: 'checking' | 'intake' | 'chat';
  welcomeData: WelcomeData | null;
  onIntakeComplete: (conversationId: string) => void;
}

export function useIntakeGate(
  chatbotId: string,
  conversationId: string | null,
  isSignedIn: boolean | undefined,
  isLoaded: boolean | undefined
): UseIntakeGateReturn
```

---

## Step 1: Database Schema Change

### 1.1 Update Prisma Schema

**File:** `prisma/schema.prisma`
**Location:** Lines 249-270 (Conversation model)

**Current:**
```prisma
model Conversation {
  id               String          @id @default(cuid())
  chatbotId        String
  chatbot          Chatbot         @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  chatbotVersionId String
  chatbotVersion   Chatbot_Version @relation(fields: [chatbotVersionId], references: [id], onDelete: Cascade)
  userId           String?
  user             User?           @relation(fields: [userId], references: [id], onDelete: Cascade)
  status           String          @default("active")
  messageCount     Int             @default(0)
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  messages             Message[]
  conversationFeedback Conversation_Feedback?

  @@index([chatbotId, status])
  @@index([userId])
  @@index([chatbotVersionId])
}
```

**Change to:**
```prisma
model Conversation {
  id               String          @id @default(cuid())
  chatbotId        String
  chatbot          Chatbot         @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  chatbotVersionId String
  chatbotVersion   Chatbot_Version @relation(fields: [chatbotVersionId], references: [id], onDelete: Cascade)
  userId           String?
  user             User?           @relation(fields: [userId], references: [id], onDelete: Cascade)
  status           String          @default("active")
  messageCount     Int             @default(0)
  intakeCompleted  Boolean         @default(false)  // NEW
  intakeCompletedAt DateTime?                        // NEW
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  messages             Message[]
  conversationFeedback Conversation_Feedback?

  @@index([chatbotId, status])
  @@index([userId])
  @@index([chatbotVersionId])
}
```

### 1.2 Run Migration

```bash
# Delete all existing conversations (user confirmed this is OK)
npx prisma db push --force-reset
# OR if you want a proper migration:
npx prisma migrate dev --name add_intake_completed_to_conversation
```

**Verification:** Run `npx prisma studio` and confirm Conversation model has new fields.

---

## Step 2: Create Pure Gate Decision Function

### 2.1 Create Types File

**File:** `lib/intake-gate/types.ts` (CREATE NEW)

```typescript
/**
 * Intake Gate Types
 *
 * Centralized types for the intake gate decision system.
 */

export type GateDecision = 'intake' | 'chat';

export interface GateInput {
  /** The conversation ID from URL, or null if new conversation */
  conversationId: string | null;

  /** Whether the conversation has any messages */
  hasMessages: boolean;

  /** Whether THIS conversation has completed intake (from DB field) */
  intakeCompletedForConversation: boolean;

  /** Whether the chatbot has any intake questions configured */
  chatbotHasQuestions: boolean;

  /** Whether the user has answered ALL questions for this chatbot (legacy check) */
  userAnsweredAllQuestions: boolean;
}

export interface GateData extends GateInput {
  /** Chatbot display name */
  chatbotName: string;

  /** Generated purpose text */
  chatbotPurpose: string;

  /** User's existing intake responses */
  existingResponses: Record<string, any>;

  /** Intake questions for this chatbot */
  questions: IntakeQuestion[];
}

export interface IntakeQuestion {
  id: string;
  questionText: string;
  helperText?: string;
  responseType: 'TEXT' | 'NUMBER' | 'SELECT' | 'MULTI_SELECT' | 'BOOLEAN';
  displayOrder: number;
  isRequired: boolean;
  options?: string[];
}
```

### 2.2 Create Decision Function

**File:** `lib/intake-gate/index.ts` (CREATE NEW)

```typescript
/**
 * Intake Gate Decision Logic
 *
 * Single source of truth for determining whether to show intake or chat.
 *
 * DECISION TREE (evaluated in priority order):
 * 1. Conversation marked intakeCompleted=true → CHAT
 * 2. Conversation has messages → CHAT (resume existing)
 * 3. Chatbot has no questions → CHAT (skip intake)
 * 4. User hasn't answered all questions → INTAKE
 * 5. Default → CHAT
 *
 * @see INTAKE_GATE_REFACTOR_FOR_LLM_CLARITY.md for design rationale
 */

import type { GateDecision, GateInput } from './types';

export * from './types';

export function decideGate(input: GateInput): GateDecision {
  // Rule 1: Conversation already marked complete
  if (input.intakeCompletedForConversation) {
    return 'chat';
  }

  // Rule 2: Conversation has messages (resume existing conversation)
  if (input.conversationId && input.hasMessages) {
    return 'chat';
  }

  // Rule 3: Chatbot has no questions configured
  if (!input.chatbotHasQuestions) {
    return 'chat';
  }

  // Rule 4: User hasn't completed intake for this chatbot
  if (!input.userAnsweredAllQuestions) {
    return 'intake';
  }

  // Rule 5: Default to chat
  return 'chat';
}
```

**Verification:** This is a pure function - write unit tests:

```typescript
// lib/intake-gate/__tests__/index.test.ts
import { decideGate } from '../index';

describe('decideGate', () => {
  it('returns chat when conversation marked complete', () => {
    expect(decideGate({
      conversationId: 'abc',
      hasMessages: false,
      intakeCompletedForConversation: true,
      chatbotHasQuestions: true,
      userAnsweredAllQuestions: false,
    })).toBe('chat');
  });

  it('returns chat when conversation has messages', () => {
    expect(decideGate({
      conversationId: 'abc',
      hasMessages: true,
      intakeCompletedForConversation: false,
      chatbotHasQuestions: true,
      userAnsweredAllQuestions: false,
    })).toBe('chat');
  });

  it('returns chat when no questions configured', () => {
    expect(decideGate({
      conversationId: null,
      hasMessages: false,
      intakeCompletedForConversation: false,
      chatbotHasQuestions: false,
      userAnsweredAllQuestions: false,
    })).toBe('chat');
  });

  it('returns intake when user has not answered all questions', () => {
    expect(decideGate({
      conversationId: null,
      hasMessages: false,
      intakeCompletedForConversation: false,
      chatbotHasQuestions: true,
      userAnsweredAllQuestions: false,
    })).toBe('intake');
  });

  it('returns chat when user has answered all questions', () => {
    expect(decideGate({
      conversationId: null,
      hasMessages: false,
      intakeCompletedForConversation: false,
      chatbotHasQuestions: true,
      userAnsweredAllQuestions: true,
    })).toBe('chat');
  });
});
```

---

## Step 3: Update Welcome API to Include Conversation Data

### 3.1 Modify Welcome Endpoint

**File:** `app/api/chatbots/[chatbotId]/welcome/route.ts`
**Location:** Lines 114-152 (intakeCompleted calculation)

**Add after line ~68 (after chatbot fetch):**

```typescript
// Fetch conversation data if conversationId provided
let conversationData: { intakeCompleted: boolean; messageCount: number } | null = null;
const conversationId = url.searchParams.get('conversationId');

if (conversationId) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      intakeCompleted: true,
      messageCount: true,
    },
  });
  if (conversation) {
    conversationData = conversation;
  }
}
```

**Modify response (around line 172-190) to include:**

```typescript
return NextResponse.json({
  chatbotName: chatbot.name,
  chatbotPurpose: generatePurposeText(chatbot),
  intakeCompleted: allQuestionsAnswered,  // Keep for backward compat
  hasQuestions,
  existingResponses: responseMap,
  questions: formattedQuestions,
  // NEW FIELDS:
  conversation: conversationData ? {
    intakeCompleted: conversationData.intakeCompleted,
    hasMessages: conversationData.messageCount > 0,
  } : null,
}, {
  headers: {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  },
});
```

**Update the fetch URL in use-intake-gate.ts to pass conversationId:**

**File:** `hooks/use-intake-gate.ts`
**Location:** Line ~82

**Current:**
```typescript
const response = await fetch(
  `/api/chatbots/${chatbotId}/welcome?t=${Date.now()}`,
```

**Change to:**
```typescript
const response = await fetch(
  `/api/chatbots/${chatbotId}/welcome?t=${Date.now()}${conversationId ? `&conversationId=${conversationId}` : ''}`,
```

---

## Step 4: Update useIntakeGate to Use Pure Function

### 4.1 Refactor Hook Implementation

**File:** `hooks/use-intake-gate.ts`

**Replace the gate state logic (around lines 89-110) with:**

```typescript
import { decideGate } from '@/lib/intake-gate';

// Inside fetchWelcomeData, after getting response:
const gateInput = {
  conversationId,
  hasMessages: data.conversation?.hasMessages ?? false,
  intakeCompletedForConversation: data.conversation?.intakeCompleted ?? false,
  chatbotHasQuestions: data.hasQuestions,
  userAnsweredAllQuestions: data.intakeCompleted,
};

const decision = decideGate(gateInput);
setGateState(decision);
```

**Full refactored fetchWelcomeData function:**

```typescript
const fetchWelcomeData = useCallback(async () => {
  if (!chatbotId || !isLoaded) return;

  // Anonymous users can proceed - they'll be prompted to sign in later
  console.log('[useIntakeGate] Fetching welcome data', {
    chatbotId,
    conversationId,
    isSignedIn,
    isLoaded
  });

  setGateState('checking');

  try {
    const response = await fetch(
      `/api/chatbots/${chatbotId}/welcome?t=${Date.now()}${conversationId ? `&conversationId=${conversationId}` : ''}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      throw new Error(`Welcome fetch failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('[useIntakeGate] Welcome data received:', data);

    setWelcomeData(data);

    // Use pure decision function
    const gateInput = {
      conversationId,
      hasMessages: data.conversation?.hasMessages ?? false,
      intakeCompletedForConversation: data.conversation?.intakeCompleted ?? false,
      chatbotHasQuestions: data.hasQuestions,
      userAnsweredAllQuestions: data.intakeCompleted,
    };

    const decision = decideGate(gateInput);
    console.log('[useIntakeGate] Gate decision:', decision, 'from input:', gateInput);
    setGateState(decision);

  } catch (error) {
    console.error('[useIntakeGate] Error fetching welcome data:', error);
    // Default to chat on error to avoid blocking users
    setGateState('chat');
  }
}, [chatbotId, conversationId, isSignedIn, isLoaded]);
```

---

## Step 5: Mark Conversation Complete on Intake Finish

### 5.1 Create PATCH Endpoint for Conversation

**File:** `app/api/conversations/[conversationId]/route.ts`

**Add PATCH handler (or create file if it doesn't exist):**

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: { conversationId: string } }
) {
  try {
    const { userId } = await auth();
    const { conversationId } = params;
    const body = await request.json();

    // Validate conversation exists and belongs to user
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { userId: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Allow update if user owns conversation or conversation is anonymous
    if (conversation.userId && conversation.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Only allow updating intakeCompleted
    const updateData: { intakeCompleted?: boolean; intakeCompletedAt?: Date } = {};

    if (typeof body.intakeCompleted === 'boolean') {
      updateData.intakeCompleted = body.intakeCompleted;
      if (body.intakeCompleted) {
        updateData.intakeCompletedAt = new Date();
      }
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
    });

    return NextResponse.json({ conversation: updated });
  } catch (error) {
    console.error('[PATCH conversation] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### 5.2 Call PATCH on Intake Completion

**File:** `hooks/use-conversational-intake.ts`
**Location:** Lines 187-211 (`showFinalMessage` function)

**Add after the final message is shown (around line 200):**

```typescript
// Mark conversation as intake complete
if (conversationIdRef.current) {
  fetch(`/api/conversations/${conversationIdRef.current}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intakeCompleted: true }),
  }).catch(err => {
    console.error('[useConversationalIntake] Failed to mark intake complete:', err);
  });
}
```

**Full updated showFinalMessage:**

```typescript
const showFinalMessage = useCallback(async () => {
  const finalText = "When our conversation is finished, leave me a rating and feedback using the thumbs up or thumbs down. This helps me improve!";

  const finalMessage: IntakeMessage = {
    id: `final-${Date.now()}`,
    role: 'assistant',
    content: finalText,
    timestamp: new Date(),
    isIntakeMessage: true,
    isFinalIntakeMessage: true,
  };

  addMessage(finalMessage);
  setCurrentQuestionIndex(-2); // Special marker for "intake complete"

  // Mark conversation as intake complete in database
  if (conversationIdRef.current) {
    fetch(`/api/conversations/${conversationIdRef.current}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intakeCompleted: true }),
    }).catch(err => {
      console.error('[useConversationalIntake] Failed to mark intake complete:', err);
    });
  }

  // Fetch suggestion pills
  try {
    const pillsResponse = await fetch(`/api/pills?chatbotId=${chatbotId}`);
    if (pillsResponse.ok) {
      const pillsData = await pillsResponse.json();
      setSuggestionPills(pillsData.pills || []);
    }
  } catch (err) {
    console.error('[useConversationalIntake] Failed to fetch pills:', err);
  }

  // Trigger completion callback after delay
  setTimeout(() => {
    if (conversationIdRef.current) {
      onComplete(conversationIdRef.current);
    }
  }, 1000);
}, [chatbotId, addMessage, onComplete]);
```

---

## Step 6: Verification Checklist

### Unit Tests
- [ ] `decideGate()` returns 'chat' when `intakeCompletedForConversation` is true
- [ ] `decideGate()` returns 'chat' when conversation has messages
- [ ] `decideGate()` returns 'chat' when chatbot has no questions
- [ ] `decideGate()` returns 'intake' when user hasn't answered all questions
- [ ] `decideGate()` returns 'chat' when user has answered all questions

### Integration Tests
- [ ] New conversation → shows intake if questions exist
- [ ] New conversation → skips intake if no questions
- [ ] Click existing conversation with messages → shows chat (not intake)
- [ ] Complete intake → clicking same conversation shows chat
- [ ] Complete intake → new conversation shows chat (user already completed)

### Manual Testing Flow
1. Delete all conversations (fresh start)
2. Create chatbot with intake questions
3. Start new conversation → should show intake
4. Complete all intake questions → should transition to chat
5. Refresh page → should stay in chat (not restart intake)
6. Start NEW conversation → should skip intake (user already completed)
7. Delete user's intake responses → new conversation should show intake again

---

## Step 7: Cleanup (After Verification)

### Remove Redundant Logic
Once verified working, these can be simplified:

**File:** `hooks/use-intake-gate.ts`
- Remove any duplicate gate state calculations
- Remove `hasPassedIntakePhase` ref if no longer needed in chat.tsx

**File:** `app/api/chatbots/[chatbotId]/welcome/route.ts`
- Keep `intakeCompleted` in response for backward compatibility
- Add deprecation comment if planning to remove later

**File:** `components/chat.tsx`
- Verify no duplicate intake phase tracking
- Clean up any redundant effects

---

## Summary of Changes

| Step | File | Change |
|------|------|--------|
| 1 | `prisma/schema.prisma` | Add `intakeCompleted`, `intakeCompletedAt` to Conversation |
| 2 | `lib/intake-gate/types.ts` | Create new file with types |
| 2 | `lib/intake-gate/index.ts` | Create new file with `decideGate()` function |
| 3 | `app/api/chatbots/[chatbotId]/welcome/route.ts` | Add conversation data to response |
| 4 | `hooks/use-intake-gate.ts` | Use `decideGate()` for decision logic |
| 5 | `app/api/conversations/[conversationId]/route.ts` | Add PATCH endpoint |
| 5 | `hooks/use-conversational-intake.ts` | Mark conversation complete on finish |

**Total files modified:** 4
**Total files created:** 3
**Database migration:** Yes (add 2 fields to Conversation)
