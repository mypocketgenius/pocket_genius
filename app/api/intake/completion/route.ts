// app/api/intake/completion/route.ts
// Phase 3.10: User Intake Forms - Check Completion Status
// GET: Check if user has completed intake form for a chatbot

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/intake/completion?chatbotId=xxx
 * 
 * Checks if the current authenticated user has completed the intake form for a chatbot.
 * Returns true if:
 * - User has answered all required questions for the chatbot
 * - OR there are no intake questions for the chatbot
 * 
 * Query Parameters:
 * - chatbotId (required): The ID of the chatbot
 * 
 * Response Format:
 * {
 *   completed: boolean;
 *   hasQuestions: boolean;
 *   answeredCount?: number;
 *   totalRequiredCount?: number;
 * }
 */
export async function GET(request: Request) {
  try {
    // 1. Authenticate user (optional - allows anonymous users)
    const { userId: clerkUserId } = await auth();
    
    // If user is not authenticated, they haven't completed intake
    if (!clerkUserId) {
      return NextResponse.json({
        completed: false,
        hasQuestions: false,
        reason: 'not_authenticated',
      });
    }

    // 2. Get database user
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({
        completed: false,
        hasQuestions: false,
        reason: 'user_not_found',
      });
    }

    // 3. Get chatbotId from query params
    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get('chatbotId');

    if (!chatbotId) {
      return NextResponse.json(
        { error: 'chatbotId query parameter is required' },
        { status: 400 }
      );
    }

    // 4. Get all intake questions for the chatbot
    const questions = await prisma.intake_Question.findMany({
      where: { chatbotId },
      select: {
        id: true,
        isRequired: true,
      },
    });

    // If no questions exist, intake is considered "completed"
    if (questions.length === 0) {
      return NextResponse.json({
        completed: true,
        hasQuestions: false,
      });
    }

    // 5. Get all intake responses for this user and chatbot
    const responses = await prisma.intake_Response.findMany({
      where: {
        userId: user.id,
        chatbotId,
      },
      select: {
        intakeQuestionId: true,
      },
    });

    const answeredQuestionIds = new Set(responses.map(r => r.intakeQuestionId));
    
    // 6. Check if all required questions are answered
    const requiredQuestions = questions.filter(q => q.isRequired);
    const answeredRequiredQuestions = requiredQuestions.filter(q => 
      answeredQuestionIds.has(q.id)
    );

    const completed = requiredQuestions.length === 0 || 
                      answeredRequiredQuestions.length === requiredQuestions.length;

    return NextResponse.json({
      completed,
      hasQuestions: true,
      answeredCount: answeredQuestionIds.size,
      totalCount: questions.length,
      requiredCount: requiredQuestions.length,
      answeredRequiredCount: answeredRequiredQuestions.length,
    });
  } catch (error) {
    console.error('Error checking intake completion:', error);
    return NextResponse.json(
      { error: 'Failed to check intake completion' },
      { status: 500 }
    );
  }
}

