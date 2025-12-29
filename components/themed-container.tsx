'use client';

import React from 'react';
import { useTheme } from '../lib/theme/theme-context';

/**
 * ThemedContainer component - Theme-aware container for content areas
 * 
 * This component applies theme colors to containers with different variants:
 * - default: transparent background (inherits from parent)
 * - card: card background derived from gradient
 * - input: input area background from theme.chrome.input
 * 
 * All variants apply theme text color and border color.
 * 
 * Usage:
 * ```tsx
 * <ThemedContainer variant="card" className="p-4 rounded-lg">
 *   <YourContent />
 * </ThemedContainer>
 * ```
 */

interface ThemedContainerProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'card' | 'input';
}

export function ThemedContainer({ 
  children, 
  className = '',
  variant = 'default'
}: ThemedContainerProps) {
  const theme = useTheme();

  // Determine background color based on variant
  let backgroundColor: string;
  switch (variant) {
    case 'card':
      // Card variant: derive from gradient end color (slightly lighter than header)
      // Since theme.chrome.card doesn't exist, we'll use a derived color
      // Using gradient.end with a small lightness adjustment for card
      backgroundColor = theme.gradient.end;
      break;
    case 'input':
      // Input variant: use theme.chrome.input
      backgroundColor = theme.chrome.input;
      break;
    case 'default':
    default:
      // Default variant: transparent (inherits from parent)
      backgroundColor = 'transparent';
      break;
  }

  return (
    <div
      className={className}
      style={{
        backgroundColor,
        color: theme.textColor,
        borderColor: theme.chrome.border,
        transition: 'background-color 2s ease, color 2s ease, border-color 2s ease',
      }}
    >
      {children}
    </div>
  );
}

