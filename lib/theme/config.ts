import type { TimePeriod, ThemeMode, Gradient, ThemeSettings } from './types';
import { mapToNightRange, mapToDayRange } from '../utils/sky-gradient';

// User-friendly display names for periods
export const PERIOD_DISPLAY_NAMES: Record<TimePeriod, string> = {
  night: 'Night',
  dawn: 'Dawn',
  morning: 'Morning',
  midday: 'Midday',
  afternoon: 'Afternoon',
  golden: 'Golden Hour',
  dusk: 'Dusk',
  evening: 'Evening',
};

// Gradient definitions (moved from sky-gradient.ts)
export const GRADIENT_PRESETS: Record<TimePeriod, Gradient> = {
  night: { start: 'hsl(240, 15%, 8%)', end: 'hsl(260, 12%, 12%)' },
  dawn: { start: 'hsl(20, 25%, 92%)', end: 'hsl(280, 20%, 94%)' },
  morning: { start: 'hsl(200, 20%, 96%)', end: 'hsl(210, 15%, 98%)' },
  midday: { start: 'hsl(200, 18%, 97%)', end: 'hsl(190, 12%, 99%)' },
  afternoon: { start: 'hsl(210, 15%, 96%)', end: 'hsl(200, 18%, 98%)' },
  golden: { start: 'hsl(35, 35%, 90%)', end: 'hsl(25, 30%, 92%)' },
  dusk: { start: 'hsl(260, 18%, 90%)', end: 'hsl(240, 15%, 92%)' },
  evening: { start: 'hsl(240, 15%, 12%)', end: 'hsl(250, 12%, 10%)' },
};

// Bubble styles (moved from chat.tsx)
export const BUBBLE_STYLES = {
  light: {
    ai: 'rgba(255, 255, 255, 0.75)',
    user: 'rgba(59, 130, 246, 0.85)',
    shadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
    text: '#1a1a1a',
    userText: '#ffffff',
  },
  dark: {
    ai: 'rgba(255, 255, 255, 0.08)',
    user: 'rgba(59, 130, 246, 0.7)',
    shadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
    text: '#e8e8e8',
    userText: '#ffffff',
  },
};

// Text colors
export const TEXT_COLORS = {
  light: '#1a1a1a',
  dark: '#e8e8e8',
};

// Period time ranges (for reference and custom mode mapping)
// Used to determine representative times for periods and understand period boundaries
export const PERIOD_TIME_RANGES: Record<TimePeriod, { start: number; end: number }> = {
  night: { start: 0, end: 5 },      // 0-5am
  dawn: { start: 5, end: 7 },       // 5-7am
  morning: { start: 7, end: 11 },   // 7-11am
  midday: { start: 11, end: 15 },   // 11am-3pm
  afternoon: { start: 15, end: 18 }, // 3-6pm
  golden: { start: 18, end: 20 },   // 6-8pm
  dusk: { start: 20, end: 22 },     // 8-10pm
  evening: { start: 22, end: 24 },   // 10pm-midnight
};

// Map periods to representative time (midpoint) for custom mode
// Used when user selects a specific period - locks to this time
export const PERIOD_TO_TIME: Record<TimePeriod, number> = {
  night: 2.5,    // 2:30am (midpoint of 0-5am)
  dawn: 6,       // 6am (start of dawn)
  morning: 9,    // 9am (midpoint of 7-11am)
  midday: 13,    // 1pm (midpoint of 11am-3pm)
  afternoon: 16.5, // 4:30pm (midpoint of 3-6pm)
  golden: 19,    // 7pm (midpoint of 6-8pm)
  dusk: 21,      // 9pm (midpoint of 8-10pm)
  evening: 23,   // 11pm (midpoint of 10pm-midnight)
};

// Map periods to their theme (light/dark) for text color selection
// Light periods: dawn, morning, midday, afternoon, golden, dusk (6am-10pm)
// Dark periods: night, evening (10pm-6am)
export const PERIOD_THEMES: Record<TimePeriod, 'light' | 'dark'> = {
  night: 'dark',
  dawn: 'light',
  morning: 'light',
  midday: 'light',
  afternoon: 'light',
  golden: 'light',
  dusk: 'light',
  evening: 'dark',
};

// Default theme settings
export const DEFAULT_THEME: ThemeSettings = {
  mode: 'cycle',
  customPeriod: undefined,
};

// Period order for UI display (chronological)
export const PERIOD_ORDER: TimePeriod[] = [
  'night',
  'dawn',
  'morning',
  'midday',
  'afternoon',
  'golden',
  'dusk',
  'evening',
];

// Helper: Get current period based on hour
export function getCurrentPeriod(hour: number): TimePeriod {
  const timeDecimal = hour;
  if (timeDecimal >= 0 && timeDecimal < 5) return 'night';
  if (timeDecimal >= 5 && timeDecimal < 7) return 'dawn';
  if (timeDecimal >= 7 && timeDecimal < 11) return 'morning';
  if (timeDecimal >= 11 && timeDecimal < 15) return 'midday';
  if (timeDecimal >= 15 && timeDecimal < 18) return 'afternoon';
  if (timeDecimal >= 18 && timeDecimal < 20) return 'golden';
  if (timeDecimal >= 20 && timeDecimal < 22) return 'dusk';
  return 'evening';
}

// Theme mode logic functions
// Returns effective hour based on theme mode for gradient calculation
// Note: Custom mode uses minute=0 (locks to period midpoint)
export function getEffectiveHourForMode(
  mode: ThemeMode,
  actualHour: number,
  customPeriod?: TimePeriod
): number {
  switch (mode) {
    case 'cycle':
      // Full 24-hour cycle - use actual hour
      return actualHour;
    
    case 'dark-cycle':
      // Cycle through dark periods only (night, evening)
      // Use mapToNightRange to constrain to 10pm-5am range
      return mapToNightRange(actualHour);
    
    case 'light-cycle':
      // Cycle through light periods only (dawn through dusk)
      // Use mapToDayRange to constrain to 5am-10pm range
      return mapToDayRange(actualHour);
    
    case 'custom':
      // Lock to selected period's representative time
      if (!customPeriod) {
        // Fallback: use current period's representative time if no selection
        return PERIOD_TO_TIME[getCurrentPeriod(actualHour)];
      }
      return PERIOD_TO_TIME[customPeriod];
    
    default:
      return actualHour;
  }
}

