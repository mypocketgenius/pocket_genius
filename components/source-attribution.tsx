'use client';

import { Prisma } from '@prisma/client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ExternalLink } from 'lucide-react';

interface SourceAttributionProps {
  chunkIds: string[];
  chatbotId: string;
  messageContext?: Prisma.JsonValue;
  textColor?: string;
}

interface ChunkData {
  chunkId: string;
  sourceId: string;
  sourceTitle: string | null;
  sourceAuthors: string | null;
  sourceYear: number | null;
  sourceLicense: string | null;
  sourceLicenseUrl: string | null;
  sourceUrl: string | null;
  text: string;
  page: number | null;
  section: string | null;
}

interface GroupedSource {
  id: string;
  title: string;
  authors: string | null;
  year: number | null;
  license: string | null;
  licenseUrl: string | null;
  url: string | null;
  chunks: ChunkData[];
}

export function SourceAttribution({
  chunkIds,
  chatbotId,
  messageContext,
  textColor = '#4b5563',
}: SourceAttributionProps) {
  const [hasCompletedIntake, setHasCompletedIntake] = useState<boolean>(false);

  useEffect(() => {
    const checkIntakeCompletion = async () => {
      try {
        const response = await fetch(`/api/intake/completion?chatbotId=${chatbotId}`);
        if (response.ok) {
          const data = await response.json();
          setHasCompletedIntake(data.completed && data.hasQuestions);
        }
      } catch (error) {
        console.error('Error checking intake completion:', error);
      }
    };
    checkIntakeCompletion();
  }, [chatbotId]);

  // Group chunks by source
  const getGroupedSources = (): GroupedSource[] => {
    if (!messageContext || typeof messageContext !== 'object') {
      return [];
    }

    const context = messageContext as Record<string, unknown>;
    const chunks = context.chunks as ChunkData[] | undefined;

    if (!Array.isArray(chunks)) {
      return [];
    }

    const sourceMap = new Map<string, GroupedSource>();

    chunks.forEach((chunk) => {
      if (!chunk.sourceId || !chunk.sourceTitle) return;

      if (!sourceMap.has(chunk.sourceId)) {
        sourceMap.set(chunk.sourceId, {
          id: chunk.sourceId,
          title: chunk.sourceTitle,
          authors: chunk.sourceAuthors,
          year: chunk.sourceYear,
          license: chunk.sourceLicense,
          licenseUrl: chunk.sourceLicenseUrl,
          url: chunk.sourceUrl,
          chunks: [],
        });
      }

      sourceMap.get(chunk.sourceId)!.chunks.push(chunk);
    });

    return Array.from(sourceMap.values());
  };

  const groupedSources = getGroupedSources();

  if (groupedSources.length === 0 && !hasCompletedIntake) {
    return null;
  }

  return (
    <div className="mt-2 pt-2 text-xs" style={{ color: textColor, opacity: 0.8 }}>
      <span className="font-medium">Sources:</span>{' '}

      {groupedSources.map((source, index) => (
        <span key={source.id}>
          {index > 0 && ' • '}
          <Dialog>
            <DialogTrigger asChild>
              <button
                className="underline hover:no-underline cursor-pointer"
                style={{ color: textColor }}
              >
                {source.title}
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Source Details</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Source metadata */}
                <div className="space-y-2 text-sm">
                  <div className="flex">
                    <span className="font-medium w-20">Title:</span>
                    <span>{source.title}</span>
                  </div>
                  {source.authors && (
                    <div className="flex">
                      <span className="font-medium w-20">Authors:</span>
                      <span>{source.authors}</span>
                    </div>
                  )}
                  {source.year && (
                    <div className="flex">
                      <span className="font-medium w-20">Year:</span>
                      <span>{source.year}</span>
                    </div>
                  )}
                  {source.license && (
                    <div className="flex">
                      <span className="font-medium w-20">License:</span>
                      <span>{source.license}</span>
                    </div>
                  )}
                </div>

                {/* Excerpts */}
                {source.chunks.length > 0 && (
                  <div>
                    <p className="font-medium text-sm mb-2">
                      Excerpts Used in This Response:
                    </p>
                    <div className="space-y-2">
                      {source.chunks.map((chunk, i) => (
                        <div
                          key={chunk.chunkId || i}
                          className="text-sm text-muted-foreground bg-muted/50 p-2 rounded"
                        >
                          {(chunk.page || chunk.section) && (
                            <p className="text-xs text-muted-foreground mb-1">
                              {chunk.page && `Page ${chunk.page}`}
                              {chunk.page && chunk.section && ' • '}
                              {chunk.section}
                            </p>
                          )}
                          <p className="italic">&quot;{chunk.text}&quot;</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action links */}
                <div className="flex gap-4 pt-2 border-t">
                  {source.licenseUrl && (
                    <a
                      href={source.licenseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      View License <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {source.url && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Visit Original <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </span>
      ))}

      {hasCompletedIntake && (
        <>
          {groupedSources.length > 0 && ' • '}
          <Link
            href="/profile"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
            style={{ color: textColor }}
          >
            Your Personal Context
          </Link>
        </>
      )}
    </div>
  );
}
