# Refactor Intake_Response to Inherit Chatbot Associations from Questions

## Objective

Refactor `Intake_Response` model to remove `chatbotId` field and make responses dynamically inherit chatbot associations from their linked question via `Chatbot_Intake_Question` junction table. This fixes the TypeScript upsert error with nullable unique constraints and simplifies the data model.

## Acceptance Criteria

- [ ] `Intake_Response.chatbotId` field removed from schema
- [ ] Unique constraint changed from `@@unique([userId, intakeQuestionId, chatbotId])` to `@@unique([userId, intakeQuestionId])`
- [ ] Migration successfully removes `chatbotId` column and updates constraint
- [ ] API route `/api/intake/responses` uses upsert without chatbotId
- [ ] Responses dynamically apply to all chatbots linked to their question
- [ ] All queries that filter by chatbotId updated to use question associations
- [ ] User_Context sync logic updated to handle dynamic chatbot associations
- [ ] Tests updated and passing
- [ ] Cleanup script updated or deprecated

## Clarifying Questions

1. **User_Context sync behavior**: When `reusableAcrossFrameworks=true`, should we sync to global context (chatbotId=null) OR sync to all chatbots that have this question?
   - **Assumption**: Keep current behavior - sync to global if reusable, otherwise sync to chatbot-specific context

2. **DELETE endpoint**: Currently requires chatbotId - should we remove that requirement since responses aren't chatbot-specific anymore?
   - **Assumption**: Remove chatbotId requirement, delete by userId + questionSlug

3. **Existing data**: How to handle existing `Intake_Response` records with chatbotId?
   - **Assumption**: Migration will need to deduplicate - keep one response per userId+questionId, delete duplicates

## Assumptions Gate

Proceed with assumptions? (Yes / Edit / Answer questions)

**Proceeding with assumptions.**

## Minimal Approach

1. **Schema Migration**: Remove `chatbotId` from `Intake_Response`, update unique constraint
2. **API Route Updates**: Remove chatbotId from create/update logic, use simple upsert
3. **Query Updates**: Update any queries that filter by chatbotId to use question associations
4. **User_Context Logic**: Update sync logic to handle dynamic associations
5. **Data Migration**: Clean up existing duplicates before schema change

## Text Diagram

```
BEFORE:
┌─────────────────┐         ┌──────────────────┐
│ Intake_Question │◄──many──┤ Chatbot_Question │──many──►┌──────────┐
└─────────────────┘         └──────────────────┘          │ Chatbot  │
       │                                                      └──────────┘
       │ one
       ▼
┌─────────────────┐
│ Intake_Response │──one──►┌──────────┐ (chatbotId FK)
└─────────────────┘        │ Chatbot  │
                            └──────────┘

AFTER:
┌─────────────────┐         ┌──────────────────┐
│ Intake_Question │◄──many──┤ Chatbot_Question │──many──►┌──────────┐
└─────────────────┘         └──────────────────┘          │ Chatbot  │
       │                                                      └──────────┘
       │ one                                                         ▲
       ▼                                                             │
┌─────────────────┐                                                │
│ Intake_Response │─────────────────────────────────────────────────┘
└─────────────────┘         (inherits via question associations)
```

## Plan File Contents

### 1. Database Migration

**Migration Steps:**
1. Create migration to remove `chatbotId` column from `Intake_Response`
2. Update unique constraint from `@@unique([userId, intakeQuestionId, chatbotId])` to `@@unique([userId, intakeQuestionId])`
3. Remove foreign key relation to Chatbot
4. Handle existing data: deduplicate responses (keep most recent per userId+questionId)

**Migration SQL (proposed):**
```sql
-- Step 1: Deduplicate existing responses (keep most recent)
WITH ranked_responses AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "intakeQuestionId" 
      ORDER BY "updatedAt" DESC, "createdAt" DESC
    ) as rn
  FROM "Intake_Response"
)
DELETE FROM "Intake_Response"
WHERE id IN (
  SELECT id FROM ranked_responses WHERE rn > 1
);

-- Step 2: Drop old unique constraint
ALTER TABLE "Intake_Response" 
DROP CONSTRAINT IF EXISTS "Intake_Response_userId_intakeQuestionId_chatbotId_key";

-- Step 3: Drop foreign key constraint
ALTER TABLE "Intake_Response"
DROP CONSTRAINT IF EXISTS "Intake_Response_chatbotId_fkey";

-- Step 4: Drop chatbotId column
ALTER TABLE "Intake_Response"
DROP COLUMN IF EXISTS "chatbotId";

-- Step 5: Create new unique constraint
ALTER TABLE "Intake_Response"
ADD CONSTRAINT "Intake_Response_userId_intakeQuestionId_key" 
UNIQUE ("userId", "intakeQuestionId");
```

### 2. Schema Changes

**prisma/schema.prisma:**
```prisma
model Intake_Response {
  id                      String   @id @default(cuid())
  intakeQuestionId        String
  intakeQuestion         Intake_Question @relation(fields: [intakeQuestionId], references: [id], onDelete: Cascade)
  userId                  String
  user                    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  // chatbotId REMOVED - derived from question's associations
  fileId                  String?
  file                    File?    @relation("IntakeResponseFile", fields: [fileId], references: [id], onDelete: Cascade)
  value                   Json
  reusableAcrossFrameworks Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Updated unique constraint - no chatbotId
  @@unique([userId, intakeQuestionId])
  @@index([userId])
  @@index([intakeQuestionId])
}
```

**Chatbot model relation update:**
```prisma
model Chatbot {
  // ... existing fields ...
  // Remove: intakeResponses Intake_Response[] @relation("IntakeResponseChatbot")
  // Responses are now accessed via question associations
}
```

### 3. API Route Updates

**app/api/intake/responses/route.ts:**

**POST endpoint changes:**
- Remove `chatbotId` validation (step 6)
- Remove chatbot existence check (step 8) - keep association check
- Change from `create` to `upsert` with simple unique constraint
- Update User_Context sync logic to handle dynamic associations

**DELETE endpoint changes:**
- Remove `chatbotId` requirement from request body
- Delete by `userId` + `questionSlug` only
- Update User_Context deletion logic

**Proposed code structure:**
```typescript
// POST /api/intake/responses
export async function POST(request: Request) {
  // ... auth and validation ...
  
  // Verify question exists
  const question = await prisma.intake_Question.findUnique({
    where: { id: intakeQuestionId },
    select: { id: true, slug: true },
  });
  
  // Verify chatbot-question association (if chatbotId provided for context)
  // This is just validation - response isn't stored with chatbotId
  
  // Upsert response (no chatbotId!)
  const response = await prisma.intake_Response.upsert({
    where: {
      userId_intakeQuestionId: {
        userId: dbUserId,
        intakeQuestionId,
      },
    },
    create: {
      userId: dbUserId,
      intakeQuestionId,
      value,
      reusableAcrossFrameworks,
    },
    update: {
      value,
      reusableAcrossFrameworks,
      updatedAt: new Date(),
    },
  });
  
  // Sync to User_Context
  // If reusableAcrossFrameworks: sync to global (chatbotId=null)
  // Otherwise: sync to all chatbots that have this question
  if (reusableAcrossFrameworks) {
    // Global context
    await prisma.user_Context.upsert({ /* chatbotId: null */ });
  } else {
    // Find all chatbots with this question
    const chatbotAssociations = await prisma.chatbot_Intake_Question.findMany({
      where: { intakeQuestionId },
      select: { chatbotId: true },
    });
    
    // Sync to each chatbot
    for (const assoc of chatbotAssociations) {
      await prisma.user_Context.upsert({
        where: {
          userId_chatbotId_key: {
            userId: dbUserId,
            chatbotId: assoc.chatbotId,
            key: question.slug,
          },
        },
        create: { /* ... */ },
        update: { /* ... */ },
      });
    }
  }
}
```

### 4. Query Updates

**Files that may need updates:**
- `app/api/chat/route.ts` - queries responses for chatbot context
- `app/api/intake/completion/route.ts` - checks response completion
- `app/api/chatbots/[chatbotId]/welcome/route.ts` - welcome message logic
- `components/intake-flow.tsx` - frontend intake flow
- `hooks/use-conversational-intake.ts` - intake hook
- `lib/follow-up-pills/generate-pills.ts` - pill generation

**Query pattern change:**
```typescript
// OLD: Direct chatbotId filter
const responses = await prisma.intake_Response.findMany({
  where: {
    userId,
    chatbotId: chatbotId, // ❌ No longer exists
  },
});

// NEW: Via question associations
const chatbotQuestions = await prisma.chatbot_Intake_Question.findMany({
  where: { chatbotId },
  select: { intakeQuestionId: true },
});

const questionIds = chatbotQuestions.map(q => q.intakeQuestionId);

const responses = await prisma.intake_Response.findMany({
  where: {
    userId,
    intakeQuestionId: { in: questionIds },
  },
});
```

### 5. Cleanup Script

**scripts/cleanup-duplicate-intake-responses.ts:**
- Update to work with new schema (no chatbotId)
- Or deprecate if migration handles deduplication

## Work Plan

### Task 1: Data Migration & Schema Update
  - Subtask 1.1 — Create Prisma migration to remove chatbotId column
  - Subtask 1.2 — Add data deduplication SQL to migration
  - Subtask 1.3 — Update schema.prisma: remove chatbotId, update unique constraint
  - Subtask 1.4 — Update Chatbot model: remove intakeResponses relation
  - Visible output: Migration file created, schema updated

### Task 2: API Route Refactor
  - Subtask 2.1 — Update POST endpoint: remove chatbotId validation, use upsert
  - Subtask 2.2 — Update POST endpoint: sync User_Context to all associated chatbots
  - Subtask 2.3 — Update DELETE endpoint: remove chatbotId requirement
  - Subtask 2.4 — Update DELETE endpoint: delete User_Context for all chatbots
  - Visible output: route.ts updated, upsert working without chatbotId

### Task 3: Query Updates
  - Subtask 3.1 — Update chat route: query responses via question associations
  - Subtask 3.2 — Update intake completion route: check via question associations
  - Subtask 3.3 — Update welcome route: fetch responses via question associations
  - Subtask 3.4 — Update follow-up pills: query responses via question associations
  - Visible output: All queries updated to use question associations

### Task 4: Frontend & Hooks Updates
  - Subtask 4.1 — Update intake-flow.tsx: remove chatbotId from API calls
  - Subtask 4.2 — Update use-conversational-intake.ts: remove chatbotId logic
  - Subtask 4.3 — Update user-context-editor.tsx: handle dynamic associations
  - Visible output: Frontend works with new API structure

### Task 5: Tests & Cleanup
  - Subtask 5.1 — Update route.test.ts: remove chatbotId from test cases
  - Subtask 5.2 — Update use-conversational-intake.test.ts: update mocks
  - Subtask 5.3 — Update cleanup script or mark as deprecated
  - Subtask 5.4 — Run full test suite
  - Visible output: All tests passing

## Architectural Discipline

**File Health Check:**
- `app/api/intake/responses/route.ts`: Currently ~209 lines, will reduce to ~180 lines ✅
- No new files needed ✅
- No new dependencies ✅

**Design Rules:**
- Single Responsibility: Response storage separate from chatbot associations ✅
- Pattern Extraction: Query pattern for "responses for chatbot" can be extracted to utility ✅

## Risks & Edge Cases

1. **Race Condition**: User submits response while chatbot-question association is being added/removed
   - Mitigation: Association check happens before response creation

2. **Existing Data**: Duplicate responses with different chatbotIds
   - Mitigation: Migration deduplicates, keeping most recent

3. **User_Context Sync**: If question is removed from chatbot, User_Context entries remain
   - Mitigation: This is acceptable - User_Context can have orphaned entries, or add cleanup job

4. **Performance**: Querying responses via question associations adds a join
   - Mitigation: Add index on `chatbot_Intake_Question.chatbotId` (already exists)

5. **Backward Compatibility**: API consumers expecting chatbotId in response
   - Mitigation: Update API documentation, response format no longer includes chatbotId

## Tests

### Test 1: Upsert Without chatbotId
- **Input**: POST with userId, intakeQuestionId, value (no chatbotId)
- **Expected**: Response created/updated successfully
- **Assert**: `userId_intakeQuestionId` unique constraint works

### Test 2: Response Applies to Multiple Chatbots
- **Setup**: Question linked to Chatbot A and Chatbot B
- **Input**: Create response for question
- **Expected**: Response accessible when querying for Chatbot A or Chatbot B
- **Assert**: Query via question associations returns response

### Test 3: User_Context Sync to All Chatbots
- **Setup**: Question linked to Chatbot A and Chatbot B, reusableAcrossFrameworks=false
- **Input**: Create response
- **Expected**: User_Context entries created for both Chatbot A and Chatbot B
- **Assert**: Two User_Context records with same key, different chatbotIds

### Test 4: Duplicate Prevention
- **Input**: POST same userId + intakeQuestionId twice
- **Expected**: Second request updates existing response, doesn't create duplicate
- **Assert**: Only one response record exists

### Test 5: DELETE Without chatbotId
- **Input**: DELETE with userId + questionSlug (no chatbotId)
- **Expected**: Response deleted, User_Context entries for all chatbots deleted
- **Assert**: Response removed, User_Context cleaned up

## Approval Prompt

Approve the plan to proceed to BUILD? (Yes / Answer questions / Edit)
