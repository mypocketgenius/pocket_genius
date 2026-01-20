# Implementation Plan: Rebuild Conversational Intake Flow Using Reducer Pattern

**Date:** 2025-01-19  
**Status:** Ready for Implementation  
**Estimated Time:** 8-12 hours

---

## Executive Summary

This plan outlines a complete rebuild of the conversational intake flow using React's `useReducer` pattern to replace the current multi-state implementation. The rebuild will eliminate state synchronization bugs, improve maintainability, and create a single source of truth for intake flow state.

### Key Benefits
- ✅ Single source of truth (reducer state)
- ✅ Type-safe state transitions
- ✅ Predictable state updates
- ✅ Eliminates race conditions
- ✅ Fixes all current bugs
- ✅ Maintains backward compatibility

### Approach
1. Define comprehensive state structure and action types
2. Create pure reducer function
3. Refactor hook to use reducer
4. Update component integration
5. Test thoroughly
6. Remove old code

---

## Architecture Design

### 1. State Structure

```typescript
/**
 * Phase of the intake flow
 */
export type IntakePhase = 
  | 'initializing'      // Creating conversation
  | 'welcome'           // Showing welcome message
  | 'question'          // Showing question (no existing response)
  | 'verification'      // Showing question with existing response (Yes/Modify)
  | 'modify'            // Modifying existing response
  | 'saving'            // Saving response to API
  | 'final'             // Showing final message and pills
  | 'completed';        // Intake complete, ready for chat

/**
 * Complete state structure for intake flow
 */
export interface IntakeState {
  // Phase/Status
  phase: IntakePhase;
  
  // Conversation
  conversationId: string | null;
  
  // Questions
  questions: IntakeQuestion[];
  currentQuestionIndex: number; // -1 = welcome, -2 = final, >= 0 = question index
  existingResponses: Record<string, any>;
  
  // Current question state
  currentInput: any;
  mode: IntakeMode; // 'question' | 'verification' | 'modify'
  
  // Messages
  messages: IntakeMessage[];
  
  // Loading states
  isSaving: boolean;
  isLoadingNextQuestion: boolean;
  isInitialized: boolean;
  
  // Error handling
  error: string | null;
  errorRetryCount: number;
  
  // Completion
  suggestionPills: PillType[];
  showPills: boolean;
  
  // Metadata
  chatbotId: string;
  chatbotName: string;
  chatbotPurpose: string;
}
```

### 2. Action Types

```typescript
/**
 * Base action interface
 */
interface BaseAction {
  type: string;
  timestamp?: number;
}

/**
 * Action types for intake flow
 */
export type IntakeAction =
  // Initialization
  | { type: 'INIT_START'; payload: { chatbotId: string; chatbotName: string; chatbotPurpose: string; questions: IntakeQuestion[]; existingResponses: Record<string, any> } }
  | { type: 'INIT_CONVERSATION_CREATED'; payload: { conversationId: string } }
  | { type: 'INIT_COMPLETE' }
  | { type: 'INIT_ERROR'; payload: { error: string } }
  
  // Question flow
  | { type: 'SHOW_WELCOME'; payload: { conversationId: string } }
  | { type: 'SHOW_QUESTION'; payload: { index: number; hasExisting: boolean } }
  | { type: 'SHOW_VERIFICATION'; payload: { index: number; existingValue: any } }
  | { type: 'ENTER_MODIFY_MODE'; payload: { existingValue: any } }
  | { type: 'SHOW_FINAL_MESSAGE'; payload: { conversationId: string } }
  
  // User interactions
  | { type: 'SET_INPUT'; payload: { value: any } }
  | { type: 'SUBMIT_ANSWER_START'; payload: { value: any } }
  | { type: 'SUBMIT_ANSWER_SUCCESS'; payload: { questionId: string; value: any; message: IntakeMessage } }
  | { type: 'SUBMIT_ANSWER_ERROR'; payload: { error: string } }
  | { type: 'VERIFY_YES' }
  | { type: 'VERIFY_MODIFY' }
  | { type: 'SKIP_START' }
  | { type: 'SKIP_SUCCESS'; payload: { message: IntakeMessage } }
  | { type: 'SKIP_ERROR'; payload: { error: string } }
  
  // Message management
  | { type: 'ADD_MESSAGE'; payload: { message: IntakeMessage } }
  | { type: 'ADD_MESSAGES'; payload: { messages: IntakeMessage[] } }
  
  // Progression
  | { type: 'MOVE_TO_NEXT_QUESTION' }
  | { type: 'COMPLETE_INTAKE'; payload: { pills: PillType[] } }
  
  // Error handling
  | { type: 'SET_ERROR'; payload: { error: string | null } }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RETRY_OPERATION' }
  
  // Loading states
  | { type: 'SET_SAVING'; payload: { isSaving: boolean } }
  | { type: 'SET_LOADING_NEXT'; payload: { isLoading: boolean } };
```

### 3. Reducer Function Structure

```typescript
/**
 * Pure reducer function for intake flow
 * Handles all state transitions
 */
export function intakeReducer(
  state: IntakeState,
  action: IntakeAction
): IntakeState {
  // Add timestamp to action for debugging
  const timestamp = Date.now();
  
  console.log(`[IntakeReducer] ${action.type}`, {
    timestamp,
    currentPhase: state.phase,
    currentQuestionIndex: state.currentQuestionIndex,
    action
  });
  
  switch (action.type) {
    // Initialization cases
    case 'INIT_START':
      return {
        ...state,
        phase: 'initializing',
        chatbotId: action.payload.chatbotId,
        chatbotName: action.payload.chatbotName,
        chatbotPurpose: action.payload.chatbotPurpose,
        questions: action.payload.questions,
        existingResponses: action.payload.existingResponses,
        error: null,
      };
    
    case 'INIT_CONVERSATION_CREATED':
      return {
        ...state,
        conversationId: action.payload.conversationId,
      };
    
    case 'INIT_COMPLETE':
      return {
        ...state,
        phase: state.questions.length === 0 ? 'final' : 'welcome',
        isInitialized: true,
      };
    
    case 'INIT_ERROR':
      return {
        ...state,
        phase: 'completed', // Allow fallback to chat
        error: action.payload.error,
        isInitialized: true,
      };
    
    // Question flow cases
    case 'SHOW_WELCOME':
      return {
        ...state,
        phase: 'welcome',
        currentQuestionIndex: -1,
        mode: 'question',
        currentInput: '',
        error: null,
      };
    
    case 'SHOW_QUESTION':
      const question = state.questions[action.payload.index];
      if (!question) {
        console.error('[IntakeReducer] Invalid question index', action.payload.index);
        return state;
      }
      
      return {
        ...state,
        phase: 'question',
        currentQuestionIndex: action.payload.index,
        mode: 'question',
        currentInput: '',
        error: null,
      };
    
    case 'SHOW_VERIFICATION':
      const verifyQuestion = state.questions[action.payload.index];
      if (!verifyQuestion) {
        console.error('[IntakeReducer] Invalid question index for verification', action.payload.index);
        return state;
      }
      
      return {
        ...state,
        phase: 'verification',
        currentQuestionIndex: action.payload.index,
        mode: 'verification',
        currentInput: '',
        error: null,
      };
    
    case 'ENTER_MODIFY_MODE':
      return {
        ...state,
        phase: 'modify',
        mode: 'modify',
        currentInput: action.payload.existingValue,
        error: null,
      };
    
    case 'SHOW_FINAL_MESSAGE':
      return {
        ...state,
        phase: 'final',
        currentQuestionIndex: -2,
        mode: 'question',
        currentInput: '',
        error: null,
      };
    
    // User interaction cases
    case 'SET_INPUT':
      return {
        ...state,
        currentInput: action.payload.value,
        error: null, // Clear error when user types
      };
    
    case 'SUBMIT_ANSWER_START':
      return {
        ...state,
        phase: 'saving',
        isSaving: true,
        error: null,
      };
    
    case 'SUBMIT_ANSWER_SUCCESS':
      return {
        ...state,
        isSaving: false,
        phase: 'question', // Will transition to next question
        currentInput: '',
        error: null,
      };
    
    case 'SUBMIT_ANSWER_ERROR':
      return {
        ...state,
        phase: state.mode === 'modify' ? 'modify' : 'question',
        isSaving: false,
        error: action.payload.error,
        errorRetryCount: state.errorRetryCount + 1,
      };
    
    case 'VERIFY_YES':
      if (state.phase !== 'verification') {
        console.warn('[IntakeReducer] VERIFY_YES called outside verification phase', state.phase);
        return state;
      }
      return {
        ...state,
        phase: 'question', // Will transition to next question
        mode: 'question',
        currentInput: '',
        error: null,
      };
    
    case 'VERIFY_MODIFY':
      if (state.phase !== 'verification') {
        console.warn('[IntakeReducer] VERIFY_MODIFY called outside verification phase', state.phase);
        return state;
      }
      const existingValue = state.existingResponses[state.questions[state.currentQuestionIndex]?.id];
      return {
        ...state,
        phase: 'modify',
        mode: 'modify',
        currentInput: existingValue,
        error: null,
      };
    
    case 'SKIP_START':
      return {
        ...state,
        isSaving: true,
        error: null,
      };
    
    case 'SKIP_SUCCESS':
      return {
        ...state,
        isSaving: false,
        phase: 'question', // Will transition to next question
        error: null,
      };
    
    case 'SKIP_ERROR':
      return {
        ...state,
        isSaving: false,
        error: action.payload.error,
      };
    
    // Message management
    case 'ADD_MESSAGE':
      // Deduplicate by message ID
      if (state.messages.some(msg => msg.id === action.payload.message.id)) {
        console.warn('[IntakeReducer] Message already exists, skipping', action.payload.message.id);
        return state;
      }
      return {
        ...state,
        messages: [...state.messages, action.payload.message],
      };
    
    case 'ADD_MESSAGES':
      // Deduplicate all messages
      const existingIds = new Set(state.messages.map(msg => msg.id));
      const newMessages = action.payload.messages.filter(msg => !existingIds.has(msg.id));
      return {
        ...state,
        messages: [...state.messages, ...newMessages],
      };
    
    // Progression
    case 'MOVE_TO_NEXT_QUESTION':
      const nextIndex = state.currentQuestionIndex + 1;
      if (nextIndex >= state.questions.length) {
        return {
          ...state,
          phase: 'final',
          currentQuestionIndex: -2,
        };
      }
      // State will be set by SHOW_QUESTION or SHOW_VERIFICATION action
      return state;
    
    case 'COMPLETE_INTAKE':
      return {
        ...state,
        phase: 'completed',
        suggestionPills: action.payload.pills,
        showPills: true,
      };
    
    // Error handling
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload.error,
      };
    
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
        errorRetryCount: 0,
      };
    
    case 'RETRY_OPERATION':
      return {
        ...state,
        error: null,
        errorRetryCount: 0,
      };
    
    // Loading states
    case 'SET_SAVING':
      return {
        ...state,
        isSaving: action.payload.isSaving,
      };
    
    case 'SET_LOADING_NEXT':
      return {
        ...state,
        isLoadingNextQuestion: action.payload.isLoading,
      };
    
    default:
      console.warn('[IntakeReducer] Unknown action type', (action as any).type);
      return state;
  }
}
```

### 4. Initial State Factory

```typescript
/**
 * Create initial state for intake flow
 */
export function createInitialIntakeState(): IntakeState {
  return {
    phase: 'initializing',
    conversationId: null,
    questions: [],
    currentQuestionIndex: -1,
    existingResponses: {},
    currentInput: '',
    mode: 'question',
    messages: [],
    isSaving: false,
    isLoadingNextQuestion: false,
    isInitialized: false,
    error: null,
    errorRetryCount: 0,
    suggestionPills: [],
    showPills: false,
    chatbotId: '',
    chatbotName: '',
    chatbotPurpose: '',
  };
}
```

---

## Implementation Steps

### Step 1: Define Types and Interfaces (30 min)

**What:** Create comprehensive type definitions for state, actions, and helper types.

**Why:** Foundation for type-safe reducer implementation.

**Files to create/modify:**
- `hooks/use-conversational-intake.ts` (add types at top)

**Code:**

```typescript
// Add to hooks/use-conversational-intake.ts

// ... existing IntakeQuestion, IntakeMessage, IntakeMode types ...

import { Pill as PillType } from '../components/pills/pill';

// New types for reducer pattern
export type IntakePhase = 
  | 'initializing'
  | 'welcome'
  | 'question'
  | 'verification'
  | 'modify'
  | 'saving'
  | 'final'
  | 'completed';

export interface IntakeState {
  phase: IntakePhase;
  conversationId: string | null;
  questions: IntakeQuestion[];
  currentQuestionIndex: number;
  existingResponses: Record<string, any>;
  currentInput: any;
  mode: IntakeMode;
  messages: IntakeMessage[];
  isSaving: boolean;
  isLoadingNextQuestion: boolean;
  isInitialized: boolean;
  error: string | null;
  errorRetryCount: number;
  suggestionPills: PillType[];
  showPills: boolean;
  chatbotId: string;
  chatbotName: string;
  chatbotPurpose: string;
}

export type IntakeAction =
  | { type: 'INIT_START'; payload: { chatbotId: string; chatbotName: string; chatbotPurpose: string; questions: IntakeQuestion[]; existingResponses: Record<string, any> } }
  | { type: 'INIT_CONVERSATION_CREATED'; payload: { conversationId: string } }
  | { type: 'INIT_COMPLETE' }
  | { type: 'INIT_ERROR'; payload: { error: string } }
  | { type: 'SHOW_WELCOME'; payload: { conversationId: string } }
  | { type: 'SHOW_QUESTION'; payload: { index: number; hasExisting: boolean } }
  | { type: 'SHOW_VERIFICATION'; payload: { index: number; existingValue: any } }
  | { type: 'ENTER_MODIFY_MODE'; payload: { existingValue: any } }
  | { type: 'SHOW_FINAL_MESSAGE'; payload: { conversationId: string } }
  | { type: 'SET_INPUT'; payload: { value: any } }
  | { type: 'SUBMIT_ANSWER_START'; payload: { value: any } }
  | { type: 'SUBMIT_ANSWER_SUCCESS'; payload: { questionId: string; value: any; message: IntakeMessage } }
  | { type: 'SUBMIT_ANSWER_ERROR'; payload: { error: string } }
  | { type: 'VERIFY_YES' }
  | { type: 'VERIFY_MODIFY' }
  | { type: 'SKIP_START' }
  | { type: 'SKIP_SUCCESS'; payload: { message: IntakeMessage } }
  | { type: 'SKIP_ERROR'; payload: { error: string } }
  | { type: 'ADD_MESSAGE'; payload: { message: IntakeMessage } }
  | { type: 'ADD_MESSAGES'; payload: { messages: IntakeMessage[] } }
  | { type: 'MOVE_TO_NEXT_QUESTION' }
  | { type: 'COMPLETE_INTAKE'; payload: { pills: PillType[] } }
  | { type: 'SET_ERROR'; payload: { error: string | null } }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RETRY_OPERATION' }
  | { type: 'SET_SAVING'; payload: { isSaving: boolean } }
  | { type: 'SET_LOADING_NEXT'; payload: { isLoading: boolean } };
```

**Testing:**
- TypeScript compilation should pass
- No type errors

**Dependencies:** None

---

### Step 2: Create Reducer Function (2 hours)

**What:** Implement pure reducer function with all state transition logic.

**Why:** Single source of truth for state updates, eliminates race conditions.

**Files to create/modify:**
- `hooks/use-conversational-intake.ts` (add reducer function)

**Code:**

```typescript
// Add to hooks/use-conversational-intake.ts

/**
 * Create initial state for intake flow
 */
function createInitialIntakeState(): IntakeState {
  return {
    phase: 'initializing',
    conversationId: null,
    questions: [],
    currentQuestionIndex: -1,
    existingResponses: {},
    currentInput: '',
    mode: 'question',
    messages: [],
    isSaving: false,
    isLoadingNextQuestion: false,
    isInitialized: false,
    error: null,
    errorRetryCount: 0,
    suggestionPills: [],
    showPills: false,
    chatbotId: '',
    chatbotName: '',
    chatbotPurpose: '',
  };
}

/**
 * Pure reducer function for intake flow
 */
function intakeReducer(
  state: IntakeState,
  action: IntakeAction
): IntakeState {
  const timestamp = Date.now();
  
  console.log(`[IntakeReducer] ${action.type}`, {
    timestamp,
    currentPhase: state.phase,
    currentQuestionIndex: state.currentQuestionIndex,
    action
  });
  
  switch (action.type) {
    case 'INIT_START':
      return {
        ...state,
        phase: 'initializing',
        chatbotId: action.payload.chatbotId,
        chatbotName: action.payload.chatbotName,
        chatbotPurpose: action.payload.chatbotPurpose,
        questions: action.payload.questions,
        existingResponses: action.payload.existingResponses,
        error: null,
      };
    
    case 'INIT_CONVERSATION_CREATED':
      return {
        ...state,
        conversationId: action.payload.conversationId,
      };
    
    case 'INIT_COMPLETE':
      return {
        ...state,
        phase: state.questions.length === 0 ? 'final' : 'welcome',
        isInitialized: true,
      };
    
    case 'INIT_ERROR':
      return {
        ...state,
        phase: 'completed',
        error: action.payload.error,
        isInitialized: true,
      };
    
    case 'SHOW_WELCOME':
      return {
        ...state,
        phase: 'welcome',
        currentQuestionIndex: -1,
        mode: 'question',
        currentInput: '',
        error: null,
      };
    
    case 'SHOW_QUESTION':
      const question = state.questions[action.payload.index];
      if (!question) {
        console.error('[IntakeReducer] Invalid question index', action.payload.index);
        return state;
      }
      
      return {
        ...state,
        phase: 'question',
        currentQuestionIndex: action.payload.index,
        mode: 'question',
        currentInput: '',
        error: null,
      };
    
    case 'SHOW_VERIFICATION':
      const verifyQuestion = state.questions[action.payload.index];
      if (!verifyQuestion) {
        console.error('[IntakeReducer] Invalid question index for verification', action.payload.index);
        return state;
      }
      
      return {
        ...state,
        phase: 'verification',
        currentQuestionIndex: action.payload.index,
        mode: 'verification',
        currentInput: '',
        error: null,
      };
    
    case 'ENTER_MODIFY_MODE':
      return {
        ...state,
        phase: 'modify',
        mode: 'modify',
        currentInput: action.payload.existingValue,
        error: null,
      };
    
    case 'SHOW_FINAL_MESSAGE':
      return {
        ...state,
        phase: 'final',
        currentQuestionIndex: -2,
        mode: 'question',
        currentInput: '',
        error: null,
      };
    
    case 'SET_INPUT':
      return {
        ...state,
        currentInput: action.payload.value,
        error: null,
      };
    
    case 'SUBMIT_ANSWER_START':
      return {
        ...state,
        phase: 'saving',
        isSaving: true,
        error: null,
      };
    
    case 'SUBMIT_ANSWER_SUCCESS':
      return {
        ...state,
        isSaving: false,
        phase: 'question',
        currentInput: '',
        error: null,
      };
    
    case 'SUBMIT_ANSWER_ERROR':
      return {
        ...state,
        phase: state.mode === 'modify' ? 'modify' : 'question',
        isSaving: false,
        error: action.payload.error,
        errorRetryCount: state.errorRetryCount + 1,
      };
    
    case 'VERIFY_YES':
      if (state.phase !== 'verification') {
        console.warn('[IntakeReducer] VERIFY_YES called outside verification phase', state.phase);
        return state;
      }
      return {
        ...state,
        phase: 'question',
        mode: 'question',
        currentInput: '',
        error: null,
      };
    
    case 'VERIFY_MODIFY':
      if (state.phase !== 'verification') {
        console.warn('[IntakeReducer] VERIFY_MODIFY called outside verification phase', state.phase);
        return state;
      }
      const currentQ = state.questions[state.currentQuestionIndex];
      const existingValue = currentQ ? state.existingResponses[currentQ.id] : null;
      return {
        ...state,
        phase: 'modify',
        mode: 'modify',
        currentInput: existingValue,
        error: null,
      };
    
    case 'SKIP_START':
      return {
        ...state,
        isSaving: true,
        error: null,
      };
    
    case 'SKIP_SUCCESS':
      return {
        ...state,
        isSaving: false,
        phase: 'question',
        error: null,
      };
    
    case 'SKIP_ERROR':
      return {
        ...state,
        isSaving: false,
        error: action.payload.error,
      };
    
    case 'ADD_MESSAGE':
      if (state.messages.some(msg => msg.id === action.payload.message.id)) {
        console.warn('[IntakeReducer] Message already exists, skipping', action.payload.message.id);
        return state;
      }
      return {
        ...state,
        messages: [...state.messages, action.payload.message],
      };
    
    case 'ADD_MESSAGES':
      const existingIds = new Set(state.messages.map(msg => msg.id));
      const newMessages = action.payload.messages.filter(msg => !existingIds.has(msg.id));
      return {
        ...state,
        messages: [...state.messages, ...newMessages],
      };
    
    case 'MOVE_TO_NEXT_QUESTION':
      const nextIndex = state.currentQuestionIndex + 1;
      if (nextIndex >= state.questions.length) {
        return {
          ...state,
          phase: 'final',
          currentQuestionIndex: -2,
        };
      }
      return state;
    
    case 'COMPLETE_INTAKE':
      return {
        ...state,
        phase: 'completed',
        suggestionPills: action.payload.pills,
        showPills: true,
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload.error,
      };
    
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
        errorRetryCount: 0,
      };
    
    case 'RETRY_OPERATION':
      return {
        ...state,
        error: null,
        errorRetryCount: 0,
      };
    
    case 'SET_SAVING':
      return {
        ...state,
        isSaving: action.payload.isSaving,
      };
    
    case 'SET_LOADING_NEXT':
      return {
        ...state,
        isLoadingNextQuestion: action.payload.isLoading,
      };
    
    default:
      const _exhaustive: never = action;
      console.warn('[IntakeReducer] Unknown action type', (action as any).type);
      return state;
  }
}
```

**Testing:**
- Unit tests for each action type
- Test state transitions
- Test edge cases (invalid indices, etc.)

**Dependencies:** Step 1

---

### Step 3: Create Action Creators and Side Effects (2 hours)

**What:** Create action creator functions and handle async operations (API calls).

**Why:** Encapsulate action creation and handle side effects properly.

**Files to create/modify:**
- `hooks/use-conversational-intake.ts` (add action creators and side effect handlers)

**Code:**

```typescript
// Add to hooks/use-conversational-intake.ts

/**
 * Action creators - return properly typed actions
 */
const intakeActions = {
  initStart: (chatbotId: string, chatbotName: string, chatbotPurpose: string, questions: IntakeQuestion[], existingResponses: Record<string, any>) => ({
    type: 'INIT_START' as const,
    payload: { chatbotId, chatbotName, chatbotPurpose, questions, existingResponses },
  }),
  
  initConversationCreated: (conversationId: string) => ({
    type: 'INIT_CONVERSATION_CREATED' as const,
    payload: { conversationId },
  }),
  
  initComplete: () => ({
    type: 'INIT_COMPLETE' as const,
  }),
  
  initError: (error: string) => ({
    type: 'INIT_ERROR' as const,
    payload: { error },
  }),
  
  showWelcome: (conversationId: string) => ({
    type: 'SHOW_WELCOME' as const,
    payload: { conversationId },
  }),
  
  showQuestion: (index: number, hasExisting: boolean) => ({
    type: 'SHOW_QUESTION' as const,
    payload: { index, hasExisting },
  }),
  
  showVerification: (index: number, existingValue: any) => ({
    type: 'SHOW_VERIFICATION' as const,
    payload: { index, existingValue },
  }),
  
  enterModifyMode: (existingValue: any) => ({
    type: 'ENTER_MODIFY_MODE' as const,
    payload: { existingValue },
  }),
  
  showFinalMessage: (conversationId: string) => ({
    type: 'SHOW_FINAL_MESSAGE' as const,
    payload: { conversationId },
  }),
  
  setInput: (value: any) => ({
    type: 'SET_INPUT' as const,
    payload: { value },
  }),
  
  submitAnswerStart: (value: any) => ({
    type: 'SUBMIT_ANSWER_START' as const,
    payload: { value },
  }),
  
  submitAnswerSuccess: (questionId: string, value: any, message: IntakeMessage) => ({
    type: 'SUBMIT_ANSWER_SUCCESS' as const,
    payload: { questionId, value, message },
  }),
  
  submitAnswerError: (error: string) => ({
    type: 'SUBMIT_ANSWER_ERROR' as const,
    payload: { error },
  }),
  
  verifyYes: () => ({
    type: 'VERIFY_YES' as const,
  }),
  
  verifyModify: () => ({
    type: 'VERIFY_MODIFY' as const,
  }),
  
  skipStart: () => ({
    type: 'SKIP_START' as const,
  }),
  
  skipSuccess: (message: IntakeMessage) => ({
    type: 'SKIP_SUCCESS' as const,
    payload: { message },
  }),
  
  skipError: (error: string) => ({
    type: 'SKIP_ERROR' as const,
    payload: { error },
  }),
  
  addMessage: (message: IntakeMessage) => ({
    type: 'ADD_MESSAGE' as const,
    payload: { message },
  }),
  
  addMessages: (messages: IntakeMessage[]) => ({
    type: 'ADD_MESSAGES' as const,
    payload: { messages },
  }),
  
  moveToNextQuestion: () => ({
    type: 'MOVE_TO_NEXT_QUESTION' as const,
  }),
  
  completeIntake: (pills: PillType[]) => ({
    type: 'COMPLETE_INTAKE' as const,
    payload: { pills },
  }),
  
  setError: (error: string | null) => ({
    type: 'SET_ERROR' as const,
    payload: { error },
  }),
  
  clearError: () => ({
    type: 'CLEAR_ERROR' as const,
  }),
  
  retryOperation: () => ({
    type: 'RETRY_OPERATION' as const,
  }),
  
  setSaving: (isSaving: boolean) => ({
    type: 'SET_SAVING' as const,
    payload: { isSaving },
  }),
  
  setLoadingNext: (isLoading: boolean) => ({
    type: 'SET_LOADING_NEXT' as const,
    payload: { isLoading },
  }),
};
```

**Side Effect Handlers:**

```typescript
// Helper functions for async operations (used in hook)

/**
 * Create conversation via API
 */
async function createConversation(chatbotId: string): Promise<string> {
  const response = await fetch('/api/conversations/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatbotId }),
  });

  if (!response.ok) {
    throw new Error('Failed to create conversation');
  }

  const data = await response.json();
  return data.conversation.id;
}

/**
 * Add message to conversation via API
 */
async function addMessageToConversation(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<IntakeMessage> {
  const response = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, content }),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to save message';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || `Failed to save message (${response.status})`;
    } catch {
      errorMessage = `Failed to save message (${response.status} ${response.statusText})`;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return {
    id: data.message.id,
    role: data.message.role,
    content: data.message.content,
    createdAt: new Date(data.message.createdAt),
  };
}

/**
 * Save response to API
 */
async function saveResponseToAPI(
  clerkUserId: string,
  chatbotId: string,
  questionId: string,
  value: any
): Promise<void> {
  const userResponse = await fetch('/api/user/current');
  if (!userResponse.ok) {
    throw new Error('Failed to get user ID');
  }
  const userData = await userResponse.json();
  const dbUserId = userData.userId;

  const response = await fetch('/api/intake/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: dbUserId,
      intakeQuestionId: questionId,
      chatbotId,
      value,
      reusableAcrossFrameworks: false,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to save response');
  }
}

/**
 * Fetch suggestion pills
 */
async function fetchSuggestionPills(chatbotId: string): Promise<PillType[]> {
  const response = await fetch(`/api/pills?chatbotId=${chatbotId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch suggestion pills');
  }
  const pills = await response.json();
  return pills.filter((p: PillType) => p.pillType === 'suggested');
}
```

**Testing:**
- Test action creators return correct types
- Test async functions handle errors correctly

**Dependencies:** Step 2

---

### Step 4: Refactor Hook to Use Reducer (3 hours)

**What:** Replace all `useState` hooks with `useReducer` and refactor all handlers.

**Why:** Single source of truth, eliminates state synchronization issues.

**Files to modify:**
- `hooks/use-conversational-intake.ts` (complete refactor)

**Key Changes:**

1. Replace useState with useReducer:
```typescript
const [state, dispatch] = useReducer(intakeReducer, createInitialIntakeState());
```

2. Refactor initialization useEffect:
```typescript
useEffect(() => {
  if (!chatbotName || !chatbotPurpose || state.isInitialized) {
    return;
  }

  if (questions === undefined || questions === null) {
    return;
  }

  if (state.conversationId) {
    return;
  }

  const initialize = async () => {
    try {
      dispatch(intakeActions.initStart(chatbotId, chatbotName, chatbotPurpose, questions, existingResponses));
      
      const newConversationId = await createConversation(chatbotId);
      dispatch(intakeActions.initConversationCreated(newConversationId));

      if (questions.length === 0) {
        const welcomeContent = `Hi, I'm ${chatbotName} AI. I'm here to help you ${chatbotPurpose}.\n\nFirst, let's personalise your experience.`;
        const welcomeMessage = await addMessageToConversation(newConversationId, 'assistant', welcomeContent);
        dispatch(intakeActions.addMessage(welcomeMessage));
        onMessageAdded(welcomeMessage);
        
        dispatch(intakeActions.showFinalMessage(newConversationId));
        await handleFinalMessage(newConversationId);
      } else {
        await showFirstQuestion(newConversationId, chatbotName, chatbotPurpose);
      }

      dispatch(intakeActions.initComplete());
    } catch (err) {
      console.error('Error initializing intake flow:', err);
      dispatch(intakeActions.initError('Failed to initialize intake flow. Please refresh the page.'));
    }
  };

  initialize();
}, [chatbotId, chatbotName, chatbotPurpose, questions, existingResponses, state.isInitialized, state.conversationId, onMessageAdded]);
```

3. Refactor processQuestion to use dispatch:
```typescript
const processQuestion = useCallback(async (index: number, convId: string, includeWelcome: boolean = false, chatbotName?: string, chatbotPurpose?: string) => {
  if (index >= state.questions.length) {
    dispatch(intakeActions.showFinalMessage(convId));
    await handleFinalMessage(convId);
    return;
  }

  const question = state.questions[index];
  if (!question) {
    throw new Error(`Question not found at index ${index}`);
  }

  const hasExisting = state.existingResponses[question.id] !== undefined && state.existingResponses[question.id] !== null;

  if (hasExisting) {
    dispatch(intakeActions.showVerification(index, state.existingResponses[question.id]));
    
    let content = includeWelcome && chatbotName && chatbotPurpose
      ? `Hi, I'm ${chatbotName} AI. I'm here to help you ${chatbotPurpose}.\n\nFirst, let's personalise your experience.\n\n${question.questionText}`
      : question.questionText;
    
    const savedAnswer = state.existingResponses[question.id];
    const formattedAnswer = formatAnswerForDisplay(question, savedAnswer);
    content += `\n\nThis is what I have. Is it still correct?\n\n${formattedAnswer}`;
    
    const message = await addMessageToConversation(convId, 'assistant', content);
    dispatch(intakeActions.addMessage(message));
    onMessageAdded(message);
  } else {
    dispatch(intakeActions.showQuestion(index, false));
    
    const content = includeWelcome && chatbotName && chatbotPurpose
      ? `Hi, I'm ${chatbotName} AI. I'm here to help you ${chatbotPurpose}.\n\nFirst, let's personalise your experience.\n\n${question.questionText}`
      : question.questionText;
    
    const message = await addMessageToConversation(convId, 'assistant', content);
    dispatch(intakeActions.addMessage(message));
    onMessageAdded(message);
  }
}, [state.questions, state.existingResponses, onMessageAdded]);
```

4. Refactor handleAnswer:
```typescript
const handleAnswer = useCallback(async (value: any) => {
  if (state.currentQuestionIndex < 0 || state.currentQuestionIndex >= state.questions.length) return;
  if (state.isSaving) return;

  const question = state.questions[state.currentQuestionIndex];
  
  dispatch(intakeActions.submitAnswerStart(value));

  try {
    await saveResponseToAPI(clerkUserId!, chatbotId, question.id, value);
    
    const userMessage = await addMessageToConversation(state.conversationId!, 'user', formatAnswerForDisplay(question, value));
    dispatch(intakeActions.addMessage(userMessage));
    onMessageAdded(userMessage);
    
    const thankYouMessage = await addMessageToConversation(state.conversationId!, 'assistant', 'Thank you.');
    dispatch(intakeActions.addMessage(thankYouMessage));
    onMessageAdded(thankYouMessage);

    dispatch(intakeActions.submitAnswerSuccess(question.id, value, userMessage));

    const nextIndex = state.currentQuestionIndex + 1;
    if (nextIndex < state.questions.length) {
      await showQuestion(nextIndex, state.conversationId!);
    } else {
      dispatch(intakeActions.showFinalMessage(state.conversationId!));
      await handleFinalMessage(state.conversationId!);
    }
  } catch (err) {
    console.error('[handleAnswer] Error saving response:', err);
    dispatch(intakeActions.submitAnswerError(err instanceof Error ? err.message : 'Failed to save response. Please try again.'));
  }
}, [state, clerkUserId, chatbotId, onMessageAdded, showQuestion]);
```

5. Refactor handleVerifyYes:
```typescript
const handleVerifyYes = useCallback(async () => {
  if (state.phase !== 'verification') {
    return;
  }
  
  if (state.currentQuestionIndex < 0 || state.currentQuestionIndex >= state.questions.length) {
    return;
  }

  dispatch(intakeActions.verifyYes());

  const nextIndex = state.currentQuestionIndex + 1;
  if (nextIndex < state.questions.length) {
    await showQuestion(nextIndex, state.conversationId!);
  } else {
    dispatch(intakeActions.showFinalMessage(state.conversationId!));
    await handleFinalMessage(state.conversationId!);
  }
}, [state, showQuestion]);
```

6. Refactor handleVerifyModify:
```typescript
const handleVerifyModify = useCallback(() => {
  if (state.phase !== 'verification') {
    return;
  }
  
  if (state.currentQuestionIndex < 0 || state.currentQuestionIndex >= state.questions.length) {
    return;
  }

  const question = state.questions[state.currentQuestionIndex];
  const existingValue = state.existingResponses[question.id];
  
  dispatch(intakeActions.enterModifyMode(existingValue));
}, [state]);
```

7. Update return value to use state:
```typescript
return {
  conversationId: state.conversationId,
  messages: state.messages,
  currentQuestionIndex: state.currentQuestionIndex,
  mode: state.mode,
  currentInput: state.currentInput,
  isSaving: state.isSaving,
  isLoadingNextQuestion: state.isLoadingNextQuestion,
  error: state.error,
  suggestionPills: state.suggestionPills,
  showPills: state.showPills,
  isInitialized: state.isInitialized,
  handleAnswer,
  handleSkip,
  handleVerifyYes,
  handleVerifyModify,
  setCurrentInput: (value: any) => dispatch(intakeActions.setInput(value)),
  currentQuestion: state.currentQuestionIndex >= 0 && state.currentQuestionIndex < state.questions.length
    ? state.questions[state.currentQuestionIndex]
    : null,
  verificationMode: state.mode === 'verification',
  modifyMode: state.mode === 'modify',
  verificationQuestionId: state.mode === 'verification' && state.currentQuestionIndex >= 0
    ? state.questions[state.currentQuestionIndex]?.id || null
    : null,
};
```

**Testing:**
- Test initialization flow
- Test question progression
- Test verification flow
- Test modify flow
- Test error handling
- Test skip functionality

**Dependencies:** Steps 1-3

---

### Step 5: Update Component Integration (1 hour)

**What:** Ensure `IntakeFlow` component works with new reducer-based hook.

**Why:** Maintain backward compatibility.

**Files to check:**
- `components/intake-flow.tsx` (should work as-is, but verify)
- `components/chat.tsx` (verify integration still works)

**Changes:**
- Minimal changes needed - interface is preserved
- Verify all props are still available
- Test component rendering

**Testing:**
- Visual testing of intake flow
- Test all question types
- Test verification buttons
- Test modify flow
- Test error states

**Dependencies:** Step 4

---

### Step 6: Remove Old Code (30 min)

**What:** Remove unused state variables and helper functions.

**Why:** Clean up codebase, remove dead code.

**Files to modify:**
- `hooks/use-conversational-intake.ts` (remove old useState calls, unused functions)

**Changes:**
- Remove all `useState` calls (except reducer)
- Remove `resetQuestionState` function (handled by reducer)
- Remove `hasExistingResponse` helper (use state.existingResponses directly)
- Clean up any unused imports

**Testing:**
- TypeScript compilation
- No unused variables warnings
- Code still works

**Dependencies:** Step 5

---

### Step 7: Testing (2 hours)

**What:** Comprehensive testing of all flows and edge cases.

**Why:** Ensure bugs are fixed and no regressions introduced.

**Test Cases:**

1. **Initialization**
   - ✅ Creates conversation
   - ✅ Shows welcome + first question
   - ✅ Handles no questions case
   - ✅ Handles initialization errors

2. **Question Flow**
   - ✅ Shows all questions sequentially
   - ✅ No skipping of questions
   - ✅ Handles existing responses correctly
   - ✅ Shows verification for existing responses
   - ✅ Shows input for new questions

3. **Verification Flow**
   - ✅ Shows Yes/Modify buttons
   - ✅ Yes button moves to next question
   - ✅ Modify button switches to modify mode
   - ✅ Verification buttons show after modify

4. **Modify Flow**
   - ✅ Pre-fills existing value
   - ✅ Allows editing
   - ✅ Saves modified value
   - ✅ Shows verification again after modify

5. **Answer Submission**
   - ✅ Saves answer to API
   - ✅ Shows user message
   - ✅ Shows thank you message
   - ✅ Moves to next question
   - ✅ Handles errors correctly
   - ✅ Retry works

6. **Skip Flow**
   - ✅ Skips optional questions
   - ✅ Prevents skipping required questions
   - ✅ Shows skip message
   - ✅ Moves to next question

7. **Final Message**
   - ✅ Shows final message
   - ✅ Loads suggestion pills
   - ✅ Calls onComplete callback
   - ✅ Transitions to chat

8. **Edge Cases**
   - ✅ Network failures
   - ✅ Invalid state transitions
   - ✅ Missing data
   - ✅ Concurrent actions
   - ✅ Message deduplication

**Files to create/modify:**
- `__tests__/hooks/use-conversational-intake.test.ts` (new test file)

**Dependencies:** Step 6

---

## Migration Strategy

### Phase 1: Parallel Implementation (Steps 1-4)
- Implement reducer alongside existing code
- Keep old code commented out
- Test reducer in isolation

### Phase 2: Integration (Step 5)
- Switch hook to use reducer
- Test thoroughly
- Keep old code as backup

### Phase 3: Cleanup (Step 6)
- Remove old code
- Final testing
- Deploy

### Rollback Plan
1. Keep old implementation in git history
2. Can revert to previous commit if issues arise
3. Feature flag to switch between implementations (optional)

---

## Testing Plan

### Unit Tests

**Reducer Tests:**
```typescript
describe('intakeReducer', () => {
  it('handles INIT_START', () => {
    const state = createInitialIntakeState();
    const action = intakeActions.initStart('bot1', 'Bot', 'Purpose', [], {});
    const newState = intakeReducer(state, action);
    expect(newState.phase).toBe('initializing');
    expect(newState.chatbotId).toBe('bot1');
  });
  
  // ... more tests
});
```

**Action Creator Tests:**
```typescript
describe('intakeActions', () => {
  it('creates correct INIT_START action', () => {
    const action = intakeActions.initStart('bot1', 'Bot', 'Purpose', [], {});
    expect(action.type).toBe('INIT_START');
    expect(action.payload.chatbotId).toBe('bot1');
  });
});
```

### Integration Tests

**Hook Tests:**
```typescript
describe('useConversationalIntake', () => {
  it('initializes correctly', async () => {
    // Test initialization flow
  });
  
  it('handles question flow', async () => {
    // Test question progression
  });
  
  // ... more tests
});
```

### E2E Tests

- Full intake flow from start to finish
- Verification flow
- Modify flow
- Error handling
- Skip functionality

---

## Edge Cases

### 1. Network Failures
- **Handling:** Error state in reducer, retry mechanism
- **User Experience:** Show error message, allow retry

### 2. Invalid State Transitions
- **Handling:** Reducer validates transitions, returns current state if invalid
- **Logging:** Console warnings for debugging

### 3. Missing Data
- **Handling:** Defensive checks in reducer and handlers
- **Fallback:** Graceful degradation

### 4. Concurrent Actions
- **Handling:** Reducer is pure function, handles actions sequentially
- **Prevention:** Disable buttons during async operations

### 5. Race Conditions
- **Handling:** Single source of truth eliminates race conditions
- **Verification:** State updates are atomic

### 6. Message Deduplication
- **Handling:** Check message ID before adding
- **Prevention:** Deduplication in reducer

---

## Performance Considerations

### State Update Optimization
- Reducer uses spread operator for immutability
- Only updates changed properties
- Minimizes re-renders

### Memoization Strategies
- Use `useCallback` for handlers
- Use `useMemo` for derived values (if needed)
- Proper dependency arrays

### Re-render Prevention
- Single state object reduces re-renders
- Component only re-renders when state changes
- Memoize expensive computations

### Bundle Size Impact
- Reducer pattern adds minimal code
- Type definitions are compile-time only
- No additional runtime dependencies

---

## Risk Assessment

### High Risk
- **Breaking existing functionality:** Mitigated by maintaining interface
- **State migration issues:** Mitigated by thorough testing

### Medium Risk
- **Performance regression:** Mitigated by optimization strategies
- **Type errors:** Mitigated by comprehensive type definitions

### Low Risk
- **Code complexity:** Actually reduces complexity
- **Learning curve:** Well-documented code

---

## Timeline Estimate

| Step | Task | Time Estimate |
|------|------|---------------|
| 1 | Define Types | 30 min |
| 2 | Create Reducer | 2 hours |
| 3 | Action Creators | 2 hours |
| 4 | Refactor Hook | 3 hours |
| 5 | Component Integration | 1 hour |
| 6 | Remove Old Code | 30 min |
| 7 | Testing | 2 hours |
| **Total** | | **11 hours** |

**Buffer:** Add 1-2 hours for unexpected issues

**Total Estimated Time:** 12-13 hours

---

## Success Criteria Checklist

- [ ] Single source of truth (reducer state)
- [ ] Type safety (no `any` types, full TypeScript coverage)
- [ ] Predictable state transitions (all documented)
- [ ] Testable reducer (pure function)
- [ ] Maintainable code (clear structure)
- [ ] Bug-free (all current bugs fixed)
- [ ] Performant (no unnecessary re-renders)
- [ ] Backward compatible (works with existing code)
- [ ] Verification buttons show after modify
- [ ] Questions not skipped when existing responses present
- [ ] No duplicate messages
- [ ] No state inconsistencies

---

## Next Steps

1. Review this plan with team
2. Get approval to proceed
3. Start with Step 1
4. Test incrementally after each step
5. Code review before merging
6. Deploy to staging first
7. Monitor for issues
8. Deploy to production

---

## Questions & Answers

### Q: How to handle async operations with reducer?
**A:** Use action creators that dispatch actions, handle async in useEffect or handlers, dispatch success/error actions.

### Q: How to integrate with existing callbacks?
**A:** Maintain same interface, callbacks work the same way, reducer manages internal state.

### Q: How to handle side effects?
**A:** Side effects in useEffect or handlers, dispatch actions to update state, reducer handles state transitions only.

### Q: How to maintain backward compatibility?
**A:** Keep same return interface, same prop types, same callback signatures.

### Q: How to optimize performance?
**A:** Single state object, proper memoization, minimize re-renders, efficient state updates.

### Q: How to structure action creators?
**A:** Create action creator object with typed functions, use `as const` for type inference.

### Q: How to handle error states?
**A:** Error in state, error actions, error handling in handlers, retry mechanism.

### Q: How to test reducer effectively?
**A:** Unit tests for each action, test state transitions, test edge cases, integration tests for hook.

---

## Conclusion

This implementation plan provides a comprehensive roadmap for rebuilding the conversational intake flow using the reducer pattern. The plan addresses all current bugs, improves maintainability, and ensures backward compatibility. Following this plan step-by-step will result in a robust, type-safe, and maintainable implementation.

**Ready to proceed with implementation.**

