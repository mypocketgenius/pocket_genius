# Theme System Tests

## Test Files

### ✅ `config.test.ts` - PASSING
Tests for theme configuration functions:
- `getCurrentPeriod()` - Period detection based on hour
- `getEffectiveHourForMode()` - Theme mode logic (cycle, custom, dark-cycle, light-cycle)
- Constants validation (PERIOD_TO_TIME, PERIOD_THEMES, PERIOD_DISPLAY_NAMES, GRADIENT_PRESETS, TEXT_COLORS)

**Status:** ✅ All 22 tests passing

### ⚠️ `theme-context.test.ts` - Needs jsdom environment
Tests for theme context provider:
- localStorage persistence
- Theme mode changes
- Custom period selection
- Gradient calculation
- Theme (light/dark) calculation
- Chrome colors calculation

**Status:** ⚠️ Requires jsdom test environment to run

## Running Tests

### Run all theme tests:
```bash
npm test -- __tests__/lib/theme
```

### Run config tests only:
```bash
npm test -- __tests__/lib/theme/config.test.ts
```

### Run context tests (requires jsdom):
```bash
npm test -- __tests__/lib/theme/theme-context.test.ts
```

## Test Coverage

Based on the plan (lines 559-593), we need to test:

1. ✅ **Theme Mode Selection** - Tested in config.test.ts (getEffectiveHourForMode)
2. ✅ **Custom Mode Lock** - Tested in config.test.ts (custom mode with period)
3. ✅ **Persistence** - Tested in theme-context.test.ts (localStorage)
4. ⚠️ **Cycle Mode Updates** - Needs integration test (5-minute interval)
5. ⚠️ **Settings Modal** - Needs component test (React Testing Library)
6. ⚠️ **Period Preview Display** - Needs component test (React Testing Library)

## Next Steps

1. Update jest.config.js to support jsdom for React tests
2. Create component tests for ThemeSettings component
3. Create integration tests for theme updates (5-minute interval)
4. Add E2E tests for full user flow

