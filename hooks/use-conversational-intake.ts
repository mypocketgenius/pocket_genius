'use client';

// hooks/use-conversational-intake.ts
// Custom hook for managing conversational intake flow state and logic

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Pill as PillType } from '../components/pills/pill';

export interface IntakeQuestion {
  id: string;
  questionText: string;
  helperText?: string | null;
  responseType: 'TEXT' | 'NUMBER' | 'SELECT' | 'MULTI_SELECT' | 'BOOLEAN';
  displayOrder: number;
  isRequired: boolean;
  options?: string[] | null;
}

export interface IntakeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: Date;
}

// Simplified mode enum - single source of truth for question state
export type IntakeMode = 'question' | 'verification' | 'modify';

export interface UseConversationalIntakeReturn {
  conversationId: string | null;
  messages: IntakeMessage[];
  currentQuestionIndex: number; // -1 = welcome, -2 = final message, >= 0 = question index
  mode: IntakeMode; // Simplified mode instead of verificationMode + modifyMode
  currentInput: any;
  isSaving: boolean;
  isLoadingNextQuestion: boolean;
  error: string | null;
  suggestionPills: PillType[];
  showPills: boolean;
  isInitialized: boolean;
  handleAnswer: (value: any) => Promise<void>;
  handleSkip: () => Promise<void>;
  handleVerifyYes: () => Promise<void>;
  handleVerifyModify: () => void;
  setCurrentInput: (value: any) => void;
  currentQuestion: IntakeQuestion | null;
  // Helper getters for backward compatibility (derived from mode)
  verificationMode: boolean;
  modifyMode: boolean;
  verificationQuestionId: string | null;
  // State version counter - increments on every state change to ensure React detects updates
  stateVersion: number;
}

/**
 * Custom hook for managing conversational intake flow
 * Handles conversation creation, message management, and question flow
 *
 * @param existingConversationId - Optional existing conversation ID to resume intake for
 */
export function useConversationalIntake(
  chatbotId: string,
  chatbotName: string,
  chatbotPurpose: string,
  questions: IntakeQuestion[],
  existingResponses: Record<string, any>,
  onMessageAdded: (message: IntakeMessage) => void,
  onComplete: (conversationId: string) => void,
  existingConversationId?: string | null
): UseConversationalIntakeReturn {
  const { userId: clerkUserId } = useAuth();

  const [conversationId, setConversationId] = useState<string | null>(existingConversationId || null);
  const [messages, setMessages] = useState<IntakeMessage[]>([]);

  // Sync conversationId when existingConversationId changes (e.g., when resuming an existing conversation)
  // REMOVED: This was causing loops - conversationId in dependency triggers re-sync
  // The initial state already handles existingConversationId, no need to sync again
  // useEffect(() => {
  //   if (existingConversationId && existingConversationId !== conversationId) {
  //     setConversationId(existingConversationId);
  //   }
  // }, [existingConversationId, conversationId]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(-1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<IntakeMode>('question'); // Single mode state
  const [currentInput, setCurrentInput] = useState<any>('');
  const [suggestionPills, setSuggestionPills] = useState<PillType[]>([]);
  const [showPills, setShowPills] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(false);
  // State version counter - increments whenever key state changes to ensure React detects updates
  const [stateVersion, setStateVersion] = useState<number>(0);

  // Use ref to prevent initialization loop (prevent re-entry during async initialization)
  const isInitializingRef = useRef(false);

  // Add message to conversation and notify parent
  const addMessage = useCallback(async (role: 'user' | 'assistant', content: string, convId: string): Promise<IntakeMessage> => {
    try {
      const response = await fetch(`/api/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content }),
      });

      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = 'Failed to save message';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || `Failed to save message (${response.status})`;
        } catch {
          errorMessage = `Failed to save message (${response.status} ${response.statusText})`;
        }
        console.error('Error saving message:', {
          status: response.status,
          statusText: response.statusText,
          errorMessage,
          conversationId: convId,
          role,
          contentLength: content.length,
        });
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const newMessage: IntakeMessage = {
        id: data.message.id,
        role: data.message.role,
        content: data.message.content,
        createdAt: new Date(data.message.createdAt),
      };

      // Add to hook's internal messages state (deduplicate by ID)
      setMessages((prev) => {
        // Check if message already exists
        if (prev.some(msg => msg.id === newMessage.id)) {
          return prev;
        }
        return [...prev, newMessage];
      });
      
      // Notify parent component (deduplication handled in parent)
      onMessageAdded(newMessage);
      return newMessage;
    } catch (err) {
      console.error('Error adding message:', err);
      throw err;
    }
  }, [onMessageAdded]);

  // Check if question has existing response
  const hasExistingResponse = useCallback((questionId: string): boolean => {
    return existingResponses[questionId] !== undefined && existingResponses[questionId] !== null;
  }, [existingResponses]);

  // Reset question state - consolidates all state resets into one function
  const resetQuestionState = useCallback(() => {
    setMode('question');
    setCurrentInput('');
    setError(null);
  }, []);

  // Get current question ID (derived from currentQuestionIndex)
  const getCurrentQuestionId = useCallback((): string | null => {
    if (currentQuestionIndex < 0 || currentQuestionIndex >= questions.length) {
      return null;
    }
    return questions[currentQuestionIndex]?.id || null;
  }, [currentQuestionIndex, questions]);

  // Format answer for display
  const formatAnswerForDisplay = useCallback((question: IntakeQuestion, value: any): string => {
    if (question.responseType === 'MULTI_SELECT' && Array.isArray(value)) {
      return value.join(', ');
    }
    if (question.responseType === 'BOOLEAN') {
      return value === true ? 'Yes' : 'No';
    }
    return String(value);
  }, []);

  // Show final intro message and pills
  const showFinalMessage = useCallback(async (convId: string) => {
    const finalMessage = "When our conversation is finished, leave me a rating and you will get free messages for the next AI! Now let's get started...";
    await addMessage('assistant', finalMessage, convId);

    setCurrentQuestionIndex(-2); // Special marker for "intake complete"

    // Mark conversation as intake complete in database
    if (convId) {
      fetch(`/api/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeCompleted: true }),
      }).catch(err => {
        console.error('[useConversationalIntake] Failed to mark intake complete:', err);
      });
    }

    // Fetch suggestion pills
    try {
      const pillsResponse = await fetch(`/api/pills?chatbotId=${chatbotId}`);
      if (pillsResponse.ok) {
        const pills = await pillsResponse.json();
        const suggestedPills = pills.filter((p: PillType) => p.pillType === 'suggested');
        setSuggestionPills(suggestedPills);
        setShowPills(true);

        setTimeout(() => {
          onComplete(convId);
        }, 1000);
      }
    } catch (err) {
      console.error('[useConversationalIntake] Failed to fetch pills:', err);
      setTimeout(() => {
        onComplete(convId);
      }, 500);
    }
  }, [chatbotId, addMessage, onComplete]);

  // Single function to process a question - handles all question flow logic
  const processQuestion = useCallback(async (index: number, convId: string, includeWelcome: boolean = false, chatbotName?: string, chatbotPurpose?: string) => {
    // Check if we're past the last question
    if (index >= questions.length) {
      await showFinalMessage(convId);
      return;
    }

    // Defensive check: ensure question exists at index
    if (!questions[index]) {
      console.error('[processQuestion] Question not found at index', index);
      throw new Error(`Question not found at index ${index}`);
    }

    const question = questions[index];
    const hasExisting = hasExistingResponse(question.id);

    // IMPORTANT: Set current question index FIRST, then reset state, then set mode
    // This ensures verificationQuestionId helper works correctly
    setCurrentQuestionIndex(index);
    setCurrentInput('');
    setError(null);

    if (hasExisting) {
      // Show verification mode - set mode AFTER setting currentQuestionIndex
      setMode('verification');
      
      // Increment state version IMMEDIATELY after setting mode to ensure React detects the change
      setStateVersion((prev) => prev + 1);
      
      // Build message content
      let content = includeWelcome && chatbotName && chatbotPurpose
        ? `Hi, I'm ${chatbotName} AI. I'm here to help you ${chatbotPurpose}.\n\nFirst, let's personalise your experience.\n\n${question.questionText}`
        : question.questionText;
      
      // Add verification text and saved answer
      const savedAnswer = existingResponses[question.id];
      const formattedAnswer = formatAnswerForDisplay(question, savedAnswer);
      content += `\n\nThis is what I have. Is it still correct?\n\n${formattedAnswer}`;
      
      await addMessage('assistant', content, convId);
    } else {
      // Show question input mode
      setMode('question');
      
      // Increment state version IMMEDIATELY after setting mode
      setStateVersion((prev) => prev + 1);
      
      // Build message content
      const content = includeWelcome && chatbotName && chatbotPurpose
        ? `Hi, I'm ${chatbotName} AI. I'm here to help you ${chatbotPurpose}.\n\nFirst, let's personalise your experience.\n\n${question.questionText}`
        : question.questionText;

      await addMessage('assistant', content, convId);
    }
  }, [questions, hasExistingResponse, existingResponses, formatAnswerForDisplay, addMessage, showFinalMessage]);

  // Show first question (combined with welcome message)
  const showFirstQuestion = useCallback(async (convId: string, chatbotName: string, chatbotPurpose: string) => {
    // Defensive check: ensure questions array has at least one question
    if (!questions || questions.length === 0) {
      console.error('[showFirstQuestion] No questions available');
      throw new Error('No questions available');
    }

    await processQuestion(0, convId, true, chatbotName, chatbotPurpose);
  }, [questions, processQuestion]);

  // Show question (with verification if needed) - now uses processQuestion
  const showQuestion = useCallback(async (index: number, convId?: string) => {
    const activeConversationId = convId || conversationId;
    if (!activeConversationId) {
      throw new Error('Conversation ID is required');
    }

    setIsLoadingNextQuestion(true);
    try {
      await processQuestion(index, activeConversationId);
    } finally {
      setIsLoadingNextQuestion(false);
    }
  }, [conversationId, processQuestion]);

  // Save response to API
  const saveResponse = useCallback(async (questionId: string, value: any) => {
    if (!clerkUserId) {
      throw new Error('User not authenticated');
    }

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
  }, [clerkUserId, chatbotId]);

  // Handle answer submission
  const handleAnswer = useCallback(async (value: any) => {
    if (currentQuestionIndex < 0 || currentQuestionIndex >= questions.length) return;
    if (isSaving) return;

    const question = questions[currentQuestionIndex];
    setError(null);
    setIsSaving(true);

    try {
      await saveResponse(question.id, value);
      await addMessage('user', formatAnswerForDisplay(question, value), conversationId!);
      await addMessage('assistant', 'Thank you.', conversationId!);

      // Don't reset state here - let processQuestion handle it
      // This ensures mode is set correctly based on next question's existing response

      const nextIndex = currentQuestionIndex + 1;
      if (nextIndex < questions.length) {
        await showQuestion(nextIndex, conversationId!);
      } else {
        // Immediately clear currentQuestionIndex to prevent input field from showing
        // while transitioning to final message
        setCurrentQuestionIndex(-2);
        await showFinalMessage(conversationId!);
      }
    } catch (err) {
      console.error('[handleAnswer] Error saving response:', err);
      setError(err instanceof Error ? err.message : 'Failed to save response. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [currentQuestionIndex, questions, isSaving, mode, saveResponse, addMessage, formatAnswerForDisplay, conversationId, showQuestion, showFinalMessage, resetQuestionState]);

  // Handle skip
  const handleSkip = useCallback(async () => {
    if (currentQuestionIndex < 0 || currentQuestionIndex >= questions.length) return;
    if (isSaving) return;

    const question = questions[currentQuestionIndex];
    
    if (question.isRequired) {
      setError('This question is required and cannot be skipped.');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      await addMessage('user', '(Skipped)', conversationId!);
      await addMessage('assistant', 'Thank you.', conversationId!);

      // Don't reset state here - let processQuestion handle it

      const nextIndex = currentQuestionIndex + 1;
      if (nextIndex < questions.length) {
        await showQuestion(nextIndex, conversationId!);
      } else {
        // Immediately clear currentQuestionIndex to prevent input field from showing
        // while transitioning to final message
        setCurrentQuestionIndex(-2);
        await showFinalMessage(conversationId!);
      }
    } catch (err) {
      console.error('[handleSkip] Error skipping question:', err);
      setError('Failed to skip question. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [currentQuestionIndex, questions, isSaving, mode, addMessage, conversationId, showQuestion, showFinalMessage, resetQuestionState]);

  // Handle verification "Yes" button
  const handleVerifyYes = useCallback(async () => {
    const currentIndex = currentQuestionIndex;
    const currentQuestionId = getCurrentQuestionId();

    // Validate that we're in verification mode and have a valid current index
    if (mode !== 'verification') {
      return;
    }
    
    if (currentIndex < 0 || currentIndex >= questions.length) {
      console.error('[handleVerifyYes] Invalid currentQuestionIndex:', currentIndex);
      return;
    }

    const question = questions[currentIndex];
    if (!question || question.id !== currentQuestionId) {
      console.error('[handleVerifyYes] Question mismatch:', currentIndex, currentQuestionId);
      return;
    }

    // Don't reset state here - let processQuestion handle it
    // This ensures mode is set correctly based on next question's existing response
    
    const nextIndex = currentIndex + 1;
    
    // Defensive check: ensure we have all questions before proceeding
    if (nextIndex < questions.length) {
      await showQuestion(nextIndex, conversationId!);
    } else {
      // Immediately clear currentQuestionIndex to prevent input field from showing
      // while transitioning to final message
      setCurrentQuestionIndex(-2);
      setIsLoadingNextQuestion(true);
      try {
        await showFinalMessage(conversationId!);
      } finally {
        setIsLoadingNextQuestion(false);
      }
    }
  }, [currentQuestionIndex, mode, getCurrentQuestionId, questions, showQuestion, showFinalMessage, conversationId, existingResponses, resetQuestionState]);

  // Handle verification "Modify" button
  const handleVerifyModify = useCallback(() => {
    const currentIndex = currentQuestionIndex;
    const currentQuestionId = getCurrentQuestionId();
    
    // Validate that we're in verification mode
    if (mode !== 'verification') {
      return;
    }
    
    // Validate that we have a valid current index
    if (currentIndex < 0 || currentIndex >= questions.length) {
      console.error('[handleVerifyModify] Invalid currentQuestionIndex:', currentIndex);
      return;
    }

    const question = questions[currentIndex];
    if (!question || question.id !== currentQuestionId) {
      console.error('[handleVerifyModify] Question mismatch:', currentIndex, currentQuestionId);
      return;
    }

    // Switch to modify mode and pre-fill input
    setMode('modify');
    setCurrentInput(existingResponses[question.id]);
    setCurrentQuestionIndex(currentIndex);
  }, [currentQuestionIndex, mode, getCurrentQuestionId, questions, existingResponses]);

  // Initialize: Create conversation or resume existing, then show welcome/question
  useEffect(() => {
    // Only initialize if we have required data and haven't initialized yet
    if (!chatbotName || !chatbotPurpose || isInitialized || isInitializingRef.current) {
      return;
    }

    // Ensure questions array is available before initializing
    // If questions is undefined/null, wait for them to be loaded
    // If questions is an empty array [], that's valid (no questions) and we should proceed
    if (questions === undefined || questions === null) {
      // Wait for questions to be loaded - gate hook should provide them
      return;
    }

    // Set flag to prevent re-entry
    isInitializingRef.current = true;

    const initialize = async () => {
      try {
        let activeConversationId: string | null = conversationId;
        
        // If no conversationId exists, create a new conversation
        if (!activeConversationId) {
          const convResponse = await fetch('/api/conversations/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatbotId }),
          });

          if (!convResponse.ok) {
            throw new Error('Failed to create conversation');
          }

          const convData = await convResponse.json();
          activeConversationId = convData.conversation.id;
          setConversationId(activeConversationId);
        }

        // Type guard: ensure activeConversationId is not null
        if (!activeConversationId) {
          throw new Error('Conversation ID is required');
        }

        // After the type guard, TypeScript knows activeConversationId is string
        const convId: string = activeConversationId;

        // Defensive check: ensure questions array is still valid
        if (questions.length === 0) {
          // No questions - show welcome + final message
          const welcomeContent = `Hi, I'm ${chatbotName} AI. I'm here to help you ${chatbotPurpose}.\n\nFirst, let's personalise your experience.`;
          await addMessage('assistant', welcomeContent, convId);
          await showFinalMessage(convId);
        } else {
          // Determine which question to show next based on existing responses
          // Find the first unanswered question, or show the last answered question for verification
          const answeredQuestionIds = new Set(Object.keys(existingResponses));
          const firstUnansweredIndex = questions.findIndex(q => !answeredQuestionIds.has(q.id));
          
          if (firstUnansweredIndex === -1) {
            // All questions answered - show final message
            await showFinalMessage(convId);
          } else if (firstUnansweredIndex === 0) {
            // First question unanswered - show welcome + first question
            await showFirstQuestion(convId, chatbotName, chatbotPurpose);
          } else {
            // Some questions answered - resume from first unanswered question
            // Show the question (will show verification if it has existing response)
            await showQuestion(firstUnansweredIndex, convId);
          }
        }

        setIsInitialized(true);
      } catch (err) {
        console.error('Error initializing intake flow:', err);
        setError('Failed to initialize intake flow. Please refresh the page.');
        // Reset flag on error so user can retry
        isInitializingRef.current = false;
      }
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatbotId, chatbotName, chatbotPurpose, questions, existingResponses, isInitialized, existingConversationId]);
  // Note: Removed callback dependencies (addMessage, showFinalMessage, showFirstQuestion, showQuestion)
  //       to prevent recreation loops - they're accessed directly in the effect and their
  //       identities don't affect the initialization logic
  // Note: conversationId removed from deps to prevent loop - it's set inside this effect
  // Note: isInitializingRef used to prevent re-entry during async initialization

  // Note: stateVersion is now incremented directly when state changes in processQuestion
  // This ensures the version increments synchronously with the state update

  const currentQuestion = currentQuestionIndex >= 0 && currentQuestionIndex < questions.length
    ? questions[currentQuestionIndex]
    : null;

  // Backward compatibility helpers (derived from mode)
  const verificationMode = mode === 'verification';
  const modifyMode = mode === 'modify';
  const verificationQuestionId = mode === 'verification' ? getCurrentQuestionId() : null;

  return {
    conversationId,
    messages,
    currentQuestionIndex,
    mode,
    currentInput,
    isSaving,
    isLoadingNextQuestion,
    error,
    suggestionPills,
    showPills,
    isInitialized,
    handleAnswer,
    handleSkip,
    handleVerifyYes,
    handleVerifyModify,
    setCurrentInput,
    currentQuestion,
    // Backward compatibility helpers
    verificationMode,
    modifyMode,
    verificationQuestionId,
    // State version counter for reliable re-renders
    stateVersion,
  };
}

