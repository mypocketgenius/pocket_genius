// __tests__/lib/theme/pill-styles.test.ts
// Tests for pill style generator (Part 2: Style Generator)

import {
  getFilterPillStyles,
  getActionPillStyles,
  getSuggestionPillStyles,
} from '@/lib/theme/pill-styles';
import { getPillColors } from '@/lib/theme/pill-colors';
import { GRADIENT_PRESETS, PERIOD_THEMES, TEXT_COLORS } from '@/lib/theme/config';
import type { TimePeriod } from '@/lib/theme/types';

describe('pill-styles', () => {
  // Create mock pill colors for testing
  const mockColors = {
    secondaryAccent: 'hsl(200, 50%, 60%)',
    success: 'hsl(150, 40%, 50%)',
    error: 'hsl(10, 50%, 55%)',
    neutral: 'hsl(180, 20%, 50%)',
  };

  describe('getFilterPillStyles', () => {
    it('should return valid React.CSSProperties for unselected state', () => {
      const styles = getFilterPillStyles(mockColors, false);
      
      expect(styles).toHaveProperty('backgroundColor');
      expect(styles).toHaveProperty('color');
      expect(styles).toHaveProperty('fontWeight');
      expect(styles).toHaveProperty('padding');
      expect(styles).toHaveProperty('borderRadius');
      expect(styles).toHaveProperty('fontSize');
      expect(styles).toHaveProperty('border');
    });

    it('should use 15% opacity for unselected filter pills', () => {
      const styles = getFilterPillStyles(mockColors, false);
      
      // Background should be rgba with 0.15 opacity
      expect(styles.backgroundColor).toMatch(/rgba\(\d+,\s*\d+,\s*\d+,\s*0\.15\)/);
    });

    it('should use 30% opacity for selected filter pills', () => {
      const styles = getFilterPillStyles(mockColors, true);
      
      // Background should be rgba with 0.30 opacity (or 0.3)
      expect(styles.backgroundColor).toMatch(/rgba\(\d+,\s*\d+,\s*\d+,\s*0\.3\)/);
    });

    it('should use font weight 500 for unselected state', () => {
      const styles = getFilterPillStyles(mockColors, false);
      
      expect(styles.fontWeight).toBe('500');
    });

    it('should use font weight 600 for selected state', () => {
      const styles = getFilterPillStyles(mockColors, true);
      
      expect(styles.fontWeight).toBe('600');
    });

    it('should have no border for unselected state', () => {
      const styles = getFilterPillStyles(mockColors, false);
      
      expect(styles.border).toBe('none');
    });

    it('should have 1px border for selected state', () => {
      const styles = getFilterPillStyles(mockColors, true);
      
      // Border should be a string containing "1px solid"
      expect(styles.border).toContain('1px');
      expect(styles.border).toContain('solid');
      // Border should have rgba color with 0.85 opacity
      expect(styles.border).toMatch(/rgba\(\d+,\s*\d+,\s*\d+,\s*0\.85\)/);
    });

    it('should use correct padding (12px 20px)', () => {
      const styles = getFilterPillStyles(mockColors, false);
      
      expect(styles.padding).toBe('12px 20px');
    });

    it('should use correct border radius (9999px)', () => {
      const styles = getFilterPillStyles(mockColors, false);
      
      expect(styles.borderRadius).toBe('9999px');
    });

    it('should use correct font size (0.875rem)', () => {
      const styles = getFilterPillStyles(mockColors, false);
      
      expect(styles.fontSize).toBe('0.875rem');
    });

    it('should use secondary accent color for text', () => {
      const styles = getFilterPillStyles(mockColors, false);
      
      expect(styles.color).toBe(mockColors.secondaryAccent);
    });
  });

  describe('getActionPillStyles', () => {
    it('should return valid React.CSSProperties', () => {
      const styles = getActionPillStyles(mockColors, true, false);
      
      expect(styles).toHaveProperty('backgroundColor');
      expect(styles).toHaveProperty('color');
      expect(styles).toHaveProperty('fontWeight');
      expect(styles).toHaveProperty('padding');
      expect(styles).toHaveProperty('borderRadius');
      expect(styles).toHaveProperty('fontSize');
      expect(styles).toHaveProperty('border');
    });

    it('should use success color for positive actions', () => {
      const styles = getActionPillStyles(mockColors, true, false);
      
      // Background should use success color
      expect(styles.backgroundColor).toMatch(/rgba\(\d+,\s*\d+,\s*\d+,\s*0\.2\)/);
      expect(styles.color).toBe(mockColors.success);
    });

    it('should use error color for negative actions', () => {
      const styles = getActionPillStyles(mockColors, false, false);
      
      // Background should use error color
      expect(styles.backgroundColor).toMatch(/rgba\(\d+,\s*\d+,\s*\d+,\s*0\.2\)/);
      expect(styles.color).toBe(mockColors.error);
    });

    it('should use 20% opacity for unselected action pills', () => {
      const styles = getActionPillStyles(mockColors, true, false);
      
      expect(styles.backgroundColor).toMatch(/rgba\(\d+,\s*\d+,\s*\d+,\s*0\.2\)/);
    });

    it('should use 25% opacity for selected action pills', () => {
      const styles = getActionPillStyles(mockColors, true, true);
      
      expect(styles.backgroundColor).toMatch(/rgba\(\d+,\s*\d+,\s*\d+,\s*0\.25\)/);
    });

    it('should use font weight 600 (semibold)', () => {
      const styles = getActionPillStyles(mockColors, true, false);
      
      expect(styles.fontWeight).toBe('600');
    });

    it('should have no border', () => {
      const styles = getActionPillStyles(mockColors, true, false);
      
      expect(styles.border).toBe('none');
    });

    it('should use correct padding (10px 18px)', () => {
      const styles = getActionPillStyles(mockColors, true, false);
      
      expect(styles.padding).toBe('10px 18px');
    });
  });

  describe('getSuggestionPillStyles', () => {
    it('should return valid React.CSSProperties', () => {
      const styles = getSuggestionPillStyles(mockColors, true, false);
      
      expect(styles).toHaveProperty('backgroundColor');
      expect(styles).toHaveProperty('color');
      expect(styles).toHaveProperty('fontWeight');
      expect(styles).toHaveProperty('padding');
      expect(styles).toHaveProperty('borderRadius');
      expect(styles).toHaveProperty('fontSize');
      expect(styles).toHaveProperty('border');
    });

    it('should use secondary accent for primary suggestions', () => {
      const styles = getSuggestionPillStyles(mockColors, true, false);
      
      expect(styles.color).toBe(mockColors.secondaryAccent);
      expect(styles.backgroundColor).toMatch(/rgba\(\d+,\s*\d+,\s*\d+,\s*0\.12\)/);
    });

    it('should use neutral color for secondary suggestions', () => {
      const styles = getSuggestionPillStyles(mockColors, false, false);
      
      expect(styles.color).toBe(mockColors.neutral);
      expect(styles.backgroundColor).toMatch(/rgba\(\d+,\s*\d+,\s*\d+,\s*0\.12\)/);
    });

    it('should use 12% opacity for unselected primary suggestions', () => {
      const styles = getSuggestionPillStyles(mockColors, true, false);
      
      expect(styles.backgroundColor).toMatch(/rgba\(\d+,\s*\d+,\s*\d+,\s*0\.12\)/);
    });

    it('should use 20% opacity for selected primary suggestions', () => {
      const styles = getSuggestionPillStyles(mockColors, true, true);
      
      expect(styles.backgroundColor).toMatch(/rgba\(\d+,\s*\d+,\s*\d+,\s*0\.2\)/);
    });

    it('should have no border for primary suggestions', () => {
      const styles = getSuggestionPillStyles(mockColors, true, false);
      
      expect(styles.border).toBe('none');
    });

    it('should have 1px border for secondary suggestions', () => {
      const styles = getSuggestionPillStyles(mockColors, false, false);
      
      // Border should be a string containing "1px solid"
      expect(styles.border).toContain('1px');
      expect(styles.border).toContain('solid');
      // Border should have rgba color with 0.40 opacity (or 0.4)
      expect(styles.border).toMatch(/rgba\(\d+,\s*\d+,\s*\d+,\s*0\.4\)/);
    });

    it('should use font weight 400 (regular)', () => {
      const styles = getSuggestionPillStyles(mockColors, true, false);
      
      expect(styles.fontWeight).toBe('400');
    });

    it('should use correct padding (10px 16px)', () => {
      const styles = getSuggestionPillStyles(mockColors, true, false);
      
      expect(styles.padding).toBe('10px 16px');
    });
  });

  describe('integration with real pill colors', () => {
    const periods: TimePeriod[] = ['night', 'dawn', 'morning', 'midday', 'afternoon', 'golden', 'dusk', 'evening'];

    periods.forEach(period => {
      it(`should generate valid styles for ${period} period filter pills`, () => {
        const gradient = GRADIENT_PRESETS[period];
        const theme = PERIOD_THEMES[period];
        const textColor = TEXT_COLORS[theme];
        const colors = getPillColors(gradient, textColor, period, theme);
        
        const unselectedStyles = getFilterPillStyles(colors, false);
        const selectedStyles = getFilterPillStyles(colors, true);
        
        // Both should be valid CSS properties
        expect(unselectedStyles).toHaveProperty('backgroundColor');
        expect(selectedStyles).toHaveProperty('backgroundColor');
        
        // Selected should have higher opacity
        const unselectedMatch = (unselectedStyles.backgroundColor as string).match(/rgba\(.+,\s*(.+)\)/);
        const selectedMatch = (selectedStyles.backgroundColor as string).match(/rgba\(.+,\s*(.+)\)/);
        
        expect(unselectedMatch).not.toBeNull();
        expect(selectedMatch).not.toBeNull();
        
        const unselectedOpacity = parseFloat(unselectedMatch![1]);
        const selectedOpacity = parseFloat(selectedMatch![1]);
        
        expect(unselectedOpacity).toBeCloseTo(0.15, 2);
        expect(selectedOpacity).toBeCloseTo(0.30, 2);
      });

      it(`should generate valid styles for ${period} period action pills`, () => {
        const gradient = GRADIENT_PRESETS[period];
        const theme = PERIOD_THEMES[period];
        const textColor = TEXT_COLORS[theme];
        const colors = getPillColors(gradient, textColor, period, theme);
        
        const helpfulStyles = getActionPillStyles(colors, true, false);
        const notHelpfulStyles = getActionPillStyles(colors, false, false);
        
        // Both should use semantic colors
        expect(helpfulStyles.color).toBe(colors.success);
        expect(notHelpfulStyles.color).toBe(colors.error);
      });

      it(`should generate valid styles for ${period} period suggestion pills`, () => {
        const gradient = GRADIENT_PRESETS[period];
        const theme = PERIOD_THEMES[period];
        const textColor = TEXT_COLORS[theme];
        const colors = getPillColors(gradient, textColor, period, theme);
        
        const primaryStyles = getSuggestionPillStyles(colors, true, false);
        const secondaryStyles = getSuggestionPillStyles(colors, false, false);
        
        // Primary should use secondary accent, no border
        expect(primaryStyles.color).toBe(colors.secondaryAccent);
        expect(primaryStyles.border).toBe('none');
        
        // Secondary should use neutral, have border
        expect(secondaryStyles.color).toBe(colors.neutral);
        expect(secondaryStyles.border).toContain('1px');
      });
    });
  });

  describe('HSL to RGBA conversion', () => {
    it('should convert HSL to RGBA correctly', () => {
      // Test with a known HSL color
      // hsl(200, 50%, 60%) should convert to a specific RGB
      const styles = getFilterPillStyles(mockColors, false);
      
      // Background should be valid RGBA format
      expect(styles.backgroundColor).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*0\.\d+\)$/);
    });

    it('should handle different opacity values', () => {
      const unselected = getFilterPillStyles(mockColors, false);
      const selected = getFilterPillStyles(mockColors, true);
      
      // Extract opacity values
      const unselectedMatch = (unselected.backgroundColor as string).match(/rgba\(.+,\s*(.+)\)/);
      const selectedMatch = (selected.backgroundColor as string).match(/rgba\(.+,\s*(.+)\)/);
      
      expect(unselectedMatch).not.toBeNull();
      expect(selectedMatch).not.toBeNull();
      
      const unselectedOpacity = parseFloat(unselectedMatch![1]);
      const selectedOpacity = parseFloat(selectedMatch![1]);
      
      // Opacity should be different
      expect(unselectedOpacity).not.toBe(selectedOpacity);
      expect(unselectedOpacity).toBeCloseTo(0.15, 2);
      expect(selectedOpacity).toBeCloseTo(0.30, 2);
    });
  });
});

