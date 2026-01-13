# Remove Sentiment Analysis from Phase 4

## Objective

Remove Phase 4.1 (Sentiment Analysis Job) from the Alpha build plan while preserving all dependencies required by Phase 4.2 and Phase 4.3. This aligns with the decision to use behavioral signals instead of LLM-based sentiment analysis.

## Acceptance Criteria

- ✅ Phase 4.1 completely removed from alpha_build.md
- ✅ Phase 4.2 updated to use existing `satisfactionRate` instead of sentiment fields
- ✅ Phase 4.3 remains unchanged (doesn't depend on sentiment, except vercel.json cron removal)
- ✅ Phase 4.0 schema models preserved (but sentiment-related models marked as unused/optional)
- ✅ All sentiment analysis code references removed
- ✅ Cron jobs for sentiment analysis removed from all phase sections (4.1, 4.2, 4.3)
- ✅ Chat API no longer triggers sentiment analysis
- ✅ Critical Path updated to remove Phase 4.1 dependency
- ✅ Alpha Release Checklist updated to remove sentiment analysis requirement
- ✅ confusionRate removed from queries (no direct equivalent from feedback data)
- ✅ WHERE clauses include `satisfactionRate > 0` check to ensure only chunks with feedback are shown
- ✅ No broken dependencies between phases

## Clarifying Questions

None - the plan is clear.

## Assumptions

1. Phase 4.2 can use existing `satisfactionRate` field (computed from helpful/not helpful feedback) instead of sentiment-based `satisfactionSum/satisfactionCount`
2. Phase 4.0 schema models can remain in the database (unused tables won't cause issues)
3. We're not removing schema migrations that have already been run (if any)

## Minimal Approach

1. Remove Phase 4.1 section entirely
2. Update Phase 4.0 to mark sentiment-related models as optional/unused
3. Update Phase 4.2 queries to use `satisfactionRate` instead of sentiment fields
4. Remove `confusionRate` calculation (no direct equivalent from feedback data - confusion ≠ "not helpful")
5. Remove sentiment analysis code references from Phase 4.2
6. Update Phase 4.2 prerequisites to remove Phase 4.1 dependency
7. Remove sentiment analysis cron job references from all phase sections (4.1, 4.2, 4.3)
8. Update Critical Path to remove Phase 4.1
9. Update Alpha Release Checklist to remove sentiment analysis requirement
10. Update overview/summary sections that mention Phase 4.1

## Text Diagram

```
Before:
Phase 4.0 (Schema) → Phase 4.1 (Sentiment) → Phase 4.2 (Dashboard) → Phase 4.3 (Content Gaps)
                     ↓
              Updates Chunk_Performance
              sentiment fields

After:
Phase 4.0 (Schema) → Phase 4.2 (Dashboard) → Phase 4.3 (Content Gaps)
                     ↓
              Uses existing satisfactionRate
              (from helpful/not helpful feedback)
```

## Plan File Contents

### Changes Required

#### 1. Remove Phase 4.1 Section

**Location:** `Planning Docs/alpha_build.md` around line 4480-4852

**Action:** Delete entire Phase 4.1 section including:
- Objective and prerequisites
- Type definitions (SentimentAnalysis interface)
- All 5 tasks (sentiment utility, API route, attribution job, cron setup, chat API trigger)
- Deliverables
- Testing checklist

**Impact:** Removes ~370 lines of sentiment analysis implementation details

#### 2. Update Phase 4.0 Schema Migration

**Location:** `Planning Docs/alpha_build.md` around line 4324-4338

**Action:** Update sentiment fields documentation in Chunk_Performance to mark as optional/unused:

```prisma
// Phase 4.0: Sentiment analysis fields (OPTIONAL - currently unused)
// These fields are reserved for future use if sentiment analysis is added later
// Currently, satisfactionRate (from helpful/not helpful feedback) is used instead
satisfactionSum    Float @default(0)  // Reserved for future sentiment analysis
satisfactionCount  Int   @default(0)   // Reserved for future sentiment analysis
confusionCount     Int   @default(0)   // Reserved for future sentiment analysis
clarificationCount Int   @default(0)   // Reserved for future sentiment analysis
responseCount      Int   @default(0)   // Reserved for future sentiment analysis
```

**Note:** Keep Message_Analysis and Message_Analysis_Chunk_Attribution models in schema (they won't cause issues if unused), but mark as optional in documentation.

**Impact:** Clarifies that sentiment fields exist but aren't populated

#### 3. Update Phase 4.2 Prerequisites

**Location:** `Planning Docs/alpha_build.md` around line 4860-4864

**Change:**
```markdown
**Prerequisites:**
- ✅ Phase 4.0 complete (Schema migration)
- ✅ Phase 4.1 complete (Sentiment analysis job running)  ← REMOVE THIS
- ✅ Chunk_Performance table has sentiment data  ← REMOVE THIS
- ✅ Format preferences data from "need more" feedback
```

**To:**
```markdown
**Prerequisites:**
- ✅ Phase 4.0 complete (Schema migration)
- ✅ Format preferences data from "need more" feedback
- ✅ Chunk_Performance table has feedback data (helpfulCount, notHelpfulCount, satisfactionRate)
```

**Impact:** Removes dependency on Phase 4.1

#### 4. Update Phase 4.2 Chunk Performance Queries

**Location:** `Planning Docs/alpha_build.md` around line 4937-4992

**Action:** Replace sentiment-based queries with satisfactionRate-based queries:

**Current (uses sentiment fields):**
```sql
CASE 
  WHEN "satisfactionCount" > 0 
  THEN "satisfactionSum" / "satisfactionCount" 
  ELSE NULL 
END as "avgSatisfaction",
CASE 
  WHEN "responseCount" > 0 
  THEN "confusionCount"::float / "responseCount" 
  ELSE NULL 
END as "confusionRate",
```

**Replace with (uses existing satisfactionRate):**
```sql
"satisfactionRate" as "avgSatisfaction",
-- Note: confusionRate removed - no direct equivalent from feedback data
-- If confusion metrics needed later, could use: notHelpfulCount / (helpfulCount + notHelpfulCount)
-- but this measures dissatisfaction, not confusion specifically
```

**Also update WHERE clauses:**
- Remove: `AND "satisfactionCount" > 0`
- Remove: `AND "satisfactionSum" / "satisfactionCount" < 3.0`
- Replace with: `AND "satisfactionRate" > 0 AND "satisfactionRate" < 0.6` 
  - Ensures we only show chunks with feedback (satisfactionRate > 0)
  - satisfactionRate is 0.0-1.0 scale: helpfulCount / (helpfulCount + notHelpfulCount)

**For top performing:**
- Remove: `AND "satisfactionCount" > 0`
- Remove: `AND "satisfactionSum" / "satisfactionCount" >= 4.0`
- Replace with: `AND "satisfactionRate" > 0 AND "satisfactionRate" >= 0.8` (80%+ satisfaction)
  - Ensures we only show chunks with feedback (satisfactionRate > 0)

**Impact:** Phase 4.2 now uses existing feedback data instead of sentiment analysis

#### 5. Update Phase 4.2 Source Performance Aggregation

**Location:** `Planning Docs/alpha_build.md` around line 5175-5188

**Action:** The code already uses `satisfactionRate` correctly (line 5185-5187), but remove the initialization of sentiment fields:

**Remove:**
```typescript
satisfactionSum: 0,
satisfactionCount: 0,
```

**Keep:**
```typescript
if (chunk.satisfactionRate > 0) {
  acc[chunk.sourceId].satisfactionSum += chunk.satisfactionRate;
  acc[chunk.sourceId].satisfactionCount += 1;
}
```

**Note:** This code is already correct - it uses `satisfactionRate` from Chunk_Performance, not sentiment fields. The variable names `satisfactionSum` and `satisfactionCount` are local variables for aggregation, not the database fields.

**Impact:** No change needed - code already correct

#### 6. Remove Sentiment Analysis Cron Job

**Location:** `Planning Docs/alpha_build.md` around line 4803-4815, 5303-5305, and 5526

**Action:** Remove sentiment analysis cron job from vercel.json examples in:
- Phase 4.1 section (lines 4803-4815)
- Phase 4.2 section (lines 5303-5305)
- Phase 4.3 section (line 5526)

**Remove:**
```json
{
  "path": "/api/jobs/attribute-sentiment",
  "schedule": "*/15 * * * *"  // Every 15 minutes
},
```

**Keep only:**
```json
{
  "crons": [
    {
      "path": "/api/jobs/aggregate-source-performance",
      "schedule": "0 3 * * *"      // Daily at 3 AM UTC
    },
    {
      "path": "/api/jobs/aggregate-content-gaps",
      "schedule": "0 2 * * *"      // Daily at 2 AM UTC
    }
  ]
}
```

**Impact:** Removes unnecessary cron job from all phase sections

#### 7. Remove Sentiment Analysis from Chat API

**Location:** `Planning Docs/alpha_build.md` around line 4817-4837

**Action:** Remove entire section about triggering sentiment analysis from chat API

**Impact:** Chat API no longer triggers sentiment analysis

#### 8. Update Phase 4.2 Deliverables

**Location:** `Planning Docs/alpha_build.md` around line 5321-5329

**Change:**
```markdown
**Deliverables:**
- ✅ Format preferences widget showing aggregate stats
- ✅ Underperforming chunks with actual text displayed
- ✅ Top performing chunks with copy metrics
- ✅ Sentiment-based metrics displayed  ← REMOVE THIS
- ✅ Source_Performance table created
- ✅ Nightly aggregation job
- ✅ Dashboard shows source-level metrics
- ✅ Can compare performance across books/works
```

**To:**
```markdown
**Deliverables:**
- ✅ Format preferences widget showing aggregate stats
- ✅ Underperforming chunks with actual text displayed
- ✅ Top performing chunks with copy metrics
- ✅ Feedback-based metrics displayed (using satisfactionRate from helpful/not helpful)
- ✅ Source_Performance table created
- ✅ Nightly aggregation job
- ✅ Dashboard shows source-level metrics
- ✅ Can compare performance across books/works
```

**Impact:** Updates deliverables to reflect removal of sentiment analysis

#### 9. Update Overview/Summary Sections

**Location:** `Planning Docs/alpha_build.md` around line 27-29, 36, 56-57, 62, 73-75, 81

**Action:** Remove Phase 4.1 references from:
- Phase overview section
- Critical Path diagram
- File structure diagrams
- Task lists

**Examples:**

**Line 27-29:**
```markdown
Phase 4.1 (Sentiment Analysis)  ← REMOVE THIS LINE
Phase 4.2, 4.3 (Dashboard & Content Gaps)
```

**Line 36:**
```markdown
**Critical Path:** 0.1 → 3.3-3.5 → 4.1 → 4.2  ← UPDATE TO: 0.1 → 3.3-3.5 → 4.2
```

**Line 56-57:**
```markdown
│   │   ├── attribute-sentiment/route.ts    # NEW in Phase 4.1  ← REMOVE THIS LINE
```

**Line 62:**
```markdown
│       └── sentiment/route.ts          # NEW in Phase 4.1  ← REMOVE THIS LINE
```

**Line 81:**
```markdown
│   └── sentiment.ts                    # NEW in Phase 4.1  ← REMOVE THIS LINE
```

**Impact:** Removes Phase 4.1 from all overview sections and updates critical path

#### 10. Update Testing Checklist

**Location:** `Planning Docs/alpha_build.md` around line 5849-5852

**Change:**
```markdown
- [ ] Phase 4.0: Schema Migration for Analytics ⚠️ **REQUIRED FIRST**
- [ ] Phase 4.1: Sentiment Analysis Job  ← REMOVE THIS LINE
- [ ] Phase 4.2: Enhanced Creator Dashboard (with Source Performance)
- [ ] Phase 4.3: Content Gap Aggregation (basic)
```

**To:**
```markdown
- [ ] Phase 4.0: Schema Migration for Analytics ⚠️ **REQUIRED FIRST**
- [ ] Phase 4.2: Enhanced Creator Dashboard (with Source Performance)
- [ ] Phase 4.3: Content Gap Aggregation (basic)
```

**Impact:** Removes Phase 4.1 from testing checklist

#### 11. Update Alpha Release Checklist

**Location:** `Planning Docs/alpha_build.md` around line 5797

**Change:**
```markdown
- [ ] Sentiment analysis running  ← REMOVE THIS LINE
```

**To:**
```markdown
- [ ] Dashboard shows source performance
```

**Impact:** Removes sentiment analysis requirement from Alpha release checklist

## Work Plan

### Task 1: Remove Phase 4.1 Section
- **Subtask 1.1** — Remove Phase 4.1 objective, prerequisites, and type definitions  
  **Visible output:** Lines 4480-4515 removed
- **Subtask 1.2** — Remove all 5 Phase 4.1 tasks  
  **Visible output:** Lines 4517-4837 removed
- **Subtask 1.3** — Remove Phase 4.1 deliverables and testing  
  **Visible output:** Lines 4839-4851 removed

### Task 2: Update Phase 4.0 Documentation
- **Subtask 2.1** — Mark sentiment fields as optional/unused in Chunk_Performance  
  **Visible output:** Lines 4332-4337 updated with "OPTIONAL - currently unused" comments
- **Subtask 2.2** — Add note that Message_Analysis models are optional  
  **Visible output:** Documentation updated to clarify models exist but aren't used

### Task 3: Update Phase 4.2 Dependencies
- **Subtask 3.1** — Remove Phase 4.1 from prerequisites  
  **Visible output:** Lines 4862-4863 removed
- **Subtask 3.2** — Update prerequisites to reference existing feedback data  
  **Visible output:** New prerequisite added for feedback data

### Task 4: Update Phase 4.2 Queries
- **Subtask 4.1** — Replace sentiment-based avgSatisfaction with satisfactionRate  
  **Visible output:** SQL queries updated in lines 4944-4948, 4977-4979
- **Subtask 4.2** — Remove confusionRate calculation (no direct equivalent from feedback data)  
  **Visible output:** confusionRate removed from SELECT and display code (lines 4949-4953, 5030-5032)
- **Subtask 4.3** — Update WHERE clauses to use satisfactionRate with feedback check  
  **Visible output:** WHERE clauses updated in lines 4962-4963, 4988-4989 to include `satisfactionRate > 0`

### Task 5: Remove Sentiment Analysis Infrastructure
- **Subtask 5.1** — Remove sentiment analysis cron job from vercel.json examples  
  **Visible output:** Cron job removed from lines 4803-4815, 5303-5305, 5526
- **Subtask 5.2** — Remove chat API sentiment trigger section  
  **Visible output:** Lines 4817-4837 removed

### Task 6: Update Overview Sections
- **Subtask 6.1** — Remove Phase 4.1 from phase overview  
  **Visible output:** Line 27 updated
- **Subtask 6.2** — Update Critical Path to remove Phase 4.1  
  **Visible output:** Line 36 updated from "0.1 → 3.3-3.5 → 4.1 → 4.2" to "0.1 → 3.3-3.5 → 4.2"
- **Subtask 6.3** — Remove Phase 4.1 from file structure diagrams  
  **Visible output:** Lines 56-57, 62, 81 updated
- **Subtask 6.4** — Remove Phase 4.1 from testing checklist  
  **Visible output:** Line 5850 removed

### Task 7: Update Deliverables
- **Subtask 7.1** — Update Phase 4.2 deliverables to remove sentiment reference  
  **Visible output:** Line 5325 updated

### Task 8: Update Alpha Release Checklist
- **Subtask 8.1** — Remove sentiment analysis requirement from Alpha release checklist  
  **Visible output:** Line 5797 updated to remove "Sentiment analysis running"

## Architectural Discipline

- **File Limits:** No new files created, only documentation updates
- **Single Responsibility:** Each change is isolated to its specific section
- **Anti-Convenience Bias:** Not adding anything new, only removing/updating

## Risks & Edge Cases

1. **Risk:** If Phase 4.0 migration already ran, Message_Analysis tables exist in database
   - **Mitigation:** Tables can remain unused - they won't cause issues
   - **Note:** If needed later, can add sentiment analysis back without schema changes

2. **Risk:** Phase 4.2 queries assume satisfactionRate scale (0-1 vs 0-5)
   - **Mitigation:** ✅ Confirmed - satisfactionRate is 0.0-1.0 scale (helpfulCount / (helpfulCount + notHelpfulCount))
   - **Note:** Thresholds set to < 0.6 for underperforming and >= 0.8 for top performing

3. **Risk:** Source performance aggregation uses local variables named satisfactionSum/satisfactionCount
   - **Mitigation:** These are local variables, not database fields - no conflict
   - **Note:** Code already uses satisfactionRate correctly

4. **Risk:** Other code references sentiment analysis that we haven't found
   - **Mitigation:** Search codebase for "sentiment", "Message_Analysis", "analyzeMessageSentiment" after changes
   - **Note:** May need additional cleanup in actual code files (not just plan)

5. **Risk:** confusionRate removal may break UI components that display it
   - **Mitigation:** Remove confusionRate from SELECT queries and any UI components that display it (around line 5030-5032)
   - **Note:** No direct equivalent exists - confusion is not the same as "not helpful" feedback
   - **Alternative:** Could use `notHelpfulCount / (helpfulCount + notHelpfulCount)` as "dissatisfaction rate" but this is semantically different

## Tests

1. **Test:** Verify Phase 4.2 queries work with satisfactionRate
   - **Input:** Chunk_Performance records with satisfactionRate but no sentiment fields
   - **Expected:** Queries return results using satisfactionRate

2. **Test:** Verify Phase 4.2 prerequisites don't reference Phase 4.1
   - **Input:** Read Phase 4.2 prerequisites section
   - **Expected:** No mention of Phase 4.1 or sentiment analysis

3. **Test:** Verify Phase 4.3 unchanged
   - **Input:** Read Phase 4.3 section
   - **Expected:** No changes, no sentiment dependencies (except vercel.json cron removal)

4. **Test:** Verify confusionRate removed from queries and UI
   - **Input:** Check Phase 4.2 queries and dashboard components
   - **Expected:** No references to confusionRate in SELECT statements or display code

5. **Test:** Verify WHERE clauses include satisfactionRate > 0 check
   - **Input:** Check Phase 4.2 underperforming and top performing queries
   - **Expected:** Both queries include `AND "satisfactionRate" > 0` to ensure only chunks with feedback are shown

## Approval Prompt

Approve the plan to proceed with removing sentiment analysis from Phase 4? (Yes / Answer questions / Edit)

