'use client';

/**
 * Suggestion Pills Component
 *
 * Displays suggestion pills with Show More/Show Less toggle when more than 4 pills.
 * Used for initial suggestion pills and intake suggestion pills.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Pill as PillType, Pill } from './pill';
import { useTheme } from '@/lib/theme/theme-context';

const MAX_VISIBLE_PILLS = 3;

interface SuggestionPillsProps {
  pills: PillType[];
  onPillClick: (pill: PillType) => void;
  className?: string;
}

export function SuggestionPills({
  pills,
  onPillClick,
  className = '',
}: SuggestionPillsProps) {
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
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="flex flex-wrap gap-2 justify-center">
        {visiblePills.map((pill) => (
          <Pill
            key={pill.id}
            pill={pill}
            isSelected={false}
            onClick={() => onPillClick(pill)}
          />
        ))}
      </div>
      {hasMorePills && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 active:scale-95 flex items-center gap-1 opacity-70 hover:opacity-100"
          style={{
            backgroundColor: theme.textColor + '15',
            color: theme.textColor,
            border: `1px solid ${theme.textColor}30`,
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
