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
 * Questions are fetched through the Chatbot_Intake_Question junction table.
 * No authentication required - questions are public metadata.
 * 
 * Query Parameters:
 * - chatbotId (required): The ID of the chatbot
 * 
 * Response Format:
 * {
 *   questions: Array<{
 *     id: string;
 *     chatbotId: string;  // Included for context (matches query parameter)
 *     slug: string;
 *     questionText: string;
 *     helperText: string | null;
 *     responseType: IntakeResponseType;
 *     displayOrder: number;  // From junction table
 *     isRequired: boolean;    // From junction table
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

    // Fetch questions through junction table
    const associations = await prisma.chatbot_Intake_Question.findMany({
      where: { chatbotId },
      include: {
        intakeQuestion: true,
      },
      orderBy: { displayOrder: 'asc' },
    });

    // Transform to match expected response format
    const questions = associations.map((association) => ({
      id: association.intakeQuestion.id,
      chatbotId: association.chatbotId, // Included for context
      slug: association.intakeQuestion.slug,
      questionText: association.intakeQuestion.questionText,
      helperText: association.intakeQuestion.helperText,
      responseType: association.intakeQuestion.responseType,
      options: association.intakeQuestion.options, // Options for SELECT and MULTI_SELECT
      displayOrder: association.displayOrder, // From junction table
      isRequired: association.isRequired,     // From junction table
      createdAt: association.intakeQuestion.createdAt,
      updatedAt: association.intakeQuestion.updatedAt,
    }));

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
 * Creates a new intake question independently (without chatbot associations).
 * Questions are created without chatbot associations. Use the association endpoint
 * to link questions to chatbots.
 * Requires authentication.
 * 
 * Request Body:
 * {
 *   slug: string;
 *   questionText: string;
 *   helperText?: string;
 *   responseType: IntakeResponseType;
 * }
 * 
 * Response Format:
 * {
 *   question: {
 *     id: string;
 *     slug: string;
 *     questionText: string;
 *     helperText: string | null;
 *     responseType: IntakeResponseType;
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
      slug,
      questionText,
      helperText,
      responseType,
      options,
    } = body;

    // 4. Validate required fields
    if (!slug || !questionText || !responseType) {
      return NextResponse.json(
        { error: 'Missing required fields: slug, questionText, responseType' },
        { status: 400 }
      );
    }

    // 5. Validate responseType enum
    const validResponseTypes = ['TEXT', 'NUMBER', 'SELECT', 'MULTI_SELECT', 'FILE', 'DATE', 'BOOLEAN'];
    if (!validResponseTypes.includes(responseType)) {
      return NextResponse.json(
        { error: `Invalid responseType. Must be one of: ${validResponseTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // 6. Validate options for SELECT and MULTI_SELECT types
    if ((responseType === 'SELECT' || responseType === 'MULTI_SELECT') && (!options || !Array.isArray(options) || options.length === 0)) {
      return NextResponse.json(
        { error: 'options array is required for SELECT and MULTI_SELECT response types' },
        { status: 400 }
      );
    }

    // 7. Create intake question independently (no chatbot associations)
    const question = await prisma.intake_Question.create({
      data: {
        slug,
        questionText,
        helperText: helperText || null,
        responseType,
        options: options ? options : null,
        createdByUserId: user.id,
      },
    });

    return NextResponse.json({ question });
  } catch (error) {
    console.error('Error creating intake question:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    // Handle unique constraint violation (duplicate slug - globally unique)
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Question with this slug already exists' },
        { status: 409 }
      );
    }

    // Return more detailed error in development
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return NextResponse.json(
      { 
        error: 'Failed to create intake question',
        ...(isDevelopment && { details: errorMessage })
      },
      { status: 500 }
    );
  }
}




