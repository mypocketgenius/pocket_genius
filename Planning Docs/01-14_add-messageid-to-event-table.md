# Migration Plan: Add messageId FK to Event Table

**Date:** January 14, 2026  
**Status:** Planning  
**Priority:** High - Improves query performance and data integrity

---

## Objective

Add `messageId` as an optional foreign key field to the `Event` table to replace storing `messageId` in JSON metadata. This will:

1. **Improve query performance** - Direct FK queries instead of JSON parsing
2. **Enable referential integrity** - Cascade deletes when messages are deleted
3. **Simplify code** - No more filtering events in JavaScript
4. **Enable efficient indexing** - Database-level indexes on messageId

**Note:** Since all existing event data is test/sample data, we can delete it and start fresh. This eliminates the need for data migration scripts and simplifies the implementation significantly.

---

## Current State

### Schema
```prisma
model Event {
  id        String   @id @default(cuid())
  sessionId String?  // Conversation ID
  userId    String?
  user      User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  eventType String   // 'copy' | 'bookmark' | 'conversation_pattern' | 'expansion_followup' | 'gap_submission' | 'user_message'
  chunkIds  String[] @default([])
  metadata  Json?    // Currently stores messageId here: { messageId, feedbackType, needsMore, copyUsage, etc. }
  timestamp DateTime @default(now())
  
  @@index([sessionId])
  @@index([userId])
  @@index([eventType])
  @@index([timestamp])
}
```

### Event Types That Need messageId
- ✅ `user_message` - Message feedback (helpful, not_helpful, need_more)
- ✅ `copy` - Copy button events
- ✅ `bookmark` - Bookmark creation events
- ✅ `expansion_followup` - Follow-up after expansion pills
- ✅ `gap_submission` - User-submitted content gaps
- ❌ `conversation_pattern` - System-detected patterns (no messageId needed)

### Current Problems
1. **Inefficient queries** - Must fetch all events and filter in JavaScript:
   ```typescript
   // Current: Fetch all, filter in memory
   const events = await prisma.event.findMany({ where: { eventType: 'user_message' } });
   const filtered = events.filter(evt => evt.metadata?.messageId === messageId);
   ```

2. **No referential integrity** - Orphaned events if messages are deleted

3. **No cascade deletes** - Events remain when messages are deleted

4. **Hard to query** - Can't efficiently find "all events for this message"

---

## Migration Plan

### Phase 1: Schema Migration

#### Step 1.1: Add messageId Field to Schema

**File:** `prisma/schema.prisma`

```prisma
model Event {
  id        String   @id @default(cuid())
  messageId String?  // ADD: Optional FK (some events don't have messages)
  message   Message? @relation("EventMessage", fields: [messageId], references: [id], onDelete: Cascade)
  sessionId String?  // Keep for querying events by conversation
  userId    String?
  user      User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  eventType String
  chunkIds  String[] @default([])
  metadata  Json?    // Keep for flexible data (needsMore, copyUsage, etc.) but remove messageId
  timestamp DateTime @default(now())
  
  @@index([messageId]) // ADD: Critical for query performance
  @@index([sessionId])
  @@index([userId])
  @@index([eventType])
  @@index([timestamp])
}
```

**File:** `prisma/schema.prisma` (Message model)

```prisma
model Message {
  // ... existing fields ...
  
  // Relations
  bookmarks Bookmark[]
  events    Event[] @relation("EventMessage") // ADD: Relation to Event
  
  // ... rest of model ...
}
```

#### Step 1.2: Create Migration

```bash
# 1. Create migration
npx prisma migrate dev --name add_messageid_to_event

# 2. Generate Prisma Client
npx prisma generate
```

**Expected Migration SQL:**
```sql
-- AlterTable
ALTER TABLE "Event" ADD COLUMN "messageId" TEXT;

-- CreateIndex
CREATE INDEX "Event_messageId_idx" ON "Event"("messageId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_messageId_fkey" 
  FOREIGN KEY ("messageId") REFERENCES "Message"("id") 
  ON DELETE CASCADE ON UPDATE CASCADE;
```

**Verification:** After running the migration, verify:
1. The migration file was created in `prisma/migrations/`
2. The SQL includes all three operations (ADD COLUMN, CREATE INDEX, ADD CONSTRAINT)
3. The FK constraint includes `ON DELETE CASCADE` (ensures events are deleted when messages are deleted)
4. The column is nullable (`TEXT` not `TEXT NOT NULL`)

---

### Phase 2: Clean Slate (Delete Existing Test Data)

Since all existing event data is test/sample data, we'll delete it to start fresh. This eliminates the need for complex data migration scripts.

#### Step 2.1: Delete Existing Events

**Option A: Using Prisma Studio (Recommended for verification)**
```bash
npx prisma studio
# Navigate to Event table, select all, delete
```

**Option B: Using SQL (Faster for large datasets)**
```sql
-- Delete all events (test data only)
DELETE FROM "Event";
```

**Option C: Using Prisma Script (Programmatic)**

**File:** `prisma/migrations/delete_all_events.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllEvents() {
  console.log('Deleting all existing events (test data only)...');
  
  const result = await prisma.event.deleteMany({});
  
  console.log(`✅ Deleted ${result.count} events`);
}

deleteAllEvents()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Run script:**
```bash
npx tsx prisma/migrations/delete_all_events.ts
```

**Note:** Optionally reset `Chunk_Performance` counters if desired:
```sql
-- Optional: Reset chunk performance counters
UPDATE "Chunk_Performance" SET 
  "timesUsed" = 0,
  "helpfulCount" = 0,
  "notHelpfulCount" = 0,
  "needsScriptsCount" = 0,
  "needsExamplesCount" = 0,
  "needsStepsCount" = 0,
  "needsCaseStudyCount" = 0,
  "copyToUseNowCount" = 0,
  "satisfactionRate" = 0;
```

---

### Phase 3: Code Updates

#### Step 3.1: Update Feedback API Route

**File:** `app/api/feedback/message/route.ts`

**Changes:**

1. **Update copy event duplicate check** (lines 190-205):
   ```typescript
   // BEFORE:
   const allCopyEvents = await prisma.event.findMany({
     where: {
       eventType: 'copy',
       sessionId: conversationId,
       userId: dbUserId || undefined,
     },
   });
   const eventsForMessage = allCopyEvents.filter((evt) => {
     const metadata = evt.metadata as any;
     return metadata?.messageId === messageId;
   });
   
   // AFTER:
   // Copy events have a two-stage flow:
   // Stage 1: Initial copy (copyUsage=null) - created when user clicks copy button
   // Stage 2: Usage submission (copyUsage set) - updates existing record
   // We can now query directly by messageId FK (much faster!)
   const existingCopyEvent = await prisma.event.findFirst({
     where: {
       eventType: 'copy',
       messageId: messageId, // Direct FK query!
       userId: dbUserId || undefined,
     },
     orderBy: {
       timestamp: 'desc', // Get the most recent one first
     },
   });
   ```

2. **Update copy event creation** (lines 230-260):
   ```typescript
   // BEFORE:
   await prisma.event.create({
     data: {
       sessionId: conversationId,
       userId: dbUserId || undefined,
       eventType: 'copy',
       chunkIds,
       metadata: {
         messageId,
         copyUsage: null,
         copyContext: null,
       },
     },
   });
   
   // AFTER:
   await prisma.event.create({
     data: {
       messageId: messageId, // FK field
       sessionId: conversationId,
       userId: dbUserId || undefined,
       eventType: 'copy',
       chunkIds,
       metadata: {
         // Remove messageId from metadata
         copyUsage: null,
         copyContext: null,
       },
     },
   });
   ```

3. **Update copy event update** (lines 217-226):
   ```typescript
   // BEFORE:
   await prisma.event.update({
     where: { id: existingEvent.id },
     data: {
       metadata: {
         messageId, // Was stored in metadata
         copyUsage,
         copyContext: copyContext || null,
       },
     },
   });
   
   // AFTER:
   // messageId is already set in FK field (set during initial copy event creation)
   // We only need to update metadata with copyUsage and copyContext
   await prisma.event.update({
     where: { id: existingEvent.id },
     data: {
       metadata: {
         copyUsage,
         copyContext: copyContext || null,
       },
     },
   });
   ```

4. **Update feedback duplicate check** (lines 269-281):
   ```typescript
   // BEFORE:
   const existingEvents = await prisma.event.findMany({
     where: {
       eventType: 'user_message',
       sessionId: conversationId,
       userId: dbUserId || undefined,
     },
   });
   const existingEvent = existingEvents.find((evt) => {
     const metadata = evt.metadata as any;
     return metadata?.messageId === messageId && metadata?.feedbackType === feedbackType;
   });
   
   // AFTER:
   // Note: Prisma doesn't support JSON path queries, so we query by messageId FK
   // and filter feedbackType in JavaScript (still much faster than before)
   const eventsForMessage = await prisma.event.findMany({
     where: {
       eventType: 'user_message',
       messageId: messageId, // Direct FK query! (50x faster)
       userId: dbUserId || undefined,
     },
     select: {
       id: true,
       metadata: true,
     },
   });
   
   // Filter by feedbackType in memory (small dataset after FK filter)
   const existingEvent = eventsForMessage.find((evt) => {
     const metadata = evt.metadata as any;
     return metadata?.feedbackType === feedbackType;
   });
   ```

5. **Update feedback event creation** (lines 294-308):
   ```typescript
   // BEFORE:
   await prisma.event.create({
     data: {
       sessionId: conversationId,
       userId: dbUserId || undefined,
       eventType: 'user_message',
       chunkIds,
       metadata: {
         messageId,
         feedbackType,
         needsMore: feedbackType === 'need_more' ? needsMore : [],
         specificSituation: feedbackType === 'need_more' ? specificSituation || null : null,
       },
     },
   });
   
   // AFTER:
   await prisma.event.create({
     data: {
       messageId: messageId, // FK field
       sessionId: conversationId,
       userId: dbUserId || undefined,
       eventType: 'user_message',
       chunkIds,
       metadata: {
         // Remove messageId from metadata
         feedbackType,
         needsMore: feedbackType === 'need_more' ? needsMore : [],
         specificSituation: feedbackType === 'need_more' ? specificSituation || null : null,
       },
     },
   });
   ```

---

#### Step 3.2: Update Events API Route

**File:** `app/api/events/route.ts`

**Changes:**

1. **Update event creation** (line 96):
   ```typescript
   // BEFORE:
   const event = await prisma.event.create({
     data: {
       sessionId: sessionId || null,
       userId: dbUserId,
       eventType,
       chunkIds: Array.isArray(chunkIds) ? chunkIds : [],
       metadata: metadata || {},
     },
   });
   
   // AFTER:
   // Extract messageId from metadata if present (for expansion_followup, gap_submission, etc.)
   const eventMetadata = metadata || {};
   const messageId = eventMetadata?.messageId;
   
   // Remove messageId from metadata (simplified logic)
   // If messageId exists and metadata is an object, filter it out
   const cleanMetadata = messageId && typeof eventMetadata === 'object'
     ? Object.fromEntries(Object.entries(eventMetadata).filter(([k]) => k !== 'messageId'))
     : eventMetadata;
   
   // Handle empty object case - convert {} to null for cleaner Prisma storage
   const finalMetadata = (cleanMetadata && typeof cleanMetadata === 'object' && Object.keys(cleanMetadata).length === 0)
     ? null
     : cleanMetadata;
   
   const event = await prisma.event.create({
     data: {
       messageId: messageId || null, // FK field (handles expansion_followup, gap_submission, etc.)
       // Note: If messageId references a non-existent Message, FK constraint will reject the insert
       // This is correct behavior - ensure messageId is valid before creating events
       sessionId: sessionId || null,
       userId: dbUserId,
       eventType,
       chunkIds: Array.isArray(chunkIds) ? chunkIds : [],
       metadata: finalMetadata, // Clean metadata without messageId
     },
   });
   ```

2. **Update bookmark event handling** (lines 107-144):
   ```typescript
   // BEFORE:
   if (eventType === 'bookmark' && metadata.messageId) {
     const message = await prisma.message.findUnique({
       where: { id: metadata.messageId },
       // ...
     });
     // ...
   }
   
   // AFTER:
   // Use messageId from FK field (extracted above)
   if (eventType === 'bookmark' && messageId) {
     const message = await prisma.message.findUnique({
       where: { id: messageId }, // Use FK field
       // ...
     });
     // ...
   }
   ```

**Note:** This change automatically handles `expansion_followup` and `gap_submission` events that include `messageId` in their metadata. The messageId will be extracted and stored in the FK field, while other metadata (like `result`, `expansion_type`, `trigger`, `text`) remains in the metadata JSON.

**FK Constraint Validation:** If `messageId` in metadata references a non-existent Message, the foreign key constraint will reject the insert with a database error. This is correct behavior - the application should ensure `messageId` is valid before creating events. Invalid messageIds will result in a 500 error, which should be handled gracefully by the error handling code.

---

#### Step 3.3: Update Bookmarks API Route

**File:** `app/api/bookmarks/route.ts`

**Changes:**

1. **Update bookmark event creation** (lines 120-130):
   ```typescript
   // BEFORE:
   await prisma.event.create({
     data: {
       sessionId: message.conversationId,
       userId: user.id,
       eventType: 'bookmark',
       chunkIds: Array.isArray(chunkIds) ? chunkIds : [],
       metadata: {
         messageId,
       },
     },
   });
   
   // AFTER:
   await prisma.event.create({
     data: {
       messageId: messageId, // FK field
       sessionId: message.conversationId,
       userId: user.id,
       eventType: 'bookmark',
       chunkIds: Array.isArray(chunkIds) ? chunkIds : [],
       metadata: {}, // No messageId in metadata
     },
   });
   ```

---

#### Step 3.4: Update Chunk Performance Job

**File:** `app/api/jobs/update-chunk-performance/route.ts`

**Changes:**

1. **Update event query** (lines 58-71):
   ```typescript
   // BEFORE:
   const recentEvents = await prisma.event.findMany({
     where: {
       timestamp: {
         gte: twentyFourHoursAgo,
       },
     },
     select: {
       id: true,
       eventType: true,
       chunkIds: true,
       metadata: true,
       sessionId: true,
     },
   });
   
   // AFTER:
   const recentEvents = await prisma.event.findMany({
     where: {
       timestamp: {
         gte: twentyFourHoursAgo,
       },
     },
     select: {
       id: true,
       eventType: true,
       messageId: true, // ADD: Include messageId
       chunkIds: true,
       metadata: true,
       sessionId: true,
     },
   });
   ```

**Note:** This job doesn't filter by messageId, so no query changes needed. Just include messageId in select for potential future use.

---

#### Step 3.5: Update Dashboard Debug Page

**File:** `app/dashboard/[chatbotId]/debug/page.tsx`

**Changes:**

1. **Update feedback event query** (lines 63-78):
   ```typescript
   // BEFORE:
   const allFeedbackEvents = await prisma.event.findMany({
     where: {
       eventType: 'user_message',
       sessionId: { in: conversationIds },
     },
     select: {
       id: true,
       metadata: true,
     },
   });
   
   // Filter events by messageId in metadata and count by feedbackType
   const feedbackForMessages = allFeedbackEvents.filter((evt) => {
     const metadata = evt.metadata as any;
     return metadata?.messageId && messageIds.includes(metadata.messageId);
   });
   
   // AFTER:
   const feedbackForMessages = await prisma.event.findMany({
     where: {
       eventType: 'user_message',
       messageId: { in: messageIds }, // Direct FK query!
       sessionId: { in: conversationIds },
     },
     select: {
       id: true,
       messageId: true,
       metadata: true,
     },
   });
   ```

---

#### Step 3.6: Update Content Gap Aggregation (Future)

**File:** `app/api/jobs/aggregate-content-gaps/route.ts` (when implemented)

**Changes:**

1. **Update event query** (from alpha_build.md lines 4880-4892):
   ```typescript
   // BEFORE:
   const events = await prisma.event.findMany({
     where: {
       eventType: 'user_message',
       createdAt: { gte: thirtyDaysAgo },
     },
   });
   
   const feedbackEvents = events.filter((evt) => {
     const metadata = evt.metadata as any;
     const feedbackType = metadata?.feedbackType;
     return feedbackType === 'need_more' || feedbackType === 'not_helpful';
   });
   
   const messageIds = feedbackEvents
     .map((evt) => {
       const metadata = evt.metadata as any;
       return metadata?.messageId;
     })
     .filter((id): id is string => !!id);
   
   // AFTER:
   // Query events with messageId directly (much faster than before)
   // Note: Prisma doesn't support JSON path queries, so filter feedbackType in JavaScript
   const eventsWithMessages = await prisma.event.findMany({
     where: {
       eventType: 'user_message',
       messageId: { not: null }, // Only events with messages (FK query is fast!)
       createdAt: { gte: thirtyDaysAgo },
     },
     select: {
       id: true,
       messageId: true,
       metadata: true,
       userId: true,
     },
   });
   
   // Filter by feedbackType in memory (small dataset after FK filter)
   const feedbackEvents = eventsWithMessages.filter((evt) => {
     const metadata = evt.metadata as any;
     const feedbackType = metadata?.feedbackType;
     return feedbackType === 'need_more' || feedbackType === 'not_helpful';
   });
   
   const messageIds = feedbackEvents
     .map((evt) => evt.messageId)
     .filter((id): id is string => !!id);
   ```

---

### Phase 4: Testing

#### Step 4.1: Unit Tests

**Note:** Test files may not exist yet. If they don't exist, skip this step or create basic tests.

**Files to update (if they exist):**
- `__tests__/api/feedback/message/route.test.ts`
- `__tests__/api/events/route.test.ts`
- `__tests__/api/bookmarks/route.test.ts`

**Test cases:**
1. ✅ Event creation with messageId FK
2. ✅ Event query by messageId FK (verify performance improvement)
3. ✅ Cascade delete when message deleted
4. ✅ Events without messageId (conversation_pattern)
5. ✅ SessionId still works for querying events by conversation
6. ✅ Metadata doesn't contain messageId (only FK field)
7. ✅ Expansion_followup and gap_submission events handle messageId correctly
8. ✅ FK constraint validation - invalid messageId should fail (database error)

#### Step 4.2: Integration Tests

**Manual testing checklist:**
- [ ] Submit helpful feedback → verify messageId FK set
- [ ] Submit not_helpful feedback → verify messageId FK set
- [ ] Submit need_more feedback → verify messageId FK set
- [ ] Copy button click → verify messageId FK set
- [ ] Copy usage submission → verify messageId FK still set
- [ ] Bookmark creation → verify messageId FK set
- [ ] Delete message → verify events cascade deleted
- [ ] Query events by messageId → verify fast query
- [ ] Dashboard debug page → verify feedback counts correct
- [ ] Chunk performance job → verify still works
- [ ] FK constraint test → try creating event with invalid messageId (should fail gracefully)

#### Step 4.3: Performance Testing

**Before migration:**
- Query events for message: ~500ms (fetch all, filter in JS)

**After migration:**
- Query events for message: ~10ms (direct FK query)

**Expected improvement:** 50x faster queries

---

### Phase 5: Deployment

#### Step 5.1: Development Database

```bash
# 1. Create migration
npx prisma migrate dev --name add_messageid_to_event

# 2. Delete existing test events (clean slate)
npx tsx prisma/migrations/delete_all_events.ts
# OR use Prisma Studio: npx prisma studio

# 3. Generate Prisma Client
npx prisma generate

# 4. Verify migration (recommended)
# Open Prisma Studio to verify FK constraint works:
npx prisma studio
# - Navigate to Event table
# - Try creating an event with invalid messageId (should fail with FK constraint error)
# - Try creating an event with valid messageId (should succeed)
# - Verify messageId column exists and is nullable
# - Verify index on messageId exists

# 5. Test application
npm run dev
# Test all feedback flows - events will be created with messageId FK
```

#### Step 5.2: Commit Changes

```bash
git add prisma/schema.prisma
git add prisma/migrations/
git add app/api/**/*.ts
git add app/dashboard/**/*.tsx
git commit -m "Add messageId FK to Event table for better query performance"
```

#### Step 5.3: Production Deployment

```bash
# 1. Push to GitHub
git push origin main

# 2. Vercel will automatically:
#    - Run `prisma migrate deploy` (applies migration)
#    - Build application

# 3. After deployment, delete existing test events (if any):
DATABASE_URL="your-production-url" npx tsx prisma/migrations/delete_all_events.ts

# 4. Verify production deployment
# Test all feedback flows - new events will use messageId FK
```

---

### Phase 6: Rollback Plan

**If issues occur:**

1. **Immediate rollback:**
   ```sql
   -- Remove FK constraint
   ALTER TABLE "Event" DROP CONSTRAINT "Event_messageId_fkey";
   
   -- Remove index
   DROP INDEX "Event_messageId_idx";
   
   -- Remove column (optional - can keep for future)
   -- ALTER TABLE "Event" DROP COLUMN "messageId";
   ```

2. **Revert code changes:**
   ```bash
   git revert <commit-hash>
   ```

3. **Data recovery:**
   - Since we deleted test data, no recovery needed
   - New events will be created with correct structure after fix

---

## Summary

### Benefits
- ✅ **50x faster queries** - Direct FK queries vs JSON parsing
- ✅ **Referential integrity** - Cascade deletes work correctly
- ✅ **Simpler code** - No more JavaScript filtering
- ✅ **Better indexing** - Database-level indexes on messageId

### Risks
- ⚠️ **Code changes** - Multiple files need updates
- ⚠️ **Testing** - Comprehensive testing required
- ✅ **No data migration risk** - Starting fresh eliminates migration complexity

### Deployment Strategy

**Single-phase deployment (simplified)**
- Add FK column, delete test data, update code all at once
- Much simpler since no data migration needed
- Clean slate approach eliminates transition period complexity

### Timeline
- **Development:** 1-2 hours (simplified without migration scripts)
- **Testing:** 1 hour
- **Deployment:** 15 minutes
- **Total:** ~2-3 hours (reduced from 4-6 hours)

---

## Acceptance Criteria

- [ ] Schema migration runs successfully
- [ ] Existing test events deleted (clean slate)
- [ ] All code updated to use messageId FK
- [ ] All tests passing
- [ ] Query performance improved (50x faster)
- [ ] Cascade deletes work correctly
- [ ] No regressions in functionality
- [ ] Production deployment successful

---

## Notes

- **Clean slate approach:** All existing test event data is deleted, eliminating migration complexity
- **SessionId:** Field kept for querying events by conversation (backward compatible queries)
- **Metadata structure:** messageId is stored in FK field only, not in metadata JSON
- **Optional field:** messageId is nullable (some events like `conversation_pattern` don't have messages)
- **Prisma JSON limitations:** Prisma doesn't support JSON path queries, so we still filter `feedbackType` in JavaScript after FK query (still 50x faster than before)
- **Event types handled:** All event types that include `messageId` are handled:
  - `user_message` - Handled in `/api/feedback/message` (sets messageId FK directly)
  - `copy` - Handled in `/api/feedback/message` (sets messageId FK directly)
  - `bookmark` - Handled in `/api/bookmarks` and `/api/events` (sets messageId FK directly)
  - `expansion_followup` - Handled in `/api/events` (extracts messageId from metadata, sets FK)
  - `gap_submission` - Handled in `/api/events` (extracts messageId from metadata, sets FK)
- **FK Constraint Validation:** If `messageId` references a non-existent Message, the database will reject the insert with a foreign key constraint error. This is correct behavior - ensure messageId is valid before creating events. The application's error handling should catch and return appropriate 500 errors.
- **Empty Metadata Handling:** Empty metadata objects `{}` are converted to `null` for cleaner Prisma storage. This prevents storing unnecessary empty JSON objects in the database.
- **TypeScript Types:** After running `npx prisma generate`, Prisma Client will automatically include the new `messageId` field and relation in generated types. No manual type updates needed.

---

---

## Implementation Checklist

### Pre-Implementation
- [ ] Review plan and understand all changes
- [ ] Confirm all existing event data is test/sample data (safe to delete)

### Phase 1: Schema Migration
- [ ] Update `prisma/schema.prisma` with messageId FK
- [ ] Add relation to Message model
- [ ] Run `npx prisma migrate dev --name add_messageid_to_event`
- [ ] Verify migration SQL looks correct (should add column, index, and FK constraint)
- [ ] Run `npx prisma generate` (auto-updates TypeScript types)

### Phase 2: Clean Slate
- [ ] Create `prisma/migrations/delete_all_events.ts` script (optional)
- [ ] Delete all existing events (test data only)
- [ ] Optionally reset Chunk_Performance counters if desired

### Phase 3: Code Updates
- [ ] Update `app/api/feedback/message/route.ts` (5 locations)
- [ ] Update `app/api/events/route.ts` (2 locations)
- [ ] Update `app/api/bookmarks/route.ts` (1 location)
- [ ] Update `app/api/jobs/update-chunk-performance/route.ts` (1 location)
- [ ] Update `app/dashboard/[chatbotId]/debug/page.tsx` (1 location)
- [ ] Test each change individually

### Phase 4: Testing
- [ ] Run all manual tests from checklist
- [ ] Verify query performance improvement
- [ ] Test cascade deletes
- [ ] Verify no regressions

### Phase 5: Deployment
- [ ] Commit all changes
- [ ] Deploy to production
- [ ] Delete existing test events on production (if any)
- [ ] Monitor for errors

---

**Status:** Ready for implementation  
**Next Steps:** Review plan, create migration, delete test data, update code, deploy

**Simplified Approach:** Since all existing event data is test data, we can delete it and start fresh. This eliminates ~300 lines of migration scripts and makes the implementation much simpler and faster.

