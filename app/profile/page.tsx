// app/profile/page.tsx
// Phase 3.10, Step 7: User Profile Settings Page
// Displays and allows editing of user context (global and chatbot-specific)

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { UserContextEditor } from '@/components/user-context-editor';
import { ThemedPageWrapper } from '@/components/themed-page-wrapper';
import { ThemedHeader } from '@/components/themed-header';

/**
 * Profile Settings Page
 * 
 * Route: /profile
 * 
 * Features:
 * - Authentication required (redirects to home if not authenticated)
 * - Displays all user context (global + chatbot-specific)
 * - Allows editing of editable contexts via UserContextEditor component
 * - Groups contexts by question (key) rather than chatbot
 * - Fetches intake questions to display proper question text
 */
export default async function ProfilePage() {
  // 1. Authenticate user
  const { userId: clerkId } = await auth();
  
  if (!clerkId) {
    // Redirect to home if not authenticated
    redirect('/');
  }

  // 2. Get database user
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });

  if (!user) {
    // Redirect if user not found in database
    redirect('/');
  }

  // 3. Get all user context (global + chatbot-specific)
  const userContexts = await prisma.user_Context.findMany({
    where: {
      userId: user.id,
      isVisible: true,
    },
    include: {
      chatbot: {
        select: { id: true, title: true },
      },
    },
    orderBy: [
      { key: 'asc' },
      { chatbotId: 'asc' }, // Global context first (null)
    ],
  });

  // 4. Get unique keys from contexts to fetch intake questions
  const uniqueKeys = [...new Set(userContexts.map((ctx) => ctx.key))];

  // 5. Fetch intake questions for these keys (if they exist)
  const intakeQuestions = await prisma.intake_Question.findMany({
    where: {
      slug: {
        in: uniqueKeys,
      },
    },
    select: {
      id: true,
      slug: true,
      questionText: true,
      helperText: true,
    },
  });

  // Create a map of slug -> question for easy lookup
  const questionMap = new Map(
    intakeQuestions.map((q) => [q.slug, q])
  );

  return (
    <ThemedPageWrapper className="min-h-screen">
      <ThemedHeader />
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Profile Settings</h1>
        <p className="text-muted-foreground mb-8">
          Manage your user context information. This information helps personalize
          chatbot responses to better match your needs and preferences.
        </p>
        <UserContextEditor 
          contexts={userContexts} 
          userId={user.id}
          questionMap={questionMap}
        />
      </div>
    </ThemedPageWrapper>
  );
}




