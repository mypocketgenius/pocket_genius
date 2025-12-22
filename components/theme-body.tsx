'use client';

import { useEffect } from 'react';
import { useTheme } from '../lib/theme/theme-context';

/**
 * ThemeBody Component
 * 
 * Applies the theme gradient to the document body element.
 * This ensures the theme background is visible site-wide.
 * 
 * Note: iOS Safari/Chrome has issues with background-attachment: fixed,
 * so we avoid using it on iOS devices to prevent scrolling problems.
 */
export function ThemeBody() {
  const theme = useTheme();
  
  useEffect(() => {
    // Apply gradient to body element
    const body = document.body;
    if (body) {
      body.style.background = `linear-gradient(135deg, ${theme.gradient.start}, ${theme.gradient.end})`;
      
      // Detect iOS to avoid background-attachment: fixed (causes scrolling issues on iOS)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      // Only use fixed attachment on non-iOS devices
      // iOS Safari/Chrome has known issues with fixed backgrounds causing scroll problems
      if (!isIOS) {
        body.style.backgroundAttachment = 'fixed';
      }
      
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

