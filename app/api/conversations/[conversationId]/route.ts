// app/api/conversations/[conversationId]/route.ts
// PATCH endpoint to update conversation fields (e.g., intakeCompleted)
// Generates AI suggestion pills when intake is completed

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { generateSuggestionPills } from '@/lib/pills/generate-suggestion-pills';
import { ChatbotType } from '@/lib/types/chatbot';

/**
 * PATCH /api/conversations/[conversationId]
 *
 * Updates conversation fields. Currently supports:
 * - intakeCompleted: boolean - marks intake as complete for this conversation
 *
 * When intakeCompleted is set to true, generates AI-powered personalized
 * suggestion pills based on the chatbot context and user's intake responses.
 * Falls back to chatbot's fallback pills if AI generation fails.
 *
 * Authentication: Optional - allows update if:
 * - User owns the conversation, OR
 * - Conversation is anonymous (userId is null)
 *
 * Request Body:
 * {
 *   intakeCompleted?: boolean;
 * }
 *
 * Response (Success - 200):
 * {
 *   conversation: {
 *     id: string;
 *     intakeCompleted: boolean;
 *     intakeCompletedAt: string | null;
 *   };
 *   suggestionPills?: string[]; // AI-generated or fallback pills (when intakeCompleted=true)
 * }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params;
    const { userId: clerkUserId } = await auth();
    const body = await request.json();

    // Get database user ID if authenticated
    let dbUserId: string | null = null;
    if (clerkUserId) {
      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { id: true },
      });
      dbUserId = user?.id || null;
    }

    // Validate conversation exists and get chatbotId for pill generation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { userId: true, chatbotId: true },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Allow update if user owns conversation or conversation is anonymous
    if (conversation.userId && conversation.userId !== dbUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // --- Batch intake persistence (Issues 1+3) ---
    const { messages: batchMessages, responses: batchResponses } = body;

    console.log('[PATCH conversation] Batch intake payload:', {
      conversationId,
      dbUserId,
      chatbotId: conversation.chatbotId,
      batchMessagesCount: batchMessages?.length ?? 0,
      batchResponsesCount: batchResponses?.length ?? 0,
    });

    if (batchMessages?.length > 0 || batchResponses?.length > 0) {
      // Build transaction operations
      const txOps: any[] = [];

      // 1. Batch create messages with explicit createdAt for correct ordering
      if (batchMessages?.length > 0) {
        const validMessages = batchMessages.filter(
          (msg: any) => (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string'
        );
        console.log('[PATCH conversation] Valid messages:', validMessages.length, 'of', batchMessages.length);
        if (validMessages.length > 0) {
          txOps.push(
            prisma.message.createMany({
              data: validMessages.map((msg: any) => ({
                conversationId,
                userId: msg.role === 'user' ? dbUserId : null,
                role: msg.role,
                content: msg.content,
                context: null,
                followUpPills: [],
                sourceIds: [],
                createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
              })),
            })
          );
          txOps.push(
            prisma.conversation.update({
              where: { id: conversationId },
              data: { messageCount: { increment: validMessages.length } },
            })
          );
        }
      }

      // 2. Batch upsert responses + User_Context sync
      if (batchResponses?.length > 0 && dbUserId) {
        // Bulk-fetch question slugs (needed for User_Context keys)
        const questionIds = batchResponses.map((r: any) => r.intakeQuestionId);
        console.log('[PATCH conversation] Batch response questionIds:', questionIds);
        const questions = await prisma.intake_Question.findMany({
          where: { id: { in: questionIds } },
          select: { id: true, slug: true },
        });
        const slugMap = new Map(questions.map((q: any) => [q.id, q.slug]));
        console.log('[PATCH conversation] Found questions with slugs:', Array.from(slugMap.entries()));

        // Bulk-validate question-chatbot associations
        const associations = await prisma.chatbot_Intake_Question.findMany({
          where: { chatbotId: conversation.chatbotId, intakeQuestionId: { in: questionIds } },
          select: { intakeQuestionId: true },
        });
        const validQuestionIds = new Set(associations.map((a: any) => a.intakeQuestionId));
        console.log('[PATCH conversation] Valid question IDs (chatbot-associated):', Array.from(validQuestionIds));

        for (const r of batchResponses) {
          if (!validQuestionIds.has(r.intakeQuestionId)) {
            console.log('[PATCH conversation] Skipping response - question not associated with chatbot:', r.intakeQuestionId);
            continue;
          }
          const slug = slugMap.get(r.intakeQuestionId);
          if (!slug) {
            console.log('[PATCH conversation] Skipping response - no slug for question:', r.intakeQuestionId);
            continue;
          }

          console.log('[PATCH conversation] Adding upsert for response:', {
            questionId: r.intakeQuestionId,
            slug,
            valueType: typeof r.value,
            value: typeof r.value === 'string' ? r.value.substring(0, 50) : r.value,
          });

          txOps.push(
            prisma.intake_Response.upsert({
              where: {
                userId_intakeQuestionId_chatbotId: {
                  userId: dbUserId,
                  intakeQuestionId: r.intakeQuestionId,
                  chatbotId: conversation.chatbotId,
                },
              },
              create: {
                userId: dbUserId,
                intakeQuestionId: r.intakeQuestionId,
                chatbotId: conversation.chatbotId,
                value: r.value,
                reusableAcrossFrameworks: false,
              },
              update: { value: r.value, updatedAt: new Date() },
            })
          );
          txOps.push(
            prisma.user_Context.upsert({
              where: {
                userId_chatbotId_key: {
                  userId: dbUserId,
                  chatbotId: conversation.chatbotId,
                  key: slug,
                },
              },
              create: {
                userId: dbUserId,
                chatbotId: conversation.chatbotId,
                key: slug,
                value: r.value,
                source: 'INTAKE_FORM',
                isVisible: true,
                isEditable: true,
              },
              update: { value: r.value, source: 'INTAKE_FORM', updatedAt: new Date() },
            })
          );
        }
      }

      // Execute all persistence in one transaction
      console.log('[PATCH conversation] Executing transaction with', txOps.length, 'operations');
      if (txOps.length > 0) {
        try {
          await prisma.$transaction(txOps);
          console.log('[PATCH conversation] Transaction succeeded');
        } catch (txError) {
          console.error('[PATCH conversation] Transaction FAILED:', txError);
          throw txError; // Re-throw to be caught by outer catch
        }
      }
    }
    // --- End batch intake persistence ---

    // Build update data - only allow specific fields
    const updateData: { intakeCompleted?: boolean; intakeCompletedAt?: Date } = {};

    if (typeof body.intakeCompleted === 'boolean') {
      updateData.intakeCompleted = body.intakeCompleted;
      if (body.intakeCompleted) {
        updateData.intakeCompletedAt = new Date();
      }
    }

    // Only update if there's something to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
      select: {
        id: true,
        intakeCompleted: true,
        intakeCompletedAt: true,
      },
    });

    // Generate AI suggestion pills when intake is completed
    let suggestionPills: string[] | undefined;
    console.log('[Pills Debug - PATCH] Checking pill generation conditions:', {
      intakeCompleted: body.intakeCompleted,
      dbUserId,
      conversationId,
    });
    if (body.intakeCompleted === true && dbUserId) {
      console.log('[Pills Debug - PATCH] Starting pill generation');
      try {
        // Fetch chatbot context for pill generation
        const chatbot = await prisma.chatbot.findUnique({
          where: { id: conversation.chatbotId },
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

        console.log('[Pills Debug - PATCH] Chatbot found:', {
          chatbotId: chatbot?.id,
          title: chatbot?.title,
          hasFallbackPills: !!(chatbot?.fallbackSuggestionPills as string[])?.length,
        });
        if (chatbot) {
          // Transform junction table results to flat source array
          const sourceTitles = chatbot.sources.map((cs) => ({ title: cs.source.title }));
          // Fetch intake responses for this user and chatbot
          const intakeResponses = await prisma.intake_Response.findMany({
            where: {
              userId: dbUserId,
              chatbotId: conversation.chatbotId,
            },
            include: {
              intakeQuestion: {
                select: { id: true, questionText: true },
              },
            },
          });

          console.log('[Pills Debug - PATCH] Intake responses found:', intakeResponses.length);

          // Build intake context
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

          // Get custom prompt from configJson if available
          const configJson = chatbot.configJson as Record<string, unknown> | null;
          const customPrompt = configJson?.suggestionPillsPrompt as string | undefined;

          console.log('[Pills Debug - PATCH] Calling generateSuggestionPills');
          // Generate personalized pills
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

          console.log('[Pills Debug - PATCH] Generation result:', {
            pillsLength: pills.length,
            generationTimeMs,
            error,
          });

          // Determine which pills to return
          if (pills.length > 0) {
            suggestionPills = pills;
            console.log(
              `[suggestion-pills] Generated ${pills.length} pills in ${generationTimeMs}ms for conversation ${conversationId}`
            );

            // Cache pills on conversation (fire-and-forget)
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
          } else {
            // Use fallback pills if AI generation failed or returned empty
            suggestionPills = (chatbot.fallbackSuggestionPills as string[]) || undefined;
            console.log('[Pills Debug - PATCH] Using fallback pills:', suggestionPills?.length);
            if (error) {
              console.error(
                `[suggestion-pills] Generation failed for conversation ${conversationId}, using fallbacks:`,
                error
              );
            }
          }
        }
      } catch (pillError) {
        console.error('[Pills Debug - PATCH] Error during pill generation:', pillError);
        // Don't fail the whole request if pill generation fails
      }
    }

    console.log('[Pills Debug - PATCH] Final suggestionPills to return:', suggestionPills?.length);

    return NextResponse.json({
      conversation: {
        id: updated.id,
        intakeCompleted: updated.intakeCompleted,
        intakeCompletedAt: updated.intakeCompletedAt?.toISOString() || null,
      },
      ...(suggestionPills && { suggestionPills }),
    });
  } catch (error) {
    console.error('[PATCH conversation] Error:', error);
    const details = error instanceof Error
      ? { message: error.message, name: error.name, ...(('code' in error) ? { code: (error as any).code } : {}) }
      : { raw: String(error) };
    return NextResponse.json(
      { error: 'Internal server error', ...(process.env.NODE_ENV !== 'production' && { details }) },
      { status: 500 }
    );
  }
}
