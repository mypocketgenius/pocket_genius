// app/api/files/upload/route.ts
// Phase 2, Task 1: File upload API route for plain text UTF-8 files
import { auth } from '@clerk/nextjs/server';
import { put } from '@vercel/blob';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { NextResponse } from 'next/server';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ['text/plain'];

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

    // 2. Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const sourceId = formData.get('sourceId') as string | null;

    // 3. Validate file exists
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // 4. Validate sourceId exists
    if (!sourceId) {
      return NextResponse.json(
        { error: 'sourceId is required' },
        { status: 400 }
      );
    }

    // 5. Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // 6. Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only plain text UTF-8 files supported' },
        { status: 400 }
      );
    }

    // 7. Verify source exists and get creatorId
    const source = await prisma.source.findUnique({
      where: { id: sourceId },
      select: { creatorId: true },
    });

    if (!source) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      );
    }

    // 8. Upload to Vercel Blob with retry logic
    let blob;
    let retries = 3;
    const blobPath = `sources/${sourceId}/${file.name}`;

    while (retries > 0) {
      try {
        blob = await put(blobPath, file, {
          access: 'public',
        });
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          console.error('Vercel Blob upload failed after retries:', error);
          throw error;
        }
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, 3 - retries) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    if (!blob) {
      throw new Error('Failed to upload file to Vercel Blob');
    }

    // 9. Create File record in database
    const fileRecord = await prisma.file.create({
      data: {
        sourceId,
        creatorId: source.creatorId,
        fileName: file.name,
        fileUrl: blob.url,
        fileSize: file.size,
        status: 'PENDING', // Will be updated to PROCESSING → READY by ingestion trigger
      },
    });

    // 10. Trigger ingestion (non-blocking - don't wait for it to complete)
    // This allows the upload to return quickly while processing happens in background
    try {
      // Get auth token from request headers to pass to ingestion endpoint
      const authHeader = req.headers.get('authorization');
      const cookieHeader = req.headers.get('cookie');
      
      // Build headers for ingestion request
      const ingestionHeaders: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      // Pass through auth headers if present
      if (authHeader) {
        ingestionHeaders['authorization'] = authHeader;
      }
      if (cookieHeader) {
        ingestionHeaders['cookie'] = cookieHeader;
      }
      
      // Use fetch to trigger ingestion API
      // Don't await - let it run in background
      fetch(`${env.NEXT_PUBLIC_URL}/api/ingestion/trigger`, {
        method: 'POST',
        headers: ingestionHeaders,
        body: JSON.stringify({ fileId: fileRecord.id }),
      }).catch((error) => {
        // Log error but don't fail the upload
        console.error('Failed to trigger ingestion:', error);
      });
    } catch (error) {
      // Log error but don't fail the upload
      console.error('Error triggering ingestion:', error);
    }

    // 11. Return success response
    return NextResponse.json({
      fileId: fileRecord.id,
      status: fileRecord.status,
      message: 'File uploaded successfully. Processing will begin shortly.',
    });
  } catch (error) {
    console.error('File upload error:', error);

    // Return appropriate error response
    if (error instanceof Error) {
      // Don't expose internal error details in production
      const errorMessage =
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'An error occurred during file upload';

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
