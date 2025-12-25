'use client';

import { Badge } from '@/components/ui/badge';
import { ChatbotType } from '@/lib/types/chatbot';

interface SideMenuItemProps {
  title: string;
  type: ChatbotType | null;
  creatorName: string;
  onClick: () => void;
}

/**
 * SideMenuItem Component
 * 
 * Individual list item for sidebar menu, displaying:
 * - Chatbot/Chat title
 * - Chatbot type badge (if type exists)
 * - Creator name
 * 
 * Styling matches SearchResultItem pattern but adapted for sidebar width.
 */
export function SideMenuItem({
  title,
  type,
  creatorName,
  onClick,
}: SideMenuItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      aria-label={`Select ${title} by ${creatorName}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Title - truncated to 1 line */}
          <h4 className="font-medium text-sm truncate mb-1">
            {title}
          </h4>
          {/* Creator name */}
          <p className="text-xs text-gray-500 truncate">
            by {creatorName}
          </p>
        </div>
        {/* Chatbot type badge - only if type exists */}
        {type && (
          <Badge variant="secondary" className="text-xs flex-shrink-0">
            {type.replace(/_/g, ' ')}
          </Badge>
        )}
      </div>
    </button>
  );
}

