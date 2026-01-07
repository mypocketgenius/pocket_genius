import { useCreators } from '@/lib/hooks/use-creators';
import { CreatorCard } from '@/components/creator-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/**
 * HomepageCreatorsSection Component
 * 
 * Displays the creators grid section on the homepage with:
 * - Title and description
 * - Loading skeleton state
 * - Error state with retry button
 * - Empty state message
 * - Grid of creator cards
 * 
 * Uses the useCreators hook internally to fetch and manage creators data.
 */
export function HomepageCreatorsSection() {
  const { creators, isLoading, error, refetch } = useCreators();

  return (
    <section className="mb-12">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Our Experts</h2>
        <p className="text-muted-foreground">Browse experts and get personalized guidance from their AI Advisors</p>
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
            <Button variant="outline" size="sm" onClick={refetch}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : creators.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">No creators available yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {creators.map(creator => (
            <CreatorCard key={creator.id} creator={creator} />
          ))}
        </div>
      )}
    </section>
  );
}

