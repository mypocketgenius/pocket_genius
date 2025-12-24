'use client';

// Reusable search bar component with debouncing and mobile expandable behavior
// Used across AppHeader, Chat, and Dashboard components for consistency

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/lib/hooks/use-debounce';

interface SearchBarProps {
  // Initial search query value
  initialValue?: string;
  // Callback when search changes (debounced)
  onSearchChange?: (query: string) => void;
  // Whether to navigate to homepage on search (default: true)
  navigateOnSearch?: boolean;
  // Custom placeholder text
  placeholder?: string;
  // Custom styling for the input (for theme-aware components)
  inputStyle?: React.CSSProperties;
  // Custom className for the input
  inputClassName?: string;
  // Variant: 'header' (for AppHeader) or 'inline' (for Chat/Dashboard)
  variant?: 'header' | 'inline';
}

export function SearchBar({
  initialValue = '',
  onSearchChange,
  navigateOnSearch = true,
  placeholder = 'Search chatbots...',
  inputStyle,
  inputClassName = '',
  variant = 'header',
}: SearchBarProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(initialValue);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Debounce search for performance (300ms delay)
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Navigate to homepage when search changes (if enabled)
  useEffect(() => {
    if (navigateOnSearch && debouncedSearch) {
      router.push(`/?search=${encodeURIComponent(debouncedSearch)}`);
    } else if (navigateOnSearch && debouncedSearch === '' && initialValue === '') {
      router.push('/');
    }
  }, [debouncedSearch, navigateOnSearch, router, initialValue]);

  // Call onSearchChange callback when debounced search changes
  useEffect(() => {
    if (onSearchChange) {
      onSearchChange(debouncedSearch);
    }
  }, [debouncedSearch, onSearchChange]);

  // Sync with initialValue prop changes
  useEffect(() => {
    if (initialValue !== undefined && initialValue !== searchQuery) {
      setSearchQuery(initialValue);
    }
  }, [initialValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleClose = () => {
    setSearchQuery('');
    setIsExpanded(false);
  };

  // Desktop: always visible search bar
  const desktopSearch = (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
      <Input
        type="text"
        placeholder={placeholder}
        value={searchQuery}
        onChange={handleChange}
        className={`pl-9 pr-4 h-9 text-sm ${inputClassName}`}
        style={inputStyle}
        suppressHydrationWarning
      />
    </div>
  );

  // Mobile: expandable search
  const mobileSearch = (
    <>
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Search"
        >
          <Search className="h-5 w-5 text-gray-600" />
        </button>
      ) : (
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={handleChange}
            className={`pl-8 pr-8 h-9 text-sm w-48 ${inputClassName}`}
            style={inputStyle}
            autoFocus
            suppressHydrationWarning
          />
          <button
            onClick={handleClose}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );

  // Header variant: search in header row, expands below on mobile
  if (variant === 'header') {
    return (
      <>
        {/* Desktop: always visible */}
        <div className="flex-1 max-w-2xl hidden md:block">
          {desktopSearch}
        </div>

        {/* Mobile: icon button in header */}
        <div className="md:hidden flex-shrink-0">
          {mobileSearch}
        </div>

        {/* Mobile: expanded search bar below header */}
        {isExpanded && (
          <div className="md:hidden mt-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="text"
                placeholder={placeholder}
                value={searchQuery}
                onChange={handleChange}
                className={`pl-10 pr-10 h-10 ${inputClassName}`}
                style={inputStyle}
                autoFocus
                suppressHydrationWarning
              />
              <button
                onClick={handleClose}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Close search"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Inline variant: search in the same row (for Chat/Dashboard)
  return (
    <>
      {/* Desktop: always visible */}
      <div className="hidden md:flex items-center gap-2 flex-1 max-w-md mx-4">
        {desktopSearch}
      </div>

      {/* Mobile: expandable in header */}
      <div className="md:hidden">
        {mobileSearch}
      </div>

      {/* Mobile: expanded search bar below */}
      {isExpanded && (
        <div className="md:hidden mt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder={placeholder}
              value={searchQuery}
              onChange={handleChange}
              className={`pl-9 pr-9 h-10 text-sm w-full ${inputClassName}`}
              style={inputStyle}
              autoFocus
              suppressHydrationWarning
            />
            <button
              onClick={handleClose}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

