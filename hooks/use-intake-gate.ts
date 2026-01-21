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

  // Fetch welcome data when: signed in, auth loaded
  // Check intake completion even when conversationId exists (to handle incomplete intake)
  useEffect(() => {
    console.log('[useIntakeGate] Effect running', {
      conversationId,
      isSignedIn,
      isLoaded,
      currentGateState: gateState
    });
    
    // Skip if not signed in or auth not loaded
    if (!isSignedIn || !isLoaded) {
      setGateState('chat'); // Will show empty state
      return;
    }

    // Fetch welcome data to check intake completion status
    // This is needed even when conversationId exists to determine if intake should resume
    // Add cache-busting timestamp to ensure fresh data (especially after deleting responses)
    const fetchWelcomeData = async () => {
      try {
        const response = await fetch(`/api/chatbots/${chatbotId}/welcome?t=${Date.now()}`, {
          cache: 'no-store', // Prevent browser caching
        });
        if (response.ok) {
          const data = await response.json();
          setWelcomeData(data);
          
          // Debug logging to help diagnose intake gate issues
          console.log('[useIntakeGate] Welcome data received:', {
            chatbotId,
            conversationId,
            hasQuestions: data.hasQuestions,
            intakeCompleted: data.intakeCompleted,
            questionsCount: data.questions?.length || 0,
          });
          
          // Gate logic:
          // - If conversationId exists AND intake is completed: skip intake, go to chat
          // - If conversationId exists BUT intake is NOT completed: show intake (resume)
          // - If no conversationId AND intake is NOT completed: show intake (new)
          // - If no conversationId AND intake is completed: skip intake, go to chat
          // - If no questions: always skip intake
          
          if (!data.hasQuestions) {
            // No questions - always skip intake
            console.log('[useIntakeGate] No questions, setting gateState to chat');
            setGateState('chat');
          } else if (data.intakeCompleted) {
            // Intake completed - skip intake, go to chat
            // This handles both new chats (after intake completed) and existing chats (intake already done)
            console.log('[useIntakeGate] Intake completed, setting gateState to chat');
            setGateState('chat');
          } else {
            // Intake not completed - show intake flow
            // This handles both new chats (start intake) and existing chats (resume intake)
            console.log('[useIntakeGate] Intake not completed, setting gateState to intake');
            setGateState('intake');
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

