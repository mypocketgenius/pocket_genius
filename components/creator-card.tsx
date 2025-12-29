'use client';

// Phase 3.7.4: Creator Card Component
// Displays creator information in a card format matching ChatbotCard design

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CreatorCardProps {
  creator: {
    id: string;
    slug: string;
    name: string;
    avatarUrl: string | null;
    bio: string | null;
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

  const handleCardClick = () => {
    router.push(`/creators/${creator.slug}`);
  };

  // Truncate bio to ~100 chars (matching ChatbotCard description truncation)
  const truncateBio = (text: string | null) => {
    if (!text) return null;
    if (text.length <= 100) return text;
    return text.substring(0, 100).trim() + '...';
  };

  return (
    <Card
      className="relative cursor-pointer hover:shadow-lg transition-all duration-200 overflow-hidden group"
      onClick={handleCardClick}
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
      <div className="p-3 space-y-1.5">
        {/* Name - truncated to 2 lines */}
        <h3 className="font-semibold text-lg line-clamp-2">
          {creator.name}
        </h3>

        {/* Bio snippet - truncated to ~100 chars */}
        {creator.bio && (
          <p className="text-sm text-gray-600 line-clamp-2 -mt-0.5">
            {truncateBio(creator.bio)}
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


