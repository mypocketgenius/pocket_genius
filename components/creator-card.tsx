'use client';

// Phase 3.7.4: Creator Card Component
// Displays creator information in a card format matching ChatbotCard design

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/lib/theme/theme-context';
import { getCurrentPeriod, getEffectiveHourForMode } from '@/lib/theme/config';

interface CreatorCardProps {
  creator: {
    id: string;
    slug: string | null;  // Can be null - should be filtered by API but adding guard for safety
    name: string;
    avatarUrl: string | null;
    bio: string | null;
    shortBio: string | null;
    chatbotCount: number;
  };
}

/**
 * CreatorCard component - Displays creator information in a card format
 * 
 * Features:
 * - Avatar display (or initial letter fallback)
 * - Name (truncated to 2 lines)
 * - Bio snippet (truncated to ~100 chars)
 * - Chatbot count badge
 * - Click handler navigates to creator page
 * - Hover effect (slight elevation/shadow)
 */
export function CreatorCard({ creator }: CreatorCardProps) {
  const router = useRouter();
  const theme = useTheme();
  
  // Get current period to adjust card styling for night/evening themes
  const now = new Date();
  const effectiveHour = getEffectiveHourForMode(theme.mode, now.getHours(), theme.customPeriod);
  const period = getCurrentPeriod(effectiveHour);
  const isNightOrEvening = period === 'night' || period === 'evening';
  
  // Adjust card styling for night/evening themes (medium contrast)
  const cardStyle = isNightOrEvening 
    ? { 
        backgroundColor: 'rgba(255, 255, 255, 0.15)', // Medium contrast white overlay
        borderColor: 'rgba(255, 255, 255, 0.12)', // Subtle border that blends with dark background
        color: theme.textColor, // Use theme text color for readability
      }
    : {};

  const handleCardClick = () => {
    // Guard: Don't navigate if slug is null or undefined
    if (!creator.slug) {
      console.warn(`Creator "${creator.name}" has no slug - cannot navigate to creator page`);
      return;
    }
    router.push(`/creators/${creator.slug}`);
  };

  // Use shortBio if available, otherwise truncate bio
  const getDisplayBio = () => {
    if (creator.shortBio) return creator.shortBio;
    if (!creator.bio) return null;
    if (creator.bio.length <= 100) return creator.bio;
    return creator.bio.substring(0, 100).trim() + '...';
  };

  // Don't render card if slug is missing (shouldn't happen due to API filtering, but defense in depth)
  if (!creator.slug) {
    return null;
  }

  return (
    <Card
      className="relative cursor-pointer hover:shadow-lg transition-all duration-200 overflow-hidden group"
      onClick={handleCardClick}
      style={cardStyle}
    >
      {/* Avatar section */}
      <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden relative">
        {creator.avatarUrl ? (
          <Image
            src={creator.avatarUrl}
            alt={creator.name}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-gray-300 flex items-center justify-center">
            <span className="text-gray-500 text-4xl font-semibold">
              {creator.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Card content */}
      <div className="p-3 space-y-1.5" style={isNightOrEvening ? { color: theme.textColor } : {}}>
        {/* Name - truncated to 2 lines */}
        <h3 className="font-semibold text-lg line-clamp-2" style={isNightOrEvening ? { color: theme.textColor } : {}}>
          {creator.name}
        </h3>

        {/* Bio snippet - uses shortBio if available, otherwise truncated bio */}
        {getDisplayBio() && (
          <p className={`text-sm line-clamp-2 -mt-0.5 ${isNightOrEvening ? '' : 'text-gray-600'}`} style={isNightOrEvening ? { color: theme.textColor, opacity: 0.85 } : {}}>
            {getDisplayBio()}
          </p>
        )}

        {/* Chatbot count badge */}
        <div className="pt-0.5">
          <Badge variant="secondary" className="text-xs">
            {creator.chatbotCount} {creator.chatbotCount === 1 ? 'chatbot' : 'chatbots'}
          </Badge>
        </div>
      </div>
    </Card>
  );
}


