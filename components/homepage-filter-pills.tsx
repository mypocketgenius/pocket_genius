'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * HomepageFilterPills Component
 * 
 * Displays colorful filter pills for category filtering on the homepage.
 * Shows first 6 pills by default, with expand/collapse functionality to show more.
 * 
 * Categories: All, Strategy, Leadership, Marketing, Personal Growth, Business, Creativity, Philosophy
 * 
 * @component
 */
export function HomepageFilterPills() {
  const [isExpanded, setIsExpanded] = useState(false);

  // Category list with color assignments
  const categories = [
    { name: 'All', color: 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200' },
    { name: 'Strategy', color: 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200' },
    { name: 'Leadership', color: 'bg-indigo-100 text-indigo-700 border-indigo-300 hover:bg-indigo-200' },
    { name: 'Marketing', color: 'bg-pink-100 text-pink-700 border-pink-300 hover:bg-pink-200' },
    { name: 'Personal Growth', color: 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200' },
    { name: 'Business', color: 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200' },
    { name: 'Creativity', color: 'bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200' },
    { name: 'Philosophy', color: 'bg-teal-100 text-teal-700 border-teal-300 hover:bg-teal-200' },
  ];

  const visibleCategories = isExpanded ? categories : categories.slice(0, 6);
  const hasMore = categories.length > 6;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {visibleCategories.map((category) => (
        <button
          key={category.name}
          className={`
            px-4 py-2 rounded-full text-sm font-medium
            border transition-all duration-200
            active:scale-95
            ${category.color}
          `}
          onClick={() => {
            // Placeholder for future filter functionality
            console.log('Filter clicked:', category.name);
          }}
          aria-label={`Filter by ${category.name}`}
        >
          {category.name}
        </button>
      ))}
      
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="
            px-4 py-2 rounded-full text-sm font-medium
            border border-gray-300 bg-white text-gray-700
            hover:bg-gray-50 hover:border-gray-400
            transition-all duration-200 active:scale-95
            flex items-center gap-1
          "
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

