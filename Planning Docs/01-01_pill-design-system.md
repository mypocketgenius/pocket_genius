# Pill Design System Redesign

**Date:** 2025-01-01  
**Goal:** Redesign filter pills (homepage) and chat pills (chat screen) with a theme-aware design system that distinguishes by function.

---

## 1. Objective

Create a unified design system for pills that:
- Uses theme-aware colors that adapt throughout the day
- Distinguishes pills by function (navigation/filter, action, suggestion)
- Maintains visual consistency through structure
- Provides clear visual hierarchy through opacity, weight, and spacing

---

## 2. Acceptance Criteria

- [ ] Filter pills on homepage use secondary accent color (from gradient.start) at 15-20% opacity
- [ ] Selected filter pills show 30% opacity background PLUS 1-2px inner border in full-strength accent, font weight 500→600
- [ ] Action pills (feedback) use period-specific semantic colors at 20-25% opacity, maintain recognizability
- [ ] Suggestion pills use two-tier system:
  - Primary: Secondary accent at 12-20% opacity, NO border
  - Secondary: Neutral gray at 12-15% opacity, 1px border at 40% opacity
- [ ] Neutral color calculated from blend (60% chrome.text + 40% gradient.end, saturation -50%)
- [ ] All pills adapt to theme changes throughout the day
- [ ] Consistent border radius, typography, and spacing across all pill types
- [ ] Visual distinction achieved through opacity, font weight, padding, and conditional borders

---

## 3. Design Decisions (Finalized)

1. **Secondary Accent Extraction**: ✅ **Use gradient.start**
   - Top of gradient represents sky/atmosphere, more vibrant
   - Creates better contrast for pills
   - Works better across light and dark backgrounds

2. **Semantic Colors**: ✅ **Period-specific with usability constraints**
   - Success/Error maintain recognizability across periods
   - Temperature relationship consistent: success = cooler, error = warmer
   - Examples:
     - Golden hour: Warm sage success, warm coral error
     - Dusk: Cool teal success, dusty rose error
     - Night: Muted mint success, soft crimson error
     - Dawn: Fresh green success, peachy-coral error

3. **Selected State**: ✅ **30% opacity background + 1-2px inner border**
   - Background: Secondary accent at 30% opacity
   - Border: 1px solid secondary accent at 80-100% opacity
   - Font weight: Bump from 500 to 600
   - Provides better accessibility and visual definition

4. **Neutral Color**: ✅ **Calculated blend, not from chrome.border**
   - Formula: 60% chrome.text + 40% gradient.end
   - Then reduce saturation by 50%
   - Creates neutral that feels related to theme but doesn't compete

5. **Border on Suggestion Pills**: ✅ **Conditional borders**
   - Primary suggestions (secondary accent): NO border (already prominent)
   - Secondary suggestions (neutral gray): 1px border at 40% opacity
   - Creates visual hierarchy

---

## 5. Minimal Approach

1. Create `lib/theme/pill-colors.ts` utility that:
   - Extracts secondary accent from gradient.start
   - Generates semantic success/error colors per period
   - Generates neutral colors from chrome
   - Provides functions to get colors for each pill type

2. Create `lib/theme/pill-styles.ts` utility that:
   - Defines consistent base styles (border radius, font size)
   - Generates style objects for each pill type
   - Handles selected/unselected states
   - Returns CSS-in-JS style objects

3. Update `components/homepage-filter-pills.tsx`:
   - Use theme hook
   - Apply filter pill styles from utility
   - Track selected state

4. Update `components/pills/pill.tsx`:
   - Use theme hook
   - Apply appropriate styles based on pillType
   - Remove hard-coded Tailwind colors

---

## 6. Text Diagram

```
Theme System (theme-context.tsx)
    │
    ├─ gradient.start/end (HSL strings)
    ├─ chrome (header, input, border)
    └─ theme ('light' | 'dark')
         │
         └─ Pill Color System (NEW)
              │
              ├─ Secondary Accent (from gradient.start)
              ├─ Semantic Success (period-specific green)
              ├─ Semantic Error (period-specific red/coral)
              └─ Neutral (from chrome.border)
                   │
                   └─ Pill Style Generator
                        │
                        ├─ Filter Pills (15-20% opacity, medium weight)
                        ├─ Action Pills (20-25% opacity, semibold)
                        └─ Suggestion Pills (12-20% opacity, regular, optional border)
```

---

## 7. Plan File Contents

### 7.1 Color Extraction Logic

**File:** `lib/theme/pill-colors.ts`

```typescript
import type { Gradient, ChromeColors, TimePeriod } from './types';

// HSL parsing utilities (reused from sky-gradient.ts logic, not exported there)
interface HSLColor {
  h: number;
  s: number;
  l: number;
}

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

function hslToString(color: HSLColor): string {
  const h = Math.round(color.h);
  const s = Math.round(color.s * 10) / 10;
  const l = Math.round(color.l * 10) / 10;
  return `hsl(${h}, ${s}%, ${l}%)`;
}

interface PillColors {
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
  textColor: string, // From theme.textColor
  gradient: Gradient
): string {
  const textColorParsed = parseHSL(textColor);
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
```

### 7.2 Pill Style Generator

**File:** `lib/theme/pill-styles.ts`

```typescript
import type { PillColors } from './pill-colors';

// Consistent base values
const BASE_BORDER_RADIUS = '9999px'; // Fully rounded
const BASE_FONT_SIZE = '0.875rem';   // text-sm (14px)

// Pill type configurations
const PILL_CONFIG = {
  filter: {
    fillOpacity: { unselected: 0.15, selected: 0.30 },
    fontWeight: { unselected: '500', selected: '600' }, // Medium → Semibold when selected
    padding: '12px 20px',
    border: { unselected: 'none', selected: '1px' }, // Border only when selected
    borderOpacity: 0.85, // Border opacity for selected state
  },
  action: {
    fillOpacity: { unselected: 0.20, selected: 0.25 },
    fontWeight: '600', // Semibold
    padding: '10px 18px',
    border: 'none',
  },
  suggestion: {
    fillOpacity: { unselected: 0.12, selected: 0.20 },
    fontWeight: '400', // Regular
    padding: '10px 16px',
    border: { primary: 'none', secondary: '1px' }, // Conditional: primary = no border, secondary = border
    borderOpacity: 0.40, // Border opacity for secondary suggestions
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
  isSelected: boolean
): React.CSSProperties {
  const config = PILL_CONFIG.filter;
  const opacity = isSelected ? config.fillOpacity.selected : config.fillOpacity.unselected;
  const fontWeight = isSelected ? config.fontWeight.selected : config.fontWeight.unselected;
  
  const baseStyles: React.CSSProperties = {
    backgroundColor: hslToRgba(colors.secondaryAccent, opacity),
    color: colors.secondaryAccent, // Use full color for text
    fontWeight,
    padding: config.padding,
    borderRadius: BASE_BORDER_RADIUS,
    fontSize: BASE_FONT_SIZE,
  };
  
  // Add border for selected state
  if (isSelected) {
    baseStyles.border = `${config.border.selected} solid ${hslToRgba(colors.secondaryAccent, config.borderOpacity)}`;
  } else {
    baseStyles.border = config.border.unselected;
  }
  
  return baseStyles;
}

/**
 * Generate styles for action pills (feedback buttons)
 */
export function getActionPillStyles(
  colors: PillColors,
  isPositive: boolean, // true for helpful, false for not helpful
  isSelected: boolean
): React.CSSProperties {
  const config = PILL_CONFIG.action;
  const opacity = isSelected ? config.fillOpacity.selected : config.fillOpacity.unselected;
  const semanticColor = isPositive ? colors.success : colors.error;
  
  return {
    backgroundColor: hslToRgba(semanticColor, opacity),
    color: semanticColor,
    fontWeight: config.fontWeight,
    padding: config.padding,
    borderRadius: BASE_BORDER_RADIUS,
    fontSize: BASE_FONT_SIZE,
    border: config.border,
  };
}

/**
 * Generate styles for suggestion pills (prompts/questions)
 * Conditional borders: Primary (secondary accent) = no border, Secondary (neutral) = 1px border
 */
export function getSuggestionPillStyles(
  colors: PillColors,
  isPrimary: boolean, // true for primary suggestions, false for secondary
  isSelected: boolean
): React.CSSProperties {
  const config = PILL_CONFIG.suggestion;
  const opacity = isSelected ? config.fillOpacity.selected : config.fillOpacity.unselected;
  
  // Primary uses secondary accent, secondary uses neutral
  const fillColor = isPrimary ? colors.secondaryAccent : colors.neutral;
  const textColor = isPrimary ? colors.secondaryAccent : colors.neutral;
  
  const baseStyles: React.CSSProperties = {
    backgroundColor: hslToRgba(fillColor, opacity),
    color: textColor,
    fontWeight: config.fontWeight,
    padding: config.padding,
    borderRadius: BASE_BORDER_RADIUS,
    fontSize: BASE_FONT_SIZE,
  };
  
  // Conditional borders: only secondary (neutral) pills get borders
  if (!isPrimary) {
    baseStyles.border = `${config.border.secondary} solid ${hslToRgba(textColor, config.borderOpacity)}`;
  } else {
    baseStyles.border = config.border.primary;
  }
  
  return baseStyles;
}
```

**Note:** `hslToRgba` needs proper implementation. We can use CSS `color-mix` or a library. For now, we'll use inline styles with opacity.

### 7.3 Updated Homepage Filter Pills

**File:** `components/homepage-filter-pills.tsx`

```typescript
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '@/lib/theme/theme-context';
import { getPillColors } from '@/lib/theme/pill-colors';
import { getFilterPillStyles } from '@/lib/theme/pill-styles';
import { getCurrentPeriod } from '@/lib/theme/config';

export function HomepageFilterPills() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const theme = useTheme();
  
  // Get current period for color generation
  const now = new Date();
  const period = getCurrentPeriod(now.getHours());
  
  // Get pill colors
  const pillColors = getPillColors(theme.gradient, theme.textColor, period, theme.theme);
  
  const categories = [
    'All',
    'Strategy',
    'Leadership',
    'Marketing',
    'Personal Growth',
    'Business',
    'Creativity',
    'Philosophy',
  ];

  const visibleCategories = isExpanded ? categories : categories.slice(0, 6);
  const hasMore = categories.length > 6;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {visibleCategories.map((category) => {
        const isSelected = selectedCategory === category;
        const styles = getFilterPillStyles(pillColors, isSelected);
        
        return (
          <button
            key={category}
            style={styles}
            className="transition-all duration-200 active:scale-95"
            onClick={() => {
              setSelectedCategory(isSelected ? null : category);
              console.log('Filter clicked:', category);
            }}
            aria-label={`Filter by ${category}`}
            aria-pressed={isSelected}
          >
            {category}
          </button>
        );
      })}
      
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 active:scale-95 flex items-center gap-1"
          style={{
            borderColor: theme.chrome.border,
            backgroundColor: 'transparent',
            color: theme.textColor,
          }}
          aria-label={isExpanded ? 'Show fewer categories' : 'Show more categories'}
          aria-expanded={isExpanded}
        >
          {isExpanded ? (
            <>
              <span>Show Less</span>
              <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              <span>Show More</span>
              <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
```

### 7.4 Updated Chat Pills

**File:** `components/pills/pill.tsx`

```typescript
'use client';

import { Check } from 'lucide-react';
import { useTheme } from '@/lib/theme/theme-context';
import { getPillColors } from '@/lib/theme/pill-colors';
import { getActionPillStyles, getSuggestionPillStyles } from '@/lib/theme/pill-styles';
import { getCurrentPeriod } from '@/lib/theme/config';
import type { Pill } from './pill';

interface PillProps {
  pill: Pill;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function Pill({ pill, isSelected, onClick, disabled = false }: PillProps) {
  const theme = useTheme();
  const now = new Date();
  const period = getCurrentPeriod(now.getHours());
  const pillColors = getPillColors(theme.gradient, theme.textColor, period, theme.theme);
  
  // Determine styling based on pill type
  const getPillStyles = (): React.CSSProperties => {
    if (disabled) {
      return {
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        color: theme.textColor,
        opacity: 0.4,
        cursor: 'not-allowed',
      };
    }

    if (pill.pillType === 'feedback') {
      const isHelpful = pill.label.toLowerCase().includes('helpful') && 
                       !pill.label.toLowerCase().includes('not');
      return getActionPillStyles(pillColors, isHelpful, isSelected);
    }
    
    if (pill.pillType === 'expansion') {
      // Expansion pills use neutral suggestion style (secondary = has border)
      return getSuggestionPillStyles(pillColors, false, isSelected);
    }
    
    // Suggested questions: use primary suggestion style (no border)
    return getSuggestionPillStyles(pillColors, true, isSelected);
  };

  const baseStyles: React.CSSProperties = {
    ...getPillStyles(),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.375rem',
    minHeight: '36px',
    transition: 'all 0.2s',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={baseStyles}
      className="flex-shrink-0 active:scale-95"
      title={disabled ? 'Please wait...' : pill.label}
      aria-label={pill.label}
      aria-pressed={isSelected}
    >
      {isSelected && (
        <Check className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      )}
      <span>{pill.label}</span>
    </button>
  );
}
```

---

## 8. Implementation Parts (For LLM Execution)

The plan is broken into **4 sequential parts** that can be implemented and tested independently:

### **Part 1: Core Color System** (Foundation)
**Dependencies:** None  
**Files Created:** `lib/theme/pill-colors.ts`  
**Estimated Complexity:** Medium  
**Can Test:** Yes (standalone color generation)

**Includes:**
- Task 1: Create Pill Color System (all subtasks)
  - HSL parsing utilities
  - Secondary accent extraction
  - Period-specific semantic color generation
  - Neutral color blend calculation

**Completion Criteria:**
- ✅ `getPillColors()` function works for all 8 periods
- ✅ Colors are valid HSL strings
- ✅ Semantic colors maintain recognizability

**Status:** ✅ **COMPLETED** (2025-01-01)

**Implementation Notes:**
- Created `lib/theme/pill-colors.ts` with all required functions
- Added HSL parsing utilities (`parseHSL`, `hslToString`)
- Added hex-to-HSL conversion (`hexToHSL`, `parseColor`) to handle hex color inputs from theme system
- Implemented secondary accent extraction from `gradient.start`
- Implemented period-specific semantic color generation (success and error colors)
- Implemented neutral color blend calculation (60% textColor + 40% gradient.end, saturation -50%)
- Created comprehensive test suite (`__tests__/lib/theme/pill-colors.test.ts`) with 40 passing tests
- All tests verify: color validity, period coverage, semantic recognizability, and theme awareness

**Files Created:**
- `lib/theme/pill-colors.ts` (130 lines)
- `__tests__/lib/theme/pill-colors.test.ts` (271 lines)

---

### **Part 2: Style Generator** (Depends on Part 1)
**Dependencies:** Part 1 (`pill-colors.ts`)  
**Files Created:** `lib/theme/pill-styles.ts`  
**Estimated Complexity:** Medium  
**Can Test:** Yes (with mock colors from Part 1)

**Includes:**
- Task 2: Create Pill Style Generator (all subtasks)
  - HSL→RGBA conversion
  - Base style constants
  - Three style generation functions (filter, action, suggestion)
  - Selected/unselected state handling

**Completion Criteria:**
- ✅ All three style functions return valid React.CSSProperties
- ✅ Opacity calculations work correctly
- ✅ Border and font weight logic for selected states

**Status:** ✅ **COMPLETED** (2025-01-01)

**Implementation Notes:**
- Created `lib/theme/pill-styles.ts` with all required functions
- Exported `PillColors` interface and `parseHSL` function from `pill-colors.ts` for reuse
- Implemented HSL→RGBA conversion function (`hslToRgba`) for React inline styles
- Implemented base style constants (border radius: 9999px, font size: 0.875rem)
- Implemented three style generation functions:
  - `getFilterPillStyles`: Filter pills with 15% unselected / 30% selected opacity, font weight 500→600, conditional border
  - `getActionPillStyles`: Action pills with 20% unselected / 25% selected opacity, semantic colors (success/error)
  - `getSuggestionPillStyles`: Suggestion pills with 12% unselected / 20% selected opacity, conditional borders (primary = no border, secondary = 1px border)
- Created comprehensive test suite (`__tests__/lib/theme/pill-styles.test.ts`) with 54 passing tests
- All tests verify: style validity, opacity calculations, border logic, font weights, padding, and integration with real pill colors across all 8 periods

**Files Created:**
- `lib/theme/pill-styles.ts` (154 lines)
- `__tests__/lib/theme/pill-styles.test.ts` (280 lines)

**Files Modified:**
- `lib/theme/pill-colors.ts` (exported `PillColors` interface and `parseHSL` function)

---

### **Part 3: Homepage Filter Pills** (Depends on Parts 1 & 2)
**Dependencies:** Parts 1 & 2  
**Files Modified:** `components/homepage-filter-pills.tsx`  
**Estimated Complexity:** Low-Medium  
**Can Test:** Yes (visual testing on homepage)

**Includes:**
- Task 3: Update Homepage Filter Pills (all subtasks)
  - Add theme hook
  - Replace hard-coded colors
  - Add selected state tracking
  - Update "Show More" button

**Completion Criteria:**
- ✅ Filter pills use theme-aware colors
- ✅ Selected state shows border + font weight change
- ✅ Pills adapt to theme changes

**Status:** ✅ **COMPLETED** (2025-01-01)

**Implementation Notes:**
- Updated `components/homepage-filter-pills.tsx` to use theme-aware pill system
- Added `useTheme` hook to access theme context
- Integrated `getPillColors` and `getFilterPillStyles` from pill utilities
- Replaced hard-coded Tailwind color classes with theme-aware inline styles
- Added selected state tracking (`selectedCategory` state)
- Selected pills show: 30% opacity background + 1px border at 85% opacity + font weight 600
- Unselected pills show: 15% opacity background + font weight 500
- Updated "Show More" button to use `theme.chrome.border` and `theme.textColor` for theme consistency
- All pills now adapt to theme changes throughout the day
- Removed category color assignments (no longer needed - all pills use secondary accent color)

**Files Modified:**
- `components/homepage-filter-pills.tsx` (updated from 85 lines to 88 lines)

---

### **Part 4: Chat Pills** (Depends on Parts 1 & 2)
**Dependencies:** Parts 1 & 2  
**Files Modified:** `components/pills/pill.tsx`  
**Estimated Complexity:** Low-Medium  
**Can Test:** Yes (visual testing in chat interface)

**Includes:**
- Task 4: Update Chat Pills (all subtasks)
  - Add theme hook
  - Replace hard-coded colors
  - Update all three pill types (feedback, expansion, suggested)
  - Conditional border logic

**Completion Criteria:**
- ✅ All pill types use theme-aware colors
- ✅ Feedback pills use semantic colors
- ✅ Expansion pills have borders (secondary)
- ✅ Suggested pills have no borders (primary)

**Status:** ✅ **COMPLETED** (2025-01-01)

**Implementation Notes:**
- Updated `components/pills/pill.tsx` to use theme-aware pill system
- Added `useTheme` hook to access theme context
- Integrated `getPillColors` and style functions (`getActionPillStyles`, `getSuggestionPillStyles`) from pill utilities
- Replaced all hard-coded Tailwind color classes with theme-aware inline styles
- Feedback pills (`pillType === 'feedback'`): Use `getActionPillStyles` with semantic colors (success for helpful, error for not helpful) at 20% unselected / 25% selected opacity
- Expansion pills (`pillType === 'expansion'`): Use `getSuggestionPillStyles(pillColors, false, isSelected)` - neutral color with 12% unselected / 20% selected opacity, 1px border at 40% opacity (secondary suggestion style)
- Suggested pills (`pillType === 'suggested'`): Use `getSuggestionPillStyles(pillColors, true, isSelected)` - secondary accent color with 12% unselected / 20% selected opacity, no border (primary suggestion style)
- Disabled state: Uses theme-aware text color with reduced opacity
- Updated JSDoc comments to reflect new theme-aware design
- All pills now adapt to theme changes throughout the day

**Files Modified:**
- `components/pills/pill.tsx` (updated from 110 lines to 130 lines)

---

### **Part 5: Testing & Refinement** (Optional, Depends on Parts 1-4)
**Dependencies:** All previous parts  
**Files Modified:** None (testing only)  
**Estimated Complexity:** Low  
**Can Test:** N/A (this IS testing)

**Includes:**
- Task 5: Testing & Refinement (all subtasks)
  - Visual testing across all periods
  - Verify specifications match
  - Adjust colors/opacity if needed

**Completion Criteria:**
- ✅ All 8 periods render correctly
- ✅ All specifications verified
- ✅ No visual regressions

---

## 9. Work Plan (Detailed Subtasks)

### Task 1: Create Pill Color System
- **Subtask 1.1** — Create `lib/theme/pill-colors.ts` with color extraction functions  
  **Visible output:** `lib/theme/pill-colors.ts` created with `getPillColors` function

- **Subtask 1.2** — Create HSL parsing utilities (reuse logic from `sky-gradient.ts`, functions not exported)  
  **Visible output:** `parseHSL` and `hslToString` functions added to `pill-colors.ts`

- **Subtask 1.3** — Test color generation for each period  
  **Visible output:** Colors verified for all 8 periods

### Task 2: Create Pill Style Generator
- **Subtask 2.1** — Create `lib/theme/pill-styles.ts` with style generation functions  
  **Visible output:** `lib/theme/pill-styles.ts` created with three style functions

- **Subtask 2.2** — Implement HSL→RGBA conversion for opacity handling  
  **Visible output:** `hslToRgba` function converts HSL to RGBA with opacity

- **Subtask 2.3** — Define consistent base values (border radius, font size)  
  **Visible output:** Constants defined at top of file

### Task 3: Update Homepage Filter Pills
- **Subtask 3.1** — Add theme hook to `components/homepage-filter-pills.tsx`  
  **Visible output:** `useTheme` imported and used

- **Subtask 3.2** — Replace hard-coded colors with theme-aware styles  
  **Visible output:** All pills use `getFilterPillStyles`

- **Subtask 3.3** — Add selected state tracking with border and font weight change  
  **Visible output:** Selected pill shows 30% opacity background + 1px border + font weight 600

- **Subtask 3.4** — Update "Show More" button to use theme colors  
  **Visible output:** Button uses `theme.chrome.border` and `theme.textColor`

### Task 4: Update Chat Pills
- **Subtask 4.1** — Add theme hook to `components/pills/pill.tsx`  
  **Visible output:** `useTheme` imported and used

- **Subtask 4.2** — Replace hard-coded colors with theme-aware styles  
  **Visible output:** All pill types use appropriate style functions

- **Subtask 4.3** — Update feedback pills to use semantic colors  
  **Visible output:** Helpful/Not helpful use success/error colors

- **Subtask 4.4** — Update expansion pills to use neutral suggestion style with border  
  **Visible output:** Expansion pills use neutral color with 1px border at 40% opacity

- **Subtask 4.5** — Update suggested pills to use primary suggestion style (no border)  
  **Visible output:** Suggested pills use secondary accent without border

### Task 5: Testing & Refinement
- **Subtask 5.1** — Test pills across all theme periods  
  **Visible output:** Pills render correctly in all 8 periods

- **Subtask 5.2** — Verify opacity levels match spec (15-20%, 20-25%, 12-20%)  
  **Visible output:** Opacity values confirmed

- **Subtask 5.3** — Verify font weights (medium, semibold, regular)  
  **Visible output:** Font weights confirmed

- **Subtask 5.4** — Verify padding values (12px 20px, 10px 18px, 10px 16px)  
  **Visible output:** Padding values confirmed

---

## 10. Architectural Discipline

### File Structure
- **New files:** 2 (`pill-colors.ts`, `pill-styles.ts`)
- **Modified files:** 2 (`homepage-filter-pills.tsx`, `pill.tsx`)
- **Line counts:** Each new file should be ≤120 lines

### Dependencies
- **New dependencies:** None (use existing theme system)
- **External libraries:** Consider `color` library for HSL→RGB conversion if needed, but prefer CSS `color-mix` if supported

### Design Principles
- **Single Responsibility:** `pill-colors.ts` handles color extraction, `pill-styles.ts` handles style generation
- **DRY:** Reuse theme system, avoid duplicating color logic
- **Consistency:** All pills share base values (border radius, font size)

---

## 11. Risks & Edge Cases

1. **HSL to RGBA Conversion**: CSS `color-mix` may not be supported in all browsers. Need fallback.
   - **Mitigation**: Use inline opacity with HSL strings, or add polyfill

2. **Color Contrast**: Low opacity fills may have poor contrast with text.
   - **Mitigation**: Use full-color text on low-opacity backgrounds, test contrast ratios

3. **Theme Transition**: Colors may shift abruptly when theme changes.
   - **Mitigation**: CSS transitions on background-color (already in place via `sky-gradient-transition`)

4. **Selected State Visibility**: 30% opacity may not be distinct enough from 15-20%.
   - **Mitigation**: Test and adjust opacity values, consider adding subtle border if needed

5. **Period-Specific Colors**: Semantic colors may clash with some periods.
   - **Mitigation**: Test all periods, adjust hue/saturation values as needed

---

## 12. Tests

### Test 1: Filter Pill Colors
- **Input:** Homepage filter pill, golden hour theme
- **Expected:** Secondary accent (warm terracotta) at 15% opacity, text in full color
- **Verify:** Background color matches gradient.start with opacity

### Test 2: Selected Filter Pill
- **Input:** Click filter pill
- **Expected:** Background opacity increases to 30%, 1px border appears, font weight changes to 600
- **Verify:** Selected state shows higher opacity + border + font weight change

### Test 3: Action Pill (Helpful)
- **Input:** Chat screen, helpful feedback pill, dusk theme
- **Expected:** Success color (dusty teal) at 20% opacity, semibold font
- **Verify:** Color matches period-specific success color

### Test 4: Action Pill (Not Helpful)
- **Input:** Chat screen, not helpful feedback pill, golden hour theme
- **Expected:** Error color (soft coral) at 20% opacity, semibold font
- **Verify:** Color matches period-specific error color

### Test 5: Suggestion Pill (Primary)
- **Input:** Chat screen, suggested question pill, lavender theme
- **Expected:** Secondary accent (soft purple) at 12% opacity, NO border, regular font
- **Verify:** Uses secondary accent, no border (already prominent)

### Test 6: Suggestion Pill (Secondary/Expansion)
- **Input:** Chat screen, expansion pill, midday theme
- **Expected:** Neutral gray (blended from textColor + gradient.end) at 12% opacity, 1px border at 40% opacity, regular font
- **Verify:** Uses neutral color (blended), has border for visibility

### Test 7: Theme Transition
- **Input:** Change theme period from dawn to golden hour
- **Expected:** All pill colors update smoothly
- **Verify:** Colors transition without flicker

### Test 8: Consistency Check
- **Input:** All pill types on same screen
- **Expected:** Same border radius, font size, consistent spacing
- **Verify:** Visual consistency maintained

---

## 13. Approval Prompt

**Approve the plan to proceed to BUILD?** (Yes / Answer questions / Edit)

---

## Notes

- **CSS color-mix**: Modern browsers support `color-mix(in srgb, color1 p%, color2)`. For opacity, we can use `color-mix(in srgb, hsl(...) 15%, transparent)`.
- **Fallback**: If `color-mix` not supported, use `rgba()` with manual HSL→RGB conversion or CSS variables with opacity.
- **Performance**: Style objects are recalculated on each render. Consider memoization if performance issues arise.
- **Accessibility**: Ensure contrast ratios meet WCAG AA (4.5:1 for normal text, 3:1 for large text).

