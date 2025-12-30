# Short Bio/Description Fields for Cards

**Date**: 2024-12-30  
**Status**: ✅ COMPLETE

## Objective

Add separate `shortBio` and `shortDescription` fields to Creator and Chatbot models respectively. Cards will use these short fields, while detail pages/modals will continue using the full `bio` and `description` fields.

## Acceptance Criteria

- [x] `shortBio` field added to Creator model (nullable String)
- [x] `shortDescription` field added to Chatbot model (nullable String)
- [x] Database migration created and tested
- [x] CreatorCard component uses `shortBio` instead of truncating `bio`
- [x] ChatbotCard component uses `shortDescription` instead of truncating `description`
- [x] Creator page continues using full `bio` field
- [x] ChatbotDetailModal continues using full `description` field
- [x] API endpoints updated to return both short and long fields
- [x] PATCH /api/chatbots/[chatbotId] endpoint accepts `shortDescription` in request body (non-versioned field)
- [x] TypeScript types updated to include new fields
- [x] Existing data migration: if `shortBio`/`shortDescription` is null, fallback to truncated `bio`/`description` in cards

## Clarifying Questions

All questions answered:
1. ✅ Field names: `shortBio` for Creator, `shortDescription` for Chatbot
2. ✅ Both fields nullable (optional)
3. ✅ Cards use short fields, pages/modals use long fields
4. ✅ Migration strategy: add nullable fields, no data migration needed initially (cards can fallback)

## Assumptions Gate

Proceeding with assumptions:
- Short bio/description will be manually entered by creators (no auto-truncation)
- Cards will fallback to truncated long fields if short fields are null (backward compatibility)
- Field length limits: shortBio ~150 chars, shortDescription ~150 chars (database doesn't enforce, but UI will)
- No breaking changes to existing API contracts (adding fields, not removing)

## Minimal Approach

1. Update Prisma schema: add `shortBio` to Creator, `shortDescription` to Chatbot
2. Create and run migration
3. Update TypeScript types
4. Update API endpoints to return new fields
5. Update card components to use short fields with fallback
6. Verify pages/modals still use long fields

## Text Diagram

```
Database Schema Changes:
┌─────────────────────┐         ┌─────────────────────┐
│   Creator Model     │         │   Chatbot Model     │
├─────────────────────┤         ├─────────────────────┤
│ id                  │         │ id                  │
│ name                │         │ title               │
│ slug                │         │ slug                │
│ avatarUrl           │         │ description         │ ← Full (for pages)
│ bio                 │ ← Full  │ shortDescription    │ ← NEW (for cards)
│ shortBio            │ ← NEW   │ imageUrl            │
│ socialLinks         │         │ ...                 │
└─────────────────────┘         └─────────────────────┘

Component Usage:
┌─────────────────┐              ┌─────────────────┐
│  CreatorCard    │              │  ChatbotCard    │
│  Uses:          │              │  Uses:          │
│  - shortBio     │              │  - shortDesc    │
│  (fallback: bio)│              │  (fallback: desc)│
└─────────────────┘              └─────────────────┘
        │                                 │
        ▼                                 ▼
┌─────────────────┐              ┌─────────────────┐
│  Creator Page   │              │  Detail Modal   │
│  Uses:          │              │  Uses:          │
│  - bio          │              │  - description  │
└─────────────────┘              └─────────────────┘
```

## Plan File Contents

### 1. Prisma Schema Changes

**File**: `prisma/schema.prisma`

```prisma
model Creator {
  id          String   @id @default(cuid())
  name        String
  slug        String?  @unique
  avatarUrl   String?
  bio         String?  // Full bio for detail pages
  shortBio    String?  // Short bio for cards (~150 chars)
  socialLinks Json?
  createdAt   DateTime @default(now())
  // ... relations unchanged
}

model Chatbot {
  id               String  @id @default(cuid())
  title            String
  creatorId        String
  creator          Creator  @relation(fields: [creatorId], references: [id], onDelete: Cascade)
  slug             String?  @unique
  description      String?  // Full description for detail pages
  shortDescription String? // Short description for cards (~150 chars)
  imageUrl         String?
  // ... rest of fields unchanged
}
```

### 2. Migration Script

**File**: `prisma/migrations/add_short_bio_description/migration.sql`

```sql
-- Add shortBio to Creator table
ALTER TABLE "Creator" ADD COLUMN "shortBio" TEXT;

-- Add shortDescription to Chatbot table
ALTER TABLE "Chatbot" ADD COLUMN "shortDescription" TEXT;
```

**Command**: `npx prisma migrate dev --name add_short_bio_description`

### 3. TypeScript Type Updates

**File**: `lib/types/creator.ts`

```typescript
export interface Creator {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;        // Full bio
  shortBio: string | null;   // Short bio for cards
  chatbotCount: number;
}
```

**File**: `lib/types/chatbot.ts`

```typescript
export interface Chatbot {
  id: string;
  slug: string;
  title: string;
  description: string | null;        // Full description
  shortDescription: string | null;    // Short description for cards
  imageUrl: string | null;
  // ... rest unchanged
}
```

### 4. API Endpoint Updates

**File**: `app/api/creators/route.ts`

Update select to include `shortBio`:
```typescript
select: {
  id: true,
  slug: true,
  name: true,
  avatarUrl: true,
  bio: true,
  shortBio: true,  // ADD
  _count: { ... }
}
```

Update response transformation:
```typescript
const transformedCreators = creators.map(creator => ({
  id: creator.id,
  slug: creator.slug,
  name: creator.name,
  avatarUrl: creator.avatarUrl,
  bio: creator.bio,
  shortBio: creator.shortBio,  // ADD
  chatbotCount: creator._count.chatbots,
}));
```

**File**: `app/api/creators/[creatorSlug]/route.ts`

Update select to include `shortBio`:
```typescript
select: {
  id: true,
  slug: true,
  name: true,
  avatarUrl: true,
  bio: true,
  shortBio: true,  // ADD
  socialLinks: true,
}
```

**File**: `app/api/chatbots/public/route.ts`

Update response transformation to include `shortDescription`:
```typescript
return {
  id: chatbot.id,
  slug: chatbot.slug,
  title: chatbot.title,
  description: chatbot.description,
  shortDescription: chatbot.shortDescription,  // ADD
  imageUrl: chatbot.imageUrl,
  // ... rest unchanged
};
```

**File**: `app/api/chatbots/[chatbotId]/route.ts`

**Note**: This is a PATCH endpoint (not GET) used for updating chatbot configuration. Since it already handles `description` as a non-versioned field, we should also allow updating `shortDescription` via PATCH for consistency.

Update the PATCH handler to accept `shortDescription` in the request body:
```typescript
const {
  // ... existing fields ...
  description,
  shortDescription,  // ADD
  isPublic,
} = body;

// In nonVersionedUpdates:
if (shortDescription !== undefined) nonVersionedUpdates.shortDescription = shortDescription;
```

### 5. Component Updates

**File**: `components/creator-card.tsx`

Update interface:
```typescript
interface CreatorCardProps {
  creator: {
    id: string;
    slug: string;
    name: string;
    avatarUrl: string | null;
    bio: string | null;
    shortBio: string | null;  // ADD
    chatbotCount: number;
  };
}
```

Update truncateBio function to use shortBio with fallback:
```typescript
// Use shortBio if available, otherwise truncate bio
const getDisplayBio = () => {
  if (creator.shortBio) return creator.shortBio;
  if (!creator.bio) return null;
  if (creator.bio.length <= 100) return creator.bio;
  return creator.bio.substring(0, 100).trim() + '...';
};

// In JSX:
{getDisplayBio() && (
  <p className="text-sm text-gray-600 line-clamp-2 -mt-0.5">
    {getDisplayBio()}
  </p>
)}
```

**File**: `components/chatbot-card.tsx`

Update interface:
```typescript
interface ChatbotCardProps {
  chatbot: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    shortDescription: string | null;  // ADD
    imageUrl: string | null;
    // ... rest unchanged
  };
}
```

Update truncateDescription function:
```typescript
// Use shortDescription if available, otherwise truncate description
const getDisplayDescription = () => {
  if (chatbot.shortDescription) return chatbot.shortDescription;
  if (!chatbot.description) return null;
  if (chatbot.description.length <= 100) return chatbot.description;
  return chatbot.description.substring(0, 100).trim() + '...';
};

// In JSX:
{getDisplayDescription() && (
  <p className="text-sm text-gray-600 line-clamp-3">
    {getDisplayDescription()}
  </p>
)}
```

**File**: `components/chatbot-detail-modal.tsx`

No changes needed - continues using `description` field.

**File**: `app/creators/[creatorSlug]/page.tsx`

No changes needed - continues using `bio` field.

### 6. Verification Checklist

- [x] Migration runs successfully
- [x] CreatorCard displays shortBio (or truncated bio if null)
- [x] ChatbotCard displays shortDescription (or truncated description if null)
- [x] Creator page displays full bio
- [x] ChatbotDetailModal displays full description
- [x] API endpoints return both fields
- [x] TypeScript types compile without errors
- [x] No breaking changes to existing functionality

## Work Plan

**Task 1**: Database Schema & Migration
  - Subtask 1.1 — Update Prisma schema with new fields
  - Subtask 1.2 — Create migration file
  - Subtask 1.3 — Run migration
  - Visible output: Migration applied, schema.prisma updated

**Task 2**: TypeScript Types
  - Subtask 2.1 — Update Creator interface
  - Subtask 2.2 — Update Chatbot interface
  - Visible output: Types updated in lib/types/

**Task 3**: API Endpoints
  - Subtask 3.1 — Update /api/creators to return shortBio
  - Subtask 3.2 — Update /api/creators/[slug] to return shortBio
  - Subtask 3.3 — Update /api/chatbots/public to return shortDescription
  - Subtask 3.4 — Update /api/chatbots/[chatbotId] PATCH endpoint to accept shortDescription in request body
  - Visible output: All API endpoints return/accept new fields

**Task 4**: Component Updates
  - Subtask 4.1 — Update CreatorCard to use shortBio with fallback
  - Subtask 4.2 — Update ChatbotCard to use shortDescription with fallback
  - Subtask 4.3 — Verify Creator page still uses bio
  - Subtask 4.4 — Verify ChatbotDetailModal still uses description
  - Visible output: Cards use short fields, pages/modals use long fields

**Task 5**: Testing & Verification
  - Subtask 5.1 — Test with null short fields (fallback behavior)
  - Subtask 5.2 — Test with populated short fields
  - Subtask 5.3 — Verify no TypeScript errors
  - Subtask 5.4 — Verify API responses include new fields
  - Visible output: All tests pass, no errors

## Architectural Discipline

**File Health Check**:
- `prisma/schema.prisma`: ~459 lines → Adding 2 fields (within limits)
- `components/creator-card.tsx`: ~94 lines → Adding ~10 lines (within limits)
- `components/chatbot-card.tsx`: ~373 lines → Adding ~10 lines (within limits)
- API route files: All under 300 lines → Adding 1-2 lines each (within limits)

**Single Responsibility**: ✅
- Schema changes isolated to model definitions
- Component changes isolated to display logic
- API changes isolated to response formatting

**No Over-Engineering**: ✅
- Simple nullable fields
- Fallback logic in components (no new utilities)
- No abstractions or premature optimizations

## Risks & Edge Cases

1. **Existing Data**: Short fields will be null initially
   - **Mitigation**: Cards fallback to truncated long fields

2. **API Contract**: Adding fields shouldn't break existing clients
   - **Mitigation**: Fields are optional (nullable), backward compatible

3. **Type Safety**: TypeScript types must match API responses
   - **Mitigation**: Update types alongside API changes

4. **Migration Rollback**: If migration fails
   - **Mitigation**: Standard Prisma migration rollback process

5. **Null Handling**: Cards must handle null short fields gracefully
   - **Mitigation**: Fallback logic implemented in components

## Tests

**Test 1**: CreatorCard with null shortBio
- **Input**: Creator with `shortBio: null`, `bio: "Long bio text..."`
- **Expected**: Card displays truncated bio (~100 chars)

**Test 2**: CreatorCard with populated shortBio
- **Input**: Creator with `shortBio: "Short bio"`, `bio: "Long bio..."`
- **Expected**: Card displays shortBio exactly

**Test 3**: ChatbotCard with null shortDescription
- **Input**: Chatbot with `shortDescription: null`, `description: "Long description..."`
- **Expected**: Card displays truncated description (~100 chars)

**Test 4**: ChatbotCard with populated shortDescription
- **Input**: Chatbot with `shortDescription: "Short desc"`, `description: "Long description..."`
- **Expected**: Card displays shortDescription exactly

**Test 5**: Creator page uses full bio
- **Input**: Creator with both `bio` and `shortBio`
- **Expected**: Page displays full `bio`, not `shortBio`

**Test 6**: ChatbotDetailModal uses full description
- **Input**: Chatbot with both `description` and `shortDescription`
- **Expected**: Modal displays full `description`, not `shortDescription`

**Test 7**: API endpoints return both fields
- **Input**: GET /api/creators, GET /api/chatbots/public
- **Expected**: Response includes both `bio`/`shortBio` and `description`/`shortDescription`

## Approval Prompt

Approve the plan to proceed to BUILD? (Yes / Answer questions / Edit)

---

## Implementation Summary

**Status**: ✅ **COMPLETE** (2024-12-30)

**All Tasks Completed:**

✅ **Task 1**: Database Schema & Migration
- Added `shortBio` to Creator model
- Added `shortDescription` to Chatbot model
- Created and applied migration `20251230104405_add_short_bio_description`
- Prisma Client regenerated

✅ **Task 2**: TypeScript Types
- Updated `lib/types/creator.ts` with `shortBio` field
- Updated `lib/types/chatbot.ts` with `shortDescription` field

✅ **Task 3**: API Endpoints
- Updated `/api/creators` to return `shortBio`
- Updated `/api/creators/[creatorSlug]` to return `shortBio`
- Updated `/api/chatbots/public` to return `shortDescription`
- Updated `/api/chatbots/[chatbotId]` PATCH endpoint to accept `shortDescription`

✅ **Task 4**: Component Updates
- Updated `CreatorCard` to use `shortBio` with fallback to truncated `bio`
- Updated `ChatbotCard` to use `shortDescription` with fallback to truncated `description`
- Verified Creator page still uses full `bio`
- Verified ChatbotDetailModal still uses full `description`

✅ **Task 5**: Testing & Verification
- Updated test files to include new fields
- All API tests passing (5/5 creators, 18/18 chatbots public)
- No TypeScript compilation errors in source files
- No linting errors
- Fallback behavior verified

**Test Results:**
- ✅ Creators API tests: 5/5 passing
- ✅ Creators [slug] API tests: Updated and passing
- ✅ Chatbots public API tests: 18/18 passing
- ✅ All acceptance criteria met

**Files Modified:**
- `prisma/schema.prisma` - Added fields
- `prisma/migrations/20251230104405_add_short_bio_description/migration.sql` - Migration file
- `prisma/seed.ts` - Updated to populate shortBio and shortDescription for Sun Tzu and Art of War
- `lib/types/creator.ts` - Added shortBio
- `lib/types/chatbot.ts` - Added shortDescription
- `app/api/creators/route.ts` - Returns shortBio
- `app/api/creators/[creatorSlug]/route.ts` - Returns shortBio
- `app/api/chatbots/public/route.ts` - Returns shortDescription
- `app/api/chatbots/[chatbotId]/route.ts` - Accepts shortDescription
- `components/creator-card.tsx` - Uses shortBio with fallback
- `components/chatbot-card.tsx` - Uses shortDescription with fallback
- `__tests__/api/creators/route.test.ts` - Updated tests
- `__tests__/api/creators/[creatorSlug]/route.test.ts` - Updated tests
- `__tests__/api/chatbots/public/route.test.ts` - Updated tests

**Data Updates:**
- ✅ Sun Tzu creator: `shortBio` populated ("Ancient Chinese military strategist and philosopher")
- ✅ Art of War chatbot: `shortDescription` populated ("Explore timeless military strategy and philosophy with Sun Tzu")

**Implementation Notes:**
- Cards use short fields when available, fallback to truncated long fields
- Pages/modals continue using full fields as intended
- All changes are backward compatible (nullable fields)
- Migration applied successfully to database

