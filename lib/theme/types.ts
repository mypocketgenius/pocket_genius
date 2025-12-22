// Import Gradient from existing sky-gradient.ts
import type { Gradient } from '../utils/sky-gradient';

// Theme mode types
export type ThemeMode = 'custom' | 'cycle' | 'dark-cycle' | 'light-cycle';

// Time period names (for custom mode selection)
export type TimePeriod = 
  | 'night' 
  | 'dawn' 
  | 'morning' 
  | 'midday' 
  | 'afternoon' 
  | 'golden' 
  | 'dusk' 
  | 'evening';

// Chrome colors interface (matches getChromeColors return type)
export interface ChromeColors {
  header: string;
  input: string;
  inputField: string;
  border: string;
}

// Bubble styles interface
export interface BubbleStyles {
  light: {
    ai: string;
    user: string;
    shadow: string;
    text: string;
    userText: string;
  };
  dark: {
    ai: string;
    user: string;
    shadow: string;
    text: string;
    userText: string;
  };
}

// Theme settings stored in localStorage
export interface ThemeSettings {
  mode: ThemeMode;
  customPeriod?: TimePeriod;
}

// Re-export Gradient for convenience
export type { Gradient };

