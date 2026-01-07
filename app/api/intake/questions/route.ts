// app/api/intake/questions/route.ts
// Phase 3.10: User Intake Forms - API Routes
// GET: Fetch intake questions for a chatbot
// POST: Create a new intake question (admin/creator only)

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/intake/questions?chatbotId=xxx
 * 
 * Returns all intake questions for a specific chatbot, ordered by displayOrder.
 * No authentication required - questions are public metadata.
 * 
 * Query Parameters:
 * - chatbotId (required): The ID of the chatbot
 * 
 * Response Format:
 * {
 *   questions: Array<{
 *     id: string;
 *     chatbotId: string;
 *     slug: string;
 *     questionText: string;
 *     helperText: string | null;
 *     responseType: IntakeResponseType;
 *     displayOrder: number;
 *     isRequired: boolean;
 *     createdAt: string;
 *     updatedAt: string;
 *   }>;
 * }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get('chatbotId');

    if (!chatbotId) {
      return NextResponse.json(
        { error: 'chatbotId query parameter is required' },
        { status: 400 }
      );
    }

    // Verify chatbot exists
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: { id: true },
    });

    if (!chatbot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404 }
      );
    }

    const questions = await prisma.intake_Question.findMany({
      where: { chatbotId },
      orderBy: { displayOrder: 'asc' },
    });

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Error fetching intake questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch intake questions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/intake/questions
 * 
 * Creates a new intake question for a chatbot.
 * Requires authentication and chatbot ownership (creator role).
 * 
 * Request Body:
 * {
 *   chatbotId: string;
 *   slug: string;
 *   questionText: string;
 *   helperText?: string;
 *   responseType: IntakeResponseType;
 *   displayOrder: number;
 *   isRequired?: boolean;
 * }
 * 
 * Response Format:
 * {
 *   question: {
 *     id: string;
 *     chatbotId: string;
 *     slug: string;
 *     questionText: string;
 *     helperText: string | null;
 *     responseType: IntakeResponseType;
 *     displayOrder: number;
 *     isRequired: boolean;
 *     createdAt: string;
 *     updatedAt: string;
 *   };
 * }
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Get database user
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

    // 3. Parse request body
    const body = await request.json();
    const {
      chatbotId,
      slug,
      questionText,
      helperText,
      responseType,
      displayOrder,
      isRequired = false,
    } = body;

    // 4. Validate required fields
    if (!chatbotId || !slug || !questionText || !responseType || displayOrder === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: chatbotId, slug, questionText, responseType, displayOrder' },
        { status: 400 }
      );
    }

    // 5. Verify chatbot exists and user has permission (must be creator)
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      include: {
        creator: {
          include: {
            users: {
              where: { userId: user.id, role: 'OWNER' },
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

    // Check ownership: user must be creator
    const isCreator = chatbot.creator.users.some(
      (cu) => cu.userId === user.id && cu.role === 'OWNER'
    );

    if (!isCreator) {
      return NextResponse.json(
        { error: 'Unauthorized: You must be the chatbot creator' },
        { status: 403 }
      );
    }

    // 6. Validate responseType enum
    const validResponseTypes = ['TEXT', 'NUMBER', 'SELECT', 'MULTI_SELECT', 'FILE', 'DATE', 'BOOLEAN'];
    if (!validResponseTypes.includes(responseType)) {
      return NextResponse.json(
        { error: `Invalid responseType. Must be one of: ${validResponseTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // 7. Create intake question
    const question = await prisma.intake_Question.create({
      data: {
        chatbotId,
        slug,
        questionText,
        helperText: helperText || null,
        responseType,
        displayOrder,
        isRequired,
      },
    });

    return NextResponse.json({ question });
  } catch (error) {
    console.error('Error creating intake question:', error);

    // Handle unique constraint violation (duplicate slug for chatbot)
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A question with this slug already exists for this chatbot' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create intake question' },
      { status: 500 }
    );
  }
}


