'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ThemeMode, TimePeriod, Gradient, ChromeColors, BubbleStyles, ThemeSettings } from './types';
import { getSkyGradient, getChromeColors, getTimeTheme } from '../utils/sky-gradient';
import {
  getEffectiveHourForMode,
  getCurrentPeriod,
  PERIOD_THEMES,
  DEFAULT_THEME,
  BUBBLE_STYLES,
  TEXT_COLORS,
} from './config';

interface ThemeContextValue {
  mode: ThemeMode;
  customPeriod?: TimePeriod;
  gradient: Gradient;
  theme: 'light' | 'dark';
  chrome: ChromeColors;
  bubbleStyles: BubbleStyles;
  textColor: string;
  setMode: (mode: ThemeMode) => void;
  setCustomPeriod: (period: TimePeriod) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'pocket-genius-theme';

// Load theme settings with error handling and validation
function loadThemeSettings(): ThemeSettings {
  try {
    if (typeof window === 'undefined') {
      return DEFAULT_THEME;
    }
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_THEME;
    }
    const parsed = JSON.parse(stored);
    // Validate structure
    if (parsed.mode && ['custom', 'cycle', 'dark-cycle', 'light-cycle'].includes(parsed.mode)) {
      return parsed as ThemeSettings;
    }
    return DEFAULT_THEME;
  } catch (error) {
    console.warn('Failed to load theme settings:', error);
    return DEFAULT_THEME;
  }
}

// Save theme settings with error handling
function saveThemeSettings(settings: ThemeSettings): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save theme settings:', error);
  }
}

// Calculate gradient and derived values based on current theme mode
function calculateThemeValues(
  mode: ThemeMode,
  customPeriod: TimePeriod | undefined,
  actualHour: number,
  actualMinute: number
): {
  gradient: Gradient;
  theme: 'light' | 'dark';
  chrome: ChromeColors;
  textColor: string;
} {
  // Get effective hour based on theme mode
  const effectiveHour = getEffectiveHourForMode(mode, actualHour, customPeriod);
  
  // Always use minute=0 since we use fixed palettes per period (no interpolation)
  // Minutes are completely ignored - each period has one consistent gradient
  const minute = 0;
  
  // Calculate gradient (returns fixed palette for the period)
  const gradient = getSkyGradient(effectiveHour, minute);
  
  // Calculate chrome colors from gradient
  const chrome = getChromeColors(gradient);
  
  // Calculate theme (light/dark) based on period, not just hour
  // This ensures dusk (8-10pm) uses light theme (dark text) even though it's after 8pm
  const period = getCurrentPeriod(effectiveHour);
  const theme = PERIOD_THEMES[period];
  
  // Get text color based on theme
  const textColor = TEXT_COLORS[theme];
  
  return { gradient, theme, chrome, textColor };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize settings with DEFAULT_THEME for both server and client
  // This ensures server and client render identical HTML to avoid hydration mismatch
  // Settings will be loaded from localStorage after hydration
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_THEME);
  
  const [isHydrated, setIsHydrated] = useState(false);
  
  // Initialize theme values with consistent default for SSR
  // Use DEFAULT_THEME settings and fixed hour (12 noon) for both server and client initial render
  // This ensures server and client render the same initial HTML to avoid hydration mismatch
  // Will be updated after hydration with actual settings and time
  const [themeValues, setThemeValues] = useState(() => {
    // Always use DEFAULT_THEME settings and hour 12 (midday) for initial render
    // This ensures server and client render identical HTML regardless of localStorage
    return calculateThemeValues(DEFAULT_THEME.mode, DEFAULT_THEME.customPeriod, 12, 0);
  });
  
  // Update theme values function
  const updateThemeValues = useCallback(() => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const newValues = calculateThemeValues(settings.mode, settings.customPeriod, hour, minute);
    setThemeValues(newValues);
  }, [settings.mode, settings.customPeriod]);
  
  // Hydrate on client side
  useEffect(() => {
    setIsHydrated(true);
    // Reload settings from localStorage after hydration
    const loadedSettings = loadThemeSettings();
    // Always update settings to ensure we have the latest from localStorage
    setSettings(loadedSettings);
    // Update theme values will be triggered by the settings change effect below
  }, []);
  
  // Update theme values when settings change
  useEffect(() => {
    if (!isHydrated) return;
    updateThemeValues();
  }, [settings, isHydrated, updateThemeValues]);
  
  // Set up update interval for cycle modes only (5 minutes)
  useEffect(() => {
    if (!isHydrated) return;
    
    // Custom mode: no updates (locked to selected period)
    if (settings.mode === 'custom') {
      return;
    }
    
    // Cycle modes: update every 5 minutes (300000ms)
    const interval = setInterval(() => {
      updateThemeValues();
    }, 300000);
    
    return () => {
      clearInterval(interval);
    };
  }, [settings.mode, isHydrated, updateThemeValues]);
  
  // Set mode function
  const setMode = useCallback((mode: ThemeMode) => {
    const newSettings: ThemeSettings = {
      mode,
      customPeriod: mode === 'custom' ? settings.customPeriod : undefined,
    };
    setSettings(newSettings);
    saveThemeSettings(newSettings);
  }, [settings.customPeriod]);
  
  // Set custom period function
  const setCustomPeriod = useCallback((period: TimePeriod) => {
    const newSettings: ThemeSettings = {
      mode: 'custom',
      customPeriod: period,
    };
    setSettings(newSettings);
    saveThemeSettings(newSettings);
  }, []);
  
  const contextValue: ThemeContextValue = {
    mode: settings.mode,
    customPeriod: settings.customPeriod,
    gradient: themeValues.gradient,
    theme: themeValues.theme,
    chrome: themeValues.chrome,
    bubbleStyles: BUBBLE_STYLES,
    textColor: themeValues.textColor,
    setMode,
    setCustomPeriod,
  };
  
  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

