'use client';

// Shared header component with expandable search for all pages
// Shows "PG" on mobile, "Pocket Genius" on desktop
// Search expands on clicking the search icon

import { useState } from 'react';
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/search-bar';
import { SideMenu } from '@/components/side-menu';
import { Heart, Menu } from 'lucide-react';

interface AppHeaderProps {
  // Optional: show auth buttons (default: true)
  showAuth?: boolean;
  // Optional: custom left content (e.g., back button, title)
  leftContent?: React.ReactNode;
  // Optional: custom right content
  rightContent?: React.ReactNode;
}

export function AppHeader({
  showAuth = true,
  leftContent,
  rightContent,
}: AppHeaderProps) {
  const [sideMenuOpen, setSideMenuOpen] = useState(false);

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
                  <button
                    onClick={() => setSideMenuOpen(true)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    aria-label="Open menu"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                  <UserButton afterSignOutUrl="/">
                    <UserButton.MenuItems>
                      <UserButton.Link
                        label="Favorites"
                        href="/favorites"
                        labelIcon={<Heart className="w-4 h-4" />}
                      />
                    </UserButton.MenuItems>
                  </UserButton>
                </SignedIn>
              </>
            ) : null}
          </div>
        </div>
      </div>
      
      {/* Side Menu */}
      <SideMenu 
        isOpen={sideMenuOpen} 
        onClose={() => setSideMenuOpen(false)}
        onOpen={() => setSideMenuOpen(true)}
      />
    </header>
  );
}

