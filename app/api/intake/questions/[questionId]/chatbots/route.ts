// app/api/intake/questions/[questionId]/chatbots/route.ts
// Phase 3.10: Intake Questions Many-to-Many - Association Management
// POST: Associate question with chatbot(s)
// DELETE: Remove association between question and chatbot
// PATCH: Update association (displayOrder, isRequired)

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/intake/questions/[questionId]/chatbots
 * 
 * Associates an existing question with chatbot(s).
 * User must be a member of the Creator that owns all chatbots being associated.
 * 
 * Request Body:
 * {
 *   chatbotAssociations: Array<{
 *     chatbotId: string;
 *     displayOrder: number;
 *     isRequired?: boolean;
 *   }>;
 * }
 * 
 * Response Format:
 * {
 *   associations: Array<{
 *     id: string;
 *     chatbotId: string;
 *     intakeQuestionId: string;
 *     displayOrder: number;
 *     isRequired: boolean;
 *     createdAt: string;
 *   }>;
 * }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const { questionId } = await params;

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

    // 3. Verify question exists
    const question = await prisma.intake_Question.findUnique({
      where: { id: questionId },
      select: { id: true },
    });

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // 4. Parse request body
    const body = await request.json();
    const { chatbotAssociations } = body;

    if (!Array.isArray(chatbotAssociations) || chatbotAssociations.length === 0) {
      return NextResponse.json(
        { error: 'chatbotAssociations array is required and must not be empty' },
        { status: 400 }
      );
    }

    // 5. Verify all chatbots exist and user has permission (must be member of Creator)
    const chatbotIds = chatbotAssociations.map((a: { chatbotId: string }) => a.chatbotId);
    const chatbots = await prisma.chatbot.findMany({
      where: { id: { in: chatbotIds } },
      include: {
        creator: {
          include: {
            users: {
              where: { userId: user.id },
              select: { id: true },
            },
          },
        },
      },
    });

    // Check if all chatbots were found
    if (chatbots.length !== chatbotIds.length) {
      const foundIds = new Set(chatbots.map((c) => c.id));
      const missingIds = chatbotIds.filter((id: string) => !foundIds.has(id));
      return NextResponse.json(
        { error: `Chatbots not found: ${missingIds.join(', ')}` },
        { status: 404 }
      );
    }

    // Check if user is a member of the Creator for all chatbots
    for (const chatbot of chatbots) {
      if (!chatbot.creator.users || chatbot.creator.users.length === 0) {
        return NextResponse.json(
          { error: `Unauthorized: You are not a member of the Creator that owns chatbot ${chatbot.id}` },
          { status: 403 }
        );
      }
    }

    // 6. Create associations
    const associations = await Promise.all(
      chatbotAssociations.map(async (association: { chatbotId: string; displayOrder: number; isRequired?: boolean }) => {
        return prisma.chatbot_Intake_Question.create({
          data: {
            chatbotId: association.chatbotId,
            intakeQuestionId: questionId,
            displayOrder: association.displayOrder,
            isRequired: association.isRequired ?? false,
          },
        });
      })
    );

    return NextResponse.json({ associations });
  } catch (error) {
    console.error('Error creating chatbot-question associations:', error);

    // Handle unique constraint violation (association already exists)
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Association already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create associations' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/intake/questions/[questionId]/chatbots
 * 
 * Removes association between question and chatbot.
 * User must be a member of the Creator that owns the chatbot.
 * 
 * Request Body:
 * {
 *   chatbotId: string;
 * }
 * 
 * Response Format:
 * {
 *   message: string;
 * }
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const { questionId } = await params;

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

    // 3. Verify question exists
    const question = await prisma.intake_Question.findUnique({
      where: { id: questionId },
      select: { id: true },
    });

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // 4. Parse request body
    const body = await request.json();
    const { chatbotId } = body;

    if (!chatbotId) {
      return NextResponse.json(
        { error: 'chatbotId is required' },
        { status: 400 }
      );
    }

    // 5. Verify chatbot exists and user has permission
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      include: {
        creator: {
          include: {
            users: {
              where: { userId: user.id },
              select: { id: true },
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

    if (!chatbot.creator.users || chatbot.creator.users.length === 0) {
      return NextResponse.json(
        { error: 'Unauthorized: You are not a member of the Creator that owns this chatbot' },
        { status: 403 }
      );
    }

    // 6. Verify association exists
    const association = await prisma.chatbot_Intake_Question.findUnique({
      where: {
        intakeQuestionId_chatbotId: {
          intakeQuestionId: questionId,
          chatbotId: chatbotId,
        },
      },
    });

    if (!association) {
      return NextResponse.json(
        { error: 'Association not found' },
        { status: 404 }
      );
    }

    // 7. Delete association
    await prisma.chatbot_Intake_Question.delete({
      where: { id: association.id },
    });

    return NextResponse.json({ message: 'Association removed successfully' });
  } catch (error) {
    console.error('Error removing chatbot-question association:', error);
    return NextResponse.json(
      { error: 'Failed to remove association' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/intake/questions/[questionId]/chatbots
 * 
 * Updates displayOrder or isRequired for an existing association.
 * User must be a member of the Creator that owns the chatbot.
 * 
 * Request Body:
 * {
 *   chatbotId: string;
 *   displayOrder?: number;
 *   isRequired?: boolean;
 * }
 * 
 * Response Format:
 * {
 *   association: {
 *     id: string;
 *     chatbotId: string;
 *     intakeQuestionId: string;
 *     displayOrder: number;
 *     isRequired: boolean;
 *     updatedAt: string;
 *   };
 * }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const { questionId } = await params;

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

    // 3. Verify question exists
    const question = await prisma.intake_Question.findUnique({
      where: { id: questionId },
      select: { id: true },
    });

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // 4. Parse request body
    const body = await request.json();
    const { chatbotId, displayOrder, isRequired } = body;

    if (!chatbotId) {
      return NextResponse.json(
        { error: 'chatbotId is required' },
        { status: 400 }
      );
    }

    if (displayOrder === undefined && isRequired === undefined) {
      return NextResponse.json(
        { error: 'At least one of displayOrder or isRequired must be provided' },
        { status: 400 }
      );
    }

    // 5. Verify chatbot exists and user has permission
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      include: {
        creator: {
          include: {
            users: {
              where: { userId: user.id },
              select: { id: true },
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

    if (!chatbot.creator.users || chatbot.creator.users.length === 0) {
      return NextResponse.json(
        { error: 'Unauthorized: You are not a member of the Creator that owns this chatbot' },
        { status: 403 }
      );
    }

    // 6. Verify association exists
    const association = await prisma.chatbot_Intake_Question.findUnique({
      where: {
        intakeQuestionId_chatbotId: {
          intakeQuestionId: questionId,
          chatbotId: chatbotId,
        },
      },
    });

    if (!association) {
      return NextResponse.json(
        { error: 'Association not found' },
        { status: 404 }
      );
    }

    // 7. Update association
    const updateData: { displayOrder?: number; isRequired?: boolean } = {};
    if (displayOrder !== undefined) {
      updateData.displayOrder = displayOrder;
    }
    if (isRequired !== undefined) {
      updateData.isRequired = isRequired;
    }

    const updatedAssociation = await prisma.chatbot_Intake_Question.update({
      where: { id: association.id },
      data: updateData,
    });

    return NextResponse.json({ association: updatedAssociation });
  } catch (error) {
    console.error('Error updating chatbot-question association:', error);
    return NextResponse.json(
      { error: 'Failed to update association' },
      { status: 500 }
    );
  }
}

