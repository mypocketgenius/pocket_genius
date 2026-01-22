# Intake Loop Fix - January 21, 2026

## Problem Summary

The conversational intake flow was stuck in an infinite loop during initialization. The intake would never complete the first question, and `processQuestion` was being called 7+ times in rapid succession.

## Root Causes

### 1. **Callback Dependencies in useEffect**
The initialization `useEffect` had callback dependencies (`addMessage`, `showFinalMessage`, `showFirstQuestion`, `showQuestion`) that were recreating on every render because they depended on `messages.length` (via `detectLoop`).

**Loop chain:**
1. Effect runs → calls callbacks → updates messages
2. Messages update → callbacks recreate (dependency changed)
3. Callbacks recreate → Effect dependencies change → Effect runs again → LOOP!

### 2. **conversationId in Dependencies**
The initialization `useEffect` had `conversationId` in its dependency array, but it also **sets** `conversationId` inside the effect. This caused:
1. Effect runs → sets `conversationId` → dependency changes
2. Dependency changes → Effect runs again → LOOP!

### 3. **Sync Effect Loop**
There was a second `useEffect` syncing `existingConversationId` to `conversationId` that had both in dependencies, causing additional loop triggers.

## Solutions Applied

### Fix 1: Removed Callback Dependencies
**File:** `hooks/use-conversational-intake.ts` (line 544)

Removed `addMessage`, `showFinalMessage`, `showFirstQuestion`, `showQuestion` from the initialization effect's dependency array. These callbacks don't need to trigger re-initialization - their **identities** changing doesn't affect the initialization logic.

```typescript
// Before:
}, [chatbotId, chatbotName, chatbotPurpose, questions, existingResponses, addMessage, showFinalMessage, showFirstQuestion, showQuestion, isInitialized, conversationId, existingConversationId]);

// After:
}, [chatbotId, chatbotName, chatbotPurpose, questions, existingResponses, isInitialized, existingConversationId]);
// eslint-disable-next-line react-hooks/exhaustive-deps
```

### Fix 2: Removed conversationId Dependency
**File:** `hooks/use-conversational-intake.ts` (line 548)

Removed `conversationId` from dependencies since it's **set inside** the effect. The effect should only run when external props change, not when it sets its own internal state.

### Fix 3: Added isInitializingRef Guard
**File:** `hooks/use-conversational-intake.ts` (line 98, 467, 480)

Added a ref-based flag to prevent re-entry into the initialization logic during async operations:

```typescript
const isInitializingRef = useRef(false);

// In useEffect:
if (!chatbotName || !chatbotPurpose || isInitialized || isInitializingRef.current) {
  return;
}

isInitializingRef.current = true;
```

This ensures that even if the effect somehow runs again during initialization, it won't re-enter the async initialization function.

### Fix 4: Removed Sync Effect
**File:** `hooks/use-conversational-intake.ts` (line 80-87)

Completely removed the useEffect that was syncing `existingConversationId` to `conversationId`. This was unnecessary since the initial state already handles `existingConversationId`:

```typescript
const [conversationId, setConversationId] = useState<string | null>(existingConversationId || null);
```

## Files Modified

- `hooks/use-conversational-intake.ts` - Fixed the loop and removed debug code
- `components/chat.tsx` - Removed debug component
- `components/debug-loop-viewer.tsx` - Deleted
- `lib/debug-helpers.ts` - Deleted
- `lib/debug-logger.ts` - Deleted

## Key Learnings

1. **useEffect dependencies must not include values that the effect itself sets** - this creates circular dependencies
2. **Callback identity changes** can trigger effects even when the logic doesn't need to re-run - be selective about callback dependencies
3. **Refs are useful for preventing re-entry** during async operations in effects
4. **Debug tooling helped identify the issue quickly** - loop detection caught the problem immediately with state snapshots

## Verification

The fix was verified by:
1. Loop detection system caught the issue (7 calls to `processQuestion` in 2 seconds)
2. After fix: Intake flow initializes once and proceeds normally
3. No more rapid function calls
4. `isInitialized` properly set to `true`

## Future Considerations

If loops appear again:
1. Check useEffect dependency arrays for circular dependencies
2. Look for callbacks that depend on frequently-changing state
3. Consider using refs for values that trigger re-renders but shouldn't affect logic
4. Use React DevTools Profiler to identify unnecessary re-renders
