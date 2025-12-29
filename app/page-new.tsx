'use client';

import { useState, useEffect } from 'react';
import { AppHeader } from '@/components/app-header';
import { HomepageCreatorsSection } from '@/components/homepage-creators-section';
import { HomepageGridSection } from '@/components/homepage-grid-section';
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
  }, [
    frameworksGrid.chatbots,
    deepDivesGrid.chatbots,
    bodyOfWorkGrid.chatbots,
    advisorBoardsGrid.chatbots,
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
      </div>
    </main>
  );
}

export default function Home() {
  return <HomeContent />;
}

