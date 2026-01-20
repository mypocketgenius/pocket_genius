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

export interface UseConversationalIntakeReturn {
  conversationId: string | null;
  messages: IntakeMessage[];
  currentQuestionIndex: number; // -1 = welcome, -2 = final message, >= 0 = question index
  verificationMode: boolean;
  verificationQuestionId: string | null;
  modifyMode: boolean;
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
  const [verificationMode, setVerificationMode] = useState(false);
  const [verificationQuestionId, setVerificationQuestionId] = useState<string | null>(null);
  const [modifyMode, setModifyMode] = useState(false);
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

  // Show first question (combined with welcome message)
  const showFirstQuestion = useCallback(async (convId: string, chatbotName: string, chatbotPurpose: string) => {
    // Defensive check: ensure questions array has at least one question
    if (!questions || questions.length === 0) {
      console.error('[showFirstQuestion] No questions available', {
        questionsLength: questions?.length || 0
      });
      throw new Error('No questions available');
    }

    const question = questions[0];
    console.log('[showFirstQuestion] Showing first question', {
      questionId: question.id,
      questionText: question.questionText.substring(0, 50),
      totalQuestions: questions.length,
      questionIds: questions.map(q => ({ id: q.id, order: q.displayOrder })),
      existingResponseIds: Object.keys(existingResponses)
    });

    const hasExisting = hasExistingResponse(question.id);

    // Build combined message: welcome + question + verification (if needed)
    let combinedContent = `Hi, I'm ${chatbotName} AI. I'm here to help you ${chatbotPurpose}.\n\nFirst, let's personalise your experience.\n\n${question.questionText}`;
    
    if (hasExisting) {
      // Add verification text and saved answer to the same message
      const savedAnswer = existingResponses[question.id];
      const formattedAnswer = formatAnswerForDisplay(question, savedAnswer);
      combinedContent += `\n\nThis is what I have. Is it still correct?\n\n${formattedAnswer}`;
      
      // Set verification mode
      setVerificationMode(true);
      setVerificationQuestionId(question.id);
      setCurrentQuestionIndex(0);
      
      // Add combined message (includes saved answer)
      await addMessage('assistant', combinedContent, convId);
    } else {
      // Just welcome + question, no verification
      setVerificationMode(false);
      setVerificationQuestionId(null);
      setModifyMode(false);
      setCurrentInput('');
      await addMessage('assistant', combinedContent, convId);
      setCurrentQuestionIndex(0);
    }
  }, [questions, hasExistingResponse, existingResponses, formatAnswerForDisplay, addMessage]);

  // Show question (with verification if needed)
  const showQuestion = useCallback(async (index: number, convId?: string) => {
    const activeConversationId = convId || conversationId;
    if (!activeConversationId) {
      throw new Error('Conversation ID is required');
    }

    // Comprehensive logging for debugging
    console.log('[showQuestion] Called', {
      index,
      totalQuestions: questions.length,
      questionIds: questions.map(q => ({ id: q.id, order: q.displayOrder })),
      existingResponseIds: Object.keys(existingResponses),
      conversationId: activeConversationId
    });

    setIsLoadingNextQuestion(true);
    try {
      if (index >= questions.length) {
        console.log('[showQuestion] Index >= questions.length, showing final message', {
          index,
          questionsLength: questions.length
        });
        await showFinalMessage(activeConversationId);
        return;
      }

      // Defensive check: ensure question exists at index
      if (!questions[index]) {
        console.error('[showQuestion] Question not found at index', {
          index,
          questionsLength: questions.length,
          availableIndices: questions.map((_, i) => i)
        });
        throw new Error(`Question not found at index ${index}`);
      }

      const question = questions[index];
      const hasExisting = hasExistingResponse(question.id);
      
      console.log('[showQuestion] Showing question', {
        index,
        questionId: question.id,
        questionText: question.questionText.substring(0, 50),
        hasExisting,
        displayOrder: question.displayOrder
      });

      if (hasExisting) {
        // Reset modify mode when showing verification for existing response
        setModifyMode(false);
        setVerificationMode(true);
        setVerificationQuestionId(question.id);
        setCurrentQuestionIndex(index);
        
        // Build combined message: question + verification text + saved answer (all in one message)
        const savedAnswer = existingResponses[question.id];
        const formattedAnswer = formatAnswerForDisplay(question, savedAnswer);
        const combinedContent = `${question.questionText}\n\nThis is what I have. Is it still correct?\n\n${formattedAnswer}`;
        
        await addMessage('assistant', combinedContent, activeConversationId);
      } else {
        setVerificationMode(false);
        setVerificationQuestionId(null);
        setModifyMode(false);
        setCurrentInput('');
        await addMessage('assistant', question.questionText, activeConversationId);
        setCurrentQuestionIndex(index);
      }
    } finally {
      setIsLoadingNextQuestion(false);
    }
  }, [questions, conversationId, hasExistingResponse, existingResponses, formatAnswerForDisplay, addMessage, showFinalMessage]);

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

      // Reset modify mode before moving to next question
      setModifyMode(false);
      setVerificationMode(false);
      setVerificationQuestionId(null);

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
      console.error('Error saving response:', err);
      setError(err instanceof Error ? err.message : 'Failed to save response. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [currentQuestionIndex, questions, isSaving, saveResponse, addMessage, formatAnswerForDisplay, conversationId, showQuestion, showFinalMessage]);

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
      console.error('Error skipping question:', err);
      setError('Failed to skip question. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [currentQuestionIndex, questions, isSaving, addMessage, conversationId, showQuestion, showFinalMessage]);

  // Handle verification "Yes" button
  const handleVerifyYes = useCallback(async () => {
    if (!verificationQuestionId) {
      console.warn('[handleVerifyYes] No verificationQuestionId');
      return;
    }

    // Use currentQuestionIndex state instead of findIndex to avoid stale closure issues
    // currentQuestionIndex is set when the question is shown, so it's always accurate
    const currentIndex = currentQuestionIndex;
    
    // Comprehensive logging
    console.log('[handleVerifyYes] Called', {
      verificationQuestionId,
      currentIndex,
      totalQuestions: questions.length,
      questionIds: questions.map(q => ({ id: q.id, order: q.displayOrder })),
      existingResponseIds: Object.keys(existingResponses)
    });
    
    // Validate that we have a valid current index and question exists
    if (currentIndex < 0 || currentIndex >= questions.length) {
      console.error('[handleVerifyYes] Invalid currentQuestionIndex:', {
        currentIndex,
        questionsLength: questions.length,
        questionIds: questions.map(q => q.id)
      });
      return;
    }

    const question = questions[currentIndex];
    if (!question || question.id !== verificationQuestionId) {
      console.error('[handleVerifyYes] Question mismatch:', {
        currentIndex,
        verificationQuestionId,
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

    setVerificationMode(false);
    setVerificationQuestionId(null);
    
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
  }, [verificationQuestionId, currentQuestionIndex, questions, showQuestion, showFinalMessage, conversationId, existingResponses]);

  // Handle verification "Modify" button
  const handleVerifyModify = useCallback(() => {
    if (!verificationQuestionId) return;

    // Use currentQuestionIndex state instead of findIndex to avoid stale closure issues
    const currentIndex = currentQuestionIndex;
    
    // Validate that we have a valid current index
    if (currentIndex < 0 || currentIndex >= questions.length) {
      console.error('[handleVerifyModify] Invalid currentQuestionIndex:', currentIndex, 'questions.length:', questions.length);
      return;
    }

    const question = questions[currentIndex];
    if (!question || question.id !== verificationQuestionId) {
      console.error('[handleVerifyModify] Question mismatch:', {
        currentIndex,
        verificationQuestionId,
        questionId: question?.id,
        questionsLength: questions.length
      });
      return;
    }

    setModifyMode(true);
    setVerificationMode(false);
    setCurrentInput(existingResponses[verificationQuestionId]);
    setCurrentQuestionIndex(currentIndex);
  }, [verificationQuestionId, currentQuestionIndex, questions, existingResponses]);

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

  return {
    conversationId,
    messages,
    currentQuestionIndex,
    verificationMode,
    verificationQuestionId,
    modifyMode,
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
  };
}

