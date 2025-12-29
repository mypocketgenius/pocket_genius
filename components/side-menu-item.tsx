'use client';

import { Badge } from '@/components/ui/badge';
import { ChatbotType } from '@/lib/types/chatbot';
import { useTheme } from '../lib/theme/theme-context';

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
  const theme = useTheme();

  // Theme-aware hover colors
  const hoverBgColor = theme.theme === 'light' 
    ? 'rgba(0, 0, 0, 0.05)' 
    : 'rgba(255, 255, 255, 0.1)';

  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3 text-left transition-colors"
      style={{ color: theme.textColor }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = hoverBgColor;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
      aria-label={`Select ${title} by ${creatorName}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Title - truncated to 1 line */}
          <h4 className="font-medium text-sm truncate mb-1" style={{ color: theme.textColor }}>
            {title}
          </h4>
          {/* Creator name */}
          <p className="text-xs truncate opacity-80" style={{ color: theme.textColor }}>
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

