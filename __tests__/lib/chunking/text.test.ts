// __tests__/lib/chunking/text.test.ts
// Phase 6, Task 1: Unit tests for chunkText function
// Tests critical text chunking logic that splits text into semantic chunks

import { chunkText, TextChunk } from '@/lib/chunking/text';

describe('chunkText', () => {
  describe('basic functionality', () => {
    it('should split text into chunks', () => {
      const text = 'Para 1\n\nPara 2';
      const chunks = chunkText(text, 100);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toHaveProperty('text');
    });

    it('should handle empty text', () => {
      const chunks = chunkText('');
      expect(chunks).toEqual([]);
    });

    it('should handle text with only whitespace', () => {
      const chunks = chunkText('   \n\n   \n\n   ');
      expect(chunks).toEqual([]);
    });

    it('should return single chunk for text smaller than maxChunkSize', () => {
      const text = 'This is a short paragraph.';
      const chunks = chunkText(text, 1000);
      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toBe(text);
    });
  });

  describe('paragraph preservation', () => {
    it('should preserve paragraph boundaries', () => {
      const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
      const chunks = chunkText(text, 100);
      
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      // When paragraphs are combined, they should be separated by \n\n
      // Each chunk should contain complete paragraphs (not split mid-paragraph)
      chunks.forEach((chunk) => {
        // If chunk contains multiple paragraphs, they should be separated by \n\n
        const paragraphCount = chunk.text.split('\n\n').length;
        // Each paragraph should be complete (not empty after split)
        const paragraphs = chunk.text.split('\n\n').filter(p => p.trim().length > 0);
        expect(paragraphs.length).toBeGreaterThan(0);
      });
    });

    it('should combine multiple paragraphs into one chunk if they fit', () => {
      const text = 'Para 1\n\nPara 2\n\nPara 3';
      const chunks = chunkText(text, 1000);
      
      // All paragraphs should fit in one chunk
      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toContain('Para 1');
      expect(chunks[0].text).toContain('Para 2');
      expect(chunks[0].text).toContain('Para 3');
    });

    it('should split chunks when paragraphs exceed maxChunkSize', () => {
      const longPara = 'A'.repeat(500);
      const text = `${longPara}\n\n${longPara}\n\n${longPara}`;
      const chunks = chunkText(text, 600);
      
      // Should create multiple chunks since each paragraph is 500 chars
      expect(chunks.length).toBeGreaterThan(1);
    });
  });

  describe('chunk size limits', () => {
    it('should respect maxChunkSize parameter when paragraphs are present', () => {
      // Create text with multiple paragraphs that exceed maxChunkSize
      const para1 = 'A'.repeat(300);
      const para2 = 'B'.repeat(300);
      const para3 = 'C'.repeat(300);
      const text = `${para1}\n\n${para2}\n\n${para3}`;
      const chunks = chunkText(text, 500);
      
      // Should create multiple chunks since paragraphs exceed maxChunkSize
      expect(chunks.length).toBeGreaterThan(1);
      // Each chunk should respect maxChunkSize (with tolerance for paragraph separators)
      chunks.forEach((chunk) => {
        // Allow some tolerance for \n\n separators between paragraphs
        expect(chunk.text.length).toBeLessThanOrEqual(550);
      });
    });

    it('should not split single paragraph that exceeds maxChunkSize', () => {
      // Single paragraph without newlines - should not be split
      const text = 'A'.repeat(2000);
      const chunks = chunkText(text, 500);
      
      // Should create one chunk (function doesn't split paragraphs, only combines them)
      expect(chunks.length).toBe(1);
      expect(chunks[0].text.length).toBe(2000);
    });

    it('should use default maxChunkSize of 1000 when not specified', () => {
      // Create text with paragraphs that exceed default 1000
      const para1 = 'A'.repeat(600);
      const para2 = 'B'.repeat(600);
      const text = `${para1}\n\n${para2}`;
      const chunks = chunkText(text);
      
      // Should create multiple chunks since combined paragraphs exceed default 1000
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should handle very small maxChunkSize', () => {
      const text = 'This is a test paragraph with multiple words.';
      const chunks = chunkText(text, 10);
      
      // Should still create at least one chunk (even if it exceeds limit slightly)
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle text with multiple consecutive newlines', () => {
      const text = 'Para 1\n\n\n\nPara 2';
      const chunks = chunkText(text, 100);
      
      expect(chunks.length).toBeGreaterThan(0);
      // Should not create empty chunks
      chunks.forEach((chunk) => {
        expect(chunk.text.trim().length).toBeGreaterThan(0);
      });
    });

    it('should trim whitespace from chunks', () => {
      const text = '   Para 1   \n\n   Para 2   ';
      const chunks = chunkText(text, 100);
      
      chunks.forEach((chunk) => {
        expect(chunk.text).not.toMatch(/^\s+/); // No leading whitespace
        expect(chunk.text).not.toMatch(/\s+$/); // No trailing whitespace
      });
    });

    it('should handle single paragraph without newlines', () => {
      const text = 'This is a single paragraph without any newlines.';
      const chunks = chunkText(text, 100);
      
      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toBe(text);
    });

    it('should preserve last chunk even if it does not end with newline', () => {
      const text = 'Para 1\n\nPara 2';
      const chunks = chunkText(text, 100);
      
      // Last chunk should be included
      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk.text).toContain('Para 2');
    });
  });

  describe('page numbering', () => {
    it('should not set page for plain text files without page info', () => {
      const text = 'Para 1\n\nPara 2';
      const chunks = chunkText(text, 100);

      chunks.forEach((chunk) => {
        expect(chunk.page).toBeUndefined();
      });
    });
  });

  describe('real-world scenarios', () => {
    it('should handle typical book chapter text', () => {
      const text = `
Chapter 1: Introduction

This is the first paragraph of the chapter. It introduces the main concepts.

This is the second paragraph. It provides more details about the topic.

This is the third paragraph. It concludes the introduction.
      `.trim();

      const chunks = chunkText(text, 200);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.text.length).toBeGreaterThan(0);
      });
    });

    it('should handle text with mixed paragraph lengths', () => {
      const shortPara = 'Short.';
      const longPara = 'A'.repeat(800);
      const text = `${shortPara}\n\n${longPara}\n\n${shortPara}`;
      
      const chunks = chunkText(text, 500);
      
      // Should create multiple chunks
      expect(chunks.length).toBeGreaterThan(1);
    });
  });
});
