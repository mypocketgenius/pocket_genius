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
  getCurrentPeriod,
} from '../lib/theme/config';
import { cn } from '../lib/utils';

interface ThemeSettingsProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Theme Settings Component
 * 
 * Allows users to select their preferred theme mode:
 * - custom: Lock to a specific time period
 * - cycle: Full 24-hour cycle
 * - dark-cycle: Cycle through dark periods only (night, evening)
 * - light-cycle: Cycle through light periods only (dawn through dusk)
 * 
 * When custom mode is selected, shows period selector with gradient previews.
 * Each period row displays the actual gradient background with correct text color.
 */
export function ThemeSettings({ open, onClose }: ThemeSettingsProps) {
  const theme = useTheme();
  
  // Local state for form (not applied until Save is clicked)
  const [selectedMode, setSelectedMode] = useState<ThemeMode>(theme.mode);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod | undefined>(theme.customPeriod);
  
  // Update local state when theme changes or modal opens
  useEffect(() => {
    if (open) {
      setSelectedMode(theme.mode);
      setSelectedPeriod(theme.customPeriod);
    }
  }, [open, theme.mode, theme.customPeriod]);
  
  // If custom mode but no period selected, default to current period
  useEffect(() => {
    if (selectedMode === 'custom' && !selectedPeriod) {
      const now = new Date();
      const hour = now.getHours();
      const currentPeriod = getCurrentPeriod(hour);
      setSelectedPeriod(currentPeriod);
    }
  }, [selectedMode, selectedPeriod]);
  
  /**
   * Handles saving theme settings
   * Applies the selected mode and period to the theme context
   */
  function handleSave() {
    theme.setMode(selectedMode);
    if (selectedMode === 'custom' && selectedPeriod) {
      theme.setCustomPeriod(selectedPeriod);
    }
    onClose();
  }
  
  /**
   * Handles cancel - closes modal without saving
   */
  function handleCancel() {
    // Reset to current theme values
    setSelectedMode(theme.mode);
    setSelectedPeriod(theme.customPeriod);
    onClose();
  }
  
  // Theme mode options
  const modeOptions: { value: ThemeMode; label: string; description: string }[] = [
    { value: 'cycle', label: 'Cycle', description: 'Full 24-hour cycle' },
    { value: 'dark-cycle', label: 'Dark Cycle', description: 'Dark periods only (night, evening)' },
    { value: 'light-cycle', label: 'Light Cycle', description: 'Light periods only (dawn through dusk)' },
    { value: 'custom', label: 'Custom', description: 'Lock to specific time period' },
  ];
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Theme Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Theme Mode Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Theme Mode</label>
            <div className="space-y-2">
              {modeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setSelectedMode(option.value);
                    // Clear period selection if switching away from custom mode
                    if (option.value !== 'custom') {
                      setSelectedPeriod(undefined);
                    }
                  }}
                  className={cn(
                    'w-full text-left p-3 rounded-md border-2 transition-all',
                    selectedMode === option.value
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                        selectedMode === option.value
                          ? 'border-blue-500'
                          : 'border-gray-300'
                      )}
                    >
                      {selectedMode === option.value && (
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{option.label}</div>
                      <div className="text-xs text-gray-500">{option.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          {/* Period Selector (only shown for custom mode) */}
          {selectedMode === 'custom' && (
            <div className="space-y-3">
              <label className="text-sm font-medium">Select Time Period</label>
              <div className="space-y-2">
                {PERIOD_ORDER.map((period) => {
                  const gradient = GRADIENT_PRESETS[period];
                  const periodTheme = PERIOD_THEMES[period];
                  const textColor = TEXT_COLORS[periodTheme];
                  const isSelected = selectedPeriod === period;
                  
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setSelectedPeriod(period)}
                      className={cn(
                        'w-full text-left p-3 rounded-md border-2 transition-all relative overflow-hidden',
                        isSelected
                          ? 'border-blue-500 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                      style={{
                        background: `linear-gradient(135deg, ${gradient.start}, ${gradient.end})`,
                        color: textColor,
                      }}
                    >
                      <div className="relative z-10 flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {PERIOD_DISPLAY_NAMES[period]}
                        </span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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

