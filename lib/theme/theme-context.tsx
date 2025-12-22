'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ThemeMode, TimePeriod, Gradient, ChromeColors, BubbleStyles, ThemeSettings } from './types';
import { getSkyGradient, getChromeColors, getTimeTheme } from '../utils/sky-gradient';
import {
  getEffectiveHourForMode,
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
  
  // For custom mode, use minute=0 to lock to period midpoint
  // For other modes, use actual minute for smooth interpolation
  const minute = mode === 'custom' ? 0 : actualMinute;
  
  // Calculate gradient
  const gradient = getSkyGradient(effectiveHour, minute);
  
  // Calculate chrome colors from gradient
  const chrome = getChromeColors(gradient);
  
  // Calculate theme (light/dark) based on effective hour
  const theme = getTimeTheme(effectiveHour);
  
  // Get text color based on theme
  const textColor = TEXT_COLORS[theme];
  
  return { gradient, theme, chrome, textColor };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Load theme settings from localStorage on mount
  const [settings, setSettings] = useState<ThemeSettings>(() => {
    // On server, return default theme to avoid hydration mismatch
    if (typeof window === 'undefined') {
      return DEFAULT_THEME;
    }
    return loadThemeSettings();
  });
  
  const [isHydrated, setIsHydrated] = useState(false);
  
  // Initialize theme values
  const [themeValues, setThemeValues] = useState(() => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    return calculateThemeValues(settings.mode, settings.customPeriod, hour, minute);
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
    if (loadedSettings.mode !== settings.mode || loadedSettings.customPeriod !== settings.customPeriod) {
      setSettings(loadedSettings);
    }
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

