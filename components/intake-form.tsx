'use client';

// components/intake-form.tsx
// Phase 3.10: User Intake Forms - Frontend Component
// Displays intake questions and collects user responses

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../lib/theme/theme-context';
import { ThemedPage } from './themed-page';
import { ThemedContainer } from './themed-container';

interface IntakeQuestion {
  id: string;
  slug: string;
  questionText: string;
  helperText?: string | null;
  responseType: 'TEXT' | 'NUMBER' | 'SELECT' | 'MULTI_SELECT' | 'FILE' | 'DATE' | 'BOOLEAN';
  options?: string[] | null; // Options for SELECT and MULTI_SELECT response types
  displayOrder: number;
  isRequired: boolean;
}

interface IntakeFormProps {
  chatbotId: string;
  onComplete: () => void;
}

/**
 * IntakeForm component
 * 
 * Displays intake questions for a chatbot and collects user responses.
 * Automatically fetches questions, handles all response types, validates required fields,
 * and submits responses to the API (which syncs to User_Context).
 * 
 * @component
 * @example
 * ```tsx
 * <IntakeForm
 *   chatbotId="chatbot-123"
 *   onComplete={() => console.log('Form completed')}
 * />
 * ```
 */
export function IntakeForm({ chatbotId, onComplete }: IntakeFormProps) {
  const { isSignedIn, userId: clerkUserId } = useAuth();
  const theme = useTheme();
  const [questions, setQuestions] = useState<IntakeQuestion[]>([]);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbUserId, setDbUserId] = useState<string | null>(null);

  // Fetch database user ID if authenticated
  useEffect(() => {
    if (isSignedIn && clerkUserId) {
      fetch('/api/user/current')
        .then(res => res.json())
        .then(data => {
          if (data.userId) {
            setDbUserId(data.userId);
          }
        })
        .catch(err => {
          console.error('Error fetching user ID:', err);
        });
    }
  }, [isSignedIn, clerkUserId]);

  // Fetch intake questions
  useEffect(() => {
    fetch(`/api/intake/questions?chatbotId=${chatbotId}`)
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to fetch questions');
        }
        return res.json();
      })
      .then(data => {
        setQuestions(data.questions || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching questions:', err);
        setError('Failed to load intake questions. Please try again.');
        setLoading(false);
      });
  }, [chatbotId]);

  // If no questions, skip form
  useEffect(() => {
    if (!loading && questions.length === 0) {
      onComplete();
    }
  }, [loading, questions.length, onComplete]);

  async function handleSubmit() {
    // Check authentication
    if (!isSignedIn || !dbUserId) {
      setError('Please sign in to submit your responses.');
      return;
    }

    // Validate required fields
    const missing = questions.filter(q => q.isRequired && !responses[q.id]);
    if (missing.length > 0) {
      setError(`Please answer the following required questions: ${missing.map(q => q.questionText).join(', ')}`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Submit all responses
      const submitPromises = Object.entries(responses).map(([questionId, value]) => {
        // Skip empty responses
        if (value === undefined || value === null || value === '') {
          return Promise.resolve();
        }

        return fetch('/api/intake/responses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: dbUserId,
            intakeQuestionId: questionId,
            chatbotId,
            value,
            reusableAcrossFrameworks: false, // Can be enhanced later
          }),
        }).then(res => {
          if (!res.ok) {
            throw new Error(`Failed to submit response for question ${questionId}`);
          }
          return res.json();
        });
      });

      await Promise.all(submitPromises);
      onComplete();
    } catch (err) {
      console.error('Error submitting responses:', err);
      setError('Failed to submit your responses. Please try again.');
      setSubmitting(false);
    }
  }

  function updateResponse(questionId: string, value: any) {
    setResponses(prev => ({
      ...prev,
      [questionId]: value,
    }));
  }

  if (loading) {
    return (
      <ThemedPage className="flex items-center justify-center h-dvh p-4">
        <ThemedContainer variant="card" className="w-full max-w-2xl rounded-lg border shadow-sm p-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: theme.textColor }} />
            <p className="text-sm" style={{ color: theme.textColor, opacity: 0.7 }}>Loading questions...</p>
          </div>
        </ThemedContainer>
      </ThemedPage>
    );
  }

  if (questions.length === 0) {
    return null; // Will trigger onComplete via useEffect
  }

  return (
    <ThemedPage className="h-dvh" scrollable>
      <div className="flex items-start justify-center p-4 py-8">
        <ThemedContainer variant="card" className="w-full max-w-2xl rounded-lg border shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6 border-b" style={{ borderColor: theme.chrome.border }}>
            <h3 className="text-2xl font-semibold leading-none tracking-tight" style={{ color: theme.textColor }}>
              Help us tailor the advice to your situation
            </h3>
            <p className="text-sm" style={{ color: theme.textColor, opacity: 0.7 }}>
              Your answers help us apply the author&apos;s wisdom to your specific context
            </p>
          </div>
          <div className="p-6 pt-0 space-y-6">
        {error && (
          <Alert 
            variant="destructive"
            style={{
              borderColor: '#ef4444',
              backgroundColor: theme.chrome.input,
            }}
          >
            <AlertDescription style={{ color: '#ef4444' }}>{error}</AlertDescription>
          </Alert>
        )}

        {questions.map((question) => (
          <div key={question.id} className="space-y-2">
            <label 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              style={{ color: theme.textColor }}
            >
              {question.questionText}
              {question.isRequired && <span className="ml-1" style={{ color: '#ef4444' }}>*</span>}
            </label>
            {question.helperText && (
              <p className="text-sm" style={{ color: theme.textColor, opacity: 0.7 }}>{question.helperText}</p>
            )}

            {/* TEXT response type */}
            {question.responseType === 'TEXT' && (
              <Input
                value={responses[question.id] || ''}
                onChange={(e) => updateResponse(question.id, e.target.value)}
                placeholder="Enter your answer..."
                required={question.isRequired}
                style={{
                  backgroundColor: theme.chrome.input,
                  color: theme.textColor,
                  borderColor: theme.chrome.border,
                }}
              />
            )}

            {/* NUMBER response type */}
            {question.responseType === 'NUMBER' && (
              <Input
                type="number"
                value={responses[question.id] || ''}
                onChange={(e) => updateResponse(question.id, parseFloat(e.target.value) || null)}
                placeholder="Enter a number..."
                required={question.isRequired}
                style={{
                  backgroundColor: theme.chrome.input,
                  color: theme.textColor,
                  borderColor: theme.chrome.border,
                }}
              />
            )}

            {/* SELECT response type */}
            {question.responseType === 'SELECT' && (
              <Select
                value={responses[question.id] || ''}
                onValueChange={(value) => updateResponse(question.id, value)}
                required={question.isRequired}
              >
                <SelectTrigger
                  style={{
                    backgroundColor: theme.chrome.input,
                    color: theme.textColor,
                    borderColor: theme.chrome.border,
                  }}
                >
                  <SelectValue placeholder="Select an option..." />
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: theme.chrome.input,
                    color: theme.textColor,
                    borderColor: theme.chrome.border,
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

            {/* MULTI_SELECT response type */}
            {question.responseType === 'MULTI_SELECT' && (
              <div className="space-y-2">
                {question.options && question.options.length > 0 ? (
                  question.options.map((option, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${question.id}-${index}`}
                        checked={Array.isArray(responses[question.id]) && responses[question.id].includes(option)}
                        onCheckedChange={(checked) => {
                          const current = Array.isArray(responses[question.id]) ? responses[question.id] : [];
                          updateResponse(
                            question.id,
                            checked ? [...current, option] : current.filter((v: string) => v !== option)
                          );
                        }}
                      />
                      <label 
                        htmlFor={`${question.id}-${index}`} 
                        className="text-sm font-normal"
                        style={{ color: theme.textColor }}
                      >
                        {option}
                      </label>
                    </div>
                  ))
                ) : (
                  <p className="text-xs" style={{ color: theme.textColor, opacity: 0.7 }}>
                    No options available
                  </p>
                )}
              </div>
            )}

            {/* FILE response type */}
            {question.responseType === 'FILE' && (
              <div className="space-y-2">
                <Input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // For file uploads, we'd need to upload the file first and get the fileId
                      // For now, storing the file name as a placeholder
                      // TODO: Implement file upload to /api/files/upload and use fileId
                      updateResponse(question.id, file.name);
                    }
                  }}
                  required={question.isRequired}
                  style={{
                    backgroundColor: theme.chrome.input,
                    color: theme.textColor,
                    borderColor: theme.chrome.border,
                  }}
                />
                <p className="text-xs" style={{ color: theme.textColor, opacity: 0.7 }}>
                  Note: File uploads should be handled via /api/files/upload endpoint
                </p>
              </div>
            )}

            {/* DATE response type */}
            {question.responseType === 'DATE' && (
              <Input
                type="date"
                value={responses[question.id] || ''}
                onChange={(e) => updateResponse(question.id, e.target.value)}
                required={question.isRequired}
                style={{
                  backgroundColor: theme.chrome.input,
                  color: theme.textColor,
                  borderColor: theme.chrome.border,
                }}
              />
            )}

            {/* BOOLEAN response type */}
            {question.responseType === 'BOOLEAN' && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={question.id}
                  checked={responses[question.id] === true}
                  onCheckedChange={(checked) => updateResponse(question.id, checked === true)}
                  required={question.isRequired}
                />
                <label 
                  htmlFor={question.id} 
                  className="text-sm font-normal"
                  style={{ color: theme.textColor }}
                >
                  {question.helperText || 'Yes'}
                </label>
              </div>
            )}
          </div>
        ))}

        <div className="flex gap-4 pt-4">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </div>
        </div>
      </ThemedContainer>
    </div>
    </ThemedPage>
  );
}




