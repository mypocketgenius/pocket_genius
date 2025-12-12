'use client';

import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm relative">
        {/* Auth buttons in top right */}
        <div className="absolute top-4 right-4 flex gap-4 items-center">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer transition-colors">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 cursor-pointer transition-colors">
                Sign Up
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
        
        <h1 className="text-4xl font-bold text-center mb-8">
          Pocket Genius
        </h1>
        <p className="text-center text-gray-600 mb-4">
          MVP Foundation - Phase 1 Task 8: Clerk Authentication
        </p>
        
        <SignedIn>
          <p className="text-center text-green-600 mt-4">
            ✅ Authentication is working! You are signed in.
          </p>
        </SignedIn>
        <SignedOut>
          <p className="text-center text-gray-500 mt-4">
            Click Sign In or Sign Up to test authentication
          </p>
        </SignedOut>
      </div>
    </main>
  );
}

