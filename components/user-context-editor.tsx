// components/user-context-editor.tsx
// Phase 3.10, Step 8: User Context Editor Component
// Allows users to view and edit their user context (global and chatbot-specific)

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { X, CheckCircle2 } from 'lucide-react';
import { useTheme } from '@/lib/theme/theme-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

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

interface UserContextEditorProps {
  contexts: UserContext[];
  questionMap: Map<string, IntakeQuestion>;
  onDelete?: () => void; // Optional callback to refetch contexts after deletion
}

/**
 * UserContextEditor Component
 * 
 * Displays and allows editing of user context (global and chatbot-specific).
 * 
 * Features:
 * - Groups contexts by question (key) rather than chatbot
 * - Shows all context values for each question, indicating which chatbot each applies to
 * - Edit mode with save/cancel
 * - Handles different value types (strings, numbers, arrays, objects)
 * - Shows source badge (INTAKE_FORM, USER_PROVIDED, etc.)
 * - Only allows editing if isEditable is true
 */
export function UserContextEditor({ contexts, questionMap, onDelete }: UserContextEditorProps) {
  const router = useRouter();
  const theme = useTheme();
  const [localContexts, setLocalContexts] = useState<UserContext[]>(contexts);
  const [editing, setEditing] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [contextToDelete, setContextToDelete] = useState<UserContext | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  // Update local contexts when props change
  useEffect(() => {
    setLocalContexts(contexts);
  }, [contexts]);

  // Theme-aware hover colors
  const hoverBgColor = theme.theme === 'light' 
    ? 'rgba(0, 0, 0, 0.05)' 
    : 'rgba(255, 255, 255, 0.1)';

  /**
   * Handles saving a context value
   */
  async function handleSave(contextId: string, newValue: any) {
    setSaving({ ...saving, [contextId]: true });
    setErrors({ ...errors, [contextId]: '' });

    try {
      const response = await fetch('/api/user-context', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contextId,
          value: newValue,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save context');
      }

      // Clear editing state and refresh page to show updated values
      setEditing({ ...editing, [contextId]: false });
      router.refresh();
    } catch (error) {
      console.error('Error saving context:', error);
      setErrors({
        ...errors,
        [contextId]: error instanceof Error ? error.message : 'Failed to save',
      });
    } finally {
      setSaving({ ...saving, [contextId]: false });
    }
  }

  /**
   * Opens the delete confirmation dialog
   */
  function handleDeleteClick(context: UserContext) {
    if (context.source !== 'INTAKE_FORM') {
      return;
    }
    setContextToDelete(context);
    setDeleteConfirmOpen(true);
  }

  /**
   * Handles deleting an intake response after confirmation
   */
  async function handleDeleteConfirmed() {
    if (!contextToDelete) return;

    const context = contextToDelete;
    const contextId = context.id;
    
    setDeleteConfirmOpen(false);
    setDeleting({ ...deleting, [contextId]: true });
    setErrors({ ...errors, [contextId]: '' });
    setDeleteSuccess(null);

    // Store previous state in case we need to restore
    const previousContexts = localContexts;

    try {
      const response = await fetch('/api/intake/responses', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatbotId: context.chatbotId ?? '',
          questionSlug: context.key,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete response');
      }

      // Optimistically remove from UI
      setLocalContexts(prev => prev.filter(ctx => ctx.id !== contextId));
      
      // Show success message
      setDeleteSuccess('Response deleted successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setDeleteSuccess(null);
      }, 3000);

      // Call parent callback if provided (for refetching)
      if (onDelete) {
        onDelete();
      } else {
        // Refresh page to show updated values (for server-rendered pages)
        router.refresh();
      }
    } catch (error) {
      console.error('Error deleting intake response:', error);
      // Restore previous state if deletion failed
      setLocalContexts(previousContexts);
      setErrors({
        ...errors,
        [contextId]: error instanceof Error ? error.message : 'Failed to delete',
      });
    } finally {
      setDeleting({ ...deleting, [contextId]: false });
      setContextToDelete(null);
    }
  }

  /**
   * Formats a value for display
   */
  function formatValue(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    // For arrays and objects, use JSON.stringify with formatting
    return JSON.stringify(value, null, 2);
  }

  /**
   * Parses a string value back to its original type
   */
  function parseValue(originalValue: any, newStringValue: string): any {
    // Try to parse as JSON first (for arrays, objects, numbers, booleans)
    try {
      return JSON.parse(newStringValue);
    } catch {
      // If not valid JSON, return as string
      return newStringValue;
    }
  }

  /**
   * Gets the input component based on value type
   */
  function getInputComponent(context: UserContext, isEditing: boolean) {
    const value = editing[context.id] ?? context.value;
    const isComplexValue = typeof context.value === 'object' && context.value !== null;

    if (isEditing) {
      if (isComplexValue) {
        // Use textarea for complex values (arrays, objects)
        return (
          <Textarea
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) =>
              setEditing({ ...editing, [context.id]: e.target.value })
            }
            className="font-mono text-sm"
            rows={4}
          />
        );
      } else {
        // Use input for simple values (strings, numbers)
        return (
          <Input
            value={String(value)}
            onChange={(e) =>
              setEditing({ ...editing, [context.id]: e.target.value })
            }
          />
        );
      }
    }
    return null;
  }

  // Group contexts by question (key) instead of chatbot
  const byQuestion = localContexts.reduce((acc, ctx) => {
    const key = ctx.key;
    if (!acc[key]) acc[key] = [];
    acc[key].push(ctx);
    return acc;
  }, {} as Record<string, UserContext[]>);

  // Sort questions by their display order (if available) or alphabetically
  const sortedQuestionKeys = Object.keys(byQuestion).sort((a, b) => {
    const questionA = questionMap.get(a);
    const questionB = questionMap.get(b);
    // If both have questions, sort by question text
    if (questionA && questionB) {
      return questionA.questionText.localeCompare(questionB.questionText);
    }
    // Otherwise sort by key
    return a.localeCompare(b);
  });

  // Get question text for the context being deleted
  const deleteQuestionText = contextToDelete 
    ? (questionMap.get(contextToDelete.key)?.questionText || contextToDelete.key.replace(/_/g, ' '))
    : '';

  return (
    <div className="space-y-8">
      {/* Success message */}
      {deleteSuccess && (
        <div 
          className="p-4 rounded-lg border flex items-center gap-2"
          style={{
            backgroundColor: theme.theme === 'light' ? '#f0fdf4' : '#14532d',
            borderColor: theme.theme === 'light' ? '#86efac' : '#22c55e',
          }}
        >
          <CheckCircle2 className="h-5 w-5" style={{ color: theme.theme === 'light' ? '#16a34a' : '#86efac' }} />
          <p className="text-sm font-medium" style={{ color: theme.theme === 'light' ? '#16a34a' : '#86efac' }}>
            {deleteSuccess}
          </p>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent style={{ backgroundColor: theme.chrome.header, borderColor: theme.chrome.border }}>
          <DialogHeader>
            <DialogTitle style={{ color: theme.textColor }}>
              Delete Response?
            </DialogTitle>
            <DialogDescription style={{ color: theme.textColor, opacity: 0.8 }}>
              Are you sure you want to delete your response to &quot;{deleteQuestionText}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setContextToDelete(null);
              }}
              style={{
                backgroundColor: theme.chrome.header,
                color: theme.textColor,
                borderColor: theme.chrome.border,
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirmed}
              style={{
                backgroundColor: '#ef4444',
                color: 'white',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#dc2626';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ef4444';
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group by Question */}
      {sortedQuestionKeys.map((key) => {
        const question = questionMap.get(key);
        const ctxs = byQuestion[key];
        const questionText = question?.questionText || key.replace(/_/g, ' ');
        const helperText = question?.helperText;

        return (
          <Card key={key}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>{questionText}</CardTitle>
                {ctxs.length > 0 && (
                  <Badge variant="secondary" className="shrink-0">
                    {ctxs[0].source.replace(/_/g, ' ')}
                  </Badge>
                )}
              </div>
              {helperText && (
                <CardDescription>{helperText}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ctxs.map((ctx) => {
                  const isEditing = editing[ctx.id] !== undefined;
                  const isSaving = saving[ctx.id] || false;
                  const isDeleting = deleting[ctx.id] || false;
                  const error = errors[ctx.id];
                  const scopeLabel = ctx.chatbotId 
                    ? ctx.chatbot?.title || 'Chatbot'
                    : 'All Chatbots (Global)';
                  const canDelete = ctx.source === 'INTAKE_FORM';

                  return (
                    <div key={ctx.id} className="flex flex-col gap-2">
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="space-y-2">
                            {getInputComponent(ctx, true)}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  const newValue = parseValue(
                                    ctx.value,
                                    editing[ctx.id]
                                  );
                                  handleSave(ctx.id, newValue);
                                }}
                                disabled={isSaving}
                                style={{
                                  backgroundColor: theme.chrome.header,
                                  color: theme.textColor,
                                  border: `1px solid ${theme.chrome.border}`,
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = hoverBgColor;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = theme.chrome.header;
                                }}
                              >
                                {isSaving ? 'Saving...' : 'Save'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditing({ ...editing, [ctx.id]: undefined });
                                  setErrors({ ...errors, [ctx.id]: '' });
                                }}
                                disabled={isSaving}
                                style={{
                                  color: theme.textColor,
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = hoverBgColor;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                            {error && (
                              <p className="text-sm text-red-600">{error}</p>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 break-words font-mono text-sm">
                              {formatValue(ctx.value)}
                            </div>
                            <div className="flex items-center gap-2">
                              {ctx.isEditable && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setEditing({
                                      ...editing,
                                      [ctx.id]: formatValue(ctx.value),
                                    })
                                  }
                                  style={{
                                    backgroundColor: theme.chrome.header,
                                    color: theme.textColor,
                                    border: `1px solid ${theme.chrome.border}`,
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = hoverBgColor;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = theme.chrome.header;
                                  }}
                                >
                                  Edit
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteClick(ctx)}
                                  disabled={isDeleting}
                                  style={{
                                    color: '#ef4444',
                                    padding: '0.25rem',
                                    minWidth: 'auto',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = theme.theme === 'light' 
                                      ? 'rgba(239, 68, 68, 0.1)' 
                                      : 'rgba(239, 68, 68, 0.2)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                  }}
                                  title="Delete response"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          {scopeLabel}
                        </div>
                        {isDeleting && (
                          <div className="text-sm text-muted-foreground">
                            Deleting...
                          </div>
                        )}
                      </div>
                      {error && !isEditing && (
                        <p className="text-sm text-red-600">{error}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Empty State */}
      {sortedQuestionKeys.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              No user context found. Complete intake forms to add context.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

