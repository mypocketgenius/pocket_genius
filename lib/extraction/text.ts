// lib/extraction/text.ts
// Phase 2, Task 4: Text extraction for plain text UTF-8 files
// Simple extraction - just read the file as UTF-8 string

/**
 * Extracts text from a plain text file (UTF-8)
 * @param file - File object or Blob
 * @returns Extracted text as string
 */
export async function extractTextFromPlainText(file: File | Blob): Promise<string> {
  // File.text() reads as UTF-8 by default
  const text = await file.text();
  return text;
}

/**
 * Extracts text from a URL (fetches from Vercel Blob)
 * @param url - URL to the file
 * @returns Extracted text as string
 */
export async function extractTextFromUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch file from URL: ${response.statusText}`);
  }
  
  const blob = await response.blob();
  return extractTextFromPlainText(blob);
}
