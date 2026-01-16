'use client';

// Phase 3.7.3: Chatbot Detail Modal Component
// Displays detailed chatbot information in a modal when card is clicked

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser, useClerk } from '@clerk/nextjs';
import { X, Heart, Star, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatbotType, CategoryType } from '@/lib/types/chatbot';
import { useTheme } from '@/lib/theme/theme-context';
import { getCurrentPeriod, getEffectiveHourForMode } from '@/lib/theme/config';

interface ChatbotDetailModalProps {
  chatbot: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
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
      ratingDistribution?: Record<string, number> | null;
    } | null;
    categories: Array<{
      id: string;
      type: CategoryType;
      label: string;
      slug: string;
    }>;
  };
  open: boolean;
  onClose: () => void;
  onStartChat: (chatbotId: string) => void;
}

interface Review {
  id: string;
  userId: string | null;
  userName: string | null;
  rating: number | null;
  comment: string | null;
  timeSaved: string | null;
  createdAt: string;
}

interface ReviewsResponse {
  reviews: Review[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
  };
}

/**
 * ChatbotDetailModal component - Shows detailed chatbot information
 * 
 * Features:
 * - Displays chatbot title, description, creator info
 * - Shows categories grouped by type
 * - Displays ratings and rating distribution
 * - Fetches and displays reviews with pagination
 * - "Start Chat" button with auth handling
 * - Favorite button (if authenticated)
 */
export function ChatbotDetailModal({
  chatbot,
  open,
  onClose,
  onStartChat,
}: ChatbotDetailModalProps) {
  const router = useRouter();
  const { isSignedIn, userId: clerkUserId } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const theme = useTheme();
  
  // Get current period to adjust styling for night/evening themes
  const now = new Date();
  const effectiveHour = getEffectiveHourForMode(theme.mode, now.getHours(), theme.customPeriod);
  const period = getCurrentPeriod(effectiveHour);
  const isNightOrEvening = period === 'night' || period === 'evening';
  
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [hasMoreReviews, setHasMoreReviews] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  // Fetch reviews from API
  const fetchReviews = useCallback(async (page: number) => {
    setIsLoadingReviews(true);
    setReviewsError(null);
    
    try {
      const response = await fetch(
        `/api/chatbots/${chatbot.id}/reviews?page=${page}&pageSize=5&sort=recent`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch reviews');
      }
      
      const data: ReviewsResponse = await response.json();
      
      if (page === 1) {
        setReviews(data.reviews);
      } else {
        setReviews((prev) => [...prev, ...data.reviews]);
      }
      
      setReviewsPage(data.pagination.page);
      setHasMoreReviews(data.pagination.page < data.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setReviewsError('Failed to load reviews');
    } finally {
      setIsLoadingReviews(false);
    }
  }, [chatbot.id]);

  // Check if chatbot is favorited by current user
  const checkFavoriteStatus = useCallback(async () => {
    if (!isSignedIn || !clerkUserId) return;
    
    try {
      // Check if chatbot is in user's favorites
      const response = await fetch(`/api/favorites?page=1&pageSize=100`);
      if (response.ok) {
        const data = await response.json();
        const isFavorited = data.chatbots.some((c: any) => c.id === chatbot.id);
        setIsFavorite(isFavorited);
      }
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  }, [isSignedIn, clerkUserId, chatbot.id]);

  // Fetch reviews when modal opens
  useEffect(() => {
    if (open) {
      fetchReviews(1);
      if (isSignedIn) {
        checkFavoriteStatus();
      }
    } else {
      // Reset state when modal closes
      setReviews([]);
      setReviewsPage(1);
      setHasMoreReviews(false);
      setReviewsError(null);
    }
  }, [open, chatbot.id, isSignedIn, fetchReviews, checkFavoriteStatus]);

  // Toggle favorite status
  const handleToggleFavorite = async () => {
    if (!isSignedIn) {
      // Redirect to sign in if not authenticated
      router.push('/sign-in');
      return;
    }

    setIsTogglingFavorite(true);
    const previousValue = isFavorite;
    
    // Optimistic update
    setIsFavorite(!isFavorite);
    
    try {
      const response = await fetch(`/api/favorites/${chatbot.id}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to toggle favorite');
      }

      const data = await response.json();
      setIsFavorite(data.isFavorite);
    } catch (error) {
      // Rollback on error
      setIsFavorite(previousValue);
      console.error('Error toggling favorite:', error);
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  // Handle "Start Chat" button click
  const handleStartChat = () => {
    if (chatbot.priceCents === 0 && chatbot.allowAnonymous) {
      // Free and anonymous - navigate directly
      onStartChat(chatbot.id);
      onClose();
    } else if (chatbot.priceCents === 0 && !chatbot.allowAnonymous) {
      // Free but requires login
      if (isSignedIn) {
        onStartChat(chatbot.id);
        onClose();
      } else {
        // Open sign-in modal with redirect URL
        clerk.openSignIn({
          redirectUrl: `/chat/${chatbot.id}`,
        });
        onClose(); // Close chatbot detail modal
      }
    } else {
      // Paid - show disabled button with tooltip (deferred to Beta)
      // Button will be disabled in the UI
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

  // Format relative time (e.g., "2 hours ago", "3 days ago")
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'just now';
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
    }
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return `${diffInWeeks} ${diffInWeeks === 1 ? 'week' : 'weeks'} ago`;
    }
    
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'} ago`;
    }
    
    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears} ${diffInYears === 1 ? 'year' : 'years'} ago`;
  };

  // Group categories by type
  const groupedCategories = chatbot.categories.reduce(
    (acc, cat) => {
      if (!acc[cat.type]) {
        acc[cat.type] = [];
      }
      acc[cat.type].push(cat);
      return acc;
    },
    {} as Record<CategoryType, typeof chatbot.categories>
  );

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
            className={`w-4 h-4 ${
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

  // Render rating distribution
  const renderRatingDistribution = () => {
    if (!chatbot.rating?.ratingDistribution) return null;
    
    const distribution = chatbot.rating.ratingDistribution;
    const totalRatings = chatbot.rating.ratingCount;
    
    return (
      <div className="mt-2 space-y-1">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = distribution[star.toString()] || 0;
          const percentage = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
          
          return (
            <div key={star} className="flex items-center gap-2 text-sm">
              <span className="w-8" style={{ color: theme.textColor }}>{star}★</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: isNightOrEvening ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)' }}>
                <div
                  className="h-full bg-yellow-400 transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-16 text-right" style={{ color: theme.textColor, opacity: isNightOrEvening ? 0.8 : 0.7 }}>
                {percentage.toFixed(0)}% ({count})
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Theme styles for the modal content
  const modalContentStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, ${theme.gradient.start}, ${theme.gradient.end})`,
    color: theme.textColor,
    borderColor: theme.chrome.border,
    transition: 'background 2s ease, color 2s ease, border-color 2s ease',
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        style={modalContentStyle}
      >
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <DialogTitle className="text-2xl font-bold" style={{ color: theme.textColor }}>
                  {chatbot.title}
                </DialogTitle>
                {isSignedIn && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleToggleFavorite}
                    disabled={isTogglingFavorite}
                    className="h-8 w-8"
                  >
                    {isTogglingFavorite ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Heart
                        className={`h-4 w-4 ${
                          isFavorite ? 'fill-red-500 text-red-500' : ''
                        }`}
                      />
                    )}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {chatbot.type && (
                  <Badge variant="secondary">
                    {formatChatbotType(chatbot.type)}
                  </Badge>
                )}
                {chatbot.priceCents === 0 && (
                  <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                    Free
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Creator Section */}
          <div className="flex items-center gap-3">
            {chatbot.creator.avatarUrl ? (
              <div className="relative w-12 h-12 rounded-full overflow-hidden">
                <Image
                  src={chatbot.creator.avatarUrl}
                  alt={chatbot.creator.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-500 text-lg">
                  {chatbot.creator.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1">
              <Link
                href={`/creators/${chatbot.creator.slug}`}
                className="text-lg font-semibold hover:underline"
                onClick={onClose}
                style={{ color: theme.textColor }}
              >
                {chatbot.creator.name}
              </Link>
            </div>
          </div>

          {/* Description */}
          {chatbot.description && (
            <div>
              <h3 className="font-semibold mb-2" style={{ color: theme.textColor }}>Description</h3>
              <p className="whitespace-pre-wrap" style={{ color: theme.textColor, opacity: isNightOrEvening ? 0.9 : 0.85 }}>
                {chatbot.description}
              </p>
            </div>
          )}

          {/* Categories */}
          {chatbot.categories.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2" style={{ color: theme.textColor }}>Categories</h3>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {(['ROLE', 'CHALLENGE', 'STAGE'] as CategoryType[]).map(
                  (type) => {
                    const cats = groupedCategories[type];
                    if (!cats || cats.length === 0) return null;
                    
                    return (
                      <div key={type} className="flex items-center gap-2">
                        <span className="text-sm font-medium capitalize whitespace-nowrap" style={{ color: theme.textColor, opacity: isNightOrEvening ? 0.8 : 0.7 }}>
                          {type.toLowerCase()}:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {cats.map((cat) => (
                            <Badge key={cat.id} variant="outline" className="text-xs">
                              {cat.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}

          {/* Ratings & Reviews Section */}
          <div>
            <h3 className="font-semibold mb-3" style={{ color: theme.textColor }}>Ratings & Reviews</h3>
            {chatbot.rating && chatbot.rating.ratingCount > 0 ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  {renderStars(chatbot.rating.averageRating)}
                  <span className="text-lg font-semibold" style={{ color: theme.textColor }}>
                    {chatbot.rating.averageRating?.toFixed(1)}
                  </span>
                  <span style={{ color: theme.textColor, opacity: isNightOrEvening ? 0.8 : 0.7 }}>
                    ({chatbot.rating.ratingCount}{' '}
                    {chatbot.rating.ratingCount === 1 ? 'review' : 'reviews'})
                  </span>
                </div>
                {renderRatingDistribution()}
              </>
            ) : (
              <p className="mb-3" style={{ color: theme.textColor, opacity: isNightOrEvening ? 0.8 : 0.7 }}>No ratings yet</p>
            )}

            {/* Reviews List */}
            {isLoadingReviews && reviews.length === 0 ? (
              <div className="space-y-4 mt-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : reviewsError ? (
              <p className="text-red-600 mt-4">{reviewsError}</p>
            ) : reviews.length === 0 ? (
              chatbot.rating && chatbot.rating.ratingCount > 0 ? null : (
                <p className="mt-4" style={{ color: theme.textColor, opacity: isNightOrEvening ? 0.8 : 0.7 }}>No reviews yet</p>
              )
            ) : (
              <div className="space-y-4 mt-4">
                {reviews.map((review) => (
                  <div key={review.id} className="border-b pb-4 last:border-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium" style={{ color: theme.textColor }}>
                          {review.userName || 'Anonymous'}
                        </span>
                        {review.rating && renderStars(review.rating)}
                        <span className="text-xs" style={{ color: theme.textColor, opacity: isNightOrEvening ? 0.7 : 0.6 }}>
                          {formatRelativeTime(review.createdAt)}
                        </span>
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-sm mb-2" style={{ color: theme.textColor, opacity: isNightOrEvening ? 0.9 : 0.85 }}>{review.comment}</p>
                    )}
                    {review.timeSaved && (
                      <p className="text-xs" style={{ color: theme.textColor, opacity: isNightOrEvening ? 0.7 : 0.6 }}>
                        Saved {review.timeSaved.toLowerCase()}
                      </p>
                    )}
                  </div>
                ))}
                {hasMoreReviews && (
                  <Button
                    variant="outline"
                    onClick={() => fetchReviews(reviewsPage + 1)}
                    disabled={isLoadingReviews}
                    className="w-full"
                  >
                    {isLoadingReviews ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More Reviews'
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <Button
              onClick={handleStartChat}
              disabled={chatbot.priceCents > 0}
              className="flex-1"
              size="lg"
              title={
                chatbot.priceCents > 0
                  ? 'Payment coming soon'
                  : undefined
              }
            >
              {chatbot.priceCents > 0 ? 'Payment Coming Soon' : 'Start Chat'}
            </Button>
            {isSignedIn && chatbot.publicDashboard && (
              <Link href={`/dashboard/${chatbot.id}`} onClick={onClose}>
                <Button
                  variant="outline"
                  size="lg"
                >
                  View Dashboard
                </Button>
              </Link>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

