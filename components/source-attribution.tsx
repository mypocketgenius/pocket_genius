'use client';

// Phase 2: Source attribution component
// Displays source names from message context

import { Prisma } from '@prisma/client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

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
 * - Adds "Your Personal Context" link if user has completed intake questions
 * - Small, muted text style (text-xs text-gray-500)
 * - Positioned below message actions (Copy/Save buttons)
 * - Handles missing source data gracefully (returns null if no sources)
 * - Deduplicates source names (shows each source once)
 * 
 * @param {SourceAttributionProps} props - Component props
 * @param {string[]} props.chunkIds - Array of chunk IDs from message context
 * @param {string} props.chatbotId - ID of the chatbot (for checking intake completion)
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
  const [hasCompletedIntake, setHasCompletedIntake] = useState<boolean>(false);

  // Check if user has completed intake questions for this chatbot
  useEffect(() => {
    const checkIntakeCompletion = async () => {
      try {
        const response = await fetch(`/api/intake/completion?chatbotId=${chatbotId}`);
        if (response.ok) {
          const data = await response.json();
          // Set to true if intake is completed AND there are questions
          setHasCompletedIntake(data.completed && data.hasQuestions);
        } else {
          setHasCompletedIntake(false);
        }
      } catch (error) {
        console.error('Error checking intake completion:', error);
        setHasCompletedIntake(false);
      }
    };

    checkIntakeCompletion();
  }, [chatbotId]);

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

  // Don't render if no sources found and intake not completed
  // If intake is completed but no sources, we still want to show "Your Personal Context"
  if (sourceNames.length === 0 && !hasCompletedIntake) {
    return null;
  }

  // Determine link color (slightly brighter than text color for visibility)
  const linkColor = textColor || '#4b5563';
  const linkHoverColor = '#2563eb'; // Blue hover color

  return (
    <div className="mt-2 pt-2 text-xs" style={{ color: textColor, opacity: 0.8 }}>
      <span className="font-medium">Sources:</span>{' '}
      {sourceNames.length > 0 && (
        <>
          <span>{sourceNames.join(', ')}</span>
          {hasCompletedIntake && ', '}
        </>
      )}
      {hasCompletedIntake && (
        <Link
          href="/profile"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:no-underline transition-all"
          style={{
            color: linkColor,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = linkHoverColor;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = linkColor;
          }}
        >
          Your Personal Context
        </Link>
      )}
    </div>
  );
}

