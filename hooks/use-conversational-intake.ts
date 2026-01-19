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

      setMessages((prev) => [...prev, newMessage]);
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
    const question = questions[0];
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

    setIsLoadingNextQuestion(true);
    try {
      if (index >= questions.length) {
        await showFinalMessage(activeConversationId);
        return;
      }

      const question = questions[index];
      const hasExisting = hasExistingResponse(question.id);

      if (hasExisting) {
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
    if (!verificationQuestionId) return;

    const question = questions.find((q) => q.id === verificationQuestionId);
    if (!question) return;

    setVerificationMode(false);
    setVerificationQuestionId(null);
    
    const currentIndex = questions.findIndex((q) => q.id === verificationQuestionId);
    const nextIndex = currentIndex + 1;
    
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
  }, [verificationQuestionId, questions, showQuestion, showFinalMessage, conversationId]);

  // Handle verification "Modify" button
  const handleVerifyModify = useCallback(() => {
    if (!verificationQuestionId) return;

    const question = questions.find((q) => q.id === verificationQuestionId);
    if (!question) return;

    setModifyMode(true);
    setVerificationMode(false);
    setCurrentInput(existingResponses[verificationQuestionId]);
    setCurrentQuestionIndex(questions.findIndex((q) => q.id === verificationQuestionId));
  }, [verificationQuestionId, questions, existingResponses]);

  // Initialize: Create conversation and show welcome message
  useEffect(() => {
    // Only initialize if we have required data and haven't initialized yet
    if (!chatbotName || !chatbotPurpose || isInitialized) {
      return;
    }

    // Note: The gate hook (useIntakeGate) ensures questions are loaded before
    // this hook is called, so we can safely initialize with the questions array.
    // questions.length === 0 is valid (no questions) and will show welcome + final message.

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
        setConversationId(newConversationId);

        if (questions.length === 0) {
          // No questions - show welcome + final message
          const welcomeContent = `Hi, I'm ${chatbotName} AI. I'm here to help you ${chatbotPurpose}.\n\nFirst, let's personalise your experience.`;
          await addMessage('assistant', welcomeContent, newConversationId);
          await showFinalMessage(newConversationId);
        } else {
          // Show welcome + first question (combined in one message)
          await showFirstQuestion(newConversationId, chatbotName, chatbotPurpose);
        }

        setIsInitialized(true);
      } catch (err) {
        console.error('Error initializing intake flow:', err);
        setError('Failed to initialize intake flow. Please refresh the page.');
      }
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatbotId, chatbotName, chatbotPurpose, questions.length]); // questions.length included for completeness (gate hook ensures questions are loaded before hook is called)

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

