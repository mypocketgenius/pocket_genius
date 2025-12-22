'use client';

import { useEffect } from 'react';
import { useTheme } from '../lib/theme/theme-context';

/**
 * ThemeBody Component
 * 
 * Applies the theme gradient to the document body element.
 * This ensures the theme background is visible site-wide.
 */
export function ThemeBody() {
  const theme = useTheme();
  
  useEffect(() => {
    // Apply gradient to body element
    const body = document.body;
    if (body) {
      body.style.background = `linear-gradient(135deg, ${theme.gradient.start}, ${theme.gradient.end})`;
      body.style.backgroundAttachment = 'fixed';
      body.style.minHeight = '100vh';
      body.style.transition = 'background 2s ease';
    }
    
    // Cleanup function to reset styles if component unmounts
    return () => {
      if (body) {
        body.style.background = '';
        body.style.backgroundAttachment = '';
        body.style.minHeight = '';
        body.style.transition = '';
      }
    };
  }, [theme.gradient]);
  
  // This component doesn't render anything
  return null;
}

