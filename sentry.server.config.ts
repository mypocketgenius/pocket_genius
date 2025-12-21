// sentry.server.config.ts
// Sentry configuration for server-side code (API routes, Server Components, etc.)
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  
  // Set tracesSampleRate to 1.0 to capture 100% of the transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Set sample rate for profiling - this is relative to tracesSampleRate
  // Setting to 1.0 means profiling is enabled for 100% of transactions
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Enable debug mode in development
  debug: process.env.NODE_ENV === 'development',
  
  // Environment tag
  environment: process.env.NODE_ENV || 'development',
  
  // Release tracking (set via Vercel environment variable)
  release: process.env.SENTRY_RELEASE,
  
  // Filter out health check endpoints and other noise
  beforeSend(event, hint) {
    // Don't send events in development unless explicitly testing
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_ENABLE_DEV) {
      return null;
    }
    return event;
  },
});

