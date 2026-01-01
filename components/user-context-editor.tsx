// components/user-context-editor.tsx
// Phase 3.10, Step 8: User Context Editor Component
// Allows users to view and edit their user context (global and chatbot-specific)

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface UserContext {
  id: string;
  key: string;
  value: any;
  chatbotId: string | null;
  chatbot?: { title: string } | null;
  source: string;
  isEditable: boolean;
}

interface UserContextEditorProps {
  contexts: UserContext[];
  userId: string;
}

/**
 * UserContextEditor Component
 * 
 * Displays and allows editing of user context (global and chatbot-specific).
 * 
 * Features:
 * - Groups contexts by global vs chatbot-specific
 * - Edit mode with save/cancel
 * - Handles different value types (strings, numbers, arrays, objects)
 * - Shows source badge (INTAKE_FORM, USER_PROVIDED, etc.)
 * - Only allows editing if isEditable is true
 */
export function UserContextEditor({ contexts, userId }: UserContextEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  // Group contexts by chatbot
  const globalContexts = contexts.filter((c) => !c.chatbotId);
  const chatbotContexts = contexts.filter((c) => c.chatbotId);
  const byChatbot = chatbotContexts.reduce((acc, ctx) => {
    const chatbotId = ctx.chatbotId!;
    if (!acc[chatbotId]) acc[chatbotId] = [];
    acc[chatbotId].push(ctx);
    return acc;
  }, {} as Record<string, UserContext[]>);

  return (
    <div className="space-y-8">
      {/* Global Context */}
      {globalContexts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Global Context</CardTitle>
            <CardDescription>
              This information applies to all chatbots
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {globalContexts.map((ctx) => {
                const isEditing = editing[ctx.id] !== undefined;
                const isSaving = saving[ctx.id] || false;
                const error = errors[ctx.id];

                return (
                  <div key={ctx.id} className="flex flex-col gap-2">
                    <div className="flex items-start gap-4">
                      <div className="w-32 font-medium capitalize shrink-0">
                        {ctx.key.replace(/_/g, ' ')}
                      </div>
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
                              >
                                Edit
                              </Button>
                            )}
                            <Badge variant="secondary" className="shrink-0">
                              {ctx.source.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chatbot-Specific Context */}
      {Object.entries(byChatbot).map(([chatbotId, ctxs]) => (
        <Card key={chatbotId}>
          <CardHeader>
            <CardTitle>
              {ctxs[0].chatbot?.title || 'Chatbot'} Context
            </CardTitle>
            <CardDescription>
              This information applies only to this specific chatbot
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ctxs.map((ctx) => {
                const isEditing = editing[ctx.id] !== undefined;
                const isSaving = saving[ctx.id] || false;
                const error = errors[ctx.id];

                return (
                  <div key={ctx.id} className="flex flex-col gap-2">
                    <div className="flex items-start gap-4">
                      <div className="w-32 font-medium capitalize shrink-0">
                        {ctx.key.replace(/_/g, ' ')}
                      </div>
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
                              >
                                Edit
                              </Button>
                            )}
                            <Badge variant="secondary" className="shrink-0">
                              {ctx.source.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Empty State */}
      {globalContexts.length === 0 && Object.keys(byChatbot).length === 0 && (
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

