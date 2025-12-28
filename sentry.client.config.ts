// sentry.client.config.ts
// Sentry configuration for client-side code (React components, browser)
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  
  // Set tracesSampleRate to capture performance data
  // Lower sample rate in production to reduce overhead
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Set sample rate for session replay (optional, for debugging)
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0, // Always capture replays on errors
  
  // Environment tag
  environment: process.env.NODE_ENV || 'development',
  
  // Release tracking
  release: process.env.SENTRY_RELEASE,
  
  // Filter out noise in development
  beforeSend(event, hint) {
    // Don't send events in development unless explicitly testing
    if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_SENTRY_ENABLE_DEV) {
      return null;
    }
    
    // Filter out common browser extension errors
    if (event.exception) {
      const error = hint.originalException;
      if (error && typeof error === 'object' && 'message' in error) {
        const message = String(error.message);
        // Filter out common browser extension errors
        if (
          message.includes('chrome-extension://') ||
          message.includes('moz-extension://') ||
          message.includes('safari-extension://')
        ) {
          return null;
        }
      }
    }
    
    return event;
  },
  
  // Integrations for better error tracking
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true, // Mask sensitive text in replays
      blockAllMedia: true, // Block media in replays for privacy
    }),
  ],
});


