# Homepage Simplified Grids Refactor

## Objective
Refactor the homepage to remove all filter UI and display five fixed grids: Creators, Frameworks, Deep Dives, Body of Work, and Advisor Boards. Each grid will use a separate API call.

## Acceptance Criteria
- [ ] All filter UI components removed (category type filters, category badges, creator dropdown, chatbot type checkboxes, active filters display)
- [ ] Homepage displays exactly 5 rows in order:
  1. Grid of creators (profiles)
  2. Grid of chatbots by frameworks (type='FRAMEWORK')
  3. Grid of chatbots by deep dives (type='DEEP_DIVE')
  4. Grid of chatbots by body of work (type='BODY_OF_WORK')
  5. Grid of chatbots by advisor boards (type='ADVISOR_BOARD')
- [ ] Each chatbot grid uses a separate API call to `/api/chatbots/public?type={TYPE}&pageSize=6`
- [ ] Each chatbot grid shows 6 items initially with "Load More" button
- [ ] Each chatbot grid has pagination state and can load more items
- [ ] Creators grid uses existing `/api/creators` endpoint
- [ ] Empty grids show empty state message (not hidden)
- [ ] Each grid has its own loading state with skeleton loaders
- [ ] Each grid has its own error state (individual error messages with retry buttons)
- [ ] Each grid section has a title and short descriptive paragraph text underneath
- [ ] Search functionality remains in header (AppHeader component) but does NOT affect homepage grids
- [ ] Search only affects dropdown results and "see all results" page
- [ ] Hero section remains unchanged

## Clarifying Questions
1. **Items per grid**: How many chatbots should each grid show? ✅ **ANSWERED: 6 per grid**
2. **Pagination**: Should each grid have "Load More" functionality, or show fixed number? ✅ **ANSWERED: Load More per grid**
3. **Empty state**: Should empty grids be hidden or shown with message? ✅ **ANSWERED: Empty state message**
4. **Section headers**: Exact titles? ✅ **ANSWERED: Yes, with short paragraph text underneath**
5. **Search**: Keep search in header? ✅ **ANSWERED: Yes, but it NO LONGER affects homepage - only dropdown and "see all results" page**
6. **Hero section**: Keep hero section? ✅ **ANSWERED: Yes**
7. **Grid order**: Confirm order matches specification? ✅ **ANSWERED: Yes**
8. **Loading states**: Individual skeletons per grid or single loading state? ✅ **ANSWERED: Skeletons per grid**

## Confirmed Requirements
- 6 items per chatbot grid initially
- "Load More" button per grid with pagination
- Empty grids show empty state message (not hidden)
- Section headers with descriptive paragraph text underneath
- Search in header does NOT affect homepage grids (only dropdown/search results page)
- Keep hero section
- Individual skeleton loading states per grid
- Individual error states per grid (show error message with retry button)

## Minimal Approach
0. **PREREQUISITE**: Rename chatbot type from `CREATOR` to `BODY_OF_WORK` (Task -1: database migration + type updates)
   - **CRITICAL**: Complete Task -1 entirely before proceeding to Task 0
   - Migration order: Update data → Update schema → Create migration → Update code → Verify
   - See Task -1 for detailed migration steps including data migration script
1. Remove all filter-related state and UI from `app/page.tsx`
2. Remove search query effects on homepage (search handled by AppHeader only)
3. **Extract reusable `useChatbotGrid` hook** to manage grid state (chatbots, pagination, loading, errors)
4. **Create `HomepageGridSection` component** for reusable grid section rendering
5. **Use single generic `fetchChatbotsByType` function** instead of 4 duplicate functions
6. **Load all grids in parallel** using `Promise.all` for better performance
7. Add pagination state and "Load More" functionality for each chatbot grid
8. Update rendering logic to show 5 fixed grids with section headers and descriptions
9. Add empty state messages for grids (instead of hiding them)
10. Simplify component by removing filter handlers and URL param syncing for filters
11. **Split component into smaller files** to stay within architectural limits

## Text Diagram

```
Homepage Structure:
├── AppHeader (with search - does NOT affect homepage)
├── Hero Section
│   └── "Turn Any Expert Into Your Advisor"
└── Grid Sections (in order, always shown)
    ├── Creators Grid
    │   ├── Title: "Creators"
    │   ├── Description: "Discover experts and thought leaders"
    │   ├── API: GET /api/creators
    │   └── Empty state if no creators
    ├── Frameworks Grid
    │   ├── Title: "Frameworks"
    │   ├── Description: "Structured methodologies and approaches"
    │   ├── API: GET /api/chatbots/public?type=FRAMEWORK&pageSize=6&page={page}
    │   ├── Load More button (if more pages)
    │   └── Empty state if no frameworks
    ├── Deep Dives Grid
    │   ├── Title: "Deep Dives"
    │   ├── Description: "In-depth explorations and analyses"
    │   ├── API: GET /api/chatbots/public?type=DEEP_DIVE&pageSize=6&page={page}
    │   ├── Load More button (if more pages)
    │   └── Empty state if no deep dives
    ├── Body of Work Grid
    │   ├── Title: "Body of Work"
    │   ├── Description: "AI advisors trained on comprehensive creator content"
    │   ├── API: GET /api/chatbots/public?type=BODY_OF_WORK&pageSize=6&page={page}
    │   ├── Load More button (if more pages)
    │   └── Empty state if no body of work chatbots
    └── Advisor Boards Grid
        ├── Title: "Advisor Boards"
        ├── Description: "Collective wisdom from expert panels"
        ├── API: GET /api/chatbots/public?type=ADVISOR_BOARD&pageSize=6&page={page}
        ├── Load More button (if more pages)
        └── Empty state if no advisor boards
```

## Plan File Contents

### Architectural Refactoring (NEW)

**Goal**: Reduce code duplication and maintainability issues by extracting reusable patterns.

#### New Files to Create

**File: `lib/hooks/use-chatbot-grid.ts`** (~80 lines)
- Custom hook to manage chatbot grid state (chatbots, pagination, loading, errors)
- Generic `fetchChatbotsByType` function (replaces 4 duplicate functions)
- Exposes `syncFavorites` method to extract favorites from chatbots array
- Returns: `{ chatbots, page, pagination, isLoading, isLoadingMore, error, loadMore, retry, syncFavorites }`
- **TypeScript types**: 
  - Imports `Chatbot`, `ChatbotType` from `@/lib/types/chatbot`
  - Defines `Pagination` interface locally (matches API response format)
  - Note: `Chatbot` type includes optional `isFavorite?: boolean` field from API

**File: `components/homepage-grid-section.tsx`** (~60 lines)
- Reusable component for rendering a grid section
- Props: `title`, `description`, `chatbots`, `isLoading`, `isLoadingMore`, `error`, `pagination`, `currentPage`, `onLoadMore`, `onRetry`, `favorites`, `onFavoriteToggle`
- Handles: skeleton loading, error state, empty state, grid rendering, Load More button
- Uses existing `renderChatbotGrid` pattern internally
- **TypeScript types**: Uses existing `Chatbot`, `Pagination` types, creates `HomepageGridSectionProps` interface

**File: `lib/types/creator.ts`** (~15 lines) - **NEW: Consistency improvement**
- Shared type definition for Creator entity (person/entity who creates chatbots)
- Matches API response format from `/api/creators`
- Exports `Creator` interface: `{ id, slug, name, avatarUrl, bio, chatbotCount }`
- **Rationale**: Consistency with how `Chatbot` type is handled in `lib/types/chatbot.ts`
- **Note**: This is optional but improves maintainability and type consistency across codebase

#### Refactored Files

**File: `app/page.tsx`** (~100 lines after refactor)
- Main page component (simplified)
- Uses `useChatbotGrid` hook for each chatbot type grid
- Uses `HomepageGridSection` component for rendering
- Manages creators state and favorites state
- **Note**: Grids load in parallel naturally (each hook's useEffect fires independently on mount)

### Component Structure Changes

**File: `app/page.tsx`**

#### State Simplification
- Remove: `selectedCategories`, `selectedCategoryTypes`, `selectedCreator`, `selectedTypes`
- Remove: `categories` state (no longer needed for filters)
- Remove: `searchQuery` and `debouncedSearch` (search no longer affects homepage)
- Remove: `useSearchParams` and `useRouter` for filters (search handled by AppHeader)
- Keep: `creators` state (for creators grid)
- Keep: `favorites` state (for favorite toggles)
- **Use `useChatbotGrid` hook** for each chatbot type (replaces individual state variables)
  - `frameworksGrid = useChatbotGrid('FRAMEWORK')`
  - `deepDivesGrid = useChatbotGrid('DEEP_DIVE')`
  - `bodyOfWorkGrid = useChatbotGrid('BODY_OF_WORK')`
  - `advisorBoardsGrid = useChatbotGrid('ADVISOR_BOARD')`

#### API Calls
- Creators: `GET /api/creators` (existing, keep as is)
- Chatbots: `GET /api/chatbots/public?type={TYPE}&pageSize=6&page={page}` (single generic endpoint)
  - Types: `FRAMEWORK`, `DEEP_DIVE`, `BODY_OF_WORK`, `ADVISOR_BOARD`

**Performance Optimization**: Grids load in parallel naturally - each `useChatbotGrid` hook fires its `useEffect` independently on mount, and `fetchCreators` runs in parallel. No explicit `Promise.all` needed since hooks handle their own loading.

**Note**: Each chatbot grid manages its own pagination state via `useChatbotGrid` hook. The hook's internal `useEffect` automatically fetches page 1 on mount.

#### Removed Functions
- `toggleCategory`
- `toggleCategoryType`
- `toggleType`
- `clearAllFilters`
- `fetchChatbots` (replaced with `useChatbotGrid` hook)
- `groupedChatbots` logic
- `hasActiveFilters` logic
- Individual fetch functions (replaced with generic `fetchChatbotsByType` in hook)

#### New Functions/Components

**In `lib/hooks/use-chatbot-grid.ts`:**
- `useChatbotGrid(type: ChatbotType)` - custom hook that manages grid state
  - Returns: `{ chatbots, page, pagination, isLoading, isLoadingMore, error, loadMore, retry }`
  - Internal: `fetchChatbotsByType(type, page, reset)` - generic fetch function
  - Internal: Handles favorites syncing automatically

**In `components/homepage-grid-section.tsx`:**
- `HomepageGridSection` component - renders complete grid section with all states
  - Props: `title`, `description`, `chatbots`, `isLoading`, `isLoadingMore`, `error`, `pagination`, `currentPage`, `onLoadMore`, `onRetry`, `favorites`, `onFavoriteToggle`
  - Handles: skeleton loading, error state, empty state, grid rendering, Load More button
  - Uses existing `renderChatbotGrid` pattern internally

**In `app/page.tsx`:**
- `handleFavoriteToggle` - keep existing (works with ChatbotCard component)
- `fetchCreators` - fetch creators (simple function)

#### UI Changes
- Remove entire "Filters Section" (category type buttons, category badges, creator dropdown, type checkboxes, active filters display)
- Remove conditional rendering logic for filtered vs categorized display
- Remove search query effects on chatbot fetching
- Replace with simple sequential grid rendering:
  1. Creators grid (with title and description)
  2. Frameworks grid (always shown, with title, description, loading/error/empty state, and Load More)
  3. Deep Dives grid (always shown, with title, description, loading/error/empty state, and Load More)
  4. Body of Work grid (always shown, with title, description, loading/error/empty state, and Load More)
  5. Advisor Boards grid (always shown, with title, description, loading/error/empty state, and Load More)

**Section Header Format:**
```tsx
<div className="mb-6">
  <h2 className="text-2xl font-bold mb-2">Section Title</h2>
  <p className="text-muted-foreground">Short descriptive paragraph text</p>
</div>
```

**Skeleton Grid Pattern (inline, not component):**
```tsx
<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
  {[...Array(6)].map((_, i) => (
    <div key={i} className="space-y-2">
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  ))}
</div>
```

**Empty State Pattern (inline, not component):**
```tsx
<div className="text-center py-12">
  <p className="text-muted-foreground text-lg">No frameworks available yet</p>
</div>
```

**Error State Pattern (inline, not component):**
```tsx
<Alert variant="destructive" className="mb-8">
  <AlertDescription className="flex items-center justify-between">
    <span>Unable to load frameworks. Please try again.</span>
    <Button variant="outline" size="sm" onClick={handleRetry}>
      Retry
    </Button>
  </AlertDescription>
</Alert>
```

#### URL Params
- Remove URL param syncing for filters (category, categoryType, creator, type)
- Remove search param syncing (search no longer affects homepage)
- Remove `useSearchParams` and `useRouter` usage entirely (search handled by AppHeader component)
- Remove `Suspense` wrapper around `HomeContent` (no longer needed since `useSearchParams` is removed - component-level loading states handle UX)

### Component Pseudo-Code

**File: `lib/types/creator.ts`**
```typescript
/**
 * Shared type definitions for Creator entities
 * 
 * These types match the API response format from `/api/creators`
 * Used across components to ensure type consistency
 */

export interface Creator {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  chatbotCount: number;
}
```

**File: `lib/hooks/use-chatbot-grid.ts`**
```typescript
import { useState, useEffect, useCallback } from 'react';
import { Chatbot, ChatbotType } from '@/lib/types/chatbot';

// Pagination type matching API response format
export interface Pagination {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

// Extended Chatbot type with optional isFavorite field (from API when authenticated)
interface ChatbotWithFavorite extends Chatbot {
  isFavorite?: boolean;
}

interface UseChatbotGridReturn {
  chatbots: ChatbotWithFavorite[];
  page: number;
  pagination: Pagination | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  loadMore: () => void;
  retry: () => void;
  syncFavorites: (favorites: Set<string>) => Set<string>;
}

export function useChatbotGrid(type: ChatbotType): UseChatbotGridReturn {
  const [chatbots, setChatbots] = useState<ChatbotWithFavorite[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChatbotsByType = useCallback(async (pageNum: number, reset: boolean) => {
    if (reset) {
      setIsLoading(true);
      setError(null);
    } else {
      setIsLoadingMore(true);
    }
    
    try {
      const res = await fetch(`/api/chatbots/public?type=${type}&pageSize=6&page=${pageNum}`);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch ${type} chatbots`);
      }
      
      const data = await res.json();
      
      if (reset) {
        setChatbots(data.chatbots);
      } else {
        setChatbots(prev => [...prev, ...data.chatbots]);
      }
      
      setPagination(data.pagination);
      setPage(pageNum);
      setError(null);
    } catch (err) {
      console.error(`Error fetching ${type}:`, err);
      setError(`Unable to load ${type.toLowerCase()}. Please try again.`);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [type]);

  // Auto-fetch on mount - fires independently for each hook instance
  useEffect(() => {
    fetchChatbotsByType(1, true);
  }, [fetchChatbotsByType]);

  const loadMore = useCallback(() => {
    if (pagination && page < pagination.totalPages) {
      fetchChatbotsByType(page + 1, false);
    }
  }, [pagination, page, fetchChatbotsByType]);

  const retry = useCallback(() => {
    fetchChatbotsByType(1, true); // Reset to page 1 on retry
  }, [fetchChatbotsByType]);

  // Extract favorites from chatbots array and merge with existing favorites
  // This allows parent component to sync favorites from all grids
  const syncFavorites = useCallback((favorites: Set<string>) => {
    const newFavorites = new Set<string>();
    chatbots.forEach(chatbot => {
      if (chatbot.isFavorite) {
        newFavorites.add(chatbot.id);
      }
    });
    // Merge: don't remove existing favorites, only add new ones from this grid
    const merged = new Set(favorites);
    newFavorites.forEach(id => merged.add(id));
    return merged;
  }, [chatbots]);

  return {
    chatbots,
    page,
    pagination,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
    retry,
    syncFavorites,
  };
}
```

**File: `components/homepage-grid-section.tsx`**
```typescript
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
```

**File: `app/page.tsx`** (simplified)
```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '@/components/app-header';
import { CreatorCard } from '@/components/creator-card';
import { HomepageGridSection } from '@/components/homepage-grid-section';
import { useChatbotGrid } from '@/lib/hooks/use-chatbot-grid';
import { Creator } from '@/lib/types/creator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

function HomeContent() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [isLoadingCreators, setIsLoadingCreators] = useState(true);
  const [errorCreators, setErrorCreators] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Use hooks for each chatbot grid - each hook fires independently on mount
  const frameworksGrid = useChatbotGrid('FRAMEWORK');
  const deepDivesGrid = useChatbotGrid('DEEP_DIVE');
  const bodyOfWorkGrid = useChatbotGrid('BODY_OF_WORK');
  const advisorBoardsGrid = useChatbotGrid('ADVISOR_BOARD');

  // Fetch creators - runs in parallel with chatbot grid hooks
  const fetchCreators = useCallback(async () => {
    setIsLoadingCreators(true);
    setErrorCreators(null);
    try {
      const res = await fetch('/api/creators');
      if (!res.ok) throw new Error('Failed to fetch creators');
      const data = await res.json();
      setCreators(data.creators || []);
    } catch (err) {
      console.error('Error fetching creators:', err);
      setErrorCreators('Unable to load creators. Please try again.');
    } finally {
      setIsLoadingCreators(false);
    }
  }, []);

  // Fetch creators on mount - runs in parallel with chatbot grid hooks (which auto-fetch via their useEffect)
  useEffect(() => {
    fetchCreators();
  }, [fetchCreators]);

  // Sync favorites from all grids when any grid's chatbots change
  // This merges favorites from API responses (isFavorite field) with existing favorites
  useEffect(() => {
    setFavorites(prev => {
      let merged = new Set(prev);
      merged = frameworksGrid.syncFavorites(merged);
      merged = deepDivesGrid.syncFavorites(merged);
      merged = bodyOfWorkGrid.syncFavorites(merged);
      merged = advisorBoardsGrid.syncFavorites(merged);
      return merged;
    });
  }, [
    frameworksGrid.chatbots,
    deepDivesGrid.chatbots,
    bodyOfWorkGrid.chatbots,
    advisorBoardsGrid.chatbots,
    // Note: favorites NOT in deps - we use functional update to access current state
  ]);

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

  return (
    <main className="min-h-screen bg-background">
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

        {/* Creators Grid */}
        <section className="mb-12">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Creators</h2>
            <p className="text-muted-foreground">Discover experts and thought leaders</p>
          </div>
          {isLoadingCreators ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-48 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          ) : errorCreators ? (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between">
                <span>{errorCreators}</span>
                <Button variant="outline" size="sm" onClick={fetchCreators}>
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

        {/* Chatbot Grids */}
        <HomepageGridSection
          title="Frameworks"
          description="Structured methodologies and approaches"
          chatbots={frameworksGrid.chatbots}
          isLoading={frameworksGrid.isLoading}
          isLoadingMore={frameworksGrid.isLoadingMore}
          error={frameworksGrid.error}
          pagination={frameworksGrid.pagination}
          currentPage={frameworksGrid.page}
          onLoadMore={frameworksGrid.loadMore}
          onRetry={frameworksGrid.retry}
          favorites={favorites}
          onFavoriteToggle={handleFavoriteToggle}
        />

        <HomepageGridSection
          title="Deep Dives"
          description="In-depth explorations and analyses"
          chatbots={deepDivesGrid.chatbots}
          isLoading={deepDivesGrid.isLoading}
          isLoadingMore={deepDivesGrid.isLoadingMore}
          error={deepDivesGrid.error}
          pagination={deepDivesGrid.pagination}
          currentPage={deepDivesGrid.page}
          onLoadMore={deepDivesGrid.loadMore}
          onRetry={deepDivesGrid.retry}
          favorites={favorites}
          onFavoriteToggle={handleFavoriteToggle}
        />

        <HomepageGridSection
          title="Body of Work"
          description="AI advisors trained on comprehensive creator content"
          chatbots={bodyOfWorkGrid.chatbots}
          isLoading={bodyOfWorkGrid.isLoading}
          isLoadingMore={bodyOfWorkGrid.isLoadingMore}
          error={bodyOfWorkGrid.error}
          pagination={bodyOfWorkGrid.pagination}
          currentPage={bodyOfWorkGrid.page}
          onLoadMore={bodyOfWorkGrid.loadMore}
          onRetry={bodyOfWorkGrid.retry}
          favorites={favorites}
          onFavoriteToggle={handleFavoriteToggle}
        />

        <HomepageGridSection
          title="Advisor Boards"
          description="Collective wisdom from expert panels"
          chatbots={advisorBoardsGrid.chatbots}
          isLoading={advisorBoardsGrid.isLoading}
          isLoadingMore={advisorBoardsGrid.isLoadingMore}
          error={advisorBoardsGrid.error}
          pagination={advisorBoardsGrid.pagination}
          currentPage={advisorBoardsGrid.page}
          onLoadMore={advisorBoardsGrid.loadMore}
          onRetry={advisorBoardsGrid.retry}
          favorites={favorites}
          onFavoriteToggle={handleFavoriteToggle}
        />
      </div>
    </main>
  );
}

export default function Home() {
  return <HomeContent />;
}
```

## Work Plan

### Task -1: Database Migration - Rename CREATOR to BODY_OF_WORK (PREREQUISITE)

**Migration Order**: This task must be completed before Task 0. The migration requires careful coordination:
1. Update existing data records first (Subtask -1.1.5)
2. Update Prisma schema (Subtask -1.1)
3. Create migration with custom SQL (Subtask -1.2)
4. Update TypeScript types and code (Subtasks -1.3 through -1.5)
5. Verify everything works (Subtask -1.6)

**Subtask -1.1** — Update Prisma schema
- Visible output: `prisma/schema.prisma` updated with `BODY_OF_WORK` in ChatbotType enum
- Change: `enum ChatbotType { CREATOR → BODY_OF_WORK, FRAMEWORK, DEEP_DIVE, ADVISOR_BOARD }`
- **Note**: This change requires a custom migration SQL script (see Subtask -1.2)

**Subtask -1.1.5** — Create data migration script (NEW - CRITICAL)
- Visible output: SQL script to update existing `CREATOR` records to `BODY_OF_WORK` before enum change
- **Rationale**: PostgreSQL enum changes require updating existing data BEFORE altering the enum type
- **Action**: Create migration file with custom SQL:
  ```sql
  -- Update existing records BEFORE changing enum
  UPDATE "Chatbot" SET type = 'BODY_OF_WORK' WHERE type = 'CREATOR';
  
  -- Then alter enum (Prisma will handle enum recreation)
  ```
- **Note**: This step must run before the enum migration in Subtask -1.2

**Subtask -1.2** — Create and run database migration
- Visible output: Migration file created and applied
- Command: `npx prisma migrate dev --name rename_creator_to_body_of_work`
- **Important**: The migration file must include:
  1. Data update SQL (from Subtask -1.1.5) - updates existing records
  2. Enum alteration SQL - Prisma will generate this, but may need manual adjustment for PostgreSQL
- **PostgreSQL Enum Migration Strategy**: 
  - Option A: Use Prisma's generated migration and manually add data update SQL at the top
  - Option B: Create fully custom migration file with both data update and enum alteration
- **Note**: After migration, verify existing records have `BODY_OF_WORK` type

**Subtask -1.3** — Update shared TypeScript types
- Visible output: `lib/types/chatbot.ts` updated
- Change: `export type ChatbotType = 'BODY_OF_WORK' | 'FRAMEWORK' | 'DEEP_DIVE' | 'ADVISOR_BOARD'`

**Subtask -1.4** — Update API route validation
- Visible output: `app/api/chatbots/public/route.ts` updated
- Change: Update validation to accept `BODY_OF_WORK` instead of `CREATOR`
- Update error messages: Change `"type must be 'CREATOR', 'FRAMEWORK', 'DEEP_DIVE', or 'ADVISOR_BOARD'"` to `"type must be 'BODY_OF_WORK', 'FRAMEWORK', 'DEEP_DIVE', or 'ADVISOR_BOARD'"`
- Update JSDoc documentation comments (line 22): Change `(CREATOR, FRAMEWORK, DEEP_DIVE, ADVISOR_BOARD)` to `(BODY_OF_WORK, FRAMEWORK, DEEP_DIVE, ADVISOR_BOARD)`

**Subtask -1.5** — Update all component type definitions
- Visible output: All files using ChatbotType updated
- **Part 1: Replace local type definitions with shared imports**
  - Files to update: `app/page.tsx`, `components/chatbot-card.tsx`, `components/chatbot-detail-modal.tsx`, `app/favorites/page.tsx`
  - Change: Remove local `type ChatbotType = 'CREATOR' | ...` definitions
  - Change: Add `import { ChatbotType } from '@/lib/types/chatbot'` instead
  - **Rationale**: Ensures type consistency and single source of truth
- **Part 2: Update any remaining CREATOR references**
  - Search codebase for remaining `'CREATOR'` string literals in type contexts
  - Replace with `'BODY_OF_WORK'` where applicable
- **Part 3: Update seed scripts (if applicable)**
  - Check: `prisma/seed.ts`, `prisma/seed-pills.ts`, `prisma/seed-suggested-pills.ts`
  - Update: Replace any `'CREATOR'` references with `'BODY_OF_WORK'` in seed data
  - **Note**: Only update if seed scripts reference chatbot types

**Subtask -1.6** — Verify migration success
- Visible output: All tests pass, no references to `'CREATOR'` chatbot type remain
- **Verification checklist**:
  - ✅ Database enum updated: `ChatbotType` enum contains `BODY_OF_WORK` (not `CREATOR`)
  - ✅ Existing records migrated: All chatbots with old `CREATOR` type now have `BODY_OF_WORK` type
  - ✅ TypeScript types updated: `lib/types/chatbot.ts` exports `BODY_OF_WORK`
  - ✅ API accepts new type: `/api/chatbots/public?type=BODY_OF_WORK` works
  - ✅ API rejects old type: `/api/chatbots/public?type=CREATOR` returns 400 error
  - ✅ Components use shared types: No local `ChatbotType` definitions remain
  - ✅ Tests updated: All test assertions use `BODY_OF_WORK`
  - ✅ No `'CREATOR'` references: Search codebase confirms no remaining `'CREATOR'` chatbot type strings
- **Explicit test file updates**:
  - `__tests__/api/chatbots/public/route.test.ts` (line 379): Update error message assertion from `"type must be 'CREATOR', 'FRAMEWORK', 'DEEP_DIVE', or 'ADVISOR_BOARD'"` to `"type must be 'BODY_OF_WORK', 'FRAMEWORK', 'DEEP_DIVE', or 'ADVISOR_BOARD'"`
  - Run all tests: `npm test` passes

### Task 0: Create Reusable Hook, Component, and Types (NEW)
**Subtask 0.1** — Create `lib/hooks/use-chatbot-grid.ts`
- Visible output: Hook file created with `useChatbotGrid` function
- Implements generic `fetchChatbotsByType` function
- Manages: chatbots, pagination, loading states, error states
- Returns: `{ chatbots, page, pagination, isLoading, isLoadingMore, error, loadMore, retry, syncFavorites }`

**Subtask 0.2** — Create `components/homepage-grid-section.tsx`
- Visible output: Component file created with `HomepageGridSection` component
- Handles: skeleton loading, error state, empty state, grid rendering, Load More button
- Uses existing `renderChatbotGrid` pattern internally
- Accepts all necessary props for grid display

**Subtask 0.3** — Create `lib/types/creator.ts` (consistency improvement)
- Visible output: Type file created with `Creator` interface exported
- Matches API response format from `/api/creators`
- Improves type consistency across codebase (similar to `lib/types/chatbot.ts`)
- Note: This is optional but recommended for maintainability

### Task 1: Remove Filter UI and State
**Subtask 1.1** — Remove filter-related state variables
- Visible output: State declarations removed from component

**Subtask 1.2** — Remove filter UI components (category type buttons, category badges, creator dropdown, type checkboxes, active filters display)
- Visible output: Filters section removed from JSX

**Subtask 1.3** — Remove filter handler functions
- Visible output: `toggleCategory`, `toggleCategoryType`, `toggleType`, `clearAllFilters` functions removed

**Subtask 1.4** — Remove URL param syncing for filters
- Visible output: `useEffect` hooks for filter URL params removed

### Task 2: Implement Grid State Management Using Hook
**Subtask 2.1** — Use `useChatbotGrid` hook for each chatbot type
- Visible output: Four hook instances created (`frameworksGrid`, `deepDivesGrid`, `bodyOfWorkGrid`, `advisorBoardsGrid`)

**Subtask 2.2** — Verify parallel loading behavior
- Visible output: All grids load in parallel on initial mount (creators + 4 chatbot grids)
- Note: Each `useChatbotGrid` hook fires its `useEffect` independently, and `fetchCreators` runs in parallel - no explicit `Promise.all` needed

**Subtask 2.3** — Sync favorites from all grids
- Visible output: Favorites state updated from all grid responses using merge pattern (don't remove existing favorites)
- Uses `syncFavorites` method from each hook
- Note: Favorites are extracted from API responses (`isFavorite` field) and merged with existing favorites state

**Subtask 2.4** — Verify error handling per grid
- Visible output: Each grid handles errors independently with retry functionality
- Retry resets pagination to page 1 (clarified behavior)

### Task 3: Update Rendering Logic
**Subtask 3.1** — Remove conditional filtered/categorized rendering logic
- Visible output: `hasActiveFilters` conditional removed

**Subtask 3.2** — Remove search query effects on chatbot fetching
- Visible output: Search-related useEffect hooks removed

**Subtask 3.3** — Use `HomepageGridSection` component for chatbot grids
- Visible output: Four `HomepageGridSection` components rendered with appropriate props
- Each section includes: title, description, loading/error/empty states, Load More button

**Subtask 3.4** — Render creators grid (keep inline, simpler)
- Visible output: Creators grid rendered with title, description, loading/error/empty states

**Subtask 3.5** — Verify all grids display correctly
- Visible output: All 5 grids render in order with proper states

### Task 4: Cleanup and Testing
**Subtask 4.1** — Remove unused imports (if any)
- Visible output: Clean imports section

**Subtask 4.2** — Remove unused types/interfaces (if any)
- Visible output: Clean type definitions

**Subtask 4.3** — Test homepage loads correctly
- Visible output: All 5 grids display correctly (or show empty/error states appropriately)

**Subtask 4.5** — Verify Suspense wrapper is removed
- Visible output: Suspense wrapper removed from Home component (no longer needed without useSearchParams)

**Subtask 4.4** — Verify search functionality (header search does NOT affect homepage)
- Visible output: Search in header works but homepage grids remain unchanged

## Architectural Discipline

### File Size Check
- Current `app/page.tsx`: ~724 lines
- After refactor:
  - `app/page.tsx`: ~100 lines (main component, simplified)
  - `lib/hooks/use-chatbot-grid.ts`: ~80 lines (reusable hook)
  - `components/homepage-grid-section.tsx`: ~60 lines (reusable component)
  - `lib/types/creator.ts`: ~15 lines (shared type definition)
- ✅ All files within 120 line limit
- ✅ Function count: 
  - `app/page.tsx`: ~3-4 functions (fetchCreators, handleFavoriteToggle, effects)
  - `use-chatbot-grid.ts`: ~4-5 functions (hook + internal helpers)
  - `homepage-grid-section.tsx`: ~1 function (renderChatbotGrid)
- ✅ All within limits

### Single Responsibility
- `app/page.tsx`: Homepage layout and coordination only
- `use-chatbot-grid.ts`: Grid state management (single responsibility per grid type)
- `homepage-grid-section.tsx`: Grid section rendering (UI only)
- Filter logic removed (was mixing concerns)
- ✅ Clean separation of concerns

### Code Reusability
- ✅ Single generic `fetchChatbotsByType` function (no duplication)
- ✅ Reusable `useChatbotGrid` hook (used 4 times)
- ✅ Reusable `HomepageGridSection` component (used 4 times)
- ✅ DRY principle followed

### Dependencies
- No new dependencies required
- Uses existing API endpoints
- Uses existing UI components (Button, Alert, Skeleton, ChatbotCard, CreatorCard)
- ✅ No dependency additions

### Type Usage
- **Shared Types**: Import `Chatbot` and `ChatbotType` from `@/lib/types/chatbot` (avoid duplication)
- **Shared Types**: Import `Creator` from `@/lib/types/creator` (consistency improvement)
- **Note**: ChatbotType enum updated from `CREATOR` to `BODY_OF_WORK` (see Task -1 for migration details)
- **Local Types**: Define `Pagination` interface locally in hook file (matches API response)
- **Extended Types**: Use `ChatbotWithFavorite` interface extending `Chatbot` with optional `isFavorite?: boolean`
- ✅ Type consistency maintained across codebase

## Risks & Edge Cases

1. **Database migration coordination** (CRITICAL): The `CREATOR` → `BODY_OF_WORK` migration requires careful coordination
   - **Risk**: Code and database out of sync during deployment window
   - **Mitigation**: 
     - Run migration FIRST (Task -1) before any code changes
     - Update existing data records BEFORE altering enum (Subtask -1.1.5)
     - Verify migration success before proceeding to Task 0
     - PostgreSQL enum changes require custom SQL - Prisma may not handle automatically
   - **Deployment strategy**: 
     - Development: Run migration locally, verify, then deploy code
     - Production: Run migration via Vercel/CI, verify, then deploy code changes
   - **Rollback plan**: If migration fails, revert Prisma schema and code changes together
2. **Empty grids**: If a chatbot type has no items, show empty state message (handled in `HomepageGridSection` component)
3. **API errors**: Each grid handles errors individually with error state and retry button (per-grid error handling)
4. **Retry behavior**: Retry resets pagination to page 1 and clears existing chatbots (fresh start)
5. **Favorites sync**: Favorites synced from all API responses using merge pattern (don't remove existing favorites when loading new pages)
   - API returns `isFavorite?: boolean` field for each chatbot when user is authenticated
   - Uses `syncFavorites` method from each hook to extract favorites from chatbots array
   - Merged in parent component (`app/page.tsx`) - adds new favorites without removing existing ones
   - Note: This approach ensures favorites persist across pagination and grid loads
6. **Search functionality**: Verify search in header does NOT affect homepage grids (only dropdown/search results page)
7. **Performance**: 5 API calls on page load - **optimized with natural parallel loading** (each hook's useEffect fires independently, creators fetch runs in parallel)
8. **Loading states**: Multiple loading states may cause layout shift - use skeleton loaders to prevent (handled in `HomepageGridSection`)
9. **Pagination**: Ensure "Load More" appends items correctly and doesn't duplicate favorites
   - Hook handles appending correctly (`prev => [...prev, ...data.chatbots]`)
   - Favorites merge pattern prevents duplicates
10. **Section descriptions**: Confirmed descriptive text:
   - Creators: "Discover experts and thought leaders"
   - Frameworks: "Structured methodologies and approaches"
   - Deep Dives: "In-depth explorations and analyses"
   - Body of Work: "AI advisors trained on comprehensive creator content"
   - Advisor Boards: "Collective wisdom from expert panels"
11. **Component patterns**: Use `HomepageGridSection` component for chatbot grids (reusable, not inline)
12. **Suspense wrapper**: Remove Suspense wrapper since useSearchParams is removed (component-level loading states handle UX)
13. **Hook dependencies**: Ensure `useChatbotGrid` hook dependencies are correct (useCallback for fetch function with `[type]` dependency, useEffect depends on fetchChatbotsByType)
14. **Favorites toggle**: Existing `handleFavoriteToggle` works correctly (no changes needed, ChatbotCard handles API call)
15. **Type imports**: Use shared types from `@/lib/types/chatbot` (Chatbot, ChatbotType) - avoid duplicating type definitions
    - **Migration note**: Task -1.5 Part 1 ensures all components use shared types instead of local definitions
16. **Creator type**: Extract Creator type to `lib/types/creator.ts` for consistency (matches pattern used for Chatbot type)
17. **Pagination type**: Define Pagination interface locally in hook file (matches API response format)
18. **isFavorite field**: Chatbot type includes optional `isFavorite?: boolean` from API (only when authenticated)
19. **Type consistency after migration**: All components must import `ChatbotType` from shared location - verify no local type definitions remain after Task -1.5

## Tests

### Test 1: Homepage Loads All Grids
- **Input**: Navigate to homepage
- **Expected Output**: 
  - Creators grid displays with title and description
  - Frameworks grid displays with title and description (or empty state)
  - Deep Dives grid displays with title and description (or empty state)
  - Body of Work grid displays with title and description (or empty state)
  - Advisor Boards grid displays with title and description (or empty state)
  - Empty grids show empty state message (not hidden)
  - Each grid shows 6 items initially

### Test 2: Filter UI Removed
- **Input**: Navigate to homepage
- **Expected Output**: No filter UI visible (no category buttons, dropdowns, checkboxes)

### Test 3: Separate API Calls (Parallel Loading)
- **Input**: Open browser network tab, navigate to homepage
- **Expected Output**: 
  - All 5 API calls made in parallel (each hook's useEffect fires independently)
  - 1 call to `/api/creators`
  - 1 call to `/api/chatbots/public?type=FRAMEWORK&pageSize=6&page=1`
  - 1 call to `/api/chatbots/public?type=DEEP_DIVE&pageSize=6&page=1`
  - 1 call to `/api/chatbots/public?type=BODY_OF_WORK&pageSize=6&page=1`
  - 1 call to `/api/chatbots/public?type=ADVISOR_BOARD&pageSize=6&page=1`
  - Calls should start simultaneously (not sequential) - verified in network tab timing

### Test 3b: Load More Functionality
- **Input**: Click "Load More" on a grid with more pages
- **Expected Output**: 
  - Additional API call with incremented page number
  - New items appended to grid (not replacing)
  - "Load More" button hides when all pages loaded

### Test 4: Loading States
- **Input**: Navigate to homepage
- **Expected Output**: Each grid shows skeleton loader while loading, then displays content

### Test 5: Favorites Work
- **Input**: Toggle favorite on chatbot in any grid
- **Expected Output**: 
  - Favorite state updates correctly
  - Favorite persists across pagination (Load More)
  - Favorites from API responses (`isFavorite` field) are synced correctly

### Test 6: Search Does Not Affect Homepage
- **Input**: Use search in header
- **Expected Output**: Homepage grids remain unchanged (search only affects dropdown/search results page)

### Test 7: Empty State Messages
- **Input**: Navigate to homepage with a chatbot type that has no items
- **Expected Output**: Grid shows empty state message instead of being hidden

### Test 8: Error Handling Per Grid
- **Input**: Simulate API error for one grid (e.g., network failure)
- **Expected Output**: 
  - Only that grid shows error message with retry button
  - Other grids continue to display normally
  - Clicking retry button refetches that grid's data (resets to page 1)

### Test 9: Code Reusability
- **Input**: Review code structure
- **Expected Output**: 
  - `useChatbotGrid` hook used 4 times (no duplication)
  - `HomepageGridSection` component used 4 times (no duplication)
  - Single `fetchChatbotsByType` function (no duplicate fetch functions)
  - All files within architectural limits (≤120 lines, ≤5 functions per file)
  - Types imported from shared `@/lib/types/chatbot` (no duplicate type definitions)
  - `Creator` type imported from shared `@/lib/types/creator` (no duplicate type definitions)

## Approval Prompt

**Approve the plan to proceed to BUILD? (Yes / Answer questions / Edit)**

