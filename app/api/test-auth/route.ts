// app/api/test-auth/route.ts
// Test endpoint to verify Clerk authentication is working on the server side
import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Debug: Log what cookies we're receiving
    const cookieHeader = request.headers.get('cookie');
    const allHeaders = Object.fromEntries(request.headers.entries());
    
    // Get auth data (userId, sessionId, etc.)
    const { userId, sessionId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { 
          authenticated: false, 
          message: 'Not authenticated. Please sign in.',
          debug: {
            cookieHeader: cookieHeader ? cookieHeader.substring(0, 200) + '...' : 'No cookies',
            cookieCount: cookieHeader ? cookieHeader.split(';').length : 0,
            hasSessionCookie: cookieHeader?.includes('_session') || cookieHeader?.includes('__session'),
            hasClerkDbJwt: cookieHeader?.includes('_clerk_db_jwt') || cookieHeader?.includes('__clerk_db_jwt'),
            headers: {
              origin: request.headers.get('origin'),
              referer: request.headers.get('referer'),
              userAgent: request.headers.get('user-agent')?.substring(0, 50),
            }
          }
        },
        { status: 401 }
      );
    }

    // Get full user object
    const user = await currentUser();

    return NextResponse.json({
      authenticated: true,
      userId: user?.id,
      sessionId,
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
