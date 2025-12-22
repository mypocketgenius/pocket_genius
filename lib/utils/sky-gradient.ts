/**
 * Sky Gradient Utility
 * 
 * Creates a subtle, time-of-day-based gradient that mirrors the sky outside.
 * The gradient is extremely desaturated (2-3% color intensity) to remain
 * sophisticated and minimal while creating subconscious emotional resonance.
 * 
 * Uses fixed color palettes per time period (no interpolation within periods).
 * CSS transitions provide smooth color changes between periods.
 */

import { getCurrentPeriod, GRADIENT_PRESETS } from '../theme/config';

export interface Gradient {
  start: string; // HSL color string
  end: string;   // HSL color string
}

interface HSLColor {
  h: number; // Hue (0-360)
  s: number; // Saturation (0-100)
  l: number; // Lightness (0-100)
}

/**
 * Converts HSL color object to CSS HSL string
 * Rounds values to appropriate precision for CSS
 */
function hslToString(color: HSLColor): string {
  // Round hue to integer, saturation and lightness to 1 decimal place
  const h = Math.round(color.h);
  const s = Math.round(color.s * 10) / 10;
  const l = Math.round(color.l * 10) / 10;
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/**
 * Parses HSL string to HSL color object
 */
function parseHSL(hslString: string): HSLColor {
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
 * Gets sky gradient based on current time period
 * Returns fixed gradient for the period (no interpolation)
 * 
 * Time periods:
 * - Night (0-5am): Deep indigo with hints of violet
 * - Dawn (5-7am): Soft peaches and lavenders
 * - Morning (7-11am): Pale azure with warm highlights
 * - Midday (11am-3pm): Bright pale azure
 * - Afternoon (3-6pm): Warm azure
 * - Golden hour (6-8pm): Amber glow
 * - Dusk (8-10pm): Lavender to indigo transition
 * - Evening (10pm-midnight): Deep indigo
 * 
 * @param hour - Current hour (0-23)
 * @param minute - Current minute (0-59) - ignored, kept for API compatibility
 * @returns Fixed gradient for the current time period
 */
export function getSkyGradient(hour: number, minute: number): Gradient {
  const timeDecimal = hour + minute / 60;
  
  // Determine period based on time (getCurrentPeriod accepts decimal hours)
  const period = getCurrentPeriod(timeDecimal);
  
  // Return fixed gradient for period (no interpolation)
  return GRADIENT_PRESETS[period];
}

/**
 * Adjusts the lightness of an HSL color string
 * 
 * @param hslString - HSL color string to adjust
 * @param adjustment - Percentage points to adjust lightness (can be negative)
 * @returns New HSL color string with adjusted lightness
 */
function adjustLightness(hslString: string, adjustment: number): string {
  const color = parseHSL(hslString);
  const newLightness = Math.max(0, Math.min(100, color.l + adjustment));
  return hslToString({ ...color, l: newLightness });
}

/**
 * Gets chrome colors (header, input) derived from the sky gradient
 * These are slightly darker than the gradient for subtle definition
 * Input field is lighter than input area to signify it's an input field
 * 
 * For very light periods (like dusk with 92% lightness), applies more aggressive
 * darkening to ensure headers and icons are visible.
 * 
 * @param gradient - Current sky gradient
 * @returns Chrome colors derived from gradient
 */
export function getChromeColors(gradient: Gradient): {
  header: string;
  input: string;
  inputField: string;
  border: string;
} {
  // Use the end color (bottom of gradient) as base for chrome elements
  const baseColor = parseHSL(gradient.end);
  
  // Dusk period specifically has hsl(240, 15%, 92%) and needs more aggressive darkening
  // Check if this is dusk by checking both hue (~240) and lightness (~92%)
  // Only dusk gets the aggressive darkening - other periods use standard adjustments
  const isDusk = baseColor.h >= 235 && baseColor.h <= 245 && baseColor.l >= 90 && baseColor.l <= 94;
  
  // Standard adjustments for all periods except dusk
  // Dusk gets more aggressive darkening for better visibility
  const headerAdjustment = isDusk ? -15 : -5;
  const inputAdjustment = isDusk ? -18 : -8;
  const borderAdjustment = isDusk ? -20 : -10;
  
  const inputAreaColor = adjustLightness(gradient.end, inputAdjustment);
  return {
    header: adjustLightness(gradient.end, headerAdjustment),
    input: inputAreaColor,
    inputField: adjustLightness(inputAreaColor, 12), // Much lighter than input area for clear visual distinction
    border: adjustLightness(gradient.end, borderAdjustment),
  };
}

/**
 * Maps actual hour to effective hour based on user preference
 * Dark mode constrains to nighttime (8pm-6am), light mode to daytime (6am-8pm)
 * 
 * @param hour - Actual hour (0-23)
 * @param preference - User's dark/light mode preference
 * @returns Effective hour for gradient calculation
 */
function getEffectiveTime(hour: number, preference: 'light' | 'dark'): number {
  if (preference === 'dark') {
    return mapToNightRange(hour);
  } else {
    return mapToDayRange(hour);
  }
}

/**
 * Maps hour to dark period range (10pm-5am)
 * Dark periods are: evening (10pm-midnight) and night (0-5am)
 * Light hours (5am-10pm) are mapped proportionally to dark hours
 */
export function mapToNightRange(hour: number): number {
  // Already in dark range (10pm-5am)
  if (hour >= 22 || hour < 5) {
    return hour;
  }
  
  // Map light hours (5am-10pm = 17 hours) to dark range (10pm-5am = 7 hours)
  // Spread proportionally: 5am -> 10pm (22), 10pm -> 5am (5)
  const lightProgress = (hour - 5) / 17; // 0 at 5am, 1 at 10pm
  let darkHour = 22 + (lightProgress * 7); // 22 (10pm) to 29
  
  // Wrap around midnight: values >= 24 map to 0-5 range
  // 24 -> 0, 25 -> 1, ..., 29 -> 5
  if (darkHour >= 24) {
    darkHour = darkHour - 24; // Maps 24->0, 25->1, ..., 29->5
  }
  
  return darkHour;
}

/**
 * Maps hour to light period range (5am-10pm)
 * Light periods are: dawn, morning, midday, afternoon, golden, dusk (5am-10pm)
 * Dark hours (10pm-5am) are mapped proportionally to light hours
 */
export function mapToDayRange(hour: number): number {
  // Already in light range (5am-10pm)
  if (hour >= 5 && hour < 22) {
    return hour;
  }
  
  // Map dark hours (10pm-5am = 7 hours) to light range (5am-10pm = 17 hours)
  let darkProgress: number;
  if (hour >= 22) {
    // 10pm-midnight: 0 to ~0.29
    darkProgress = (hour - 22) / 7;
  } else {
    // midnight-5am: ~0.29 to 1
    darkProgress = (hour + 2) / 7;
  }
  
  // Map to light range: 5am -> 5am, midnight -> ~noon, 5am -> 10pm
  // Clamp result to ensure it's within 5-22 range (light periods)
  const lightHour = 5 + (darkProgress * 17);
  return Math.max(5, Math.min(21.99, lightHour));
}

/**
 * Detects user's dark/light mode preference
 * Checks system preference first, falls back to time-based detection
 */
function getUserPreference(): 'light' | 'dark' {
  // Check system preference if available (client-side)
  if (typeof window !== 'undefined' && window.matchMedia) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }
  
  // Fallback: use time-based detection
  const hour = new Date().getHours();
  return getTimeTheme(hour);
}

/**
 * Determines if the current time period is "light" (daytime) or "dark" (nighttime)
 * Used for adaptive message bubble styling
 * 
 * @param hour - Current hour (0-23)
 * @returns 'light' for daytime (6am-8pm), 'dark' for nighttime
 */
export function getTimeTheme(hour: number): 'light' | 'dark' {
  // Daytime: 6am to 8pm (6-20)
  // Nighttime: 8pm to 6am (20-24, 0-6)
  if (hour >= 6 && hour < 20) {
    return 'light';
  }
  return 'dark';
}

/**
 * Gets sky gradient with user preference consideration
 * Dark mode uses night range, light mode uses day range
 * 
 * @param hour - Current hour (0-23)
 * @param minute - Current minute (0-59)
 * @param preference - Optional user preference, defaults to system detection
 * @returns Sky gradient adjusted for user preference
 */
export function getSkyGradientWithPreference(
  hour: number,
  minute: number,
  preference?: 'light' | 'dark'
): Gradient {
  const userPreference = preference || getUserPreference();
  const effectiveHour = getEffectiveTime(hour, userPreference);
  return getSkyGradient(effectiveHour, minute);
}

