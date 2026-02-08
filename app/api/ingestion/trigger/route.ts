// app/api/ingestion/trigger/route.ts
// Phase 2, Tasks 4-9: Complete ingestion pipeline
// Extracts text, chunks it, generates embeddings, and upserts to Pinecone
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { extractTextFromUrl } from '@/lib/extraction/text';
import { smartChunk } from '@/lib/chunking/markdown';
import { generateEmbeddings } from '@/lib/embeddings';
import { upsertWithRetry, type PineconeVector } from '@/lib/pinecone';
import { NextResponse } from 'next/server';

// Batch size for processing embeddings (OpenAI API can handle large batches)
const EMBEDDING_BATCH_SIZE = 100;

export async function POST(req: Request) {
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const { fileId } = await req.json();

    if (!fileId) {
      return NextResponse.json(
        { error: 'fileId is required' },
        { status: 400 }
      );
    }

    // 3. Get file record with related source (no chatbot needed - use creatorId for namespace)
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        source: true,
      },
    });

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // 4. Validate required relationships exist
    if (!file.source) {
      return NextResponse.json(
        { error: 'Source not found for file' },
        { status: 404 }
      );
    }

    // 5. Allow processing if file is PENDING, ERROR, or READY (for re-processing)
    // Only block if already PROCESSING (to prevent concurrent processing)
    if (file.status === 'PROCESSING') {
      return NextResponse.json(
        { 
          error: `File is already being processed. Please wait for current processing to complete.`,
          currentStatus: file.status,
        },
        { status: 400 }
      );
    }

    // 6. Update status to PROCESSING (Task 8: Status update)
    await prisma.file.update({
      where: { id: fileId },
      data: { status: 'PROCESSING' },
    });

    try {
      // 7. Fetch file from Vercel Blob and extract text
      let text: string;
      try {
        text = await extractTextFromUrl(file.fileUrl);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to fetch or extract text from file: ${errorMessage}`);
      }

      // 8. Validate extracted text
      if (!text || text.trim().length === 0) {
        throw new Error('Extracted text is empty. File may be corrupted or empty.');
      }

      // 9. Chunk the text (Task 5)
      let textChunks;
      try {
        textChunks = smartChunk(text);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to chunk text: ${errorMessage}`);
      }

      if (!textChunks || textChunks.length === 0) {
        throw new Error('No chunks generated from text. Text may be too short or improperly formatted.');
      }

      // 10. Generate embeddings in batches (Task 6)
      let embeddings: number[][];
      try {
        const chunkTexts = textChunks.map((chunk) => chunk.text);
        
        // Process embeddings in batches to avoid API limits
        const allEmbeddings: number[][] = [];
        for (let i = 0; i < chunkTexts.length; i += EMBEDDING_BATCH_SIZE) {
          const batch = chunkTexts.slice(i, i + EMBEDDING_BATCH_SIZE);
          const batchEmbeddings = await generateEmbeddings(batch);
          allEmbeddings.push(...batchEmbeddings);
        }
        
        embeddings = allEmbeddings;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to generate embeddings: ${errorMessage}`);
      }

      if (embeddings.length !== textChunks.length) {
        throw new Error(
          `Embedding count mismatch: expected ${textChunks.length}, got ${embeddings.length}`
        );
      }

      // 11. Prepare vectors for Pinecone upsert
      const vectors: PineconeVector[] = textChunks.map((chunk, index) => ({
        id: `${file.sourceId}-chunk-${index}`,
        values: embeddings[index],
        metadata: {
          text: chunk.text,
          sourceId: file.sourceId,
          sourceTitle: file.source.title,
          ...(chunk.page !== undefined && { page: chunk.page }),
          ...(chunk.section !== undefined && { section: chunk.section }),
        },
      }));

      // 12. Upsert to Pinecone with retry logic (Task 7)
      // Uses creator-based namespace for source sharing across chatbots
      try {
        await upsertWithRetry(vectors, file.source.creatorId, 3);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to upsert vectors to Pinecone: ${errorMessage}`);
      }

      // 13. Update status to READY (Task 8: Status update)
      await prisma.file.update({
        where: { id: fileId },
        data: {
          status: 'READY',
        },
      });

      return NextResponse.json({
        success: true,
        fileId: file.id,
        status: 'READY',
        textLength: text.length,
        chunksCreated: textChunks.length,
        vectorsUpserted: vectors.length,
        message: 'File processed successfully. Content is now searchable.',
      });
    } catch (error) {
      // 14. Task 9: Error handling - Update status to ERROR on failure
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update status to ERROR
      try {
        await prisma.file.update({
          where: { id: fileId },
          data: { status: 'ERROR' },
        });
      } catch (updateError) {
        // Log but don't throw - we want to return the original error
        console.error('Failed to update file status to ERROR:', updateError);
      }

      console.error('Ingestion pipeline error:', error);

      return NextResponse.json(
        { 
          error: 'Failed to process file',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    // 15. Task 9: Error handling - Catch-all for unexpected errors
    console.error('Ingestion trigger error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { 
        error: 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
