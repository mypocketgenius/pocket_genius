'use client';

// Phase 2: Gap capture component
// Captures gap submission using regular chat input field (not separate textarea)

import { useEffect } from 'react';

interface GapCaptureProps {
  trigger: 'expansion_followup' | 'bot_punt' | 'rephrase_detected' | 'not_helpful_feedback';
  expansionType?: string;
  chunkIds: string[];
  inputValue: string; // Uses existing chat input state
  onInputChange: (value: string) => void; // Updates existing chat input
  onSkip: () => void;
  onSubmit: () => void; // Uses existing send message handler
  isVisible: boolean; // Controls when prompt appears
}

/**
 * GapCapture component - Captures gap submission using regular chat input field
 * 
 * @component
 * @example
 * ```tsx
 * <GapCapture
 *   trigger="not_helpful_feedback"
 *   expansionType="give_me_an_example"
 *   chunkIds={['chunk-1']}
 *   inputValue={input}
 *   onInputChange={setInput}
 *   onSkip={() => setIsGapCaptureVisible(false)}
 *   onSubmit={handleSendMessage}
 *   isVisible={isGapCaptureVisible}
 * />
 * ```
 * 
 * Features:
 * - Shows prompt text above regular chat input (varies by trigger type)
 * - Uses existing input state and setInput from chat component (no separate textarea)
 * - Uses existing send button to submit (Enter key or button click)
 * - Auto-dismisses after 30 seconds if no interaction
 * - Logs gap submission to Events table with eventType='gap_submission'
 * - Prompt text adapts based on trigger type:
 *   - expansion_followup: "What were you hoping for?"
 *   - bot_punt: "I don't have information on that. What were you looking for?"
 *   - rephrase_detected: "It seems like you're asking about something similar..."
 *   - not_helpful_feedback: "What would have made this more helpful?"
 * 
 * @param {GapCaptureProps} props - Component props
 * @param {'expansion_followup' | 'bot_punt' | 'rephrase_detected' | 'not_helpful_feedback'} props.trigger - What triggered the gap capture prompt
 * @param {string} [props.expansionType] - Type of expansion if triggered by expansion follow-up
 * @param {string[]} props.chunkIds - Array of chunk IDs from message context
 * @param {string} props.inputValue - Current input value (from chat component state)
 * @param {(value: string) => void} props.onInputChange - Callback to update input (from chat component)
 * @param {() => void} props.onSkip - Callback when user skips gap capture
 * @param {() => void} props.onSubmit - Callback when user submits (uses existing send handler)
 * @param {boolean} props.isVisible - Controls when prompt appears
 * 
 * @returns {JSX.Element | null} Gap capture prompt or null if not visible
 */
export function GapCapture({
  trigger,
  expansionType,
  chunkIds,
  inputValue,
  onInputChange,
  onSkip,
  onSubmit,
  isVisible,
}: GapCaptureProps) {
  // Auto-dismiss after 30 seconds
  useEffect(() => {
    if (!isVisible) return;

    const timeout = setTimeout(() => {
      onSkip();
    }, 30000); // 30 seconds

    return () => clearTimeout(timeout);
  }, [isVisible, onSkip]);

  const handleSubmit = async () => {
    if (!inputValue.trim()) {
      return;
    }

    try {
      // Log gap submission event
      await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType: 'gap_submission',
          chunkIds,
          metadata: {
            trigger,
            expansion_type: expansionType || null,
            text: inputValue.trim(),
          },
        }),
      });

      // Submit via existing handler
      onSubmit();
    } catch (error) {
      console.error('Error logging gap submission:', error);
      // Still submit on error
      onSubmit();
    }
  };

  if (!isVisible) {
    return null;
  }

  // Get prompt text based on trigger
  const getPromptText = () => {
    switch (trigger) {
      case 'expansion_followup':
        return "What were you hoping for?";
      case 'bot_punt':
        return "I don't have information on that. What were you looking for?";
      case 'rephrase_detected':
        return "It seems like you're asking about something similar. What specifically are you trying to find?";
      case 'not_helpful_feedback':
        return "What would have made this more helpful?";
      default:
        return "What were you hoping for?";
    }
  };

  return (
    <div className="mb-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
      <p className="text-sm text-gray-700 mb-2">{getPromptText()}</p>
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Type your response..."
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        <button
          onClick={onSkip}
          className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

