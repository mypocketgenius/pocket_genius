// app/api/chat/route.ts
// Phase 3, Task 1: Chat API route with RAG-powered responses
// Phase 3, Task 5: Basic error handling for Pinecone, OpenAI, and database errors
// Generates query embedding, queries Pinecone, stores messages, and streams responses

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { queryRAG, type RetrievedChunk } from '@/lib/rag/query';
import { checkRateLimit, getRemainingMessages, RATE_LIMIT } from '@/lib/rate-limit';
import { logPillUsage } from '@/lib/pills/log-usage';
import { generateFollowUpPills } from '@/lib/follow-up-pills/generate-pills';

// Initialize OpenAI client with type-safe API key
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

/**
 * POST /api/chat
 * 
 * Handles chat messages with RAG-powered responses:
 * 1. Authenticates user
 * 2. Checks rate limit
 * 3. Creates/gets conversation
 * 4. Generates query embedding
 * 5. Queries Pinecone for relevant chunks
 * 6. Stores user message
 * 7. Generates and streams response with OpenAI GPT-4o
 * 8. Stores assistant message with context and sourceIds
 * 9. Updates conversation messageCount
 * 10. Updates chunk performance counters
 * 
 * Request body:
 * - messages: Array of message objects (for conversation history)
 * - conversationId: Optional conversation ID (creates new if not provided)
 * - chatbotId: Required chatbot ID
 * - pillMetadata: Optional pill usage metadata (Phase 4, Task 8)
 *   - feedbackPillId: Optional feedback pill ID
 *   - expansionPillId: Optional expansion pill ID
 *   - suggestedPillId: Optional suggested question pill ID
 *   - prefillText: Optional prefill text (required if pills used)
 *   - sentText: Optional sent text (required if pills used)
 *   - wasModified: Optional boolean indicating if user modified prefilled text
 * 
 * Response: Streaming text response
 */
export async function POST(req: Request) {
  try {
    // 1. Authenticate user (REQUIRED)
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get database user ID (required)
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const dbUserId = user.id; // Always present, no null

    // 2. Parse request body
    const body = await req.json();
    const {
      messages,
      conversationId: providedConversationId,
      chatbotId,
      // Phase 4, Task 8: Pill metadata for server-side logging
      pillMetadata,
      // AI Suggestion Pills: Welcome message for returning users starting new conversation
      welcomeMessageContent,
    } = body;

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required and cannot be empty' },
        { status: 400 }
      );
    }

    if (!chatbotId) {
      return NextResponse.json(
        { error: 'chatbotId is required' },
        { status: 400 }
      );
    }

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user') {
      return NextResponse.json(
        { error: 'Last message must be from user' },
        { status: 400 }
      );
    }

    // 3. Verify chatbot exists
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      include: {
        creator: {
          include: {
            users: {
              where: { role: 'OWNER' },
              take: 1,
            },
          },
        },
      },
    });

    if (!chatbot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404 }
      );
    }

    // 4. Fetch user context (global + chatbot-specific) - Phase 3.10, Step 6
    let userContext: Record<string, any> = {};
    try {
      const userContexts = await prisma.user_Context.findMany({
        where: {
          userId: dbUserId,
          OR: [
            { chatbotId: null }, // Global context
            { chatbotId },        // Chatbot-specific context
          ],
          isVisible: true,
        },
      });
      
      // Build user context object
      userContext = userContexts.reduce((acc, ctx) => {
        acc[ctx.key] = ctx.value;
        return acc;
      }, {} as Record<string, any>);
    } catch (error) {
      // Log error but continue without user context (non-critical)
      console.error('Error fetching user context:', error);
      userContext = {};
    }

    // 5. Check rate limit (dbUserId always present now)
    const allowed = await checkRateLimit(dbUserId);
    const remainingMessages = await getRemainingMessages(dbUserId);
    
    if (!allowed) {
      // Calculate reset time (1 minute from now)
      const resetTime = Math.floor((Date.now() + 60 * 1000) / 1000);
      
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a moment before sending another message.' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetTime.toString(),
          },
        }
      );
    }

    // 6. Get or create conversation
    let conversationId = providedConversationId;
    if (!conversationId) {
      // Get chatbot version ID (use current version or first version as fallback)
      let chatbotVersionId: string;
      if (chatbot.currentVersionId) {
        chatbotVersionId = chatbot.currentVersionId;
      } else {
        // Fallback: get first version or create version 1 if none exists
        const versions = await prisma.chatbot_Version.findMany({
          where: { chatbotId },
          orderBy: { versionNumber: 'asc' },
          take: 1,
        });
        
        if (versions.length > 0) {
          chatbotVersionId = versions[0].id;
        } else {
          // Create version 1 for existing chatbot (data migration scenario)
          // This should rarely happen, but handles edge case
          const creatorUserId = chatbot.creator.users[0]?.userId;
          if (!creatorUserId) {
            // Fallback: use system user or throw error
            throw new Error('Cannot create version: chatbot creator has no associated user');
          }
          
          const { createChatbotVersion } = await import('@/lib/chatbot/versioning');
          const version1 = await createChatbotVersion(chatbotId, creatorUserId, {
            systemPrompt: chatbot.systemPrompt || 'You are a helpful assistant.',
            configJson: chatbot.configJson,
            ragSettingsJson: chatbot.ragSettingsJson,
            notes: 'Auto-created version 1 for existing chatbot',
          });
          chatbotVersionId = version1.id;
        }
      }
      
      const conversation = await prisma.conversation.create({
        data: {
          chatbotId,
          chatbotVersionId,
          userId: dbUserId, // Always present
          status: 'active',
          messageCount: 0,
          // Mark intake as complete if welcome message is provided (returning user)
          intakeCompleted: welcomeMessageContent ? true : false,
        },
      });
      conversationId = conversation.id;

      // For returning users: save welcome message as first assistant message
      if (welcomeMessageContent) {
        try {
          await prisma.message.create({
            data: {
              conversationId,
              userId: dbUserId,
              role: 'assistant',
              content: welcomeMessageContent,
            },
          });
          // Increment message count for welcome message
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { messageCount: { increment: 1 } },
          });
        } catch (error) {
          console.error('Error saving welcome message:', error);
          // Continue even if welcome message fails - non-critical
        }
      }
    } else {
      // Verify conversation exists and belongs to user (if authenticated)
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        );
      }

      // Verify conversation belongs to chatbot
      if (conversation.chatbotId !== chatbotId) {
        return NextResponse.json(
          { error: 'Conversation does not belong to this chatbot' },
          { status: 403 }
        );
      }

      // Verify conversation belongs to user
      // Allow access if:
      // 1. Conversation has no userId (legacy anonymous) - upgrade ownership below
      // 2. Conversation userId matches current user
      if (conversation.userId && conversation.userId !== dbUserId) {
        return NextResponse.json(
          { error: 'Unauthorized access to conversation' },
          { status: 403 }
        );
      }

      // If conversation is anonymous and user is now authenticated, upgrade conversation ownership
      if (!conversation.userId && dbUserId) {
        try {
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { userId: dbUserId },
          });
        } catch (error) {
          // Log but don't fail - conversation can still be used
          console.warn('Failed to upgrade conversation ownership:', error);
        }
      }
    }

    // 7. Store user message (with error handling)
    let userMessage;
    try {
      userMessage = await prisma.message.create({
        data: {
          conversationId,
          userId: dbUserId, // Always present
          role: 'user',
          content: lastMessage.content,
        },
      });
    } catch (error) {
      console.error('Database error storing user message:', error);
      
      // Handle database connection errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Database connection issues
        if (error.code === 'P1001' || error.code === 'P1008') {
          return NextResponse.json(
            { error: 'Database connection error. Please try again.' },
            { status: 503 }
          );
        }
        
        // Unique constraint violations (shouldn't happen, but handle gracefully)
        if (error.code === 'P2002') {
          console.error('Unique constraint violation:', error);
          return NextResponse.json(
            { error: 'An error occurred. Please try again.' },
            { status: 500 }
          );
        }
      }
      
      // Re-throw to be caught by outer catch
      throw error;
    }

    // 8. Query RAG for relevant chunks (with error handling)
    const namespace = `chatbot-${chatbotId}`;
    let retrievedChunks: RetrievedChunk[] = [];
    try {
      retrievedChunks = await queryRAG({
        query: lastMessage.content,
        namespace,
        topK: 5,
      });
    } catch (error) {
      console.error('RAG query failed:', error);
      
      // Handle OpenAI API errors (including quota errors)
      if (error instanceof OpenAI.APIError) {
        // Quota exceeded (429) or payment required (402)
        if (error.status === 429 || error.status === 402) {
          return NextResponse.json(
            { error: 'OpenAI service quota exceeded. Please check your billing or try again later.' },
            { status: 503 }
          );
        }
        
        // Authentication/authorization errors
        if (error.status === 401 || error.status === 403) {
          console.error('OpenAI API key issue:', error.message);
          return NextResponse.json(
            { error: 'Service configuration error. Please contact support.' },
            { status: 500 }
          );
        }
        
        // Other OpenAI API errors
        return NextResponse.json(
          { error: 'Service temporarily unavailable. Please try again shortly.' },
          { status: 503 }
        );
      }
      
      // Handle Pinecone connection errors
      if (error instanceof Error) {
        if (error.message.includes('Pinecone') || error.message.includes('connection')) {
          return NextResponse.json(
            { error: 'Unable to retrieve content. Please try again in a moment.' },
            { status: 503 } // Service Unavailable
          );
        }
        
        // Handle embedding generation errors (OpenAI API issues) - check message for quota errors
        if (error.message.includes('OpenAI') || error.message.includes('embedding')) {
          // Check for quota-related messages
          if (error.message.includes('quota') || error.message.includes('429') || error.message.includes('exceeded')) {
            return NextResponse.json(
              { error: 'OpenAI service quota exceeded. Please check your billing or try again later.' },
              { status: 503 }
            );
          }
          
          return NextResponse.json(
            { error: 'Service temporarily unavailable. Please try again shortly.' },
            { status: 503 }
          );
        }
      }
      
      // For other RAG errors, continue without context (fallback to general knowledge)
      console.warn('RAG query failed, continuing without context:', error);
      retrievedChunks = [];
    }
    
    // Handle empty results gracefully
    if (!retrievedChunks || retrievedChunks.length === 0) {
      console.warn('No chunks retrieved from RAG query');
      // Continue with empty chunks - OpenAI will use general knowledge
    }

    // 9. Build context from retrieved chunks
    const context = retrievedChunks
      .map((chunk) => {
        const pageInfo = chunk.page ? `Page ${chunk.page}` : '';
        const sectionInfo = chunk.section ? `, ${chunk.section}` : '';
        const location = pageInfo + sectionInfo;
        return location
          ? `[${location}]\n${chunk.text}`
          : chunk.text;
      })
      .join('\n\n---\n\n');

    // 10. Extract unique sourceIds for easier querying
    const sourceIds = [...new Set(retrievedChunks.map((c) => c.sourceId))];

    // 11. Fetch source titles for attribution
    const sourceTitlesMap = new Map<string, string>();
    if (sourceIds.length > 0) {
      try {
        const sources = await prisma.source.findMany({
          where: {
            id: { in: sourceIds },
            chatbotId,
          },
          select: {
            id: true,
            title: true,
          },
        });
        sources.forEach((source) => {
          sourceTitlesMap.set(source.id, source.title);
        });
      } catch (error) {
        console.error('Error fetching source titles:', error);
        // Continue without source titles - attribution won't show but won't break
      }
    }

    // 12. Prepare chunks for storage in message context (include sourceTitle for attribution)
    const chunksForContext = retrievedChunks.map((chunk) => ({
      chunkId: chunk.chunkId,
      sourceId: chunk.sourceId,
      sourceTitle: sourceTitlesMap.get(chunk.sourceId) || null, // Include sourceTitle for attribution
      text: chunk.text,
      page: chunk.page,
      section: chunk.section,
      relevanceScore: chunk.relevanceScore,
    }));

    // 13. Generate streaming response with OpenAI (with error handling)
    // Build system prompt with user context (Phase 3.10, Step 6)
    const userContextString = Object.keys(userContext).length > 0
      ? `\n\nUser context: ${JSON.stringify(userContext)}`
      : '';
    
    const systemPrompt = retrievedChunks.length > 0
      ? `You are a helpful assistant that answers questions based on the provided context. Use the following context to answer the user's question:

${context}

If the context doesn't contain relevant information to answer the question, say so and provide a helpful response based on your general knowledge.${userContextString}`
      : `You are a helpful assistant. Answer the user's question to the best of your ability using your general knowledge.${userContextString}`;

    let stream;
    try {
      stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
        temperature: 0.7,
      });
    } catch (error) {
      console.error('OpenAI API error:', error);
      
      // Handle OpenAI API errors specifically
      if (error instanceof OpenAI.APIError) {
        // Rate limit errors
        if (error.status === 429) {
          return NextResponse.json(
            { error: 'OpenAI service is busy. Please try again in a moment.' },
            { status: 503 }
          );
        }
        
        // Authentication/authorization errors
        if (error.status === 401 || error.status === 403) {
          console.error('OpenAI API key issue:', error.message);
          return NextResponse.json(
            { error: 'Service configuration error. Please contact support.' },
            { status: 500 }
          );
        }
        
        // Quota exceeded
        if (error.status === 402) {
          return NextResponse.json(
            { error: 'Service temporarily unavailable. Please try again later.' },
            { status: 503 }
          );
        }
        
        // Other API errors
        return NextResponse.json(
          { error: 'Unable to generate response. Please try again.' },
          { status: 500 }
        );
      }
      
      // Network or other errors
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('network')) {
          return NextResponse.json(
            { error: 'Connection timeout. Please try again.' },
            { status: 504 } // Gateway Timeout
          );
        }
      }
      
      // Re-throw unknown errors to be caught by outer catch
      throw error;
    }

    // 13. Create a readable stream for the response
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        let fullResponse = '';

        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              fullResponse += content;
              controller.enqueue(encoder.encode(content));
            }
          }

          // 15. Generate follow-up pills first, then store message once with complete data
          let followUpPills: string[] = [];
          try {
            // Fetch user's intake responses for this chatbot
            let intakeResponses: Array<{ question: string; answer: string }> = [];
            try {
              const responses = await prisma.intake_Response.findMany({
                where: {
                  userId: dbUserId,
                  chatbotId: chatbot.id,
                },
                include: {
                  intakeQuestion: {
                    select: {
                      questionText: true,
                    },
                  },
                },
              });
              
              // Format intake responses as question/answer pairs
              intakeResponses = responses.map((response) => {
                // Extract answer from JSON value
                let answerText = '';
                if (response.value && typeof response.value === 'object') {
                  const value = response.value as any;
                  if (Array.isArray(value)) {
                    answerText = value.join(', ');
                  } else if (typeof value === 'string') {
                    answerText = value;
                  } else if (value.text) {
                    answerText = value.text;
                  } else {
                    answerText = JSON.stringify(value);
                  }
                } else if (typeof response.value === 'string') {
                  answerText = response.value;
                }
                
                return {
                  question: response.intakeQuestion.questionText,
                  answer: answerText,
                };
              });
            } catch (intakeError) {
              // Log but don't fail - intake responses are optional
              console.warn('Error fetching intake responses for pill generation:', intakeError);
            }
            
            const pillsResult = await generateFollowUpPills({
              assistantResponse: fullResponse,
              configJson: chatbot.configJson as Record<string, any> | null,
              chatbotId: chatbot.id,
              conversationId,
              intakeResponses: intakeResponses.length > 0 ? intakeResponses : undefined,
            });
            followUpPills = pillsResult.pills;
          } catch (pillError) {
            // Log pill generation errors but don't fail the request (graceful degradation)
            console.error('Error generating follow-up pills:', pillError);
            followUpPills = [];
          }

          // 15. Store assistant message ONCE with complete data (chunks in context + pills in separate field)
          try {
            const assistantMessage = await prisma.message.create({
              data: {
                conversationId,
                userId: dbUserId, // Always present
                role: 'assistant',
                content: fullResponse,
                context: { 
                  chunks: chunksForContext,
                  // Note: followUpPills NOT stored in context - stored in separate field below
                },
                followUpPills: followUpPills, // Separate field for pills (not in RAG context)
                sourceIds,
              },
            });

            // Send pills to frontend via structured prefix (no regex needed)
            // Send AFTER message creation so we have the messageId
            // Format: __PILLS__{json} - easy to parse with indexOf and substring
            if (followUpPills.length > 0) {
              const pillsDataJson = JSON.stringify({
                messageId: assistantMessage.id,
                pills: followUpPills,
              });
              controller.enqueue(encoder.encode(`\n\n__PILLS__${pillsDataJson}`));
            }

            // 16. Update conversation messageCount
            await prisma.conversation.update({
              where: { id: conversationId },
              data: {
                messageCount: { increment: 2 }, // User + assistant
                updatedAt: new Date(),
              },
            });

            // 17. Update chunk performance counters (only if chunks were retrieved)
            if (retrievedChunks.length > 0) {
              const month = new Date().getMonth() + 1;
              const year = new Date().getFullYear();

              // Use Promise.allSettled to handle individual chunk update failures gracefully
              await Promise.allSettled(
                retrievedChunks.map((chunk) =>
                  prisma.chunk_Performance.upsert({
                    where: {
                      chunkId_chatbotId_month_year: {
                        chunkId: chunk.chunkId,
                        chatbotId,
                        month,
                        year,
                      },
                    },
                    create: {
                      chunkId: chunk.chunkId,
                      sourceId: chunk.sourceId,
                      chatbotId,
                      timesUsed: 1,
                      month,
                      year,
                    },
                    update: {
                      timesUsed: { increment: 1 },
                    },
                  })
                )
              );
            }

            // Phase 4, Task 8: Log pill usage server-side (after RAG query completes, chunkIds available)
            if (pillMetadata && (pillMetadata.feedbackPillId || pillMetadata.expansionPillId || pillMetadata.suggestedPillId)) {
              try {
                // Extract chunkIds from retrieved chunks
                const chunkIds = retrievedChunks.map((chunk) => chunk.chunkId);

                // Log feedback pill usage (if used)
                if (pillMetadata.feedbackPillId && pillMetadata.prefillText && pillMetadata.sentText) {
                  await logPillUsage({
                    pillId: pillMetadata.feedbackPillId,
                    sessionId: conversationId,
                    chatbotId,
                    sourceChunkIds: chunkIds,
                    prefillText: pillMetadata.prefillText,
                    sentText: pillMetadata.sentText,
                    wasModified: pillMetadata.wasModified || false,
                    pairedWithPillId: pillMetadata.expansionPillId || null,
                    userId: dbUserId,
                  });
                }

                // Log expansion pill usage (if used and not paired with feedback pill)
                if (pillMetadata.expansionPillId && !pillMetadata.feedbackPillId && pillMetadata.prefillText && pillMetadata.sentText) {
                  await logPillUsage({
                    pillId: pillMetadata.expansionPillId,
                    sessionId: conversationId,
                    chatbotId,
                    sourceChunkIds: chunkIds,
                    prefillText: pillMetadata.prefillText,
                    sentText: pillMetadata.sentText,
                    wasModified: pillMetadata.wasModified || false,
                    pairedWithPillId: null,
                    userId: dbUserId,
                  });
                }

                // Log suggested question pill usage (if used and not paired with feedback/expansion)
                if (pillMetadata.suggestedPillId && !pillMetadata.feedbackPillId && !pillMetadata.expansionPillId && pillMetadata.prefillText && pillMetadata.sentText) {
                  await logPillUsage({
                    pillId: pillMetadata.suggestedPillId,
                    sessionId: conversationId,
                    chatbotId,
                    sourceChunkIds: chunkIds,
                    prefillText: pillMetadata.prefillText,
                    sentText: pillMetadata.sentText,
                    wasModified: pillMetadata.wasModified || false,
                    pairedWithPillId: null,
                    userId: dbUserId,
                  });
                }
                
                // Log suggested pill when paired with feedback pill (suggested pill is secondary)
                // Note: When suggested pill is paired with feedback, we log the feedback pill as primary
                // and the suggested pill is tracked via the sentText content
              } catch (pillError) {
                // Log pill usage errors but don't fail the response (user already got their answer)
                console.error('Error logging pill usage:', pillError);
              }
            }
          } catch (dbError) {
            // Log database errors but don't fail the response (user already got their answer)
            console.error('Database error storing assistant message or updating counters:', dbError);
            // Continue to close the stream successfully
          }

          controller.close();
        } catch (error) {
          console.error('Error during streaming:', error);
          
          // Handle streaming errors gracefully
          if (error instanceof OpenAI.APIError) {
            // Send error message to client before closing
            const errorMessage = 'An error occurred while generating the response.';
            controller.enqueue(encoder.encode(`\n\n[Error: ${errorMessage}]`));
          } else if (error instanceof Error) {
            const errorMessage = process.env.NODE_ENV === 'development'
              ? `Streaming error: ${error.message}`
              : 'An error occurred while generating the response.';
            controller.enqueue(encoder.encode(`\n\n[Error: ${errorMessage}]`));
          }
          
          controller.close();
        }
      },
    });

    // 18. Calculate reset time for rate limit headers (1 minute from now)
    const resetTime = Math.floor((Date.now() + 60 * 1000) / 1000);
    
    // 19. Return streaming response with rate limit headers and conversation ID
    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-RateLimit-Limit': RATE_LIMIT.toString(),
        'X-RateLimit-Remaining': Math.max(0, remainingMessages - 1).toString(), // Subtract 1 for current message
        'X-RateLimit-Reset': resetTime.toString(),
        'X-Conversation-Id': conversationId, // Include conversation ID for client to track
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);

    // Handle Prisma database errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Database connection errors
      if (error.code === 'P1001' || error.code === 'P1008') {
        return NextResponse.json(
          { error: 'Database connection error. Please try again.' },
          { status: 503 }
        );
      }
      
      // Record not found errors
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Resource not found. Please refresh and try again.' },
          { status: 404 }
        );
      }
      
      // Unique constraint violations
      if (error.code === 'P2002') {
        console.error('Unique constraint violation:', error);
        return NextResponse.json(
          { error: 'An error occurred. Please try again.' },
          { status: 500 }
        );
      }
      
      // Generic Prisma error
      return NextResponse.json(
        { error: 'Database error. Please try again.' },
        { status: 500 }
      );
    }
    
    // Handle Prisma client initialization errors
    if (error instanceof Prisma.PrismaClientInitializationError) {
      console.error('Prisma initialization error:', error);
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.' },
        { status: 503 }
      );
    }

    // Handle OpenAI API errors (if not caught earlier)
    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Service is busy. Please try again in a moment.' },
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        { error: 'Unable to generate response. Please try again.' },
        { status: 500 }
      );
    }

    // Handle network/timeout errors
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { error: 'Connection timeout. Please check your internet connection and try again.' },
          { status: 504 }
        );
      }
      
      // Return user-friendly error message
      const errorMessage =
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'An error occurred while processing your message. Please try again.';

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

    // Fallback for unknown errors
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
