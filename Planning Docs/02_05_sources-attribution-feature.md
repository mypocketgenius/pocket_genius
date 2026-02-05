# Sources Attribution Feature ✅ COMPLETE

**Status:** ✅ **COMPLETE** (Feb 5, 2026)

Enhance the existing source attribution to show clickable sources with detailed popups.

## Overview

Update the existing `SourceAttribution` component to make source names clickable. Clicking opens a dialog showing source details and the excerpts used in that response.

**Current display:**
```
Sources: The Scrum Guide, Pocket Genius Examples
```

**New display:**
```
Sources: The Scrum Guide • Pocket Genius Examples
         ↑ clickable      ↑ clickable
```

**On click, dialog shows:**
```
┌─────────────────────────────────────────────────────┐
│ Source Details                                      │
├─────────────────────────────────────────────────────┤
│ Title:     The Scrum Guide                          │
│ Authors:   Ken Schwaber & Jeff Sutherland           │
│ Year:      2020                                     │
│ License:   CC-BY-SA 4.0                             │
│                                                     │
│ Excerpts Used in This Response:                     │
│ • "The Sprint Goal is a single objective..."        │
│ • "Each Sprint may be considered a short project..."│
│                                                     │
│ [View License]  [Visit Original Source]             │
└─────────────────────────────────────────────────────┘
```

---

## Why This Approach is Simpler

The existing implementation already persists chunk data in `message.context.chunks`:
- `text`, `page`, `section`, `sourceId`, `sourceTitle` are already stored
- No streaming changes needed (no `__SOURCES__` prefix)
- Just add more fields to Source model and include them in `chunksForContext`
- Update the existing component to be clickable

---

## Phase 1: Database Schema

### 1.1 Add fields to Source model

**File:** `prisma/schema.prisma`

Add these new fields to the existing `Source` model (keep all existing relations intact):

```prisma
model Source {
  id                String              @id
  title             String
  creatorId         String
  createdAt         DateTime            @default(now())
  // NEW FIELDS - add these 5 lines
  authors           String?             // e.g., "Ken Schwaber & Jeff Sutherland"
  year              Int?                // e.g., 2020
  license           String?             // e.g., "CC-BY-SA 4.0"
  licenseUrl        String?             // e.g., "https://creativecommons.org/licenses/by-sa/4.0/"
  sourceUrl         String?             // e.g., "https://scrumguides.org/scrum-guide.html"
  // KEEP existing relations below - do not modify
  Chatbot_Source    Chatbot_Source[]
  Chunk_Performance Chunk_Performance[]
  File              File[]
  Creator           Creator             @relation(fields: [creatorId], references: [id], onDelete: Cascade)
}
```

### 1.2 Run migration

```bash
npx prisma migrate dev --name add-source-attribution-fields
```

### 1.3 Populate Scrum Guide data

First, verify the source ID exists:
```sql
SELECT id, title FROM "Source" WHERE title ILIKE '%scrum%';
```

Then update with the correct ID (adjust `WHERE id = '...'` based on query above):
```sql
UPDATE "Source"
SET
  authors = 'Ken Schwaber & Jeff Sutherland',
  year = 2020,
  license = 'CC-BY-SA 4.0',
  "licenseUrl" = 'https://creativecommons.org/licenses/by-sa/4.0/',
  "sourceUrl" = 'https://scrumguides.org/scrum-guide.html'
WHERE id = 'scrum_guide';  -- Verify this ID matches your database
```

---

## Phase 2: Backend Changes

### 2.1 Update source query to include new fields

**File:** `app/api/chat/route.ts`

Update the source fetch (around line 437) to include all attribution fields:

```ts
const sources = await prisma.source.findMany({
  where: { id: { in: sourceIds } },
  select: {
    id: true,
    title: true,
    authors: true,
    year: true,
    license: true,
    licenseUrl: true,
    sourceUrl: true,
  },
});

// Create a map for easy lookup
const sourcesMap = new Map(sources.map(s => [s.id, s]));
```

### 2.2 Include attribution data in chunksForContext

**File:** `app/api/chat/route.ts`

Update `chunksForContext` (around line 456) to include source attribution:

```ts
const chunksForContext = retrievedChunks.map((chunk) => {
  const source = sourcesMap.get(chunk.sourceId);
  return {
    chunkId: chunk.chunkId,
    sourceId: chunk.sourceId,
    sourceTitle: source?.title || null,
    sourceAuthors: source?.authors || null,
    sourceYear: source?.year || null,
    sourceLicense: source?.license || null,
    sourceLicenseUrl: source?.licenseUrl || null,
    sourceUrl: source?.sourceUrl || null,
    text: chunk.text,
    page: chunk.page,
    section: chunk.section,
  };
});
```

This data is already persisted in `message.context.chunks`, so no additional storage changes needed.

---

## Phase 3: Frontend Changes

### 3.1 Update SourceAttribution component

**File:** `components/source-attribution.tsx`

Replace the existing component with clickable sources:

```tsx
'use client';

import { Prisma } from '@prisma/client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ExternalLink } from 'lucide-react';

interface SourceAttributionProps {
  chunkIds: string[];
  chatbotId: string;
  messageContext?: Prisma.JsonValue;
  textColor?: string;
}

interface ChunkData {
  chunkId: string;
  sourceId: string;
  sourceTitle: string | null;
  sourceAuthors: string | null;
  sourceYear: number | null;
  sourceLicense: string | null;
  sourceLicenseUrl: string | null;
  sourceUrl: string | null;
  text: string;
  page: number | null;
  section: string | null;
}

interface GroupedSource {
  id: string;
  title: string;
  authors: string | null;
  year: number | null;
  license: string | null;
  licenseUrl: string | null;
  url: string | null;
  chunks: ChunkData[];
}

export function SourceAttribution({
  chunkIds,
  chatbotId,
  messageContext,
  textColor = '#4b5563',
}: SourceAttributionProps) {
  const [hasCompletedIntake, setHasCompletedIntake] = useState<boolean>(false);

  useEffect(() => {
    const checkIntakeCompletion = async () => {
      try {
        const response = await fetch(`/api/intake/completion?chatbotId=${chatbotId}`);
        if (response.ok) {
          const data = await response.json();
          setHasCompletedIntake(data.completed && data.hasQuestions);
        }
      } catch (error) {
        console.error('Error checking intake completion:', error);
      }
    };
    checkIntakeCompletion();
  }, [chatbotId]);

  // Group chunks by source
  const getGroupedSources = (): GroupedSource[] => {
    if (!messageContext || typeof messageContext !== 'object') {
      return [];
    }

    const context = messageContext as Record<string, unknown>;
    const chunks = context.chunks as ChunkData[] | undefined;

    if (!Array.isArray(chunks)) {
      return [];
    }

    const sourceMap = new Map<string, GroupedSource>();

    chunks.forEach((chunk) => {
      if (!chunk.sourceId || !chunk.sourceTitle) return;

      if (!sourceMap.has(chunk.sourceId)) {
        sourceMap.set(chunk.sourceId, {
          id: chunk.sourceId,
          title: chunk.sourceTitle,
          authors: chunk.sourceAuthors,
          year: chunk.sourceYear,
          license: chunk.sourceLicense,
          licenseUrl: chunk.sourceLicenseUrl,
          url: chunk.sourceUrl,
          chunks: [],
        });
      }

      sourceMap.get(chunk.sourceId)!.chunks.push(chunk);
    });

    return Array.from(sourceMap.values());
  };

  const groupedSources = getGroupedSources();

  if (groupedSources.length === 0 && !hasCompletedIntake) {
    return null;
  }

  return (
    <div className="mt-2 pt-2 text-xs" style={{ color: textColor, opacity: 0.8 }}>
      <span className="font-medium">Sources:</span>{' '}

      {groupedSources.map((source, index) => (
        <span key={source.id}>
          {index > 0 && ' • '}
          <Dialog>
            <DialogTrigger asChild>
              <button
                className="underline hover:no-underline cursor-pointer"
                style={{ color: textColor }}
              >
                {source.title}
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Source Details</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Source metadata */}
                <div className="space-y-2 text-sm">
                  <div className="flex">
                    <span className="font-medium w-20">Title:</span>
                    <span>{source.title}</span>
                  </div>
                  {source.authors && (
                    <div className="flex">
                      <span className="font-medium w-20">Authors:</span>
                      <span>{source.authors}</span>
                    </div>
                  )}
                  {source.year && (
                    <div className="flex">
                      <span className="font-medium w-20">Year:</span>
                      <span>{source.year}</span>
                    </div>
                  )}
                  {source.license && (
                    <div className="flex">
                      <span className="font-medium w-20">License:</span>
                      <span>{source.license}</span>
                    </div>
                  )}
                </div>

                {/* Excerpts */}
                {source.chunks.length > 0 && (
                  <div>
                    <p className="font-medium text-sm mb-2">
                      Excerpts Used in This Response:
                    </p>
                    <div className="space-y-2">
                      {source.chunks.map((chunk, i) => (
                        <div
                          key={chunk.chunkId || i}
                          className="text-sm text-muted-foreground bg-muted/50 p-2 rounded"
                        >
                          {(chunk.page || chunk.section) && (
                            <p className="text-xs text-muted-foreground mb-1">
                              {chunk.page && `Page ${chunk.page}`}
                              {chunk.page && chunk.section && ' • '}
                              {chunk.section}
                            </p>
                          )}
                          <p className="italic">"{chunk.text}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action links */}
                <div className="flex gap-4 pt-2 border-t">
                  {source.licenseUrl && (
                    <a
                      href={source.licenseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      View License <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {source.url && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Visit Original <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </span>
      ))}

      {hasCompletedIntake && (
        <>
          {groupedSources.length > 0 && ' • '}
          <Link
            href="/profile"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
            style={{ color: textColor }}
          >
            Your Personal Context
          </Link>
        </>
      )}
    </div>
  );
}
```

---

## Phase 4: Ingestion Updates

### 4.1 Update ingestion script to accept attribution

**File:** `scripts/ingest-local-file.ts`

Add attribution fields to config:

```ts
interface IngestConfig {
  filePath: string;
  sourceId: string;
  sourceTitle: string;
  creatorId: string;
  // NEW
  authors?: string;
  year?: number;
  license?: string;
  licenseUrl?: string;
  sourceUrl?: string;
}

// In the source upsert
const source = await prisma.source.upsert({
  where: { id: sourceId },
  update: {
    title: sourceTitle,
    authors: config.authors,
    year: config.year,
    license: config.license,
    licenseUrl: config.licenseUrl,
    sourceUrl: config.sourceUrl,
  },
  create: {
    id: sourceId,
    title: sourceTitle,
    creatorId: creatorId,
    authors: config.authors,
    year: config.year,
    license: config.license,
    licenseUrl: config.licenseUrl,
    sourceUrl: config.sourceUrl,
  },
});
```

---

## Testing Checklist

- [x] Migration runs successfully (used `prisma db push`)
- [x] Scrum Guide source has all attribution fields populated
- [ ] Sources display with bullet (•) separators between clickable names
- [ ] Clicking a source opens the dialog
- [ ] Dialog shows title, authors, year, license
- [ ] Dialog shows all excerpts used from that source
- [ ] "View License" link works (opens in new tab)
- [ ] "Visit Original" link works (opens in new tab)
- [ ] "Your Personal Context" link still works for users with intake
- [ ] Messages with no RAG chunks don't show sources section
- [ ] Persisted messages (page reload) still show clickable sources

---

## Files Changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `authors`, `year`, `license`, `licenseUrl`, `sourceUrl` to Source |
| `app/api/chat/route.ts` | Fetch attribution fields, include in `chunksForContext` |
| `components/source-attribution.tsx` | Update to show clickable sources with dialog |
| `scripts/ingest-local-file.ts` | Accept attribution fields in config |

---

## Key Advantages of This Approach

1. **No streaming changes** - Data persists via existing `message.context.chunks`
2. **Works on page reload** - Sources are stored with the message, not streamed
3. **Updates existing component** - No new files to integrate
4. **Simpler implementation** - Just add fields and update one component

---

## Implementation Summary (Feb 5, 2026)

All planned changes were implemented successfully:

1. **Phase 1: Database Schema** ✅
   - Added 5 new fields to Source model: `authors`, `year`, `license`, `licenseUrl`, `sourceUrl`
   - Schema pushed to database via `prisma db push`

2. **Phase 2: Backend Changes** ✅
   - Updated `sourcesMap` to store full source objects instead of just titles
   - Extended `chunksForContext` to include all attribution fields

3. **Phase 3: Frontend Changes** ✅
   - Rewrote `SourceAttribution` component with Dialog-based UI
   - Sources now clickable with bullet separators
   - Dialog shows metadata and excerpts

4. **Phase 4: Ingestion Updates** ✅
   - Extended `IngestConfig` interface with attribution fields
   - Updated source upsert to store attribution data
   - Created `scripts/update-scrum-guide-attribution.ts` for populating existing data

**Additional file created:**
- `scripts/update-scrum-guide-attribution.ts` - One-time script to populate Scrum Guide attribution

---

## ⚠️ SCHEMA CHANGE WARNING

When adding fields to `prisma/schema.prisma`:

**NEVER run `prisma db pull`** - it will overwrite the entire schema file and strip:
- `@default(cuid())` from all id fields
- `@updatedAt` from all updatedAt fields
- All comments

**Always:**
1. Edit `schema.prisma` manually
2. Run `prisma migrate dev --name <descriptive-name>` or `prisma db push`
3. Run `prisma generate`

If you accidentally run `db pull`, recover via:
```bash
git checkout <last-good-commit> -- prisma/schema.prisma
```

See `02_03_source-many-to-many-migration.md` for full details on this issue.
