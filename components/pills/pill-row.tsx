'use client';

// Phase 2: Pill row container component
// Handles horizontal scrolling for pills with Show More/Show Less toggle

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Pill as PillType } from './pill';
import { Pill as PillComponent } from './pill';
import { useTheme } from '@/lib/theme/theme-context';

const MAX_VISIBLE_PILLS = 4;

interface PillRowProps {
  pills: PillType[];
  selectedFeedbackPill: string | null;
  selectedExpansionPill: string | null;
  onPillClick: (pill: PillType) => void;
}

/**
 * PillRow component - Single row container for pills with horizontal scrolling
 *
 * @component
 * @example
 * ```tsx
 * <PillRow
 *   pills={[pill1, pill2, pill3]}
 *   selectedFeedbackPill="pill-1"
 *   selectedExpansionPill={null}
 *   onPillClick={(pill) => handlePillClick(pill)}
 * />
 * ```
 *
 * Features:
 * - Horizontal scrolling for overflow pills
 * - Handles pill selection state (feedback and expansion pills)
 * - Displays pills in a flex row
 * - Returns null if no pills provided
 * - Show More/Show Less toggle when more than 4 pills
 *
 * @param {PillRowProps} props - Component props
 * @param {Pill[]} props.pills - Array of pills to display in this row
 * @param {string | null} props.selectedFeedbackPill - ID of selected feedback pill
 * @param {string | null} props.selectedExpansionPill - ID of selected expansion pill
 * @param {(pill: Pill) => void} props.onPillClick - Callback when a pill is clicked
 *
 * @returns {JSX.Element | null} Row container with pills or null if empty
 */
export function PillRow({
  pills,
  selectedFeedbackPill,
  selectedExpansionPill,
  onPillClick,
}: PillRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const theme = useTheme();

  if (pills.length === 0) {
    return null;
  }

  const hasMorePills = pills.length > MAX_VISIBLE_PILLS;
  const visiblePills = hasMorePills && !isExpanded
    ? pills.slice(0, MAX_VISIBLE_PILLS)
    : pills;

  return (
    <div className="flex gap-1 overflow-x-auto overflow-y-hidden pb-1 scrollbar-hide">
      {visiblePills.map((pill) => {
        // Determine if this pill is selected
        const isSelected =
          (pill.pillType === 'feedback' && selectedFeedbackPill === pill.id) ||
          (pill.pillType === 'expansion' && selectedExpansionPill === pill.id) ||
          (pill.pillType === 'suggested' && false); // Suggested pills don't have persistent selection state

        return (
          <PillComponent
            key={pill.id}
            pill={pill}
            isSelected={isSelected}
            onClick={() => onPillClick(pill)}
          />
        );
      })}
      {hasMorePills && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 active:scale-95 flex items-center gap-1 whitespace-nowrap flex-shrink-0"
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

