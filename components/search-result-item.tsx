'use client';

import { Badge } from '@/components/ui/badge';
import { Chatbot } from '@/lib/types/chatbot';

interface SearchResultItemProps {
  chatbot: Chatbot;
  isSelected: boolean;
  onClick: () => void;
  index: number;
}

/**
 * SearchResultItem component - Individual chatbot result item in dropdown
 * 
 * Features:
 * - Title (truncated to 1 line)
 * - Creator name (truncated to 1 line)
 * - Chatbot type badge (if type exists)
 * - Hover state (gray background)
 * - Selected state (blue highlight with left border)
 * - Keyboard navigation support via isSelected prop
 */
export function SearchResultItem({
  chatbot,
  isSelected,
  onClick,
  index,
}: SearchResultItemProps) {
  return (
    <button
      data-index={index}
      onClick={onClick}
      className={`
        w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors
        ${isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : ''}
      `}
      aria-label={`Select ${chatbot.title} by ${chatbot.creator.name}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Title - truncated to 1 line */}
          <h4 className="font-medium text-sm truncate">
            {chatbot.title}
          </h4>
          {/* Creator name */}
          <p className="text-xs text-gray-500 truncate">
            by {chatbot.creator.name}
          </p>
        </div>
        {/* Chatbot type badge - only if type exists */}
        {chatbot.type && (
          <Badge variant="secondary" className="text-xs flex-shrink-0">
            {chatbot.type.replace(/_/g, ' ')}
          </Badge>
        )}
      </div>
    </button>
  );
}

