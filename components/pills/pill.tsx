'use client';

// Phase 2: Individual pill component (reusable for all pill types)
// Handles feedback, expansion, and suggested question pills

import { Check } from 'lucide-react';

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
  disabled?: boolean;
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
 *   disabled={false}
 * />
 * ```
 * 
 * Visual Design:
 * - Feedback pills: Green (Helpful) / Red (Not helpful) background/border
 * - Expansion pills: Neutral/muted style (gray border, white/light gray background)
 * - Suggested questions: Outlined style (blue/purple border)
 * - Selected state: Highlight + checkmark icon
 * - Hover state: Subtle background change
 * - Touch targets minimum 44x44px for mobile
 * 
 * @param {PillProps} props - Component props
 * @param {Pill} props.pill - Pill data object with id, pillType, label, etc.
 * @param {boolean} props.isSelected - Whether this pill is currently selected
 * @param {() => void} props.onClick - Callback function when pill is clicked
 * @param {boolean} [props.disabled=false] - Whether the pill is disabled
 * 
 * @returns {JSX.Element} Pill button element
 */
export function Pill({ pill, isSelected, onClick, disabled = false }: PillProps) {
  // Determine styling based on pill type
  const getPillStyles = () => {
    const baseStyles = 'flex-shrink-0 px-4 py-1 rounded-full text-sm font-medium transition-all duration-200 active:scale-95 min-h-[36px] flex items-center justify-center gap-1.5';
    
    if (disabled) {
      return `${baseStyles} bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed opacity-60`;
    }

    if (pill.pillType === 'feedback') {
      // Feedback pills: Green for helpful, Red for not helpful
      const isHelpful = pill.label.toLowerCase().includes('helpful') && !pill.label.toLowerCase().includes('not');
      
      if (isSelected) {
        return isHelpful
          ? `${baseStyles} bg-green-200 text-green-800 border border-green-400 shadow-sm`
          : `${baseStyles} bg-red-200 text-red-800 border border-red-400 shadow-sm`;
      }
      
      return isHelpful
        ? `${baseStyles} bg-green-50/60 text-green-600 border border-green-200 hover:bg-green-100 hover:border-green-300`
        : `${baseStyles} bg-red-50/60 text-red-600 border border-red-200 hover:bg-red-100 hover:border-red-300`;
    }
    
    if (pill.pillType === 'expansion') {
      // Expansion pills: Neutral/muted style
      if (isSelected) {
        return `${baseStyles} bg-gray-200 text-gray-800 border border-gray-400 shadow-sm`;
      }
      return `${baseStyles} bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400`;
    }
    
    // Suggested questions: Outlined style (blue/purple)
    if (isSelected) {
      return `${baseStyles} bg-blue-100 text-blue-800 border border-blue-400 shadow-sm`;
    }
    return `${baseStyles} bg-white text-blue-600 border border-blue-300 hover:bg-blue-50 hover:border-blue-400`;
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={getPillStyles()}
      title={disabled ? 'Please wait...' : pill.label}
      aria-label={pill.label}
      aria-pressed={isSelected}
    >
      {isSelected && (
        <Check className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      )}
      <span>{pill.label}</span>
    </button>
  );
}

