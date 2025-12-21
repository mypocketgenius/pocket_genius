/**
 * Sky Gradient Utility
 * 
 * Creates a subtle, time-of-day-based gradient that mirrors the sky outside.
 * The gradient is extremely desaturated (2-3% color intensity) to remain
 * sophisticated and minimal while creating subconscious emotional resonance.
 * 
 * Uses HSL color space for easier interpolation and saturation control.
 */

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
 * Interpolates between two HSL colors
 * Handles hue wrapping (e.g., 350° to 10° should go through 0°, not backwards)
 */
function interpolateHSL(color1: HSLColor, color2: HSLColor, t: number): HSLColor {
  // Clamp t between 0 and 1
  t = Math.max(0, Math.min(1, t));

  // Interpolate hue with wrapping
  let h1 = color1.h;
  let h2 = color2.h;
  let dh = h2 - h1;
  
  // Take the shorter path around the color wheel
  if (Math.abs(dh) > 180) {
    if (dh > 0) {
      dh -= 360;
    } else {
      dh += 360;
    }
  }
  
  const h = (h1 + dh * t + 360) % 360;

  // Interpolate saturation and lightness linearly
  const s = color1.s + (color2.s - color1.s) * t;
  const l = color1.l + (color2.l - color1.l) * t;

  return { h, s, l };
}

/**
 * Interpolates between two gradient stops
 */
function interpolateGradients(
  gradient1: Gradient,
  gradient2: Gradient,
  t: number
): Gradient {
  const start1 = parseHSL(gradient1.start);
  const end1 = parseHSL(gradient1.end);
  const start2 = parseHSL(gradient2.start);
  const end2 = parseHSL(gradient2.end);

  const start = interpolateHSL(start1, start2, t);
  const end = interpolateHSL(end1, end2, t);

  return {
    start: hslToString(start),
    end: hslToString(end),
  };
}

/**
 * Calculates the sky gradient based on the current time of day
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
 * @param minute - Current minute (0-59)
 * @returns Gradient object with start and end HSL color strings
 */
export function getSkyGradient(hour: number, minute: number): Gradient {
  const timeDecimal = hour + minute / 60;

  // Define key gradient stops throughout the day
  const gradients: Record<string, Gradient> = {
    // Night (0-5am): Deep indigo with hints of violet
    night: {
      start: 'hsl(240, 15%, 8%)',
      end: 'hsl(260, 12%, 12%)',
    },
    // Dawn (5-7am): Soft peaches and lavenders
    dawn: {
      start: 'hsl(20, 25%, 92%)',
      end: 'hsl(280, 20%, 94%)',
    },
    // Morning (7-11am): Pale azure with warm highlights
    morning: {
      start: 'hsl(200, 20%, 96%)',
      end: 'hsl(210, 15%, 98%)',
    },
    // Midday (11am-3pm): Bright pale azure
    midday: {
      start: 'hsl(200, 18%, 97%)',
      end: 'hsl(190, 12%, 99%)',
    },
    // Afternoon (3-6pm): Warm azure
    afternoon: {
      start: 'hsl(210, 15%, 96%)',
      end: 'hsl(200, 18%, 98%)',
    },
    // Golden hour (6-8pm): Amber glow - more visible warm tones
    golden: {
      start: 'hsl(35, 35%, 90%)', // More saturation and slightly darker for visibility
      end: 'hsl(25, 30%, 92%)',
    },
    // Dusk (8-10pm): Lavender to indigo transition
    dusk: {
      start: 'hsl(260, 18%, 90%)',
      end: 'hsl(240, 15%, 92%)',
    },
    // Evening (10pm-midnight): Deep indigo
    evening: {
      start: 'hsl(240, 15%, 12%)',
      end: 'hsl(250, 12%, 10%)',
    },
  };

  // Determine current gradient based on time
  let currentGradient: Gradient;

  if (timeDecimal >= 0 && timeDecimal < 5) {
    // Night (0-5am)
    currentGradient = gradients.night;
  } else if (timeDecimal >= 5 && timeDecimal < 7) {
    // Dawn (5-7am): Interpolate between night and dawn
    const t = (timeDecimal - 5) / 2;
    currentGradient = interpolateGradients(gradients.night, gradients.dawn, t);
  } else if (timeDecimal >= 7 && timeDecimal < 11) {
    // Morning (7-11am): Interpolate between dawn and morning
    const t = (timeDecimal - 7) / 4;
    currentGradient = interpolateGradients(gradients.dawn, gradients.morning, t);
  } else if (timeDecimal >= 11 && timeDecimal < 15) {
    // Midday (11am-3pm): Interpolate between morning and midday
    const t = (timeDecimal - 11) / 4;
    currentGradient = interpolateGradients(gradients.morning, gradients.midday, t);
  } else if (timeDecimal >= 15 && timeDecimal < 18) {
    // Afternoon (3-6pm): Interpolate between midday and afternoon
    const t = (timeDecimal - 15) / 3;
    currentGradient = interpolateGradients(gradients.midday, gradients.afternoon, t);
  } else if (timeDecimal >= 18 && timeDecimal < 20) {
    // Golden hour (6-8pm): Interpolate between afternoon and golden
    const t = (timeDecimal - 18) / 2;
    currentGradient = interpolateGradients(gradients.afternoon, gradients.golden, t);
  } else if (timeDecimal >= 20 && timeDecimal < 22) {
    // Dusk (8-10pm): Interpolate between golden and dusk
    const t = (timeDecimal - 20) / 2;
    currentGradient = interpolateGradients(gradients.golden, gradients.dusk, t);
  } else if (timeDecimal >= 22 && timeDecimal < 24) {
    // Evening (10pm-midnight): Interpolate between dusk and evening, then to night
    // First half (10pm-11pm): dusk -> evening
    // Second half (11pm-midnight): evening -> night
    if (timeDecimal < 23) {
      const t = (timeDecimal - 22) / 1; // 0 to 1 over 1 hour
      currentGradient = interpolateGradients(gradients.dusk, gradients.evening, t);
    } else {
      const t = (timeDecimal - 23) / 1; // 0 to 1 over 1 hour
      currentGradient = interpolateGradients(gradients.evening, gradients.night, t);
    }
  } else {
    // Safety fallback (shouldn't happen with valid input)
    currentGradient = gradients.night;
  }

  return currentGradient;
}

/**
 * Extracts lightness value from HSL color string
 */
function extractLightness(hslString: string): number {
  const color = parseHSL(hslString);
  return color.l;
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
  // Header is 3% darker, input area is 5% darker, border is 8% darker
  const inputAreaColor = adjustLightness(gradient.end, -8);
  return {
    header: adjustLightness(gradient.end, -5),
    input: inputAreaColor,
    inputField: adjustLightness(inputAreaColor, 12), // Much lighter than input area for clear visual distinction
    border: adjustLightness(gradient.end, -10),
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
 * Maps hour to nighttime range (8pm-6am)
 * Day hours (6am-8pm) are mapped proportionally to night hours
 */
function mapToNightRange(hour: number): number {
  // Already in night range (8pm-6am)
  if (hour >= 20 || hour < 6) {
    return hour;
  }
  
  // Map day hours (6am-8pm = 14 hours) to night range (8pm-6am = 10 hours)
  // Spread proportionally: 6am -> 8pm (20), 8pm -> 6am (6)
  const dayProgress = (hour - 6) / 14; // 0 at 6am, 1 at 8pm
  let nightHour = 20 + (dayProgress * 10); // 20 (8pm) to 30
  
  // Wrap around midnight: values >= 24 map to 0-6 range
  // 24 -> 0, 25 -> 1, ..., 30 -> 6
  if (nightHour >= 24) {
    nightHour = nightHour - 24; // Maps 24->0, 25->1, ..., 30->6
  }
  
  return nightHour;
}

/**
 * Maps hour to daytime range (6am-8pm)
 * Night hours (8pm-6am) are mapped proportionally to day hours
 */
function mapToDayRange(hour: number): number {
  // Already in day range (6am-8pm)
  if (hour >= 6 && hour < 20) {
    return hour;
  }
  
  // Map night hours (8pm-6am = 10 hours) to day range (6am-8pm = 14 hours)
  let nightProgress: number;
  if (hour >= 20) {
    // 8pm-midnight: 0 to 0.4
    nightProgress = (hour - 20) / 10;
  } else {
    // midnight-6am: 0.4 to 1
    nightProgress = (hour + 4) / 10;
  }
  
  // Map to day range: 6am -> 6am, midnight -> 2pm, 6am -> 8pm
  // Clamp result to ensure it's within 6-20 range (daytime)
  const dayHour = 6 + (nightProgress * 14);
  return Math.max(6, Math.min(19.99, dayHour));
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

