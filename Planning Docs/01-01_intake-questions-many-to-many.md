# Intake Questions Many-to-Many Relationship

## 1. Objective

Convert the intake questions system from a one-to-many relationship (one question per chatbot) to a many-to-many relationship, enabling intake questions to be shared across multiple chatbots. This will reduce duplicate questions and allow creators to reuse common questions like "What is your role?" or "What industry are you in?" across different chatbots.

## 2. Acceptance Criteria

- [ ] Intake questions can be created independently (without requiring a chatbotId)
- [ ] Questions can be associated with multiple chatbots
- [ ] Each chatbot can have its own `displayOrder` and `isRequired` settings per question
- [ ] GET `/api/intake/questions?chatbotId=xxx` returns questions for that chatbot with correct ordering
- [ ] POST `/api/intake/questions` can create questions independently (without chatbot associations)
- [ ] New endpoint: POST `/api/intake/questions/[questionId]/chatbots` to associate/disassociate questions with chatbots
- [ ] Intake responses continue to work (responses sync to User_Context, which is editable in profile)
- [ ] All existing tests pass or are updated appropriately
- [ ] Database migration creates new structure (no data migration needed - no existing questions)

## 3. Clarifying Questions

1. **Question ownership**: Should questions have a `createdByUserId` field to track who created them, or remain creator-agnostic?
   - **Answer**: Yes. Good to keep a record of who created what, even if its not visible on the front end.

2. **Question uniqueness**: Should slugs be globally unique, or unique per creator?
   - **Answer**: Globally unique slugs.

3. **Migration strategy**: Should we migrate existing questions to the new structure automatically, or require manual re-association?
   - **Answer**: No existing questions exist. We can completely replace the old system since it was just created today with no usage.

4. **API design**: Should the POST endpoint create questions independently, or also handle associations?
   - **Answer**: POST `/api/intake/questions` creates questions independently only. Associations are handled separately via POST `/api/intake/questions/[questionId]/chatbots`. This provides clear separation of concerns.

5. **Display order per chatbot**: Should we allow different display orders for the same question across chatbots?
   - **Answer**: Yes - this is stored in the junction table.

6. **Response editing**: Are intake question responses still editable in profile settings?
   - **Answer**: Yes - responses sync to `User_Context` (with `isEditable: true`), and users can edit them via the `UserContextEditor` component in profile settings. The `Intake_Response` table is a record of submissions, but the editable data lives in `User_Context`.

## 4. Assumptions Gate

All questions answered. Proceeding with implementation.

## 5. Minimal Approach

1. **Database Schema Changes**:
   - Remove `chatbotId` from `Intake_Question` model
   - Remove `displayOrder` and `isRequired` from `Intake_Question` (move to junction table)
   - Create `Chatbot_Intake_Question` junction table with:
     - `chatbotId` (FK to Chatbot)
     - `intakeQuestionId` (FK to Intake_Question)
     - `displayOrder` (Int)
     - `isRequired` (Boolean)
   - Update unique constraint: `@@unique([intakeQuestionId, chatbotId])` on junction table
   - Update `slug` uniqueness: `@@unique([slug])` on Intake_Question (global uniqueness)

2. **Migration Script**:
   - Since there are no existing questions, we can create a clean migration:
     - Creates new `Chatbot_Intake_Question` table
     - Removes `chatbotId`, `displayOrder`, `isRequired` from `Intake_Question`
     - Updates unique constraint on `slug` to be globally unique
     - No data migration needed (no existing questions)

3. **API Updates**:
   - **GET `/api/intake/questions`**: Join through junction table to get questions for chatbot
   - **POST `/api/intake/questions`**: Create question independently (no chatbot associations)
   - **New: POST `/api/intake/questions/[questionId]/chatbots`**: Associate question with chatbot(s)
   - **New: DELETE `/api/intake/questions/[questionId]/chatbots`**: Remove association between question and chatbot
   - **New: PATCH `/api/intake/questions/[questionId]/chatbots`**: Update association (displayOrder, isRequired)
   - **POST `/api/intake/responses`**: Update to work with new structure (question no longer has chatbotId)

4. **Frontend Updates**:
   - `IntakeForm` component: No changes needed (still fetches by chatbotId)
   - Admin/creator UI: May need updates if there's a question management interface (not in scope for this change)

5. **Test Updates**:
   - Update all tests to use new junction table structure
   - Add tests for question sharing across multiple chatbots

## 6. Text Diagram

```
Before (One-to-Many):
┌─────────────┐
│   Chatbot   │
└──────┬──────┘
       │
       │ chatbotId (FK)
       │
┌──────▼──────────────┐
│ Intake_Question     │
│ - chatbotId (FK)    │
│ - slug              │
│ - displayOrder      │
│ - isRequired        │
└─────────────────────┘

After (Many-to-Many):
┌─────────────┐         ┌──────────────────────────────┐         ┌─────────────┐
│   Chatbot   │◄────────┤ Chatbot_Intake_Question       │────────►│ Intake_     │
└─────────────┘         │ - chatbotId (FK)              │         │ Question    │
                        │ - intakeQuestionId (FK)       │         │ - slug      │
                        │ - displayOrder               │         │ - question  │
                        │ - isRequired                 │         │   Text      │
                        └──────────────────────────────┘         │ - helperText│
                                                                   │ - response  │
                                                                   │   Type     │
                                                                   └────────────┘
```

## 7. Plan File Contents

### Database Schema Changes

**`prisma/schema.prisma`**:

```prisma
// Phase 3.10: Intake form models (Updated for many-to-many)
model Intake_Question {
  id           String            @id @default(cuid())
  slug         String            @unique // Global uniqueness
  questionText String
  helperText   String?
  responseType IntakeResponseType
  // Removed: chatbotId, displayOrder, isRequired (moved to junction table)

  // Relations
  chatbots     Chatbot_Intake_Question[]
  responses    Intake_Response[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Junction table for many-to-many relationship
model Chatbot_Intake_Question {
  id              String   @id @default(cuid())
  chatbotId       String
  chatbot         Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  intakeQuestionId String
  intakeQuestion  Intake_Question @relation(fields: [intakeQuestionId], references: [id], onDelete: Cascade)
  displayOrder    Int
  isRequired      Boolean  @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([intakeQuestionId, chatbotId])
  @@index([chatbotId])
  @@index([intakeQuestionId])
}

// Update Chatbot model relation
model Chatbot {
  // ... existing fields ...
  intakeQuestionAssociations Chatbot_Intake_Question[] // New relation
  // Remove: intakeQuestions Intake_Question[] // Old relation
}
```

### Migration Strategy

**Migration Steps** (No existing questions - clean replacement):
1. Create `Chatbot_Intake_Question` table
2. Add unique constraint on `slug` in `Intake_Question` (globally unique)
3. Remove `chatbotId`, `displayOrder`, `isRequired` columns from `Intake_Question`
4. Drop old unique constraint `@@unique([chatbotId, slug])`
5. Update `Chatbot` model relation (remove `intakeQuestions`, add `intakeQuestionAssociations`)

**Note**: Since there are no existing questions, no data migration is needed. We're completely replacing the old structure.

### API Route Changes

**`app/api/intake/questions/route.ts`**:

**GET endpoint changes**:
- Join through `Chatbot_Intake_Question` to get questions for chatbot
- Include `displayOrder` and `isRequired` from junction table in response
- Order by `displayOrder` from junction table

**POST endpoint changes**:
- Remove `chatbotId`, `displayOrder`, `isRequired` from request body
- Create question independently (no chatbot associations)
- Associations are handled separately via the association endpoint

**New endpoint**: `app/api/intake/questions/[questionId]/chatbots/route.ts`
- POST: Associate question with chatbot(s)
- DELETE: Remove association
- PATCH: Update `displayOrder` or `isRequired` for association

**`app/api/intake/responses/route.ts`**:
- Remove check for `question.chatbotId` (no longer exists)
- `chatbotId` is still required in request body (for User_Context sync)
- Verify chatbot is associated with question via junction table
- Return 400 error if association doesn't exist: "Question is not associated with this chatbot"

### API Request/Response Specifications

#### GET `/api/intake/questions?chatbotId=xxx`

**Response Format**:
```json
{
  "questions": [
    {
      "id": "question-123",
      "chatbotId": "chatbot-123",  // Included for context (matches query parameter)
      "slug": "role",
      "questionText": "What is your role?",
      "helperText": "Select your role",
      "responseType": "SELECT",
      "displayOrder": 1,  // From junction table
      "isRequired": true,  // From junction table
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST `/api/intake/questions`

**Purpose**: Create a new intake question independently. Questions are created without chatbot associations. Use the association endpoint to link questions to chatbots.

**Request Body Format**:
```json
{
  "slug": "role",
  "questionText": "What is your role?",
  "helperText": "Select your role",
  "responseType": "SELECT"
}
```

**Response Format**:
```json
{
  "question": {
    "id": "question-123",
    "slug": "role",
    "questionText": "What is your role?",
    "helperText": "Select your role",
    "responseType": "SELECT",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

**Error Responses**:
- `400`: Missing required fields: `slug`, `questionText`, `responseType`
- `400`: Invalid `responseType` enum value
- `409`: Question with this slug already exists (globally unique constraint)
- `500`: Failed to create intake question

#### POST `/api/intake/questions/[questionId]/chatbots`

**Purpose**: Associate an existing question with chatbot(s)

**Authorization**: User must be a member of the Creator that owns all chatbots being associated (via Creator_User relationship)

**Request Body**:
```json
{
  "chatbotAssociations": [
    {
      "chatbotId": "chatbot-123",
      "displayOrder": 1,
      "isRequired": true
    }
  ]
}
```

**Response Format**:
```json
{
  "associations": [
    {
      "id": "association-123",
      "chatbotId": "chatbot-123",
      "intakeQuestionId": "question-123",
      "displayOrder": 1,
      "isRequired": true,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**Error Responses**:
- `401`: Authentication required
- `404`: Question not found
- `404`: One or more chatbots not found
- `403`: User is not authorized (not a member of the Creator that owns the chatbot)
- `409`: Association already exists (unique constraint violation)

#### DELETE `/api/intake/questions/[questionId]/chatbots`

**Purpose**: Remove association between question and chatbot

**Authorization**: User must be a member of the Creator that owns the chatbot (via Creator_User relationship)

**Request Body**:
```json
{
  "chatbotId": "chatbot-123"
}
```

**Response Format**:
```json
{
  "message": "Association removed successfully"
}
```

**Error Responses**:
- `401`: Authentication required
- `404`: Question not found
- `404`: Chatbot not found
- `404`: Association not found
- `403`: User is not authorized (not a member of the Creator that owns the chatbot)

#### PATCH `/api/intake/questions/[questionId]/chatbots`

**Purpose**: Update `displayOrder` or `isRequired` for an existing association

**Authorization**: User must be a member of the Creator that owns the chatbot (via Creator_User relationship)

**Request Body**:
```json
{
  "chatbotId": "chatbot-123",
  "displayOrder": 2,  // Optional
  "isRequired": false  // Optional
}
```

**Response Format**:
```json
{
  "association": {
    "id": "association-123",
    "chatbotId": "chatbot-123",
    "intakeQuestionId": "question-123",
    "displayOrder": 2,
    "isRequired": false,
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

**Error Responses**:
- `401`: Authentication required
- `404`: Question not found
- `404`: Chatbot not found
- `404`: Association not found
- `403`: User is not authorized (not a member of the Creator that owns the chatbot)

#### POST `/api/intake/responses`

**Changes**:
- Remove check for `question.chatbotId` (no longer exists)
- Verify chatbot-question association exists via junction table
- Return `400` error if association doesn't exist: "Question is not associated with this chatbot"

**Request Body** (unchanged):
```json
{
  "userId": "user-123",
  "intakeQuestionId": "question-123",
  "chatbotId": "chatbot-123",
  "value": "Founder/CEO",
  "reusableAcrossFrameworks": false
}
```

**Error Responses**:
- `400`: Question is not associated with this chatbot
- `404`: Question not found
- `404`: Chatbot not found

### Error Handling Specification

**Error Codes and Messages**:

| Code | Message | When |
|------|---------|------|
| 400 | Missing required fields: `field1`, `field2` | Required fields missing in request |
| 400 | Invalid `responseType`. Must be one of: TEXT, NUMBER, SELECT, MULTI_SELECT, FILE, DATE, BOOLEAN | Invalid enum value |
| 400 | Question is not associated with this chatbot | Response submitted for question not associated with chatbot |
| 401 | Authentication required | User not authenticated |
| 403 | Unauthorized: You must be the chatbot creator | User not authorized to perform action |
| 404 | Question not found | Question ID doesn't exist |
| 404 | Chatbot not found | Chatbot ID doesn't exist |
| 404 | Association not found | Junction table entry doesn't exist |
| 409 | Question with this slug already exists | Duplicate slug (globally unique constraint) |
| 409 | Association already exists | Duplicate association (unique constraint violation) |
| 500 | Failed to create intake question | Unexpected server error |
| 500 | Failed to fetch intake questions | Unexpected server error |

**Authorization Rules**:
- **Creating questions**: Any authenticated user can create questions
- **Associating questions with chatbots**: User must be a member of the Creator that owns ALL chatbots being associated (via Creator_User relationship)
- **Removing/updating associations**: User must be a member of the Creator that owns the chatbot (via Creator_User relationship)
- **Submitting responses**: Any authenticated user can submit responses for questions associated with chatbots

### Frontend Component Changes

**`components/intake-form.tsx`**:
- No changes needed - still fetches by `chatbotId`
- Response format may include `displayOrder` and `isRequired` from junction table (but component already handles these)

### Test Updates

**`__tests__/api/intake/questions/route.test.ts`**:
- Update mocks to use junction table
- Add tests for:
  - Creating question independently (no chatbot associations)
  - Fetching questions through junction table
  - Question sharing across chatbots (via association endpoint)
  - Error: Duplicate slug (globally unique)
  - Error: Missing required fields
  - Error: Invalid responseType

**`__tests__/api/intake/questions/[questionId]/chatbots/route.test.ts`** (new test file):
- POST: Associate question with chatbot(s)
  - Success: Single association
  - Success: Multiple associations
  - Error: Question not found
  - Error: Chatbot not found
  - Error: Unauthorized (not a member of the Creator that owns the chatbot)
  - Error: Association already exists
- DELETE: Remove association
  - Success: Remove association
  - Error: Association not found
  - Error: Unauthorized
- PATCH: Update association
  - Success: Update displayOrder
  - Success: Update isRequired
  - Success: Update both
  - Error: Association not found
  - Error: Unauthorized

**`__tests__/api/intake/responses/route.test.ts`**:
- Update to verify chatbot-question association via junction table
- Remove checks for `question.chatbotId`
- Add test: Error when question not associated with chatbot (400)
- Add test: Success when association exists

## 8. Work Plan

### Task 1: Database Schema Update ✅ COMPLETE
**Subtask 1.1** — Update `prisma/schema.prisma`: ✅ COMPLETE
  - ✅ Removed `chatbotId`, `displayOrder`, `isRequired` from `Intake_Question`
  - ✅ Added `slug @unique` constraint (globally unique)
  - ✅ Created `Chatbot_Intake_Question` junction table model
  - ✅ Updated `Chatbot` model relations (removed old `intakeQuestions`, added `intakeQuestionAssociations`)
  - ✅ Added `createdByUserId` field to `Intake_Question` with relation to `User`
  - ✅ Updated `User` model to include `createdIntakeQuestions` relation
  - **Visible output**: ✅ Updated schema.prisma file

**Subtask 1.2** — Create migration file: ✅ COMPLETE
  - ✅ Generated clean migration (no data migration needed - no existing questions)
  - ✅ Created migration file: `prisma/migrations/20260112103644_intake_questions_many_to_many/migration.sql`
  - ✅ Migration includes:
    - Creation of `Chatbot_Intake_Question` junction table
    - Removal of `chatbotId`, `displayOrder`, `isRequired` columns from `Intake_Question`
    - Addition of `createdByUserId` column to `Intake_Question`
    - Removal of old unique constraint `@@unique([chatbotId, slug])`
    - Addition of new globally unique constraint on `slug`
    - All necessary indexes and foreign keys
  - **Visible output**: ✅ Migration file in `prisma/migrations/20260112103644_intake_questions_many_to_many/`

### Task 2: API Route Updates ✅ COMPLETE
**Subtask 2.1** — Update GET `/api/intake/questions`: ✅ COMPLETE
  - ✅ Modified query to join through `Chatbot_Intake_Question` junction table
  - ✅ Included `displayOrder` and `isRequired` from junction table in response
  - ✅ Response includes `chatbotId` for context (matches query parameter)
  - ✅ Orders questions by `displayOrder` from junction table
  - **Visible output**: ✅ Updated `app/api/intake/questions/route.ts` file

**Subtask 2.2** — Update POST `/api/intake/questions`: ✅ COMPLETE
  - ✅ Removed `chatbotId`, `displayOrder`, `isRequired` from request body
  - ✅ Creates question independently (no chatbot associations)
  - ✅ Added `createdByUserId` field (from authenticated user)
  - ✅ Updated error handling for globally unique slug constraint
  - ✅ Removed chatbot ownership check (questions are created independently)
  - **Visible output**: ✅ Updated `app/api/intake/questions/route.ts` file

**Subtask 2.3** — Create POST `/api/intake/questions/[questionId]/chatbots`: ✅ COMPLETE
  - ✅ New route file created: `app/api/intake/questions/[questionId]/chatbots/route.ts`
  - ✅ POST handler: Associates question with chatbot(s)
  - ✅ Validates user is member of Creator that owns all chatbots
  - ✅ Supports multiple associations in single request
  - ✅ Handles unique constraint violations (409 error)
  - **Visible output**: ✅ New route.ts file created

**Subtask 2.4** — Create DELETE `/api/intake/questions/[questionId]/chatbots`: ✅ COMPLETE
  - ✅ DELETE handler: Removes association between question and chatbot
  - ✅ Validates user is member of Creator that owns the chatbot
  - ✅ Verifies association exists before deletion
  - ✅ Returns appropriate error messages (404 for not found, 403 for unauthorized)
  - **Visible output**: ✅ Implemented in `app/api/intake/questions/[questionId]/chatbots/route.ts`

**Subtask 2.5** — Create PATCH `/api/intake/questions/[questionId]/chatbots`: ✅ COMPLETE
  - ✅ PATCH handler: Updates `displayOrder` or `isRequired` for existing association
  - ✅ Validates user is member of Creator that owns the chatbot
  - ✅ Supports partial updates (either field can be updated independently)
  - ✅ Verifies association exists before update
  - **Visible output**: ✅ Implemented in `app/api/intake/questions/[questionId]/chatbots/route.ts`

**Subtask 2.6** — Update POST `/api/intake/responses`: ✅ COMPLETE
  - ✅ Removed check for `question.chatbotId` (no longer exists)
  - ✅ Added validation that `chatbotId` is required in request body
  - ✅ Verifies chatbot-question association exists via junction table
  - ✅ Returns 400 error if association doesn't exist: "Question is not associated with this chatbot"
  - ✅ Verifies chatbot exists before checking association
  - **Visible output**: ✅ Updated `app/api/intake/responses/route.ts` file

### Task 3: Test Updates ✅ COMPLETE
**Subtask 3.1** — Update intake questions tests: ✅ COMPLETE
  - ✅ Updated mocks to include `chatbot_Intake_Question` junction table
  - ✅ Updated GET tests to use `chatbot_Intake_Question.findMany` instead of `intake_Question.findMany`
  - ✅ Updated POST tests to remove `chatbotId`, `displayOrder`, `isRequired` from request body
  - ✅ Removed chatbot ownership checks from POST tests (questions created independently)
  - ✅ Updated error handling tests for globally unique slug constraint
  - ✅ Added test for question sharing across chatbots with different display orders
  - **Visible output**: ✅ Updated `__tests__/api/intake/questions/route.test.ts` file

**Subtask 3.2** — Update intake responses tests: ✅ COMPLETE
  - ✅ Updated mocks to include `chatbot` and `chatbot_Intake_Question` models
  - ✅ Added test for missing `chatbotId` validation (now required)
  - ✅ Added test for chatbot not found (404)
  - ✅ Added test for question not associated with chatbot (400 error)
  - ✅ Updated success test to verify association via junction table
  - ✅ Removed test for using question's chatbotId (no longer applicable)
  - ✅ Updated all tests to verify `chatbot_Intake_Question.findUnique` is called
  - **Visible output**: ✅ Updated `__tests__/api/intake/responses/route.test.ts` file

**Subtask 3.3** — Create tests for association route: ✅ COMPLETE
  - ✅ Created new test file: `__tests__/api/intake/questions/[questionId]/chatbots/route.test.ts`
  - ✅ POST tests: Authentication, question not found, chatbot not found, unauthorized, success, multiple associations, duplicate association
  - ✅ DELETE tests: Authentication, question not found, chatbot not found, association not found, unauthorized, success
  - ✅ PATCH tests: Authentication, missing fields, update displayOrder, update isRequired, update both, unauthorized
  - ✅ All tests verify proper authorization (user must be member of Creator)
  - **Visible output**: ✅ New test file `__tests__/api/intake/questions/[questionId]/chatbots/route.test.ts` created

### Task 4: Verification
**Subtask 4.1** — Manual testing:
  - Create question without chatbot
  - Associate question with multiple chatbots
  - Verify display order per chatbot
  - Submit responses and verify User_Context sync
  - **Visible output**: Manual test checklist completed

## 9. Architectural Discipline

**File Health Check**:
- `app/api/intake/questions/route.ts`: Currently ~224 lines, may grow to ~300 lines with new logic (within limit)
- New file: `app/api/intake/questions/[questionId]/chatbots/route.ts`: Estimated ~150 lines (within limit)
- `app/api/intake/responses/route.ts`: Currently ~177 lines, minimal changes (within limit)

**Single Responsibility**: 
- Questions are now independent entities
- Junction table handles chatbot-specific configuration
- Clear separation of concerns

**No Over-Engineering**:
- Simple many-to-many pattern
- No unnecessary abstractions
- Reuse existing Prisma patterns

## 10. Risks & Edge Cases

1. **No Data Migration Risk**: No existing questions, so clean migration

2. **GET Response Format**: GET endpoint includes `chatbotId` in response for context (matches the query parameter used to fetch questions)

3. **Orphaned Questions**: Questions not associated with any chatbot
   - **Mitigation**: Allow this - questions can exist independently (useful for templates)

4. **Display Order Conflicts**: Same question with different orders per chatbot
   - **Mitigation**: This is expected behavior - handled by junction table

5. **Response Validation**: Responses need chatbotId but question doesn't have it
   - **Mitigation**: Verify chatbot-question association exists via junction table before accepting response

6. **Response Editing**: Users can edit responses in profile settings via User_Context
   - **Note**: This functionality remains unchanged - responses sync to User_Context which is editable

## 11. Tests

### Test 1: Create Question Independently
**Input**: POST `/api/intake/questions` with `{ slug: "role", questionText: "What is your role?", responseType: "SELECT" }`
**Expected Output**: Question created successfully with no chatbot associations

### Test 2: Fetch Questions for Chatbot
**Input**: GET `/api/intake/questions?chatbotId=chatbot-1`
**Expected Output**: Questions associated with chatbot-1, ordered by displayOrder from junction table

### Test 3: Share Question Across Chatbots
**Input**: 
1. Create question Q1 via POST `/api/intake/questions`
2. Associate Q1 with chatbot-1 via POST `/api/intake/questions/Q1/chatbots` (displayOrder: 1)
3. Associate Q1 with chatbot-2 via POST `/api/intake/questions/Q1/chatbots` (displayOrder: 2)
**Expected Output**: Both chatbots can fetch Q1 with their respective display orders

### Test 4: Submit Response with Shared Question
**Input**: POST `/api/intake/responses` with `{ intakeQuestionId: "q1", chatbotId: "chatbot-1", value: "..." }`
**Expected Output**: Response created, User_Context synced to chatbot-1 context

### Test 5: Submit Response with Non-Associated Question
**Input**: POST `/api/intake/responses` with `{ intakeQuestionId: "q1", chatbotId: "chatbot-2", value: "..." }` (where q1 is not associated with chatbot-2)
**Expected Output**: 400 error - "Question is not associated with this chatbot"

### Test 6: Associate Question via POST `/api/intake/questions/[questionId]/chatbots`
**Input**: POST `/api/intake/questions/q1/chatbots` with `{ chatbotAssociations: [{ chatbotId: "chatbot-1", displayOrder: 1, isRequired: true }] }`
**Expected Output**: Association created successfully

### Test 7: Remove Association via DELETE
**Input**: DELETE `/api/intake/questions/q1/chatbots` with `{ chatbotId: "chatbot-1" }`
**Expected Output**: Association removed successfully

### Test 8: Update Association via PATCH
**Input**: PATCH `/api/intake/questions/q1/chatbots` with `{ chatbotId: "chatbot-1", displayOrder: 3, isRequired: false }`
**Expected Output**: Association updated with new displayOrder and isRequired

## 12. Approval Prompt

Approve the plan to proceed to BUILD? (Yes / Answer questions / Edit)

