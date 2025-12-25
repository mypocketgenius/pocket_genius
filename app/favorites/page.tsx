'use client';

// Phase 3.7.6: Favorites Page
// Displays user's favorited chatbots in a grid layout

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChatbotCard } from '@/components/chatbot-card';
import { AppHeader } from '@/components/app-header';

// Type definitions matching the API response format
type ChatbotType = 'CREATOR' | 'FRAMEWORK' | 'DEEP_DIVE' | 'ADVISOR_BOARD';
type CategoryType = 'ROLE' | 'CHALLENGE' | 'STAGE';

interface Chatbot {
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
  favoriteCount: number;
  isFavorite: boolean; // Always true for favorites
}

interface ChatbotsResponse {
  chatbots: Chatbot[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
  };
}

/**
 * Favorites Page Component
 * 
 * Features:
 * - Requires authentication (redirects to login if not authenticated)
 * - Shows grid of favorited chatbots
 * - "Load More" pagination
 * - Empty state when no favorites
 * - Loading states and error handling
 */
export default function FavoritesPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<ChatbotsResponse['pagination'] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Redirect to login if not authenticated
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in');
    }
  }, [isLoaded, isSignedIn, router]);

  // Fetch favorites from API
  const fetchFavorites = useCallback(async (page: number, reset: boolean = false) => {
    if (!isSignedIn) return;

    if (reset) {
      setIsLoading(true);
      setError(null);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const response = await fetch(`/api/favorites?page=${page}&pageSize=20`);

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/sign-in');
          return;
        }
        throw new Error('Failed to fetch favorites');
      }

      const data: ChatbotsResponse = await response.json();

      // Sync favorites from API response
      const newFavorites = new Set<string>();
      data.chatbots.forEach(chatbot => {
        if (chatbot.isFavorite) {
          newFavorites.add(chatbot.id);
        }
      });
      setFavorites(prev => {
        const merged = new Set(prev);
        newFavorites.forEach(id => merged.add(id));
        return merged;
      });

      if (reset) {
        setChatbots(data.chatbots);
      } else {
        setChatbots(prev => [...prev, ...data.chatbots]);
      }

      setPagination(data.pagination);
      setCurrentPage(page);
    } catch (err) {
      console.error('Error fetching favorites:', err);
      setError('Unable to load favorites. Please try again.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [isSignedIn, router]);

  // Fetch favorites on mount
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchFavorites(1, true);
    }
  }, [isLoaded, isSignedIn, fetchFavorites]);

  // Handle "Load More" button
  const handleLoadMore = () => {
    if (pagination && currentPage < pagination.totalPages) {
      fetchFavorites(currentPage + 1, false);
    }
  };

  // Handle favorite toggle
  const handleFavoriteToggle = (chatbotId: string, isFavorite: boolean) => {
    setFavorites(prev => {
      const newSet = new Set(prev);
      if (isFavorite) {
        newSet.add(chatbotId);
      } else {
        newSet.delete(chatbotId);
        // Remove from chatbots list if unfavorited
        setChatbots(prevChatbots => prevChatbots.filter(c => c.id !== chatbotId));
      }
      return newSet;
    });
  };

  // Don't render if not authenticated (will redirect)
  if (!isLoaded || !isSignedIn) {
    return null;
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <AppHeader />

      <div className="container mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Your Favorites</h1>
          <p className="text-muted-foreground">
            Chatbots you&apos;ve saved for quick access
          </p>
        </div>

        {/* Error State */}
        {error && (
          <Alert variant="destructive" className="mb-8">
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={() => fetchFavorites(1, true)}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && chatbots.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg mb-4">
              You haven&apos;t favorited any chatbots yet
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Browse chatbots and click the heart icon to add them to your favorites
            </p>
            <Button onClick={() => router.push('/')} variant="outline">
              Browse Chatbots
            </Button>
          </div>
        )}

        {/* Favorites Grid */}
        {!isLoading && !error && chatbots.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {chatbots.map(chatbot => (
                <ChatbotCard
                  key={chatbot.id}
                  chatbot={chatbot}
                  isFavorite={favorites.has(chatbot.id)}
                  onFavoriteToggle={handleFavoriteToggle}
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination && currentPage < pagination.totalPages && (
              <div className="flex justify-center mt-8">
                <Button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  variant="outline"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}

            {pagination && currentPage >= pagination.totalPages && (
              <div className="text-center mt-8 text-muted-foreground">
                <p>You&apos;ve reached the end</p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

