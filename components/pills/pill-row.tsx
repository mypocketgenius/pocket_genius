'use client';

// Phase 2: Pill row container component
// Handles horizontal scrolling for pills

import { Pill as PillType, Pill as PillComponent } from './pill';

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
  if (pills.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-1 overflow-x-auto overflow-y-hidden pb-1 scrollbar-hide">
      {pills.map((pill) => {
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
    </div>
  );
}

