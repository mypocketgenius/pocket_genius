import type { PillColors, HSLColor } from './pill-colors';
import { parseHSL } from './pill-colors';

// Consistent base values
const BASE_BORDER_RADIUS = '9999px'; // Fully rounded
const BASE_FONT_SIZE = '0.875rem';   // text-sm (14px)

// Pill type configurations
const PILL_CONFIG = {
  filter: {
    fillOpacity: { unselected: 0.18, selected: 0.30 },
    fontWeight: { unselected: '500', selected: '600' }, // Medium → Semibold when selected
    padding: '12px 20px',
    border: { unselected: '1px', selected: '1px' }, // Border for both states
    borderOpacity: { unselected: 0.50, selected: 0.85 }, // Border opacity for both states
  },
  action: {
    fillOpacity: { unselected: 0.25, selected: 0.30 }, // Increased for better visibility
    fontWeight: '600', // Semibold
    padding: '10px 18px',
    border: '1px', // Add border for action pills
    borderOpacity: 0.70, // Border opacity for action pills (increased for visibility)
  },
  suggestion: {
    fillOpacity: { unselected: 0.18, selected: 0.25 }, // Increased from 12% to 18% for visibility
    fontWeight: '400', // Regular
    padding: '10px 16px',
    border: { primary: '1px', secondary: '1px' }, // Both primary and secondary have borders
    borderOpacity: 0.70, // Border opacity for suggestion pills
  },
} as const;

/**
 * Convert HSL string to RGBA with opacity
 * For React inline styles, we need RGBA format (can't use color-mix in inline styles)
 */
function hslToRgba(hslString: string, opacity: number): string {
  const color = parseHSL(hslString);
  
  // Convert HSL to RGB
  const h = color.h / 360;
  const s = color.s / 100;
  const l = color.l / 100;
  
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${opacity})`;
}

/**
 * Generate styles for filter pills (navigation/category selection)
 * Selected state: 30% opacity background + 1-2px inner border + font weight 500→600
 */
export function getFilterPillStyles(
  colors: PillColors,
  isSelected: boolean,
  theme: 'light' | 'dark' = 'light' // Add theme parameter for contrast adjustment
): React.CSSProperties {
  const config = PILL_CONFIG.filter;
  const opacity = isSelected ? config.fillOpacity.selected : config.fillOpacity.unselected;
  const fontWeight = isSelected ? config.fontWeight.selected : config.fontWeight.unselected;
  
  // Adjust colors for theme: darken for light themes, lighten for dark themes
  const adjustedBgColor = adjustColorForTheme(colors.secondaryAccent, theme, true);
  const textColor = adjustTextColorForContrast(colors.secondaryAccent, theme);
  
  const borderOpacity = isSelected ? config.borderOpacity.selected : config.borderOpacity.unselected;
  const borderWidth = isSelected ? config.border.selected : config.border.unselected;
  const borderColor = getBorderColor(colors.secondaryAccent, theme);
  
  const baseStyles: React.CSSProperties = {
    backgroundColor: hslToRgba(adjustedBgColor, opacity),
    color: textColor,
    fontWeight,
    padding: config.padding,
    borderRadius: BASE_BORDER_RADIUS,
    fontSize: BASE_FONT_SIZE,
    border: `${borderWidth} solid ${hslToRgba(borderColor, borderOpacity)}`,
  };
  
  return baseStyles;
}

/**
 * Helper: Adjust color for better visibility on light/dark backgrounds
 * For light themes: darkens the color (reduces lightness)
 * For dark themes: lightens the color (increases lightness)
 */
function adjustColorForTheme(hslString: string, theme: 'light' | 'dark', isBackground: boolean = false): string {
  const color = parseHSL(hslString);
  
  if (theme === 'light') {
    // For light backgrounds, darken colors for visibility
    // Background: reduce lightness significantly (to 40-60% range)
    // Text: reduce lightness more (to 25-40% range for better contrast)
    if (isBackground) {
      // Darken background colors: target 40-60% lightness
      if (color.l > 60) {
        color.l = Math.max(40, color.l * 0.65);
      }
    } else {
      // Darken text colors: target 25-40% lightness for strong contrast
      color.l = Math.max(25, color.l * 0.6);
    }
    // Increase saturation for more vibrancy
    color.s = Math.min(100, color.s * 1.3);
  } else {
    // For dark backgrounds, lighten colors for visibility
    if (isBackground) {
      // Lighten background colors: target 60-80% lightness
      if (color.l < 60) {
        color.l = Math.min(80, color.l * 1.4);
      }
    } else {
      // Lighten text colors: target 70-85% lightness
      color.l = Math.min(85, color.l * 1.4);
    }
  }
  
  return `hsl(${Math.round(color.h)}, ${Math.round(color.s * 10) / 10}%, ${Math.round(color.l * 10) / 10}%)`;
}

/**
 * Helper: Adjust lightness for better text contrast
 * Darkens light colors and lightens dark colors for readability
 */
function adjustTextColorForContrast(hslString: string, theme: 'light' | 'dark'): string {
  return adjustColorForTheme(hslString, theme, false);
}

/**
 * Helper: Get border color with better visibility
 * Creates a more contrasting border color that stands out from the background
 */
function getBorderColor(baseColor: string, theme: 'light' | 'dark'): string {
  const color = parseHSL(baseColor);
  
  if (theme === 'light') {
    // For light themes, make border darker and more saturated for visibility
    // Target 20-35% lightness for strong contrast against light backgrounds
    color.l = Math.max(20, Math.min(35, color.l * 0.5));
    color.s = Math.min(100, color.s * 1.4); // Increase saturation
  } else {
    // For dark themes, make border lighter for visibility
    // Target 70-85% lightness for contrast against dark backgrounds
    color.l = Math.min(85, Math.max(70, color.l * 1.5));
  }
  
  return `hsl(${Math.round(color.h)}, ${Math.round(color.s * 10) / 10}%, ${Math.round(color.l * 10) / 10}%)`;
}

/**
 * Generate styles for action pills (feedback buttons)
 */
export function getActionPillStyles(
  colors: PillColors,
  isPositive: boolean, // true for helpful, false for not helpful
  isSelected: boolean,
  theme: 'light' | 'dark' = 'light' // Add theme parameter for contrast adjustment
): React.CSSProperties {
  const config = PILL_CONFIG.action;
  const opacity = isSelected ? config.fillOpacity.selected : config.fillOpacity.unselected;
  const semanticColor = isPositive ? colors.success : colors.error;
  
  // Adjust colors for theme: darken for light themes, lighten for dark themes
  const adjustedBgColor = adjustColorForTheme(semanticColor, theme, true);
  const textColor = adjustTextColorForContrast(semanticColor, theme);
  const borderColor = getBorderColor(semanticColor, theme);
  
  return {
    backgroundColor: hslToRgba(adjustedBgColor, opacity),
    color: textColor,
    fontWeight: config.fontWeight,
    padding: config.padding,
    borderRadius: BASE_BORDER_RADIUS,
    fontSize: BASE_FONT_SIZE,
    border: `${config.border} solid ${hslToRgba(borderColor, config.borderOpacity)}`,
  };
}

/**
 * Generate styles for suggestion pills (prompts/questions)
 * Both primary (suggested questions) and secondary (expansion) pills have borders
 */
export function getSuggestionPillStyles(
  colors: PillColors,
  isPrimary: boolean, // true for primary suggestions, false for secondary
  isSelected: boolean,
  theme: 'light' | 'dark' = 'light' // Add theme parameter for contrast adjustment
): React.CSSProperties {
  const config = PILL_CONFIG.suggestion;
  const opacity = isSelected ? config.fillOpacity.selected : config.fillOpacity.unselected;
  
  // Primary uses secondary accent, secondary uses neutral
  const baseFillColor = isPrimary ? colors.secondaryAccent : colors.neutral;
  const baseTextColor = isPrimary ? colors.secondaryAccent : colors.neutral;
  
  // Adjust colors for theme: darken for light themes, lighten for dark themes
  const adjustedFillColor = adjustColorForTheme(baseFillColor, theme, true);
  const textColor = adjustTextColorForContrast(baseTextColor, theme);
  const borderColor = getBorderColor(baseTextColor, theme);
  
  // Both primary and secondary suggestion pills get borders
  const borderWidth = isPrimary ? config.border.primary : config.border.secondary;
  
  const baseStyles: React.CSSProperties = {
    backgroundColor: hslToRgba(adjustedFillColor, opacity),
    color: textColor,
    fontWeight: config.fontWeight,
    padding: config.padding,
    borderRadius: BASE_BORDER_RADIUS,
    fontSize: BASE_FONT_SIZE,
    border: `${borderWidth} solid ${hslToRgba(borderColor, config.borderOpacity)}`,
  };
  
  return baseStyles;
}

