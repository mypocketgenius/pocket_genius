'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '@/lib/theme/theme-context';
import { getPillColors } from '@/lib/theme/pill-colors';
import { getFilterPillStyles } from '@/lib/theme/pill-styles';
import { getCurrentPeriod } from '@/lib/theme/config';

/**
 * HomepageFilterPills Component
 * 
 * Displays theme-aware filter pills for category filtering on the homepage.
 * Shows first 6 pills by default, with expand/collapse functionality to show more.
 * 
 * Uses theme-aware colors that adapt throughout the day:
 * - Unselected: Secondary accent at 15% opacity
 * - Selected: Secondary accent at 30% opacity + 1px border + font weight 600
 * 
 * Categories: All, Strategy, Leadership, Marketing, Personal Growth, Business, Creativity, Philosophy
 * 
 * @component
 */
export function HomepageFilterPills() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const theme = useTheme();
  
  // Get current period for color generation
  const now = new Date();
  const period = getCurrentPeriod(now.getHours());
  
  // Get pill colors for current theme
  const pillColors = getPillColors(theme.gradient, theme.textColor, period, theme.theme);

  // Category list (no longer needs color assignments - using theme-aware styles)
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
        const styles = getFilterPillStyles(pillColors, isSelected, theme.theme, period);
        
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

