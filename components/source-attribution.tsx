'use client';

// Phase 2: Source attribution component
// Displays source names from message context

import { Prisma } from '@prisma/client';

interface SourceAttributionProps {
  chunkIds: string[];
  chatbotId: string;
  messageContext?: Prisma.JsonValue; // Message.context from database
  textColor?: string; // Dynamic text color based on time theme
}

/**
 * SourceAttribution component - Displays source names from message context
 * 
 * @component
 * @example
 * ```tsx
 * <SourceAttribution
 *   chunkIds={['chunk-1', 'chunk-2']}
 *   chatbotId="bot-123"
 *   messageContext={{
 *     chunks: [
 *       { sourceTitle: 'The Art of War' },
 *       { sourceTitle: 'Leadership Principles' }
 *     ]
 *   }}
 * />
 * ```
 * 
 * Features:
 * - Extracts source names from message.context.chunks
 * - Displays comma-separated list: "Sources: The Art of War, Leadership Principles"
 * - Small, muted text style (text-xs text-gray-500)
 * - Positioned below message actions (Copy/Save buttons)
 * - Handles missing source data gracefully (returns null if no sources)
 * - Deduplicates source names (shows each source once)
 * 
 * @param {SourceAttributionProps} props - Component props
 * @param {string[]} props.chunkIds - Array of chunk IDs from message context
 * @param {string} props.chatbotId - ID of the chatbot (for future use)
 * @param {Prisma.JsonValue} [props.messageContext] - Message.context from database (contains chunks array)
 * 
 * @returns {JSX.Element | null} Source attribution text or null if no sources found
 */
export function SourceAttribution({
  chunkIds,
  chatbotId,
  messageContext,
  textColor = '#4b5563', // Default gray-600, but will be overridden by dynamic color
}: SourceAttributionProps) {
  // Extract source names from message context
  const getSourceNames = (): string[] => {
    if (!messageContext || typeof messageContext !== 'object') {
      return [];
    }

    const context = messageContext as Record<string, unknown>;
    const chunks = context.chunks as Array<Record<string, unknown>> | undefined;

    if (!Array.isArray(chunks)) {
      return [];
    }

    // Extract unique source names from chunks
    const sourceNames = new Set<string>();
    
    chunks.forEach((chunk) => {
      const sourceTitle = chunk.sourceTitle as string | undefined;
      if (sourceTitle) {
        sourceNames.add(sourceTitle);
      }
    });

    return Array.from(sourceNames);
  };

  const sourceNames = getSourceNames();

  // Don't render if no sources found
  if (sourceNames.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 pt-2 text-xs" style={{ color: textColor, opacity: 0.8 }}>
      <span className="font-medium">Sources:</span>{' '}
      <span>{sourceNames.join(', ')}</span>
    </div>
  );
}

