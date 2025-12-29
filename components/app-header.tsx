'use client';

// Shared header component with expandable search for all pages
// Shows "PG" on mobile, "Pocket Genius" on desktop
// Search expands on clicking the search icon

import React, { useState } from 'react';
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/search-bar';
import { SideMenu } from '@/components/side-menu';
import { Heart, Menu } from 'lucide-react';
import { useTheme } from '../lib/theme/theme-context';

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
  const theme = useTheme();

  // Theme-aware hover colors
  const hoverBgColor = theme.theme === 'light' 
    ? 'rgba(0, 0, 0, 0.05)' 
    : 'rgba(255, 255, 255, 0.1)';

  return (
    <header 
      className="border-b sticky top-0 z-50"
      style={{
        backgroundColor: theme.chrome.header,
        borderColor: theme.chrome.border,
        color: theme.textColor,
        transition: 'background-color 2s ease, border-color 2s ease, color 2s ease',
      }}
    >
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
                    className="p-2 rounded-full transition-colors"
                    style={{
                      color: theme.textColor,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = hoverBgColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
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

