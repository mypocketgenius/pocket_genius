'use client';

// hooks/use-intake-gate.ts
// Custom hook for managing intake vs chat gate decision
// Single source of truth for determining whether to show intake flow or chat

import { useState, useEffect, useCallback } from 'react';
import { IntakeQuestion } from './use-conversational-intake';

/**
 * Welcome data structure returned from /api/chatbots/[chatbotId]/welcome
 */
export interface WelcomeData {
  chatbotName: string;
  chatbotPurpose: string;
  intakeCompleted: boolean;
  hasQuestions: boolean;
  existingResponses?: Record<string, any>;
  questions?: IntakeQuestion[];
}

/**
 * Return type for useIntakeGate hook
 */
export interface UseIntakeGateReturn {
  gateState: 'checking' | 'intake' | 'chat';
  welcomeData: WelcomeData | null;
  onIntakeComplete: (conversationId: string) => void;
}

/**
 * Custom hook for managing intake vs chat gate decision
 * 
 * Fetches welcome data and determines whether to show intake flow or chat.
 * Provides single source of truth for gate state transitions.
 * 
 * @param chatbotId - The ID of the chatbot
 * @param conversationId - Current conversation ID (if exists, skips intake check)
 * @param isSignedIn - Whether user is signed in (may be undefined before auth loads)
 * @param isLoaded - Whether auth state is loaded (may be undefined before auth loads)
 * @returns Gate state, welcome data, and completion callback
 */
export function useIntakeGate(
  chatbotId: string,
  conversationId: string | null,
  isSignedIn: boolean | undefined,
  isLoaded: boolean | undefined
): UseIntakeGateReturn {
  const [gateState, setGateState] = useState<'checking' | 'intake' | 'chat'>('checking');
  const [welcomeData, setWelcomeData] = useState<WelcomeData | null>(null);

  // Fetch welcome data when: no conversationId, signed in, auth loaded
  useEffect(() => {
    console.log('[useIntakeGate] Effect running', {
      conversationId,
      isSignedIn,
      isLoaded,
      currentGateState: gateState
    });
    
    // Skip if conversationId exists (already in chat mode)
    if (conversationId) {
      console.log('[useIntakeGate] conversationId exists, setting gateState to chat');
      setGateState('chat');
      return;
    }

    // Skip if not signed in or auth not loaded
    if (!isSignedIn || !isLoaded) {
      setGateState('chat'); // Will show empty state
      return;
    }

    // Fetch welcome data
    const fetchWelcomeData = async () => {
      try {
        const response = await fetch(`/api/chatbots/${chatbotId}/welcome`);
        if (response.ok) {
          const data = await response.json();
          setWelcomeData(data);
          
          // Debug logging to help diagnose intake gate issues
          console.log('[useIntakeGate] Welcome data received:', {
            chatbotId,
            hasQuestions: data.hasQuestions,
            intakeCompleted: data.intakeCompleted,
            questionsCount: data.questions?.length || 0,
            gateDecision: data.hasQuestions ? 'intake' : 'chat',
          });
          
          // Gate logic: show intake if has questions (regardless of completion status)
          // The intake hook handles verification flow for completed intake (Yes/Modify buttons)
          // This allows users to review/edit their responses even after completing intake
          if (data.hasQuestions) {
            setGateState('intake');
          } else {
            setGateState('chat');
          }
        } else {
          const errorText = await response.text();
          console.error('[useIntakeGate] Welcome API error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          });
          // On error, skip intake (allow chat to proceed)
          setGateState('chat');
        }
      } catch (error) {
        console.error('[useIntakeGate] Error fetching welcome data:', error);
        // On error, skip intake (allow chat to proceed)
        setGateState('chat');
      }
    };

    fetchWelcomeData();
  }, [chatbotId, conversationId, isSignedIn, isLoaded]);

  // Handle intake completion - transition to chat
  // This immediately sets gate state to 'chat' without waiting for effect to run
  const onIntakeComplete = useCallback((convId: string) => {
    console.log('[useIntakeGate] onIntakeComplete called', {
      conversationId: convId,
      currentGateState: gateState
    });
    // Immediately transition to chat state
    setGateState('chat');
    console.log('[useIntakeGate] Gate state set to chat');
    // Note: conversationId will be set by chat component via callback
    // The effect will see conversationId on next render and keep gate state as 'chat'
  }, [gateState]);

  return {
    gateState,
    welcomeData,
    onIntakeComplete,
  };
}

