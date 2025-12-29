'use client';

import React from 'react';
import { useTheme } from '../lib/theme/theme-context';

/**
 * ThemedPage component - Applies theme gradient background and text color to page content
 * 
 * This component extracts the theme application logic from chat.tsx into a reusable component.
 * It applies:
 * - Gradient background: linear-gradient(135deg, theme.gradient.start, theme.gradient.end)
 * - Text color: theme.textColor
 * - Smooth transitions: 2s ease for background changes
 * 
 * Usage:
 * ```tsx
 * <ThemedPage className="min-h-screen">
 *   <YourContent />
 * </ThemedPage>
 * 
 * // For scrollable containers with iOS scrolling support:
 * <ThemedPage className="flex-1 overflow-y-auto" scrollable>
 *   <YourContent />
 * </ThemedPage>
 * ```
 */
interface ThemedPageProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Enables iOS-optimized scrolling behavior for scrollable containers.
   * Automatically applies:
   * - WebkitOverflowScrolling: 'touch' (smooth scrolling on iOS)
   * - overscrollBehavior: 'none' (prevents scroll overhangs on iOS Safari/Chrome)
   */
  scrollable?: boolean;
}

export function ThemedPage({ children, className, scrollable }: ThemedPageProps) {
  const theme = useTheme();

  // Theme styles that should always take precedence
  const themeStyles: React.CSSProperties = {
    background: `linear-gradient(135deg, ${theme.gradient.start}, ${theme.gradient.end})`,
    color: theme.textColor,
    transition: 'background 2s ease',
  };

  // iOS scrolling styles for scrollable containers
  const scrollableStyles: React.CSSProperties = scrollable
    ? {
        WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
        overscrollBehavior: 'none', // Prevent scroll overhangs on iOS Safari/Chrome
      }
    : {};

  return (
    <div className={className} style={{ ...scrollableStyles, ...themeStyles }}>
      {children}
    </div>
  );
}

