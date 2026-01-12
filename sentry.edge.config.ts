// sentry.edge.config.ts
// Sentry configuration for Edge Runtime (middleware, edge API routes)
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  
  // Lower sample rate for edge runtime to reduce overhead
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,
  
  // Environment tag
  environment: process.env.NODE_ENV || 'development',
  
  // Release tracking
  release: process.env.SENTRY_RELEASE,
  
  // Filter out noise in development
  beforeSend(event, hint) {
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_ENABLE_DEV) {
      return null;
    }
    return event;
  },
});






