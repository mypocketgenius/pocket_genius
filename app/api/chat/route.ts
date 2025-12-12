// app/api/chat/route.ts
// Phase 3, Task 1: Chat API route with RAG-powered responses
// Generates query embedding, queries Pinecone, stores messages, and streams responses

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { queryRAG } from '@/lib/rag/query';
import { checkRateLimit, getRemainingMessages, RATE_LIMIT } from '@/lib/rate-limit';

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
 * 
 * Response: Streaming text response
 */
export async function POST(req: Request) {
  try {
    // 1. Authenticate user (optional for MVP - allow anonymous users)
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

    // 2. Parse request body
    const body = await req.json();
    const { messages, conversationId: providedConversationId, chatbotId } = body;

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
    });

    if (!chatbot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404 }
      );
    }

    // 4. Check rate limit (only for authenticated users)
    let remainingMessages = RATE_LIMIT; // Default for anonymous users
    if (dbUserId) {
      const allowed = await checkRateLimit(dbUserId);
      remainingMessages = await getRemainingMessages(dbUserId);
      
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
    } else {
      // For anonymous users, get remaining (always RATE_LIMIT for now)
      remainingMessages = await getRemainingMessages(null);
    }

    // 5. Get or create conversation
    let conversationId = providedConversationId;
    if (!conversationId) {
      const conversation = await prisma.conversation.create({
        data: {
          chatbotId,
          userId: dbUserId || undefined,
          status: 'active',
          messageCount: 0,
        },
      });
      conversationId = conversation.id;
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

      // Verify conversation belongs to user (if authenticated)
      if (dbUserId && conversation.userId !== dbUserId) {
        return NextResponse.json(
          { error: 'Unauthorized access to conversation' },
          { status: 403 }
        );
      }
    }

    // 6. Store user message
    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        userId: dbUserId || undefined,
        role: 'user',
        content: lastMessage.content,
      },
    });

    // 7. Query RAG for relevant chunks
    const namespace = `chatbot-${chatbotId}`;
    const retrievedChunks = await queryRAG({
      query: lastMessage.content,
      namespace,
      topK: 5,
    });

    // 8. Build context from retrieved chunks
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

    // 9. Extract unique sourceIds for easier querying
    const sourceIds = [...new Set(retrievedChunks.map((c) => c.sourceId))];

    // 10. Prepare chunks for storage in message context
    const chunksForContext = retrievedChunks.map((chunk) => ({
      chunkId: chunk.chunkId,
      sourceId: chunk.sourceId,
      text: chunk.text,
      page: chunk.page,
      section: chunk.section,
      relevanceScore: chunk.relevanceScore,
    }));

    // 11. Generate streaming response with OpenAI
    const systemPrompt = `You are a helpful assistant that answers questions based on the provided context. Use the following context to answer the user's question:

${context}

If the context doesn't contain relevant information to answer the question, say so and provide a helpful response based on your general knowledge.`;

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      stream: true,
      temperature: 0.7,
    });

    // 12. Create a readable stream for the response
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

          // 13. Store assistant message with context after streaming completes
          await prisma.message.create({
            data: {
              conversationId,
              userId: dbUserId || undefined,
              role: 'assistant',
              content: fullResponse,
              context: { chunks: chunksForContext },
              sourceIds,
            },
          });

          // 14. Update conversation messageCount
          await prisma.conversation.update({
            where: { id: conversationId },
            data: {
              messageCount: { increment: 2 }, // User + assistant
              updatedAt: new Date(),
            },
          });

          // 15. Update chunk performance counters
          const month = new Date().getMonth() + 1;
          const year = new Date().getFullYear();

          // Use Promise.all for parallel updates
          await Promise.all(
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

          controller.close();
        } catch (error) {
          console.error('Error during streaming:', error);
          controller.error(error);
        }
      },
    });

    // 16. Calculate reset time for rate limit headers (1 minute from now)
    const resetTime = Math.floor((Date.now() + 60 * 1000) / 1000);
    
    // 17. Return streaming response with rate limit headers and conversation ID
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

    // Return appropriate error response
    if (error instanceof Error) {
      const errorMessage =
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'An error occurred while processing your message';

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
