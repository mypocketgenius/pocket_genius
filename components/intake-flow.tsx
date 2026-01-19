'use client';

// components/intake-flow.tsx
// Extracted intake UI component - handles all intake question rendering, input fields, and verification buttons
// Separates intake UI logic from chat component

import React from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { UseConversationalIntakeReturn } from '../hooks/use-conversational-intake';
import { WelcomeData } from '../hooks/use-intake-gate';

interface IntakeFlowProps {
  intakeHook: UseConversationalIntakeReturn;
  welcomeData: WelcomeData;
  themeColors: {
    inputField: string;
    input: string;
    border: string;
    text: string;
  };
  textColor: string;
}

/**
 * IntakeFlow component - handles all intake question rendering and user interaction
 * 
 * Features:
 * - Question counter display
 * - Verification buttons (Yes/Modify) for existing responses
 * - Input fields for all question types (TEXT, NUMBER, SELECT, MULTI_SELECT, BOOLEAN)
 * - Error handling and retry logic
 * - Skip functionality for optional questions
 */
export function IntakeFlow({
  intakeHook,
  welcomeData,
  themeColors,
  textColor,
}: IntakeFlowProps) {
  return (
    <div className="space-y-3 mt-4">
      {/* Question counter */}
      {welcomeData.questions && (
        <div className="text-xs opacity-60" style={{ color: textColor }}>
          Question {intakeHook.currentQuestionIndex + 1} of {welcomeData.questions.length}
        </div>
      )}

      {/* Verification buttons */}
      {intakeHook.verificationMode && intakeHook.verificationQuestionId && (
        <div className="flex gap-3">
          <Button
            onClick={intakeHook.handleVerifyYes}
            disabled={intakeHook.isSaving}
            style={{
              backgroundColor: themeColors.inputField,
              color: textColor,
              borderColor: themeColors.border,
            }}
          >
            Yes
          </Button>
          <Button
            onClick={intakeHook.handleVerifyModify}
            variant="outline"
            disabled={intakeHook.isSaving}
            style={{
              backgroundColor: themeColors.input,
              color: textColor,
              borderColor: themeColors.border,
            }}
          >
            Modify
          </Button>
        </div>
      )}

      {/* Input fields (only when not in verification mode) */}
      {!intakeHook.verificationMode && intakeHook.currentQuestion && (
        <>
          {intakeHook.currentQuestion.responseType === 'TEXT' && (
            <div className="space-y-2">
              <textarea
                value={intakeHook.currentInput || ''}
                onChange={(e) => intakeHook.setCurrentInput(e.target.value)}
                placeholder="Type your answer..."
                rows={1}
                className="w-full resize-none border rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                  backgroundColor: themeColors.inputField,
                  borderColor: themeColors.border,
                  color: textColor,
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
                    if (intakeHook.currentInput && !intakeHook.isSaving) {
                      intakeHook.handleAnswer(intakeHook.currentInput);
                    }
                  }
                }}
              />
              <div className="flex gap-2 items-center">
                <Button
                  onClick={() => intakeHook.handleAnswer(intakeHook.currentInput)}
                  disabled={!intakeHook.currentInput || intakeHook.isSaving}
                  style={{
                    backgroundColor: themeColors.inputField,
                    color: textColor,
                    borderColor: themeColors.border,
                  }}
                >
                  {intakeHook.isSaving ? 'Saving...' : 'Continue'}
                </Button>
                {!intakeHook.currentQuestion.isRequired && (
                  <button
                    onClick={intakeHook.handleSkip}
                    disabled={intakeHook.isSaving}
                    className="text-sm underline opacity-70 hover:opacity-100 transition-opacity"
                    style={{ color: textColor }}
                  >
                    Skip
                  </button>
                )}
              </div>
            </div>
          )}

          {intakeHook.currentQuestion.responseType === 'NUMBER' && (
            <div className="space-y-2">
              <Input
                type="number"
                value={intakeHook.currentInput || ''}
                onChange={(e) => intakeHook.setCurrentInput(parseFloat(e.target.value) || null)}
                placeholder="Enter a number..."
                style={{
                  backgroundColor: themeColors.inputField,
                  borderColor: themeColors.border,
                  color: textColor,
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && intakeHook.currentInput && !intakeHook.isSaving) {
                    intakeHook.handleAnswer(intakeHook.currentInput);
                  }
                }}
              />
              <div className="flex gap-2 items-center">
                <Button
                  onClick={() => intakeHook.handleAnswer(intakeHook.currentInput)}
                  disabled={!intakeHook.currentInput || intakeHook.isSaving}
                  style={{
                    backgroundColor: themeColors.inputField,
                    color: textColor,
                    borderColor: themeColors.border,
                  }}
                >
                  {intakeHook.isSaving ? 'Saving...' : 'Continue'}
                </Button>
                {!intakeHook.currentQuestion.isRequired && (
                  <button
                    onClick={intakeHook.handleSkip}
                    disabled={intakeHook.isSaving}
                    className="text-sm underline opacity-70 hover:opacity-100 transition-opacity"
                    style={{ color: textColor }}
                  >
                    Skip
                  </button>
                )}
              </div>
            </div>
          )}

          {intakeHook.currentQuestion.responseType === 'SELECT' && (
            <Select
              value={intakeHook.currentInput || ''}
              onValueChange={(value) => {
                intakeHook.setCurrentInput(value);
                intakeHook.handleAnswer(value);
              }}
            >
              <SelectTrigger
                style={{
                  backgroundColor: themeColors.inputField,
                  borderColor: themeColors.border,
                  color: textColor,
                }}
              >
                <SelectValue placeholder="Select an option..." />
              </SelectTrigger>
              <SelectContent
                style={{
                  backgroundColor: themeColors.input,
                  borderColor: themeColors.border,
                  color: textColor,
                }}
              >
                {intakeHook.currentQuestion.options && intakeHook.currentQuestion.options.length > 0 ? (
                  intakeHook.currentQuestion.options.map((option, index) => (
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

          {intakeHook.currentQuestion.responseType === 'MULTI_SELECT' && (
            <div className="space-y-2">
              {intakeHook.currentQuestion.options && intakeHook.currentQuestion.options.length > 0 ? (
                intakeHook.currentQuestion.options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${intakeHook.currentQuestion!.id}-${index}`}
                      checked={Array.isArray(intakeHook.currentInput) && intakeHook.currentInput.includes(option)}
                      onCheckedChange={(checked) => {
                        const current = Array.isArray(intakeHook.currentInput) ? intakeHook.currentInput : [];
                        const newValue = checked
                          ? [...current, option]
                          : current.filter((v: string) => v !== option);
                        intakeHook.setCurrentInput(newValue);
                      }}
                    />
                    <label
                      htmlFor={`${intakeHook.currentQuestion!.id}-${index}`}
                      className="text-sm"
                      style={{ color: textColor }}
                    >
                      {option}
                    </label>
                  </div>
                ))
              ) : (
                <p className="text-xs" style={{ color: textColor, opacity: 0.7 }}>
                  No options available
                </p>
              )}
              {Array.isArray(intakeHook.currentInput) && intakeHook.currentInput.length > 0 && (
                <Button
                  onClick={() => intakeHook.handleAnswer(intakeHook.currentInput)}
                  disabled={intakeHook.isSaving}
                  style={{
                    backgroundColor: themeColors.inputField,
                    color: textColor,
                    borderColor: themeColors.border,
                  }}
                >
                  {intakeHook.isSaving ? 'Saving...' : 'Continue'}
                </Button>
              )}
            </div>
          )}

          {intakeHook.currentQuestion.responseType === 'BOOLEAN' && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id={intakeHook.currentQuestion.id}
                checked={intakeHook.currentInput === true}
                onCheckedChange={(checked) => {
                  intakeHook.setCurrentInput(checked === true);
                  intakeHook.handleAnswer(checked === true);
                }}
              />
              <label
                htmlFor={intakeHook.currentQuestion.id}
                className="text-sm"
                style={{ color: textColor }}
              >
                {intakeHook.currentQuestion.helperText || 'Yes'}
              </label>
            </div>
          )}

          {/* Error message */}
          {intakeHook.error && (
            <div className="text-sm text-red-500 mt-2">
              {intakeHook.error}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (intakeHook.currentQuestion?.responseType === 'TEXT' || intakeHook.currentQuestion?.responseType === 'NUMBER') {
                    intakeHook.handleAnswer(intakeHook.currentInput);
                  }
                }}
                className="ml-2"
                disabled={intakeHook.isSaving}
              >
                Retry
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

