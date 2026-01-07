'use client';

// components/intake-form.tsx
// Phase 3.10: User Intake Forms - Frontend Component
// Displays intake questions and collects user responses

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2 } from 'lucide-react';

interface IntakeQuestion {
  id: string;
  slug: string;
  questionText: string;
  helperText?: string | null;
  responseType: 'TEXT' | 'NUMBER' | 'SELECT' | 'MULTI_SELECT' | 'FILE' | 'DATE' | 'BOOLEAN';
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
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="flex items-center justify-center p-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading questions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (questions.length === 0) {
    return null; // Will trigger onComplete via useEffect
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Tell us about yourself</CardTitle>
        <CardDescription>Help us personalize your experience</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {questions.map((question) => (
          <div key={question.id} className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              {question.questionText}
              {question.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            {question.helperText && (
              <p className="text-sm text-muted-foreground">{question.helperText}</p>
            )}

            {/* TEXT response type */}
            {question.responseType === 'TEXT' && (
              <Input
                value={responses[question.id] || ''}
                onChange={(e) => updateResponse(question.id, e.target.value)}
                placeholder="Enter your answer..."
                required={question.isRequired}
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
              />
            )}

            {/* SELECT response type */}
            {question.responseType === 'SELECT' && (
              <Select
                value={responses[question.id] || ''}
                onValueChange={(value) => updateResponse(question.id, value)}
                required={question.isRequired}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an option..." />
                </SelectTrigger>
                <SelectContent>
                  {/* Note: Options would typically come from question metadata or a separate options field */}
                  {/* For now, this is a placeholder - options should be added to the schema or passed as metadata */}
                  <SelectItem value="option1">Option 1</SelectItem>
                  <SelectItem value="option2">Option 2</SelectItem>
                  <SelectItem value="option3">Option 3</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* MULTI_SELECT response type */}
            {question.responseType === 'MULTI_SELECT' && (
              <div className="space-y-2">
                {/* Note: Multi-select would need a custom implementation or checkbox group */}
                {/* For now, using checkboxes as a simple implementation */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`${question.id}-option1`}
                      checked={Array.isArray(responses[question.id]) && responses[question.id].includes('option1')}
                      onCheckedChange={(checked) => {
                        const current = Array.isArray(responses[question.id]) ? responses[question.id] : [];
                        updateResponse(
                          question.id,
                          checked ? [...current, 'option1'] : current.filter((v: string) => v !== 'option1')
                        );
                      }}
                    />
                    <label htmlFor={`${question.id}-option1`} className="text-sm font-normal">
                      Option 1
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`${question.id}-option2`}
                      checked={Array.isArray(responses[question.id]) && responses[question.id].includes('option2')}
                      onCheckedChange={(checked) => {
                        const current = Array.isArray(responses[question.id]) ? responses[question.id] : [];
                        updateResponse(
                          question.id,
                          checked ? [...current, 'option2'] : current.filter((v: string) => v !== 'option2')
                        );
                      }}
                    />
                    <label htmlFor={`${question.id}-option2`} className="text-sm font-normal">
                      Option 2
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`${question.id}-option3`}
                      checked={Array.isArray(responses[question.id]) && responses[question.id].includes('option3')}
                      onCheckedChange={(checked) => {
                        const current = Array.isArray(responses[question.id]) ? responses[question.id] : [];
                        updateResponse(
                          question.id,
                          checked ? [...current, 'option3'] : current.filter((v: string) => v !== 'option3')
                        );
                      }}
                    />
                    <label htmlFor={`${question.id}-option3`} className="text-sm font-normal">
                      Option 3
                    </label>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Note: Multi-select options should be configured in the question metadata
                </p>
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
                />
                <p className="text-xs text-muted-foreground">
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
                <label htmlFor={question.id} className="text-sm font-normal">
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
      </CardContent>
    </Card>
  );
}


