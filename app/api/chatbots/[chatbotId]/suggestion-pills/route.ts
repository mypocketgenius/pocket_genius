// app/api/chatbots/[chatbotId]/suggestion-pills/route.ts
// Dedicated endpoint for fetching/generating AI suggestion pills
// Called after screen loads to avoid blocking the welcome API

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { generateSuggestionPills } from '@/lib/pills/generate-suggestion-pills';
import { ChatbotType } from '@/lib/types/chatbot';

// Cache TTL for suggestion pills (7 days)
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

/**
 * GET /api/chatbots/[chatbotId]/suggestion-pills
 *
 * Dedicated endpoint for fetching/generating suggestion pills.
 * Called after screen loads to avoid blocking the welcome API.
 *
 * Query params:
 * - conversationId (optional): Check cache on this conversation
 *
 * Returns:
 * - pills: string[] - AI-generated or fallback pills
 * - source: 'cached' | 'generated' | 'fallback'
 * - generationTimeMs?: number - Only present if source is 'generated'
 *
 * Authentication: Required
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { chatbotId } = await params;
    const url = new URL(request.url);
    const conversationId = url.searchParams.get('conversationId');

    // 1. Authenticate
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 2. Check for cached pills on conversation
    if (conversationId) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          suggestionPillsCache: true,
          suggestionPillsCachedAt: true,
        },
      });

      if (conversation?.suggestionPillsCache) {
        const cacheAge = conversation.suggestionPillsCachedAt
          ? Date.now() - new Date(conversation.suggestionPillsCachedAt).getTime()
          : Infinity;

        if (cacheAge < CACHE_TTL) {
          return NextResponse.json({
            pills: conversation.suggestionPillsCache as string[],
            source: 'cached',
          });
        }
      }
    }

    // 3. Fetch chatbot for generation
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        configJson: true,
        fallbackSuggestionPills: true,
        creator: { select: { name: true } },
        sources: { select: { source: { select: { title: true } } } },
      },
    });

    if (!chatbot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }

    // Transform junction table results to flat source array
    const sourceTitles = chatbot.sources.map((cs) => ({ title: cs.source.title }));

    // 4. Fetch intake responses
    const intakeResponses = await prisma.intake_Response.findMany({
      where: {
        userId: user.id,
        chatbotId,
      },
      include: {
        intakeQuestion: {
          select: { id: true, questionText: true },
        },
      },
    });

    // 5. Generate pills
    const intakeContext = {
      responses: Object.fromEntries(
        intakeResponses.map((r) => [
          r.intakeQuestionId,
          typeof r.value === 'string' ? r.value : JSON.stringify(r.value),
        ])
      ),
      questions: intakeResponses.map((r) => ({
        id: r.intakeQuestion.id,
        questionText: r.intakeQuestion.questionText,
      })),
    };

    const configJson = chatbot.configJson as Record<string, unknown> | null;
    const customPrompt = configJson?.suggestionPillsPrompt as string | undefined;

    const { pills, generationTimeMs, error } = await generateSuggestionPills({
      chatbot: {
        id: chatbot.id,
        title: chatbot.title,
        description: chatbot.description,
        type: chatbot.type as ChatbotType | null,
        creator: chatbot.creator,
        sources: sourceTitles,
      },
      intake: intakeContext,
      customPrompt,
    });

    // 6. Handle result
    if (pills.length > 0) {
      // Cache pills (fire-and-forget)
      if (conversationId) {
        prisma.conversation
          .update({
            where: { id: conversationId },
            data: {
              suggestionPillsCache: pills,
              suggestionPillsCachedAt: new Date(),
            },
          })
          .catch((err) =>
            console.error('[suggestion-pills] Cache update failed:', err)
          );
      }

      console.log(
        `[suggestion-pills] Generated ${pills.length} pills in ${generationTimeMs}ms`
      );

      return NextResponse.json({
        pills,
        source: 'generated',
        generationTimeMs,
      });
    }

    // 7. Fallback
    if (error) {
      console.error(`[suggestion-pills] Generation failed:`, error);
    }

    const fallbackPills = (chatbot.fallbackSuggestionPills as string[]) || [];
    return NextResponse.json({
      pills: fallbackPills,
      source: 'fallback',
    });
  } catch (error) {
    console.error('[suggestion-pills] Endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestion pills' },
      { status: 500 }
    );
  }
}
