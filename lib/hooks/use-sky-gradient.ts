/**
 * Sky Gradient Hook
 * 
 * React hook that manages the time-of-day-based sky gradient.
 * Updates the gradient every 5 minutes and applies it via CSS custom properties.
 */

import { useEffect, useState } from 'react';
import { 
  getSkyGradientWithPreference, 
  getTimeTheme, 
  getChromeColors,
  type Gradient 
} from '../utils/sky-gradient';

interface ChromeColors {
  header: string;
  input: string;
  inputField: string;
  border: string;
}

interface SkyGradientState {
  gradient: Gradient;
  theme: 'light' | 'dark';
  chrome: ChromeColors;
}

/**
 * Detects user's system preference for dark/light mode
 * Returns 'light' on server to avoid hydration mismatch
 */
function detectUserPreference(): 'light' | 'dark' {
  // On server, always return 'light' to match initial render
  // This will be updated on client after hydration
  if (typeof window === 'undefined') {
    return 'light';
  }
  
  if (window.matchMedia) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }
  
  // Fallback: use time-based detection
  const hour = new Date().getHours();
  return getTimeTheme(hour);
}

/**
 * Hook that returns the current sky gradient, theme, and chrome colors
 * Chrome colors are derived from the gradient for harmonious design
 * Updates periodically and respects user's dark/light mode preference
 * 
 * @returns Object with gradient, theme, and chrome colors
 */
export function useSkyGradient(): SkyGradientState {
  // Always start with 'light' to match server-side render and avoid hydration mismatch
  const [preference, setPreference] = useState<'light' | 'dark'>(() => 'light');
  const [isHydrated, setIsHydrated] = useState(false);

  const [state, setState] = useState<SkyGradientState>(() => {
    // Initialize with current time, always use 'light' initially
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const gradient = getSkyGradientWithPreference(hour, minute, 'light');
    // Use actual time-based theme for text colors
    const timeBasedTheme = getTimeTheme(hour);
    return {
      gradient,
      theme: timeBasedTheme,
      chrome: getChromeColors(gradient),
    };
  });

  // Detect actual preference after hydration
  useEffect(() => {
    setIsHydrated(true);
    const actualPreference = detectUserPreference();
    if (actualPreference !== preference) {
      setPreference(actualPreference);
    }
  }, [preference]);

  useEffect(() => {
    // Listen for system preference changes
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        const newPreference = e.matches ? 'dark' : 'light';
        setPreference(newPreference);
      };

      // Modern browsers
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      } 
      // Legacy browsers
      else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      }
    }
  }, []);

  useEffect(() => {
    // Only update after hydration to avoid hydration mismatch
    if (!isHydrated) return;

    // Update gradient and theme function
    const updateState = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const gradient = getSkyGradientWithPreference(hour, minute, preference);
      // Use actual time-based theme for text colors, not preference
      // This ensures 8pm-6am uses dark theme, 6am-8pm uses light theme
      const timeBasedTheme = getTimeTheme(hour);
      setState({
        gradient,
        theme: timeBasedTheme,
        chrome: getChromeColors(gradient),
      });
    };

    // Update immediately
    updateState();

    // Update every 5 minutes (300000ms)
    const interval = setInterval(updateState, 300000);

    return () => {
      clearInterval(interval);
    };
  }, [preference, isHydrated]);

  return state;
}

