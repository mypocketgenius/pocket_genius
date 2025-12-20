'use client';

// Phase 2: Star rating component
// Displays 5-star rating with pulse animation and follow-up modal

import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  chatbotId: string;
  sessionId: string; // Conversation ID
  messageCount: number; // Number of messages sent in session
  initialRating?: number;
  showAggregate?: boolean; // For homepage cards (homepage will be made later in alpha build)
  aggregateRating?: number;
  aggregateCount?: number;
  onRatingChange?: (rating: number) => void;
}

/**
 * StarRating component - 5-star rating with pulse animation and follow-up modal
 * 
 * @component
 * @example
 * ```tsx
 * <StarRating
 *   chatbotId="bot-123"
 *   sessionId="conv-456"
 *   messageCount={3}
 *   initialRating={4}
 *   onRatingChange={(rating) => console.log('Rated:', rating)}
 * />
 * ```
 * 
 * Features:
 * - Inactive (muted) until first message sent (messageCount > 0)
 * - After first message: Stars begin subtle pulse/flash animation
 * - Animation stops after 10 seconds OR when user hovers/interacts
 * - Click a star to rate (1-5) → Opens follow-up modal
 * - Follow-up modal includes:
 *   - "What were you trying to accomplish?" (textarea)
 *   - "Did you get what you needed?" (Yes/Partially/No)
 *   - "What's still missing?" (conditional, if Partially/No)
 *   - "How much time did this save you?" (select dropdown)
 * - Once rated: Stars fill to show rating, animation stops
 * - User can change rating by clicking different star (re-opens follow-up modal)
 * - Updates Conversation_Feedback table and Chatbot_Ratings_Aggregate
 * 
 * @param {StarRatingProps} props - Component props
 * @param {string} props.chatbotId - ID of the chatbot being rated
 * @param {string} props.sessionId - Conversation ID (session identifier)
 * @param {number} props.messageCount - Number of messages sent in session (controls activation)
 * @param {number} [props.initialRating] - Initial rating value if already rated
 * @param {boolean} [props.showAggregate=false] - Show aggregate rating (for homepage cards)
 * @param {number} [props.aggregateRating] - Average rating for aggregate display
 * @param {number} [props.aggregateCount] - Number of ratings for aggregate display
 * @param {(rating: number) => void} [props.onRatingChange] - Callback when rating changes
 * 
 * @returns {JSX.Element} Star rating component with interactive stars
 */
export function StarRating({
  chatbotId,
  sessionId,
  messageCount,
  initialRating,
  showAggregate = false,
  aggregateRating,
  aggregateCount,
  onRatingChange,
}: StarRatingProps) {
  const [rating, setRating] = useState<number | null>(initialRating || null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [isPulsing, setIsPulsing] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpData, setFollowUpData] = useState({
    userGoal: '',
    goalAchieved: '',
    stillNeed: '',
    timeSaved: '',
  });

  // Start pulse animation after first message
  useEffect(() => {
    if (messageCount > 0 && !rating && !hasInteracted) {
      setIsPulsing(true);
      
      // Stop animation after 10 seconds
      const timeout = setTimeout(() => {
        setIsPulsing(false);
      }, 10000);

      return () => clearTimeout(timeout);
    }
  }, [messageCount, rating, hasInteracted]);

  // Stop pulsing when user interacts
  const handleInteraction = () => {
    setHasInteracted(true);
    setIsPulsing(false);
  };

  const handleStarClick = async (starRating: number) => {
    handleInteraction();
    
    // If clicking the same rating, allow changing it
    if (rating === starRating) {
      setShowFollowUpModal(true);
      return;
    }

    setRating(starRating);
    setShowFollowUpModal(true);
  };

  const handleFollowUpSubmit = async () => {
    if (!rating) return;

    try {
      // Submit rating and follow-up data
      const response = await fetch('/api/feedback/conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: sessionId,
          rating,
          userGoal: followUpData.userGoal || null,
          goalAchieved: followUpData.goalAchieved || null,
          stillNeed: followUpData.stillNeed || null,
          timeSaved: followUpData.timeSaved || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit rating');
      }

      setShowFollowUpModal(false);
      onRatingChange?.(rating);
    } catch (error) {
      console.error('Error submitting rating:', error);
      // TODO: Show error toast
    }
  };

  const displayRating = hoveredRating || rating || 0;
  const isInactive = messageCount === 0;

  return (
    <div className="flex items-center gap-1">
      {showAggregate && aggregateRating && aggregateCount ? (
        // Aggregate display for homepage cards
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-4 h-4 ${
                  star <= Math.round(aggregateRating)
                    ? 'fill-yellow-200 text-yellow-300'
                    : 'fill-gray-200 text-gray-200'
                }`}
              />
            ))}
          </div>
          <span className="text-sm text-gray-600">
            {aggregateRating.toFixed(1)} ({aggregateCount} {aggregateCount === 1 ? 'rating' : 'ratings'})
          </span>
        </div>
      ) : (
        // Interactive rating
        <div
          className="flex items-center gap-0.5"
          onMouseEnter={handleInteraction}
          onMouseLeave={() => setHoveredRating(null)}
        >
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => handleStarClick(star)}
              disabled={isInactive}
              className={`transition-all duration-200 ${
                isInactive
                  ? 'cursor-not-allowed opacity-40'
                  : 'cursor-pointer hover:scale-110 active:scale-95'
              } ${isPulsing && !hasInteracted ? 'animate-pulse' : ''}`}
              onMouseEnter={() => !isInactive && setHoveredRating(star)}
              aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
            >
              <Star
                className={`w-5 h-5 ${
                  star <= displayRating
                    ? 'fill-yellow-200 text-yellow-300'
                    : 'fill-gray-200 text-gray-300'
                }`}
              />
            </button>
          ))}
        </div>
      )}

      {/* Follow-up Modal */}
      {showFollowUpModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold">Tell us more about your experience</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                What were you trying to accomplish?
              </label>
              <textarea
                value={followUpData.userGoal}
                onChange={(e) => setFollowUpData({ ...followUpData, userGoal: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                rows={3}
                placeholder="Describe what you were trying to do..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Did you get what you needed?
              </label>
              <div className="flex gap-4">
                {['Yes', 'Partially', 'No'].map((option) => (
                  <label key={option} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="goalAchieved"
                      value={option}
                      checked={followUpData.goalAchieved === option}
                      onChange={(e) => setFollowUpData({ ...followUpData, goalAchieved: e.target.value })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{option}</span>
                  </label>
                ))}
              </div>
            </div>

            {(followUpData.goalAchieved === 'Partially' || followUpData.goalAchieved === 'No') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What&apos;s still missing?
                </label>
                <textarea
                  value={followUpData.stillNeed}
                  onChange={(e) => setFollowUpData({ ...followUpData, stillNeed: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  rows={2}
                  placeholder="What would have made this better?"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                How much time did this save you?
              </label>
              <select
                value={followUpData.timeSaved}
                onChange={(e) => setFollowUpData({ ...followUpData, timeSaved: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">Select...</option>
                <option value="5 minutes">5 minutes</option>
                <option value="30 minutes">30 minutes</option>
                <option value="1 hour">1 hour</option>
                <option value="2+ hours">2+ hours</option>
                <option value="Not applicable">Not applicable</option>
              </select>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => {
                  setShowFollowUpModal(false);
                  // Still save rating even if follow-up is skipped
                  if (rating) {
                    handleFollowUpSubmit();
                  }
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Skip
              </button>
              <button
                onClick={handleFollowUpSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

