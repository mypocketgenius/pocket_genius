'use client';

// Phase 3.7.4: Chatbot Card Component with Full Design
// Displays chatbot information in a card format with image, rating, price, and favorite button

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChatbotDetailModal } from './chatbot-detail-modal';
import { ChatbotType, CategoryType } from '@/lib/types/chatbot';
import { useTheme } from '@/lib/theme/theme-context';
import { getCurrentPeriod, getEffectiveHourForMode } from '@/lib/theme/config';

interface ChatbotCardProps {
  chatbot: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    shortDescription: string | null;
    imageUrl: string | null;
    type: ChatbotType | null;
    priceCents: number;
    currency: string;
    allowAnonymous: boolean;
    publicDashboard: boolean;
    creator: {
      id: string;
      slug: string;
      name: string;
      avatarUrl: string | null;
    };
    rating: {
      averageRating: number | null;
      ratingCount: number;
    } | null;
    categories: Array<{
      id: string;
      type: CategoryType;
      label: string;
      slug: string;
    }>;
    favoriteCount?: number; // Available but not displayed on card (shown in modal)
  };
  onCardClick?: (chatbot: ChatbotCardProps['chatbot']) => void;
  isFavorite?: boolean;
  onFavoriteToggle?: (chatbotId: string, isFavorite: boolean) => void;
}

/**
 * ChatbotCard component - Full card design with all features
 * 
 * Features:
 * - Image placeholder (or creator avatar)
 * - Free indicator badge (bottom right corner of image)
 * - Title (truncated to 2 lines)
 * - Creator name (directly underneath title, clickable link to creator page)
 * - Description (truncated to ~100 chars)
 * - Rating display (stars + count, or "No ratings yet")
 * - Start Chat CTA button (prominent button at bottom of card)
 * - Favorite button (heart icon, top-right corner) - only if authenticated
 * - Hover effect (slight elevation/shadow)
 */
export function ChatbotCard({
  chatbot,
  onCardClick,
  isFavorite = false,
  onFavoriteToggle,
}: ChatbotCardProps) {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const theme = useTheme();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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
    if (onCardClick) {
      onCardClick(chatbot);
    } else {
      setIsModalOpen(true);
    }
  };

  const handleStartChat = (chatbotId: string) => {
    // Always start fresh conversation - users can access history via sidebar
    router.push(`/chat/${chatbotId}?new=true`);
  };

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    if (!onFavoriteToggle) return;

    setIsTogglingFavorite(true);
    const previousValue = isFavorite;
    
    // Optimistic update
    onFavoriteToggle(chatbot.id, !isFavorite);
    
    try {
      const response = await fetch(`/api/favorites/${chatbot.id}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to toggle favorite');
      }

      const data = await response.json();
      
      // Show success toast
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setToast({
        message: data.isFavorite ? 'Added to favorites' : 'Removed from favorites',
        type: 'success',
      });
      toastTimeoutRef.current = setTimeout(() => {
        setToast(null);
        toastTimeoutRef.current = null;
      }, 3000);
    } catch (error) {
      // Rollback on error
      onFavoriteToggle(chatbot.id, previousValue);
      
      // Show error toast
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setToast({
        message: 'Failed to update favorite',
        type: 'error',
      });
      toastTimeoutRef.current = setTimeout(() => {
        setToast(null);
        toastTimeoutRef.current = null;
      }, 5000);
      
      console.error('Error toggling favorite:', error);
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  // Format price
  const formatPrice = () => {
    if (chatbot.priceCents === 0) {
      return 'Free';
    }
    const price = (chatbot.priceCents / 100).toFixed(2);
    return `${chatbot.currency === 'USD' ? '$' : chatbot.currency}${price}`;
  };

  // Format chatbot type for display
  const formatChatbotType = (type: ChatbotType | null) => {
    if (!type) return null;
    return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // Use shortDescription if available, otherwise truncate description
  const getDisplayDescription = () => {
    if (chatbot.shortDescription) return chatbot.shortDescription;
    if (!chatbot.description) return null;
    if (chatbot.description.length <= 100) return chatbot.description;
    return chatbot.description.substring(0, 100).trim() + '...';
  };

  // Render star rating display
  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3 h-3 ${
              star <= fullStars
                ? 'fill-yellow-400 text-yellow-400'
                : star === fullStars + 1 && hasHalfStar
                ? 'fill-yellow-400/50 text-yellow-400'
                : 'fill-gray-200 text-gray-200'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <Card
        className="relative cursor-pointer hover:shadow-lg transition-all duration-200 overflow-hidden group"
        onClick={handleCardClick}
        style={cardStyle}
      >
        {/* Favorite button - top right corner */}
        {isSignedIn && (
          <Button
            variant="ghost"
            size="icon"
            className={`absolute top-2 right-2 z-10 h-8 w-8 ${isNightOrEvening ? 'bg-white/15 hover:bg-white/25' : 'bg-white/80 hover:bg-white'}`}
            onClick={handleFavoriteClick}
            disabled={isTogglingFavorite}
          >
            <Heart
              className={`h-4 w-4 ${
                isFavorite ? 'fill-red-500 text-red-500' : isNightOrEvening ? 'text-gray-300' : 'text-gray-400'
              }`}
            />
          </Button>
        )}

        {/* Image or initial letter fallback */}
        <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden relative">
          {chatbot.imageUrl ? (
            <Image
              src={chatbot.imageUrl}
              alt={chatbot.title}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-gray-500 text-4xl font-semibold">
                {chatbot.creator.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          {/* Free indicator - bottom right corner of image */}
          {chatbot.priceCents === 0 && (
            <Badge
              variant="default"
              className="absolute bottom-2 right-2 text-xs bg-green-600 hover:bg-green-600"
            >
              Free
            </Badge>
          )}
        </div>

        {/* Card content */}
        <div className="p-3 space-y-1.5" style={isNightOrEvening ? { color: theme.textColor } : {}}>
          {/* Title - truncated to 2 lines */}
          <h3 className={`font-semibold text-lg line-clamp-2 ${isNightOrEvening ? '' : ''}`} style={isNightOrEvening ? { color: theme.textColor } : {}}>
            {chatbot.title}
          </h3>

          {/* Creator name - directly underneath title */}
          <div className="text-sm -mt-1">
            <span className={isNightOrEvening ? '' : 'text-gray-500'} style={isNightOrEvening ? { color: theme.textColor, opacity: 0.8 } : {}}>
              by{' '}
            </span>
            <Link
              href={`/creators/${chatbot.creator.slug}`}
              onClick={(e) => e.stopPropagation()}
              className={isNightOrEvening ? 'hover:underline font-medium' : 'text-blue-600 hover:underline font-medium'}
              style={isNightOrEvening ? { color: theme.textColor, opacity: 0.9 } : {}}
            >
              {chatbot.creator.name}
            </Link>
          </div>

          {/* Description - uses shortDescription if available, otherwise truncated description */}
          {getDisplayDescription() && (
            <p className={`text-sm line-clamp-3 ${isNightOrEvening ? '' : 'text-gray-600'}`} style={isNightOrEvening ? { color: theme.textColor, opacity: 0.85 } : {}}>
              {getDisplayDescription()}
            </p>
          )}

          {/* Rating display */}
          <div className="flex items-center pt-0.5">
            {chatbot.rating && chatbot.rating.ratingCount > 0 ? (
              <div className="flex items-center gap-1.5">
                {renderStars(chatbot.rating.averageRating)}
                <span className="text-sm font-medium" style={isNightOrEvening ? { color: theme.textColor } : {}}>
                  {chatbot.rating.averageRating?.toFixed(1)}
                </span>
                <span className={`text-xs ${isNightOrEvening ? '' : 'text-gray-500'}`} style={isNightOrEvening ? { color: theme.textColor, opacity: 0.75 } : {}}>
                  ({chatbot.rating.ratingCount})
                </span>
              </div>
            ) : (
              <span className={`text-sm ${isNightOrEvening ? '' : 'text-gray-500'}`} style={isNightOrEvening ? { color: theme.textColor, opacity: 0.75 } : {}}>
                No ratings yet
              </span>
            )}
          </div>

          {/* Start Chat CTA button */}
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleStartChat(chatbot.id);
            }}
            size="sm"
            className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-2"
          >
            Start Chat
          </Button>
        </div>
      </Card>

      {/* Detail modal */}
      <ChatbotDetailModal
        chatbot={chatbot}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onStartChat={handleStartChat}
      />

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-green-50 border-2 border-green-300 text-green-800'
              : 'bg-red-50 border-2 border-red-300 text-red-800'
          }`}
          style={{
            animation: 'slideIn 0.3s ease-out',
          }}
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <svg
                className="w-5 h-5 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
            <span className="opacity-80">{toast.message}</span>
            <button
              onClick={() => {
                if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                setToast(null);
                toastTimeoutRef.current = null;
              }}
              className="ml-2 text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}

