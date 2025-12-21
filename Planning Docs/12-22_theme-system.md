# Theme System Architecture Plan

## Objective
Create a centralized, user-configurable theme system that supports multiple theme modes (custom, cycle, dark-cycle, light-cycle) and can be easily extended site-wide. The system should allow users to select their preferred theme mode via settings, with all color definitions managed in a single source of truth.

## Acceptance Criteria
- [ ] User can select theme mode: custom, cycle, dark-cycle, light-cycle
- [ ] Settings accessible via cog/chat icon button (and other locations)
- [ ] Theme preference persists across sessions (localStorage)
- [ ] All colors defined in one centralized location
- [ ] Theme applies site-wide (all pages: home, chat, dashboard, etc.)
- [ ] Settings UI shows period names (Night, Dawn, Morning, etc.)
- [ ] Settings UI shows gradient previews with correct text colors for each period
- [ ] Settings UI component is reusable
- [ ] Theme changes apply smoothly without flicker

## Clarifying Questions (Answered)
1. Should "custom" mode allow users to pick a specific time period (e.g., "always golden hour") or just lock to current time? 
   - **Answer**: Specific time period (user selects which period to lock to)

2. For "cycle" modes, should the cycle speed be configurable or fixed? 
   - **Answer**: Fixed at current speed (5-minute update interval)

3. Should theme preferences sync across devices (future DB integration)? 
   - **Answer**: Not necessary (localStorage only)

4. Do we need a preview mode in settings before applying? 
   - **Answer**: No (apply immediately)

## Minimal Approach
1. Create centralized theme configuration file
2. Create theme context/provider for React
3. Create settings UI component
4. Refactor existing sky gradient hook to use theme context
5. Add settings persistence (localStorage)
6. Wire settings button to open settings modal

## Text Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Theme System Architecture                  │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐
│  Theme Config    │  ← Single source of truth for all colors
│  (lib/theme/)    │     - Gradient definitions
└────────┬─────────┘     - Time periods
         │                - Chrome colors
         │                - Bubble styles
         │                - Text colors
         ▼
┌──────────────────┐
│  Theme Context   │  ← React context provider
│  (lib/theme/)    │     - Theme mode state
└────────┬─────────┘     - Current gradient/colors
         │                - Theme mode functions
         │                - localStorage sync
         ▼
┌──────────────────┐
│  Settings UI     │  ← Reusable component
│  (components/)   │     - Theme mode selector
└────────┬─────────┘     - Radio buttons/select
         │                - Save/cancel
         │
         ▼
┌──────────────────┐
│  Chat Component  │  ← Consumer of theme context
│  (components/)   │     - Uses theme colors
└──────────────────┘     - Opens settings modal
```

## Plan File Contents

### 1. Theme Types (`lib/theme/types.ts`)

Centralized type definitions:

```typescript
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
```

### 2. Theme Configuration (`lib/theme/config.ts`)

Centralized color definitions and theme logic:

```typescript
import type { TimePeriod, ThemeMode, Gradient } from './types';

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
      // Use mapToNightRange to constrain to 8pm-6am range
      return mapToNightRange(actualHour);
    
    case 'light-cycle':
      // Cycle through light periods only (dawn through dusk)
      // Use mapToDayRange to constrain to 6am-8pm range
      return mapToDayRange(actualHour);
    
    case 'custom':
      // Lock to selected period's representative time
      if (!customPeriod) {
        // Fallback: use current period if no selection
        return getCurrentPeriod(actualHour);
      }
      return PERIOD_TO_TIME[customPeriod];
    
    default:
      return actualHour;
  }
}

// Import helper functions from sky-gradient.ts (need to export them first)
import { mapToNightRange, mapToDayRange, getSkyGradient, getChromeColors, getTimeTheme } from '../utils/sky-gradient';
```

### 3. Theme Context (`lib/theme/theme-context.tsx`)

React context provider for theme state:

```typescript
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // State management
  // Load theme settings from localStorage on mount
  // Calculate gradient based on theme mode:
  //   - cycle: use actual time with getSkyGradient()
  //   - dark-cycle: use mapToNightRange(actualHour) with getSkyGradient()
  //   - light-cycle: use mapToDayRange(actualHour) with getSkyGradient()
  //   - custom: use PERIOD_TO_TIME[customPeriod] with getSkyGradient()
  // Calculate chrome colors using getChromeColors(gradient) - recalculated on every update
  // Calculate theme (light/dark) using getTimeTheme(effectiveHour)
  // localStorage sync (localStorage only, no DB)
  // Update interval for cycle modes (5 minutes, fixed) - only runs for cycle modes
  // Custom mode: no updates (locked to selected period)
  // Return context provider
}

export function useTheme() {
  // Hook to access theme context
}
```

### 4. Settings Component (`components/theme-settings.tsx`)

Reusable settings UI:

```typescript
interface ThemeSettingsProps {
  open: boolean;
  onClose: () => void;
}

export function ThemeSettings({ open, onClose }: ThemeSettingsProps) {
  // Radio buttons for theme modes (custom, cycle, dark-cycle, light-cycle)
  // Period selector rows (if custom mode):
  //   - Each row shows period name, gradient preview background, correct text color
  //   - Clickable rows with visual preview
  //   - Selected period highlighted
  // Save/cancel buttons
  // Uses theme context
  // Each period row:
  //   - Background: linear-gradient(135deg, period.start, period.end)
  //   - Text color: TEXT_COLORS[PERIOD_THEMES[period]]
  //   - Period name: PERIOD_DISPLAY_NAMES[period]
  //   - Rounded corners, padding, hover states
  //   - Selected state: border or background overlay
}
```

### 5. Refactored Sky Gradient Hook (`lib/hooks/use-sky-gradient.ts`)

**Migration Strategy**: 
- Keep `useSkyGradient` as a thin wrapper around `useTheme()` for backward compatibility
- Deprecate gradually - mark as deprecated but keep functional
- Eventually remove once all components use `useTheme()` directly

```typescript
/**
 * @deprecated Use useTheme() from lib/theme/theme-context instead
 * This hook is kept for backward compatibility
 */
export function useSkyGradient(): SkyGradientState {
  const theme = useTheme(); // Get from context
  return {
    gradient: theme.gradient,
    theme: theme.theme,
    chrome: theme.chrome,
  };
}

Updated to use theme context instead of direct time calculation:

```typescript
export function useSkyGradient(): SkyGradientState {
  const theme = useTheme(); // Get from context
  // Use theme.mode and theme.customPeriod
  // Calculate gradient based on theme mode
}
```

### 6. Storage Strategy (Inlined in theme-context.tsx)

localStorage utilities inlined in ThemeProvider:

```typescript
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
```

### 7. Integration Points

- **Root Layout** (`app/layout.tsx`): Wrap app with `ThemeProvider` for site-wide theme
  ```tsx
  <ThemeProvider>
    <body>{children}</body>
  </ThemeProvider>
  ```
- **Chat component**: Use `useTheme()` hook, add settings button handler
- **Settings button**: Open `ThemeSettings` modal
- **Other pages** (home, dashboard, test-upload, test-files): Automatically get theme via context
- **Site-wide application**: Theme applies to all pages since ThemeProvider is in root layout

## Work Plan

### Task 1: Create Theme Type Definitions
**Subtask 1.1** — Create `lib/theme/types.ts` with all type definitions  
**Visible output**: `lib/theme/types.ts` created with Gradient, ChromeColors, BubbleStyles, ThemeSettings, ThemeMode, TimePeriod

### Task 2: Create Theme Configuration System
**Subtask 2.1** — Extract gradient definitions to `lib/theme/config.ts`  
**Visible output**: `lib/theme/config.ts` created with all gradient presets

**Subtask 2.2** — Extract bubble styles and text colors to config  
**Visible output**: Bubble styles and text colors in config file

**Subtask 2.3** — Add period time ranges and period-to-time mapping  
**Visible output**: PERIOD_TIME_RANGES and PERIOD_TO_TIME constants defined

**Subtask 2.4** — Create theme mode logic functions  
**Visible output**: `getEffectiveHourForMode()` function fully implemented with all mode cases

### Task 3: Create Theme Context Provider
**Subtask 2.1** — Create `lib/theme/theme-context.tsx` with context definition  
**Visible output**: Theme context file created

**Subtask 2.2** — Implement ThemeProvider component with state management  
**Visible output**: Provider component with mode state, gradient calculation

**Subtask 3.3** — Add localStorage persistence (inlined in context)  
**Visible output**: Theme preferences persist across page reloads, with error handling and validation

**Subtask 3.4** — Implement gradient calculation logic  
**Visible output**: `updateGradient()` function calls `getSkyGradient()` with correct hour/minute based on mode

**Subtask 3.5** — Add update interval for cycle modes  
**Visible output**: Cycle modes update every 5 minutes, custom mode has no interval

**Subtask 3.6** — Create `useTheme()` hook  
**Visible output**: Hook exported and usable

### Task 4: Create Settings UI Component
**Subtask 3.1** — Create `components/theme-settings.tsx` component  
**Visible output**: Settings component file created

**Subtask 3.2** — Add radio buttons for theme mode selection  
**Visible output**: UI with 4 mode options (custom, cycle, dark-cycle, light-cycle)

**Subtask 3.3** — Add period selector rows for custom mode  
**Visible output**: Clickable rows for each period in chronological order (Night → Dawn → Morning → Midday → Afternoon → Golden Hour → Dusk → Evening) with:
  - User-friendly display names (PERIOD_DISPLAY_NAMES)
  - Gradient preview background (linear-gradient using GRADIENT_PRESETS period colors)
  - Correct text color based on period theme (TEXT_COLORS[PERIOD_THEMES[period]])
  - Visual selection state (border or overlay)
  - Default selection: current period if no customPeriod set

**Subtask 3.4** — Add save/cancel buttons  
**Visible output**: Buttons wired to theme context

**Subtask 3.5** — Style settings modal (use existing dialog component)  
**Visible output**: Styled modal matching app design

### Task 5: Refactor Existing Code
**Subtask 4.1** — Update `useSkyGradient` hook to use theme context  
**Visible output**: Hook refactored, uses `useTheme()`

**Subtask 4.2** — Update chat component to use theme context  
**Visible output**: Chat component uses `useTheme()` instead of `useSkyGradient()`

**Subtask 4.3** — Remove duplicate color definitions from chat.tsx  
**Visible output**: Colors imported from theme config

**Subtask 4.4** — Wire settings button to open settings modal  
**Visible output**: Settings button opens ThemeSettings modal

### Task 6: Add Theme Provider to App (Site-Wide)
**Subtask 5.1** — Wrap app with ThemeProvider in `app/layout.tsx`  
**Visible output**: ThemeProvider wraps `<body>` children in root layout, making theme available site-wide

**Subtask 5.2** — Apply theme to root layout body/background  
**Visible output**: Root layout uses theme gradient for background (all pages inherit)

**Subtask 5.3** — Test theme on multiple pages (home, dashboard, chat)  
**Visible output**: Theme applies consistently across all pages

**Subtask 5.4** — Test theme persistence and updates  
**Visible output**: Theme persists across page navigations, cycles work correctly

## Architectural Discipline

### File Structure
```
lib/
  theme/
    types.ts           # TypeScript types (Gradient, ChromeColors, ThemeSettings, etc.)
    config.ts          # Centralized color definitions and logic functions
    theme-context.tsx  # React context provider (includes inlined storage utilities)
  hooks/
    use-sky-gradient.ts # Deprecated wrapper around useTheme() (backward compatibility)

components/
  theme-settings.tsx   # Settings UI component
  chat.tsx             # Updated to use theme context

lib/utils/
  sky-gradient.ts      # Export mapToNightRange, mapToDayRange (currently private - need to export)
```

### File Limits
- `config.ts`: ≤120 lines (color definitions)
- `theme-context.tsx`: ≤150 lines (state management)
- `theme-settings.tsx`: ≤120 lines (UI component)
- Each file: ≤5 exported functions/components

### Design Rules
- **Single Responsibility**: Config = colors, Context = state, Settings = UI
- **No Duplication**: Colors defined once in config.ts
- **Centralized Updates**: Change colors in one place, affects entire app

## Risks & Edge Cases

1. **Hydration Mismatch**: Theme loaded from localStorage might differ from server render
   - **Mitigation**: Start with default theme, update after hydration

2. **Performance**: Frequent updates in cycle modes
   - **Mitigation**: Use 5-minute interval, debounce updates

3. **localStorage Unavailable**: Some browsers/incognito mode
   - **Mitigation**: Fallback to default theme, handle gracefully

4. **Theme Transition Flicker**: Rapid mode changes
   - **Mitigation**: CSS transitions already in place (2s ease)

5. **Custom Mode Lock**: User selects custom period, time still progresses
   - **Solution**: Lock gradient to selected period, don't update with time

## Tests

### Test 1: Theme Mode Selection
- **Input**: User selects "dark-cycle" mode
- **Expected**: Theme cycles through dark periods only (8pm-6am range)
- **Verify**: Check gradient colors match dark periods

### Test 2: Custom Mode Lock
- **Input**: User selects custom mode → "golden hour"
- **Expected**: Gradient stays at golden hour colors, doesn't change with time
- **Verify**: Wait 10 minutes, gradient unchanged

### Test 3: Persistence
- **Input**: User selects "light-cycle", refresh page
- **Expected**: Theme mode persists, still "light-cycle"
- **Verify**: Check localStorage, verify theme applied

### Test 4: Cycle Mode Updates
- **Input**: Set to "cycle" mode, wait 5 minutes
- **Expected**: Gradient updates to match current time
- **Verify**: Check gradient colors match time period

### Test 5: Settings Modal
- **Input**: Click settings button
- **Expected**: Modal opens with current theme mode selected
- **Verify**: Radio button matches current mode

### Test 6: Period Preview Display
- **Input**: Select custom mode in settings
- **Expected**: All 8 period rows display with:
  - Correct gradient backgrounds
  - Correct text colors (dark text for light periods, light text for dark periods)
  - User-friendly names (Night, Dawn, Morning, etc.)
- **Verify**: Visual inspection of each row matches expected gradient and text color

## Implementation Notes

### Migration Strategy
1. Create new theme system alongside existing code
2. Refactor one component at a time (start with chat)
3. Keep old code until new system is stable
4. Remove old code after full migration

### Backward Compatibility
- Default theme mode = "cycle" (DEFAULT_THEME constant)
- Existing localStorage keys ignored (new key: `pocket-genius-theme`)
- No breaking changes to existing components initially
- `useSkyGradient` hook kept as wrapper for backward compatibility (deprecated but functional)
- Migration path: Gradually migrate components from `useSkyGradient` to `useTheme()`

### Important Clarifications

#### Gradient Calculation Strategy
- **GRADIENT_PRESETS** are key stops (as currently defined in sky-gradient.ts)
- **Context still calls `getSkyGradient(effectiveHour, minute)`** for interpolation
- **Custom mode**: Uses `PERIOD_TO_TIME[period]` as hour, `minute=0` (locks to period midpoint)
- **Other modes**: Use actual hour/minute for smooth interpolation

#### Helper Function Import
- **Export `mapToNightRange` and `mapToDayRange`** from `sky-gradient.ts` (currently private)
- **Import in config.ts** to avoid duplication
- Do NOT reimplement these functions

#### Terminology Clarification
- **`preference`**: User's system dark/light preference (removed in new system)
- **`theme`**: Time-based light/dark (6am-8pm = light, 8pm-6am = dark)
- The new system uses `theme` (time-based), not `preference` (system-based)

### Future Enhancements
- Custom color picker for advanced users
- Export/import theme settings
- Per-page theme overrides
- Additional theme presets (e.g., "ocean", "forest", "sunset")

## Key Design Decisions

### 1. Period Display Names
- Each period has a user-friendly display name:
  - `night` → "Night"
  - `dawn` → "Dawn"
  - `morning` → "Morning"
  - `midday` → "Midday"
  - `afternoon` → "Afternoon"
  - `golden` → "Golden Hour"
  - `dusk` → "Dusk"
  - `evening` → "Evening"

### 2. Settings UI with Gradient Previews
- Each period option in custom mode shows:
  - **Background**: Actual gradient (`linear-gradient(135deg, period.start, period.end)`)
  - **Text Color**: Correct color based on period theme:
    - Light periods (dawn, morning, midday, afternoon, golden, dusk): Dark text (#1a1a1a)
    - Dark periods (night, evening): Light text (#e8e8e8)
  - **Display Name**: User-friendly name from `PERIOD_DISPLAY_NAMES`
  - Visual selection state (border/overlay)

### 3. Site-Wide Theme Application
- **Confirmed**: Theme applies to entire site, not just chat page
- **Implementation**: `ThemeProvider` wraps app in `app/layout.tsx`
- **Scope**: All pages inherit theme (home, chat, dashboard, test-upload, test-files)
- **Background**: Root layout body uses theme gradient
- **Components**: Any component can use `useTheme()` hook to access theme colors

## Approval Prompt

**Approve the plan to proceed to BUILD? (Yes / Answer questions / Edit)**

