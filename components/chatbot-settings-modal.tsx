'use client';

/**
 * ChatbotSettingsModal component
 * 
 * Modal dialog that displays and allows editing of chatbot-specific user context.
 * Reuses UserContextEditor component with filtered contexts for the current chatbot.
 * 
 * Features:
 * - Fetches userId, contexts, and intake questions on mount/open
 * - Shows loading spinner while fetching
 * - Handles errors gracefully
 * - Filters contexts to show only chatbot-specific ones (excludes global)
 * - Uses Dialog component for consistent modal UI
 * 
 * Usage:
 * ```tsx
 * <ChatbotSettingsModal
 *   chatbotId="bot-123"
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 * />
 * ```
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { UserContextEditor } from './user-context-editor';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../lib/theme/theme-context';

interface UserContext {
  id: string;
  key: string;
  value: any;
  chatbotId: string | null;
  chatbot?: { title: string } | null;
  source: string;
  isEditable: boolean;
}

interface IntakeQuestion {
  id: string;
  slug: string;
  questionText: string;
  helperText: string | null;
}

interface ChatbotSettingsModalProps {
  chatbotId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatbotSettingsModal({
  chatbotId,
  open,
  onOpenChange,
}: ChatbotSettingsModalProps) {
  const theme = useTheme();
  
  // State for data
  const [userId, setUserId] = useState<string | null>(null);
  const [contexts, setContexts] = useState<UserContext[]>([]);
  const [intakeQuestions, setIntakeQuestions] = useState<IntakeQuestion[]>([]);
  
  // State for loading and errors
  const [loadingUserId, setLoadingUserId] = useState(false);
  const [loadingContexts, setLoadingContexts] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  
  const [errorUserId, setErrorUserId] = useState<string | null>(null);
  const [errorContexts, setErrorContexts] = useState<string | null>(null);
  const [errorQuestions, setErrorQuestions] = useState<string | null>(null);

  // Combined loading state
  const isLoading = loadingUserId || loadingContexts || loadingQuestions;
  
  // Check if all required data is loaded
  const isDataReady = userId !== null && !loadingContexts && !loadingQuestions && errorUserId === null;

  // Fetch userId from /api/user/current
  useEffect(() => {
    if (!open) return; // Only fetch when modal is open

    let cancelled = false;

    async function fetchUserId() {
      setLoadingUserId(true);
      setErrorUserId(null);

      try {
        const response = await fetch('/api/user/current');
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch user ID');
        }

        const data = await response.json();
        
        if (!cancelled && data.userId) {
          setUserId(data.userId);
        }
      } catch (error) {
        console.error('Error fetching user ID:', error);
        if (!cancelled) {
          setErrorUserId(error instanceof Error ? error.message : 'Failed to fetch user ID');
        }
      } finally {
        if (!cancelled) {
          setLoadingUserId(false);
        }
      }
    }

    fetchUserId();

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Fetch contexts from /api/user-context?chatbotId=xxx
  useEffect(() => {
    if (!open) return; // Only fetch when modal is open

    let cancelled = false;

    async function fetchContexts() {
      setLoadingContexts(true);
      setErrorContexts(null);

      try {
        const response = await fetch(`/api/user-context?chatbotId=${encodeURIComponent(chatbotId)}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch contexts');
        }

        const data = await response.json();
        
        if (!cancelled && data.contexts) {
          setContexts(data.contexts);
        }
      } catch (error) {
        console.error('Error fetching contexts:', error);
        if (!cancelled) {
          setErrorContexts(error instanceof Error ? error.message : 'Failed to fetch contexts');
        }
      } finally {
        if (!cancelled) {
          setLoadingContexts(false);
        }
      }
    }

    fetchContexts();

    return () => {
      cancelled = true;
    };
  }, [open, chatbotId]);

  // Fetch intake questions from /api/intake/questions?chatbotId=xxx
  useEffect(() => {
    if (!open) return; // Only fetch when modal is open

    let cancelled = false;

    async function fetchIntakeQuestions() {
      setLoadingQuestions(true);
      setErrorQuestions(null);

      try {
        const response = await fetch(`/api/intake/questions?chatbotId=${encodeURIComponent(chatbotId)}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch intake questions');
        }

        const data = await response.json();
        
        if (!cancelled && data.questions) {
          setIntakeQuestions(data.questions);
        }
      } catch (error) {
        console.error('Error fetching intake questions:', error);
        if (!cancelled) {
          setErrorQuestions(error instanceof Error ? error.message : 'Failed to fetch intake questions');
        }
      } finally {
        if (!cancelled) {
          setLoadingQuestions(false);
        }
      }
    }

    fetchIntakeQuestions();

    return () => {
      cancelled = true;
    };
  }, [open, chatbotId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      // Reset state after a short delay to allow animations to complete
      const timer = setTimeout(() => {
        setUserId(null);
        setContexts([]);
        setIntakeQuestions([]);
        setErrorUserId(null);
        setErrorContexts(null);
        setErrorQuestions(null);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Build questionMap from intakeQuestions
  const questionMap = new Map<string, IntakeQuestion>(
    intakeQuestions.map((q) => [q.slug, q])
  );

  // Determine what to render
  const hasCriticalError = errorUserId !== null; // userId is required
  const hasNonCriticalError = errorContexts !== null || errorQuestions !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle style={{ color: theme.textColor }}>
            Advisor Settings
          </DialogTitle>
        </DialogHeader>

        {/* Edit Your Context heading */}
        <h2 className="text-2xl font-bold mb-4" style={{ color: theme.textColor }}>
          Edit Your Context
        </h2>

        <div className="mt-4">
          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mb-4" style={{ color: theme.textColor }} />
              <p className="text-sm" style={{ color: theme.textColor, opacity: 0.7 }}>
                Loading settings...
              </p>
            </div>
          )}

          {/* Critical error (userId fetch failed) */}
          {!isLoading && hasCriticalError && (
            <div className="py-8">
              <div 
                className="p-4 rounded-lg border"
                style={{
                  backgroundColor: theme.theme === 'light' ? '#fef2f2' : '#7f1d1d',
                  borderColor: theme.theme === 'light' ? '#fecaca' : '#991b1b',
                }}
              >
                <p className="text-sm font-medium mb-2" style={{ color: theme.theme === 'light' ? '#991b1b' : '#fecaca' }}>
                  Error loading settings
                </p>
                <p className="text-sm" style={{ color: theme.theme === 'light' ? '#7f1d1d' : '#fca5a5' }}>
                  {errorUserId}
                </p>
                <p className="text-sm mt-2" style={{ color: theme.theme === 'light' ? '#7f1d1d' : '#fca5a5' }}>
                  Please try again later or refresh the page.
                </p>
              </div>
            </div>
          )}

          {/* Data ready - render UserContextEditor */}
          {!isLoading && !hasCriticalError && isDataReady && (
            <>
              {/* Show non-critical errors as warnings */}
              {hasNonCriticalError && (
                <div className="mb-4">
                  {errorContexts && (
                    <div 
                      className="p-3 rounded-lg border mb-2"
                      style={{
                        backgroundColor: theme.theme === 'light' ? '#fffbeb' : '#78350f',
                        borderColor: theme.theme === 'light' ? '#fde68a' : '#92400e',
                      }}
                    >
                      <p className="text-sm" style={{ color: theme.theme === 'light' ? '#92400e' : '#fde68a' }}>
                        Warning: {errorContexts}. Contexts may not display correctly.
                      </p>
                    </div>
                  )}
                  {errorQuestions && (
                    <div 
                      className="p-3 rounded-lg border"
                      style={{
                        backgroundColor: theme.theme === 'light' ? '#fffbeb' : '#78350f',
                        borderColor: theme.theme === 'light' ? '#fde68a' : '#92400e',
                      }}
                    >
                      <p className="text-sm" style={{ color: theme.theme === 'light' ? '#92400e' : '#fde68a' }}>
                        Warning: {errorQuestions}. Question text may not display correctly.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Render UserContextEditor with all data */}
              <UserContextEditor
                contexts={contexts}
                questionMap={questionMap}
                onDelete={async () => {
                  // Refetch contexts after deletion
                  try {
                    const response = await fetch(`/api/user-context?chatbotId=${encodeURIComponent(chatbotId)}`);
                    if (response.ok) {
                      const data = await response.json();
                      if (data.contexts) {
                        setContexts(data.contexts);
                      }
                    }
                  } catch (error) {
                    console.error('Error refetching contexts after deletion:', error);
                  }
                }}
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

