'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { SearchResultItem } from './search-result-item';
import { Chatbot } from '@/lib/types/chatbot';

interface SearchDropdownProps {
  results: Chatbot[];
  isLoading: boolean;
  isOpen: boolean;
  selectedIndex: number;
  onSelect: (chatbotId: string) => void;
  onClose: () => void;
  query: string;
  maxResults: number;
  dropdownRef?: React.RefObject<HTMLDivElement>;
}

/**
 * SearchDropdown component - Reusable dropdown component for search results
 * 
 * Features:
 * - Loading state with skeleton items
 * - Empty state with "No chatbots found" message
 * - Results list with SearchResultItem components
 * - Keyboard navigation highlighting (via selectedIndex)
 * - "See all results" link when results.length === maxResults
 * - Responsive styling (full width on mobile, matches input on desktop)
 * - Click-outside detection support via dropdownRef
 */
export function SearchDropdown({
  results,
  isLoading,
  isOpen,
  selectedIndex,
  onSelect,
  onClose,
  query,
  maxResults,
  dropdownRef,
}: SearchDropdownProps) {
  const router = useRouter();

  // Don't render if dropdown is closed
  if (!isOpen) return null;

  const handleSeeAll = () => {
    onClose();
    // Navigate to homepage with search query
    router.push(`/?search=${encodeURIComponent(query)}`);
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 right-0 md:left-auto md:right-auto mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto py-1"
    >
      {isLoading ? (
        // Loading state: skeleton items
        <div className="px-4 py-2 space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
              <div className="h-3 bg-gray-100 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        // Empty state
        <div className="px-4 py-8 text-center text-gray-500">
          <p>No chatbots found for &quot;{query}&quot;</p>
        </div>
      ) : (
        <>
          {/* Results list */}
          {results.map((chatbot, index) => (
            <SearchResultItem
              key={chatbot.id}
              chatbot={chatbot}
              isSelected={index === selectedIndex}
              onClick={() => onSelect(chatbot.id)}
              index={index}
            />
          ))}
          
          {/* "See all results" link */}
          {results.length === maxResults && (
            <div className="border-t border-gray-200 px-4 py-2">
              <button
                onClick={handleSeeAll}
                className="text-sm text-blue-600 hover:underline w-full text-left"
                aria-label={`See all results for ${query}`}
              >
                See all results for &quot;{query}&quot;
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

