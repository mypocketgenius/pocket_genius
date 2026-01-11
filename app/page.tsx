'use client';

import React, { useState, useEffect } from 'react';
import { AppHeader } from '@/components/app-header';
import { ThemedPage } from '@/components/themed-page';
import { HomepageCreatorsSection } from '@/components/homepage-creators-section';
import { HomepageGridSection } from '@/components/homepage-grid-section';
import { HomepageFilterPills } from '@/components/homepage-filter-pills';
import { useChatbotGrid } from '@/lib/hooks/use-chatbot-grid';

function HomeContent() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Use hooks for each chatbot grid - each hook fires independently on mount
  const frameworksGrid = useChatbotGrid('FRAMEWORK');
  const deepDivesGrid = useChatbotGrid('DEEP_DIVE');
  const bodyOfWorkGrid = useChatbotGrid('BODY_OF_WORK');
  const advisorBoardsGrid = useChatbotGrid('ADVISOR_BOARD');

  // Sync favorites from all grids when any grid's chatbots change
  // This merges favorites from API responses (isFavorite field) with existing favorites
  // Note: This effect runs when chatbot arrays change. The functional update pattern (prev => ...)
  // ensures we always access current favorites state without including it in dependencies,
  // preventing infinite loops while keeping favorites in sync with API responses.
  useEffect(() => {
    setFavorites(prev => {
      let merged = new Set(prev);
      merged = frameworksGrid.syncFavorites(merged);
      merged = deepDivesGrid.syncFavorites(merged);
      merged = bodyOfWorkGrid.syncFavorites(merged);
      merged = advisorBoardsGrid.syncFavorites(merged);
      return merged;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    frameworksGrid.chatbots,
    deepDivesGrid.chatbots,
    bodyOfWorkGrid.chatbots,
    advisorBoardsGrid.chatbots,
    // Note: Grid objects not included - syncFavorites is memoized based on chatbots,
    // and we're tracking chatbots changes. Including grid objects would cause unnecessary re-runs.
    // Note: `favorites` NOT in dependency array - functional update pattern prevents infinite loops
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
    <ThemedPage className="min-h-screen">
      <AppHeader />
      
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2">
            Get Personalized Advice From The World&apos;s Best Experts
          </h2>
          <p className="text-muted-foreground mb-6">
            AI advisors built from their insights and teachings. Applied to your situation.
          </p>
        </div>
        
        {/* Filter Pills */}
        <HomepageFilterPills />

        {/* Creators Grid - Uses extracted component */}
        <HomepageCreatorsSection />

        {/* Chatbot Grids */}
        <HomepageGridSection
          title="Frameworks"
          description="Master proven methodologies - get step-by-step guidance applying one framework to your challenge"
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
          description="Explore one seminal work in depth - ask questions and apply its teachings to your challenges"
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
          description="Comprehensive guidance from an expert's complete body of work - their full philosophy, not generic interpretations"
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
          description="Get multiple expert perspectives on your challenge - see how different experts would approach the same problem"
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
    </ThemedPage>
  );
}

export default function Home() {
  return <HomeContent />;
}

