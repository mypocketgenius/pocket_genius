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

// Type definitions matching the API response format
type ChatbotType = 'CREATOR' | 'FRAMEWORK' | 'DEEP_DIVE' | 'ADVISOR_BOARD';
type CategoryType = 'ROLE' | 'CHALLENGE' | 'STAGE';

interface ChatbotCardProps {
  chatbot: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    type: ChatbotType | null;
    priceCents: number;
    currency: string;
    allowAnonymous: boolean;
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
 * - Title (truncated to 2 lines)
 * - Description (truncated to ~100 chars)
 * - Creator name (clickable, links to creator page)
 * - Chatbot type badge
 * - Rating display (stars + count, or "No ratings yet")
 * - Price indicator ("Free" or formatted price)
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCardClick = () => {
    if (onCardClick) {
      onCardClick(chatbot);
    } else {
      setIsModalOpen(true);
    }
  };

  const handleStartChat = (chatbotId: string) => {
    router.push(`/chat/${chatbotId}`);
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

  // Truncate description to ~100 chars
  const truncateDescription = (text: string | null) => {
    if (!text) return null;
    if (text.length <= 100) return text;
    return text.substring(0, 100).trim() + '...';
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
      >
        {/* Favorite button - top right corner */}
        {isSignedIn && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 h-8 w-8 bg-white/80 hover:bg-white"
            onClick={handleFavoriteClick}
            disabled={isTogglingFavorite}
          >
            <Heart
              className={`h-4 w-4 ${
                isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'
              }`}
            />
          </Button>
        )}

        {/* Image placeholder or creator avatar */}
        <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden relative">
          {chatbot.creator.avatarUrl ? (
            <Image
              src={chatbot.creator.avatarUrl}
              alt={chatbot.creator.name}
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
        </div>

        {/* Card content */}
        <div className="p-4 space-y-2">
          {/* Title - truncated to 2 lines */}
          <h3 className="font-semibold text-lg line-clamp-2 min-h-[3.5rem]">
            {chatbot.title}
          </h3>

          {/* Description - truncated to ~100 chars */}
          {chatbot.description && (
            <p className="text-sm text-gray-600 line-clamp-2">
              {truncateDescription(chatbot.description)}
            </p>
          )}

          {/* Creator name - clickable link */}
          <Link
            href={`/creators/${chatbot.creator.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            {chatbot.creator.name}
          </Link>

          {/* Chatbot type badge */}
          {chatbot.type && (
            <Badge variant="secondary" className="text-xs">
              {formatChatbotType(chatbot.type)}
            </Badge>
          )}

          {/* Rating and price row */}
          <div className="flex items-center justify-between pt-2">
            {/* Rating display */}
            {chatbot.rating && chatbot.rating.ratingCount > 0 ? (
              <div className="flex items-center gap-1.5">
                {renderStars(chatbot.rating.averageRating)}
                <span className="text-sm font-medium">
                  {chatbot.rating.averageRating?.toFixed(1)}
                </span>
                <span className="text-xs text-gray-500">
                  ({chatbot.rating.ratingCount})
                </span>
              </div>
            ) : (
              <span className="text-sm text-gray-500">No ratings yet</span>
            )}

            {/* Price indicator */}
            <Badge
              variant={chatbot.priceCents === 0 ? 'default' : 'secondary'}
              className="text-xs"
            >
              {formatPrice()}
            </Badge>
          </div>
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

