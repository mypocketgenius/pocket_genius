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

### 1. Theme Configuration (`lib/theme/config.ts`)

Centralized color definitions and theme logic:

```typescript
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

// Theme mode logic functions
export function getEffectiveHourForMode(
  mode: ThemeMode,
  actualHour: number,
  customPeriod?: TimePeriod
): number {
  // Returns effective hour based on theme mode
}
```

### 2. Theme Context (`lib/theme/theme-context.tsx`)

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
  // localStorage sync (localStorage only, no DB)
  // Update interval for cycle modes (5 minutes, fixed)
  // Return context provider
}

export function useTheme() {
  // Hook to access theme context
}
```

### 3. Settings Component (`components/theme-settings.tsx`)

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

### 4. Refactored Sky Gradient Hook (`lib/hooks/use-sky-gradient.ts`)

Updated to use theme context instead of direct time calculation:

```typescript
export function useSkyGradient(): SkyGradientState {
  const theme = useTheme(); // Get from context
  // Use theme.mode and theme.customPeriod
  // Calculate gradient based on theme mode
}
```

### 5. Storage Strategy (`lib/theme/storage.ts`)

localStorage utilities:

```typescript
const THEME_STORAGE_KEY = 'pocket-genius-theme';

export function loadThemeSettings(): ThemeSettings {
  // Load from localStorage
}

export function saveThemeSettings(settings: ThemeSettings): void {
  // Save to localStorage
}
```

### 6. Integration Points

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

### Task 1: Create Theme Configuration System
**Subtask 1.1** — Extract gradient definitions to `lib/theme/config.ts`  
**Visible output**: `lib/theme/config.ts` created with all gradient presets

**Subtask 1.2** — Extract bubble styles and text colors to config  
**Visible output**: Bubble styles and text colors in config file

**Subtask 1.3** — Create theme mode logic functions  
**Visible output**: Functions to calculate effective hour based on mode

### Task 2: Create Theme Context Provider
**Subtask 2.1** — Create `lib/theme/theme-context.tsx` with context definition  
**Visible output**: Theme context file created

**Subtask 2.2** — Implement ThemeProvider component with state management  
**Visible output**: Provider component with mode state, gradient calculation

**Subtask 2.3** — Add localStorage persistence  
**Visible output**: Theme preferences persist across page reloads

**Subtask 2.4** — Add update interval for cycle modes  
**Visible output**: Cycle modes update every 5 minutes

**Subtask 2.5** — Create `useTheme()` hook  
**Visible output**: Hook exported and usable

### Task 3: Create Settings UI Component
**Subtask 3.1** — Create `components/theme-settings.tsx` component  
**Visible output**: Settings component file created

**Subtask 3.2** — Add radio buttons for theme mode selection  
**Visible output**: UI with 4 mode options (custom, cycle, dark-cycle, light-cycle)

**Subtask 3.3** — Add period selector rows for custom mode  
**Visible output**: Clickable rows for each period (Night, Dawn, Morning, etc.) with:
  - User-friendly display names (PERIOD_DISPLAY_NAMES)
  - Gradient preview background (linear-gradient using period colors)
  - Correct text color based on period theme (light/dark)
  - Visual selection state

**Subtask 3.4** — Add save/cancel buttons  
**Visible output**: Buttons wired to theme context

**Subtask 3.5** — Style settings modal (use existing dialog component)  
**Visible output**: Styled modal matching app design

### Task 4: Refactor Existing Code
**Subtask 4.1** — Update `useSkyGradient` hook to use theme context  
**Visible output**: Hook refactored, uses `useTheme()`

**Subtask 4.2** — Update chat component to use theme context  
**Visible output**: Chat component uses `useTheme()` instead of `useSkyGradient()`

**Subtask 4.3** — Remove duplicate color definitions from chat.tsx  
**Visible output**: Colors imported from theme config

**Subtask 4.4** — Wire settings button to open settings modal  
**Visible output**: Settings button opens ThemeSettings modal

### Task 5: Add Theme Provider to App (Site-Wide)
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
    config.ts          # Centralized color definitions
    theme-context.tsx  # React context provider
    storage.ts         # localStorage utilities
    types.ts           # TypeScript types
  hooks/
    use-sky-gradient.ts # Refactored to use theme context

components/
  theme-settings.tsx   # Settings UI component
  chat.tsx             # Updated to use theme context
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
- Default theme mode = "cycle" (current behavior)
- Existing localStorage keys ignored (new key: `pocket-genius-theme`)
- No breaking changes to existing components initially

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

