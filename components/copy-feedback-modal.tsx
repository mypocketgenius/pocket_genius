'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

interface CopyFeedbackModalProps {
  open: boolean;
  onClose: () => void;
  messageId: string;
  onSuccess?: () => void;
  onShowToast?: (message: string, type: 'success' | 'error') => void;
}

/**
 * Copy feedback modal component
 * 
 * Phase 5: Copy Button with Feedback (kept per plan decision)
 * 
 * Allows users to specify how they'll use copied content. Opens immediately
 * after copy button is clicked (no intermediate toast). Collects usage type
 * and optional context for "adapt" usage.
 * 
 * Note: Uses /api/feedback/message route which has been updated to use Events table
 * instead of Message_Feedback table (Phase 5 migration).
 * 
 * Features:
 * - Radio-style button selection for usage type
 * - Conditional textarea for "adapt" usage
 * - Toast notification on success (consistent with helpful/not_helpful feedback)
 * - Duplicate prevention handled by API
 * 
 * Usage types:
 * - reference: User saves for later reference
 * - use_now: User wants to use immediately (increments copyToUseNowCount)
 * - share_team: User shares with team
 * - adapt: User adapts for specific situation (requires context)
 * 
 * @param open - Whether modal is open
 * @param onClose - Callback when modal closes
 * @param messageId - ID of message that was copied
 * @param onSuccess - Optional success callback
 * @param onShowToast - Callback to show toast notification (for consistency with other feedback)
 */
export function CopyFeedbackModal({
  open,
  onClose,
  messageId,
  onSuccess,
  onShowToast,
}: CopyFeedbackModalProps) {
  const [usage, setUsage] = useState<string>('');
  const [context, setContext] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Usage options for copied content
  // These values match the copyUsage enum in the API validation
  const usageOptions = [
    { value: 'reference', label: 'Reference / save for later' },
    { value: 'use_now', label: 'Use in my work right now' },
    { value: 'share_team', label: 'Share with my team' },
    { value: 'adapt', label: 'Adapt for my specific situation' },
  ];

  /**
   * Handles form submission
   * 
   * Sends copy feedback to the API with usage type and optional context.
   * The API will update the existing copy event (created when copy button
   * was clicked) with the usage data in Events table. This prevents duplicate records.
   * 
   * Note: Uses /api/feedback/message route which stores data in Events table
   * (eventType: 'copy' with copyUsage and copyContext in metadata).
   * 
   * On success:
   * - Resets form state
   * - Closes modal immediately
   * - Shows success toast notification (via onShowToast callback)
   * 
   * On error:
   * - Shows error toast notification
   * - Keeps modal open for retry
   */
  async function handleSubmit() {
    if (!usage) return;

    setSubmitting(true);

    try {
      const response = await fetch('/api/feedback/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          feedbackType: 'copy',
          copyUsage: usage,
          copyContext: usage === 'adapt' ? context || undefined : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit feedback');
      }

      // Reset form and close modal immediately
      setUsage('');
      setContext('');
      setSubmitting(false);
      onClose();

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }

      // Show toast notification (same as helpful/not_helpful feedback)
      if (onShowToast) {
        onShowToast('Thanks for your feedback!', 'success');
      }
    } catch (error) {
      console.error('Error submitting copy feedback:', error);
      setSubmitting(false);
      
      // Show error toast if callback provided
      if (onShowToast) {
        onShowToast(
          error instanceof Error
            ? error.message
            : 'Failed to submit feedback. Please try again.',
          'error'
        );
      } else {
        // Fallback to alert if no toast callback
        alert(
          error instanceof Error
            ? error.message
            : 'Failed to submit feedback. Please try again.'
        );
      }
      // Keep modal open on error so user can retry
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>✓ Copied! What will you use this for?</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Radio-style buttons for usage selection */}
          <div className="space-y-2">
            {usageOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setUsage(option.value)}
                disabled={submitting}
                className={`w-full text-left p-3 rounded-md border-2 transition-all ${
                  usage === option.value
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      usage === option.value
                        ? 'border-blue-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {usage === option.value && (
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <span className="text-sm font-medium">{option.label}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Context textarea for "adapt" option */}
          {usage === 'adapt' && (
            <div>
              <label className="text-sm font-medium block mb-2">
                What&apos;s your specific situation?
              </label>
              <Textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="I'm trying to..."
                rows={3}
                className="resize-none"
                disabled={submitting}
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 justify-end pt-2">
            <Button
              onClick={handleSubmit}
              disabled={!usage || submitting}
              className="min-w-[100px]"
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

