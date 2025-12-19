// app/api/jobs/update-chunk-performance/route.ts
// Phase 4, Task 10: Background job to aggregate Events and Pill_Usage into Chunk_Performance counters
// Runs daily at midnight UTC via Vercel Cron (Hobby plan limitation: daily cron jobs only)

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * POST /api/jobs/update-chunk-performance
 * 
 * Background job that aggregates Events and Pill_Usage data into Chunk_Performance counters.
 * 
 * Process:
 * 1. Query Events and Pill_Usage from last 24 hours
 * 2. Group by chunkId
 * 3. Update Chunk_Performance counters:
 *    - Copy events → increment copyToUseNowCount (if metadata.copyUsage='use_now')
 *    - Pill_Usage with feedback pill='helpful' → increment helpfulCount
 *    - Pill_Usage with feedback pill='not_helpful' → increment notHelpfulCount
 *    - Pill_Usage with expansion pill → increment appropriate needs*Count
 * 4. Recalculate satisfactionRate from helpfulCount / (helpfulCount + notHelpfulCount)
 * 
 * Schedule: Daily at midnight UTC (Vercel Cron: 0 0 * * *)
 * Note: Vercel Hobby plan only supports daily cron jobs
 * 
 * @example
 * ```bash
 * # Manual trigger (for testing)
 * curl -X POST http://localhost:3000/api/jobs/update-chunk-performance
 * ```
 * 
 * @returns {Promise<NextResponse>} JSON response with processing summary
 * @throws {500} If database error occurs
 */
export async function POST(req: Request) {
  try {
    // Verify this is a cron job request (optional security check)
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const startTime = Date.now();
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get current month/year for Chunk_Performance records
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    console.log(`[Update Chunk Performance] Starting aggregation for events/pill usage since ${twentyFourHoursAgo.toISOString()}`);

    // 1. Query Events from last 24 hours
    const recentEvents = await prisma.event.findMany({
      where: {
        timestamp: {
          gte: twentyFourHoursAgo,
        },
      },
      select: {
        id: true,
        eventType: true,
        chunkIds: true,
        metadata: true,
        sessionId: true,
      },
    });

    // 2. Query Pill_Usage from last 24 hours
    const recentPillUsages = await prisma.pill_Usage.findMany({
      where: {
        timestamp: {
          gte: twentyFourHoursAgo,
        },
      },
      select: {
        id: true,
        pillId: true,
        sourceChunkIds: true,
        chatbotId: true,
        pill: {
          select: {
            id: true,
            pillType: true,
            label: true,
          },
        },
      },
    });

    console.log(`[Update Chunk Performance] Found ${recentEvents.length} events and ${recentPillUsages.length} pill usages`);

    // 3. Group Events by chunkId
    const eventCountsByChunk: Record<string, {
      copyToUseNow: number;
      chatbotId: string;
      sourceId?: string;
    }> = {};

    for (const event of recentEvents) {
      // Only process copy events (other event types don't update Chunk_Performance)
      if (event.eventType === 'copy') {
        const metadata = event.metadata as any;
        const copyUsage = metadata?.copyUsage;
        
        // Only increment copyToUseNowCount if copyUsage is 'use_now'
        if (copyUsage === 'use_now' && event.chunkIds.length > 0) {
          // Get chatbotId from sessionId (conversation)
          let chatbotId: string | null = null;
          if (event.sessionId) {
            const conversation = await prisma.conversation.findUnique({
              where: { id: event.sessionId },
              select: { chatbotId: true },
            });
            chatbotId = conversation?.chatbotId || null;
          }

          if (chatbotId) {
            for (const chunkId of event.chunkIds) {
              if (!eventCountsByChunk[chunkId]) {
                eventCountsByChunk[chunkId] = {
                  copyToUseNow: 0,
                  chatbotId,
                };
              }
              eventCountsByChunk[chunkId].copyToUseNow += 1;
            }
          }
        }
      }
    }

    // 4. Group Pill_Usage by chunkId and pill type
    const pillUsageCountsByChunk: Record<string, {
      helpful: number;
      notHelpful: number;
      needsExamples: number;
      needsSteps: number;
      needsScripts: number;
      needsCaseStudy: number;
      chatbotId: string;
      sourceId?: string;
    }> = {};

    for (const pillUsage of recentPillUsages) {
      const { pill, sourceChunkIds, chatbotId } = pillUsage;
      
      if (sourceChunkIds.length === 0) {
        continue; // Skip if no chunks
      }

      // Map pill IDs to counter types
      const pillId = pill.id;
      let counterType: 'helpful' | 'notHelpful' | 'needsExamples' | 'needsSteps' | 'needsScripts' | 'needsCaseStudy' | null = null;

      if (pill.pillType === 'feedback') {
        if (pillId === 'pill_helpful_system') {
          counterType = 'helpful';
        } else if (pillId === 'pill_not_helpful_system') {
          counterType = 'notHelpful';
        }
      } else if (pill.pillType === 'expansion') {
        if (pillId === 'pill_example_system') {
          counterType = 'needsExamples';
        } else if (pillId === 'pill_how_to_use_system') {
          counterType = 'needsSteps';
        } else if (pillId === 'pill_say_more_system') {
          counterType = 'needsScripts';
        } else if (pillId === 'pill_who_done_system') {
          counterType = 'needsCaseStudy';
        }
      }

      if (counterType) {
        for (const chunkId of sourceChunkIds) {
          if (!pillUsageCountsByChunk[chunkId]) {
            pillUsageCountsByChunk[chunkId] = {
              helpful: 0,
              notHelpful: 0,
              needsExamples: 0,
              needsSteps: 0,
              needsScripts: 0,
              needsCaseStudy: 0,
              chatbotId,
            };
          }
          pillUsageCountsByChunk[chunkId][counterType] += 1;
        }
      }
    }

    // 5. Get sourceId for chunks from existing Chunk_Performance records
    // This is more efficient than querying Messages for each chunk
    const allChunkIds = [
      ...Object.keys(eventCountsByChunk),
      ...Object.keys(pillUsageCountsByChunk),
    ];
    const uniqueChunkIds = [...new Set(allChunkIds)];

    if (uniqueChunkIds.length > 0) {
      // Query existing Chunk_Performance records to get sourceId
      const existingChunks = await prisma.chunk_Performance.findMany({
        where: {
          chunkId: { in: uniqueChunkIds },
          month,
          year,
        },
        select: {
          chunkId: true,
          sourceId: true,
          chatbotId: true,
        },
      });

      // Create a map of chunkId -> sourceId for existing chunks
      const chunkSourceMap = new Map<string, { sourceId: string; chatbotId: string }>();
      for (const chunk of existingChunks) {
        chunkSourceMap.set(chunk.chunkId, {
          sourceId: chunk.sourceId,
          chatbotId: chunk.chatbotId,
        });
      }

      // For chunks not in Chunk_Performance, try to get sourceId from Messages
      const chunksNeedingSourceId = uniqueChunkIds.filter(
        (chunkId) => !chunkSourceMap.has(chunkId)
      );

      if (chunksNeedingSourceId.length > 0) {
        // Query Messages to find sourceId for chunks
        const messages = await prisma.message.findMany({
          where: {
            role: 'assistant',
            context: { not: Prisma.JsonNull },
          },
          select: {
            context: true,
            conversation: {
              select: {
                chatbotId: true,
              },
            },
          },
          take: 1000, // Limit to avoid performance issues
        });

        for (const message of messages) {
          const context = message.context as any;
          if (context?.chunks && Array.isArray(context.chunks)) {
            for (const chunk of context.chunks) {
              if (
                chunk.chunkId &&
                chunksNeedingSourceId.includes(chunk.chunkId) &&
                chunk.sourceId &&
                !chunkSourceMap.has(chunk.chunkId)
              ) {
                chunkSourceMap.set(chunk.chunkId, {
                  sourceId: chunk.sourceId,
                  chatbotId: message.conversation.chatbotId,
                });
              }
            }
          }
        }
      }

      // Update sourceId in our counts maps
      for (const chunkId of Object.keys(eventCountsByChunk)) {
        const sourceInfo = chunkSourceMap.get(chunkId);
        if (sourceInfo) {
          eventCountsByChunk[chunkId].sourceId = sourceInfo.sourceId;
          eventCountsByChunk[chunkId].chatbotId = sourceInfo.chatbotId;
        }
      }

      for (const chunkId of Object.keys(pillUsageCountsByChunk)) {
        const sourceInfo = chunkSourceMap.get(chunkId);
        if (sourceInfo) {
          pillUsageCountsByChunk[chunkId].sourceId = sourceInfo.sourceId;
          pillUsageCountsByChunk[chunkId].chatbotId = sourceInfo.chatbotId;
        }
      }
    }

    // 6. Update Chunk_Performance records
    let chunksUpdated = 0;
    let chunksCreated = 0;
    const updatePromises: Promise<any>[] = [];

    // Process Events (copy events)
    for (const [chunkId, counts] of Object.entries(eventCountsByChunk)) {
      if (!counts.sourceId || !counts.chatbotId) {
        console.warn(`[Update Chunk Performance] Skipping chunk ${chunkId} - missing sourceId or chatbotId`);
        continue;
      }

      if (counts.copyToUseNow > 0) {
        updatePromises.push(
          prisma.chunk_Performance.upsert({
            where: {
              chunkId_chatbotId_month_year: {
                chunkId,
                chatbotId: counts.chatbotId,
                month,
                year,
              },
            },
            create: {
              chunkId,
              sourceId: counts.sourceId,
              chatbotId: counts.chatbotId,
              month,
              year,
              copyToUseNowCount: counts.copyToUseNow,
              satisfactionRate: 0,
            },
            update: {
              copyToUseNowCount: { increment: counts.copyToUseNow },
            },
          }).then((result) => {
            if (result.createdAt.getTime() === result.updatedAt.getTime()) {
              chunksCreated++;
            } else {
              chunksUpdated++;
            }
          })
        );
      }
    }

    // Process Pill_Usage (feedback and expansion pills)
    for (const [chunkId, counts] of Object.entries(pillUsageCountsByChunk)) {
      if (!counts.sourceId || !counts.chatbotId) {
        console.warn(`[Update Chunk Performance] Skipping chunk ${chunkId} - missing sourceId or chatbotId`);
        continue;
      }

      const hasUpdates =
        counts.helpful > 0 ||
        counts.notHelpful > 0 ||
        counts.needsExamples > 0 ||
        counts.needsSteps > 0 ||
        counts.needsScripts > 0 ||
        counts.needsCaseStudy > 0;

      if (hasUpdates) {
        updatePromises.push(
          prisma.chunk_Performance.upsert({
            where: {
              chunkId_chatbotId_month_year: {
                chunkId,
                chatbotId: counts.chatbotId,
                month,
                year,
              },
            },
            create: {
              chunkId,
              sourceId: counts.sourceId,
              chatbotId: counts.chatbotId,
              month,
              year,
              helpfulCount: counts.helpful,
              notHelpfulCount: counts.notHelpful,
              needsExamplesCount: counts.needsExamples,
              needsStepsCount: counts.needsSteps,
              needsScriptsCount: counts.needsScripts,
              needsCaseStudyCount: counts.needsCaseStudy,
              satisfactionRate: counts.helpful + counts.notHelpful > 0
                ? counts.helpful / (counts.helpful + counts.notHelpful)
                : 0,
            },
            update: {
              helpfulCount: { increment: counts.helpful },
              notHelpfulCount: { increment: counts.notHelpful },
              needsExamplesCount: { increment: counts.needsExamples },
              needsStepsCount: { increment: counts.needsSteps },
              needsScriptsCount: { increment: counts.needsScripts },
              needsCaseStudyCount: { increment: counts.needsCaseStudy },
            },
          }).then(async (result) => {
            // Recalculate satisfactionRate after update
            const updated = await prisma.chunk_Performance.findUnique({
              where: { id: result.id },
              select: {
                helpfulCount: true,
                notHelpfulCount: true,
              },
            });

            if (updated) {
              const totalFeedback = updated.helpfulCount + updated.notHelpfulCount;
              const satisfactionRate = totalFeedback > 0
                ? updated.helpfulCount / totalFeedback
                : 0;

              await prisma.chunk_Performance.update({
                where: { id: result.id },
                data: { satisfactionRate },
              });
            }

            if (result.createdAt.getTime() === result.updatedAt.getTime()) {
              chunksCreated++;
            } else {
              chunksUpdated++;
            }
          })
        );
      }
    }

    // Execute all updates in parallel
    await Promise.allSettled(updatePromises);

    const duration = Date.now() - startTime;

    console.log(
      `[Update Chunk Performance] Completed in ${duration}ms: ` +
      `${chunksCreated} created, ${chunksUpdated} updated`
    );

    return NextResponse.json({
      success: true,
      processed: {
        events: recentEvents.length,
        pillUsages: recentPillUsages.length,
        chunksCreated,
        chunksUpdated,
      },
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error('[Update Chunk Performance] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update chunk performance',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

