// app/api/test-auth/route.ts
// Test endpoint to verify Clerk authentication is working on the server side
import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get auth data (userId, sessionId, etc.)
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { 
          authenticated: false, 
          message: 'Not authenticated. Please sign in.' 
        },
        { status: 401 }
      );
    }

    // Get full user object
    const user = await currentUser();

    return NextResponse.json({
      authenticated: true,
      userId: user?.id,
      email: user?.emailAddresses[0]?.emailAddress,
      firstName: user?.firstName,
      lastName: user?.lastName,
      message: '✅ Clerk authentication is working correctly!',
    });
  } catch (error) {
    console.error('Auth test error:', error);
    return NextResponse.json(
      { 
        authenticated: false, 
        error: 'Failed to verify authentication',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
