// lib/chunking/markdown.ts
// Hierarchical heading-aware chunking that keeps sections intact
// Detects the primary heading level automatically and splits recursively

import { chunkText, type TextChunk } from './text';

/**
 * Detects the lowest heading level (2–6) that appears 2+ times in the text.
 * Returns null for plain text with no repeated headings.
 */
export function detectHeadingLevel(text: string): number | null {
  for (let level = 2; level <= 6; level++) {
    const pattern = new RegExp(`^${'#'.repeat(level)} (?!#)`, 'gm');
    const matches = text.match(pattern);
    if (matches && matches.length >= 2) {
      return level;
    }
  }
  return null;
}

/**
 * Finds the lowest heading level with at least 1 occurrence.
 * Used by chunkMarkdown when called directly on text with a single heading.
 */
function findAnyHeadingLevel(text: string): number | null {
  for (let level = 2; level <= 6; level++) {
    const pattern = new RegExp(`^${'#'.repeat(level)} (?!#)`, 'gm');
    if (pattern.test(text)) {
      return level;
    }
  }
  return null;
}

/**
 * Returns true if the text has 2+ headings at any level (##–######).
 * Used to auto-detect whether to use heading-aware chunking.
 */
export function hasMarkdownHeadings(text: string): boolean {
  return detectHeadingLevel(text) !== null;
}

/**
 * Detects whether text contains 2+ numbered items (e.g., `1\. `, `5, 6\. `).
 * Used to decide whether verse-aware splitting should be applied.
 */
export function detectNumberedItems(text: string): boolean {
  const pattern = /^\d+(?:, *\d+)*\\?\. /gm;
  const matches = text.match(pattern);
  return matches !== null && matches.length >= 2;
}

/**
 * Extracts the first and last verse numbers from a numbered item's opening marker.
 * `"1\. ..."` → {first: 1, last: 1}, `"5, 6\. ..."` → {first: 5, last: 6}
 */
function extractVerseNumbers(item: string): { first: number; last: number } {
  const match = item.match(/^(\d+(?:, *\d+)*)\\?\. /);
  if (!match) return { first: 0, last: 0 };
  const nums = match[1].split(/,\s*/).map(Number);
  return { first: nums[0], last: nums[nums.length - 1] };
}

/**
 * Splits text on numbered-item markers and groups items into chunks.
 * Produces verse-range metadata like "LAYING PLANS (1-5)".
 */
function splitOnNumberedItems(
  text: string,
  maxChunkSize: number,
  sectionLabel: string | undefined,
  headingText: string | undefined,
  hashes: string,
  chunks: TextChunk[]
): void {
  const splitRegex = /(?=^\d+(?:, *\d+)*\\?\. )/gm;
  const parts = text.split(splitRegex);

  // parts[0] may be intro text (heading + pre-verse commentary)
  const intro = parts[0]?.trim();
  const items = parts.slice(1);

  if (intro) {
    chunks.push({ text: intro, section: sectionLabel });
  }

  const headingPrefix = headingText ? `${hashes} ${headingText}\n\n` : '';
  const headingPrefixLen = headingPrefix.length;

  let currentGroup: string[] = [];
  let currentLen = 0;
  let groupFirstVerse: number | null = null;
  let groupLastVerse: number | null = null;
  let isFirstGroup = true;

  function flushGroup() {
    if (currentGroup.length === 0) return;

    const rangeLabel =
      groupFirstVerse !== null && groupLastVerse !== null
        ? groupFirstVerse === groupLastVerse
          ? `(${groupFirstVerse})`
          : `(${groupFirstVerse}-${groupLastVerse})`
        : '';
    const section = sectionLabel
      ? `${sectionLabel} ${rangeLabel}`.trim()
      : rangeLabel || undefined;

    let body = currentGroup.join('\n\n');
    if (!isFirstGroup && headingPrefix) {
      body = headingPrefix + body;
    }

    chunks.push({ text: body, section });
    isFirstGroup = false;
    currentGroup = [];
    currentLen = 0;
    groupFirstVerse = null;
    groupLastVerse = null;
  }

  for (const item of items) {
    const trimmedItem = item.trim();
    if (!trimmedItem) continue;

    const { first, last } = extractVerseNumbers(trimmedItem);

    // If a single item is oversized, flush current group then paragraph-fallback this item
    if (trimmedItem.length > maxChunkSize && trimmedItem.length + (isFirstGroup ? 0 : headingPrefixLen) > maxChunkSize) {
      flushGroup();
      const rangeLabel = first === last ? `(${first})` : `(${first}-${last})`;
      const itemSection = sectionLabel
        ? `${sectionLabel} ${rangeLabel}`.trim()
        : rangeLabel;
      paragraphFallback(
        isFirstGroup ? trimmedItem : headingPrefix + trimmedItem,
        maxChunkSize,
        itemSection,
        headingText,
        hashes,
        chunks
      );
      isFirstGroup = false;
      continue;
    }

    // Calculate effective size including heading prepend for non-first groups
    const extraLen = !isFirstGroup && currentGroup.length === 0 ? headingPrefixLen : 0;
    const separatorLen = currentGroup.length > 0 ? 2 : 0; // '\n\n'
    const candidateLen = currentLen + separatorLen + trimmedItem.length + extraLen;

    if (candidateLen > maxChunkSize && currentGroup.length > 0) {
      flushGroup();
    }

    // Re-calculate extra for potentially new group
    if (currentGroup.length === 0) {
      currentLen = (!isFirstGroup ? headingPrefixLen : 0) + trimmedItem.length;
    } else {
      currentLen += 2 + trimmedItem.length; // '\n\n' separator
    }

    currentGroup.push(trimmedItem);
    if (groupFirstVerse === null) groupFirstVerse = first;
    groupLastVerse = last;
  }

  flushGroup();
}

/**
 * Recursively chunks markdown at a given heading level.
 * Oversized sections try the next heading level before falling back to paragraphs.
 */
function chunkAtLevel(
  text: string,
  level: number,
  maxChunkSize: number,
  parentSection?: string
): TextChunk[] {
  const hashes = '#'.repeat(level);
  // Split on headings at this level using lookahead so heading stays with content
  const splitRegex = new RegExp(`(?=^${hashes} (?!#))`, 'gm');
  const sections = text.split(splitRegex);
  const chunks: TextChunk[] = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    // Extract heading if this section starts with the expected level
    const headingRegex = new RegExp(`^${hashes} (.+)`);
    const headingMatch = trimmed.match(headingRegex);
    const headingText = headingMatch ? headingMatch[1].trim() : undefined;

    // Build the full section label
    let sectionLabel: string | undefined;
    if (headingText && parentSection) {
      sectionLabel = `${parentSection} > ${headingText}`;
    } else if (headingText) {
      sectionLabel = headingText;
    } else {
      sectionLabel = parentSection;
    }

    if (trimmed.length <= maxChunkSize) {
      chunks.push({ text: trimmed, section: sectionLabel });
    } else if (level < 6) {
      // Check if there are sub-headings at the next level
      const nextHashes = '#'.repeat(level + 1);
      const subPattern = new RegExp(`^${nextHashes} (?!#)`, 'gm');
      const subMatches = trimmed.match(subPattern);

      if (subMatches && subMatches.length >= 1) {
        // Recurse into the next heading level
        const subChunks = chunkAtLevel(trimmed, level + 1, maxChunkSize, sectionLabel);
        chunks.push(...subChunks);
      } else if (detectNumberedItems(trimmed)) {
        splitOnNumberedItems(trimmed, maxChunkSize, sectionLabel, headingText, hashes, chunks);
      } else {
        // No sub-headings — fall back to paragraph splitting
        paragraphFallback(trimmed, maxChunkSize, sectionLabel, headingText, hashes, chunks);
      }
    } else {
      // At h6 already
      if (detectNumberedItems(trimmed)) {
        splitOnNumberedItems(trimmed, maxChunkSize, sectionLabel, headingText, hashes, chunks);
      } else {
        paragraphFallback(trimmed, maxChunkSize, sectionLabel, headingText, hashes, chunks);
      }
    }
  }

  return chunks;
}

/**
 * Falls back to paragraph splitting for oversized sections.
 * Prepends the heading to sub-chunks after the first for context.
 */
function paragraphFallback(
  text: string,
  maxChunkSize: number,
  sectionLabel: string | undefined,
  headingText: string | undefined,
  hashes: string,
  chunks: TextChunk[]
): void {
  const subChunks = chunkText(text, maxChunkSize);

  for (let i = 0; i < subChunks.length; i++) {
    let subText = subChunks[i].text;
    // Prepend heading to sub-chunks that lost it (all except the first)
    if (headingText && i > 0 && !subText.startsWith(`${hashes} `)) {
      subText = `${hashes} ${headingText}\n\n${subText}`;
    }
    chunks.push({ text: subText, section: sectionLabel });
  }
}

/**
 * Chunks markdown text by detecting the primary heading level and splitting
 * hierarchically. Each section gets section metadata; oversized sections
 * recurse into sub-headings before falling back to paragraphs.
 */
export function chunkMarkdown(
  text: string,
  maxChunkSize: number = 1500
): TextChunk[] {
  const level = detectHeadingLevel(text) ?? findAnyHeadingLevel(text);
  if (level === null) {
    // No headings at all — fall back to plain text chunking
    return chunkText(text, maxChunkSize);
  }
  return chunkAtLevel(text, level, maxChunkSize);
}

/**
 * Smart dispatcher: picks markdown vs paragraph chunking based on content.
 * Defaults: 1500 chars for markdown, 1000 for plain text.
 */
export function smartChunk(
  text: string,
  options?: { markdownMaxSize?: number; plainMaxSize?: number }
): TextChunk[] {
  const markdownMax = options?.markdownMaxSize ?? 1500;
  const plainMax = options?.plainMaxSize ?? 1000;

  if (detectHeadingLevel(text) !== null) {
    return chunkMarkdown(text, markdownMax);
  }

  return chunkText(text, plainMax);
}
