'use client';

// hooks/use-conversational-intake.ts
// Custom hook for managing conversational intake flow state and logic

import { useState, useEffect, useCallback } from 'react';
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
}

/**
 * Custom hook for managing conversational intake flow
 * Handles conversation creation, message management, and question flow
 */
export function useConversationalIntake(
  chatbotId: string,
  chatbotName: string,
  chatbotPurpose: string,
  questions: IntakeQuestion[],
  existingResponses: Record<string, any>,
  onMessageAdded: (message: IntakeMessage) => void,
  onComplete: (conversationId: string) => void
): UseConversationalIntakeReturn {
  const { userId: clerkUserId } = useAuth();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<IntakeMessage[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(-1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<IntakeMode>('question'); // Single mode state
  const [currentInput, setCurrentInput] = useState<any>('');
  const [suggestionPills, setSuggestionPills] = useState<PillType[]>([]);
  const [showPills, setShowPills] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(false);

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

      console.log('[addMessage] Message added to intake hook', {
        messageId: newMessage.id,
        role: newMessage.role,
        contentPreview: newMessage.content.substring(0, 50),
        conversationId: convId
      });

      // Add to hook's internal messages state (deduplicate by ID)
      setMessages((prev) => {
        // Check if message already exists
        if (prev.some(msg => msg.id === newMessage.id)) {
          console.warn('[addMessage] Message already exists in hook state, skipping', {
            messageId: newMessage.id
          });
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
    console.log('[resetQuestionState] Resetting question state');
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
    
    setCurrentQuestionIndex(-2);
    
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
      console.error('Error loading suggestion pills:', err);
      setTimeout(() => {
        onComplete(convId);
      }, 500);
    }
  }, [chatbotId, addMessage, onComplete]);

  // Single function to process a question - handles all question flow logic
  const processQuestion = useCallback(async (index: number, convId: string, includeWelcome: boolean = false, chatbotName?: string, chatbotPurpose?: string) => {
    console.log('[processQuestion] Processing question', {
      index,
      includeWelcome,
      totalQuestions: questions.length,
      conversationId: convId
    });

    // Check if we're past the last question
    if (index >= questions.length) {
      console.log('[processQuestion] Index >= questions.length, showing final message', {
        index,
        questionsLength: questions.length
      });
      await showFinalMessage(convId);
      return;
    }

    // Defensive check: ensure question exists at index
    if (!questions[index]) {
      console.error('[processQuestion] Question not found at index', {
        index,
        questionsLength: questions.length,
        availableIndices: questions.map((_, i) => i)
      });
      throw new Error(`Question not found at index ${index}`);
    }

    const question = questions[index];
    const hasExisting = hasExistingResponse(question.id);
    
    console.log('[processQuestion] Question details', {
      index,
      questionId: question.id,
      questionText: question.questionText.substring(0, 50),
      hasExisting,
      displayOrder: question.displayOrder
    });

    // IMPORTANT: Set current question index FIRST, then reset state, then set mode
    // This ensures verificationQuestionId helper works correctly
    setCurrentQuestionIndex(index);
    
    // Reset input and error, but mode will be set based on hasExisting below
    setCurrentInput('');
    setError(null);

    if (hasExisting) {
      // Show verification mode - set mode AFTER setting currentQuestionIndex
      setMode('verification');
      
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
      console.error('[showFirstQuestion] No questions available', {
        questionsLength: questions?.length || 0
      });
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
    console.log('[handleAnswer] Saving answer', {
      questionId: question.id,
      questionIndex: currentQuestionIndex,
      mode,
      value
    });

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
    
    console.log('[handleSkip] Called', {
      questionIndex: currentQuestionIndex,
      questionId: question.id,
      isRequired: question.isRequired,
      mode
    });
    
    if (question.isRequired) {
      console.warn('[handleSkip] Cannot skip required question', {
        questionId: question.id
      });
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
        console.log('[handleSkip] Moving to next question', {
          nextIndex,
          nextQuestionId: questions[nextIndex]?.id
        });
        await showQuestion(nextIndex, conversationId!);
      } else {
        console.log('[handleSkip] No more questions, showing final message', {
          nextIndex,
          questionsLength: questions.length
        });
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
    
    // Comprehensive logging
    console.log('[handleVerifyYes] Called', {
      currentIndex,
      currentQuestionId,
      mode,
      totalQuestions: questions.length,
      questionIds: questions.map(q => ({ id: q.id, order: q.displayOrder })),
      existingResponseIds: Object.keys(existingResponses)
    });
    
    // Validate that we're in verification mode and have a valid current index
    if (mode !== 'verification') {
      console.warn('[handleVerifyYes] Not in verification mode', { mode });
      return;
    }
    
    if (currentIndex < 0 || currentIndex >= questions.length) {
      console.error('[handleVerifyYes] Invalid currentQuestionIndex:', {
        currentIndex,
        questionsLength: questions.length,
        questionIds: questions.map(q => q.id)
      });
      return;
    }

    const question = questions[currentIndex];
    if (!question || question.id !== currentQuestionId) {
      console.error('[handleVerifyYes] Question mismatch:', {
        currentIndex,
        currentQuestionId,
        questionId: question?.id,
        questionsLength: questions.length,
        questionIds: questions.map(q => q.id)
      });
      return;
    }

    console.log('[handleVerifyYes] Verified question, moving to next', {
      currentIndex,
      questionId: question.id,
      nextIndex: currentIndex + 1,
      totalQuestions: questions.length
    });

    // Don't reset state here - let processQuestion handle it
    // This ensures mode is set correctly based on next question's existing response
    
    const nextIndex = currentIndex + 1;
    
    // Defensive check: ensure we have all questions before proceeding
    if (nextIndex < questions.length) {
      console.log('[handleVerifyYes] Showing next question', {
        nextIndex,
        nextQuestionId: questions[nextIndex]?.id,
        nextQuestionText: questions[nextIndex]?.questionText?.substring(0, 50)
      });
      await showQuestion(nextIndex, conversationId!);
    } else {
      console.log('[handleVerifyYes] No more questions, showing final message', {
        nextIndex,
        questionsLength: questions.length
      });
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
    
    console.log('[handleVerifyModify] Called', {
      currentIndex,
      currentQuestionId,
      mode
    });
    
    // Validate that we're in verification mode
    if (mode !== 'verification') {
      console.warn('[handleVerifyModify] Not in verification mode', { mode });
      return;
    }
    
    // Validate that we have a valid current index
    if (currentIndex < 0 || currentIndex >= questions.length) {
      console.error('[handleVerifyModify] Invalid currentQuestionIndex:', currentIndex, 'questions.length:', questions.length);
      return;
    }

    const question = questions[currentIndex];
    if (!question || question.id !== currentQuestionId) {
      console.error('[handleVerifyModify] Question mismatch:', {
        currentIndex,
        currentQuestionId,
        questionId: question?.id,
        questionsLength: questions.length
      });
      return;
    }

    // Switch to modify mode and pre-fill input
    console.log('[handleVerifyModify] Switching to modify mode', {
      questionId: question.id,
      existingValue: existingResponses[question.id]
    });
    
    setMode('modify');
    setCurrentInput(existingResponses[question.id]);
    setCurrentQuestionIndex(currentIndex);
  }, [currentQuestionIndex, mode, getCurrentQuestionId, questions, existingResponses]);

  // Initialize: Create conversation and show welcome message
  useEffect(() => {
    // Only initialize if we have required data and haven't initialized yet
    if (!chatbotName || !chatbotPurpose || isInitialized) {
      return;
    }

    // Ensure questions array is available before initializing
    // If questions is undefined/null, wait for them to be loaded
    // If questions is an empty array [], that's valid (no questions) and we should proceed
    if (questions === undefined || questions === null) {
      // Wait for questions to be loaded - gate hook should provide them
      return;
    }

    // Guard: Prevent multiple initializations if conversation already exists
    if (conversationId) {
      console.log('[Intake] Skipping initialization - conversation already exists', {
        conversationId
      });
      return;
    }

    console.log('[Intake] Initializing intake flow', {
      chatbotId,
      chatbotName,
      chatbotPurpose,
      questionsCount: questions.length
    });

    const initialize = async () => {
      try {
        const convResponse = await fetch('/api/conversations/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatbotId }),
        });

        if (!convResponse.ok) {
          throw new Error('Failed to create conversation');
        }

        const convData = await convResponse.json();
        const newConversationId = convData.conversation.id;
        
        console.log('[Intake] Conversation created', {
          conversationId: newConversationId
        });
        
        setConversationId(newConversationId);

        // Defensive check: ensure questions array is still valid
        if (questions.length === 0) {
          // No questions - show welcome + final message
          const welcomeContent = `Hi, I'm ${chatbotName} AI. I'm here to help you ${chatbotPurpose}.\n\nFirst, let's personalise your experience.`;
          console.log('[Intake] Showing welcome + final message (no questions)');
          await addMessage('assistant', welcomeContent, newConversationId);
          await showFinalMessage(newConversationId);
        } else {
          // Show welcome + first question (combined in one message)
          console.log('[Intake] Showing first question');
          await showFirstQuestion(newConversationId, chatbotName, chatbotPurpose);
        }

        setIsInitialized(true);
        console.log('[Intake] Initialization complete');
      } catch (err) {
        console.error('Error initializing intake flow:', err);
        setError('Failed to initialize intake flow. Please refresh the page.');
      }
    };

    initialize();
  }, [chatbotId, chatbotName, chatbotPurpose, questions, addMessage, showFinalMessage, showFirstQuestion, isInitialized, conversationId]);

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
  };
}

