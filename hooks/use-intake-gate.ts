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
 * @param isSignedIn - Whether user is signed in
 * @param isLoaded - Whether auth state is loaded
 * @returns Gate state, welcome data, and completion callback
 */
export function useIntakeGate(
  chatbotId: string,
  conversationId: string | null,
  isSignedIn: boolean,
  isLoaded: boolean
): UseIntakeGateReturn {
  const [gateState, setGateState] = useState<'checking' | 'intake' | 'chat'>('checking');
  const [welcomeData, setWelcomeData] = useState<WelcomeData | null>(null);

  // Fetch welcome data when: no conversationId, signed in, auth loaded
  useEffect(() => {
    // Skip if conversationId exists (already in chat mode)
    if (conversationId) {
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
          
          // Gate logic: show intake if has questions AND not completed
          if (data.hasQuestions && !data.intakeCompleted) {
            setGateState('intake');
          } else {
            setGateState('chat');
          }
        } else {
          // On error, skip intake (allow chat to proceed)
          setGateState('chat');
        }
      } catch (error) {
        console.error('Error fetching welcome data:', error);
        // On error, skip intake (allow chat to proceed)
        setGateState('chat');
      }
    };

    fetchWelcomeData();
  }, [chatbotId, conversationId, isSignedIn, isLoaded]);

  // Handle intake completion - transition to chat
  const onIntakeComplete = useCallback((convId: string) => {
    setGateState('chat');
    // Note: conversationId will be set by chat component via callback
  }, []);

  return {
    gateState,
    welcomeData,
    onIntakeComplete,
  };
}

