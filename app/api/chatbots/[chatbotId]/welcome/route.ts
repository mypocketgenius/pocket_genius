// app/api/chatbots/[chatbotId]/welcome/route.ts
// Conversational Intake Flow - Welcome Data Endpoint
// GET: Returns chatbot welcome data including name, purpose, intake status, questions, and existing responses

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { generatePurposeText } from '@/lib/chatbot/generate-purpose';

// Cache TTL for suggestion pills (7 days)
const SUGGESTION_PILLS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

/**
 * GET /api/chatbots/[chatbotId]/welcome
 *
 * Returns chatbot welcome data for conversational intake flow:
 * - Chatbot name
 * - Chatbot purpose (generated)
 * - Whether intake is completed
 * - Intake questions (if not completed)
 * - Existing responses (if any)
 * - Welcome message (for post-intake display)
 * - Fallback suggestion pills (if AI generation fails)
 * - Cached suggestion pills (for returning users)
 *
 * Authentication: Optional (allows anonymous users)
 *
 * Response Format:
 * {
 *   chatbotName: string;
 *   chatbotPurpose: string; // Generated purpose text
 *   intakeCompleted: boolean; // @deprecated Use conversation.intakeCompleted for per-conversation state
 *   hasQuestions: boolean;
 *   existingResponses?: Record<string, any>; // Map of questionId -> saved value
 *   questions?: Array<{
 *     id: string;
 *     questionText: string;
 *     helperText?: string | null;
 *     responseType: string;
 *     displayOrder: number;
 *     isRequired: boolean;
 *     options?: string[] | null; // For SELECT/MULTI_SELECT
 *   }>;
 *   conversation?: { // Present when conversationId query param is provided
 *     intakeCompleted: boolean; // Per-conversation intake completion status
 *     hasMessages: boolean; // Whether conversation has any messages
 *   } | null;
 *   welcomeMessage?: string; // Chatbot-specific welcome message for post-intake
 *   fallbackSuggestionPills?: string[]; // Fallback pills if AI generation fails
 *   cachedSuggestionPills?: string[]; // Cached AI-generated pills for returning users
 * }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { chatbotId } = await params;

    if (!chatbotId) {
      return NextResponse.json(
        { error: 'Chatbot ID is required' },
        { status: 400 }
      );
    }

    // 1. Authenticate user (optional - allows anonymous users)
    const { userId: clerkUserId } = await auth();
    
    // Get database user ID if authenticated
    let dbUserId: string | null = null;
    if (clerkUserId) {
      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { id: true },
      });
      dbUserId = user?.id || null;
    }

    // 2. Fetch conversation data if conversationId provided
    const url = new URL(request.url);
    const conversationId = url.searchParams.get('conversationId');
    let conversationData: {
      intakeCompleted: boolean;
      messageCount: number;
      suggestionPillsCache: unknown;
      suggestionPillsCachedAt: Date | null;
    } | null = null;

    if (conversationId) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          intakeCompleted: true,
          messageCount: true,
          suggestionPillsCache: true,
          suggestionPillsCachedAt: true,
        },
      });
      if (conversation) {
        conversationData = conversation;
      }
    }

    // 3. Fetch chatbot with relations needed for purpose text generation
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: {
        id: true,
        title: true,
        type: true,
        welcomeMessage: true,
        fallbackSuggestionPills: true,
        creator: {
          select: {
            name: true,
          },
        },
        sources: {
          select: {
            source: { select: { title: true } },
          },
          take: 1, // Only need first source for DEEP_DIVE
        },
      },
    });

    if (!chatbot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404 }
      );
    }

    // Transform junction table results to flat source array
    const sourceTitles = chatbot.sources.map((cs) => ({ title: cs.source.title }));

    // 4. Generate purpose text
    const chatbotPurpose = generatePurposeText({
      type: chatbot.type,
      creator: chatbot.creator,
      title: chatbot.title,
      sources: sourceTitles,
    });

    // 5. Get all intake questions for the chatbot through junction table
    const associations = await prisma.chatbot_Intake_Question.findMany({
      where: { chatbotId },
      include: {
        intakeQuestion: true,
      },
      orderBy: { displayOrder: 'asc' },
    });

    const hasQuestions = associations.length > 0;

    // 6. Get existing responses if user is authenticated
    let existingResponses: Record<string, any> | undefined = undefined;
    let intakeCompleted = false;

    if (dbUserId) {
      const responses = await prisma.intake_Response.findMany({
        where: {
          userId: dbUserId,
          chatbotId,
        },
        select: {
          intakeQuestionId: true,
          value: true,
        },
      });

      // Build existingResponses map: questionId -> value
      existingResponses = {};
      responses.forEach((response) => {
        if (existingResponses) {
          existingResponses[response.intakeQuestionId] = response.value;
        }
      });

      // Check if intake is completed (all questions answered)
      if (hasQuestions) {
        const answeredQuestionIds = new Set(responses.map(r => r.intakeQuestionId));
        const allQuestionsAnswered = associations.every(
          (assoc) => answeredQuestionIds.has(assoc.intakeQuestionId)
        );
        intakeCompleted = allQuestionsAnswered;
      } else {
        // No questions = intake is considered completed
        intakeCompleted = true;
      }
    } else {
      // Not authenticated = intake not completed
      intakeCompleted = false;
    }

    // 7. Transform questions for response (always return questions if they exist, even if completed)
    // This allows verification flow to show questions when intake is already completed
    const questions = associations.length > 0
      ? associations.map((association) => ({
          id: association.intakeQuestion.id,
          questionText: association.intakeQuestion.questionText,
          helperText: association.intakeQuestion.helperText,
          responseType: association.intakeQuestion.responseType,
          displayOrder: association.displayOrder,
          isRequired: association.isRequired,
          options: association.intakeQuestion.options
            ? (association.intakeQuestion.options as string[])
            : null,
        }))
      : undefined;

    // 8. Check for cached suggestion pills on the conversation (for returning users)
    let cachedSuggestionPills: string[] | undefined = undefined;
    if (conversationData?.suggestionPillsCache) {
      const cacheAge = conversationData.suggestionPillsCachedAt
        ? Date.now() - new Date(conversationData.suggestionPillsCachedAt).getTime()
        : Infinity;

      if (cacheAge < SUGGESTION_PILLS_CACHE_TTL) {
        cachedSuggestionPills = conversationData.suggestionPillsCache as string[];
      }
    }

    // Note: AI pill generation has been moved to a dedicated async endpoint
    // (/api/chatbots/[chatbotId]/suggestion-pills) to avoid blocking the welcome API.
    // Pills are now fetched separately after the screen loads, with skeleton UI shown while loading.

    // Set cache headers to prevent caching of intake completion status
    // This ensures fresh data when responses are deleted or updated
    return NextResponse.json(
      {
        chatbotName: chatbot.title,
        chatbotPurpose,
        // @deprecated - Use conversation.intakeCompleted for per-conversation state.
        // This field indicates if the USER has answered all questions for this chatbot (across all conversations).
        // Kept for backward compatibility.
        intakeCompleted,
        hasQuestions,
        existingResponses: existingResponses && Object.keys(existingResponses).length > 0
          ? existingResponses
          : undefined,
        questions,
        // Conversation-scoped data (for gate decision)
        conversation: conversationData ? {
          intakeCompleted: conversationData.intakeCompleted,
          hasMessages: conversationData.messageCount > 0,
        } : null,
        // AI Suggestion Pills data
        welcomeMessage: chatbot.welcomeMessage ?? undefined,
        fallbackSuggestionPills: chatbot.fallbackSuggestionPills
          ? (chatbot.fallbackSuggestionPills as string[])
          : undefined,
        cachedSuggestionPills,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching chatbot welcome data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chatbot welcome data' },
      { status: 500 }
    );
  }
}

