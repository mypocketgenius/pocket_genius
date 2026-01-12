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
              <span className="w-8">{star}★</span>
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400 transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-16 text-right text-gray-600">
                {percentage.toFixed(0)}% ({count})
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl font-bold mb-2">
                {chatbot.title}
              </DialogTitle>
              {chatbot.type && (
                <Badge variant="secondary" className="mt-1">
                  {formatChatbotType(chatbot.type)}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Creator Section */}
          <div className="flex items-start gap-3">
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
              >
                {chatbot.creator.name}
              </Link>
            </div>
          </div>

          {/* Description */}
          {chatbot.description && (
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-gray-700 whitespace-pre-wrap">
                {chatbot.description}
              </p>
            </div>
          )}

          {/* Categories */}
          {chatbot.categories.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Categories</h3>
              <div className="space-y-3">
                {(['ROLE', 'CHALLENGE', 'STAGE'] as CategoryType[]).map(
                  (type) => {
                    const cats = groupedCategories[type];
                    if (!cats || cats.length === 0) return null;
                    
                    return (
                      <div key={type}>
                        <span className="text-sm font-medium text-gray-600 capitalize">
                          {type.toLowerCase()}:
                        </span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {cats.map((cat) => (
                            <Badge key={cat.id} variant="outline">
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

          {/* Rating Section */}
          {chatbot.rating && chatbot.rating.ratingCount > 0 ? (
            <div>
              <h3 className="font-semibold mb-2">Ratings</h3>
              <div className="flex items-center gap-3">
                {renderStars(chatbot.rating.averageRating)}
                <span className="text-lg font-semibold">
                  {chatbot.rating.averageRating?.toFixed(1)}
                </span>
                <span className="text-gray-600">
                  ({chatbot.rating.ratingCount}{' '}
                  {chatbot.rating.ratingCount === 1 ? 'review' : 'reviews'})
                </span>
              </div>
              {renderRatingDistribution()}
            </div>
          ) : (
            <div>
              <h3 className="font-semibold mb-2">Ratings</h3>
              <p className="text-gray-600">No ratings yet</p>
            </div>
          )}

          {/* Reviews List */}
          <div>
            <h3 className="font-semibold mb-3">Reviews</h3>
            {isLoadingReviews && reviews.length === 0 ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : reviewsError ? (
              <p className="text-red-600">{reviewsError}</p>
            ) : reviews.length === 0 ? (
              <p className="text-gray-600">No reviews yet</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="border-b pb-4 last:border-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {review.userName || 'Anonymous'}
                        </span>
                        {review.rating && renderStars(review.rating)}
                      </div>
                      {review.timeSaved && (
                        <span className="text-sm text-gray-600">
                          {review.timeSaved}
                        </span>
                      )}
                    </div>
                    {review.comment && (
                      <p className="text-gray-700 text-sm">{review.comment}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </p>
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

          {/* Pricing Section */}
          <div>
            <h3 className="font-semibold mb-2">Pricing</h3>
            <div className="flex items-center gap-4">
              <Badge variant={chatbot.priceCents === 0 ? 'default' : 'secondary'}>
                {formatPrice()}
              </Badge>
              <span className="text-sm text-gray-600">
                {chatbot.allowAnonymous
                  ? 'Anonymous users allowed'
                  : 'Login required'}
              </span>
            </div>
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
            {isSignedIn && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleToggleFavorite}
                disabled={isTogglingFavorite}
                className="h-10 w-10"
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

