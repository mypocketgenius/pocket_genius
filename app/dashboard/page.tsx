// app/dashboard/page.tsx
// Creator Dashboard Listing Page
// Displays all chatbots owned by the authenticated user

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { ThemedPageWrapper } from '@/components/themed-page-wrapper';
import { ThemedHeader } from '@/components/themed-header';
import { BarChart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

/**
 * Dashboard listing page that shows all chatbots owned by the authenticated user
 * 
 * Route: /dashboard
 * 
 * Features:
 * - Authentication check (required)
 * - Lists all chatbots the user owns (via Creator_User relationship)
 * - Click to navigate to individual chatbot dashboard
 * - Empty state if user has no chatbots
 */
export default async function DashboardListingPage() {
  // 1. Authenticate user (required for dashboard)
  const { userId: clerkUserId } = await auth();
  
  if (!clerkUserId) {
    redirect('/');
  }

  // 2. Get database user ID
  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });

  if (!user) {
    redirect('/');
  }

  // 3. Get all chatbots where:
  //    - User's creator(s) control the chatbot OR
  //    - Chatbot has publicDashboard = true
  const chatbots = await prisma.chatbot.findMany({
    where: {
      OR: [
        {
          // User owns via creator membership
          creator: {
            users: {
              some: {
                userId: user.id,
              },
            },
          },
        },
        {
          // Public dashboard access
          publicDashboard: true,
        },
      ],
    },
    select: {
      id: true,
      title: true,
      description: true,
      publicDashboard: true,
      createdAt: true,
      creator: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return (
    <ThemedPageWrapper className="min-h-screen">
      <ThemedHeader />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Creator Dashboard</h1>
          <p className="text-muted-foreground">
            Manage and view analytics for your chatbots
          </p>
        </div>

        {/* Chatbots Grid */}
        {chatbots.length === 0 ? (
          <div className="text-center py-12">
            <BarChart className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h2 className="text-2xl font-semibold mb-2">No chatbots yet</h2>
            <p className="text-muted-foreground mb-6">
              You don&apos;t have any chatbots to manage. Create one to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {chatbots.map((chatbot) => {
              return (
                <Link key={chatbot.id} href={`/dashboard/${chatbot.id}`}>
                  <Card className="h-full p-6 hover:shadow-lg transition-all duration-200 cursor-pointer">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="text-xl font-semibold">{chatbot.title}</h3>
                      {chatbot.publicDashboard && (
                        <Badge variant="secondary" className="text-xs">
                          Public Access
                        </Badge>
                      )}
                    </div>
                    {chatbot.description && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {chatbot.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{chatbot.creator.name}</span>
                      <span className="text-primary hover:text-primary/80 font-medium">
                        View Dashboard →
                      </span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </ThemedPageWrapper>
  );
}

