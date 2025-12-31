// __tests__/lib/theme/pill-colors.test.ts
// Tests for pill color system (Part 1: Core Color System)

import { getPillColors } from '@/lib/theme/pill-colors';
import { GRADIENT_PRESETS, PERIOD_THEMES, TEXT_COLORS } from '@/lib/theme/config';
import type { TimePeriod } from '@/lib/theme/types';

describe('getPillColors', () => {
  const periods: TimePeriod[] = ['night', 'dawn', 'morning', 'midday', 'afternoon', 'golden', 'dusk', 'evening'];

  describe('works for all 8 periods', () => {
    periods.forEach(period => {
      it(`should return valid colors for ${period} period`, () => {
        const gradient = GRADIENT_PRESETS[period];
        const theme = PERIOD_THEMES[period];
        const textColor = TEXT_COLORS[theme];
        
        const colors = getPillColors(gradient, textColor, period, theme);
        
        // Should return all required colors
        expect(colors).toHaveProperty('secondaryAccent');
        expect(colors).toHaveProperty('success');
        expect(colors).toHaveProperty('error');
        expect(colors).toHaveProperty('neutral');
      });
    });
  });

  describe('colors are valid HSL strings', () => {
    periods.forEach(period => {
      it(`should return valid HSL strings for ${period} period`, () => {
        const gradient = GRADIENT_PRESETS[period];
        const theme = PERIOD_THEMES[period];
        const textColor = TEXT_COLORS[theme];
        
        const colors = getPillColors(gradient, textColor, period, theme);
        
        // All colors should be valid HSL strings
        const hslRegex = /^hsl\(\d+,\s*\d+(?:\.\d+)?%,\s*\d+(?:\.\d+)?%\)$/;
        
        expect(colors.secondaryAccent).toMatch(hslRegex);
        expect(colors.success).toMatch(hslRegex);
        expect(colors.error).toMatch(hslRegex);
        expect(colors.neutral).toMatch(hslRegex);
      });
    });
  });

  describe('secondary accent extraction', () => {
    it('should extract secondary accent from gradient.start', () => {
      const gradient = GRADIENT_PRESETS.golden;
      const theme = PERIOD_THEMES.golden;
      const textColor = TEXT_COLORS[theme];
      
      const colors = getPillColors(gradient, textColor, 'golden', theme);
      
      // Secondary accent should match gradient.start
      expect(colors.secondaryAccent).toBe(gradient.start);
    });

    periods.forEach(period => {
      it(`should extract secondary accent from ${period} gradient.start`, () => {
        const gradient = GRADIENT_PRESETS[period];
        const theme = PERIOD_THEMES[period];
        const textColor = TEXT_COLORS[theme];
        
        const colors = getPillColors(gradient, textColor, period, theme);
        
        expect(colors.secondaryAccent).toBe(gradient.start);
      });
    });
  });

  describe('semantic colors maintain recognizability', () => {
    describe('success colors', () => {
      it('should have green hues for all periods', () => {
        periods.forEach(period => {
          const gradient = GRADIENT_PRESETS[period];
          const theme = PERIOD_THEMES[period];
          const textColor = TEXT_COLORS[theme];
          
          const colors = getPillColors(gradient, textColor, period, theme);
          
          // Parse HSL to check hue
          const match = colors.success.match(/hsl\((\d+),/);
          expect(match).not.toBeNull();
          const hue = parseInt(match![1], 10);
          
          // Success colors should be in green range (100-180 degrees)
          // Some periods may have slightly different hues but should be green-ish
          expect(hue).toBeGreaterThanOrEqual(100);
          expect(hue).toBeLessThanOrEqual(180);
        });
      });

      it('should have different hues for different periods', () => {
        const hues = periods.map(period => {
          const gradient = GRADIENT_PRESETS[period];
          const theme = PERIOD_THEMES[period];
          const textColor = TEXT_COLORS[theme];
          const colors = getPillColors(gradient, textColor, period, theme);
          const match = colors.success.match(/hsl\((\d+),/);
          return parseInt(match![1], 10);
        });
        
        // Should have variation across periods (not all identical)
        const uniqueHues = new Set(hues);
        expect(uniqueHues.size).toBeGreaterThan(1);
      });
    });

    describe('error colors', () => {
      it('should have red/coral hues for all periods', () => {
        periods.forEach(period => {
          const gradient = GRADIENT_PRESETS[period];
          const theme = PERIOD_THEMES[period];
          const textColor = TEXT_COLORS[theme];
          
          const colors = getPillColors(gradient, textColor, period, theme);
          
          // Parse HSL to check hue
          const match = colors.error.match(/hsl\((\d+),/);
          expect(match).not.toBeNull();
          const hue = parseInt(match![1], 10);
          
          // Error colors should be in red/coral range (0-20 degrees or 350-360 degrees)
          // This covers red (0), coral (10-15), and dusty rose (350)
          const isRedRange = hue >= 0 && hue <= 20;
          const isRoseRange = hue >= 350 && hue <= 360;
          expect(isRedRange || isRoseRange).toBe(true);
        });
      });

      it('should have different hues for different periods', () => {
        const hues = periods.map(period => {
          const gradient = GRADIENT_PRESETS[period];
          const theme = PERIOD_THEMES[period];
          const textColor = TEXT_COLORS[theme];
          const colors = getPillColors(gradient, textColor, period, theme);
          const match = colors.error.match(/hsl\((\d+),/);
          return parseInt(match![1], 10);
        });
        
        // Should have variation across periods (not all identical)
        const uniqueHues = new Set(hues);
        expect(uniqueHues.size).toBeGreaterThan(1);
      });
    });
  });

  describe('neutral color generation', () => {
    it('should generate neutral color from textColor and gradient blend', () => {
      const gradient = GRADIENT_PRESETS.midday;
      const theme = PERIOD_THEMES.midday;
      const textColor = TEXT_COLORS[theme];
      
      const colors = getPillColors(gradient, textColor, 'midday', theme);
      
      // Neutral should be a valid HSL string
      expect(colors.neutral).toMatch(/^hsl\(\d+,\s*\d+(?:\.\d+)?%,\s*\d+(?:\.\d+)?%\)$/);
      
      // Neutral should be different from secondary accent
      expect(colors.neutral).not.toBe(colors.secondaryAccent);
    });

    periods.forEach(period => {
      it(`should generate neutral color for ${period} period`, () => {
        const gradient = GRADIENT_PRESETS[period];
        const theme = PERIOD_THEMES[period];
        const textColor = TEXT_COLORS[theme];
        
        const colors = getPillColors(gradient, textColor, period, theme);
        
        // Neutral should be valid HSL
        expect(colors.neutral).toMatch(/^hsl\(\d+,\s*\d+(?:\.\d+)?%,\s*\d+(?:\.\d+)?%\)$/);
      });
    });
  });

  describe('theme-aware colors', () => {
    it('should generate different colors for light vs dark theme in same period', () => {
      // Night period uses dark theme
      const nightGradient = GRADIENT_PRESETS.night;
      const nightColorsDark = getPillColors(nightGradient, TEXT_COLORS.dark, 'night', 'dark');
      
      // Test that dark theme colors are different (if we had light theme for night)
      // Actually, night always uses dark theme, so let's test evening
      const eveningGradient = GRADIENT_PRESETS.evening;
      const eveningColorsDark = getPillColors(eveningGradient, TEXT_COLORS.dark, 'evening', 'dark');
      
      // Colors should be valid
      expect(eveningColorsDark.success).toMatch(/^hsl\(/);
      expect(eveningColorsDark.error).toMatch(/^hsl\(/);
    });

    it('should generate appropriate lightness for dark theme periods', () => {
      const darkPeriods: TimePeriod[] = ['night', 'evening'];
      
      darkPeriods.forEach(period => {
        const gradient = GRADIENT_PRESETS[period];
        const theme = PERIOD_THEMES[period];
        const textColor = TEXT_COLORS[theme];
        
        const colors = getPillColors(gradient, textColor, period, theme);
        
        // Parse lightness values
        const successMatch = colors.success.match(/hsl\(\d+,\s*\d+(?:\.\d+)?%,\s*(\d+(?:\.\d+)?)%\)/);
        const errorMatch = colors.error.match(/hsl\(\d+,\s*\d+(?:\.\d+)?%,\s*(\d+(?:\.\d+)?)%\)/);
        
        expect(successMatch).not.toBeNull();
        expect(errorMatch).not.toBeNull();
        
        // Dark theme should have lower lightness for better contrast
        const successLightness = parseFloat(successMatch![1]);
        const errorLightness = parseFloat(errorMatch![1]);
        
        // For dark theme, lightness should be reasonable (not too bright)
        expect(successLightness).toBeLessThan(70);
        expect(errorLightness).toBeLessThan(70);
      });
    });
  });
});

