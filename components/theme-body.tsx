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
    const html = document.documentElement;
    
    if (body && html) {
      body.style.background = `linear-gradient(135deg, ${theme.gradient.start}, ${theme.gradient.end})`;
      
      // Detect iOS to avoid background-attachment: fixed (causes scrolling issues on iOS)
      // Check multiple methods for better iOS detection
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
                    (/Mac/.test(navigator.platform) && navigator.maxTouchPoints > 1);
      
      // Only use fixed attachment on non-iOS devices
      // iOS Safari/Chrome has known issues with fixed backgrounds causing scroll overhangs
      if (!isIOS) {
        body.style.backgroundAttachment = 'fixed';
      }
      
      // Prevent scroll overhangs/bounce on iOS Safari/Chrome
      // Apply to both html and body for comprehensive coverage
      html.style.overscrollBehavior = 'none';
      body.style.overscrollBehavior = 'none';
      
      // Don't set minHeight on iOS - it conflicts with h-dvh containers causing scroll overhangs
      // The h-dvh class uses -webkit-fill-available which conflicts with body minHeight: 100vh
      if (!isIOS) {
        body.style.minHeight = '100vh';
      }
      
      body.style.transition = 'background 2s ease';
    }
    
    // Cleanup function to reset styles if component unmounts
    return () => {
      if (body && html) {
        body.style.background = '';
        body.style.backgroundAttachment = '';
        html.style.overscrollBehavior = '';
        body.style.overscrollBehavior = '';
        body.style.minHeight = '';
        body.style.transition = '';
      }
    };
  }, [theme.gradient]);
  
  // This component doesn't render anything
  return null;
}

