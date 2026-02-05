# Source Many-to-Many Migration Plan

## Problem Statement

The current `Source` model has a direct `chatbotId` foreign key, creating a one-to-many relationship where each source belongs to exactly one chatbot. This is a design limitation because:

- A creator's book/content should be able to power multiple chatbots (e.g., "Body of Work" bot AND "Deep Dive" bot)
- Current design requires duplicating Source records to use the same content in multiple chatbots
- This is inconsistent with how `Intake_Question` already uses a many-to-many pattern via `Chatbot_Intake_Question`

## Current Schema

```prisma
model Source {
  id        String   @id @default(cuid())
  title     String
  creatorId String
  creator   Creator  @relation(fields: [creatorId], references: [id], onDelete: Cascade)
  chatbotId String   // <-- PROBLEM: One-to-many relationship
  chatbot   Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  ...
}
```

## Target Schema

```prisma
model Source {
  id        String   @id @default(cuid())
  title     String
  creatorId String
  creator   Creator  @relation(fields: [creatorId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  // Relations
  files             File[]
  chunkPerformances Chunk_Performance[]
  chatbots          Chatbot_Source[]  // <-- NEW: Many-to-many
}

// NEW: Junction table for many-to-many relationship
model Chatbot_Source {
  id        String   @id @default(cuid())
  chatbotId String
  chatbot   Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  sourceId  String
  source    Source   @relation(fields: [sourceId], references: [id], onDelete: Cascade)

  // Optional: chatbot-specific source settings
  isActive  Boolean  @default(true)
  addedAt   DateTime @default(now())

  @@unique([chatbotId, sourceId])
  @@index([chatbotId])
  @@index([sourceId])
}
```

---

## Impact Analysis

### Critical Changes Required (Verified)

| File | Current Code Location | Current Usage | Migration Impact |
|------|----------------------|---------------|------------------|
| `app/api/ingestion/trigger/route.ts` | Lines 37-46, 63-68, 155 | Includes `chatbot` relation, validates it, uses `chatbot.id` for namespace | Remove chatbot include/validation, use `source.creatorId` for namespace |
| `app/api/chat/route.ts` | Lines 109-121, 178-224, 247-290, 332, 391-408 | Creates/fetches conversation, uses `chatbot-${id}` namespace, filters by `chatbotId` | Snapshot sourceIds on conversation creation, read from conversation for messages, use `creator-${creatorId}` namespace |
| `lib/rag/query.ts` | queryRAG function | No filter parameter | Add optional `filter` parameter for Pinecone metadata filtering |
| `prisma/seed.ts` | Lines 136-145 | Sets `chatbotId` at source creation | Create Source without chatbotId, then create Chatbot_Source link |
| `prisma/schema.prisma` | Conversation model | No sourceIds field | Add `sourceIds String[]` to snapshot allowed sources at conversation start |

### Low Risk (Already Compatible)

- `app/api/files/upload/route.ts` - Only checks source exists, no chatbotId validation
- `app/api/conversations/[id]/messages/route.ts` - No chatbotId filter on source query
- `components/source-attribution.tsx` - Uses context.chunks.sourceTitle, not direct Source queries
- `components/chat.tsx` - Passes data through, no direct Source queries

---

## Pinecone Strategy: Creator Namespace + sourceId Filtering

The ingestion pipeline currently uses `source.chatbot.id` to determine the Pinecone namespace (`chatbot-${chatbotId}`). With many-to-many sources, we need a new approach.

### Chosen Approach: Creator-Based Namespace with sourceId Metadata Filtering

```
Namespace: creator-${creatorId}
├── All vectors for all sources owned by that creator
├── Each vector has metadata: { sourceId: "source_123", ... }
└── Query: single Pinecone call with sourceId filter
```

### Why This Approach?

**Use case context:** Chatbots exist in "constellations" - groups of chatbots sharing 5-6 common sources, each with 1-5 unique sources. This means:
- Shared sources would be duplicated many times with per-chatbot namespaces
- Links between sources and chatbots will change as new chatbots are added
- Query latency matters (can't do N parallel namespace queries)

**Why creator-based namespaces:**
- Natural isolation between different creators
- All of a creator's content in one place
- Single Pinecone query per chat (fast)

**Why filter by sourceId (not chatbotIds):**

| Approach | On link change | Vector metadata |
|----------|---------------|-----------------|
| Store `chatbotIds[]` on vector | Update ALL vectors for that source | Grows with each link |
| Store `sourceId` on vector | Update 1 row in Postgres | Stable, never changes |

Storing `sourceId` means vector metadata never changes when source-chatbot relationships change. The access control lives in Postgres (`Chatbot_Source` table), not in Pinecone.

### Vector Metadata Schema

```typescript
{
  // For filtering (stable, set at ingestion time)
  sourceId: "source_abc",

  // For display/attribution (returned with results)
  sourceTitle: "The Art of War",
  page: 42,
  section: "Chapter 3",
  chunkText: "The supreme art of war is to subdue the enemy without fighting..."
}
```

### Query Flow

**Key optimization:** Sources don't change during a conversation, so we snapshot `sourceIds` at conversation creation and reuse for all messages.

```typescript
// ON CONVERSATION CREATION (once per conversation):
// 1. Get allowed sources from Postgres
const allowedSourceIds = await prisma.chatbot_Source.findMany({
  where: { chatbotId, isActive: true },
  select: { sourceId: true }
}).then(rows => rows.map(r => r.sourceId));

// 2. Store on conversation record
const conversation = await prisma.conversation.create({
  data: {
    chatbotId,
    userId,
    sourceIds: allowedSourceIds,  // Snapshot at creation time
    // ... other fields
  },
});

// ON EACH MESSAGE (uses stored snapshot):
// 1. Get sourceIds from conversation (already fetched for ownership check)
const { sourceIds } = conversation;

// 2. Query Pinecone with sourceId filter
const results = await pinecone.query({
  namespace: `creator-${creatorId}`,
  vector: queryEmbedding,
  topK: 10,
  filter: {
    sourceId: { $in: sourceIds }
  },
  includeMetadata: true
});
```

**Trade-off:** If a creator links/unlinks a source mid-conversation, existing conversations keep their original source list. New conversations get the updated list. This is acceptable behavior.

### Ingestion Flow

```typescript
// Upsert to creator namespace with sourceId metadata
await pinecone.upsert({
  namespace: `creator-${creatorId}`,
  vectors: chunks.map(chunk => ({
    id: chunk.id,
    values: chunk.embedding,
    metadata: {
      sourceId: source.id,
      sourceTitle: source.title,
      page: chunk.page,
      section: chunk.section,
      chunkText: chunk.text
    }
  }))
});
```

### Benefits Summary

| Concern | How it's addressed |
|---------|-------------------|
| No vector duplication | Each chunk stored once, filtered at query time |
| Fast queries | Single Pinecone call with metadata filter |
| Flexible linking | Change Chatbot_Source in Postgres, no vector updates |
| Constellation isolation | Each creator = separate namespace |
| Simple re-ingestion | Just upsert to creator namespace with sourceId |
| No per-message DB lookup | sourceIds snapshotted on Conversation at creation |
| No caching complexity | Conversation record serves as the "cache" |

---

## Migration Steps

### Phase 1: Schema Migration

1. **Update Prisma schema** (`prisma/schema.prisma`)

   Add the junction table model, update related models, and add sourceIds to Conversation:
   ```prisma
   // NEW: Add to schema.prisma
   model Chatbot_Source {
     id        String   @id @default(cuid())
     chatbotId String
     chatbot   Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
     sourceId  String
     source    Source   @relation(fields: [sourceId], references: [id], onDelete: Cascade)
     isActive  Boolean  @default(true)
     addedAt   DateTime @default(now())

     @@unique([chatbotId, sourceId])
     @@index([chatbotId])
     @@index([sourceId])
   }

   // UPDATE: Add relation to Chatbot model
   model Chatbot {
     // ... existing fields ...
     sources Chatbot_Source[]  // ADD this line
   }

   // UPDATE: Add relation to Source model (keep chatbotId for now)
   model Source {
     // ... existing fields ...
     chatbots Chatbot_Source[]  // ADD this line
   }

   // UPDATE: Add sourceIds snapshot to Conversation model
   model Conversation {
     // ... existing fields ...
     sourceIds String[]  // ADD: Snapshot of allowed sources at conversation start
   }
   ```

2. **Run Prisma migration** (non-breaking)
   ```bash
   npx prisma migrate dev --name add_chatbot_source_junction
   ```

   This generates SQL equivalent to:
   ```sql
   CREATE TABLE "Chatbot_Source" (
     "id" TEXT NOT NULL,
     "chatbotId" TEXT NOT NULL,
     "sourceId" TEXT NOT NULL,
     "isActive" BOOLEAN NOT NULL DEFAULT true,
     "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "Chatbot_Source_pkey" PRIMARY KEY ("id")
   );
   CREATE UNIQUE INDEX "Chatbot_Source_chatbotId_sourceId_key" ON "Chatbot_Source"("chatbotId", "sourceId");
   CREATE INDEX "Chatbot_Source_chatbotId_idx" ON "Chatbot_Source"("chatbotId");
   CREATE INDEX "Chatbot_Source_sourceId_idx" ON "Chatbot_Source"("sourceId");
   ALTER TABLE "Chatbot_Source" ADD CONSTRAINT "Chatbot_Source_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE;
   ALTER TABLE "Chatbot_Source" ADD CONSTRAINT "Chatbot_Source_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE;
   ```

3. **Migrate existing data** (non-breaking)
   ```sql
   -- Run via prisma db execute or migration
   INSERT INTO "Chatbot_Source" ("id", "chatbotId", "sourceId", "addedAt")
   SELECT gen_random_uuid(), "chatbotId", "id", "createdAt"
   FROM "Source"
   WHERE "chatbotId" IS NOT NULL;
   ```

### Phase 2: Code Updates

1. **Update ingestion trigger** (`app/api/ingestion/trigger/route.ts`)

   Current code references (verified):
   - Lines 37-46: Prisma query includes `source: { include: { chatbot: true } }`
   - Lines 63-68: Validates `file.source.chatbot` exists
   - Line 155: Uses `file.source.chatbot.id` for namespace

   Changes:
   ```typescript
   // BEFORE (lines 37-46)
   const file = await prisma.file.findUnique({
     where: { id: fileId },
     include: {
       source: {
         include: { chatbot: true },
       },
     },
   });

   // AFTER - no need to include chatbot, creatorId is on source
   const file = await prisma.file.findUnique({
     where: { id: fileId },
     include: { source: true },
   });

   // REMOVE (lines 63-68) - this validation is no longer needed
   if (!file.source.chatbot) {
     return NextResponse.json(
       { error: 'Chatbot not found for source' },
       { status: 404 }
     );
   }

   // BEFORE (line 155)
   await upsertWithRetry(vectors, file.source.chatbot.id, 3);

   // AFTER - use creatorId for namespace
   await upsertWithRetry(vectors, file.source.creatorId, 3);
   ```

   Vector metadata (lines 142-151) already includes `sourceId` and `sourceTitle` - no changes needed.

2. **Update Pinecone utility** (`lib/pinecone.ts`)

   Update `upsertWithRetry` function signature and comments to clarify the namespace parameter is now `creatorId`:
   ```typescript
   // BEFORE
   export async function upsertWithRetry(
     vectors: PineconeVector[],
     chatbotId: string,  // <-- Old parameter name
     maxRetries: number = 3
   ): Promise<void> {
     const namespace = `chatbot-${chatbotId}`;
     // ...
   }

   // AFTER
   export async function upsertWithRetry(
     vectors: PineconeVector[],
     creatorId: string,  // <-- Renamed for clarity
     maxRetries: number = 3
   ): Promise<void> {
     const namespace = `creator-${creatorId}`;  // <-- Updated prefix
     // ...
   }
   ```

   Also update any JSDoc comments on this function to reflect the new namespace scheme.

2. **Update chat route** (`app/api/chat/route.ts`)

   Current code references (verified):
   - Lines 109-121: Fetches chatbot with `creator` included (has `chatbot.creatorId` available)
   - Lines 178-224: Creates new conversation
   - Lines 247-290: Fetches existing conversation for validation
   - Line 332: Uses `chatbot-${chatbotId}` namespace
   - Lines 391-408: Queries sources with `where: { chatbotId }`

   **Key change:** Snapshot sourceIds at conversation creation, reuse for all messages.

   Changes for NEW conversation creation (around line 178-224):
   ```typescript
   // BEFORE: Create conversation without sourceIds
   const conversation = await prisma.conversation.create({
     data: {
       chatbotId,
       chatbotVersionId,
       userId: dbUserId,
       status: 'active',
       messageCount: 0,
       intakeCompleted: welcomeMessageContent ? true : false,
     },
   });

   // AFTER: Fetch sourceIds and store on conversation
   const allowedSourceIds = await prisma.chatbot_Source.findMany({
     where: { chatbotId, isActive: true },
     select: { sourceId: true }
   }).then(rows => rows.map(r => r.sourceId));

   const conversation = await prisma.conversation.create({
     data: {
       chatbotId,
       chatbotVersionId,
       userId: dbUserId,
       status: 'active',
       messageCount: 0,
       intakeCompleted: welcomeMessageContent ? true : false,
       sourceIds: allowedSourceIds,  // NEW: Snapshot at creation
     },
   });
   ```

   Changes for EXISTING conversation fetch (around line 247-258):
   ```typescript
   // BEFORE: Fetch without sourceIds
   const conversation = await prisma.conversation.findUnique({
     where: { id: conversationId },
   });

   // AFTER: Include sourceIds in fetch
   const conversation = await prisma.conversation.findUnique({
     where: { id: conversationId },
     select: {
       id: true,
       chatbotId: true,
       userId: true,
       sourceIds: true,  // NEW: Get stored snapshot
       // ... other fields needed for validation
     },
   });
   ```

   **Handle legacy conversations** (created before migration, no sourceIds populated):
   ```typescript
   // After fetching conversation, handle legacy case
   let sourceIds = conversation.sourceIds;

   // Legacy fallback: if conversation has no sourceIds, fetch live from Chatbot_Source
   if (!sourceIds || sourceIds.length === 0) {
     sourceIds = await prisma.chatbot_Source.findMany({
       where: { chatbotId: conversation.chatbotId, isActive: true },
       select: { sourceId: true }
     }).then(rows => rows.map(r => r.sourceId));

     // Optionally backfill the conversation record (one-time migration)
     if (sourceIds.length > 0) {
       await prisma.conversation.update({
         where: { id: conversation.id },
         data: { sourceIds },
       });
     }
   }
   ```

   **Note:** This fallback can be removed after all legacy conversations expire or a bulk migration script is run.

   Changes for RAG query (around line 332):
   ```typescript
   // Get sourceIds from conversation (already fetched above)
   const sourceIds = conversation.sourceIds;

   // Handle empty array - return early with no chunks (don't query without filter)
   if (sourceIds.length === 0) {
     console.warn(`Conversation ${conversationId} has no linked sources`);
     retrievedChunks = [];  // Skip RAG, chatbot uses general knowledge only
     // Skip the Pinecone query entirely - continue to LLM call
   }

   // CHANGE: Use creatorId for namespace
   const namespace = `creator-${chatbot.creatorId}`;

   // CHANGE: Pass sourceId filter to queryRAG (only if we have sources)
   // Note: This block is inside an else branch - only runs if sourceIds.length > 0
   retrievedChunks = await queryRAG({
     query: lastMessage.content,
     namespace,
     topK: 5,
     filter: { sourceId: { $in: sourceIds } },
   });
   ```

   Changes for source title query (lines 391-408):
   ```typescript
   // BEFORE
   const sources = await prisma.source.findMany({
     where: {
       id: { in: sourceIds },
       chatbotId,
     },
     select: { id: true, title: true },
   });

   // AFTER - just filter by id (sourceIds already validated at conversation creation)
   const sources = await prisma.source.findMany({
     where: {
       id: { in: retrievedSourceIds },  // sourceIds from retrieved chunks
     },
     select: { id: true, title: true },
   });
   ```

3. **Update queryRAG function** (`lib/rag/query.ts`)

   Add optional `filter` parameter to pass through to Pinecone:
   ```typescript
   interface QueryRAGOptions {
     query: string;
     namespace: string;
     topK?: number;
     filter?: Record<string, any>;  // NEW: Pinecone metadata filter
   }

   export async function queryRAG(options: QueryRAGOptions): Promise<RetrievedChunk[]> {
     // ... existing code ...
     const results = await index.query({
       namespace: options.namespace,
       vector: embedding,
       topK: options.topK || 5,
       filter: options.filter,  // NEW: pass filter to Pinecone
       includeMetadata: true,
     });
     // ... rest of function ...
   }
   ```

4. **Update seed script** (`prisma/seed.ts`)

   Current code (lines 136-145):
   ```typescript
   const source = await prisma.source.upsert({
     where: { id: 'source_art_of_war' },
     update: {},
     create: {
       id: 'source_art_of_war',
       title: 'The Art of War',
       creatorId: creator.id,
       chatbotId: chatbot.id,  // <-- REMOVE after Phase 3
     },
   });
   ```

   After migration:
   ```typescript
   // Create source without chatbotId
   const source = await prisma.source.upsert({
     where: { id: 'source_art_of_war' },
     update: {},
     create: {
       id: 'source_art_of_war',
       title: 'The Art of War',
       creatorId: creator.id,
       // chatbotId removed - use Chatbot_Source instead
     },
   });

   console.log('✅ Created source:', source.title);

   // Link source to chatbot via junction table
   await prisma.chatbot_Source.upsert({
     where: {
       chatbotId_sourceId: {
         chatbotId: chatbot.id,
         sourceId: source.id,
       },
     },
     update: {},
     create: {
       chatbotId: chatbot.id,
       sourceId: source.id,
       isActive: true,
     },
   });

   console.log('✅ Linked source to chatbot');
   ```

### Phase 2.5: Pinecone Namespace Migration

**CRITICAL:** This phase must be completed before chat queries will work correctly. The code updates in Phase 2 expect vectors in `creator-${creatorId}` namespaces, but existing vectors are in `chatbot-${chatbotId}` namespaces.

1. **Re-ingest all files to new namespaces**

   Create a migration script that re-processes all existing files:
   ```typescript
   // scripts/migrate-pinecone-namespaces.ts
   import { prisma } from '@/lib/prisma';
   import { triggerIngestion } from '@/lib/ingestion';

   async function migrateNamespaces() {
     // Get all files that have been ingested
     const files = await prisma.file.findMany({
       where: { ingestionStatus: 'completed' },
       include: { source: true },
     });

     console.log(`Found ${files.length} files to re-ingest`);

     for (const file of files) {
       console.log(`Re-ingesting: ${file.name} (source: ${file.source.title})`);

       // Reset status to trigger re-ingestion
       await prisma.file.update({
         where: { id: file.id },
         data: { ingestionStatus: 'pending' },
       });

       // Trigger ingestion (will now use creator-${creatorId} namespace)
       await triggerIngestion(file.id);

       // Add delay to avoid rate limits
       await new Promise(resolve => setTimeout(resolve, 1000));
     }

     console.log('Migration complete');
   }

   migrateNamespaces().catch(console.error);
   ```

2. **Verify new namespaces have data**
   ```typescript
   // Verify vectors exist in new namespaces
   const index = pinecone.index('your-index');
   const stats = await index.describeIndexStats();

   // Check for creator-* namespaces
   const creatorNamespaces = Object.entries(stats.namespaces || {})
     .filter(([ns]) => ns.startsWith('creator-'));

   console.log('Creator namespaces:', creatorNamespaces);
   ```

3. **Test chat queries against new namespaces**
   - Verify RAG retrieval works for each chatbot
   - Confirm source attribution is correct
   - Test filtering returns only linked sources

4. **Delete old chatbot namespaces** (only after verification)
   ```typescript
   // Clean up old namespaces
   const index = pinecone.index('your-index');
   const stats = await index.describeIndexStats();

   for (const ns of Object.keys(stats.namespaces || {})) {
     if (ns.startsWith('chatbot-')) {
       console.log(`Deleting old namespace: ${ns}`);
       await index.namespace(ns).deleteAll();
     }
   }
   ```

**Rollback:** If issues arise, revert Phase 2 code changes to query old `chatbot-*` namespaces while debugging.

### Phase 3: Cleanup

1. **Handle orphaned sources** (sources with no linked chatbots)

   Before removing `chatbotId`, check for and handle orphaned sources:
   ```sql
   -- Find orphaned sources (have chatbotId but no Chatbot_Source entry)
   SELECT s.id, s.title, s."chatbotId"
   FROM "Source" s
   LEFT JOIN "Chatbot_Source" cs ON s.id = cs."sourceId"
   WHERE cs.id IS NULL;
   ```

   Resolution options:
   - **Option A:** Create missing Chatbot_Source entries (recommended if chatbotId is valid)
     ```sql
     INSERT INTO "Chatbot_Source" ("id", "chatbotId", "sourceId", "addedAt")
     SELECT gen_random_uuid(), s."chatbotId", s.id, s."createdAt"
     FROM "Source" s
     LEFT JOIN "Chatbot_Source" cs ON s.id = cs."sourceId"
     WHERE cs.id IS NULL AND s."chatbotId" IS NOT NULL;
     ```
   - **Option B:** Delete orphaned sources (if they have no files/vectors)
   - **Option C:** Leave as creator-level sources (accessible if UI supports it later)

2. **Remove chatbotId from Source** (breaking)

   Update Prisma schema:
   ```prisma
   model Source {
     id        String   @id @default(cuid())
     title     String
     creatorId String
     creator   Creator  @relation(fields: [creatorId], references: [id], onDelete: Cascade)
     createdAt DateTime @default(now())
     // chatbotId REMOVED
     // chatbot   REMOVED

     files             File[]
     chunkPerformances Chunk_Performance[]
     chatbots          Chatbot_Source[]
   }
   ```

   Run migration:
   ```bash
   npx prisma migrate dev --name remove_source_chatbot_id
   ```

3. **Update all remaining queries** that reference `source.chatbotId`

   Search codebase for remaining references:
   ```bash
   grep -r "source.chatbotId" --include="*.ts" --include="*.tsx"
   grep -r "chatbotId" prisma/schema.prisma | grep -i source
   ```

4. **Update TypeScript types** if manually defined anywhere

5. **Clean up old Pinecone namespaces** (after verifying new namespaces work)
   ```typescript
   // List and delete old chatbot-* namespaces
   const index = pinecone.index('your-index');
   const stats = await index.describeIndexStats();
   for (const ns of Object.keys(stats.namespaces || {})) {
     if (ns.startsWith('chatbot-')) {
       await index.namespace(ns).deleteAll();
       console.log(`Deleted namespace: ${ns}`);
     }
   }
   ```

---

## Pre-Implementation Verification

Before starting implementation, verify that line numbers in this plan still match the current codebase:

```bash
# Verify ingestion trigger references
grep -n "chatbot" app/api/ingestion/trigger/route.ts

# Verify chat route references
grep -n "chatbot" app/api/chat/route.ts

# Verify seed script references
grep -n "chatbotId" prisma/seed.ts

# Verify queryRAG function
grep -n "query" lib/rag/query.ts
```

If line numbers have drifted, update this plan before proceeding.

---

## Testing Plan

### Unit Tests
- [ ] Create source without chatbotId
- [ ] Link source to multiple chatbots via Chatbot_Source
- [ ] Query sources for a chatbot via junction table
- [ ] Unlink source from chatbot (soft delete via isActive flag)
- [ ] Fetch allowed sourceIds for a chatbot

### Integration Tests
- [ ] File upload to source linked to multiple chatbots
- [ ] Ingestion writes to `creator-${creatorId}` namespace with sourceId metadata
- [ ] Chat queries correct creator namespace with sourceId filter
- [ ] Chat only retrieves chunks from linked sources (not all creator sources)
- [ ] Source attribution displays correctly for shared sources
- [ ] Dashboard chunk analytics work with shared sources

### Pinecone-Specific Tests
- [ ] Vectors have correct sourceId in metadata
- [ ] sourceId filter returns only matching chunks
- [ ] Chatbot A sees only its linked sources, not Chatbot B's unique sources
- [ ] Shared source chunks visible to both chatbots in same constellation
- [ ] Adding Chatbot_Source link allows access in NEW conversations (existing conversations unchanged)
- [ ] Removing Chatbot_Source link blocks access in NEW conversations (existing conversations unchanged)

### Namespace Migration Tests (Phase 2.5)
- [ ] Re-ingestion script processes all files without errors
- [ ] New `creator-*` namespaces contain expected vector counts
- [ ] Old `chatbot-*` namespaces still exist (until explicit deletion)
- [ ] Chat queries return results from new namespaces
- [ ] Source attribution matches between old and new namespace queries
- [ ] No duplicate vectors (old namespace vectors don't interfere)

### Edge Cases
- [ ] Source with no linked chatbots (orphaned) - should not appear in any chat queries
- [ ] **Chatbot with no linked sources** - new conversation created with empty `sourceIds[]`, returns empty results gracefully
  - Verify: `sourceIds = []` → `queryRAG` returns `[]` → uses general knowledge
  - Verify: No Pinecone errors from `$in: []` filter
- [ ] **Conversation sourceIds snapshot** - conversation stores sourceIds at creation, uses same sources for all messages
- [ ] **Source changes mid-conversation** - existing conversations keep original sources, new conversations get updated list
- [ ] Re-ingestion of file updates vectors in place (same namespace, same sourceId)
- [ ] Deleting chatbot removes Chatbot_Source links (cascade)
- [ ] Deleting source removes Chatbot_Source links AND vectors from Pinecone
- [ ] **Orphaned source cleanup** - migration doesn't leave sources with no links
- [ ] **Legacy conversations** - conversations created before migration (no sourceIds field) handled gracefully
- [ ] **Legacy conversation fallback** - live lookup from Chatbot_Source works when sourceIds is empty
- [ ] **Legacy conversation backfill** - sourceIds populated on legacy conversation after first message

---

## Rollback Plan

If issues arise:

1. **Phase 1 rollback:** Drop Chatbot_Source table (no data loss, original chatbotId still on Source)
2. **Phase 2 rollback:** Revert code changes, queries still work with chatbotId
3. **Phase 2.5 rollback:** Revert Phase 2 code to query old `chatbot-*` namespaces (old vectors still exist until explicitly deleted)
4. **Phase 3 rollback:** Re-add chatbotId column, populate from Chatbot_Source

**Key:** Don't remove `Source.chatbotId` until Phase 2.5 is fully tested and stable. Don't delete old Pinecone namespaces until new namespaces are verified working.

---

## Future Considerations

### Source Management UI
Currently there's no UI for managing sources. Post-migration, consider adding:
- Source library view (all creator's sources)
- Link/unlink sources to chatbots
- Source usage analytics across chatbots

### Chunk Performance
`Chunk_Performance` has its own `chatbotId` field. This is correct because:
- Performance metrics should be per-chatbot (same chunk may perform differently in different contexts)
- No changes needed to this model

---

## Implementation Status (2026-02-05)

### ✅ Phase 1: Schema Migration - COMPLETE

**Changes Made:**
- Added `Chatbot_Source` junction table to `prisma/schema.prisma`
- Made `Source.chatbotId` optional (nullable) - kept for backwards compatibility during migration
- Added `chatbots` relation to Source model pointing to `Chatbot_Source[]`
- Added `linkedSources` relation to Chatbot model pointing to `Chatbot_Source[]`
- Added `sourceIds` field to Conversation model for snapshotting allowed sources
- Ran `prisma db push` to apply schema changes
- Migrated existing data: Populated `Chatbot_Source` from existing `Source.chatbotId` values

**Files Changed:**
- `prisma/schema.prisma`

### ✅ Phase 2: Code Updates - COMPLETE

**Changes Made:**

1. **`lib/pinecone/upsert-with-retry.ts`**
   - Changed parameter name from `chatbotId` to `creatorId`
   - Updated namespace prefix from `chatbot-` to `creator-`
   - Updated JSDoc documentation

2. **`app/api/ingestion/trigger/route.ts`**
   - Removed `chatbot` include from file query (no longer needed)
   - Removed chatbot validation (source can exist without direct chatbot link)
   - Changed `upsertWithRetry` call to use `file.source.creatorId` instead of `file.source.chatbot.id`

3. **`app/api/chat/route.ts`**
   - Added `conversationSourceIds` variable to track allowed sources
   - **New conversation creation:** Fetch `sourceIds` from `Chatbot_Source` and store on conversation
   - **Existing conversation fetch:** Include `sourceIds` and handle legacy fallback (backfill if empty)
   - Changed RAG namespace from `chatbot-${chatbotId}` to `creator-${chatbot.creatorId}`
   - Added `sourceId` filter to `queryRAG` call: `filter: { sourceId: { $in: conversationSourceIds } }`
   - Handle empty sourceIds gracefully (skip RAG, use general knowledge)
   - Removed `chatbotId` filter from source title query (sourceIds already validated)

4. **`prisma/seed.ts`**
   - Removed `chatbotId` from Source creation
   - Added `Chatbot_Source.upsert` to link source to chatbot via junction table

### ✅ Phase 2.5: Pinecone Namespace Migration - COMPLETE

**Completed by user:** Files re-ingested to `creator-*` namespaces.

### ✅ Phase 3: Cleanup - COMPLETE

**Changes Made:**
- Removed `chatbotId` and `chatbot` fields from Source model
- Renamed `linkedSources` to `sources` on Chatbot model (cleaner API)
- Ran `prisma db push` to apply schema changes
- Fixed all code references to use junction table queries

**Files Updated for Junction Table Queries:**
- `app/api/chatbots/[chatbotId]/suggestion-pills/route.ts` - Query sources via `sources.source.title`
- `app/api/chatbots/[chatbotId]/welcome/route.ts` - Same pattern
- `app/api/conversations/[conversationId]/route.ts` - Same pattern
- `app/api/intake/completion/route.ts` - Same pattern
- `scripts/check-ingestion.ts` - Updated to use junction table and `creator-*` namespace
- `scripts/re-trigger-ingestion.ts` - Query files via `Chatbot_Source` sourceIds

---

## Migration Complete ✅

**Final Schema State:**
- `Source` model no longer has `chatbotId` - uses `Chatbot_Source` junction table
- `Chatbot.sources` now points to `Chatbot_Source[]` (many-to-many)
- `Conversation.sourceIds` stores snapshot of allowed sources at creation time

**Pinecone Namespace Scheme:**
- Namespace: `creator-{creatorId}` (all sources for a creator in one namespace)
- Filtering: `sourceId` metadata filter applied at query time
- Benefits: No vector duplication, flexible source-chatbot linking

**Rollback:** If issues arise, the original plan's rollback steps still apply. Old `chatbot-*` namespaces may still exist in Pinecone and can be queried by reverting code changes.

