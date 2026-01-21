# Prompt: Create Chat Component Refactoring Plan

**Date:** January 19, 2026  
**Context:** Chat component has become unmaintainable with competing state systems and timing issues. Need a refactoring plan to fix intake flow and simplify architecture.

---

## Current Situation

### Problem Summary
The chat component (`components/chat.tsx`, ~1800 lines) has multiple competing state management systems that cause:
1. **Flickering UI** - Multiple async operations trigger re-renders in sequence
2. **Broken intake flow** - Yes/Modify buttons don't appear for existing responses
3. **Race conditions** - Multiple effects running independently, resetting each other's state
4. **Unpredictable behavior** - Sometimes shows intake, sometimes doesn't, sometimes shows old completion message first

### Current Architecture Issues

#### 1. Multiple Competing State Systems
- `showConversationalIntake`: `null | true | false` (intake gate state)
- `intakeWelcomeData`: `null | WelcomeData` (welcome API response)
- Hook internal state: `conversationId`, `messages`, `verificationMode`, `isInitialized`, etc.
- Chat component state: `messages`, `conversationId`, `pills`, etc.

**Problem:** No single source of truth. State is managed in 3+ places, causing conflicts.

#### 2. Competing Render Conditions
The component has multiple conditions deciding what to render:
```typescript
// Empty state (line ~1069)
messages.length === 0 && showConversationalIntake !== true

// Completion message (line ~1076)
intakeWelcomeData?.intakeCompleted

// Intake flow (line ~1297)
showConversationalIntake === true && intakeHook.currentQuestionIndex >= 0

// Normal chat
// (implicit - when above conditions are false)
```

**Problem:** Multiple conditions can be true simultaneously, causing flicker and wrong UI.

#### 3. Async Race Conditions
Multiple effects run independently:
1. Welcome data fetch effect (lines 149-177)
2. Hook initialization effect (in `use-conversational-intake.ts`)
3. URL param effect (lines 179-215)
4. Message loading effect (lines 217-315)
5. Hook reset effect (recently added to fix timing)

**Problem:** Effects run in unpredictable order, resetting each other's state.

#### 4. Hook Initialization Timing Issues
The `useConversationalIntake` hook:
- Initializes when `chatbotName` and `chatbotPurpose` are provided
- But `questions` array might be empty initially (before welcome data loads)
- Tries to reset/re-initialize when questions load, but loses verification state
- Creates conversation before questions are available

**Problem:** Hook initializes too early, then tries to fix itself with fragile reset logic.

---

## Current Code Structure

### `components/chat.tsx` (~1800 lines)
**Responsibilities:**
- Message rendering (user/assistant bubbles, markdown, source attribution)
- Input area (textarea, send button, pills)
- Streaming responses (real-time updates)
- Conversation management (create, load, URL params)
- Intake gate logic (fetch welcome data, decide to show intake)
- Intake UI rendering (question counter, input fields, verification buttons)
- Pills management (suggestion, feedback, expansion)
- Bookmarking, copying, branching
- Theme/styling

**State Variables:**
- `messages`, `conversationId`, `isLoading`, `error`
- `pills`, `selectedFeedbackPill`, `selectedExpansionPill`, `selectedSuggestedPill`
- `bookmarkedMessages`, `pillsVisible`
- `initialSuggestionPills`
- `intakeWelcomeData`, `showConversationalIntake`

**Key Effects:**
1. Auth check (lines 118-147)
2. Welcome data fetch (lines 149-177) - **PROBLEMATIC**
3. URL param handling (lines 179-215) - **PROBLEMATIC**
4. Message loading (lines 217-315) - **PROBLEMATIC**
5. Pills loading (lines 345-363)
6. Various other effects

### `hooks/use-conversational-intake.ts` (~450 lines)
**Responsibilities:**
- Conversation creation
- Message management (add messages to conversation via API)
- Question flow (show questions one at a time)
- Response saving
- Verification flow (Yes/Modify buttons)
- Final message and pills

**State Variables:**
- `conversationId`, `messages`, `currentQuestionIndex`
- `verificationMode`, `verificationQuestionId`, `modifyMode`
- `currentInput`, `isSaving`, `error`
- `suggestionPills`, `showPills`, `isInitialized`

**Key Effects:**
1. Initialization effect (lines 355-397) - **PROBLEMATIC** (timing issues)
2. Reset effect (recently added) - **PROBLEMATIC** (fragile)

**API Endpoints Used:**
- `POST /api/conversations/create` - Create conversation
- `POST /api/conversations/[conversationId]/messages` - Add messages
- `POST /api/intake/responses` - Save responses
- `GET /api/pills?chatbotId=...` - Load suggestion pills

### `app/api/chatbots/[chatbotId]/welcome/route.ts`
**Returns:**
```typescript
{
  chatbotName: string;
  chatbotPurpose: string;
  intakeCompleted: boolean;
  hasQuestions: boolean;
  existingResponses?: Record<string, any>;
  questions?: IntakeQuestion[];
}
```

---

## Desired Outcome

### Goal
Create a clean, maintainable architecture where:
1. **Single source of truth** - One state system decides what to show
2. **Predictable flow** - Sequential: check → intake → chat (no race conditions)
3. **No flickering** - Single render decision, no competing conditions
4. **Working intake** - Yes/Modify buttons appear correctly for existing responses
5. **Separation of concerns** - Intake logic separate from chat logic

### Architecture Vision

```
Chat Page Component
│
├─ useIntakeGate Hook
│   ├─ Fetches welcome data
│   ├─ Decides: 'checking' | 'intake' | 'chat'
│   └─ Returns: gateState, welcomeData, onIntakeComplete
│
├─ If gateState === 'intake'
│   └─ IntakeFlow Component
│       ├─ Uses useConversationalIntake hook
│       ├─ Renders intake UI (questions, inputs, buttons)
│       └─ Calls onIntakeComplete when done
│
└─ If gateState === 'chat'
    └─ ChatContent Component
        ├─ Message rendering
        ├─ Input area
        ├─ Streaming
        └─ Pills
```

### Key Principles
1. **Single decision point** - `useIntakeGate` is the only place that decides intake vs chat
2. **Sequential operations** - No parallel competing effects
3. **Clear state flow** - `checking → intake → chat` (one direction)
4. **Separation** - Intake UI completely separate from chat UI
5. **No shared state** - Intake and chat don't share state (except conversationId after intake completes)

---

## Requirements & Constraints

### Must Preserve
- All existing functionality (message rendering, streaming, pills, bookmarks, etc.)
- API endpoints (don't change backend)
- User experience (same UI/UX, just more reliable)
- TypeScript types (maintain type safety)

### Must Fix
- Intake flow timing issues (buttons not showing)
- Flickering UI
- Race conditions between effects
- Competing render conditions

### Constraints
- No new dependencies (use existing React hooks, no new libraries)
- Follow existing code patterns (same styling, component structure)
- Keep file size reasonable (≤120 lines per file where possible, per project rules)
- Maintain backward compatibility (existing conversations still work)

### Testing Requirements
- Intake flow shows correctly for new conversations with questions
- Intake flow skips when `intakeCompleted === true`
- Intake flow skips when `hasQuestions === false`
- Yes/Modify buttons appear for existing responses
- Completion transitions to normal chat correctly
- No flickering during initialization
- Existing conversations load correctly

---

## Your Task

Create a detailed refactoring plan that:

1. **Analyzes the current problems** - Identify all issues with current architecture
2. **Proposes new architecture** - Design clean separation of concerns
3. **Details implementation steps** - Step-by-step plan with file changes
4. **Addresses risks** - What could go wrong and how to mitigate
5. **Provides migration path** - How to refactor incrementally without breaking things

### Plan Format
Follow the project's planning format (see `01-18_conversational-intake-flow.md` for reference):
- Objective
- Acceptance Criteria
- Clarifying Questions (if any)
- Minimal Approach
- Text Diagram
- Plan File Contents (detailed implementation)
- Work Plan (tasks and subtasks)
- Architectural Discipline (file limits, patterns)
- Risks & Edge Cases
- Tests

### Key Questions to Answer
1. How should `useIntakeGate` hook work? (What state does it manage? When does it decide?)
2. Should `IntakeFlow` be a component or just inline rendering? (Recommendation: component for separation)
3. How should intake messages integrate with chat? (Should they be in same message list or separate?)
4. How to handle the transition from intake to chat? (When intake completes, how does chat take over?)
5. What happens if user navigates away during intake? (Should progress be saved?)

### Success Criteria
The plan should result in:
- ✅ Single source of truth for intake vs chat decision
- ✅ No competing render conditions
- ✅ No race conditions between effects
- ✅ Intake flow works reliably (buttons show correctly)
- ✅ No flickering during initialization
- ✅ Clean separation of concerns
- ✅ Maintainable code structure

---

## Additional Context

### Related Files
- `components/chat.tsx` - Main chat component (needs refactoring)
- `hooks/use-conversational-intake.ts` - Intake hook (needs timing fixes)
- `app/api/chatbots/[chatbotId]/welcome/route.ts` - Welcome API (working, don't change)
- `app/api/conversations/create/route.ts` - Conversation creation API (working, don't change)
- `app/api/conversations/[conversationId]/messages/route.ts` - Message API (working, don't change)

### Previous Attempts
- Tried to fix timing issues by adding reset logic to hook (didn't work)
- Tried to integrate intake inline in chat (caused competing conditions)
- Current state: Intake partially works but buttons don't show, UI flickers

### Project Rules
- File size limit: ≤120 lines per file (can exceed with justification)
- Function limit: ≤5 exported functions per file
- Function size: ≤20 lines per function (justify if exceeded)
- No new dependencies without approval
- Prefer simple, efficient code
- Comment code for beginner programmers

---

**Create the refactoring plan now. Be thorough and detailed.**




