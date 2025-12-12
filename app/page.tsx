'use client';

import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  const chatbotId = 'chatbot_art_of_war';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm relative">
        {/* Auth buttons in top right */}
        <div className="absolute top-4 right-4 flex gap-4 items-center">
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
        </div>
        
        <h1 className="text-4xl font-bold text-center mb-4">
          Pocket Genius
        </h1>
        <p className="text-center text-muted-foreground mb-8">
          Chat with creator content via RAG
        </p>
        
        <SignedIn>
          <p className="text-center text-green-600 mb-8">
            ✅ Authentication is working! You are signed in.
          </p>
        </SignedIn>
        <SignedOut>
          <p className="text-center text-muted-foreground mb-8">
            Sign in to access all features
          </p>
        </SignedOut>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {/* Chat Page */}
          <Card>
            <CardHeader>
              <CardTitle>Chat</CardTitle>
              <CardDescription>
                Chat with the Art of War chatbot using RAG
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/chat/${chatbotId}`}>
                <Button className="w-full">Go to Chat</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Dashboard Page */}
          <Card>
            <CardHeader>
              <CardTitle>Dashboard</CardTitle>
              <CardDescription>
                View chunk performance and analytics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/dashboard/${chatbotId}`}>
                <Button className="w-full" variant="outline">Go to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Test Upload Page */}
          <Card>
            <CardHeader>
              <CardTitle>Test Upload</CardTitle>
              <CardDescription>
                Upload and test file ingestion
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/test-upload">
                <Button className="w-full" variant="secondary">Test Upload</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Test Files Page */}
          <Card>
            <CardHeader>
              <CardTitle>Test Files</CardTitle>
              <CardDescription>
                View and manage uploaded files
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/test-files">
                <Button className="w-full" variant="secondary">Test Files</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

