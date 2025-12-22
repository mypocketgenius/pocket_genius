# Fixed Palette Per Period Plan

## Objective
Change the theme system from smooth color interpolation between periods to fixed color palettes for each time period. Each period (night, dawn, morning, etc.) will have one consistent gradient that doesn't change within that period's time range.

## Acceptance Criteria
- [ ] Each time period uses a fixed gradient (no interpolation within period)
- [ ] Colors transition smoothly between periods via CSS (2s ease transition)
- [ ] All 8 periods have distinct fixed palettes
- [ ] Custom mode still locks to selected period's fixed palette
- [ ] Cycle modes still work with smooth CSS transitions
- [ ] Theme context still updates every 5 minutes
- [ ] Minutes are completely ignored (not used in calculations)
- [ ] Interpolation functions completely removed
- [ ] Tests updated to reflect fixed palette behavior

## Clarifying Questions (Answered)
1. Should transitions between periods be instant or have a brief fade?
   - **Answer**: Brief transition via CSS (already implemented in `theme-body.tsx` with `transition: 'background 2s ease'`)
   - **Implementation**: CSS transitions handle smooth color changes automatically - no code changes needed

2. Should we keep the interpolation functions for potential future use?
   - **Answer**: Remove completely - this update fully replaces interpolation features

3. Should custom mode still use minute=0 or can we ignore minutes entirely?
   - **Answer**: Ignore minutes entirely - not used anywhere in fixed palette system

## Minimal Approach
1. Update `getSkyGradient()` to return fixed gradient based on period (no interpolation)
2. Simplify period detection logic
3. Update theme context to ignore minutes (only use hour for period detection)
4. Update tests to reflect fixed palette behavior

## Text Diagram

```
Current (Smooth Interpolation):
5:00am ──────────────── 7:00am
Night ──→ Dawn (smooth transition)

New (Fixed Palette):
5:00am ──────────────── 7:00am
Night → Dawn (instant switch at 5am)
```

## Plan File Contents

### 1. Update `getSkyGradient()` Function (`lib/utils/sky-gradient.ts`)

**Current behavior**: Interpolates between periods, defines gradients inline (lines 123-164)
**New behavior**: Returns fixed gradient for current period, uses centralized `GRADIENT_PRESETS`

```typescript
import { getCurrentPeriod } from '../theme/config';
import { GRADIENT_PRESETS } from '../theme/config';
import type { Gradient } from './sky-gradient';

/**
 * Gets sky gradient based on current time period
 * Returns fixed gradient for the period (no interpolation)
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
```

**Changes**:
- **CRITICAL**: Remove duplicate gradient definitions (lines 123-164)
- Import `getCurrentPeriod` from `../theme/config`
- Import `GRADIENT_PRESETS` from `../theme/config`
- Remove all interpolation logic (lines 166-210)
- Update JSDoc to reflect fixed palette behavior
- Keep `minute` parameter for API compatibility but ignore it completely
- **Note**: CSS transitions (already in `theme-body.tsx`) provide smooth color changes between periods

### 2. Update Period Detection (`lib/theme/config.ts`)

**Current**: `getCurrentPeriod()` already exists and works correctly
**Action**: No changes needed - function already returns fixed periods

### 3. Update Theme Context (`lib/theme/theme-context.tsx`)

**Current**: Uses minute for smooth interpolation (line 78: conditional `minute = mode === 'custom' ? 0 : actualMinute`)
**New**: Ignore minutes entirely, always use 0

```typescript
// In calculateThemeValues() (line 78):
// OLD: const minute = mode === 'custom' ? 0 : actualMinute;
// NEW: const minute = 0; // Always use 0 since we use fixed palettes (no interpolation)

const effectiveHour = getEffectiveHourForMode(mode, actualHour, customPeriod);
const minute = 0; // Always use 0 since we don't interpolate
const gradient = getSkyGradient(effectiveHour, minute);
```

**Changes**:
- **CRITICAL**: Update line 78 to `const minute = 0;` (remove conditional, ignore minutes entirely)
- Remove `actualMinute` parameter usage completely
- Update comment on line 76-77 to reflect fixed palette behavior (minutes ignored)
- Update all related comments throughout function

### 4. Update Tests (`__tests__/lib/theme/config.test.ts`)

**Changes needed**:
- Update tests that expect interpolation
- Add tests verifying fixed palette behavior
- Test that same hour always returns same gradient

### 5. Cleanup Interpolation Functions (`lib/utils/sky-gradient.ts`)

**Current**: `interpolateHSL()` (line 53) and `interpolateGradients()` (line 83) are used for interpolation
**After change**: These functions will be unused

**Decision**: Remove unused functions to keep codebase clean
- Functions are no longer called after removing interpolation logic
- Can be re-added from git history if needed in future
- Reduces code complexity and maintenance burden

**Alternative** (if keeping for future): Add comment explaining why they're kept:
```typescript
// NOTE: These functions are currently unused after switching to fixed palettes.
// Kept for potential future use or easy reversion. Remove if not needed.
function interpolateHSL(...) { ... }
function interpolateGradients(...) { ... }
```

**Recommendation**: Remove them (simpler, cleaner codebase)

## Work Plan

### Task 1: Update getSkyGradient Function
**Subtask 1.1** — **CRITICAL**: Remove duplicate gradient definitions (lines 123-164)  
**Visible output**: No inline gradient definitions in `sky-gradient.ts`

**Subtask 1.2** — Import `getCurrentPeriod` from `../theme/config`  
**Visible output**: Function imports and uses period detection from config

**Subtask 1.3** — Import `GRADIENT_PRESETS` from `../theme/config`  
**Visible output**: Function uses centralized gradient definitions (no duplication)

**Subtask 1.4** — Remove all interpolation logic (lines 166-210)  
**Visible output**: Function returns fixed gradient based on period

**Subtask 1.5** — Update JSDoc comments  
**Visible output**: Documentation reflects fixed palette behavior

### Task 2: Update Theme Context
**Subtask 2.1** — **CRITICAL**: Update line 78 to `const minute = 0;` (remove conditional)  
**Visible output**: Line 78 changed from conditional to always 0

**Subtask 2.2** — Update comments (lines 76-77) to reflect fixed palette behavior  
**Visible output**: Comments updated to explain fixed palettes (no interpolation)

### Task 3: Cleanup Unused Functions
**Subtask 3.1** — Remove `interpolateHSL()` function (line 53) completely  
**Visible output**: Function removed from `sky-gradient.ts` (no longer needed)

**Subtask 3.2** — Remove `interpolateGradients()` function (line 83) completely  
**Visible output**: Function removed from `sky-gradient.ts` (no longer needed)

**Subtask 3.3** — **VERIFY**: Keep `parseHSL()` and `hslToString()` — they're used by `getChromeColors()` → `adjustLightness()`  
**Visible output**: Helper functions remain (still needed for chrome color calculations)

**Subtask 3.4** — Remove any references to interpolation functions  
**Visible output**: No interpolation code remains in codebase

### Task 4: Update Tests
**Subtask 4.1** — Update config tests for fixed palette behavior  
**Visible output**: Tests verify fixed gradients per period

**Subtask 4.2** — Add test: `getSkyGradient(6, 0) === getSkyGradient(6, 30) === getSkyGradient(6, 59)`  
**Visible output**: Test confirms same hour/minute combinations return identical gradients

**Subtask 4.3** — Update context tests (lines 169-192) for fixed palette behavior  
**Visible output**: Context tests reflect fixed palette behavior:
  - Verify `getSkyGradient(6, 0) === getSkyGradient(6, 30) === getSkyGradient(6, 59)` (same hour, different minutes = same gradient)
  - Verify minute=0 always used in theme context
  - Update gradient calculation tests to expect fixed palettes

**Subtask 4.4** — Add edge case test for midnight boundary (24:00 / 0:00)  
**Visible output**: Test verifies correct period at midnight boundary

### Task 5: Verify Behavior
**Subtask 5.1** — Test instant transitions between periods  
**Visible output**: Colors change instantly at period boundaries

**Subtask 5.2** — Test custom mode still works  
**Visible output**: Custom period locks to fixed palette

**Subtask 5.3** — Test cycle modes still work  
**Visible output**: Cycle modes transition instantly between periods

**Subtask 5.4** — Verify import paths are correct  
**Visible output**: `sky-gradient.ts` imports from `../theme/config` work correctly

**Subtask 5.5** — Verify `parseHSL()` and `hslToString()` still work with `getChromeColors()`  
**Visible output**: Chrome colors still calculate correctly (functions still needed)

**Subtask 5.6** — Verify CSS transitions work smoothly between periods  
**Visible output**: Color changes transition smoothly (2s ease) when period changes

## Architectural Discipline

### File Changes
- `lib/utils/sky-gradient.ts`: 
  - Remove duplicate gradient definitions (~42 lines)
  - Remove interpolation logic (~45 lines)
  - Remove unused interpolation functions: `interpolateHSL()`, `interpolateGradients()` (~50 lines)
  - **KEEP**: `parseHSL()`, `hslToString()` — used by `getChromeColors()` → `adjustLightness()`
  - Add imports from config (~3 lines)
  - Update JSDoc (~5 lines)
  - **Net**: ~135 lines removed, ~8 lines added
- `lib/theme/theme-context.tsx`: 
  - Update line 78: `const minute = 0;` (1 line changed)
  - Update comments (~3 lines changed)
- `__tests__/lib/theme/config.test.ts`: 
  - Add fixed palette tests (~15 lines added)
  - Update existing tests (~5 lines changed)

### Design Rules
- **Keep it simple**: Fixed palettes = simpler code
- **Maintain compatibility**: Keep function signatures the same
- **Documentation**: Update comments to reflect new behavior

## Risks & Edge Cases

1. **Instant Transitions**: Users might notice abrupt color changes
   - **Mitigation**: This is intentional per requirements

2. **Period Boundaries**: Exact boundary times (e.g., exactly 5:00am)
   - **Solution**: Use `>=` and `<` comparisons consistently
   - **Edge case**: Midnight boundary (24:00 / 0:00) - verify `getCurrentPeriod(24)` or `getCurrentPeriod(0)` works correctly

3. **Custom Mode**: Still works but now uses fixed palette
   - **Solution**: No changes needed, behavior is correct

4. **Test Updates**: Need to update expectations
   - **Solution**: Update tests to expect fixed palettes

## Tests

### Test 1: Fixed Palette Per Period (Minutes Ignored)
- **Input**: Hour 6 (dawn period) with different minutes
- **Expected**: Always returns dawn gradient, regardless of minute (minutes completely ignored)
- **Verify**: `getSkyGradient(6, 0)` === `getSkyGradient(6, 30)` === `getSkyGradient(6, 59)` === dawn gradient

### Test 2: Period Boundary Transition
- **Input**: Hour 4.9 (night) vs Hour 5.0 (dawn)
- **Expected**: Different gradients (night vs dawn)
- **Verify**: `getSkyGradient(4.9, 0)` !== `getSkyGradient(5.0, 0)`
- **Note**: CSS transitions (2s ease) provide smooth visual transition between periods

### Test 3: Custom Mode Fixed Palette
- **Input**: Custom mode → golden hour
- **Expected**: Always golden hour gradient, never changes
- **Verify**: Gradient stays constant over time

### Test 4: All Periods Have Fixed Palettes
- **Input**: Test each period's time range
- **Expected**: Same gradient throughout period
- **Verify**: Multiple times within same period return same gradient

### Test 5: Midnight Boundary Edge Case
- **Input**: Hour 23.9 (evening) vs Hour 0.0 (night) - tests wrapping at midnight
- **Expected**: Different gradients (evening vs night)
- **Verify**: `getSkyGradient(23.9, 0)` !== `getSkyGradient(0.0, 0)`
- **Note**: Hours are 0-23, so test 23.9 vs 0.0 (not 24.0)

### Test 6: Same Hour Different Minutes
- **Input**: Hour 6 with minutes 0, 30, 59
- **Expected**: All return same gradient (dawn)
- **Verify**: `getSkyGradient(6, 0)` === `getSkyGradient(6, 30)` === `getSkyGradient(6, 59)`

## Implementation Notes

### Key Changes Summary
1. **CRITICAL**: Remove duplicate gradient definitions from `sky-gradient.ts` (use `GRADIENT_PRESETS` from config)
2. **Remove interpolation logic** from `getSkyGradient()` (~45 lines)
3. **Remove interpolation functions completely**: `interpolateHSL()`, `interpolateGradients()` (~50 lines) - fully replaced, not kept
4. **KEEP helper functions**: `parseHSL()`, `hslToString()` — still used by `getChromeColors()` → `adjustLightness()`
5. **Use fixed period detection** via `getCurrentPeriod()` from config (accepts decimal hours, ignores minutes)
6. **Return fixed gradient** from `GRADIENT_PRESETS` (centralized source)
7. **Update theme context**: Always use `minute = 0`, ignore `actualMinute` completely (line 78)
8. **Update JSDoc** to reflect fixed palette behavior
9. **CSS transitions**: Already implemented in `theme-body.tsx` (2s ease) - provides smooth color changes between periods

### Backward Compatibility
- Function signatures remain the same
- API calls still work
- Only behavior changes (no breaking changes)
- `getChromeColors()` still works (uses `parseHSL()` and `hslToString()` which are kept)

### Important Notes
- **DO NOT REMOVE** `parseHSL()` and `hslToString()` — they're used by `getChromeColors()` → `adjustLightness()`
- **REMOVE COMPLETELY** `interpolateHSL()` and `interpolateGradients()` — fully replaced, not kept for future use
- `getCurrentPeriod()` accepts decimal hours (e.g., 6.5 = 6:30am) but minutes are ignored in period detection
- **CSS Transitions**: Already implemented in `theme-body.tsx` with `transition: 'background 2s ease'` - provides smooth visual transitions between periods automatically
- **Minutes**: Completely ignored throughout the system - not used in any calculations

### Performance Impact
- **Positive**: Simpler code, faster execution (no interpolation calculations)
- **Neutral**: Same update frequency (5 minutes)

## Approval Prompt

**Approve the plan to proceed to BUILD? (Yes / Answer questions / Edit)**

