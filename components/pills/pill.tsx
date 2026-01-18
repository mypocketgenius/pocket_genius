'use client';

// Phase 2: Individual pill component (reusable for all pill types)
// Handles feedback, expansion, and suggested question pills

import { Check } from 'lucide-react';
import { useTheme } from '@/lib/theme/theme-context';
import { getPillColors } from '@/lib/theme/pill-colors';
import { getActionPillStyles, getSuggestionPillStyles } from '@/lib/theme/pill-styles';
import { getCurrentPeriod } from '@/lib/theme/config';

export interface Pill {
  id: string;
  chatbotId: string | null;
  pillType: 'feedback' | 'expansion' | 'suggested';
  label: string;
  prefillText: string;
  displayOrder: number;
  isActive: boolean;
}

interface PillProps {
  pill: Pill;
  isSelected: boolean;
  onClick: () => void;
}

/**
 * Pill component - Individual pill button for feedback, expansion, and suggested questions
 * 
 * @component
 * @example
 * ```tsx
 * <Pill
 *   pill={{ id: 'pill-1', pillType: 'feedback', label: 'Helpful', ... }}
 *   isSelected={false}
 *   onClick={() => handlePillClick(pill)}
 * />
 * ```
 * 
 * Visual Design:
 * - Feedback pills: Theme-aware semantic colors (success for helpful, error for not helpful) at 20-25% opacity
 * - Expansion pills: Neutral color (blended from theme) at 12-20% opacity with 1px border at 40% opacity
 * - Suggested questions: Secondary accent color at 12-20% opacity, no border (primary suggestion style)
 * - Selected state: Increased opacity + checkmark icon
 * - All pills adapt to theme changes throughout the day
 * - Touch targets minimum 36px height for mobile
 * 
 * @param {PillProps} props - Component props
 * @param {Pill} props.pill - Pill data object with id, pillType, label, etc.
 * @param {boolean} props.isSelected - Whether this pill is currently selected
 * @param {() => void} props.onClick - Callback function when pill is clicked
 * 
 * @returns {JSX.Element} Pill button element
 */
export function Pill({ pill, isSelected, onClick }: PillProps) {
  const theme = useTheme();
  const now = new Date();
  const period = getCurrentPeriod(now.getHours());
  const pillColors = getPillColors(theme.gradient, theme.textColor, period, theme.theme);
  
  // Determine styling based on pill type
  const getPillStyles = (): React.CSSProperties => {
    if (pill.pillType === 'feedback') {
      // Feedback pills: Use semantic colors (success/error) from theme
      const isHelpful = pill.label.toLowerCase().includes('helpful') && 
                       !pill.label.toLowerCase().includes('not');
      return getActionPillStyles(pillColors, isHelpful, isSelected, theme.theme, period);
    }
    
    if (pill.pillType === 'expansion') {
      // Expansion pills: Use neutral suggestion style (secondary = has border)
      return getSuggestionPillStyles(pillColors, false, isSelected, theme.theme, period);
    }
    
    // Suggested questions: Use primary suggestion style (no border)
    return getSuggestionPillStyles(pillColors, true, isSelected, theme.theme, period);
  };

  const baseStyles: React.CSSProperties = {
    ...getPillStyles(),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.375rem',
    minHeight: '28px',
    transition: 'all 0.2s',
    cursor: 'pointer',
  };

  return (
    <button
      onClick={onClick}
      style={baseStyles}
      className="active:scale-95 whitespace-normal break-words"
      title={pill.label}
      aria-label={pill.label}
      aria-pressed={isSelected}
    >
      {isSelected && (
        <Check className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      )}
      <span className="whitespace-normal break-words">{pill.label}</span>
    </button>
  );
}

