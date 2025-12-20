/**
 * Sky Gradient Hook
 * 
 * React hook that manages the time-of-day-based sky gradient.
 * Updates the gradient every 5 minutes and applies it via CSS custom properties.
 */

import { useEffect, useState } from 'react';
import { getSkyGradient, getTimeTheme } from '../utils/sky-gradient';

interface Gradient {
  start: string;
  end: string;
}

interface SkyGradientState {
  gradient: Gradient;
  theme: 'light' | 'dark';
}

/**
 * Hook that returns the current sky gradient and theme, updating periodically
 * 
 * @returns Object with gradient (start/end colors) and theme ('light' | 'dark')
 */
export function useSkyGradient(): SkyGradientState {
  const [state, setState] = useState<SkyGradientState>(() => {
    // Initialize with current time
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    return {
      gradient: getSkyGradient(hour, minute),
      theme: getTimeTheme(hour),
    };
  });

  useEffect(() => {
    // Update gradient and theme function
    const updateState = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      setState({
        gradient: getSkyGradient(hour, minute),
        theme: getTimeTheme(hour),
      });
    };

    // Update immediately
    updateState();

    // Update every 5 minutes (300000ms)
    const interval = setInterval(updateState, 300000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return state;
}

