# Intake Loop Debugging Guide

## What's Been Added

### 1. Loop Detection System
The intake hook now has automatic loop detection that:
- Tracks how many times critical functions are called
- If a function is called >5 times in 2 seconds → **Loop detected!**
- Automatically stops the loop and stores debug info

### 2. Visual Debug Component
A red error box appears on screen when a loop is detected showing:
- Which function caused the loop
- How many times it was called
- Current state snapshot

### 3. Browser Console Tools
Debug commands available in your browser console:

```javascript
// View the loop error
window.debugIntake.viewLoopError()

// Clear the loop error
window.debugIntake.clearLoopError()

// View all debug logs
window.debugIntake.viewLogs()

// Clear all logs
window.debugIntake.clearLogs()

// Export all logs to JSON file
window.debugIntake.exportLogs()
```

## How to Debug the Loop

### Step 1: Reproduce the Loop
1. Run your dev server: `npm run dev`
2. Open your chat page in the browser
3. Start the intake flow
4. The loop should trigger

### Step 2: Capture the Error
When the loop happens:
- A **red error box** will appear in the bottom-right corner
- The browser console will show the error
- The error is automatically saved to localStorage

### Step 3: Inspect the Error
In the browser console, run:
```javascript
window.debugIntake.viewLoopError()
```

This will show you:
- `functionName` - Which function is looping
- `callCount` - How many times it was called
- `state` - The state when the loop was detected
  - `currentQuestionIndex`
  - `mode` (question/verification/modify)
  - `conversationId`
  - `isInitialized`
  - `messagesCount`

### Step 4: Share the Error with Me
Either:
1. Copy the error from the red box
2. Take a screenshot
3. Export logs: `window.debugIntake.exportLogs()` and share the JSON file

## Common Loop Patterns to Look For

Based on the code, here are likely culprits:

### Pattern 1: Initialization Loop
**Symptom:** `processQuestion` or `showQuestion` called repeatedly
**Likely cause:** The initialization `useEffect` keeps triggering
**Look for:**
- `conversationId` changing unexpectedly
- `existingConversationId` changing
- Questions array reference changing

### Pattern 2: Verification Loop
**Symptom:** `handleVerifyYes` called repeatedly
**Likely cause:** State not being set correctly after clicking "Yes"
**Look for:**
- `mode` not transitioning properly
- `currentQuestionIndex` not incrementing

### Pattern 3: State Update Loop
**Symptom:** `processQuestion` called in rapid succession
**Likely cause:** State updates triggering callbacks which trigger more state updates
**Look for:**
- `showQuestion` being called in a callback dependency
- `processQuestion` dependencies causing re-execution

## Enable Debug Mode

For even more detailed logging, edit the hook:

```typescript
// In hooks/use-conversational-intake.ts
const DEBUG_INTAKE = true; // Change to true
```

This will log every function call with a counter.

## After Finding the Issue

Once we identify the loop:
1. Share the error details with me
2. I'll implement a fix
3. We can remove the debug components:
   - Remove `<DebugLoopViewer />` from chat.tsx
   - Remove the debug import
   - Set `DEBUG_INTAKE = false`

## Files Modified

- `hooks/use-conversational-intake.ts` - Added loop detection
- `components/chat.tsx` - Added DebugLoopViewer
- `components/debug-loop-viewer.tsx` - New debug component
- `lib/debug-helpers.ts` - Console helper functions
- `lib/debug-logger.ts` - File logging utilities (not used yet)

## Quick Reset

If you need to clear everything and start fresh:

```javascript
// In browser console:
window.debugIntake.clearLoopError()
window.debugIntake.clearLogs()
localStorage.clear() // Nuclear option - clears everything
```

Or reset your intake data in the database:
```bash
# Run the reset script
npx tsx scripts/reset-user-intake-data.ts
```

Make sure to update the `userId` in the script first!
