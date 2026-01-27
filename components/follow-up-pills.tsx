'use client';

/**
 * Follow-Up Pills Component
 *
 * Displays AI-generated follow-up questions below assistant messages.
 * Pills are styled consistently with suggested pills (secondaryAccent color with border).
 * Clicking a pill prefills the chat input and logs an event.
 *
 * Features:
 * - Theme-aware styling using existing pill design system
 * - Wrapping layout for multiple pills (wraps to new lines)
 * - Pill text wraps if too long
 * - Click handler for input prefill and event logging
 * - Graceful handling of empty pills array
 * - Show More/Show Less toggle when more than 4 pills
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '@/lib/theme/theme-context';
import { getPillColors } from '@/lib/theme/pill-colors';
import { getSuggestionPillStyles } from '@/lib/theme/pill-styles';
import { getCurrentPeriod } from '@/lib/theme/config';

const MAX_VISIBLE_PILLS = 4;

interface FollowUpPillsProps {
  pills: string[];
  messageId: string;
  conversationId: string;
  chunkIds: string[];
  onPillClick: (pillText: string) => void; // Handles both prefill and event logging
  disabled?: boolean;
}

export function FollowUpPills({
  pills,
  messageId,
  conversationId,
  chunkIds,
  onPillClick,
  disabled = false,
}: FollowUpPillsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const theme = useTheme();
  const now = new Date();
  const period = getCurrentPeriod(now.getHours());
  const pillColors = getPillColors(theme.gradient, theme.textColor, period, theme.theme);

  // Don't render if no pills
  if (pills.length === 0) {
    return null;
  }

  const hasMorePills = pills.length > MAX_VISIBLE_PILLS;
  const visiblePills = hasMorePills && !isExpanded
    ? pills.slice(0, MAX_VISIBLE_PILLS)
    : pills;


  return (
    <div className="flex flex-wrap gap-2 w-full max-w-full mt-2">
      {visiblePills.map((pillText, index) => {
        // Use suggestion pill styles with isPrimary: true for prominent accent color
        // This matches the styling of suggested pills like "What is the best way to attack?"
        const pillStyles = getSuggestionPillStyles(
          pillColors,
          true, // isPrimary: true = secondaryAccent color (prominent)
          false, // isSelected: context pills don't have selection state
          theme.theme,
          period
        );

        return (
          <button
            key={index}
            onClick={() => onPillClick(pillText)}
            disabled={disabled}
            style={pillStyles}
            className="active:scale-95 px-4 rounded-full text-sm font-medium transition-all whitespace-normal break-words"
            aria-label={`Follow-up: ${pillText}`}
          >
            {pillText}
          </button>
        );
      })}
      {hasMorePills && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 active:scale-95 flex items-center gap-1"
          style={{
            backgroundColor: 'transparent',
            color: theme.textColor,
          }}
          aria-label={isExpanded ? 'Show fewer options' : 'Show more options'}
          aria-expanded={isExpanded}
        >
          {isExpanded ? (
            <>
              <span>Show Less</span>
              <ChevronUp className="w-4 h-4" aria-hidden="true" />
            </>
          ) : (
            <>
              <span>Show More</span>
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            </>
          )}
        </button>
      )}
    </div>
  );
}

