// middleware.ts
// Clerk middleware for route protection and authentication
import { clerkMiddleware } from '@clerk/nextjs/server';

// Default: no routes protected, authentication available everywhere
// You can customize this later to protect specific routes
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and webhook routes
    '/((?!_next|api/webhooks|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes EXCEPT webhooks
    '/(api(?!/webhooks)|trpc)(.*)',
  ],
};
