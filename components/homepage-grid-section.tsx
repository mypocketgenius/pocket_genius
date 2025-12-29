import { Chatbot } from '@/lib/types/chatbot';
import { ChatbotCard } from '@/components/chatbot-card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

// Pagination type (matches API response)
interface Pagination {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

interface HomepageGridSectionProps {
  title: string;
  description: string;
  chatbots: Chatbot[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  pagination: Pagination | null;
  currentPage: number;
  onLoadMore: () => void;
  onRetry: () => void;
  favorites: Set<string>;
  onFavoriteToggle: (chatbotId: string, isFavorite: boolean) => void;
}

/**
 * HomepageGridSection Component
 * 
 * Displays a grid section for chatbots with:
 * - Title and description
 * - Loading skeleton state
 * - Error state with retry button
 * - Empty state message
 * - Grid of chatbot cards
 * - "Load More" button for pagination
 * 
 * This component is reusable for all chatbot type grids (Frameworks, Deep Dives, etc.)
 */
export function HomepageGridSection({
  title,
  description,
  chatbots,
  isLoading,
  isLoadingMore,
  error,
  pagination,
  currentPage,
  onLoadMore,
  onRetry,
  favorites,
  onFavoriteToggle,
}: HomepageGridSectionProps) {
  const renderChatbotGrid = (chatbotsToRender: Chatbot[]) => {
    if (chatbotsToRender.length === 0) return null;
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {chatbotsToRender.map(chatbot => (
          <ChatbotCard
            key={chatbot.id}
            chatbot={chatbot}
            isFavorite={favorites.has(chatbot.id)}
            onFavoriteToggle={onFavoriteToggle}
          />
        ))}
      </div>
    );
  };

  return (
    <section className="mb-12">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>
      
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : chatbots.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">No {title.toLowerCase()} available yet</p>
        </div>
      ) : (
        <>
          {renderChatbotGrid(chatbots)}
          {pagination && currentPage < pagination.totalPages && (
            <div className="flex justify-center mt-8">
              <Button 
                onClick={onLoadMore} 
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
        </>
      )}
    </section>
  );
}

