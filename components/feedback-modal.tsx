'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  messageId: string;
  onSuccess?: () => void; // Callback for successful submission
}

/**
 * Feedback modal component for "Need More" feedback
 * Allows users to specify what additional information they need
 * Phase 3.3: "Need More" Modal
 */
export function FeedbackModal({ open, onClose, messageId, onSuccess }: FeedbackModalProps) {
  const [needsMore, setNeedsMore] = useState<string[]>([]);
  const [situation, setSituation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  
  // Options for what users need more of
  const options = [
    { value: 'scripts', label: 'Scripts or exact words to use' },
    { value: 'examples', label: 'More examples' },
    { value: 'steps', label: 'Step-by-step instructions' },
    { value: 'case_studies', label: 'Case studies or real scenarios' },
  ];
  
  /**
   * Handles form submission
   * Sends feedback to the API with needsMore array and specificSituation
   */
  async function handleSubmit() {
    if (needsMore.length === 0) return;
    
    setSubmitting(true);
    
    try {
      const response = await fetch('/api/feedback/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          feedbackType: 'need_more',
          needsMore,
          specificSituation: situation || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit feedback');
      }

      // Show thank you message
      setShowThankYou(true);
      setSubmitting(false);
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      // Close modal after 4 seconds
      setTimeout(() => {
        setNeedsMore([]);
        setSituation('');
        setShowThankYou(false);
        onClose();
      }, 4000);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setSubmitting(false);
      // Keep modal open on error so user can retry
      alert(error instanceof Error ? error.message : 'Failed to submit feedback. Please try again.');
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {showThankYou ? 'Thank you!' : 'What would make this more helpful?'}
          </DialogTitle>
        </DialogHeader>
        
        {showThankYou ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-900">
                Thank you for your feedback! It will be used to make the AI smarter and more helpful.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
          <div className="space-y-2">
            {options.map((option) => (
              <label 
                key={option.value} 
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors"
              >
                <Checkbox
                  checked={needsMore.includes(option.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setNeedsMore([...needsMore, option.value]);
                    } else {
                      setNeedsMore(needsMore.filter(v => v !== option.value));
                    }
                  }}
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
          
          <div>
            <label className="text-sm font-medium block mb-2">
              What&apos;s your specific situation? (optional)
            </label>
            <Textarea
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              placeholder="I'm trying to..."
              rows={3}
              className="resize-none"
            />
          </div>
          
          <div className="flex gap-2 justify-end">
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || needsMore.length === 0}
              className="min-w-[120px]"
            >
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

