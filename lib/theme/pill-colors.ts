import type { Gradient, TimePeriod } from './types';

// HSL parsing utilities (reused from sky-gradient.ts logic, not exported there)
export interface HSLColor {
  h: number;
  s: number;
  l: number;
}

/**
 * Convert hex color to HSL
 */
function hexToHSL(hex: string): HSLColor {
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  
  // Parse RGB values
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  
  return {
    h: Math.round(h * 360),
    s: s * 100,
    l: l * 100,
  };
}

export function parseHSL(hslString: string): HSLColor {
  const match = hslString.match(/hsl\((\d+),\s*(\d+(?:\.\d+)?)%,\s*(\d+(?:\.\d+)?)%\)/);
  if (!match) {
    throw new Error(`Invalid HSL string: ${hslString}`);
  }
  return {
    h: parseInt(match[1], 10),
    s: parseFloat(match[2]),
    l: parseFloat(match[3]),
  };
}

/**
 * Parse color string (hex or HSL) to HSLColor
 */
function parseColor(colorString: string): HSLColor {
  // Check if it's hex format
  if (colorString.startsWith('#')) {
    return hexToHSL(colorString);
  }
  // Otherwise assume HSL format
  return parseHSL(colorString);
}

function hslToString(color: HSLColor): string {
  const h = Math.round(color.h);
  const s = Math.round(color.s * 10) / 10;
  const l = Math.round(color.l * 10) / 10;
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export interface PillColors {
  secondaryAccent: string;  // From gradient.start
  success: string;          // Period-specific green
  error: string;            // Period-specific red/coral
  neutral: string;          // From chrome.border
}

/**
 * Extract secondary accent color from gradient start
 * This represents the "sky color" and adapts throughout the day
 */
function extractSecondaryAccent(gradient: Gradient): string {
  return gradient.start; // Use gradient start as secondary accent
}

/**
 * Generate semantic success color based on period
 * Harmonizes with theme (e.g., muted sage for golden hour, teal for lavender)
 */
function generateSuccessColor(period: TimePeriod, theme: 'light' | 'dark'): string {
  const periodColors: Record<TimePeriod, { h: number; s: number; l: number }> = {
    night: { h: 150, s: 20, l: theme === 'dark' ? 35 : 60 },      // Muted mint
    dawn: { h: 140, s: 25, l: 70 },                                // Fresh green
    morning: { h: 160, s: 30, l: 75 },                             // Fresh mint
    midday: { h: 150, s: 35, l: 80 },                              // Bright teal
    afternoon: { h: 145, s: 30, l: 75 },                           // Warm teal
    golden: { h: 100, s: 25, l: 70 },                              // Warm sage
    dusk: { h: 180, s: 20, l: 70 },                                // Cool teal
    evening: { h: 150, s: 15, l: theme === 'dark' ? 40 : 65 },     // Deep teal
  };
  
  const color = periodColors[period];
  return hslToString(color);
}

/**
 * Generate semantic error color based on period
 * Harmonizes with theme (e.g., soft coral for golden hour, dusty rose for dusk)
 */
function generateErrorColor(period: TimePeriod, theme: 'light' | 'dark'): string {
  const periodColors: Record<TimePeriod, { h: number; s: number; l: number }> = {
    night: { h: 0, s: 15, l: theme === 'dark' ? 40 : 60 },         // Soft crimson
    dawn: { h: 10, s: 30, l: 75 },                                  // Peachy-coral
    morning: { h: 5, s: 35, l: 80 },                                // Light coral
    midday: { h: 0, s: 40, l: 85 },                                 // Bright coral
    afternoon: { h: 8, s: 35, l: 80 },                              // Warm coral
    golden: { h: 15, s: 30, l: 75 },                                // Warm coral
    dusk: { h: 350, s: 25, l: 75 },                                 // Dusty rose
    evening: { h: 0, s: 20, l: theme === 'dark' ? 45 : 65 },       // Muted red
  };
  
  const color = periodColors[period];
  return hslToString(color);
}

/**
 * Generate neutral color from calculated blend
 * Formula: 60% textColor + 40% gradient.end, then reduce saturation by 50%
 * Creates neutral that feels related to theme but doesn't compete
 */
function generateNeutralColor(
  textColor: string, // From theme.textColor (can be hex or HSL)
  gradient: Gradient
): string {
  const textColorParsed = parseColor(textColor);
  const gradientEnd = parseHSL(gradient.end);
  
  // Blend: 60% text + 40% gradient.end
  const blended = {
    h: (textColorParsed.h * 0.6 + gradientEnd.h * 0.4),
    s: (textColorParsed.s * 0.6 + gradientEnd.s * 0.4),
    l: (textColorParsed.l * 0.6 + gradientEnd.l * 0.4),
  };
  
  // Reduce saturation by 50%
  const neutral = {
    h: blended.h,
    s: blended.s * 0.5,
    l: blended.l,
  };
  
  return hslToString(neutral);
}

/**
 * Get all pill colors for current theme
 */
export function getPillColors(
  gradient: Gradient,
  textColor: string, // From theme.textColor
  period: TimePeriod,
  theme: 'light' | 'dark'
): PillColors {
  return {
    secondaryAccent: extractSecondaryAccent(gradient),
    success: generateSuccessColor(period, theme),
    error: generateErrorColor(period, theme),
    neutral: generateNeutralColor(textColor, gradient),
  };
}

