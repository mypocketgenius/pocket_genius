// lib/monitoring/logger.ts
// Centralized logging utility for consistent monitoring across the application
// Phase 6, Task 6: Enhanced logging for Vercel monitoring

/**
 * Structured logging utility for better monitoring in Vercel Dashboard
 * 
 * Usage:
 *   import { logger } from '@/lib/monitoring/logger';
 *   logger.info('Chat request', { userId, chatbotId });
 *   logger.error('Pinecone failed', { error, chatbotId });
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  /**
   * Log info-level messages
   * Use for normal operation events (request received, processing started, etc.)
   */
  info(message: string, context?: LogContext): void {
    console.log(`[INFO] ${message}`, context || {});
  }

  /**
   * Log warning-level messages
   * Use for non-critical issues (rate limit approaching, degraded performance, etc.)
   */
  warn(message: string, context?: LogContext): void {
    console.warn(`[WARN] ${message}`, context || {});
  }

  /**
   * Log error-level messages
   * Use for errors that need attention (API failures, database errors, etc.)
   * Also sends to Sentry if configured
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    };
    
    console.error(`[ERROR] ${message}`, errorContext);
    
    // Send to Sentry if available (only in production or when explicitly enabled)
    if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
      try {
        // Dynamic import to avoid breaking if Sentry is not configured
        import('@sentry/nextjs').then((Sentry) => {
          if (error instanceof Error) {
            Sentry.captureException(error, {
              tags: context,
              level: 'error',
            });
          } else {
            Sentry.captureMessage(message, {
              level: 'error',
              extra: errorContext,
            });
          }
        }).catch(() => {
          // Sentry not available, continue without it
        });
      } catch {
        // Sentry not available, continue without it
      }
    }
  }

  /**
   * Log API route performance
   * Use to track response times for monitoring
   */
  performance(route: string, duration: number, context?: LogContext): void {
    const level: LogLevel = duration > 3000 ? 'warn' : 'info';
    const message = `[PERF] ${route} took ${duration}ms`;
    
    if (level === 'warn') {
      this.warn(message, { ...context, duration });
    } else {
      this.info(message, { ...context, duration });
    }
  }
}

export const logger = new Logger();

/**
 * Performance monitoring helper
 * Wraps async functions to automatically log execution time
 * 
 * Usage:
 *   const result = await withPerformanceLogging(
 *     'chat-api',
 *     { chatbotId },
 *     () => processChatRequest(req)
 *   );
 */
export async function withPerformanceLogging<T>(
  operation: string,
  context: LogContext,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    logger.performance(operation, duration, context);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`${operation} failed after ${duration}ms`, error, context);
    throw error;
  }
}
