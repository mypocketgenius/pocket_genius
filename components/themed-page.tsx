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
 * ```
 */
interface ThemedPageProps {
  children: React.ReactNode;
  className?: string;
}

export function ThemedPage({ children, className }: ThemedPageProps) {
  const theme = useTheme();

  return (
    <div
      className={className}
      style={{
        background: `linear-gradient(135deg, ${theme.gradient.start}, ${theme.gradient.end})`,
        color: theme.textColor,
        transition: 'background 2s ease',
      }}
    >
      {children}
    </div>
  );
}

