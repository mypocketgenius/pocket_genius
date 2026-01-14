'use client';

// Phase 3.7.4: Homepage Component with Grid Layout
// Amazon-style homepage with categorized chatbot grids, search, and filters

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChatbotCard } from '@/components/chatbot-card';
import { CreatorCard } from '@/components/creator-card';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { AppHeader } from '@/components/app-header';
import Image from 'next/image';
import { ChatbotType, CategoryType } from '@/lib/types/chatbot';

interface Chatbot {
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
  favoriteCount: number;
  isFavorite?: boolean; // Only included if user is authenticated
}

interface Category {
  id: string;
  type: CategoryType;
  label: string;
  slug: string;
}

interface Creator {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  shortBio: string | null;
  chatbotCount: number;
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
 * Homepage Component - Amazon-style chatbot browsing
 * 
 * Features:
 * - Hero section with search
 * - Category filters (ROLE, CHALLENGE, STAGE)
 * - Creator filter (searchable dropdown)
 * - Chatbot type filter (checkboxes)
 * - Categorized grids or filtered grid
 * - "Load More" pagination
 * - Loading states, empty states, error handling
 */
function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn } = useAuth();

  // URL state
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    searchParams.getAll('category')
  );
  const [selectedCategoryTypes, setSelectedCategoryTypes] = useState<CategoryType[]>(
    (searchParams.getAll('categoryType') as CategoryType[]) || []
  );
  const [selectedCreator, setSelectedCreator] = useState<string>(
    searchParams.get('creator') || ''
  );
  const [selectedTypes, setSelectedTypes] = useState<ChatbotType[]>(
    (searchParams.getAll('type') as ChatbotType[]) || []
  );
  const [currentPage, setCurrentPage] = useState(1);

  // Sync searchQuery with URL params (only when URL changes, not when searchQuery changes)
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    setSearchQuery(prev => {
      // Only update if URL search differs from current state
      if (urlSearch !== prev) {
        return urlSearch;
      }
      return prev;
    });
  }, [searchParams]);

  // Debounced search
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Data state
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingCreators, setIsLoadingCreators] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<ChatbotsResponse['pagination'] | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  // Track client-side mount to avoid hydration mismatches
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch categories and creators on mount
  useEffect(() => {
    const fetchFilters = async () => {
      setIsLoadingCreators(true);
      try {
        const [categoriesRes, creatorsRes] = await Promise.all([
          fetch('/api/categories'),
          fetch('/api/creators'),
        ]);

        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          setCategories(categoriesData.categories || []);
        }

        if (creatorsRes.ok) {
          const creatorsData = await creatorsRes.json();
          setCreators(creatorsData.creators || []);
        }
      } catch (err) {
        console.error('Error fetching filters:', err);
      } finally {
        setIsLoadingCreators(false);
      }
    };

    fetchFilters();
  }, []);

  // Fetch chatbots from API
  const fetchChatbots = useCallback(async (page: number, reset: boolean = false) => {
    if (reset) {
      setIsLoading(true);
      setError(null);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('pageSize', '20');
      
      if (debouncedSearch) params.set('search', debouncedSearch);
      selectedCategories.forEach(cat => params.append('category', cat));
      selectedCategoryTypes.forEach(type => params.append('categoryType', type));
      if (selectedCreator) params.set('creator', selectedCreator);
      selectedTypes.forEach(type => params.append('type', type));

      const response = await fetch(`/api/chatbots/public?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch chatbots');
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
        // Merge with existing favorites (don't remove favorites that aren't in this page)
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
      console.error('Error fetching chatbots:', err);
      setError('Unable to load chatbots. Please try again.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [debouncedSearch, selectedCategories, selectedCategoryTypes, selectedCreator, selectedTypes]);

  // Fetch chatbots when filters/search change
  useEffect(() => {
    fetchChatbots(1, true);
  }, [fetchChatbots]);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (debouncedSearch) params.set('search', debouncedSearch);
    selectedCategories.forEach(cat => params.append('category', cat));
    selectedCategoryTypes.forEach(type => params.append('categoryType', type));
    if (selectedCreator) params.set('creator', selectedCreator);
    selectedTypes.forEach(type => params.append('type', type));
    if (currentPage > 1) params.set('page', currentPage.toString());

    router.replace(`/?${params.toString()}`, { scroll: false });
  }, [debouncedSearch, selectedCategories, selectedCategoryTypes, selectedCreator, selectedTypes, currentPage, router]);

  // Handle "Load More" button
  const handleLoadMore = () => {
    if (pagination && currentPage < pagination.totalPages) {
      fetchChatbots(currentPage + 1, false);
    }
  };

  // Filter handlers
  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleCategoryType = (type: CategoryType) => {
    setSelectedCategoryTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const toggleType = (type: ChatbotType) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCategories([]);
    setSelectedCategoryTypes([]);
    setSelectedCreator('');
    setSelectedTypes([]);
    setCurrentPage(1);
  };

  const handleFavoriteToggle = (chatbotId: string, isFavorite: boolean) => {
    setFavorites(prev => {
      const newSet = new Set(prev);
      if (isFavorite) {
        newSet.add(chatbotId);
      } else {
        newSet.delete(chatbotId);
      }
      return newSet;
    });
  };

  // Group chatbots by category type (for display when no filters active)
  const groupedChatbots = chatbots.reduce(
    (acc, chatbot) => {
      chatbot.categories.forEach(cat => {
        if (!acc[cat.type]) {
          acc[cat.type] = [];
        }
        // Avoid duplicates by checking if chatbot already exists in this category type
        if (!acc[cat.type].some(c => c.id === chatbot.id)) {
          acc[cat.type].push(chatbot);
        }
      });
      // If chatbot has no categories, add to "All" (we'll handle this separately)
      return acc;
    },
    {} as Record<CategoryType, Chatbot[]>
  );

  // Check if any filters are active
  const hasActiveFilters =
    debouncedSearch ||
    selectedCategories.length > 0 ||
    selectedCategoryTypes.length > 0 ||
    selectedCreator ||
    selectedTypes.length > 0;

  // Render chatbot grid
  const renderChatbotGrid = (chatbotsToRender: Chatbot[]) => {
    if (chatbotsToRender.length === 0) return null;

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {chatbotsToRender.map(chatbot => (
          <ChatbotCard
            key={chatbot.id}
            chatbot={chatbot}
            isFavorite={favorites.has(chatbot.id)}
            onFavoriteToggle={handleFavoriteToggle}
          />
        ))}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header with search */}
      <AppHeader />

      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2">
            Turn Any Expert Into Your Advisor
          </h2>
          <p className="text-muted-foreground mb-6">
            AI trained on their work. Personalized to your situation.
          </p>
        </div>

        {/* Filters Section */}
        <div className="mb-8 space-y-4">
          {/* Category Type Filters */}
          <div>
            <h3 className="text-sm font-medium mb-2">Filter by Category Type</h3>
            <div className="flex flex-wrap gap-2">
              {(['ROLE', 'CHALLENGE', 'STAGE'] as CategoryType[]).map(type => (
                <Button
                  key={type}
                  variant={selectedCategoryTypes.includes(type) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleCategoryType(type)}
                >
                  {type === 'ROLE' ? 'By Role' : type === 'CHALLENGE' ? 'By Challenge' : 'By Stage'}
                </Button>
              ))}
            </div>
          </div>

          {/* Category Filters */}
          {selectedCategoryTypes.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Categories</h3>
              <div className="flex flex-wrap gap-2">
                {categories
                  .filter(cat => selectedCategoryTypes.includes(cat.type))
                  .map(category => (
                    <Badge
                      key={category.id}
                      variant={selectedCategories.includes(category.id) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleCategory(category.id)}
                    >
                      {category.label}
                    </Badge>
                  ))}
              </div>
            </div>
          )}

          {/* Creator Filter */}
          <div>
            <h3 className="text-sm font-medium mb-2">Creator</h3>
            <select
              value={selectedCreator}
              onChange={(e) => setSelectedCreator(e.target.value)}
              className="w-full md:w-64 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All Creators</option>
              {creators.map(creator => (
                <option key={creator.id} value={creator.id}>
                  {creator.name}
                </option>
              ))}
            </select>
          </div>

          {/* Chatbot Type Filters */}
          <div>
            <h3 className="text-sm font-medium mb-2">Chatbot Type</h3>
            <div className="flex flex-wrap gap-4">
              {mounted ? (
                (['BODY_OF_WORK', 'FRAMEWORK', 'DEEP_DIVE', 'ADVISOR_BOARD'] as ChatbotType[]).map(type => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={type}
                      checked={selectedTypes.includes(type)}
                      onCheckedChange={() => toggleType(type)}
                    />
                    <label
                      htmlFor={type}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {type.replace(/_/g, ' ')}
                    </label>
                  </div>
                ))
              ) : (
                // Render placeholder during SSR to maintain layout
                (['BODY_OF_WORK', 'FRAMEWORK', 'DEEP_DIVE', 'ADVISOR_BOARD'] as ChatbotType[]).map(type => (
                  <div key={type} className="flex items-center space-x-2">
                    <div className="h-4 w-4 rounded-sm border border-primary" />
                    <label className="text-sm font-medium leading-none">
                      {type.replace(/_/g, ' ')}
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">Active filters:</span>
              {debouncedSearch && (
                <Badge variant="secondary" className="gap-1">
                  Search: {debouncedSearch}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setSearchQuery('')}
                  />
                </Badge>
              )}
              {selectedCategories.map(catId => {
                const cat = categories.find(c => c.id === catId);
                return cat ? (
                  <Badge key={catId} variant="secondary" className="gap-1">
                    {cat.label}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => toggleCategory(catId)}
                    />
                  </Badge>
                ) : null;
              })}
              {selectedCategoryTypes.map(type => (
                <Badge key={type} variant="secondary" className="gap-1">
                  {type}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => toggleCategoryType(type)}
                  />
                </Badge>
              ))}
              {selectedCreator && (
                <Badge variant="secondary" className="gap-1">
                  Creator: {creators.find(c => c.id === selectedCreator)?.name || selectedCreator}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setSelectedCreator('')}
                  />
                </Badge>
              )}
              {selectedTypes.map(type => (
                <Badge key={type} variant="secondary" className="gap-1">
                  {type.replace(/_/g, ' ')}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => toggleType(type)}
                  />
                </Badge>
              ))}
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                Clear all
              </Button>
            </div>
          )}
        </div>

        {/* Creators Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Creators</h2>
          
          {/* Loading State for Creators */}
          {isLoadingCreators && (
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

          {/* Creators Grid */}
          {!isLoadingCreators && (
            <>
              {creators.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground text-lg">
                    Error returning creators
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {creators.map(creator => (
                    <CreatorCard key={creator.id} creator={creator} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Error State */}
        {error && (
          <Alert variant="destructive" className="mb-8">
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={() => fetchChatbots(1, true)}>
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

        {/* Chatbot Grids */}
        {!isLoading && !error && (
          <>
            {hasActiveFilters ? (
              // Show filtered results in single grid
              <div>
                <h2 className="text-2xl font-bold mb-4">Search Results</h2>
                {chatbots.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground text-lg">
                      {debouncedSearch
                        ? 'No chatbots found matching your search'
                        : 'No chatbots match your filters'}
                    </p>
                  </div>
                ) : (
                  <>
                    {renderChatbotGrid(chatbots)}
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
            ) : (
              // Show categorized grids
              <div className="space-y-12">
                {(['ROLE', 'CHALLENGE', 'STAGE'] as CategoryType[]).map(categoryType => {
                  const chatbotsInCategory = groupedChatbots[categoryType] || [];
                  if (chatbotsInCategory.length === 0) return null;

                  return (
                    <div key={categoryType}>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold">
                          {categoryType === 'ROLE'
                            ? 'By Role'
                            : categoryType === 'CHALLENGE'
                            ? 'By Challenge'
                            : 'By Stage'}
                        </h2>
                        {chatbotsInCategory.length > 6 && (
                          <Button variant="link" size="sm">
                            See all
                          </Button>
                        )}
                      </div>
                      {renderChatbotGrid(
                        chatbotsInCategory.slice(0, 6)
                      )}
                    </div>
                  );
                })}

                {/* All Chatbots fallback if no categories */}
                {Object.keys(groupedChatbots).length === 0 && chatbots.length > 0 && (
                  <div>
                    <h2 className="text-2xl font-bold mb-4">All Chatbots</h2>
                    {renderChatbotGrid(chatbots)}
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
                  </div>
                )}

                {/* Empty state */}
                {chatbots.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground text-lg">
                      No chatbots available yet
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background">
          <AppHeader />
          <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-48 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
