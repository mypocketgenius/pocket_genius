'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { useTheme } from '../lib/theme/theme-context';
import type { ThemeMode, TimePeriod } from '../lib/theme/types';
import {
  PERIOD_DISPLAY_NAMES,
  PERIOD_ORDER,
  GRADIENT_PRESETS,
  PERIOD_THEMES,
  TEXT_COLORS,
  PERIOD_TIME_RANGES,
  getCurrentPeriod,
} from '../lib/theme/config';
import { cn } from '../lib/utils';
import { RotateCw, Moon, Sun, Check } from 'lucide-react';

interface ThemeSettingsProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Theme Settings Component
 * 
 * Allows users to select their preferred theme mode:
 * - cycle: Full 24-hour cycle
 * - dark-cycle: Cycle through dark periods only (night, evening)
 * - light-cycle: Cycle through light periods only (dawn through dusk)
 * 
 * Users can also select a specific time period to lock the theme to that period.
 * Period selection is always available and works independently of mode selection.
 * Each period displays the actual gradient background with correct text color.
 */
export function ThemeSettings({ open, onClose }: ThemeSettingsProps) {
  const theme = useTheme();
  
  // Local state for form (not applied until Save is clicked)
  const [selectedMode, setSelectedMode] = useState<ThemeMode>(theme.mode);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod | undefined>(theme.customPeriod);
  
  // Update local state when theme changes or modal opens
  useEffect(() => {
    if (open) {
      // If theme has customPeriod, treat it as if a period is selected
      // Otherwise use the current mode
      if (theme.customPeriod) {
        setSelectedMode('cycle'); // Default mode when period is selected
        setSelectedPeriod(theme.customPeriod);
      } else {
        setSelectedMode(theme.mode);
        setSelectedPeriod(undefined);
      }
    }
  }, [open, theme.mode, theme.customPeriod]);
  
  /**
   * Handles saving theme settings
   * Applies the selected mode and period to the theme context
   * If a period is selected, it locks to that period (custom behavior)
   */
  function handleSave() {
    if (selectedPeriod) {
      // Period selected = lock to that period (custom mode)
      theme.setCustomPeriod(selectedPeriod);
    } else {
      // No period selected = use the selected mode
      // setMode automatically clears customPeriod when mode is not 'custom'
      theme.setMode(selectedMode);
    }
    onClose();
  }
  
  /**
   * Handles cancel - closes modal without saving
   */
  function handleCancel() {
    // Reset to current theme values
    // If customPeriod exists, treat it as period selected with cycle mode
    if (theme.customPeriod) {
      setSelectedMode('cycle');
      setSelectedPeriod(theme.customPeriod);
    } else {
      setSelectedMode(theme.mode);
      setSelectedPeriod(undefined);
    }
    onClose();
  }
  
  // Get periods for each mode to show visual previews
  const getModePeriods = (mode: ThemeMode): TimePeriod[] => {
    switch (mode) {
      case 'cycle':
        return PERIOD_ORDER; // All periods
      case 'dark-cycle':
        return ['night', 'evening']; // Dark periods only
      case 'light-cycle':
        return ['dawn', 'morning', 'midday', 'afternoon', 'golden', 'dusk']; // Light periods only
      case 'custom':
        return PERIOD_ORDER; // All available for selection
      default:
        return [];
    }
  };

  // Theme mode options with visual previews
  const modeOptions: { 
    value: ThemeMode; 
    label: string; 
    description: string;
    icon: React.ReactNode;
    colSpan?: number; // For layout control
  }[] = [
    { 
      value: 'cycle', 
      label: 'Full Cycle', 
      description: 'Full 24-hour cycle',
      icon: <RotateCw className="w-5 h-5" />,
      colSpan: 2 // Spans both columns
    },
    { 
      value: 'dark-cycle', 
      label: 'Dark Mode Cycle', 
      description: 'Dark periods only',
      icon: <Moon className="w-5 h-5" />
    },
    { 
      value: 'light-cycle', 
      label: 'Light Mode Cycle', 
      description: 'Light periods only',
      icon: <Sun className="w-5 h-5" />
    },
  ];

  /**
   * Formats time range for display (e.g., "6am - 8am")
   */
  function formatTimeRange(period: TimePeriod): string {
    const range = PERIOD_TIME_RANGES[period];
    const formatHour = (hour: number) => {
      if (hour === 0) return '12am';
      if (hour < 12) return `${hour}am`;
      if (hour === 12) return '12pm';
      return `${hour - 12}pm`;
    };
    return `${formatHour(range.start)} - ${formatHour(range.end)}`;
  }
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Theme Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Combined Visual Layout */}
          <div className="space-y-4">
            {/* Cycle Mode Selection - Visual Cards */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Cycle Mode</h3>
              <div className="grid grid-cols-2 gap-3">
                {modeOptions.map((option) => {
                  // Selected if mode matches AND no period is selected
                  const isSelected = selectedMode === option.value && !selectedPeriod;
                  const modePeriods = getModePeriods(option.value);
                  
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setSelectedMode(option.value);
                        // Clear period selection when selecting a mode
                        setSelectedPeriod(undefined);
                      }}
                      className={cn(
                        'group relative p-4 rounded-xl border-2 transition-all duration-200',
                        'hover:shadow-lg hover:scale-[1.02] overflow-hidden',
                        option.colSpan === 2 && 'col-span-2',
                        isSelected
                          ? 'border-blue-500 ring-2 ring-blue-200 shadow-md'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      {/* Visual Preview Strip */}
                      <div className="flex h-12 mb-3 rounded-lg overflow-hidden shadow-sm">
                        {modePeriods.slice(0, option.colSpan === 2 ? 8 : 6).map((period, idx) => {
                          const gradient = GRADIENT_PRESETS[period];
                          return (
                            <div
                              key={`${option.value}-${period}-${idx}`}
                              className="flex-1"
                              style={{
                                background: `linear-gradient(135deg, ${gradient.start}, ${gradient.end})`,
                              }}
                            />
                          );
                        })}
                      </div>
                      
                      {/* Content */}
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                          isSelected
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                        )}>
                          {option.icon}
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-semibold text-gray-900">
                            {option.label}
                          </div>
                          <div className="text-xs text-gray-500">
                            {option.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Period Grid - Always visible and interactive */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Select Time Period
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                {selectedPeriod 
                  ? `Locked to ${PERIOD_DISPLAY_NAMES[selectedPeriod]}. Click a period to change, or click a mode above to cycle.`
                  : 'Select a period to lock your theme, or choose a mode above to cycle automatically.'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {PERIOD_ORDER.map((period) => {
                  const gradient = GRADIENT_PRESETS[period];
                  const periodTheme = PERIOD_THEMES[period];
                  const textColor = TEXT_COLORS[periodTheme];
                  const isSelected = selectedPeriod === period;
                  const isInMode = getModePeriods(selectedMode).includes(period);
                  const timeRange = formatTimeRange(period);
                  
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => {
                        // Toggle selection: if already selected, deselect (go back to mode)
                        if (isSelected) {
                          setSelectedPeriod(undefined);
                        } else {
                          setSelectedPeriod(period);
                        }
                      }}
                      className={cn(
                        'group relative p-3 rounded-xl border-2 transition-all duration-200',
                        'overflow-hidden hover:shadow-lg hover:scale-[1.05] cursor-pointer',
                        isSelected
                          ? 'border-blue-500 ring-2 ring-blue-200 shadow-md'
                          : 'border-transparent hover:border-white/30'
                      )}
                      style={{
                        background: `linear-gradient(135deg, ${gradient.start}, ${gradient.end})`,
                        color: textColor,
                      }}
                    >
                      <div className="relative z-10">
                        <div className="text-sm font-semibold mb-1">
                          {PERIOD_DISPLAY_NAMES[period]}
                        </div>
                        <div className="text-xs opacity-90">
                          {timeRange}
                        </div>
                        
                        {/* Selection indicator */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center border border-white/40">
                            <Check className="w-3 h-3" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      
                      {/* Hover glow effect */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-200 rounded-xl bg-white" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

