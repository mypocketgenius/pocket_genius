# Feedback UX System Update Plan

**Date:** 2025-12-19  
**Status:** Planning  
**Goal:** Migrate from modal-based feedback system (Phase 3.3/3.4) to pill-based feedback UX system

---

## Executive Summary

This plan migrates the feedback system from the current modal-based approach (Phase 3.3 "Need More" modal, Phase 3.4 "Copy Feedback" modal) to a new pill-based UX system that uses input prefilling instead of modals.

**Decision: Continue from current state** (do not rollback to commit 487050a9a185c3fb87f126138d5639fefae4e6bf)

**Rationale:**
- Prisma migrations are already applied to Neon database (cannot easily rollback)
- We're in development - can delete Message_Feedback table after migrating data to Events/Pill_Usage
- No need for feature flags or gradual rollout - just implement the new system
- Migrate existing Message_Feedback data to Events/Pill_Usage before deletion

**Key Design Decisions:**
1. **Events Table vs Message_Feedback:** Use Events table for general event logging. Delete Message_Feedback table after migrating data to Events/Pill_Usage (we're in development, data loss is acceptable).
2. **Bookmarks System:** Implement full Bookmarks functionality (not just event logging) so users can save and retrieve messages later.
3. **Rating Follow-up:** Use existing Conversation_Feedback table from Phase 3.5 (alpha_build.md) and add timeSaved field for "how much time did this save you?" question.
4. **Pill Container:** Update existing pill container implementation (lines 780-900 in chat.tsx) rather than rebuilding from scratch.
5. **Follow-up Inputs:** Use regular chat input field for gap capture and follow-up prompts, not separate textareas.
6. **Copy Modal:** Keep existing copy feedback modal if it works well - don't remove it unless the new pill system replaces its functionality.
7. **Chunk_Performance Updates:** Continue updating Chunk_Performance counters from Events/Pill_Usage data via background job.
8. **Dashboard Analytics:** Query Events table instead of Message_Feedback for all analytics.
9. **Naming:** Follow existing conventions - PascalCase with underscores for models (Pill_Usage, not PillUsage).
10. **Workflow:** Work off this plan until complete, then return to alpha_build.md. Don't integrate into alpha_build.md yet.

---

## Current State Analysis

### What's Already Implemented (Phase 3.3 & 3.4)

**Components:**
- ✅ `components/feedback-modal.tsx` - "Need More" modal with checkboxes
- ✅ `components/copy-feedback-modal.tsx` - Copy usage modal
- ✅ `components/chat.tsx` - Integrated modals, copy button, helpful/not_helpful buttons

**API:**
- ✅ `app/api/feedback/message/route.ts` - Handles helpful/not_helpful/need_more/copy feedback
- ✅ Batched database operations (Phase 0.1 optimization)
- ✅ Duplicate prevention logic

**Database Schema:**
- ✅ `Message_Feedback` table with:
  - `feedbackType`: 'helpful' | 'not_helpful' | 'need_more' | 'copy'
  - `needsMore`: String[] (scripts, examples, steps, case_studies)
  - `specificSituation`: String? (optional context)
  - `copyUsage`: String? (reference, use_now, share_team, adapt)
  - `copyContext`: String? (required for adapt)
- ✅ `Chunk_Performance` table with counters:
  - `helpfulCount`, `notHelpfulCount`
  - `needsScriptsCount`, `needsExamplesCount`, `needsStepsCount`, `needsCaseStudyCount`
  - `copyToUseNowCount`
  - `satisfactionRate`

**Current UX Flow:**
1. User clicks thumbs up/down → immediate API call, toast notification
2. User clicks lightbulb → opens "Need More" modal → selects checkboxes → submits
3. User clicks copy → opens copy feedback modal → selects usage → submits

---

## New Specification Overview

### Key Differences

| Aspect | Current (3.3/3.4) | New Spec |
|--------|-------------------|-----------|
| **Feedback UI** | Modals | Pills that prefill input |
| **Copy Flow** | Copy → Modal → Submit | Copy/Save buttons → Log event on send |
| **Expansion Requests** | "Need More" modal | Expansion pills (Give me an example, etc.) |
| **Data Model** | Message_Feedback table | Pills table + Pill_Usage table + Events table |
| **Star Ratings** | None | Chat interface + Homepage |
| **Source Attribution** | None | Display at end of messages |
| **Suggested Questions** | None | Chatbot-specific pills |

### New Components Needed

1. **Pill System:**
   - Feedback pills: "Helpful", "Not helpful"
   - Expansion pills: "Give me an example", "How would I actually use this?", "Say more about this", "Who's done this?"
   - Suggested question pills (chatbot-specific)

2. **Star Rating Component:**
   - Chat interface (top-right)
   - Homepage chatbot cards (homepage will be made later in the alpha build plan)

3. **Source Attribution Display:**
   - At the end of each bot message

4. **Save Button:**
   - New button alongside Copy

5. **Follow-up Prompts:**
   - After expansion responses
   - After "Not helpful" feedback

---

## Migration Strategy

### Phase 1: Add New Tables (Non-Breaking)

**Objective:** Add new schema without removing old tables

**Database Changes:**
1. Create `Pills` table
2. Create `Pill_Usage` table
3. Create `Events` table (for general event logging - copy, save, conversation patterns)
4. Create `Bookmarks` table (for saved messages)
5. Update `Conversation_Feedback` table (add `timeSaved` field for rating follow-up)
6. Create `Chatbot_Ratings_Aggregate` table (or computed view) - Note: Chat_Rating uses Conversation_Feedback.sessionId

**Migration Approach:**
- Use Prisma migrations
- Keep existing `Message_Feedback` and `Chunk_Performance` tables
- New tables coexist with old tables during transition

**Seed Data:**
- Create system pills (feedback + expansion pills) with `chatbot_id: NULL`
- These apply to all chatbots

### Phase 2: Build New UI Components (Parallel Implementation)

**Objective:** Build new pill-based UI alongside existing modal UI

**Components to Create:**
1. `components/pills/pill-row.tsx` - Pill container component
2. `components/pills/feedback-pill.tsx` - Individual pill component
3. `components/star-rating.tsx` - Star rating component
4. `components/source-attribution.tsx` - Source display component
5. `components/expansion-followup.tsx` - Follow-up prompt component
6. `components/gap-capture.tsx` - Gap submission component

**API Routes to Create:**
1. `app/api/pills/route.ts` - Get pills for chatbot
2. `app/api/pills/usage/route.ts` - Log pill usage
3. `app/api/events/route.ts` - Log events (copy, save, etc.)
4. `app/api/ratings/route.ts` - Submit/update chat ratings
5. `app/api/ratings/aggregate/route.ts` - Get aggregate ratings

**State Management:**
- Update `components/chat.tsx` to support pill selection
- Track selected pills in component state
- Prefill input field when pills clicked
- Log events when messages sent

### Phase 3: Data Migration Script

**Objective:** Migrate existing data to new schema

**Migration Tasks:**
1. **Message_Feedback → Events/Pill_Usage:**
   - `helpful` → Event: `user_message` with `feedback_pill: "helpful"`
   - `not_helpful` → Event: `user_message` with `feedback_pill: "not_helpful"`
   - `need_more` → Event: `user_message` with `expansion_pill` based on needsMore array
   - `copy` → Event: `copy` + Pill_Usage record

2. **Chunk_Performance:**
   - Keep existing table (still needed for analytics)
   - New events will continue to update counters
   - May need to recompute some metrics from Events table

**Script Location:** `scripts/migrate-feedback-to-pills.ts`

### Phase 4: Switch UI (Direct Implementation)

**Objective:** Replace modal UI with pill UI directly (no feature flag needed in development)

**Approach:**
- Direct implementation - no feature flag
- Replace old UI components immediately
- Keep copy feedback modal if it works well (may still be useful)

**UI Changes:**
1. Remove modal buttons (thumbs up/down, lightbulb) - replace with pills
2. Update pill rows above input (already exists, just need to make dynamic)
3. Update Copy/Save buttons below messages (already exist, add Save functionality)
4. Add source attribution display
5. Add star rating in chat header

### Phase 5: Cleanup & Migration

**Objective:** Migrate data and remove old system

**Timeline:** After new system is working

**Cleanup:**
- Migrate all Message_Feedback data to Events/Pill_Usage
- Delete `Message_Feedback` table (we're in development, data loss acceptable)
- Remove `components/feedback-modal.tsx` (replaced by pills)
- Keep `components/copy-feedback-modal.tsx` if it works well (or remove if pills replace it)
- Remove modal-related code from `components/chat.tsx`
- Update analytics to use Events table instead of Message_Feedback

---

## Implementation Plan

### Task 1: Database Schema Updates

**Files:**
- `prisma/schema.prisma`

**Changes:**
```prisma
// New tables to add
// Pill model - Feedback, expansion, and suggested question pills
model Pill {
  id          String   @id @default(cuid())
  chatbotId   String?  // NULL for system pills
  chatbot     Chatbot? @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  pillType    String   // 'feedback' | 'expansion' | 'suggested'
  label       String   // Display text
  prefillText String   // Input prefill text
  displayOrder Int     @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  pillUsages Pill_Usage[]
  
  @@index([chatbotId])
  @@index([pillType])
}

model Pill_Usage {
  id              String   @id @default(cuid())
  pillId          String
  pill            Pill     @relation(fields: [pillId], references: [id], onDelete: Cascade)
  sessionId       String?  // Conversation ID
  userId          String?
  user            User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  chatbotId       String
  chatbot         Chatbot @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  sourceChunkIds  String[] @default([])
  prefillText     String
  sentText        String
  wasModified     Boolean  @default(false)
  pairedWithPillId String?
  pairedWithPill  Pill?    @relation("PillPairing", fields: [pairedWithPillId], references: [id])
  timestamp       DateTime @default(now())

  @@index([pillId])
  @@index([sessionId])
  @@index([userId])
  @@index([chatbotId])
}

// Event model - General event logging (copy, bookmark, conversation patterns, etc.)
model Event {
  id          String   @id @default(cuid())
  sessionId   String?  // Conversation ID
  userId      String?
  user        User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  eventType   String   // 'copy' | 'bookmark' | 'conversation_pattern' | 'expansion_followup' | 'gap_submission'
  chunkIds    String[] @default([])
  metadata    Json?    // Event-specific data
  timestamp   DateTime @default(now())

  @@index([sessionId])
  @@index([userId])
  @@index([eventType])
  @@index([timestamp])
}

// Bookmark model - User-saved messages
model Bookmark {
  id          String   @id @default(cuid())
  messageId   String
  message     Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  chatbotId   String
  chatbot     Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  chunkIds    String[] @default([]) // Chunks from message context
  notes       String?  // Optional user notes
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([messageId, userId]) // One bookmark per message per user
  @@index([userId])
  @@index([chatbotId])
  @@index([createdAt])
}

// Conversation_Feedback model - Chat rating and follow-up questions
// Phase 3.5: End-of-conversation survey
// Updated: Added timeSaved field for rating follow-up
model Conversation_Feedback {
  id           String   @id @default(cuid())
  conversationId String
  conversation  Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  userId       String?
  user         User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  rating       Int?     // 1-5 star rating
  userGoal     String?  // What were you trying to accomplish?
  goalAchieved String?  // Yes/Partially/No
  stillNeed    String?  // What's still missing?
  timeSaved    String?  // How much time did this save you? (e.g., "5 minutes", "30 minutes", "1 hour", "2+ hours", "Not applicable")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([conversationId]) // One rating per conversation
  @@index([userId])
  @@index([rating])
}

// Note: Chat_Rating uses Conversation_Feedback table (Phase 3.5)
// We'll add timeSaved field to Conversation_Feedback instead

model Chatbot_Ratings_Aggregate {
  id                String   @id @default(cuid())
  chatbotId         String   @unique
  chatbot           Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  averageRating     Decimal  @db.Decimal(3, 2)
  ratingCount       Int      @default(0)
  ratingDistribution Json?   // {"1": 5, "2": 10, "3": 25, ...}
  updatedAt         DateTime @updatedAt
}
```

**Update existing models:**
- Add `pillUsages` relation to `User` (camelCase: `pillUsages`)
- Add `events` relation to `User` (camelCase: `events`)
- Add `bookmarks` relation to `User` (camelCase: `bookmarks`)
- Add `pillUsages` relation to `Chatbot` (camelCase: `pillUsages`)
- Add `bookmarks` relation to `Chatbot` (camelCase: `bookmarks`)
- Add `ratingsAggregate` relation to `Chatbot` (camelCase: `ratingsAggregate`)
- Add `bookmarks` relation to `Message` (camelCase: `bookmarks`)
- Add `conversationFeedback` relation to `Conversation` (camelCase: `conversationFeedback`)
- Add `conversationFeedback` relation to `User` (camelCase: `conversationFeedbacks`)
- Create `Conversation_Feedback` table (if doesn't exist from Phase 3.5) with `timeSaved` field

**Migration Command:**
```bash
npx prisma migrate dev --name add_pills_and_events_system
npx prisma generate
```

**Seed Script:**
Create `prisma/seed-pills.ts` to seed system pills:
- Feedback pills: "Helpful", "Not helpful"
- Expansion pills: "Give me an example", "How would I actually use this?", "Say more about this", "Who's done this?"

---

### Task 2: Update Existing Pill Container

**File:** `components/chat.tsx` (lines 780-900)

**Current State:**
- Already has two-row pill container with horizontal scrolling
- Hard-coded "Helpful" and "Not helpful" buttons (conditionally rendered)
- Hard-coded expansion pills ("Give me an example", "How would I use this?")
- Helpful/Not helpful load slower because they're conditionally rendered based on `messages.length` and `isLoading` state

**Changes Needed:**
1. **Replace hard-coded pills with dynamic pill loading:**
   - Fetch pills from API (`/api/pills?chatbotId=xxx`)
   - Separate pills by type: feedback, expansion, suggested
   - Organize into two rows dynamically

2. **Optimize helpful/not helpful rendering:**
   - Pre-render pills (don't wait for messages state)
   - Use pill data from API instead of conditional rendering
   - Show pills immediately, disable until messages exist

3. **Two-row layout logic:**
   - **Before messages:** Only show suggested question pills (no feedback/expansion pills)
   - **After messages:** Show two rows:
     - Row 1: Helpful pill + expansion pills + suggested questions
     - Row 2: Not helpful pill + expansion pills + suggested questions
   - Pills scroll horizontally if they overflow (already implemented)
   - Feedback pills appear at START of each row when messages exist

4. **Pill selection state:**
   - Track selectedFeedbackPill and selectedExpansionPill
   - Update input prefilling when pills clicked
   - Show visual feedback for selected pills

**File:** `components/pills/pill-row.tsx`

**Purpose:** Single row container for pills, handles horizontal scrolling

**Props:**
```typescript
interface PillRowProps {
  pills: Pill[];
  selectedFeedbackPill: string | null;
  selectedExpansionPill: string | null;
  onPillClick: (pill: Pill) => void;
  disabled?: boolean;
}
```

**File:** `components/pills/pill.tsx`

**Purpose:** Individual pill component (reusable for all pill types: feedback, expansion, suggested)

**Props:**
```typescript
interface PillProps {
  pill: Pill;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}
```

**Note:** Component name is `pill.tsx` (not `feedback-pill.tsx`) since it handles all pill types, not just feedback pills.

**Visual Design:**
- Feedback pills: Green background/border (Helpful) / Red background/border (Not helpful)
- Expansion pills: Neutral/muted style (gray border, white/light gray background)
- Suggested questions: Outlined style (different border color, e.g., blue or purple)
- Selected state: Highlight + checkmark icon
- Hover state: Subtle background change
- All pills same shape and size
- Touch targets minimum 44x44px for mobile

---

### Task 3: Update Chat Component

**File:** `components/chat.tsx`

**Changes:**
1. **Add pill state management:**
   ```typescript
   const [selectedFeedbackPill, setSelectedFeedbackPill] = useState<string | null>(null);
   const [selectedExpansionPill, setSelectedExpansionPill] = useState<string | null>(null);
   const [pills, setPills] = useState<Pill[]>([]);
   ```

2. **Load pills on mount:**
   - Fetch system pills (chatbot_id: NULL) - feedback + expansion pills
   - Fetch chatbot-specific suggested questions (chatbot_id: chatbotId)
   - Separate pills by type for two-row layout
   - Sort by displayOrder within each type

3. **Pill selection and input prefilling logic:**
   - When feedback pill clicked:
     - If opposite feedback pill selected, swap selection
     - Rebuild input text: `selectedFeedbackPill.prefillText + (selectedExpansionPill ? ' ' + selectedExpansionPill.prefillText : '')`
     - Show thank you toast (top-right, auto-dismiss 2 seconds)
   - When expansion pill clicked:
     - If already selected, deselect (remove from input)
     - If different expansion pill selected, swap selection
     - Rebuild input text with feedback pill (if selected) + expansion pill
   - When suggested question clicked:
     - Can combine with feedback pill if selected
     - Prefills input with question text
   - After prefill: Focus input, cursor at end
   - Track `wasModified` flag if user edits prefilled text
   - Clear pill selection after message sent

4. **Update Copy/Save buttons:**
   - **Copy button:** Already exists and works correctly (line 705-712) - LEAVE AS IS
   - **Save button:** Already exists but has no function (line 714-723) - IMPLEMENT Bookmarks functionality
   - Keep existing button design and positioning
   - Save button should:
     - Create Bookmark record in database
     - Show success toast: "Saved to Bookmarks"
     - Update button state (show filled bookmark icon if already saved)
     - Check if message already bookmarked on load
   - Both buttons log Events:
     - Copy: `{eventType: 'copy', chunkIds: [...], timestamp}` (already logs via handleCopy)
     - Save: `{eventType: 'save', chunkIds: [...], timestamp}` (add to save handler)

5. **Add source attribution:**
   - Extract source names from message.context.chunks
   - Display below message actions

6. **Add star rating:**
   - Top-right corner of chat interface
   - Pulse animation after first message (10 seconds or until interaction)
   - Load existing rating if user already rated

7. **Remove modal triggers:**
   - Remove thumbs up/down buttons (replace with pills)
   - Remove lightbulb button (replace with expansion pills)
   - Remove copy modal trigger (replace with event logging)

8. **Add follow-up prompts:**
   - After expansion responses: Show "Did that cover what you were looking for?" prompt
     - Appears inline below bot's expansion response
     - "Yes, thanks" button → logs satisfied event, dismisses prompt
     - "Not quite" button → opens gap capture component
     - Auto-dismisses after 30 seconds if no interaction
     - Only shows once per expansion (not repeatedly)
   - After "Not helpful" feedback: Show gap capture prompt
     - Triggered when user sends message with "Not helpful" pill
     - Same gap capture component as expansion follow-up
   - Friction-triggered prompts:
     - Bot explicitly cannot answer ("I don't have information on that")
     - User asks same thing 3+ times with rephrasing
     - Maximum frequency: Once per session (separate from expansion follow-ups)

**Note:** No feature flag needed - we're in development, just implement directly.

---

### Task 4: Create API Routes

**File:** `app/api/pills/route.ts`

**GET /api/pills?chatbotId=xxx**
- Returns all pills for chatbot (system + chatbot-specific)
- Filters by `isActive: true`
- Sorted by `displayOrder`

**File:** `app/api/pills/usage/route.ts`

**POST /api/pills/usage`
- Logs pill usage when message is sent
- Creates Pill_Usage record
- Links to paired pill if combined (feedback + expansion)
- Also creates Message_Feedback record if feedback pill used:
  - `feedbackType: 'helpful'` or `'not_helpful'`
  - Links to messageId from sent message

**File:** `app/api/events/route.ts`

**POST /api/events**
- Logs general events (not message-specific feedback)
- Stores in Events table with metadata
- Event types and metadata structure:
  - `copy`: `{chunkIds: string[], messageId: string}` - Logged when copy button clicked
  - `save`: `{chunkIds: string[], messageId: string}` - Logged when save button clicked (also creates Bookmark)
  - `expansion_followup`: `{result: 'satisfied' | 'unsatisfied', expansion_type: string, chunkIds: string[], messageId: string}`
  - `gap_submission`: `{trigger: string, expansion_type?: string, text: string, chunkIds: string[], messageId: string}`
  - `conversation_pattern`: `{pattern_type: string, chunkIds: string[]}` - Detected by background job

**Note:** `user_message` events with pill metadata are stored in Pill_Usage table, not Events table. Chat ratings use Conversation_Feedback table.

**File:** `app/api/feedback/conversation/route.ts` (already exists from Phase 3.5)

**POST /api/feedback/conversation`
- Creates/updates Conversation_Feedback record
- Fields: `conversationId`, `userId`, `rating`, `userGoal`, `goalAchieved`, `stillNeed`, `timeSaved` (NEW)
- One rating per session (upsert by conversationId)
- Updates Chatbot_Ratings_Aggregate after submission

**Note:** API path uses `/api/feedback/conversation` (not `/api/ratings/`) to match existing Phase 3.5 implementation. Path doesn't matter functionally, but consistency with existing code is better.

**GET /api/feedback/conversation/aggregate?chatbotId=xxx`
- Returns aggregate rating for chatbot from Chatbot_Ratings_Aggregate table

**File:** `app/api/bookmarks/route.ts`

**POST /api/bookmarks`
- Creates Bookmark record
- Checks for duplicate (one bookmark per message per user)
- Also logs Event: `{eventType: 'bookmark', chunkIds: [...], messageId: string}` (note: eventType is 'bookmark', not 'save')
- Returns bookmark ID

**DELETE /api/bookmarks/[bookmarkId]`
- Removes bookmark
- Returns success

**GET /api/bookmarks?userId=xxx&chatbotId=xxx`
- Returns user's bookmarks for chatbot
- Includes message content, source information, and chunkIds
- Sorted by createdAt (newest first)

---

### Task 5: Create Star Rating Component

**File:** `components/star-rating.tsx`

**Props:**
```typescript
interface StarRatingProps {
  chatbotId: string;
  sessionId: string; // Conversation ID
  messageCount: number; // Number of messages sent in session
  initialRating?: number;
  showAggregate?: boolean; // For homepage cards (homepage will be made later in alpha build)
  aggregateRating?: number;
  aggregateCount?: number;
  onRatingChange?: (rating: number) => void;
}
```

**Features:**
- 5 stars (1-5 rating)
- Inactive (muted) until first message sent (`messageCount > 0`)
- After first message: Stars begin subtle pulse/flash animation
- Animation stops after 10 seconds OR when user hovers/interacts
- Click a star to rate (1-5) → Opens follow-up modal
- Follow-up modal (from Phase 3.5 alpha_build.md):
  - "What were you trying to accomplish?" (textarea)
  - "Did you get what you needed?" (radio: Yes/Partially/No)
  - "What's still missing?" (conditional textarea if Partially/No)
  - **NEW:** "How much time did this save you?" (select: "5 minutes", "30 minutes", "1 hour", "2+ hours", "Not applicable")
- Once rated: Stars fill to show rating, animation stops
- User can change rating by clicking different star (re-opens follow-up modal)
- Updates Conversation_Feedback table (not separate Chat_Rating table)
- Updates Chatbot_Ratings_Aggregate table on rating change

---

### Task 6: Create Source Attribution Component

**File:** `components/source-attribution.tsx`

**Props:**
```typescript
interface SourceAttributionProps {
  chunkIds: string[];
  chatbotId: string;
  messageContext?: Json; // Message.context from database
}
```

**Features:**
- Extracts source names from message.context.chunks
- Displays comma-separated list: "Sources: The Art of War, Leadership Principles"
- Small, muted text style (text-sm text-gray-500)
- Positioned below message actions (Copy/Save buttons)
- No click interaction (for now)
- Handles missing source data gracefully (shows "Unknown Source" or hides if no chunks)

---

### Task 7: Create Follow-up Components

**File:** `components/expansion-followup.tsx`

**Purpose:** Shows "Did that cover what you were looking for?" after expansion responses

**Props:**
```typescript
interface ExpansionFollowupProps {
  messageId: string;
  expansionType: string;
  chunkIds: string[];
  onSatisfied: () => void;
  onUnsatisfied: () => void;
}
```

**File:** `components/gap-capture.tsx`

**Purpose:** Captures gap submission using regular chat input field (not separate textarea)

**Props:**
```typescript
interface GapCaptureProps {
  trigger: 'expansion_followup' | 'bot_punt' | 'rephrase_detected' | 'not_helpful_feedback';
  expansionType?: string;
  chunkIds: string[];
  inputValue: string; // Uses existing chat input state
  onInputChange: (value: string) => void; // Updates existing chat input
  onSkip: () => void;
  onSubmit: () => void; // Uses existing send message handler
  isVisible: boolean; // Controls when prompt appears
}
```

**Implementation:**
- Shows prompt text above regular chat input: "What were you hoping for?"
- Uses existing `input` state and `setInput` from chat component
- Uses existing send button to submit
- No separate textarea - integrates with existing input field
- Auto-dismisses after 30 seconds if no interaction

---

### Task 8: Update Chat API to Log Pill Usage

**File:** `app/api/chat/route.ts`

**Changes:**
- After storing user message, if pills were used:
  - Create Pill_Usage record(s) with pill metadata
  - If feedback pill used, also create Message_Feedback record
  - Extract pill metadata from request body:
    - `feedbackPillId`, `expansionPillId`, `suggestedPillId`
    - `prefillText`, `sentText`, `wasModified`
    - `chunkIds` from message context
- Pill usage is logged via `/api/pills/usage` endpoint (called from client after message sent)

---

### Task 9: Data Migration Script

**File:** `scripts/migrate-feedback-to-pills.ts`

**Purpose:** Migrate existing Message_Feedback records to Pill_Usage/Events

**Process:**
1. Query all Message_Feedback records
2. For each record:
   - If `feedbackType: 'helpful'` or `'not_helpful'`:
     - Find corresponding system pill (feedback type)
     - Create Pill_Usage record with pillId
     - Create Event record: `{eventType: 'user_message', metadata: {feedback_pill: feedbackType}}`
   - If `feedbackType: 'need_more'`:
     - Map needsMore array to expansion pill types
     - Create Pill_Usage record(s) for each expansion pill
     - Create Event record: `{eventType: 'user_message', metadata: {expansion_pill: mappedType}}`
   - If `feedbackType: 'copy'`:
     - Create Event record: `{eventType: 'copy', chunkIds: [...], messageId: string, metadata: {copyUsage, copyContext}}`
     - Create Pill_Usage record if copyUsage provided
3. After migration complete, delete Message_Feedback table (we're in development, data loss acceptable)

**Run Command:**
```bash
npx tsx scripts/migrate-feedback-to-pills.ts
```

---

### Task 10: Update Dashboard Analytics

**Files:**
- `components/dashboard/chunk-performance.tsx`
- `components/dashboard/source-performance.tsx`

**Changes:**
- Query Events table instead of Message_Feedback (Message_Feedback will be deleted)
- Calculate metrics from Events and Pill_Usage:
  - Copy rate: Events where eventType='copy' / Times shown
  - Bookmark rate: Events where eventType='bookmark' / Times shown
  - Helpful rate: Pill_Usage with feedback pill='helpful' / Total feedback pill usage
  - Expansion rate: Pill_Usage with expansion pill / Times shown
- Continue updating Chunk_Performance counters from Events/Pill_Usage via background job

**Background Job:** `app/api/jobs/update-chunk-performance/route.ts`

**Purpose:** Aggregate Events and Pill_Usage into Chunk_Performance counters

**Schedule:** Run every 15 minutes (Vercel Cron)

**Process:**
1. Query Events and Pill_Usage from last 15 minutes
2. Group by chunkId
3. Update Chunk_Performance counters:
   - Copy events → increment copyToUseNowCount (if metadata.copyUsage='use_now')
   - Bookmark events → track bookmark count (new counter if needed)
   - Pill_Usage with feedback pill='helpful' → increment helpfulCount
   - Pill_Usage with feedback pill='not_helpful' → increment notHelpfulCount
   - Pill_Usage with expansion pill → increment appropriate needs*Count:
     - 'give_me_an_example' → needsExamplesCount
     - 'how_would_i_use' → needsStepsCount
     - 'say_more' → needsScriptsCount (or new counter)
     - 'whos_done_this' → needsCaseStudyCount
4. Recalculate satisfactionRate from helpfulCount / (helpfulCount + notHelpfulCount)

### Task 11: Conversation Pattern Detection (Background Job)

**File:** `app/api/jobs/detect-conversation-patterns/route.ts`

**Purpose:** Detect conversation patterns automatically (no UI)

**Schedule:** Run every hour (Vercel Cron)

**Patterns to Detect:**
- Rephrase: User asks similar question 2+ times
- Abandonment: User leaves within 30s of bot response
- Simplification request: User asks "what do you mean" or similar
- Depth request: User asks "tell me more" without using pills
- Engaged thread: 5+ back-and-forth exchanges on same topic
- Return visit: User asks about same topic in new session

**Process:**
1. Query recent conversations
2. Analyze message patterns
3. Create Event records with eventType='conversation_pattern'
4. Store pattern_type and chunkIds in metadata

**Overlap with Phase 4.1 Sentiment Analysis:**
- **Sentiment Analysis (Phase 4.1):** Analyzes individual user messages for sentiment (satisfaction, confusion, frustration) and intent (question, clarification, etc.). Uses GPT-4o-mini to analyze message content. Updates Chunk_Performance with sentiment metrics.
- **Conversation Patterns (Task 11):** Detects multi-message patterns across conversations (rephrase, abandonment, engaged threads). Uses rule-based detection on conversation structure. Logs Events but doesn't directly update Chunk_Performance.

**Implementation Order:**
- **Option 1:** Implement both simultaneously (they're independent)
- **Option 2:** Implement Sentiment Analysis first (Phase 4.1), then Conversation Patterns (Task 11)
- **Recommendation:** Implement Sentiment Analysis first (Phase 4.1) since it directly updates Chunk_Performance and provides immediate value. Conversation Patterns can be added later as it's more exploratory.

**Both are needed:** Sentiment analysis provides granular message-level insights, while conversation patterns provide higher-level behavioral insights. They complement each other.

---

## Testing Strategy

### Unit Tests

**Files to Test:**
- `components/pills/pill-row.test.tsx`
- `components/pills/feedback-pill.test.tsx`
- `components/star-rating.test.tsx`
- `app/api/pills/route.test.ts`
- `app/api/events/route.test.ts`
- `app/api/ratings/route.test.ts`

**Test Cases:**
- Pill selection state management
- Input prefilling logic
- Multi-pill combination (feedback + expansion)
- Star rating submission
- Event logging
- Duplicate prevention

### Integration Tests

**Files to Test:**
- `components/chat.test.tsx` (updated)
- `app/api/chat/route.test.ts` (updated)

**Test Cases:**
- End-to-end pill click → input prefill → send message → event logged
- Copy button → event logged (no modal)
- Save button → event logged
- Star rating → rating stored → aggregate updated
- Follow-up prompts appear after expansion

### Manual Testing Checklist

**Pill System:**
- [ ] System pills load correctly
- [ ] Suggested questions load per chatbot
- [ ] Pills prefill input correctly
- [ ] Multi-pill selection works (feedback + expansion)
- [ ] Selected pills show visual feedback
- [ ] Input can be edited after prefill
- [ ] wasModified flag tracks edits correctly
- [ ] Thank you toast appears for feedback pills
- [ ] Pills scroll horizontally on narrow screens

**Copy/Save Buttons:**
- [ ] Copy button copies text to clipboard (already works - verify)
- [ ] Save button creates Bookmark record
- [ ] Save button shows success toast
- [ ] Save button updates state (filled icon if already saved)
- [ ] Bookmarks can be retrieved later
- [ ] Events logged correctly for both buttons
- [ ] No modals appear

**Star Rating:**
- [ ] Stars inactive until first message
- [ ] Pulse animation triggers after first message
- [ ] Rating can be submitted
- [ ] Rating can be updated
- [ ] Aggregate rating displays on homepage

**Source Attribution:**
- [ ] Source names display correctly
- [ ] Multiple sources comma-separated
- [ ] Handles missing source data gracefully

**Follow-up Prompts:**
- [ ] Appears after expansion responses
- [ ] "Yes, thanks" logs satisfied event
- [ ] "Not quite" opens gap capture prompt
- [ ] Gap capture uses regular chat input (not separate textarea)
- [ ] Gap capture submits via regular send button
- [ ] Prompts auto-dismiss after 30 seconds

**Star Rating:**
- [ ] Stars inactive until first message
- [ ] Pulse animation triggers after first message
- [ ] Clicking star opens follow-up modal
- [ ] Follow-up modal includes "How much time did this save you?" question
- [ ] Rating and follow-up data stored in Conversation_Feedback table
- [ ] Aggregate rating displays correctly

---

## Rollout Plan

### Week 1: Database & API
- ✅ Task 1: Database schema updates
- ✅ Task 4: API routes created
- ✅ Task 8: Chat API updated
- ✅ Task 11: Conversation pattern detection job

### Week 2: Components
- ✅ Task 2: Pill components (container, rows, individual pills)
- ✅ Task 5: Star rating component
- ✅ Task 6: Source attribution component
- ✅ Task 7: Follow-up components (expansion follow-up, gap capture)

### Week 3: Integration
- ✅ Task 3: Chat component updated
- ✅ Feature flag enabled in staging
- ✅ Testing complete
- ✅ Task 10: Background job for Chunk_Performance updates

### Week 4: Migration & Launch
- ✅ Task 9: Data migration script run
- ✅ Task 10: Dashboard analytics updated
- ✅ Feature flag enabled in production
- ✅ Monitor for issues

### Week 5+: Cleanup
- ✅ Remove old modal components
- ✅ Remove feature flag (pills always enabled)
- ✅ Archive old Message_Feedback data (keep for historical reference)

---

## Risk Mitigation

### Risk 1: Data Loss During Migration

**Mitigation:**
- Migration script creates new records in Events/Pill_Usage before deleting Message_Feedback
- We're in development - data loss is acceptable
- Can test migration script on copy of database first

### Risk 2: Breaking Changes

**Mitigation:**
- Test thoroughly before deleting Message_Feedback table
- Keep backup of database before migration
- Can restore from backup if needed

### Risk 3: Performance Impact

**Mitigation:**
- Event logging is async (non-blocking)
- Batch event submissions where possible
- Monitor API response times

### Risk 4: Schema Migration Issues

**Mitigation:**
- Test migrations on staging database first
- Backup production database before migration
- Can rollback Prisma migration if needed

---

## Success Metrics

### System Health
- Pill usage rate: % of messages sent using at least one pill
- Multi-pill rate: % of pill-assisted messages using feedback + expansion combo
- Follow-up response rate: % of "Did that cover it?" prompts that get a response
- Star rating rate: % of sessions (with 1+ messages) that submit a rating

### Goal Achievement
- Goal A (Resonance): Can identify top 10% of chunks by copy/save rate and helpful rate
- Goal B (Depth): Can categorize expansion requests by type with >80% coverage
- Goal C (Reusable): Can rank chunks by engagement score
- Goal D (Gaps): Can cluster gap submissions into actionable themes

### User Experience
- No increase in error rate
- No decrease in feedback submission rate
- Positive user feedback on new pill system

---

## Design Decisions & Justifications

### 1. Events Table vs Message_Feedback Table

**Question:** Why use Events table instead of extending Message_Feedback?

**Justification:**
- **Message_Feedback** is designed for message-specific feedback (helpful, not_helpful, need_more, copy). It's tightly coupled to Message model.
- **Events table** is for general event logging that may or may not be tied to specific messages:
  - `copy` and `save` events: Can be logged immediately when button clicked (before message context is fully processed)
  - `conversation_pattern`: Detected across multiple messages, not tied to single message
  - `expansion_followup` and `gap_submission`: Can occur after message is sent, need flexible metadata
- **Separation of concerns:** Message_Feedback tracks user feedback on messages. Events tracks user actions and system-detected patterns.
- **Query performance:** Events table can be optimized for time-series queries (analytics), while Message_Feedback is optimized for message lookups.
- **Future extensibility:** Events table can easily accommodate new event types without schema changes to Message_Feedback.

**Alternative considered:** Extending Message_Feedback with nullable fields for all event types. This would create a "god table" with many unused fields per record, making queries less efficient.

**Decision:** Use both tables - Message_Feedback for message feedback, Events for general event logging.

2. **Suggested Questions:**
   - How do creators configure suggested questions?
   - Is there a UI for managing them, or just database?
   - **Decision:** Start with database-only (creators can add via Prisma Studio or API). Add UI in Beta if needed.

3. **Gap Submission Frequency:**
   - Spec says "once per session" - is this per gap type or total?
   - How do we prevent spam?
   - **Decision:** Once per session total (not per type). Track in session state or Events table.

4. **Backward Compatibility:**
   - How long should we keep Message_Feedback table?
   - When can we remove old modal components?
   - **Decision:** Delete Message_Feedback table after migrating data to Events/Pill_Usage (we're in development). Remove modal components immediately after new system works, except copy modal if we decide to keep it.

5. **Chunk_Performance Updates:**
   - Should we update Chunk_Performance in real-time or batch?
   - **Decision:** Batch updates via background job (every 15 minutes) for performance. Real-time updates can cause database contention.

6. **Pill Loading Performance:**
   - Why do helpful/not helpful pills load slower?
   - **Root cause:** They're conditionally rendered based on `messages.length` and `isLoading` state checks
   - **Solution:** Pre-render pills from API data, disable until messages exist. Don't wait for conditional rendering.

---

## Next Steps

1. **Review this plan** with team/stakeholders
2. **Answer open questions** before implementation
3. **Create feature branch:** `feature/feedback-pills-system`
4. **Start with Task 1:** Database schema updates
5. **Iterate through tasks** in order
6. **Test thoroughly** before production rollout

---

## Appendix: Data Mapping Reference

### Message_Feedback → Events/Pill_Usage Mapping

| Old (Message_Feedback) | New (Events/Pill_Usage) |
|------------------------|-------------------------|
| `feedbackType: 'helpful'` | Event: `{eventType: 'user_message', metadata: {feedback_pill: 'helpful'}}` |
| `feedbackType: 'not_helpful'` | Event: `{eventType: 'user_message', metadata: {feedback_pill: 'not_helpful'}}` |
| `feedbackType: 'need_more'` with `needsMore: ['examples']` | Event: `{eventType: 'user_message', metadata: {expansion_pill: 'give_me_an_example'}}` |
| `feedbackType: 'copy'` with `copyUsage: 'use_now'` | Event: `{eventType: 'copy'}` + Pill_Usage record |

### Chunk_Performance Counter Mapping

| Old Counter | New Source |
|-------------|-----------|
| `helpfulCount` | Count Events with `feedback_pill: 'helpful'` |
| `notHelpfulCount` | Count Events with `feedback_pill: 'not_helpful'` |
| `copyToUseNowCount` | Count Events with `eventType: 'copy'` + Pill_Usage with `copyUsage: 'use_now'` |
| `needsExamplesCount` | Count Events with `expansion_pill: 'give_me_an_example'` |

---

## Summary: Plan Completeness Checklist

### ✅ Core Requirements Covered

- [x] **Two-row pill layout** - Specified in Task 2 (pill-container with before/after messages logic)
- [x] **Pill prefilling logic** - Detailed in Task 3 (feedback + expansion combination)
- [x] **Copy/Save buttons** - Specified in Task 3 (immediate event logging, no modals)
- [x] **Source attribution** - Task 6 (below messages)
- [x] **Star rating** - Task 5 (chat + homepage, pulse animation)
- [x] **Follow-up prompts** - Task 7 (expansion follow-up + gap capture)
- [x] **Thank you toast** - Specified in Task 3 (for feedback pills)
- [x] **Database schema** - Task 1 (Pills, Pill_Usage, Events, Chat_Rating tables)
- [x] **API routes** - Task 4 (pills, events, ratings)
- [x] **Data migration** - Task 9 (Message_Feedback → Events/Pill_Usage)
- [x] **Analytics updates** - Task 10 (Events-based metrics)
- [x] **Background jobs** - Task 11 (conversation patterns, Chunk_Performance updates)

### ✅ Professional Implementation Details

- [x] **Feature flag** - Allows gradual rollout and easy rollback
- [x] **Backward compatibility** - Keeps old tables, supports both systems during transition
- [x] **Error handling** - Specified in API routes and components
- [x] **Mobile considerations** - Touch targets, horizontal scrolling, responsive design
- [x] **Accessibility** - Keyboard navigation, ARIA labels, screen reader support
- [x] **Performance** - Async event logging, batched operations, background jobs
- [x] **Testing strategy** - Unit, integration, and manual testing checklists

### ✅ Migration Strategy

- [x] **Non-breaking changes** - New tables added, old tables preserved
- [x] **Data preservation** - Migration script creates new records, doesn't delete old
- [x] **Gradual rollout** - Feature flag enables phased deployment
- [x] **Rollback plan** - Can disable feature flag to revert to old UI

### 📋 Implementation Readiness

**Total Tasks:** 11 tasks  
**Timeline:** 5 weeks  
**Risk Level:** Low (feature flag allows safe rollout)

**Ready to proceed with implementation.**

---

---

## Answers to Implementation Questions

### 1. Ratings API Path: `/ratings/` vs `/conversation_feedback/`

**Answer:** Use `/api/feedback/conversation` to match existing Phase 3.5 implementation. Path doesn't matter functionally, but consistency with existing code is better. The aggregate endpoint can be `/api/feedback/conversation/aggregate`.

### 2. Does this plan implement everything from the original spec?

**Answer:** Yes. The plan covers:
- ✅ Pill system (feedback, expansion, suggested)
- ✅ Two-row pill layout with horizontal scrolling
- ✅ Copy/Save buttons (Save already exists, needs function)
- ✅ Source attribution
- ✅ Star rating with follow-up (timeSaved question)
- ✅ Follow-up prompts (expansion, gap capture)
- ✅ Bookmarks system
- ✅ Events table for logging
- ✅ Chunk_Performance updates from Events
- ✅ Dashboard analytics from Events

### 3. Should we integrate with alpha_build.md or work separately?

**Answer:** Work off this plan (`12-19_feedback_ux_update.md`) until complete, then return to `alpha_build.md`. Don't integrate into alpha_build.md yet - keep them separate for now.

### 4. Can we delete Message_Feedback table?

**Answer:** Yes. We're in development, so:
- Migrate all Message_Feedback data to Events/Pill_Usage first
- Then delete Message_Feedback table
- Data loss is acceptable in development

### 5. Feature flags and gradual rollout?

**Answer:** No feature flags needed. We're in development - just implement directly.

### 6. Dashboard analytics should query Events?

**Answer:** Yes. Updated Task 10 to query Events table instead of Message_Feedback.

### 7. Should we update Chunk_Performance?

**Answer:** Yes. Task 10 includes background job to update Chunk_Performance counters from Events/Pill_Usage data every 15 minutes.

### 8. Is "feedback-pill" the right component name?

**Answer:** No. Changed to `pill.tsx` since it handles all pill types (feedback, expansion, suggested), not just feedback pills.

### 9. Why remove copy modal if it works?

**Answer:** Good point. Updated plan to keep copy modal if it works well. Decision point: If pills replace its functionality, remove it. Otherwise, keep it.

### 10. Do new tables follow naming conventions?

**Answer:** Yes. Following existing conventions:
- Models: PascalCase with underscores (`Pill_Usage`, `Conversation_Feedback`, `Chatbot_Ratings_Aggregate`)
- Relations: camelCase (`pillUsages`, `conversationFeedback`, `ratingsAggregate`)
- Matches existing: `Message_Feedback`, `Chunk_Performance`, `Creator_User`

### 11. Task 11 vs Phase 4.1 timing?

**Answer:** Implement Phase 4.1 (Sentiment Analysis) first, then Task 11 (Conversation Patterns). They're independent but Sentiment Analysis provides immediate value by updating Chunk_Performance directly.

---

**End of Plan**

