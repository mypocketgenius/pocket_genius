// lib/chunking/text.ts
// Phase 2, Task 5: Simple paragraph-based text chunking
// Preserves paragraph boundaries while respecting max chunk size

/**
 * Simple chunk interface for MVP
 * Enhanced with metadata later when needed
 */
export interface TextChunk {
  text: string;
  page?: number;  // Optional - only set when actual page info is available
}

/**
 * Chunks text by preserving paragraph boundaries
 * Combines paragraphs until maxChunkSize is reached
 * 
 * @param text - The full text to chunk
 * @param maxChunkSize - Maximum characters per chunk (default: 1000)
 * @returns Array of text chunks with page numbers
 * 
 * @example
 * ```typescript
 * const text = "Para 1\n\nPara 2\n\nPara 3";
 * const chunks = chunkText(text, 100);
 * // Returns chunks preserving paragraph structure
 * ```
 */
export function chunkText(
  text: string,
  maxChunkSize: number = 1000
): TextChunk[] {
  // Split text by double newlines (paragraph boundaries)
  const paragraphs = text.split(/\n\n+/);
  const chunks: TextChunk[] = [];
  let currentChunk = '';
  
  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    
    // Skip empty paragraphs
    if (!trimmedPara) {
      continue;
    }
    
    // If adding this paragraph would exceed maxChunkSize and we have content,
    // save current chunk and start a new one
    if (
      currentChunk.length + trimmedPara.length > maxChunkSize &&
      currentChunk
    ) {
      chunks.push({
        text: currentChunk.trim(),
      });
      currentChunk = trimmedPara;
    } else {
      // Add paragraph to current chunk
      currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara;
    }
  }
  
  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
    });
  }
  
  return chunks;
}
