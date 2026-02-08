import {
  hasMarkdownHeadings,
  chunkMarkdown,
  smartChunk,
  detectHeadingLevel,
  detectNumberedItems,
} from '@/lib/chunking/markdown';

describe('detectHeadingLevel', () => {
  it('returns 2 for text with 2+ ## headings', () => {
    const text = '## Heading 1\nContent\n\n## Heading 2\nMore content';
    expect(detectHeadingLevel(text)).toBe(2);
  });

  it('returns 4 for ####-only documents', () => {
    const text = '#### KVA 1\nContent\n\n#### KVA 2\nMore';
    expect(detectHeadingLevel(text)).toBe(4);
  });

  it('returns null for plain text', () => {
    expect(detectHeadingLevel('Just plain text\n\nWith paragraphs')).toBeNull();
  });

  it('picks the lowest level when multiple levels have 2+ occurrences', () => {
    const text =
      '## A\nContent\n\n## B\nContent\n\n### C\nContent\n\n### D\nContent';
    expect(detectHeadingLevel(text)).toBe(2);
  });

  it('returns 3 when only ### has 2+ occurrences', () => {
    const text = '## Only One H2\n\n### Sub 1\nContent\n\n### Sub 2\nMore';
    expect(detectHeadingLevel(text)).toBe(3);
  });

  it('does not match inline ## that is not at start of line', () => {
    const text = 'some text ## not heading\nanother ## fake heading';
    expect(detectHeadingLevel(text)).toBeNull();
  });
});

describe('hasMarkdownHeadings', () => {
  it('returns true for text with 2+ ## headings', () => {
    const text = '## Heading 1\nContent\n\n## Heading 2\nMore content';
    expect(hasMarkdownHeadings(text)).toBe(true);
  });

  it('returns false for text with only 1 ## heading', () => {
    const text = '## Only One Heading\nSome content here';
    expect(hasMarkdownHeadings(text)).toBe(false);
  });

  it('returns false for text with no headings', () => {
    expect(hasMarkdownHeadings('Just plain text\n\nWith paragraphs')).toBe(false);
  });

  it('returns true for ### headings (now detects all levels)', () => {
    const text = '### Sub 1\nContent\n\n### Sub 2\nMore';
    expect(hasMarkdownHeadings(text)).toBe(true);
  });

  it('returns true for ####-only documents', () => {
    const text = '#### KVA 1\nContent\n\n#### KVA 2\nMore';
    expect(hasMarkdownHeadings(text)).toBe(true);
  });

  it('ignores ## that does not start at beginning of line', () => {
    const text = 'some text ## not a heading\nanother ## fake heading';
    expect(hasMarkdownHeadings(text)).toBe(false);
  });

  it('detects headings at start of line even after other content', () => {
    const text = 'Intro paragraph\n\n## First\nContent\n\n## Second\nMore';
    expect(hasMarkdownHeadings(text)).toBe(true);
  });
});

describe('chunkMarkdown', () => {
  it('splits on ## headings and sets section metadata', () => {
    const text = '## Section A\nContent A\n\n## Section B\nContent B';
    const chunks = chunkMarkdown(text);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].section).toBe('Section A');
    expect(chunks[0].text).toContain('Content A');
    expect(chunks[1].section).toBe('Section B');
    expect(chunks[1].text).toContain('Content B');
  });

  it('creates intro chunk with no section for text before first heading', () => {
    const text = 'Intro text here\n\n## Section A\nContent A\n\n## Section B\nContent B';
    const chunks = chunkMarkdown(text);

    expect(chunks).toHaveLength(3);
    expect(chunks[0].section).toBeUndefined();
    expect(chunks[0].text).toBe('Intro text here');
    expect(chunks[1].section).toBe('Section A');
    expect(chunks[2].section).toBe('Section B');
  });

  it('keeps heading text in the chunk body', () => {
    const text = '## My Heading\nBody text';
    const chunks = chunkMarkdown(text);

    expect(chunks[0].text).toMatch(/^## My Heading/);
    expect(chunks[0].text).toContain('Body text');
  });

  it('falls back to paragraph splitting for oversized sections', () => {
    const longParaA = 'A'.repeat(500);
    const longParaB = 'B'.repeat(500);
    const longParaC = 'C'.repeat(500);
    const text = `## Big Section\n\n${longParaA}\n\n${longParaB}\n\n${longParaC}`;
    const chunks = chunkMarkdown(text, 800);

    expect(chunks.length).toBeGreaterThan(1);
    // All sub-chunks should have the section set
    chunks.forEach((chunk) => {
      expect(chunk.section).toBe('Big Section');
    });
  });

  it('prepends heading to sub-chunks after the first in oversized sections', () => {
    const longParaA = 'A'.repeat(500);
    const longParaB = 'B'.repeat(500);
    const text = `## Big Section\n\n${longParaA}\n\n${longParaB}`;
    const chunks = chunkMarkdown(text, 600);

    expect(chunks.length).toBeGreaterThan(1);
    // Second sub-chunk should have heading prepended
    expect(chunks[1].text).toMatch(/^## Big Section/);
  });

  it('handles empty text', () => {
    expect(chunkMarkdown('')).toEqual([]);
  });

  it('handles heading-only sections', () => {
    const text = '## Empty Section\n\n## Another Empty';
    const chunks = chunkMarkdown(text);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].section).toBe('Empty Section');
    expect(chunks[1].section).toBe('Another Empty');
  });

  it('uses default maxChunkSize of 1500', () => {
    const content = 'X'.repeat(1400);
    const text = `## Fits\n\n${content}\n\n## Also Fits\n\nShort`;
    const chunks = chunkMarkdown(text);

    expect(chunks).toHaveLength(2);
  });

  it('splits on #### headings when that is the primary level', () => {
    const text =
      '#### KVA 1\nContent about KVA 1\n\n#### KVA 2\nContent about KVA 2\n\n#### KVA 3\nContent about KVA 3';
    const chunks = chunkMarkdown(text);

    expect(chunks).toHaveLength(3);
    expect(chunks[0].section).toBe('KVA 1');
    expect(chunks[1].section).toBe('KVA 2');
    expect(chunks[2].section).toBe('KVA 3');
  });

  it('produces hierarchical section metadata for ## > ### nesting', () => {
    const devContent = 'Developers are the people in the Scrum Team who are committed to creating any aspect of a usable Increment each Sprint.';
    const poContent = 'The Product Owner is accountable for maximizing the value of the product resulting from the work of the Scrum Team and effective Product Backlog management.';
    const text = [
      '## Scrum Team',
      'The Scrum Team consists of one Scrum Master, one Product Owner, and Developers.',
      '',
      '### Developers',
      devContent,
      '',
      '### Product Owner',
      poContent,
      '',
      '## Scrum Events',
      'Events are used in Scrum to create regularity.',
    ].join('\n');
    // maxChunkSize small enough that the ## Scrum Team section is oversized
    // but each ### sub-section fits individually
    const chunks = chunkMarkdown(text, 250);

    const sectionLabels = chunks.map((c) => c.section);
    expect(sectionLabels).toContain('Scrum Team');
    expect(sectionLabels).toContain('Scrum Team > Developers');
    expect(sectionLabels).toContain('Scrum Team > Product Owner');
    expect(sectionLabels).toContain('Scrum Events');
  });

  it('handles three-level deep nesting ## > ### > ####', () => {
    const grandchildA = 'Grandchild A has enough content to be meaningful on its own within the hierarchy.';
    const grandchildB = 'Grandchild B also has enough content to be meaningful on its own within the hierarchy.';
    const text = [
      '## Parent',
      'Parent intro paragraph with some content about the parent topic.',
      '',
      '### Child',
      'Child intro paragraph with some content about the child topic.',
      '',
      '#### Grandchild A',
      grandchildA,
      '',
      '#### Grandchild B',
      grandchildB,
      '',
      '## Other',
      'Other content here.',
    ].join('\n');
    // maxChunkSize small enough that ## Parent is oversized, ### Child is oversized,
    // but each #### grandchild fits
    const chunks = chunkMarkdown(text, 150);

    const sectionLabels = chunks.map((c) => c.section);
    expect(sectionLabels).toContain('Parent > Child > Grandchild A');
    expect(sectionLabels).toContain('Parent > Child > Grandchild B');
    expect(sectionLabels).toContain('Other');
  });

  it('falls back to paragraphs when oversized sub-section has no deeper headings', () => {
    const longPara1 = 'A'.repeat(300);
    const longPara2 = 'B'.repeat(300);
    const text = [
      '## Parent',
      '',
      '### Big Child',
      '',
      longPara1,
      '',
      longPara2,
      '',
      '## Other',
      'Short content',
    ].join('\n');
    const chunks = chunkMarkdown(text, 400);

    // The big child should be split into paragraph sub-chunks
    const bigChildChunks = chunks.filter(
      (c) => c.section === 'Parent > Big Child'
    );
    expect(bigChildChunks.length).toBeGreaterThan(1);
    // Second sub-chunk should have heading prepended
    expect(bigChildChunks[1].text).toMatch(/^### Big Child/);
  });
});

describe('smartChunk', () => {
  it('uses markdown chunking when text has 2+ ## headings', () => {
    const text = '## Heading 1\nContent 1\n\n## Heading 2\nContent 2';
    const chunks = smartChunk(text);

    expect(chunks[0].section).toBe('Heading 1');
    expect(chunks[1].section).toBe('Heading 2');
  });

  it('uses plain text chunking when text has no headings', () => {
    const text = 'Paragraph one.\n\nParagraph two.\n\nParagraph three.';
    const chunks = smartChunk(text);

    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach((chunk) => {
      expect(chunk.section).toBeUndefined();
    });
  });

  it('uses markdown chunking for ####-only documents', () => {
    const text = '#### H4 A\nContent A\n\n#### H4 B\nContent B';
    const chunks = smartChunk(text);

    expect(chunks[0].section).toBe('H4 A');
    expect(chunks[1].section).toBe('H4 B');
  });

  it('uses 1500 default for markdown chunks', () => {
    const content = 'Y'.repeat(1200);
    const text = `## Section\n\n${content}\n\n## Other\nSmall`;
    const chunks = smartChunk(text);

    const sectionChunk = chunks.find((c) => c.section === 'Section');
    expect(sectionChunk).toBeDefined();
  });

  it('uses 1000 default for plain text chunks', () => {
    const paraA = 'A'.repeat(600);
    const paraB = 'B'.repeat(600);
    const text = `${paraA}\n\n${paraB}`;
    const chunks = smartChunk(text);

    expect(chunks.length).toBe(2);
  });

  it('accepts custom max sizes', () => {
    const content = 'Z'.repeat(400);
    const text = `## S1\n\n${content}\n\n## S2\n\n${content}`;
    const chunks = smartChunk(text, { markdownMaxSize: 300 });

    expect(chunks.length).toBeGreaterThan(2);
  });
});

describe('detectNumberedItems', () => {
  it('returns true for 2+ escaped-period items', () => {
    expect(detectNumberedItems('1\\. First\n\n2\\. Second')).toBe(true);
  });

  it('returns true for 2+ plain-period items', () => {
    expect(detectNumberedItems('1. First\n\n2. Second')).toBe(true);
  });

  it('returns true for combined verse markers', () => {
    expect(detectNumberedItems('1\\. First\n\n5, 6\\. Combined')).toBe(true);
  });

  it('returns false for a single item', () => {
    expect(detectNumberedItems('1\\. Only one item here')).toBe(false);
  });

  it('returns false for no items', () => {
    expect(detectNumberedItems('Just plain text with no numbers')).toBe(false);
  });

  it('returns false for mid-line numbers', () => {
    expect(detectNumberedItems('This has 1. inside and 2. inside')).toBe(false);
  });

  it('returns false for numbers without trailing space', () => {
    expect(detectNumberedItems('1.First\n\n2.Second')).toBe(false);
  });
});

describe('numbered item splitting', () => {
  it('splits oversized section on numbered items instead of paragraphs', () => {
    const verse1 = '1\\. ' + 'A'.repeat(200);
    const verse2 = '2\\. ' + 'B'.repeat(200);
    const verse3 = '3\\. ' + 'C'.repeat(200);
    const text = `## Battle\n\n${verse1}\n\n${verse2}\n\n${verse3}`;
    const chunks = chunkMarkdown(text, 300);

    // Should split on verse boundaries, not paragraphs
    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk should have verse-range metadata
    expect(chunks.some((c) => c.section?.includes('('))).toBe(true);
  });

  it('groups small verses into single chunk when they fit', () => {
    const text = `## Intro\n\n1\\. Short verse one.\n\n2\\. Short verse two.\n\n3\\. Short verse three.`;
    const chunks = chunkMarkdown(text, 1500);

    // Entire section fits in one chunk — no verse splitting needed
    expect(chunks).toHaveLength(1);
    expect(chunks[0].section).toBe('Intro');
  });

  it('produces verse range in section metadata', () => {
    const verse1 = '1\\. ' + 'A'.repeat(200);
    const verse2 = '2\\. ' + 'B'.repeat(200);
    const verse3 = '3\\. ' + 'C'.repeat(200);
    const text = `## Battle\n\n${verse1}\n\n${verse2}\n\n${verse3}`;
    const chunks = chunkMarkdown(text, 500);

    const sections = chunks.map((c) => c.section);
    expect(sections.some((s) => s?.match(/Battle \(\d+-\d+\)/))).toBe(true);
  });

  it('handles pre-verse intro text separately', () => {
    const intro = '[Commentary about the chapter before verses begin.]';
    const verse1 = '1\\. ' + 'A'.repeat(300);
    const verse2 = '2\\. ' + 'B'.repeat(300);
    const text = `## Chapter\n\n${intro}\n\n${verse1}\n\n${verse2}`;
    const chunks = chunkMarkdown(text, 500);

    // First chunk should be the intro with heading
    expect(chunks[0].section).toBe('Chapter');
    expect(chunks[0].text).toContain('Commentary');
    // Subsequent chunks should have verse ranges
    expect(chunks.some((c) => c.section?.includes('('))).toBe(true);
  });

  it('handles combined verse markers (5, 6\\.)', () => {
    const verse1 = '1\\. First verse ' + 'A'.repeat(200);
    const combined = '5, 6\\. Combined verse ' + 'B'.repeat(200);
    const verse7 = '7\\. Seventh verse ' + 'C'.repeat(200);
    const text = `## Section\n\n${verse1}\n\n${combined}\n\n${verse7}`;
    const chunks = chunkMarkdown(text, 350);

    const sections = chunks.map((c) => c.section).filter(Boolean);
    // Should see range that includes the combined marker
    expect(sections.some((s) => s!.includes('5') || s!.includes('6'))).toBe(true);
  });

  it('oversized single verse falls back to paragraph splitting', () => {
    const bigVerse = '1\\. ' + 'A'.repeat(400) + '\n\n' + 'B'.repeat(400);
    const smallVerse = '2\\. Short.';
    const text = `## Big\n\n${bigVerse}\n\n${smallVerse}`;
    const chunks = chunkMarkdown(text, 300);

    // The big verse should be split into multiple chunks via paragraph fallback
    expect(chunks.length).toBeGreaterThan(2);
  });

  it('prepends heading to verse groups after the first', () => {
    const verse1 = '1\\. ' + 'A'.repeat(300);
    const verse2 = '2\\. ' + 'B'.repeat(300);
    const text = `## Battle\n\n${verse1}\n\n${verse2}`;
    const chunks = chunkMarkdown(text, 500);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // Find verse chunks (not the intro)
    const verseChunks = chunks.filter((c) => c.section?.includes('('));
    if (verseChunks.length >= 2) {
      expect(verseChunks[1].text).toMatch(/^## Battle/);
    }
  });

  it('does NOT use verse splitting when < 2 numbered items', () => {
    const text = `## Single\n\n1\\. Only one verse here.\n\n${'X'.repeat(800)}`;
    const chunks = chunkMarkdown(text, 500);

    // Should fall to paragraph splitting, no verse-range metadata
    const hasVerseRange = chunks.some((c) => c.section?.match(/\(\d+/));
    expect(hasVerseRange).toBe(false);
  });

  it('works with plain (unescaped) numbered items', () => {
    const verse1 = '1. ' + 'A'.repeat(300);
    const verse2 = '2. ' + 'B'.repeat(300);
    const text = `## Plain\n\n${verse1}\n\n${verse2}`;
    const chunks = chunkMarkdown(text, 500);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.some((c) => c.section?.includes('('))).toBe(true);
  });
});
