'use client';

// hooks/use-chat-state-machine.ts
// State machine for managing chat conversation lifecycle
// Prevents race conditions during conversation creation and navigation

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

/**
 * Chat states:
 * - idle: Initial state, no conversation
 * - loading: Loading existing conversation from URL
 * - new: User clicked +, showing welcome screen
 * - creating: First message sent, waiting for API to return conversationId
 * - active: Normal chat with valid conversationId
 */
export type ChatState = 'idle' | 'loading' | 'new' | 'creating' | 'active';

export interface ChatStateMachineOptions {
  chatbotId: string;
}

export interface ChatStateMachineReturn {
  state: ChatState;
  conversationId: string | null;

  // Transitions
  startNewConversation: () => void;
  startCreating: () => void;
  conversationCreated: (id: string) => void;
  messagesLoaded: () => void;
  loadConversation: (id: string) => void;

  // Guards
  isTransitioning: boolean;
  shouldLoadMessages: boolean;

  // State clearing callback for external use
  onStateClearing: () => void;
  setOnStateClearing: (callback: () => void) => void;
}

/**
 * State machine hook for managing chat conversation lifecycle.
 *
 * Key features:
 * - Explicit state transitions prevent race conditions
 * - isTransitioningRef provides synchronous lock during async operations
 * - Guards prevent effects from running during transitions
 *
 * State transitions:
 * - idle → new (URL has ?new=true)
 * - idle → loading (URL has conversationId)
 * - new → creating (sendMessage called)
 * - creating → active (API returned conversationId)
 * - loading → active (messages loaded)
 * - active → new (user clicks + button)
 * - active → loading (user switches to different conversation)
 */
export function useChatStateMachine({ chatbotId }: ChatStateMachineOptions): ChatStateMachineReturn {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [state, setState] = useState<ChatState>('idle');
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Synchronous lock to prevent race conditions during transitions
  const isTransitioningRef = useRef(false);

  // Callback for when state needs to be cleared (switching conversations)
  const onStateClearingRef = useRef<() => void>(() => {});

  // Track previous URL params to detect changes
  const prevUrlConversationIdRef = useRef<string | null>(null);

  // Extract URL params
  const urlConversationId = searchParams?.get('conversationId') ?? null;
  const isNewConversation = searchParams?.get('new') === 'true';

  // Initialize state from URL on mount and handle URL changes
  useEffect(() => {
    // Skip if we're in the middle of a transition
    if (isTransitioningRef.current) {
      console.log('[ChatStateMachine] Skipping URL effect - transitioning');
      return;
    }

    // Priority 1: conversationId in URL
    if (urlConversationId) {
      const isSwitchingConversations =
        conversationId !== null &&
        conversationId !== urlConversationId;

      if (isSwitchingConversations) {
        console.log(`[ChatStateMachine] ${state} → loading (switching conversations)`);
        // Trigger state clearing callback before switching
        onStateClearingRef.current();
        setState('loading');
        setConversationId(urlConversationId);
        localStorage.setItem(`conversationId_${chatbotId}`, urlConversationId);
      } else if (conversationId !== urlConversationId) {
        // Initial load with conversationId in URL
        console.log(`[ChatStateMachine] ${state} → loading (URL has conversationId)`);
        setState('loading');
        setConversationId(urlConversationId);
        localStorage.setItem(`conversationId_${chatbotId}`, urlConversationId);
      }
      prevUrlConversationIdRef.current = urlConversationId;
      return;
    }

    // Priority 2: ?new=true parameter
    if (isNewConversation) {
      // Detect if this is a FRESH navigation to ?new=true (user clicked + button)
      // vs a STALE ?new=true (URL hasn't caught up after conversation creation)
      //
      // Fresh navigation: previous URL had a conversationId, now we have ?new=true
      // Stale URL: we're in active state but URL still shows ?new=true from before
      const isFreshNewConversationRequest = prevUrlConversationIdRef.current !== null;

      // Only transition if not already in 'new' or 'creating' state
      // Exception: if we're in 'active' state, only transition if this is a FRESH request
      // (user clicked + button, not stale URL)
      const shouldTransitionToNew =
        state !== 'new' &&
        state !== 'creating' &&
        (!(state === 'active' && conversationId) || isFreshNewConversationRequest);

      if (shouldTransitionToNew) {
        console.log(`[ChatStateMachine] ${state} → new (URL has ?new=true, fresh=${isFreshNewConversationRequest})`);
        // Trigger state clearing callback
        onStateClearingRef.current();
        setState('new');
        setConversationId(null);
        localStorage.removeItem(`conversationId_${chatbotId}`);
      } else if (state === 'active' && conversationId && !isFreshNewConversationRequest) {
        console.log(`[ChatStateMachine] Ignoring stale ?new=true - already active with conversationId`);
      }
      prevUrlConversationIdRef.current = null;
      return;
    }

    // Priority 3: No URL parameters - go to idle (ready for new conversation)
    // But skip if we're in a valid state (active with conversationId means URL hasn't updated yet)
    if (state === 'idle') {
      // Already in correct state
      return;
    }

    // Skip if we're in active state with a valid conversationId - URL hasn't caught up yet
    if (state === 'active' && conversationId) {
      console.log(`[ChatStateMachine] Ignoring missing URL params - already active with conversationId`);
      return;
    }

    // Only reset to idle if we're not in a valid state
    if (state !== 'new' && state !== 'creating' && state !== 'active') {
      console.log(`[ChatStateMachine] ${state} → idle (no URL params)`);
      setState('idle');
      setConversationId(null);
    }
  }, [chatbotId, urlConversationId, isNewConversation, conversationId, state]);

  // Transition: Start new conversation (user clicks + button)
  const startNewConversation = useCallback(() => {
    console.log(`[ChatStateMachine] ${state} → new (startNewConversation)`);
    onStateClearingRef.current();
    setState('new');
    setConversationId(null);
    localStorage.removeItem(`conversationId_${chatbotId}`);
  }, [chatbotId, state]);

  // Transition: Start creating (first message sent)
  const startCreating = useCallback(() => {
    console.log(`[ChatStateMachine] ${state} → creating (sendMessage called)`);
    isTransitioningRef.current = true; // Lock BEFORE state changes
    setState('creating');
  }, [state]);

  // Transition: Conversation created (API returned conversationId)
  const conversationCreated = useCallback((newConversationId: string) => {
    console.log(`[ChatStateMachine] creating → active (API returned conversationId: ${newConversationId})`);
    setConversationId(newConversationId);
    localStorage.setItem(`conversationId_${chatbotId}`, newConversationId);
    router.replace(`/chat/${chatbotId}?conversationId=${newConversationId}`);

    // Release lock AFTER URL propagates
    setTimeout(() => {
      isTransitioningRef.current = false;
      setState('active');
      console.log(`[ChatStateMachine] Transition lock released, now active`);
    }, 50);
  }, [chatbotId, router]);

  // Transition: Messages loaded (for loading state)
  const messagesLoaded = useCallback(() => {
    if (state === 'loading') {
      console.log(`[ChatStateMachine] loading → active (messages loaded)`);
      setState('active');
    }
  }, [state]);

  // Transition: Load a specific conversation
  const loadConversation = useCallback((id: string) => {
    console.log(`[ChatStateMachine] ${state} → loading (loadConversation: ${id})`);
    onStateClearingRef.current();
    setState('loading');
    setConversationId(id);
    localStorage.setItem(`conversationId_${chatbotId}`, id);
  }, [chatbotId, state]);

  // Setter for state clearing callback
  const setOnStateClearing = useCallback((callback: () => void) => {
    onStateClearingRef.current = callback;
  }, []);

  // Guard: Should load messages (in loading state with conversationId)
  const shouldLoadMessages = state === 'loading' && conversationId !== null;

  return {
    state,
    conversationId,

    // Transitions
    startNewConversation,
    startCreating,
    conversationCreated,
    messagesLoaded,
    loadConversation,

    // Guards
    isTransitioning: isTransitioningRef.current,
    shouldLoadMessages,

    // State clearing
    onStateClearing: onStateClearingRef.current,
    setOnStateClearing,
  };
}
