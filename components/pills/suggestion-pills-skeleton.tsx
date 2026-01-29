'use client';

/**
 * Suggestion Pills Skeleton Component
 *
 * Animated placeholder that matches the layout of actual suggestion pills.
 * Displays while AI-generated pills are being fetched asynchronously.
 */

import { useTheme } from '@/lib/theme/theme-context';

interface SuggestionPillsSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Skeleton loader for suggestion pills
 * Displays animated placeholder pills while actual pills are loading
 */
export function SuggestionPillsSkeleton({
  count = 3,
  className = '',
}: SuggestionPillsSkeletonProps) {
  const theme = useTheme();

  // Generate varied widths for natural appearance (matching typical pill text lengths)
  const widths = ['w-48', 'w-56', 'w-40', 'w-52', 'w-44', 'w-60'];

  return (
    <div className={`flex flex-wrap gap-2 justify-center ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`
            ${widths[index % widths.length]}
            h-10
            rounded-full
            animate-pulse
          `}
          style={{
            backgroundColor: theme.chrome.border,
            opacity: 0.5,
            animationDelay: `${index * 100}ms`,
          }}
        />
      ))}
    </div>
  );
}
