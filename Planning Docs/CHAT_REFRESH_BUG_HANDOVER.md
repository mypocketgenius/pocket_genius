# Chat Refresh Bug - Handover Document

## Problem Statement

When a returning user (intake already completed) starts a new conversation and sends their first message, the following undesirable behavior occurs:

1. Suggestion pills revert to skeleton loaders
2. The page appears to "refresh"
3. The `useIntakeGate` hook shows `conversationId` going from a valid ID to `null` and back
4. Pills are re-fetched unnecessarily

Console log pattern showing the bug:
```
[useIntakeGate] Effect running {conversationId: 'cml3iyj42000025lu0n1h2zj5', ...}
[useIntakeGate] Effect running {conversationId: null, ...}
[Pills] Fetching from endpoint...
```

## Original Issue

The Chat component had a `key` prop that included `conversationId`:
```jsx
<Chat key={`${chatbotId}-${conversationId ?? 'new'}-${isNew ?? ''}`} />
```

This was added to fix a different bug: "conversations weren't refreshing when selecting a new one" from sidebar. However, it caused unnecessary remounts and loading spinners.

## What We Tried

### 1. Removed the key prop
**File:** `app/chat/[chatbotId]/page.tsx`

Removed the key prop to prevent forced remounts. This fixed the unnecessary loading spinner but broke conversation switching.

### 2. Added state clearing when switching conversations
**File:** `components/chat.tsx` (URL params useEffect)

When `urlConversationId` changes to a different conversation, clear messages/pills/bookmarks. Added guard to only clear when switching FROM an existing conversation (not from null):

```js
if (urlConversationId) {
  if (conversationId !== urlConversationId) {
    const isSwitchingConversations = conversationId !== null;
    if (isSwitchingConversations) {
      setMessages([]);
      setIntakeSuggestionPills([]);
      // ... clear other state
    }
    setConversationId(urlConversationId);
  }
  return;
}
```

**Result:** Switching conversations works, but new conversation flow still broken.

### 3. Reordered priority checks
Moved `?new=true` check before the `messages.length > 0` guard so clicking + button would work.

**Result:** + button works, but sending first message still broken.

### 4. Added guard to skip clearing if conversationId already set
```js
if (isNewConversation && !conversationId) {
  // Only clear if we don't already have a conversationId
  setConversationId(null);
  // ...
}
```

**Result:** Still broken. The issue persists.

## Why Our Approaches Failed

### Root Cause: Race Condition Between State and URL

The fundamental issue is a **race condition** between:
1. `setConversationId('xyz')` - React state update (async batched)
2. `router.replace('/chat/...?conversationId=xyz')` - URL update (async)
3. The useEffect that watches both state AND URL params

When `sendMessage` completes:
1. It calls `setConversationId(newId)` - schedules state update
2. It calls `router.replace()` - starts URL change
3. The useEffect runs (triggered by `conversationId` changing in dependency array)
4. But `urlConversationId` and `isNewConversation` still reflect the OLD URL
5. Condition checks see inconsistent state and make wrong decisions

### The Effect Has Too Many Responsibilities

The URL params useEffect tries to handle:
- Loading a conversation from URL (`?conversationId=xyz`)
- Starting a new conversation (`?new=true`)
- Transitioning from new to existing (after first message)
- Preventing flicker during intake completion
- Preserving messages during transitions

This complexity makes it nearly impossible to add guards that work in all cases.

### Dependency Array Creates Cascading Effects

```js
}, [chatbotId, urlConversationId, isNewConversation, intakeGate.gateState, conversationId, messages.length]);
```

Each dependency can trigger the effect, and the effect may modify other dependencies, creating hard-to-predict cascades.

## Current State of the Code

### Files Modified
1. `app/chat/[chatbotId]/page.tsx` - Key prop removed
2. `components/chat.tsx` - Multiple changes to URL params useEffect

### What Works
- Switching between existing conversations via sidebar
- No more unnecessary loading spinner on page load
- Clicking + button to start new conversation

### What's Broken
- Sending first message in a new conversation causes pills to show skeletons and state to flicker

## Suggested Alternative Approaches

### Option A: Use URL as Single Source of Truth

Remove `conversationId` from React state entirely. Derive it from `useSearchParams()` everywhere. This eliminates the state/URL sync problem.

```js
// Instead of:
const [conversationId, setConversationId] = useState<string | null>(null);

// Use:
const conversationId = searchParams?.get('conversationId') ?? null;
```

When `sendMessage` needs to update the conversation, it only calls `router.replace()` and lets the component re-render with the new URL params.

**Challenge:** Need to handle the case where API returns conversationId but URL hasn't updated yet.

### Option B: Use a State Machine

Define explicit states and transitions:
- `idle` - No conversation, waiting for user
- `new` - User clicked +, showing welcome message
- `creating` - First message sent, waiting for API
- `active` - Conversation exists, normal chat

Transitions are explicit and guards are clear:
```js
const [chatState, setChatState] = useState<ChatState>('idle');

// In sendMessage:
if (chatState === 'new') {
  setChatState('creating');
}
// On API response:
setChatState('active');
```

### Option C: Use Refs to Track In-Flight Operations

Add refs to track when operations are in progress:
```js
const isCreatingConversation = useRef(false);

// In sendMessage:
isCreatingConversation.current = true;
// ... API call ...
isCreatingConversation.current = false;

// In useEffect:
if (isCreatingConversation.current) {
  return; // Skip all logic while creating
}
```

### Option D: Split Into Multiple Effects

Instead of one mega-effect, split into focused effects:
1. Effect for loading conversation from URL
2. Effect for handling `?new=true`
3. Effect for syncing state to localStorage

Each effect has fewer dependencies and clearer responsibilities.

## Key Files to Understand

1. **`components/chat.tsx`** - Main chat component with the problematic useEffect (~lines 167-226)
2. **`hooks/use-intake-gate.ts`** - Hook that fetches welcome data, logs show conversationId changes
3. **`app/chat/[chatbotId]/page.tsx`** - Page component that renders Chat

## How to Reproduce

1. Sign in as a user who has completed intake for a chatbot
2. Navigate to the chat and click the + button to start a new conversation
3. Type a message and send it
4. Observe: Pills show skeletons, console shows conversationId going null, then page "refreshes"

## Success Criteria

After sending the first message in a new conversation:
- Pills should NOT show skeletons
- `conversationId` should go from `null` to the new ID (never back to null)
- No visual "refresh" or flicker
- Message should appear smoothly
