# Prompt: Rebuild Conversational Intake Flow Using Reducer Pattern

**Date:** 2025-01-19  
**Purpose:** Create comprehensive implementation plan for rebuilding intake flow  
**Target:** LLM (Claude/GPT-4)  
**Context:** Current implementation has multiple bugs due to complex state management


---

## Context

You are tasked with creating a **thorough implementation plan** to rebuild the conversational intake flow for a Next.js application using the **React reducer pattern**. The current implementation has multiple bugs and is difficult to maintain due to complex state management with 7+ interdependent state variables.

## Current Implementation

### File Structure
- **Hook:** `hooks/use-conversational-intake.ts` (~670 lines)
- **Component:** `components/intake-flow.tsx` (~311 lines)
- **Integration:** `components/chat.tsx` (intake hook integration)

### Current State Management
The hook currently uses multiple `useState` hooks:
```typescript
const [conversationId, setConversationId] = useState<string | null>(null);
const [messages, setMessages] = useState<IntakeMessage[]>([]);
const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(-1);
const [mode, setMode] = useState<IntakeMode>('question');
const [currentInput, setCurrentInput] = useState<any>('');
const [isSaving, setIsSaving] = useState(false);
const [error, setError] = useState<string | null>(null);
const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(false);
const [isInitialized, setIsInitialized] = useState(false);
// ... plus suggestion pills state
```

### Current Flow
1. **Initialization:** Creates conversation, shows welcome + first question
2. **Question Display:** Shows question with verification if existing response exists
3. **User Interaction:** 
   - Answer question (new or modify)
   - Skip question (if optional)
   - Verify existing response (Yes/Modify)
4. **Progression:** Moves to next question or shows final message
5. **Completion:** Shows suggestion pills, calls `onComplete` callback

### Current Problems

1. **State Synchronization Issues**
   - Multiple state variables that must stay in sync
   - React state batching causes timing issues
   - Backward compatibility helpers derive state, causing race conditions

2. **Bugs**
   - Verification buttons don't show after modifying a question
   - Questions are skipped when user has existing responses
   - Messages appear twice
   - State inconsistencies during transitions

3. **Maintainability**
   - Hard to reason about state transitions
   - Difficult to debug (state changes scattered)
   - Complex dependencies between callbacks

## Requirements

### Functional Requirements

1. **Question Flow**
   - Show all questions sequentially (no skipping)
   - Handle existing responses with verification flow
   - Support modify flow for existing responses
   - Support skip for optional questions
   - Show final message after all questions

2. **State Management**
   - Single source of truth (reducer state)
   - Type-safe state transitions
   - Predictable state updates
   - No race conditions

3. **Error Handling**
   - Network errors during save
   - Validation errors
   - Retry logic for failed operations

4. **Integration**
   - Must work with existing `chat.tsx` component
   - Must preserve `onMessageAdded` callback
   - Must preserve `onComplete` callback
   - Must maintain same interface for `IntakeFlow` component

### Technical Requirements

1. **TypeScript**
   - Fully typed state and actions
   - No `any` types
   - Proper type inference

2. **React Patterns**
   - Use `useReducer` for state management
   - Use `useCallback` for action creators
   - Proper dependency arrays
   - No unnecessary re-renders

3. **Performance**
   - Minimize re-renders
   - Efficient state updates
   - Proper memoization

4. **Testing**
   - Testable reducer (pure function)
   - Testable action creators
   - Easy to mock dependencies

## Reducer Pattern Specification

### State Structure

Create a comprehensive `IntakeState` type that includes:
- Current phase/status
- Conversation ID
- Current question index
- Mode (question/verification/modify)
- Current input value
- Error state
- Loading states
- Messages array
- Questions array
- Existing responses map
- Suggestion pills
- Initialization status

### Action Types

Define a union type `IntakeAction` with actions for:
- Initialization
- Conversation creation
- Question display
- Answer submission
- Verification (Yes/Modify)
- Skip
- Error handling
- Final message
- Completion

### Reducer Function

Create a pure reducer function that:
- Takes current state and action
- Returns new state
- Handles all state transitions
- Includes comprehensive logging
- Validates state transitions
- Prevents invalid states

### Action Creators

Create action creator functions that:
- Return properly typed actions
- Include necessary data
- Handle async operations (via thunks or effects)
- Provide good error messages

## Deliverables

Create a **comprehensive implementation plan** that includes:

### 1. Architecture Design
- State structure design (detailed type definitions)
- Action type definitions (complete union type)
- Reducer function structure
- Action creator patterns
- Integration with existing code

### 2. Implementation Steps
Break down into clear, sequential steps:
- Step 1: Define types and interfaces
- Step 2: Create reducer function
- Step 3: Create action creators
- Step 4: Refactor hook to use reducer
- Step 5: Update component integration
- Step 6: Remove old code
- Step 7: Testing

Each step should include:
- What to do
- Why it's needed
- Code examples/snippets
- Dependencies on previous steps
- Testing approach

### 3. Migration Strategy
- How to preserve existing functionality
- How to handle backward compatibility
- How to test incrementally
- Rollback plan if needed

### 4. Testing Plan
- Unit tests for reducer
- Unit tests for action creators
- Integration tests for hook
- E2E tests for full flow
- Test cases for edge cases

### 5. Code Examples
Provide example code for:
- State type definition
- Action type definitions
- Reducer function (key cases)
- Action creators (key examples)
- Hook integration
- Component usage

### 6. Edge Cases
Document handling for:
- Network failures
- Invalid state transitions
- Missing data
- Concurrent actions
- Race conditions

### 7. Performance Considerations
- State update optimization
- Memoization strategies
- Re-render prevention
- Bundle size impact

## Constraints

1. **Must Preserve**
   - Existing API interface (`UseConversationalIntakeReturn`)
   - Existing component interface (`IntakeFlow` props)
   - Existing callback signatures
   - Existing message structure

2. **Must Not Break**
   - Chat component integration
   - Message persistence
   - Conversation creation
   - Error handling flow

3. **Must Improve**
   - State management clarity
   - Bug prevention
   - Maintainability
   - Testability

## Success Criteria

The plan should result in:

1. ✅ **Single source of truth** - One state object managed by reducer
2. ✅ **Type safety** - Full TypeScript coverage, no `any` types
3. ✅ **Predictable** - All state transitions explicit and documented
4. ✅ **Testable** - Reducer is pure function, easy to test
5. ✅ **Maintainable** - Clear structure, easy to understand
6. ✅ **Bug-free** - Fixes all current bugs
7. ✅ **Performant** - No unnecessary re-renders
8. ✅ **Backward compatible** - Works with existing code

## Additional Context

### Current Bugs to Fix
1. Verification buttons don't show after modify
2. Questions skipped when existing responses present
3. Messages duplicated
4. State inconsistencies during transitions

### Current Code Locations
- Hook: `hooks/use-conversational-intake.ts`
- Component: `components/intake-flow.tsx`
- Integration: `components/chat.tsx` (lines ~945-988)

### Dependencies
- React 18+
- TypeScript 5+
- Clerk auth (`useAuth`)
- Custom components (`Pill`, `Button`, etc.)

## Output Format

Create a detailed markdown document with:

1. **Executive Summary** - Overview of approach
2. **Architecture** - State structure, actions, reducer design
3. **Implementation Plan** - Step-by-step guide
4. **Code Examples** - Key code snippets
5. **Migration Guide** - How to transition
6. **Testing Strategy** - How to test
7. **Risk Assessment** - Potential issues and mitigations
8. **Timeline Estimate** - Time for each phase

## Questions to Consider

1. How to handle async operations (save, fetch) with reducer?
2. How to integrate with existing callbacks?
3. How to handle side effects (API calls, navigation)?
4. How to maintain backward compatibility?
5. How to optimize performance?
6. How to structure action creators for clarity?
7. How to handle error states?
8. How to test reducer effectively?

## Expected Output

A comprehensive, actionable plan that:
- Can be followed step-by-step
- Includes all necessary code examples
- Addresses all edge cases
- Provides clear migration path
- Includes testing approach
- Estimates time/complexity

---

**Note:** This plan should be thorough enough that a developer can implement the rebuild without needing to make architectural decisions. Include specific code examples, type definitions, and clear step-by-step instructions.

