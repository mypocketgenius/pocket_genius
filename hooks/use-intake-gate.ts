'use client';

// hooks/use-intake-gate.ts
// Custom hook for managing intake vs chat gate decision
// Single source of truth for determining whether to show intake flow or chat

import { useState, useEffect, useCallback } from 'react';
import { IntakeQuestion } from './use-conversational-intake';
import { decideGate } from '@/lib/intake-gate';

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
  // Conversation-scoped data from API (for gate decision)
  conversation?: {
    intakeCompleted: boolean;
    hasMessages: boolean;
  } | null;
  // AI Suggestion Pills data (Phase: AI Suggestion Pills)
  welcomeMessage?: string;
  fallbackSuggestionPills?: string[];
  cachedSuggestionPills?: string[];
  // Note: generatedSuggestionPills has been removed - pills are now fetched async
  // from /api/chatbots/[chatbotId]/suggestion-pills after the screen loads
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
        const response = await fetch(`/api/chatbots/${chatbotId}/welcome?t=${Date.now()}${conversationId ? `&conversationId=${conversationId}` : ''}`, {
          cache: 'no-store', // Prevent browser caching
        });
        if (response.ok) {
          const data = await response.json();
          setWelcomeData(data);
          
          // Use pure decision function for gate logic
          const gateInput = {
            conversationId,
            hasMessages: data.conversation?.hasMessages ?? false,
            intakeCompletedForConversation: data.conversation?.intakeCompleted ?? false,
            chatbotHasQuestions: data.hasQuestions,
            userAnsweredAllQuestions: data.intakeCompleted,
          };

          const decision = decideGate(gateInput);

          // Explicit logging to diagnose intake gate issues
          console.log(
            `[useIntakeGate] → ${decision.toUpperCase()} | ` +
            `hasQuestions=${data.hasQuestions}, intakeCompleted=${data.intakeCompleted}, ` +
            `questionsCount=${data.questions?.length || 0}, conversationId=${conversationId || 'null'}`
          );
          setGateState(decision);
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
  const onIntakeComplete = useCallback((_convId: string) => {
    setGateState('chat');
  }, []);

  return {
    gateState,
    welcomeData,
    onIntakeComplete,
  };
}

