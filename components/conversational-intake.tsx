'use client';

// components/conversational-intake.tsx
// Conversational Intake Flow Component
// Handles intake questions in a conversational manner within the chat interface

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { MarkdownRenderer } from './markdown-renderer';
import { Pill as PillType, Pill } from './pills/pill';
import { useTheme } from '../lib/theme/theme-context';
import { ThemedPage } from './themed-page';
import { Prisma } from '@prisma/client';

interface IntakeQuestion {
  id: string;
  questionText: string;
  helperText?: string | null;
  responseType: 'TEXT' | 'NUMBER' | 'SELECT' | 'MULTI_SELECT' | 'BOOLEAN';
  displayOrder: number;
  isRequired: boolean;
  options?: string[] | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: Date;
}

interface ConversationalIntakeProps {
  chatbotId: string;
  chatbotName: string;
  chatbotPurpose: string;
  questions: IntakeQuestion[];
  existingResponses?: Record<string, any>;
  onComplete: (conversationId: string) => void;
}

/**
 * ConversationalIntake component
 * 
 * Handles the conversational intake flow:
 * - Creates conversation before welcome message
 * - Displays welcome message
 * - Shows questions one at a time
 * - Handles all response types (TEXT, NUMBER, SELECT, MULTI_SELECT, BOOLEAN)
 * - Saves responses incrementally
 * - Shows verification flow for existing answers
 * - Displays final intro message and suggestion pills
 */
export function ConversationalIntake({
  chatbotId,
  chatbotName,
  chatbotPurpose,
  questions,
  existingResponses = {},
  onComplete,
}: ConversationalIntakeProps) {
  const { userId: clerkUserId } = useAuth();
  const theme = useTheme();
  const currentBubbleStyle = theme.bubbleStyles[theme.theme];
  const chromeColors = theme.chrome;
  const chromeTextColor = theme.textColor;

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(-1); // -1 = welcome, -2 = final message
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationMode, setVerificationMode] = useState(false);
  const [verificationQuestionId, setVerificationQuestionId] = useState<string | null>(null);
  const [modifyMode, setModifyMode] = useState(false);
  const [currentInput, setCurrentInput] = useState<any>('');
  const [suggestionPills, setSuggestionPills] = useState<PillType[]>([]);
  const [showPills, setShowPills] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const hasInitializedRef = useRef(false);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when question changes
  useEffect(() => {
    if (currentQuestionIndex >= 0 && !verificationMode && !modifyMode) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [currentQuestionIndex, verificationMode, modifyMode]);

  // Add message to conversation
  const addMessage = async (role: 'user' | 'assistant', content: string, convId: string) => {
    try {
      const response = await fetch(`/api/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content }),
      });

      if (!response.ok) {
        throw new Error('Failed to save message');
      }

      const data = await response.json();
      const newMessage: Message = {
        id: data.message.id,
        role: data.message.role,
        content: data.message.content,
        createdAt: new Date(data.message.createdAt),
      };

      setMessages((prev) => [...prev, newMessage]);
      return newMessage;
    } catch (err) {
      console.error('Error adding message:', err);
      throw err;
    }
  };

  // Check if question has existing response
  const hasExistingResponse = (questionId: string): boolean => {
    return existingResponses[questionId] !== undefined && existingResponses[questionId] !== null;
  };

  // Show first question (combined with welcome message)
  const showFirstQuestion = async (convId: string) => {
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
  };

  // Show question (with verification if needed)
  const showQuestion = async (index: number) => {
    if (index >= questions.length) {
      // All questions answered, show final message
      await showFinalMessage(conversationId!);
      return;
    }

    const question = questions[index];
    const hasExisting = hasExistingResponse(question.id);

    if (hasExisting) {
      // Show verification flow
      setVerificationMode(true);
      setVerificationQuestionId(question.id);
      setCurrentQuestionIndex(index); // Set index so component knows which question is being verified
      const verificationMessage = "This is what I have. Is it still correct?";
      await addMessage('assistant', verificationMessage, conversationId!);
      
      // Show saved answer as user message
      const savedAnswer = existingResponses[question.id];
      await addMessage('user', formatAnswerForDisplay(question, savedAnswer), conversationId!);
    } else {
      // Show question normally
      setVerificationMode(false);
      setVerificationQuestionId(null);
      setModifyMode(false);
      setCurrentInput('');
      await addMessage('assistant', question.questionText, conversationId!);
      setCurrentQuestionIndex(index);
    }
  };

  // Format answer for display
  const formatAnswerForDisplay = (question: IntakeQuestion, value: any): string => {
    if (question.responseType === 'MULTI_SELECT' && Array.isArray(value)) {
      return value.join(', ');
    }
    if (question.responseType === 'BOOLEAN') {
      return value === true ? 'Yes' : 'No';
    }
    return String(value);
  };

  // Handle verification "Yes" button
  const handleVerifyYes = async () => {
    if (!verificationQuestionId) return;

    const question = questions.find((q) => q.id === verificationQuestionId);
    if (!question) return;

    // Confirm answer is correct, move to next question
    setVerificationMode(false);
    setVerificationQuestionId(null);
    
    const currentIndex = questions.findIndex((q) => q.id === verificationQuestionId);
    const nextIndex = currentIndex + 1;
    
    if (nextIndex < questions.length) {
      await showQuestion(nextIndex);
    } else {
      await showFinalMessage(conversationId!);
    }
  };

  // Handle verification "Modify" button
  const handleVerifyModify = () => {
    if (!verificationQuestionId) return;

    const question = questions.find((q) => q.id === verificationQuestionId);
    if (!question) return;

    // Pre-fill input with saved answer
    setModifyMode(true);
    setVerificationMode(false);
    setCurrentInput(existingResponses[verificationQuestionId]);
    setCurrentQuestionIndex(questions.findIndex((q) => q.id === verificationQuestionId));
  };

  // Save response to API
  const saveResponse = async (questionId: string, value: any) => {
    if (!clerkUserId) {
      throw new Error('User not authenticated');
    }

    // Get database user ID
    const userResponse = await fetch('/api/user/current');
    if (!userResponse.ok) {
      throw new Error('Failed to get user ID');
    }
    const userData = await userResponse.json();
    const dbUserId = userData.userId;

    // Save response
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

    // Update local state
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  // Handle answer submission
  const handleAnswer = async (value: any) => {
    if (currentQuestionIndex < 0 || currentQuestionIndex >= questions.length) return;
    if (isSaving) return;

    const question = questions[currentQuestionIndex];
    setError(null);
    setIsSaving(true);

    try {
      // Save response
      await saveResponse(question.id, value);

      // Show user's answer as message
      await addMessage('user', formatAnswerForDisplay(question, value), conversationId!);

      // Show "Thank you." message
      await addMessage('assistant', 'Thank you.', conversationId!);

      // Move to next question
      const nextIndex = currentQuestionIndex + 1;
      if (nextIndex < questions.length) {
        await showQuestion(nextIndex);
      } else {
        await showFinalMessage(conversationId!);
      }
    } catch (err) {
      console.error('Error saving response:', err);
      setError(err instanceof Error ? err.message : 'Failed to save response. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle skip
  const handleSkip = async () => {
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
      // Show skip message
      await addMessage('user', '(Skipped)', conversationId!);

      // Show "Thank you." message
      await addMessage('assistant', 'Thank you.', conversationId!);

      // Move to next question
      const nextIndex = currentQuestionIndex + 1;
      if (nextIndex < questions.length) {
        await showQuestion(nextIndex);
      } else {
        await showFinalMessage(conversationId!);
      }
    } catch (err) {
      console.error('Error skipping question:', err);
      setError('Failed to skip question. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Show final intro message and pills
  const showFinalMessage = async (convId: string) => {
    const finalMessage = "When our conversation is finished, leave me a rating and you will get free messages for the next AI! Now let's get started...";
    await addMessage('assistant', finalMessage, convId);
    
    setCurrentQuestionIndex(-2); // Mark as completed
    
    // Load suggestion pills
    try {
      const pillsResponse = await fetch(`/api/pills?chatbotId=${chatbotId}`);
      if (pillsResponse.ok) {
        const pills = await pillsResponse.json();
        const suggestedPills = pills.filter((p: PillType) => p.pillType === 'suggested');
        setSuggestionPills(suggestedPills);
        setShowPills(true);
        
        // Auto-complete after showing pills (small delay to ensure rendering)
        setTimeout(() => {
          onComplete(convId);
        }, 1000);
      }
    } catch (err) {
      console.error('Error loading suggestion pills:', err);
      // Still complete even if pills fail to load
      setTimeout(() => {
        onComplete(convId);
      }, 500);
    }
  };

  // Initialize: Create conversation and show welcome message
  useEffect(() => {
    if (hasInitializedRef.current) return;
    
    const initialize = async () => {
      try {
        // 1. Create conversation
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

        // 2. If no questions, show welcome + final message immediately
        if (questions.length === 0) {
          const welcomeContent = `Hi, I'm ${chatbotName} AI. I'm here to help you ${chatbotPurpose}.\n\nFirst, let's personalise your experience.`;
          await addMessage('assistant', welcomeContent, newConversationId);
          await showFinalMessage(newConversationId);
        } else {
          // 3. Show welcome + first question (combined in one message)
          await showFirstQuestion(newConversationId);
        }
        
        hasInitializedRef.current = true;
      } catch (err) {
        console.error('Error initializing intake flow:', err);
        setError('Failed to initialize intake flow. Please refresh the page.');
      }
    };

    initialize();
    // Note: showFinalMessage and showFirstQuestion are intentionally omitted from dependencies
    // as they are stable functions that use the included props. The effect should only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatbotId, chatbotName, chatbotPurpose, questions.length]);

  // Handle pill click
  const handlePillClick = (pill: PillType) => {
    // Pre-fill input with pill text
    setCurrentInput(pill.prefillText);
    inputRef.current?.focus();
  };

  // Render input field based on question type
  const renderInput = () => {
    if (currentQuestionIndex < 0 || currentQuestionIndex >= questions.length) return null;
    if (verificationMode) return null;

    const question = questions[currentQuestionIndex];
    const hasValue = currentInput !== '' && currentInput !== null && currentInput !== undefined;

    return (
      <div className="space-y-3 mt-4">
        {question.responseType === 'TEXT' && (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={currentInput || ''}
            onChange={(e) => setCurrentInput(e.target.value)}
            placeholder="Type your answer..."
            rows={1}
            className="w-full resize-none border rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{
              backgroundColor: chromeColors.inputField,
              borderColor: chromeColors.border,
              color: chromeTextColor,
              minHeight: '52px',
              maxHeight: '120px',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (hasValue && !isSaving) {
                  handleAnswer(currentInput);
                }
              }
            }}
          />
        )}

        {question.responseType === 'NUMBER' && (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="number"
            value={currentInput || ''}
            onChange={(e) => setCurrentInput(parseFloat(e.target.value) || null)}
            placeholder="Enter a number..."
            style={{
              backgroundColor: chromeColors.inputField,
              borderColor: chromeColors.border,
              color: chromeTextColor,
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && hasValue && !isSaving) {
                handleAnswer(currentInput);
              }
            }}
          />
        )}

        {question.responseType === 'SELECT' && (
          <Select
            value={currentInput || ''}
            onValueChange={(value) => {
              setCurrentInput(value);
              handleAnswer(value);
            }}
          >
            <SelectTrigger
              style={{
                backgroundColor: chromeColors.inputField,
                borderColor: chromeColors.border,
                color: chromeTextColor,
              }}
            >
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent
              style={{
                backgroundColor: chromeColors.input,
                borderColor: chromeColors.border,
                color: chromeTextColor,
              }}
            >
              {question.options && question.options.length > 0 ? (
                question.options.map((option, index) => (
                  <SelectItem key={index} value={option}>
                    {option}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-options" disabled>
                  No options available
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        )}

        {question.responseType === 'MULTI_SELECT' && (
          <div className="space-y-2">
            {question.options && question.options.length > 0 ? (
              question.options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${question.id}-${index}`}
                    checked={Array.isArray(currentInput) && currentInput.includes(option)}
                    onCheckedChange={(checked) => {
                      const current = Array.isArray(currentInput) ? currentInput : [];
                      const newValue = checked
                        ? [...current, option]
                        : current.filter((v: string) => v !== option);
                      setCurrentInput(newValue);
                    }}
                  />
                  <label
                    htmlFor={`${question.id}-${index}`}
                    className="text-sm"
                    style={{ color: chromeTextColor }}
                  >
                    {option}
                  </label>
                </div>
              ))
            ) : (
              <p className="text-xs" style={{ color: chromeTextColor, opacity: 0.7 }}>
                No options available
              </p>
            )}
            {Array.isArray(currentInput) && currentInput.length > 0 && (
              <Button
                onClick={() => handleAnswer(currentInput)}
                disabled={isSaving}
                className="mt-2"
              >
                Continue
              </Button>
            )}
          </div>
        )}

        {question.responseType === 'BOOLEAN' && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={question.id}
              checked={currentInput === true}
              onCheckedChange={(checked) => {
                setCurrentInput(checked === true);
                handleAnswer(checked === true);
              }}
            />
            <label
              htmlFor={question.id}
              className="text-sm"
              style={{ color: chromeTextColor }}
            >
              {question.helperText || 'Yes'}
            </label>
          </div>
        )}

        {/* Skip link (only for optional questions) */}
        {!question.isRequired && question.responseType !== 'BOOLEAN' && question.responseType !== 'SELECT' && (
          <button
            onClick={handleSkip}
            disabled={isSaving}
            className="text-sm underline opacity-70 hover:opacity-100 transition-opacity"
            style={{ color: chromeTextColor }}
          >
            Skip
          </button>
        )}

        {/* Submit button for TEXT and NUMBER */}
        {(question.responseType === 'TEXT' || question.responseType === 'NUMBER') && (
          <Button
            onClick={() => handleAnswer(currentInput)}
            disabled={!hasValue || isSaving}
            className="mt-2"
          >
            {isSaving ? 'Saving...' : 'Continue'}
          </Button>
        )}

        {/* Error message */}
        {error && (
          <div className="text-sm text-red-500 mt-2">
            {error}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setError(null);
                if (question.responseType === 'TEXT' || question.responseType === 'NUMBER') {
                  handleAnswer(currentInput);
                }
              }}
              className="ml-2"
            >
              Retry
            </Button>
          </div>
        )}
      </div>
    );
  };

  // Render verification buttons
  const renderVerificationButtons = () => {
    if (!verificationMode || !verificationQuestionId) return null;

    return (
      <div className="flex gap-3 mt-4">
        <Button onClick={handleVerifyYes} disabled={isSaving}>
          Yes
        </Button>
        <Button onClick={handleVerifyModify} variant="outline" disabled={isSaving}>
          Modify
        </Button>
      </div>
    );
  };

  // Render question counter
  const renderQuestionCounter = () => {
    if (currentQuestionIndex < 0 || currentQuestionIndex >= questions.length) return null;
    if (verificationMode) return null;

    const question = questions[currentQuestionIndex];
    return (
      <div className="text-xs opacity-60 mt-1" style={{ color: chromeTextColor }}>
        Question {currentQuestionIndex + 1} of {questions.length}
      </div>
    );
  };

  if (!conversationId) {
    return (
      <ThemedPage className="flex items-center justify-center h-dvh">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm" style={{ color: chromeTextColor, opacity: 0.7 }}>
            Initializing...
          </p>
        </div>
      </ThemedPage>
    );
  }

  return (
    <ThemedPage className="flex flex-col h-dvh" scrollable>
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => {
          const isLastMessage = index === messages.length - 1;
          const isQuestion = isLastMessage && currentQuestionIndex >= 0 && message.role === 'assistant';
          
          // Check if this is an intake verification response (user message showing saved answer)
          const previousMessage = index > 0 ? messages[index - 1] : null;
          const isIntakeVerificationResponse = message.role === 'user' && 
            previousMessage?.role === 'assistant' &&
            previousMessage?.content?.includes('This is what I have. Is it still correct?');
          
          return (
            <div key={message.id}>
              <div
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`${
                    message.role === 'user' ? 'max-w-[85%] sm:max-w-[75%] lg:max-w-[65%]' : 'w-full'
                  }`}
                >
                  <div
                    className={`rounded-lg ${
                      isIntakeVerificationResponse ? 'px-4 py-3' : 'px-4 py-2'
                    } ${
                      message.role === 'user' ? 'font-medium' : 'font-normal'
                    }`}
                    style={{
                      background: isIntakeVerificationResponse
                        ? 'white'
                        : message.role === 'user' ? currentBubbleStyle.user : 'transparent',
                      color: isIntakeVerificationResponse
                        ? '#1f2937'
                        : message.role === 'user' ? currentBubbleStyle.userText : currentBubbleStyle.text,
                      boxShadow: isIntakeVerificationResponse
                        ? '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
                        : message.role === 'user' ? currentBubbleStyle.shadow : 'none',
                      border: isIntakeVerificationResponse
                        ? '1px solid #e5e7eb'
                        : message.role === 'user' ? `1px solid rgba(255, 255, 255, 0.2)` : 'none',
                    }}
                  >
                    {message.role === 'assistant' ? (
                      <MarkdownRenderer content={message.content} textColor={currentBubbleStyle.text} />
                    ) : (
                      <div className="whitespace-pre-wrap break-words">{message.content}</div>
                    )}
                    
                    {/* Question counter */}
                    {isQuestion && renderQuestionCounter()}
                  </div>
                </div>
              </div>

              {/* Input field or verification buttons */}
              {isQuestion && !verificationMode && renderInput()}
              {isQuestion && verificationMode && renderVerificationButtons()}
            </div>
          );
        })}

        {/* Suggestion pills */}
        {showPills && suggestionPills.length > 0 && currentQuestionIndex === -2 && (
          <div className="mt-4 w-full flex flex-wrap gap-2 justify-center">
            {suggestionPills.map((pill) => (
              <Pill
                key={pill.id}
                pill={pill}
                isSelected={false}
                onClick={() => handlePillClick(pill)}
              />
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </ThemedPage>
  );
}

