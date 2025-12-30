'use client';

// Reusable search bar component with debouncing and mobile expandable behavior
// Used across AppHeader, Chat, and Dashboard components for consistency

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { Chatbot } from '@/lib/types/chatbot';
import { SearchDropdown } from '@/components/search-dropdown';

interface SearchBarProps {
  // Initial search query value
  initialValue?: string;
  // Custom placeholder text
  placeholder?: string;
  // Custom styling for the input (for theme-aware components)
  inputStyle?: React.CSSProperties;
  // Custom className for the input
  inputClassName?: string;
  // Variant: 'header' (for AppHeader) or 'inline' (for Chat/Dashboard)
  variant?: 'header' | 'inline';
  // Show dropdown results (default: true)
  showDropdown?: boolean;
  // Max results in dropdown (default: 10)
  maxResults?: number;
  // Optional callback when chatbot selected
  onChatbotSelect?: (chatbotId: string) => void;
  // Optional callback when expansion state changes (for mobile)
  onExpansionChange?: (isExpanded: boolean) => void;
}

export function SearchBar({
  initialValue = '',
  placeholder = 'Search chatbots...',
  inputStyle,
  inputClassName = '',
  variant = 'header',
  showDropdown = true,
  maxResults = 10,
  onChatbotSelect,
  onExpansionChange,
}: SearchBarProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(initialValue);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Notify parent when expansion state changes
  useEffect(() => {
    onExpansionChange?.(isExpanded);
  }, [isExpanded, onExpansionChange]);
  
  // Dropdown state management
  const [searchResults, setSearchResults] = useState<Chatbot[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  // Refs for dropdown and input elements
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Debounce search for performance (300ms delay)
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Sync with initialValue prop changes
  useEffect(() => {
    if (initialValue !== undefined) {
      setSearchQuery(prev => prev !== initialValue ? initialValue : prev);
    }
  }, [initialValue]);

  // API fetching with debounced search and AbortController for request cancellation
  useEffect(() => {
    // Handle empty/minimal search queries - don't fetch if query is too short
    if (!debouncedSearch || debouncedSearch.length < 2) {
      setSearchResults([]);
      setIsDropdownOpen(false);
      return;
    }

    // Only fetch if dropdown is enabled
    if (!showDropdown) {
      return;
    }

    setIsLoadingResults(true);
    setIsDropdownOpen(true);

    // Create AbortController for request cancellation
    const abortController = new AbortController();

    fetch(
      `/api/chatbots/public?search=${encodeURIComponent(debouncedSearch)}&pageSize=${maxResults || 10}`,
      { signal: abortController.signal }
    )
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        // Only update if request wasn't cancelled
        if (!abortController.signal.aborted) {
          setSearchResults(data.chatbots || []);
          setSelectedIndex(-1); // Reset selection
        }
      })
      .catch(err => {
        // Ignore abort errors (expected when new search starts)
        if (err.name !== 'AbortError') {
          console.error('Search error:', err);
        }
        // Only update if request wasn't cancelled
        if (!abortController.signal.aborted) {
          setSearchResults([]);
        }
      })
      .finally(() => {
        // Only update if request wasn't cancelled
        if (!abortController.signal.aborted) {
          setIsLoadingResults(false);
        }
      });

    // Cleanup: abort request if component unmounts or new search starts
    return () => {
      abortController.abort();
    };
  }, [debouncedSearch, maxResults, showDropdown]);

  // Click outside detection - close dropdown when clicking outside input and dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is inside dropdown
      const isInsideDropdown = dropdownRef.current && dropdownRef.current.contains(target);
      
      // Check if click is inside input (via ref or container class)
      const isInsideInput = 
        (inputRef.current && inputRef.current.contains(target)) ||
        (target as HTMLElement).closest('.search-input-container') !== null;
      
      // Close dropdown if click is outside both dropdown and input
      if (isDropdownOpen && !isInsideDropdown && !isInsideInput) {
        setIsDropdownOpen(false);
      }
    };

    // Only add listener when dropdown is open
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isDropdownOpen]);

  // Keep input focused when dropdown opens (for keyboard navigation)
  useEffect(() => {
    if (isDropdownOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isDropdownOpen]);

  // Scroll selected item into view when using keyboard navigation
  useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const selectedElement = dropdownRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      ) as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [selectedIndex]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleClose = () => {
    setSearchQuery('');
    setIsExpanded(false);
  };

  // Handle chatbot selection from dropdown
  const handleChatbotSelect = (chatbotId: string) => {
    // Close dropdown immediately
    setIsDropdownOpen(false);
    
    // Clear search query
    setSearchQuery('');
    
    // Reset selection index
    setSelectedIndex(-1);
    
    // Call optional callback if provided
    if (onChatbotSelect) {
      onChatbotSelect(chatbotId);
    }
    
    // Navigate to chatbot chat page
    router.push(`/chat/${chatbotId}`);
  };

  // Handle keyboard navigation in dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Only handle keyboard navigation when dropdown is open and has results
    if (!isDropdownOpen || searchResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : searchResults.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleChatbotSelect(searchResults[selectedIndex].id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsDropdownOpen(false);
        break;
    }
  };

  // Handler to close dropdown (for "See all results" link)
  const handleDropdownClose = () => {
    setIsDropdownOpen(false);
  };

  // Desktop: always visible search bar
  const desktopSearch = (
    <div className="relative search-input-container">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={searchQuery}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={`pl-9 pr-4 h-9 text-base ${inputClassName}`}
        style={inputStyle}
        suppressHydrationWarning
      />
      {/* Dropdown - only render when enabled and open */}
      {showDropdown && (
        <SearchDropdown
          results={searchResults}
          isLoading={isLoadingResults}
          isOpen={isDropdownOpen}
          selectedIndex={selectedIndex}
          onSelect={handleChatbotSelect}
          onClose={handleDropdownClose}
          query={searchQuery}
          maxResults={maxResults}
          dropdownRef={dropdownRef}
        />
      )}
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
        <div className="relative search-input-container">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            className={`pl-8 pr-8 h-9 text-base w-48 ${inputClassName}`}
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
          {/* Dropdown - only render when enabled and open */}
          {showDropdown && (
            <SearchDropdown
              results={searchResults}
              isLoading={isLoadingResults}
              isOpen={isDropdownOpen}
              selectedIndex={selectedIndex}
              onSelect={handleChatbotSelect}
              onClose={handleDropdownClose}
              query={searchQuery}
              maxResults={maxResults}
              dropdownRef={dropdownRef}
            />
          )}
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

        {/* Mobile: icon button in header (only show when not expanded) */}
        <div className="md:hidden flex-shrink-0">
          {!isExpanded && (
            <button
              onClick={() => setIsExpanded(true)}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Search"
            >
              <Search className="h-5 w-5 text-gray-600" />
            </button>
          )}
        </div>

        {/* Mobile: expanded search bar below header */}
        {isExpanded && (
          <div className="md:hidden mt-4 pb-2">
            <div className="relative search-input-container">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                ref={inputRef}
                type="text"
                placeholder={placeholder}
                value={searchQuery}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                className={`pl-10 pr-10 h-10 text-base ${inputClassName}`}
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
              {/* Dropdown - only render when enabled and open */}
              {showDropdown && (
                <SearchDropdown
                  results={searchResults}
                  isLoading={isLoadingResults}
                  isOpen={isDropdownOpen}
                  selectedIndex={selectedIndex}
                  onSelect={handleChatbotSelect}
                  onClose={handleDropdownClose}
                  query={searchQuery}
                  maxResults={maxResults}
                  dropdownRef={dropdownRef}
                />
              )}
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
          <div className="relative search-input-container">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder={placeholder}
              value={searchQuery}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              className={`pl-9 pr-9 h-10 text-base w-full ${inputClassName}`}
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
            {/* Dropdown - only render when enabled and open */}
            {showDropdown && (
              <SearchDropdown
                results={searchResults}
                isLoading={isLoadingResults}
                isOpen={isDropdownOpen}
                selectedIndex={selectedIndex}
                onSelect={handleChatbotSelect}
                onClose={handleDropdownClose}
                query={searchQuery}
                maxResults={maxResults}
                dropdownRef={dropdownRef}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

