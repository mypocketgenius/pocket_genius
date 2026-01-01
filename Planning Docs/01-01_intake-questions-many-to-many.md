# Intake Questions Many-to-Many Relationship

## 1. Objective

Convert the intake questions system from a one-to-many relationship (one question per chatbot) to a many-to-many relationship, enabling intake questions to be shared across multiple chatbots. This will reduce duplicate questions and allow creators to reuse common questions like "What is your role?" or "What industry are you in?" across different chatbots.

## 2. Acceptance Criteria

- [ ] Intake questions can be created independently (without requiring a chatbotId)
- [ ] Questions can be associated with multiple chatbots
- [ ] Each chatbot can have its own `displayOrder` and `isRequired` settings per question
- [ ] GET `/api/intake/questions?chatbotId=xxx` returns questions for that chatbot with correct ordering
- [ ] POST `/api/intake/questions` can create questions and optionally associate them with chatbots
- [ ] New endpoint: POST `/api/intake/questions/[questionId]/chatbots` to associate/disassociate questions with chatbots
- [ ] Intake responses continue to work (responses sync to User_Context, which is editable in profile)
- [ ] All existing tests pass or are updated appropriately
- [ ] Database migration creates new structure (no data migration needed - no existing questions)

## 3. Clarifying Questions

1. **Question ownership**: Should questions have a `createdByUserId` field to track who created them, or remain creator-agnostic?
   - **Answer**: No creator ownership needed. Questions are linked to chatbots via the join table only.

2. **Question uniqueness**: Should slugs be globally unique, or unique per creator?
   - **Answer**: Globally unique slugs.

3. **Migration strategy**: Should we migrate existing questions to the new structure automatically, or require manual re-association?
   - **Answer**: No existing questions exist. We can completely replace the old system since it was just created today with no usage.

4. **API backward compatibility**: Should the POST endpoint still accept `chatbotId` for convenience, or require separate calls?
   - **Answer**: Since we're replacing the system entirely, we can design the new API cleanly. POST accepts optional `chatbotId` or `chatbotIds[]` for convenience - creates question and optionally associates it immediately.

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
   - **POST `/api/intake/questions`**: Create question independently, optionally associate with chatbot(s)
   - **New: POST `/api/intake/questions/[questionId]/chatbots`**: Associate/disassociate question with chatbots
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
- Make `chatbotId` optional
- Accept structured `chatbotAssociations[]` array for multiple associations
- Create question first, then create junction table entries
- Support backward compatibility: if `chatbotId` (singular) provided, treat as single association

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

**Response Format** (backward compatible):
```json
{
  "questions": [
    {
      "id": "question-123",
      "chatbotId": "chatbot-123",  // Included for backward compatibility
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

**Request Body Format** (Option 3 - Structured, preferred):

**Option A: Create question without associations**
```json
{
  "slug": "role",
  "questionText": "What is your role?",
  "helperText": "Select your role",
  "responseType": "SELECT"
}
```

**Option B: Create question with single chatbot (backward compatible)**
```json
{
  "slug": "role",
  "questionText": "What is your role?",
  "helperText": "Select your role",
  "responseType": "SELECT",
  "chatbotId": "chatbot-123",
  "displayOrder": 1,
  "isRequired": true
}
```

**Option C: Create question with multiple chatbots (preferred)**
```json
{
  "slug": "role",
  "questionText": "What is your role?",
  "helperText": "Select your role",
  "responseType": "SELECT",
  "chatbotAssociations": [
    {
      "chatbotId": "chatbot-123",
      "displayOrder": 1,
      "isRequired": true
    },
    {
      "chatbotId": "chatbot-456",
      "displayOrder": 2,
      "isRequired": false
    }
  ]
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
  },
  "associations": [
    {
      "id": "association-123",
      "chatbotId": "chatbot-123",
      "displayOrder": 1,
      "isRequired": true
    }
  ]
}
```

**Error Responses**:
- `400`: Missing required fields: `slug`, `questionText`, `responseType`
- `400`: Invalid `responseType` enum value
- `409`: Question with this slug already exists (globally unique constraint)
- `403`: User is not authorized to associate question with chatbot(s) (not chatbot owner)
- `404`: One or more chatbots not found

#### POST `/api/intake/questions/[questionId]/chatbots`

**Purpose**: Associate an existing question with chatbot(s)

**Authorization**: User must be owner of all chatbots being associated

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
- `403`: User is not authorized (not chatbot owner)
- `409`: Association already exists (unique constraint violation)

#### DELETE `/api/intake/questions/[questionId]/chatbots`

**Purpose**: Remove association between question and chatbot

**Authorization**: User must be owner of the chatbot

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
- `403`: User is not authorized (not chatbot owner)

#### PATCH `/api/intake/questions/[questionId]/chatbots`

**Purpose**: Update `displayOrder` or `isRequired` for an existing association

**Authorization**: User must be owner of the chatbot

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
- `403`: User is not authorized (not chatbot owner)

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
- **Associating questions with chatbots**: User must be owner of ALL chatbots being associated
- **Removing/updating associations**: User must be owner of the chatbot
- **Submitting responses**: Any authenticated user can submit responses for questions associated with chatbots

### Frontend Component Changes

**`components/intake-form.tsx`**:
- No changes needed - still fetches by `chatbotId`
- Response format may include `displayOrder` and `isRequired` from junction table (but component already handles these)

### Test Updates

**`__tests__/api/intake/questions/route.test.ts`**:
- Update mocks to use junction table
- Add tests for:
  - Creating question without chatbotId
  - Creating question with single chatbotId (backward compatible)
  - Creating question with chatbotAssociations array
  - Fetching questions through junction table
  - Question sharing across chatbots
  - Error: Duplicate slug (globally unique)
  - Error: Invalid chatbotId in associations
  - Error: Unauthorized association (not chatbot owner)

**`__tests__/api/intake/questions/[questionId]/chatbots/route.test.ts`** (new test file):
- POST: Associate question with chatbot(s)
  - Success: Single association
  - Success: Multiple associations
  - Error: Question not found
  - Error: Chatbot not found
  - Error: Unauthorized (not chatbot owner)
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

### Task 1: Database Schema Update
**Subtask 1.1** — Update `prisma/schema.prisma`:
  - Remove `chatbotId`, `displayOrder`, `isRequired` from `Intake_Question`
  - Add `slug @unique` constraint (globally unique)
  - Create `Chatbot_Intake_Question` junction table model
  - Update `Chatbot` model relations (remove old `intakeQuestions`, add `intakeQuestionAssociations`)
  - **Visible output**: Updated schema.prisma file

**Subtask 1.2** — Create migration file:
  - Generate clean migration (no data migration needed - no existing questions)
  - Test migration on development database
  - **Visible output**: Migration file in `prisma/migrations/`

### Task 2: API Route Updates
**Subtask 2.1** — Update GET `/api/intake/questions`:
  - Modify query to join through `Chatbot_Intake_Question`
  - Include `displayOrder` and `isRequired` from junction table
  - **Visible output**: Updated route.ts file, tests passing

**Subtask 2.2** — Update POST `/api/intake/questions`:
  - Make `chatbotId` optional
  - Add support for `chatbotIds[]` array
  - Create question first, then junction entries
  - **Visible output**: Updated route.ts file, tests passing

**Subtask 2.3** — Create POST `/api/intake/questions/[questionId]/chatbots`:
  - New route file for associating questions with chatbots
  - Support POST (associate) and DELETE (disassociate)
  - **Visible output**: New route.ts file, tests added

**Subtask 2.4** — Update POST `/api/intake/responses`:
  - Remove `question.chatbotId` check
  - Verify chatbot-question association via junction table
  - **Visible output**: Updated route.ts file, tests passing

### Task 3: Test Updates
**Subtask 3.1** — Update intake questions tests:
  - Update mocks for junction table
  - Add tests for question sharing
  - **Visible output**: All tests passing

**Subtask 3.2** — Update intake responses tests:
  - Update mocks and assertions
  - **Visible output**: All tests passing

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

2. **Backward Compatibility**: Existing API consumers expect `chatbotId` in question response
   - **Mitigation**: Include `chatbotId` in GET response for backward compatibility (can be removed later)

3. **Orphaned Questions**: Questions not associated with any chatbot
   - **Mitigation**: Allow this - questions can exist independently (useful for templates)

4. **Display Order Conflicts**: Same question with different orders per chatbot
   - **Mitigation**: This is expected behavior - handled by junction table

5. **Response Validation**: Responses need chatbotId but question doesn't have it
   - **Mitigation**: Verify chatbot-question association exists via junction table before accepting response

6. **Response Editing**: Users can edit responses in profile settings via User_Context
   - **Note**: This functionality remains unchanged - responses sync to User_Context which is editable

## 11. Tests

### Test 1: Create Question Without Chatbot
**Input**: POST `/api/intake/questions` with `{ slug: "role", questionText: "...", responseType: "SELECT" }` (no chatbotId)
**Expected Output**: Question created successfully, no chatbot associations

### Test 2: Create Question With Single Chatbot (Backward Compatible)
**Input**: POST `/api/intake/questions` with `{ slug: "role", questionText: "...", responseType: "SELECT", chatbotId: "chatbot-1", displayOrder: 1, isRequired: true }`
**Expected Output**: Question created, associated with chatbot-1

### Test 3: Create Question With Multiple Chatbots
**Input**: POST `/api/intake/questions` with `{ slug: "role", questionText: "...", responseType: "SELECT", chatbotAssociations: [{ chatbotId: "chatbot-1", displayOrder: 1, isRequired: true }, { chatbotId: "chatbot-2", displayOrder: 2, isRequired: false }] }`
**Expected Output**: Question created, associated with both chatbots with respective display orders and required flags

### Test 4: Fetch Questions for Chatbot
**Input**: GET `/api/intake/questions?chatbotId=chatbot-1`
**Expected Output**: Questions associated with chatbot-1, ordered by displayOrder from junction table

### Test 5: Share Question Across Chatbots
**Input**: 
1. Create question Q1
2. Associate Q1 with chatbot-1 (displayOrder: 1)
3. Associate Q1 with chatbot-2 (displayOrder: 2)
**Expected Output**: Both chatbots can fetch Q1 with their respective display orders

### Test 6: Submit Response with Shared Question
**Input**: POST `/api/intake/responses` with `{ intakeQuestionId: "q1", chatbotId: "chatbot-1", value: "..." }`
**Expected Output**: Response created, User_Context synced to chatbot-1 context

### Test 7: Submit Response with Non-Associated Question
**Input**: POST `/api/intake/responses` with `{ intakeQuestionId: "q1", chatbotId: "chatbot-2", value: "..." }` (where q1 is not associated with chatbot-2)
**Expected Output**: 400 error - "Question is not associated with this chatbot"

### Test 8: Associate Question via POST `/api/intake/questions/[questionId]/chatbots`
**Input**: POST `/api/intake/questions/q1/chatbots` with `{ chatbotAssociations: [{ chatbotId: "chatbot-1", displayOrder: 1, isRequired: true }] }`
**Expected Output**: Association created successfully

### Test 9: Remove Association via DELETE
**Input**: DELETE `/api/intake/questions/q1/chatbots` with `{ chatbotId: "chatbot-1" }`
**Expected Output**: Association removed successfully

### Test 10: Update Association via PATCH
**Input**: PATCH `/api/intake/questions/q1/chatbots` with `{ chatbotId: "chatbot-1", displayOrder: 3, isRequired: false }`
**Expected Output**: Association updated with new displayOrder and isRequired

## 12. Approval Prompt

Approve the plan to proceed to BUILD? (Yes / Answer questions / Edit)

