// __tests__/lib/theme/config.test.ts
// Tests for theme configuration functions

import {
  getCurrentPeriod,
  getEffectiveHourForMode,
  PERIOD_TO_TIME,
  PERIOD_THEMES,
  PERIOD_DISPLAY_NAMES,
  GRADIENT_PRESETS,
  TEXT_COLORS,
} from '@/lib/theme/config';
import { getSkyGradient } from '@/lib/utils/sky-gradient';
import type { ThemeMode, TimePeriod } from '@/lib/theme/types';

describe('getCurrentPeriod', () => {
  it('should return correct period for night (0-5am)', () => {
    expect(getCurrentPeriod(0)).toBe('night');
    expect(getCurrentPeriod(2)).toBe('night');
    expect(getCurrentPeriod(4.9)).toBe('night');
  });

  it('should return correct period for dawn (5-7am)', () => {
    expect(getCurrentPeriod(5)).toBe('dawn');
    expect(getCurrentPeriod(6)).toBe('dawn');
    expect(getCurrentPeriod(6.9)).toBe('dawn');
  });

  it('should return correct period for morning (7-11am)', () => {
    expect(getCurrentPeriod(7)).toBe('morning');
    expect(getCurrentPeriod(9)).toBe('morning');
    expect(getCurrentPeriod(10.9)).toBe('morning');
  });

  it('should return correct period for midday (11am-3pm)', () => {
    expect(getCurrentPeriod(11)).toBe('midday');
    expect(getCurrentPeriod(13)).toBe('midday');
    expect(getCurrentPeriod(14.9)).toBe('midday');
  });

  it('should return correct period for afternoon (3-6pm)', () => {
    expect(getCurrentPeriod(15)).toBe('afternoon');
    expect(getCurrentPeriod(16.5)).toBe('afternoon');
    expect(getCurrentPeriod(17.9)).toBe('afternoon');
  });

  it('should return correct period for golden hour (6-8pm)', () => {
    expect(getCurrentPeriod(18)).toBe('golden');
    expect(getCurrentPeriod(19)).toBe('golden');
    expect(getCurrentPeriod(19.9)).toBe('golden');
  });

  it('should return correct period for dusk (8-10pm)', () => {
    expect(getCurrentPeriod(20)).toBe('dusk');
    expect(getCurrentPeriod(21)).toBe('dusk');
    expect(getCurrentPeriod(21.9)).toBe('dusk');
  });

  it('should return correct period for evening (10pm-midnight)', () => {
    expect(getCurrentPeriod(22)).toBe('evening');
    expect(getCurrentPeriod(23)).toBe('evening');
    expect(getCurrentPeriod(23.9)).toBe('evening');
  });
});

describe('getEffectiveHourForMode', () => {
  describe('cycle mode', () => {
    it('should return actual hour for cycle mode', () => {
      expect(getEffectiveHourForMode('cycle', 10, undefined)).toBe(10);
      expect(getEffectiveHourForMode('cycle', 15.5, undefined)).toBe(15.5);
      expect(getEffectiveHourForMode('cycle', 22, undefined)).toBe(22);
    });
  });

  describe('custom mode', () => {
    it('should return period time for custom mode with period', () => {
      expect(getEffectiveHourForMode('custom', 10, 'golden')).toBe(PERIOD_TO_TIME.golden);
      expect(getEffectiveHourForMode('custom', 10, 'night')).toBe(PERIOD_TO_TIME.night);
      expect(getEffectiveHourForMode('custom', 10, 'dawn')).toBe(PERIOD_TO_TIME.dawn);
    });

    it('should fallback to current period time if no customPeriod provided', () => {
      const hour = 19; // golden hour
      const expectedPeriod = getCurrentPeriod(hour);
      const expectedTime = PERIOD_TO_TIME[expectedPeriod];
      expect(getEffectiveHourForMode('custom', hour, undefined)).toBe(expectedTime);
    });
  });

  describe('dark-cycle mode', () => {
    it('should map day hours to night range', () => {
      // Day hours (6am-8pm) should be mapped to night range (8pm-6am)
      const result = getEffectiveHourForMode('dark-cycle', 12, undefined); // noon
      // Should be mapped to night range
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(24);
      // Should not be in day range (6-20)
      expect(result < 6 || result >= 20).toBe(true);
    });

    it('should keep night hours unchanged', () => {
      const nightHour = 2; // 2am
      const result = getEffectiveHourForMode('dark-cycle', nightHour, undefined);
      expect(result).toBe(nightHour);
    });
  });

  describe('light-cycle mode', () => {
    it('should map night hours to day range', () => {
      // Night hours (8pm-6am) should be mapped to day range (6am-8pm)
      const result = getEffectiveHourForMode('light-cycle', 2, undefined); // 2am
      // Should be mapped to day range
      expect(result).toBeGreaterThanOrEqual(6);
      expect(result).toBeLessThan(20);
    });

    it('should keep day hours unchanged', () => {
      const dayHour = 12; // noon
      const result = getEffectiveHourForMode('light-cycle', dayHour, undefined);
      expect(result).toBe(dayHour);
    });
  });
});

describe('PERIOD_TO_TIME', () => {
  it('should have all periods mapped', () => {
    const periods: TimePeriod[] = ['night', 'dawn', 'morning', 'midday', 'afternoon', 'golden', 'dusk', 'evening'];
    periods.forEach(period => {
      expect(PERIOD_TO_TIME[period]).toBeDefined();
      expect(typeof PERIOD_TO_TIME[period]).toBe('number');
      expect(PERIOD_TO_TIME[period]).toBeGreaterThanOrEqual(0);
      expect(PERIOD_TO_TIME[period]).toBeLessThan(24);
    });
  });

  it('should have golden hour at expected time', () => {
    expect(PERIOD_TO_TIME.golden).toBe(19); // 7pm
  });
});

describe('PERIOD_THEMES', () => {
  it('should have dark theme for night and evening', () => {
    expect(PERIOD_THEMES.night).toBe('dark');
    expect(PERIOD_THEMES.evening).toBe('dark');
  });

  it('should have light theme for day periods', () => {
    expect(PERIOD_THEMES.dawn).toBe('light');
    expect(PERIOD_THEMES.morning).toBe('light');
    expect(PERIOD_THEMES.midday).toBe('light');
    expect(PERIOD_THEMES.afternoon).toBe('light');
    expect(PERIOD_THEMES.golden).toBe('light');
    expect(PERIOD_THEMES.dusk).toBe('light');
  });
});

describe('PERIOD_DISPLAY_NAMES', () => {
  it('should have user-friendly names for all periods', () => {
    expect(PERIOD_DISPLAY_NAMES.night).toBe('Night');
    expect(PERIOD_DISPLAY_NAMES.dawn).toBe('Dawn');
    expect(PERIOD_DISPLAY_NAMES.morning).toBe('Morning');
    expect(PERIOD_DISPLAY_NAMES.midday).toBe('Midday');
    expect(PERIOD_DISPLAY_NAMES.afternoon).toBe('Afternoon');
    expect(PERIOD_DISPLAY_NAMES.golden).toBe('Golden Hour');
    expect(PERIOD_DISPLAY_NAMES.dusk).toBe('Dusk');
    expect(PERIOD_DISPLAY_NAMES.evening).toBe('Evening');
  });
});

describe('GRADIENT_PRESETS', () => {
  it('should have gradient definitions for all periods', () => {
    const periods: TimePeriod[] = ['night', 'dawn', 'morning', 'midday', 'afternoon', 'golden', 'dusk', 'evening'];
    periods.forEach(period => {
      expect(GRADIENT_PRESETS[period]).toBeDefined();
      expect(GRADIENT_PRESETS[period]).toHaveProperty('start');
      expect(GRADIENT_PRESETS[period]).toHaveProperty('end');
      expect(GRADIENT_PRESETS[period].start).toMatch(/^hsl\(/);
      expect(GRADIENT_PRESETS[period].end).toMatch(/^hsl\(/);
    });
  });
});

describe('TEXT_COLORS', () => {
  it('should have colors for light and dark themes', () => {
    expect(TEXT_COLORS.light).toBe('#1a1a1a');
    expect(TEXT_COLORS.dark).toBe('#e8e8e8');
  });
});

describe('getSkyGradient - Fixed Palette Behavior', () => {
  describe('same hour returns same gradient regardless of minutes', () => {
    it('should return same gradient for hour 6 with different minutes (dawn period)', () => {
      const gradient1 = getSkyGradient(6, 0);
      const gradient2 = getSkyGradient(6, 30);
      const gradient3 = getSkyGradient(6, 59);
      
      expect(gradient1).toEqual(gradient2);
      expect(gradient2).toEqual(gradient3);
      expect(gradient1.start).toBe(gradient2.start);
      expect(gradient1.end).toBe(gradient2.end);
    });

    it('should return same gradient for hour 12 with different minutes (midday period)', () => {
      const gradient1 = getSkyGradient(12, 0);
      const gradient2 = getSkyGradient(12, 30);
      const gradient3 = getSkyGradient(12, 59);
      
      expect(gradient1).toEqual(gradient2);
      expect(gradient2).toEqual(gradient3);
    });

    it('should return same gradient for hour 19 with different minutes (golden period)', () => {
      const gradient1 = getSkyGradient(19, 0);
      const gradient2 = getSkyGradient(19, 30);
      const gradient3 = getSkyGradient(19, 59);
      
      expect(gradient1).toEqual(gradient2);
      expect(gradient2).toEqual(gradient3);
    });
  });

  describe('period boundary transitions', () => {
    it('should return different gradients at period boundaries', () => {
      // Night (4.9) vs Dawn (5.0)
      const nightGradient = getSkyGradient(4, 54); // 4:54am = 4.9 hours
      const dawnGradient = getSkyGradient(5, 0); // 5:00am = 5.0 hours
      
      expect(nightGradient).not.toEqual(dawnGradient);
      expect(nightGradient.start).not.toBe(dawnGradient.start);
    });

    it('should return correct gradient for each period', () => {
      // Test each period's time range
      expect(getSkyGradient(2, 0).start).toBe(GRADIENT_PRESETS.night.start); // Night
      expect(getSkyGradient(6, 0).start).toBe(GRADIENT_PRESETS.dawn.start); // Dawn
      expect(getSkyGradient(9, 0).start).toBe(GRADIENT_PRESETS.morning.start); // Morning
      expect(getSkyGradient(13, 0).start).toBe(GRADIENT_PRESETS.midday.start); // Midday
      expect(getSkyGradient(16, 0).start).toBe(GRADIENT_PRESETS.afternoon.start); // Afternoon
      expect(getSkyGradient(19, 0).start).toBe(GRADIENT_PRESETS.golden.start); // Golden
      expect(getSkyGradient(21, 0).start).toBe(GRADIENT_PRESETS.dusk.start); // Dusk
      expect(getSkyGradient(23, 0).start).toBe(GRADIENT_PRESETS.evening.start); // Evening
    });
  });

  describe('midnight boundary edge case', () => {
    it('should handle midnight boundary correctly (evening vs night)', () => {
      // Evening (23.9) vs Night (0.0) - tests wrapping at midnight
      const eveningGradient = getSkyGradient(23, 54); // 23:54 = 23.9 hours
      const nightGradient = getSkyGradient(0, 0); // 0:00 = 0.0 hours
      
      expect(eveningGradient).not.toEqual(nightGradient);
      expect(eveningGradient.start).toBe(GRADIENT_PRESETS.evening.start);
      expect(nightGradient.start).toBe(GRADIENT_PRESETS.night.start);
    });

    it('should return night gradient at midnight (0:00)', () => {
      const gradient = getSkyGradient(0, 0);
      expect(gradient.start).toBe(GRADIENT_PRESETS.night.start);
      expect(gradient.end).toBe(GRADIENT_PRESETS.night.end);
    });

    it('should return evening gradient just before midnight (23:59)', () => {
      const gradient = getSkyGradient(23, 59);
      expect(gradient.start).toBe(GRADIENT_PRESETS.evening.start);
      expect(gradient.end).toBe(GRADIENT_PRESETS.evening.end);
    });
  });

  describe('fixed palette consistency', () => {
    it('should return same gradient throughout a period', () => {
      // Test dawn period (5-7am) - multiple times should return same gradient
      const gradient1 = getSkyGradient(5, 0);
      const gradient2 = getSkyGradient(5, 30);
      const gradient3 = getSkyGradient(6, 0);
      const gradient4 = getSkyGradient(6, 59);
      
      // All should be dawn gradient
      expect(gradient1.start).toBe(GRADIENT_PRESETS.dawn.start);
      expect(gradient2.start).toBe(GRADIENT_PRESETS.dawn.start);
      expect(gradient3.start).toBe(GRADIENT_PRESETS.dawn.start);
      expect(gradient4.start).toBe(GRADIENT_PRESETS.dawn.start);
      
      expect(gradient1).toEqual(gradient2);
      expect(gradient2).toEqual(gradient3);
      expect(gradient3).toEqual(gradient4);
    });
  });
});

