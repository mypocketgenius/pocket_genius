// instrumentation.ts
// This file is required for Sentry to work with Next.js App Router
// It runs once when the server starts and enables Sentry for client-side code
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}



