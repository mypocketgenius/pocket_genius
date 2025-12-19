'use client';

// Phase 2: Expansion follow-up component
// Shows "Did that cover what you were looking for?" after expansion responses

import { useState, useEffect } from 'react';

interface ExpansionFollowupProps {
  messageId: string;
  expansionType: string;
  chunkIds: string[];
  onSatisfied: () => void;
  onUnsatisfied: () => void;
}

/**
 * ExpansionFollowup component - Shows satisfaction prompt after expansion responses
 * 
 * @component
 * @example
 * ```tsx
 * <ExpansionFollowup
 *   messageId="msg-123"
 *   expansionType="give_me_an_example"
 *   chunkIds={['chunk-1', 'chunk-2']}
 *   onSatisfied={() => console.log('Satisfied')}
 *   onUnsatisfied={() => openGapCapture()}
 * />
 * ```
 * 
 * Features:
 * - Appears inline below bot's expansion response
 * - "Yes, thanks" button → logs satisfied event, dismisses prompt
 * - "Not quite" button → logs unsatisfied event, opens gap capture component
 * - Auto-dismisses after 30 seconds if no interaction
 * - Only shows once per expansion (not repeatedly)
 * - Logs events to Events table with eventType='expansion_followup'
 * 
 * @param {ExpansionFollowupProps} props - Component props
 * @param {string} props.messageId - ID of the message that triggered expansion
 * @param {string} props.expansionType - Type of expansion (e.g., 'give_me_an_example')
 * @param {string[]} props.chunkIds - Array of chunk IDs from message context
 * @param {() => void} props.onSatisfied - Callback when user clicks "Yes, thanks"
 * @param {() => void} props.onUnsatisfied - Callback when user clicks "Not quite"
 * 
 * @returns {JSX.Element | null} Follow-up prompt or null if dismissed
 */
export function ExpansionFollowup({
  messageId,
  expansionType,
  chunkIds,
  onSatisfied,
  onUnsatisfied,
}: ExpansionFollowupProps) {
  const [isVisible, setIsVisible] = useState(true);

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsVisible(false);
    }, 30000); // 30 seconds

    return () => clearTimeout(timeout);
  }, []);

  const handleSatisfied = async () => {
    try {
      // Log satisfied event
      await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType: 'expansion_followup',
          chunkIds,
          metadata: {
            result: 'satisfied',
            expansion_type: expansionType,
            messageId,
          },
        }),
      });

      setIsVisible(false);
      onSatisfied();
    } catch (error) {
      console.error('Error logging satisfied event:', error);
      // Still dismiss on error
      setIsVisible(false);
      onSatisfied();
    }
  };

  const handleUnsatisfied = async () => {
    try {
      // Log unsatisfied event
      await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType: 'expansion_followup',
          chunkIds,
          metadata: {
            result: 'unsatisfied',
            expansion_type: expansionType,
            messageId,
          },
        }),
      });

      setIsVisible(false);
      onUnsatisfied();
    } catch (error) {
      console.error('Error logging unsatisfied event:', error);
      // Still proceed to gap capture on error
      setIsVisible(false);
      onUnsatisfied();
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
      <p className="text-sm text-gray-700 mb-2">Did that cover what you were looking for?</p>
      <div className="flex gap-2">
        <button
          onClick={handleSatisfied}
          className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 border border-green-300 rounded-md hover:bg-green-200 transition-colors"
        >
          Yes, thanks
        </button>
        <button
          onClick={handleUnsatisfied}
          className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 border border-red-300 rounded-md hover:bg-red-200 transition-colors"
        >
          Not quite
        </button>
      </div>
    </div>
  );
}

