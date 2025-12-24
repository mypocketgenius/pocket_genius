'use client';

// Shared header component with expandable search for all pages
// Shows "PG" on mobile, "Pocket Genius" on desktop
// Search expands on clicking the search icon

import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/search-bar';

interface AppHeaderProps {
  // Optional: show auth buttons (default: true)
  showAuth?: boolean;
  // Optional: custom left content (e.g., back button, title)
  leftContent?: React.ReactNode;
  // Optional: custom right content
  rightContent?: React.ReactNode;
  // Optional: callback when search query changes
  onSearchChange?: (query: string) => void;
  // Optional: initial search query
  initialSearchQuery?: string;
  // Optional: whether search should navigate to homepage (default: true)
  navigateOnSearch?: boolean;
}

export function AppHeader({
  showAuth = true,
  leftContent,
  rightContent,
  onSearchChange,
  initialSearchQuery = '',
  navigateOnSearch = true,
}: AppHeaderProps) {

  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left side: Logo/Title or custom content */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {leftContent ? (
              leftContent
            ) : (
              <h1 className="text-2xl font-bold">
                <span className="hidden md:inline">Pocket Genius</span>
                <span className="md:hidden">PG</span>
              </h1>
            )}
          </div>

          {/* Search bar */}
          <SearchBar
            initialValue={initialSearchQuery}
            onSearchChange={onSearchChange}
            navigateOnSearch={navigateOnSearch}
            variant="header"
          />

          {/* Right side: Auth buttons or custom content */}
          <div className="flex gap-4 items-center flex-shrink-0">
            {rightContent ? (
              rightContent
            ) : showAuth ? (
              <>
                <SignedOut>
                  <SignInButton mode="modal">
                    <Button variant="default" size="sm">
                      Sign In
                    </Button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <Button variant="secondary" size="sm">
                      Sign Up
                    </Button>
                  </SignUpButton>
                </SignedOut>
                <SignedIn>
                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

