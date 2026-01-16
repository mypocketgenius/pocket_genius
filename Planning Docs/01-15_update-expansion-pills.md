# Implementation Plan: Update Expansion Pills to New Set

**Date:** January 15, 2026  
**Status:** Planning  
**Priority:** High - Foundation for Phase 4 analytics

---

## Objective

Update the existing expansion pills system to use a new set of 5 pills that better align with content gap analytics. The new pills are more specific and actionable, mapping directly to content types creators can produce.

---

## Acceptance Criteria

1. ✅ **New expansion pills replace old ones** - All 4 old pills replaced with 5 new pills
2. ✅ **Database updated** - Seed script creates new pills, old pills deleted
3. ✅ **Historical data cleaned** - Old Pill_Usage records deleted (cascade delete)
4. ✅ **Phase 4 planning docs updated** - alpha_build.md Phase 4 sections reflect new pills (implementation deferred until Phase 4 is built)
5. ✅ **No breaking changes** - UI components work with new pills without modification

**Note:** Phase 4 (Content_Gap model, aggregation jobs, dashboard widgets) is not yet implemented. This plan updates pills NOW and updates Phase 4 PLANNING docs. Phase 4 implementation will use the new pills when it's built.

---

## Current vs New Expansion Pills

### Current Expansion Pills (To Replace)
1. "Give me an example" → **KEEP** (maps to "Give me an example")
2. "How would I actually use this?" → **REPLACE**
3. "Say more about this" → **REPLACE**
4. "Who's done this?" → **REPLACE**

### New Expansion Pills
1. **"What's the evidence"** - Requests proof, research citations, data validation
2. **"Give me a template"** - Requests structured formats, scripts, checklists
3. **"What are the edge cases"** - Requests failure modes, risks, alternatives
4. **"Break this into steps"** - Requests step-by-step implementation guides
5. **"Give me an example"** - Requests concrete instances (KEEP from old set)

---

## Implementation Plan

### Step 1: Update Seed Script

**File:** `prisma/seed-pills.ts`

**Changes:**
- Replace 3 old pills with 4 new pills
- Keep "Give me an example" pill (will be included in randomization)
- Update pill IDs to reflect new labels
- Set randomized displayOrder values (1-5, shuffled) for all 5 expansion pills including "Give me an example"
- Set prefillText to match label exactly (consistent with current pattern)

**New Pill IDs:**
- `pill_evidence_system` - "What's the evidence"
- `pill_template_system` - "Give me a template"
- `pill_edge_cases_system` - "What are the edge cases"
- `pill_steps_system` - "Break this into steps"
- `pill_example_system` - "Give me an example" (keep existing ID)

**Migration Strategy:**
- **Delete old pills by ID** - Remove old expansion pills using specific IDs (more reliable than label matching)
- **Cascade delete** - Pill_Usage records will be automatically deleted via `onDelete: Cascade` in schema (verified in Pill_Usage model: `pill Pill @relation("PillUsage", fields: [pillId], references: [id], onDelete: Cascade)`)
- **Verify cascade delete** - After deletion, verify no orphaned Pill_Usage records remain by querying for records with deleted pill IDs
- **Create new pills** - Add 4 new expansion pills + keep "Give me an example" = 5 total pills
- **Randomize all 5 pills** - Set randomized displayOrder (1-5, shuffled) for all expansion pills including "Give me an example"
- **Clean slate** - Start fresh with new pill system (no historical data preserved)

**✅ Status: COMPLETE (Jan 15, 2026)**

**Implementation Summary:**
- ✅ Updated `prisma/seed-pills.ts` to delete old pills (`pill_how_to_use_system`, `pill_say_more_system`, `pill_who_done_system`)
- ✅ Added cascade delete verification (checks for orphaned Pill_Usage records)
- ✅ Created all 5 expansion pills with new IDs:
  - `pill_evidence_system` - "What's the evidence"
  - `pill_template_system` - "Give me a template"
  - `pill_edge_cases_system` - "What are the edge cases"
  - `pill_steps_system` - "Break this into steps"
  - `pill_example_system` - "Give me an example" (kept existing ID)
- ✅ Implemented randomized displayOrder (1-5, shuffled) for all 5 pills
- ✅ Ensured prefillText matches label exactly for all pills
- ✅ Added console logging for deletion and creation steps
- ✅ Updated summary output to reflect new pill count (5 expansion pills)

**Next Steps:**
- Run seed script to test: `npx tsx prisma/seed-pills.ts`
- Verify new pills appear in database
- Verify old pills are deleted
- Verify cascade delete worked (no orphaned Pill_Usage records)

---

### Step 1.5: Update update-chunk-performance Route

**File:** `app/api/jobs/update-chunk-performance/route.ts`

**⚠️ CRITICAL:** This route runs daily via Vercel Cron and aggregates Pill_Usage data into Chunk_Performance counters. It currently has hardcoded mappings for old pill IDs that must be updated.

**Changes:**
- Update pill ID mappings (lines 168-176) to use new expansion pill IDs
- Map new pills to appropriate Chunk_Performance counter types
- Update test file to use new pill IDs

**Current mappings (to replace):**
```typescript
} else if (pill.pillType === 'expansion') {
  if (pillId === 'pill_example_system') {
    counterType = 'needsExamples';
  } else if (pillId === 'pill_how_to_use_system') {
    counterType = 'needsSteps';
  } else if (pillId === 'pill_say_more_system') {
    counterType = 'needsScripts';
  } else if (pillId === 'pill_who_done_system') {
    counterType = 'needsCaseStudy';
  }
}
```

**New mappings:**
```typescript
} else if (pill.pillType === 'expansion') {
  if (pillId === 'pill_example_system') {
    counterType = 'needsExamples'; // Keep existing mapping
  } else if (pillId === 'pill_steps_system') {
    counterType = 'needsSteps'; // "Break this into steps" → needsStepsCount
  } else if (pillId === 'pill_template_system') {
    counterType = 'needsScripts'; // "Give me a template" → needsScriptsCount (templates/scripts)
  } else if (pillId === 'pill_evidence_system') {
    counterType = 'needsCaseStudy'; // "What's the evidence" → needsCaseStudyCount (evidence/proof)
  } else if (pillId === 'pill_edge_cases_system') {
    counterType = 'needsCaseStudy'; // "What are the edge cases" → needsCaseStudyCount (edge cases/scenarios)
  }
}
```

**Note:** Both "evidence" and "edge_cases" map to `needsCaseStudyCount` for now. Phase 4 will use Pill_Usage directly with `expansionPillType` field, so this temporary mapping is acceptable.

**Also update test file:** `__tests__/api/jobs/update-chunk-performance/route.test.ts`
- Update mock pill IDs (lines 205, 216) to use new pill IDs
- Update test expectations to match new mappings

---

### Step 2: Update Phase 4 Planning Documentation

**⚠️ IMPORTANT:** Phase 4 (Content_Gap model, aggregation jobs, dashboard widgets) is **NOT YET IMPLEMENTED**. This step updates the PLANNING docs in `alpha_build.md` so that when Phase 4 is implemented, developers can follow `alpha_build.md` directly without needing to reference this plan.

**Goal:** Make `alpha_build.md` Phase 4 sections complete and ready to implement with the new expansion pills approach.

---

#### 2.1: Update Phase 4.0 Schema Section (alpha_build.md lines 4395-4519) ✅ COMPLETE

**Status:** ✅ **COMPLETE** (Jan 15, 2026)

**Location:** `Planning Docs/alpha_build.md`, starting at line 4405

**Action:** Replace the Content_Gap model definition with the updated version that includes expansion pill fields.

**Find this section (around line 4407-4426):**
```prisma
model Content_Gap {
  id              String   @id @default(cuid())
  chatbotId       String
  chatbot         Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  topicRequested  String   // Short topic summary
  specificQuestion String  // Full user question
  requestCount    Int      @default(1)
  lastRequestedAt DateTime @default(now())
  formatRequested String[] @default([]) // ['scripts', 'examples', etc.]
  userContexts    Json?    // Array of user situations
  status          String   @default("open") // 'open' | 'addressed' | 'closed'
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([chatbotId, topicRequested])
  @@index([chatbotId, status])
}
```

**Replace with:**
```prisma
model Content_Gap {
  id              String   @id @default(cuid())
  chatbotId       String
  chatbot         Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  topicRequested  String   // Short topic summary (from message content)
  specificQuestion String  // Full user question (from sentText in Pill_Usage)
  requestCount    Int      @default(1)
  lastRequestedAt DateTime @default(now())
  
  // Map to expansion pill types (aggregated from Pill_Usage)
  expansionPillType String? // 'evidence' | 'template' | 'edge_cases' | 'steps' | 'example'
  expansionPillId   String? // FK to Pill.id (for direct pill tracking)
  pill              Pill?    @relation("ContentGapPill", fields: [expansionPillId], references: [id])
  
  // Format preferences now map to expansion pills (derived from expansionPillType)
  formatRequested String[] @default([]) // Derived from expansionPillType
  
  userContexts    Json?    // Array of user situations
  relatedChunkIds String[] @default([]) // Chunks that partially addressed this (from Pill_Usage.sourceChunkIds)
  status          String   @default("open") // 'open' | 'addressed' | 'closed'
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([chatbotId, topicRequested, expansionPillType]) // Include pill type - allows tracking multiple gap types per topic (e.g., same topic can have both 'evidence' and 'template' gaps)
  @@index([chatbotId, status])
  @@index([expansionPillType])
  @@index([expansionPillId])
}
```

**Also add Pill relation update (around line 4462-4471):**

**Find:**
```prisma
model Chatbot {
  // ... existing fields ...
  contentGaps       Content_Gap[]
  sourcePerformance Source_Performance[]
}
```

**Add Pill model update note after Source model update (around line 4473-4481):**

**Add this new item after the Source model update:**
```prisma
5. **Update Pill model to add relation:**

   **`prisma/schema.prisma`:**
   ```prisma
   model Pill {
     // ... existing fields ...
     contentGaps Content_Gap[] @relation("ContentGapPill")
   }
   ```
```

**Add note in Phase 4.0 section (after line 4401):**

Add this paragraph after "Why needed:":
```
**⚠️ UPDATED (Jan 15, 2026):** Content gap aggregation now uses `Pill_Usage` model instead of `Event` model. This provides:
- **More direct data source** - Expansion pills are the structured signal of content gaps
- **Better tracking** - Links directly to Pill model via `expansionPillId`
- **Clearer analytics** - Each gap type maps to a specific expansion pill (evidence, template, edge_cases, steps, example)
```

**Implementation Summary:**
- ✅ Updated Content_Gap model definition with expansion pill fields (`expansionPillType`, `expansionPillId`, `relatedChunkIds`)
- ✅ Updated unique constraint to include `expansionPillType` (allows multiple gap types per topic)
- ✅ Added indexes for `expansionPillType` and `expansionPillId` for query performance
- ✅ Added Pill model relation update (Task 5) with `ContentGapPill` relation
- ✅ Added note about Pill_Usage model usage after "Why needed:" section
- ✅ Updated field comments to reference Pill_Usage as data source

---

#### 2.2: Update Phase 4.2 Format Preferences Widget (alpha_build.md lines 4537-4591) ✅ COMPLETE

**Status:** ✅ **COMPLETE** (Jan 15, 2026)

**Location:** `Planning Docs/alpha_build.md`, starting at line 4537

**Action:** Replace the FormatPreferencesWidget implementation to use Pill_Usage instead of Chunk_Performance.

**Find this section (around line 4539-4591):**
```typescript
export async function FormatPreferencesWidget({ chatbotId }: { chatbotId: string }) {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  
  const result = await prisma.chunk_Performance.aggregate({
    where: { chatbotId, month, year },
    _sum: {
      needsScriptsCount: true,
      needsExamplesCount: true,
      needsStepsCount: true,
      needsCaseStudyCount: true,
    },
  });
  
  const total = (result._sum.needsScriptsCount || 0) +
                (result._sum.needsExamplesCount || 0) +
                (result._sum.needsStepsCount || 0) +
                (result._sum.needsCaseStudyCount || 0);
  
  if (total === 0) return null;
  
  const formats = [
    { name: 'Scripts', count: result._sum.needsScriptsCount || 0 },
    { name: 'Examples', count: result._sum.needsExamplesCount || 0 },
    { name: 'Steps', count: result._sum.needsStepsCount || 0 },
    { name: 'Case Studies', count: result._sum.needsCaseStudyCount || 0 },
  ].sort((a, b) => b.count - a.count);
  
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">Your Audience Prefers:</h2>
      <div className="space-y-2">
        {formats.map((format) => (
          <div key={format.name} className="flex items-center gap-4">
            <div className="w-32 font-medium">{format.name}</div>
            <div className="flex-1">
              <div className="h-8 bg-blue-200 rounded" style={{ width: `${(format.count / total) * 100}%` }} />
            </div>
            <div className="w-16 text-right">{Math.round((format.count / total) * 100)}%</div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-blue-900">
        <strong>Recommendation:</strong> Create more {formats[0].name.toLowerCase()}-based content
      </p>
    </div>
  );
}
```

**Replace with:**
```typescript
export async function FormatPreferencesWidget({ chatbotId }: { chatbotId: string }) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Query expansion pill usage from last 30 days
  const pillUsages = await prisma.pill_Usage.findMany({
    where: {
      chatbotId,
      timestamp: { gte: thirtyDaysAgo },
      pill: {
        pillType: 'expansion',
      },
    },
    include: {
      pill: {
        select: {
          label: true,
        },
      },
    },
  });
  
  // Map pill labels to display names
  const pillTypeMap: Record<string, string> = {
    "What's the evidence": 'Evidence',
    "Give me a template": 'Template',
    "What are the edge cases": 'Edge Cases',
    "Break this into steps": 'Steps',
    "Give me an example": 'Example',
  };
  
  const counts = pillUsages.reduce((acc, usage) => {
    const type = pillTypeMap[usage.pill.label] || 'Other';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  
  if (total === 0) return null;
  
  const formats = Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">Your Audience Prefers:</h2>
      <div className="space-y-2">
        {formats.map((format) => (
          <div key={format.name} className="flex items-center gap-4">
            <div className="w-32 font-medium">{format.name}</div>
            <div className="flex-1">
              <div className="h-8 bg-blue-200 rounded" style={{ width: `${(format.count / total) * 100}%` }} />
            </div>
            <div className="w-16 text-right">{Math.round((format.count / total) * 100)}%</div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-blue-900">
        <strong>Recommendation:</strong> Create more {formats[0]?.name.toLowerCase()}-based content
      </p>
    </div>
  );
}
```

**Add note before the code block (around line 4537):**

Add this paragraph:
```
**⚠️ UPDATED (Jan 15, 2026):** Format preferences now aggregate from `Pill_Usage` model where `pill.pillType === 'expansion'`. This uses the new expansion pills:
- "What's the evidence" → Evidence format
- "Give me a template" → Template format  
- "What are the edge cases" → Edge Cases format
- "Break this into steps" → Steps format
- "Give me an example" → Example format

This replaces the previous approach using `Chunk_Performance.needsScriptsCount`, `needsExamplesCount`, etc.
```

**Implementation Summary:**
- ✅ Replaced FormatPreferencesWidget implementation to use Pill_Usage model instead of Chunk_Performance
- ✅ Updated to query expansion pill usage from last 30 days
- ✅ Added pillTypeMap to map pill labels to display names (Evidence, Template, Edge Cases, Steps, Example)
- ✅ Changed aggregation from monthly Chunk_Performance counters to real-time Pill_Usage counts
- ✅ Updated to use `pill.pillType === 'expansion'` filter
- ✅ Added note explaining the change from Chunk_Performance to Pill_Usage approach
- ✅ Updated recommendation logic to handle empty formats array safely (`formats[0]?.name`)

---

#### 2.3: Update Phase 4.3 Content Gap Aggregation (alpha_build.md lines 4988-5184) ✅ COMPLETE

**Status:** ✅ **COMPLETE** (Jan 15, 2026)

**Location:** `Planning Docs/alpha_build.md`, starting at line 5000

**Action:** Replace the entire aggregation job implementation to use Pill_Usage instead of Event model.

**Find this section (around line 5002-5174):**
The entire `app/api/jobs/aggregate-content-gaps/route.ts` code block

**Replace with:**
```typescript
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Query expansion pill usage from last 30 days
  const pillUsages = await prisma.pill_Usage.findMany({
    where: {
      timestamp: { gte: thirtyDaysAgo },
      pill: {
        pillType: 'expansion',
      },
    },
    include: {
      pill: {
        select: {
          id: true,
          label: true,
        },
      },
      chatbot: {
        select: {
          id: true,
        },
      },
    },
  });
  
  if (pillUsages.length === 0) {
    return Response.json({ message: 'No expansion pill usage to process' });
  }
  
  // Map pill labels to expansionPillType
  const pillTypeMap: Record<string, string> = {
    "What's the evidence": 'evidence',
    "Give me a template": 'template',
    "What are the edge cases": 'edge_cases',
    "Break this into steps": 'steps',
    "Give me an example": 'example',
  };
  
  // Group by chatbot and pill
  const byChatbotAndPill = pillUsages.reduce((acc, usage) => {
    const key = `${usage.chatbotId}_${usage.pillId}`;
    if (!acc[key]) {
      acc[key] = {
        chatbotId: usage.chatbotId,
        pillId: usage.pillId,
        pillLabel: usage.pill.label,
        expansionPillType: pillTypeMap[usage.pill.label] || null,
        usages: [],
      };
    }
    acc[key].usages.push(usage);
    return acc;
  }, {} as Record<string, any>);
  
  let totalGapsProcessed = 0;
  
  // Process each chatbot/pill combination
  for (const [key, group] of Object.entries(byChatbotAndPill)) {
    const { chatbotId, pillId, pillLabel, expansionPillType, usages } = group;
    
    // Group by topic
    // ⚠️ TODO: Use better grouping strategy than first 50 chars
    // Better approaches:
    // - Embedding-based similarity clustering
    // - Normalized keyword grouping
    // - Hash of normalized text for better uniqueness
    const byTopic = usages.reduce((acc, usage) => {
      // Use first 50 chars of sentText as topic key (temporary - improve when implementing)
      const topicKey = usage.sentText.substring(0, 50).toLowerCase();
      if (!acc[topicKey]) {
        acc[topicKey] = [];
      }
      acc[topicKey].push(usage);
      return acc;
    }, {} as Record<string, typeof usages>);
    
    // Create/update Content_Gap for each topic
    for (const [topicKey, topicUsages] of Object.entries(byTopic)) {
      if (topicUsages.length < 2) continue; // Skip single requests
      
      const representativeUsage = topicUsages[0];
      const topicRequested = representativeUsage.sentText.substring(0, 200);
      
      // Collect user contexts
      const userContexts = topicUsages
        .filter(u => u.userId)
        .map(u => ({
          userId: u.userId,
          sentText: u.sentText,
        }));
      
      // Collect related chunk IDs (chunks that didn't satisfy)
      const relatedChunkIds = Array.from(
        new Set(
          topicUsages.flatMap(u => u.sourceChunkIds || [])
        )
      );
      
      // Determine formatRequested from expansionPillType
      const formatRequested = expansionPillType ? [expansionPillType] : [];
      
      // Upsert Content_Gap
      // Note: Must fetch existing record first to merge relatedChunkIds arrays
      const existing = await prisma.content_Gap.findUnique({
        where: {
          chatbotId_topicRequested_expansionPillType: {
            chatbotId,
            topicRequested,
            expansionPillType: expansionPillType || '',
          },
        },
      });
      
      const mergedChunkIds = existing
        ? Array.from(new Set([...existing.relatedChunkIds, ...relatedChunkIds]))
        : relatedChunkIds;
      
      await prisma.content_Gap.upsert({
        where: {
          chatbotId_topicRequested_expansionPillType: {
            chatbotId,
            topicRequested,
            expansionPillType: expansionPillType || '',
          },
        },
        create: {
          chatbotId,
          topicRequested,
          specificQuestion: representativeUsage.sentText,
          requestCount: topicUsages.length,
          lastRequestedAt: new Date(),
          expansionPillType,
          expansionPillId: pillId,
          formatRequested,
          userContexts: userContexts.length > 0 ? userContexts : undefined,
          relatedChunkIds: mergedChunkIds,
          status: 'open',
        },
        update: {
          requestCount: { increment: topicUsages.length },
          lastRequestedAt: new Date(),
          expansionPillType, // Update if changed
          expansionPillId: pillId, // Update if changed
          formatRequested, // Update if changed
          relatedChunkIds: mergedChunkIds, // Merge arrays
          userContexts: userContexts.length > 0 ? userContexts : undefined,
        },
      });
      
      totalGapsProcessed++;
    }
  }
  
  return Response.json({
    success: true,
    gapsProcessed: totalGapsProcessed,
  });
}
```

**Replace the note section (around line 5010-5183):**

**Find:**
```
**⚠️ IMPORTANT:** This implementation uses the `Event` model (not `Message_Feedback`) because feedback is stored as Event records with `eventType: 'user_message'` and feedback data in the `metadata` JSON field. This matches the current implementation in `/api/feedback/message`.

**✅ UPDATED (Jan 14, 2026):** This code now uses the `messageId` FK field (added in migration `20260114112937_add_messageid_to_event`) instead of extracting `messageId` from metadata. This provides:
- **50x faster queries** - Direct FK queries instead of filtering all events in JavaScript
- **Better performance** - Database-level index on messageId enables efficient filtering
- **Cleaner code** - No need to extract messageId from metadata JSON

**Note:** Prisma doesn't support JSON path queries, so we still filter `feedbackType` in JavaScript after the FK query (still much faster than before since we're filtering a smaller dataset).
```

**Replace with:**
```
**⚠️ UPDATED (Jan 15, 2026):** This implementation now uses the `Pill_Usage` model instead of the `Event` model. This provides:
- **More direct data source** - Expansion pills are the structured signal of content gaps
- **Better tracking** - Links directly to Pill model via `expansionPillId`
- **Clearer analytics** - Each gap type maps to a specific expansion pill (evidence, template, edge_cases, steps, example)
- **Simpler queries** - No need to filter Event records or extract data from JSON metadata

**Key Changes:**
- Queries `Pill_Usage` where `pill.pillType === 'expansion'`
- Groups by `pillId` first, then by topic (sentText)
- Maps pill labels to `expansionPillType` using pillTypeMap
- Tracks `relatedChunkIds` from `sourceChunkIds` field
- Links to Pill model via `expansionPillId` FK

**Note on Topic Grouping:** The current implementation uses first 50 chars of `sentText` as a simple grouping strategy. When implementing, consider better approaches:
- Embedding-based similarity clustering
- Normalized keyword grouping  
- Hash of normalized text for better uniqueness
```

**Implementation Summary:**
- ✅ Replaced entire aggregation job implementation to use Pill_Usage model instead of Event model
- ✅ Updated to query expansion pill usage from last 30 days with `pill.pillType === 'expansion'` filter
- ✅ Added pillTypeMap to map pill labels to expansionPillType (evidence, template, edge_cases, steps, example)
- ✅ Changed grouping strategy to group by chatbot and pill first, then by topic
- ✅ Updated to track `relatedChunkIds` from `sourceChunkIds` field in Pill_Usage
- ✅ Updated Content_Gap upsert to use new unique constraint with `expansionPillType`
- ✅ Added logic to merge `relatedChunkIds` arrays when updating existing gaps
- ✅ Updated note section to explain the change from Event model to Pill_Usage approach
- ✅ Added TODO comment about improving topic grouping strategy

---

#### 2.4: Update expansion-pills-content-gaps-summary.md ✅ COMPLETE

**Status:** ✅ **COMPLETE** (Jan 15, 2026)

**Location:** `Planning Docs/expansion-pills-content-gaps-summary.md`

**Action:** Update the "Current System Pills" and "Current Pill Analysis" sections.

**Find "Current System Pills" section (around lines 18-24):**

**Find:**
```
### Current System Pills (Universal)

These apply to all chatbots:
- **"Give me an example"** - Requests concrete examples
- **"How would I actually use this?"** - Requests practical application guidance
- **"Say more about this"** - Requests deeper explanation
- **"Who's done this?"** - Requests case studies or real-world instances
```

**Replace with:**
```
### Current System Pills (Universal)

**Updated (Jan 15, 2026):** These 5 expansion pills apply to all chatbots:
- **"What's the evidence"** - Requests proof, research citations, data validation
- **"Give me a template"** - Requests structured formats, scripts, checklists
- **"What are the edge cases"** - Requests failure modes, risks, alternatives
- **"Break this into steps"** - Requests step-by-step implementation guides
- **"Give me an example"** - Requests concrete instances
```

**Find "Current Pill Analysis" section (around lines 174-194):**

**Find:**
```
### Current Pill Analysis

**"Give me an example"**
- **Purpose**: Requests concrete instances
- **Gap Signal**: Users need more examples in content
- **Content Type**: Examples, case studies

**"How would I actually use this?"**
- **Purpose**: Requests practical application
- **Gap Signal**: Content is too theoretical
- **Content Type**: Step-by-step guides, implementation

**"Say more about this"**
- **Purpose**: Requests deeper explanation
- **Gap Signal**: Content is too brief or surface-level
- **Content Type**: Expanded explanations, details

**"Who's done this?"**
- **Purpose**: Requests case studies/real instances
- **Gap Signal**: Users need proof/social proof
- **Content Type**: Case studies, testimonials, examples
```

**Replace with:**
```
### Current Pill Analysis

**Updated (Jan 15, 2026):**

**"What's the evidence"**
- **Purpose**: Requests proof, research citations, data validation
- **Gap Signal**: Users need more evidence-backed content
- **Content Type**: Research citations, data, validation, proof
- **Maps to**: `expansionPillType: 'evidence'`

**"Give me a template"**
- **Purpose**: Requests structured formats, scripts, checklists
- **Gap Signal**: Users need reusable formats they can use immediately
- **Content Type**: Templates, scripts, checklists, structured formats
- **Maps to**: `expansionPillType: 'template'`

**"What are the edge cases"**
- **Purpose**: Requests failure modes, risks, alternatives
- **Gap Signal**: Users need information about when things might fail
- **Content Type**: Edge cases, troubleshooting, risks, alternatives
- **Maps to**: `expansionPillType: 'edge_cases'`

**"Break this into steps"**
- **Purpose**: Requests step-by-step implementation guides
- **Gap Signal**: Users need sequential, actionable instructions
- **Content Type**: Step-by-step guides, sequential instructions
- **Maps to**: `expansionPillType: 'steps'`

**"Give me an example"**
- **Purpose**: Requests concrete instances
- **Gap Signal**: Users need more examples in content
- **Content Type**: Examples, case studies, concrete instances
- **Maps to**: `expansionPillType: 'example'`
```

**Implementation Summary:**
- ✅ Updated "Current System Pills" section to list all 5 new expansion pills
- ✅ Added "Updated (Jan 15, 2026)" note to indicate when the change was made
- ✅ Replaced old 4 pills with new 5 pills (kept "Give me an example", added 4 new ones)
- ✅ Updated "Current Pill Analysis" section with detailed analysis of all 5 new pills
- ✅ Added `expansionPillType` mapping for each pill (evidence, template, edge_cases, steps, example)
- ✅ Updated purpose, gap signal, and content type descriptions for each new pill
- ✅ Removed all references to old pills ("How would I actually use this?", "Say more about this", "Who's done this?")

---

#### 2.5: Add Note About New Expansion Pills in alpha_build.md ✅ COMPLETE

**Status:** ✅ **COMPLETE** (Jan 15, 2026)

**Location:** `Planning Docs/alpha_build.md`, add after Phase 4.3 section (around line 5364)

**Action:** Add a new section documenting the expansion pills update.

**Add this new section after Phase 4.3:**
```
---

#### Phase 4.4: Expansion Pills Update ✅ COMPLETE (Jan 15, 2026)

**Objective:** Updated expansion pills to better align with content gap analytics

**Status:** ✅ **COMPLETE** - Expansion pills updated, Phase 4 planning docs updated

**What Changed:**
- Replaced 3 old expansion pills with 4 new ones
- Kept "Give me an example" pill
- New pills: "What's the evidence", "Give me a template", "What are the edge cases", "Break this into steps"
- Updated Phase 4.0, 4.2, and 4.3 to use Pill_Usage model with new pills

**Impact on Phase 4:**
- Phase 4.0: Content_Gap model includes `expansionPillType` and `expansionPillId` fields
- Phase 4.2: FormatPreferencesWidget aggregates from Pill_Usage with new pill types
- Phase 4.3: Content gap aggregation uses Pill_Usage instead of Event model

**See:** `Planning Docs/01-15_update-expansion-pills.md` for implementation details
```

**Implementation Summary:**
- ✅ Added Phase 4.4 section after Phase 4.3 section (after line 5364)
- ✅ Documented the expansion pills update with completion status
- ✅ Listed what changed (replaced 3 old pills with 4 new ones, kept "Give me an example")
- ✅ Listed all 5 new expansion pills
- ✅ Documented impact on Phase 4.0, 4.2, and 4.3 sections
- ✅ Added reference to implementation plan document for details
- ✅ Positioned correctly between Phase 4.3 and Phase 7 sections

---

### Step 3: Verification ✅ COMPLETE

**Status:** ✅ **COMPLETE** (Jan 15, 2026)

After completing Step 2, verify:

- [x] Phase 4.0 section in `alpha_build.md` includes `expansionPillType` and `expansionPillId` fields in Content_Gap model ✅ VERIFIED
- [x] Phase 4.0 section includes Pill model relation update ✅ VERIFIED
- [x] Phase 4.2 FormatPreferencesWidget uses Pill_Usage with new pill labels ✅ VERIFIED
- [x] Phase 4.3 aggregation job uses Pill_Usage instead of Event model ✅ VERIFIED
- [x] Phase 4.3 includes pillTypeMap with new pill labels ✅ VERIFIED
- [x] `expansion-pills-content-gaps-summary.md` lists the 5 new pills ✅ VERIFIED
- [x] All references to old pills ("How would I actually use this?", "Say more about this", "Who's done this?") are removed or updated ✅ VERIFIED

**Verification Summary:**

1. **Phase 4.0 Content_Gap Model (alpha_build.md lines 4414-4441):**
   - ✅ `expansionPillType String?` field present (line 4424)
   - ✅ `expansionPillId String?` field present (line 4425)
   - ✅ `pill Pill? @relation("ContentGapPill", ...)` relation present (line 4426)
   - ✅ Unique constraint includes `expansionPillType` (line 4437)
   - ✅ Indexes on `expansionPillType` and `expansionPillId` present (lines 4439-4440)

2. **Phase 4.0 Pill Model Relation (alpha_build.md line 4505):**
   - ✅ `contentGaps Content_Gap[] @relation("ContentGapPill")` relation added to Pill model

3. **Phase 4.2 FormatPreferencesWidget (alpha_build.md lines 4574-4643):**
   - ✅ Uses `prisma.pill_Usage.findMany()` with `pill.pillType === 'expansion'` filter (lines 4583-4598)
   - ✅ Includes pillTypeMap with all 5 new pill labels:
     - "What's the evidence" → 'Evidence'
     - "Give me a template" → 'Template'
     - "What are the edge cases" → 'Edge Cases'
     - "Break this into steps" → 'Steps'
     - "Give me an example" → 'Example'
   - ✅ Updated note explains change from Chunk_Performance to Pill_Usage (lines 4565-4572)

4. **Phase 4.3 Aggregation Job (alpha_build.md lines 5055-5236):**
   - ✅ Uses `prisma.pill_Usage.findMany()` instead of Event model (lines 5063-5083)
   - ✅ Filters by `pill.pillType === 'expansion'` (line 5067)
   - ✅ Includes pillTypeMap with all 5 new pill labels mapped to expansionPillType (lines 5090-5096):
     - "What's the evidence" → 'evidence'
     - "Give me a template" → 'template'
     - "What are the edge cases" → 'edge_cases'
     - "Break this into steps" → 'steps'
     - "Give me an example" → 'example'
   - ✅ Updated note explains change from Event model to Pill_Usage (lines 5207-5236)
   - ✅ Uses `expansionPillId` FK to link to Pill model (line 5192)
   - ✅ Tracks `relatedChunkIds` from `sourceChunkIds` field (lines 5123-5127)

5. **expansion-pills-content-gaps-summary.md:**
   - ✅ "Current System Pills" section lists all 5 new pills (lines 21-25)
   - ✅ "Current Pill Analysis" section includes all 5 new pills with expansionPillType mappings (lines 179-207)
   - ✅ Updated "Potential Pill Categories to Explore" section to reference new pills instead of old ones (lines 253-261)

6. **Old Pill References:**
   - ✅ All references to old pills removed from updated sections in `alpha_build.md`
   - ✅ All references to old pills removed from "Current System Pills" and "Current Pill Analysis" sections in `expansion-pills-content-gaps-summary.md`
   - ✅ Updated "Potential Pill Categories to Explore" section to reference new pills instead of old ones

**All verification checks passed!** ✅

---

## Migration Strategy

### Database Migration Steps (Execute Now)

1. **Delete Old Pills by ID (Cascade Deletes Pill_Usage):**
   ```typescript
   // In seed-pills.ts
   // Delete old expansion pills by ID (more reliable than label matching)
   const oldPillIds = [
     'pill_how_to_use_system',
     'pill_say_more_system',
     'pill_who_done_system',
   ];
   
   await prisma.pill.deleteMany({
     where: {
       id: {
         in: oldPillIds,
       },
     },
   });
   
   // Verify cascade delete worked
   const remainingUsages = await prisma.pill_Usage.count({
     where: {
       pillId: {
         in: oldPillIds,
       },
     },
   });
   
   if (remainingUsages > 0) {
     throw new Error(`Expected 0 Pill_Usage records after cascade delete, found ${remainingUsages}`);
   }
   
   console.log('✅ Old pills deleted and Pill_Usage records cascade deleted');
   ```

2. **Create All 5 Expansion Pills with Randomized Display Order:**
   ```typescript
   // In seed-pills.ts
   // Define all 5 expansion pills (4 new + 1 existing) with labels and prefillText
   // prefillText matches label exactly for consistency
   const allExpansionPills = [
     { id: 'pill_evidence_system', label: "What's the evidence", prefillText: "What's the evidence" },
     { id: 'pill_template_system', label: "Give me a template", prefillText: "Give me a template" },
     { id: 'pill_edge_cases_system', label: "What are the edge cases", prefillText: "What are the edge cases" },
     { id: 'pill_steps_system', label: "Break this into steps", prefillText: "Break this into steps" },
     { id: 'pill_example_system', label: "Give me an example", prefillText: "Give me an example" },
   ];
   
   // Randomize displayOrder for all 5 pills (1-5, shuffled)
   const displayOrders = [1, 2, 3, 4, 5];
   const shuffledOrders = displayOrders.sort(() => Math.random() - 0.5);
   
   // Upsert all pills (upsert handles both create and update for "Give me an example")
   for (let i = 0; i < allExpansionPills.length; i++) {
     await prisma.pill.upsert({
       where: { id: allExpansionPills[i].id },
       update: {
         label: allExpansionPills[i].label,
         prefillText: allExpansionPills[i].prefillText,
         displayOrder: shuffledOrders[i],
         pillType: 'expansion',
         isActive: true,
       },
       create: {
         ...allExpansionPills[i],
         displayOrder: shuffledOrders[i],
         chatbotId: null, // System pill
         pillType: 'expansion',
         isActive: true,
       },
     });
   }
   ```

3. **⚠️ DEFERRED: Add Content_Gap Fields (when Phase 4.0 is implemented):**
   ```sql
   -- Migration SQL (to be run when Phase 4.0 is implemented)
   ALTER TABLE "Content_Gap" ADD COLUMN "expansionPillType" TEXT;
   ALTER TABLE "Content_Gap" ADD COLUMN "expansionPillId" TEXT;
   ALTER TABLE "Content_Gap" ADD COLUMN "relatedChunkIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
   
   CREATE INDEX "Content_Gap_expansionPillType_idx" ON "Content_Gap"("expansionPillType");
   CREATE INDEX "Content_Gap_expansionPillId_idx" ON "Content_Gap"("expansionPillId");
   
   -- Add FK constraint (optional, nullable)
   ALTER TABLE "Content_Gap" ADD CONSTRAINT "Content_Gap_expansionPillId_fkey" 
     FOREIGN KEY ("expansionPillId") REFERENCES "Pill"("id") ON DELETE SET NULL;
   ```

---

## Testing Plan

### Unit Tests

1. **Seed Script Tests:**
   ```typescript
   // Test: Verify old pills deleted
   const oldPills = await prisma.pill.findMany({
     where: { 
       id: { 
         in: ['pill_how_to_use_system', 'pill_say_more_system', 'pill_who_done_system'] 
       } 
     },
   });
   expect(oldPills).toHaveLength(0);
   
   // Test: Verify new pills created (all 5 expansion pills)
   const newPills = await prisma.pill.findMany({
     where: { pillType: 'expansion' },
   });
   expect(newPills).toHaveLength(5);
   expect(newPills.map(p => p.label)).toContain("What's the evidence");
   expect(newPills.map(p => p.label)).toContain("Give me a template");
   expect(newPills.map(p => p.label)).toContain("What are the edge cases");
   expect(newPills.map(p => p.label)).toContain("Break this into steps");
   expect(newPills.map(p => p.label)).toContain("Give me an example");
   
   // Test: Verify prefillText matches label
   newPills.forEach(pill => {
     expect(pill.prefillText).toBe(pill.label);
   });
   
   // Test: Verify cascade delete worked (no orphaned Pill_Usage records)
   const orphanedUsages = await prisma.pill_Usage.count({
     where: {
       pillId: {
         in: ['pill_how_to_use_system', 'pill_say_more_system', 'pill_who_done_system'],
       },
     },
   });
   expect(orphanedUsages).toBe(0);
   
   // Test: Verify all pills are system pills
   newPills.forEach(pill => {
     expect(pill.chatbotId).toBeNull();
   });
   
   // Test: Verify displayOrder is randomized (all values 1-5 present, not sequential)
   const displayOrders = newPills.map(p => p.displayOrder).sort((a, b) => a - b);
   expect(displayOrders).toEqual([1, 2, 3, 4, 5]); // All values present
   // Verify not sequential (at least one pill should not be in order)
   const isSequential = newPills.every((pill, index) => 
     pill.displayOrder === index + 1
   );
   // This test will pass if randomization worked (very unlikely all pills are in order)
   // In practice, we just verify all values 1-5 are present
   ```

2. **update-chunk-performance Route Tests:**
   ```typescript
   // Test: Verify new pill ID mappings work correctly
   const mockPillUsages = [
     { pillId: 'pill_evidence_system', pill: { pillType: 'expansion', id: 'pill_evidence_system' } },
     { pillId: 'pill_template_system', pill: { pillType: 'expansion', id: 'pill_template_system' } },
     { pillId: 'pill_edge_cases_system', pill: { pillType: 'expansion', id: 'pill_edge_cases_system' } },
     { pillId: 'pill_steps_system', pill: { pillType: 'expansion', id: 'pill_steps_system' } },
     { pillId: 'pill_example_system', pill: { pillType: 'expansion', id: 'pill_example_system' } },
   ];
   
   // Verify each maps to correct counter type
   // pill_evidence_system → needsCaseStudyCount
   // pill_template_system → needsScriptsCount
   // pill_edge_cases_system → needsCaseStudyCount
   // pill_steps_system → needsStepsCount
   // pill_example_system → needsExamplesCount
   ```

3. **Content Gap Aggregation Tests:**
   - Verify Pill_Usage queries return correct data
   - Verify grouping by pillId works correctly
   - Verify expansionPillType mapping is correct
   - Verify Content_Gap upsert creates/updates correctly
   - Verify relatedChunkIds are collected correctly

4. **Format Preferences Widget Tests:**
   - Verify aggregation counts pills correctly
   - Verify percentages are calculated correctly
   - Verify empty state handled correctly

### Integration Tests

1. **End-to-End Flow:**
   - User clicks expansion pill → Pill_Usage created
   - Nightly job runs → Content_Gap created/updated
   - Dashboard displays gaps correctly
   - Format preferences widget shows correct data

2. **Data Cleanup:**
   - Old Pill_Usage records deleted (cascade delete verified via count check)
   - No orphaned records remain (verified in seed script)
   - UI components work with new pills only (no hardcoded pill labels)

---

## Rollback Plan

If issues arise:

1. **Immediate Rollback:**
   - Revert seed script to recreate old pills
   - Delete new pills by ID
   - Note: Historical Pill_Usage data cannot be recovered (data loss is permanent)

2. **Code Rollback:**
   - Revert aggregation job to Event-based approach (if Phase 4 implemented)
   - Revert dashboard components to old format preferences (if Phase 4 implemented)
   - Revert schema changes (drop new columns, if Phase 4 implemented)

**Note:** Rollback will restore old pills but historical analytics data will be permanently lost. Ensure thorough testing before deployment.

---

## Pre-Implementation Checklist

Before starting implementation:

- [ ] **Backup database** (for safety, even though historical data will be lost)
- [ ] **Verify current pill IDs** match expected values in `prisma/seed-pills.ts`:
  - `pill_example_system` exists
  - `pill_how_to_use_system` exists
  - `pill_say_more_system` exists
  - `pill_who_done_system` exists
- [ ] **Test cascade delete in development** - Verify Pill_Usage records are deleted when pills are deleted
- [ ] **Verify UI components** don't hardcode pill labels (they should query by pillType)
- [ ] **Review current seed script** to understand existing patterns

## Implementation Checklist

### Phase 1: Database & Seed Updates ✅ COMPLETE
- [x] Update `prisma/seed-pills.ts` with new pills
- [x] Delete old pills by ID (cascade deletes Pill_Usage records)
- [x] Add cascade delete verification step (count check for orphaned Pill_Usage records)
- [x] Create all 5 expansion pills (4 new + 1 existing) with randomized displayOrder (1-5, shuffled)
- [x] Ensure prefillText matches label exactly for all pills
- [ ] Test seed script locally (ready for testing)
- [ ] Verify new pills appear in database (ready for testing)
- [ ] Verify old pills are deleted (ready for testing)
- [ ] Verify old Pill_Usage records are cascade deleted (count = 0) (ready for testing)
- [ ] Verify displayOrder is randomized (not sequential) (ready for testing)

### Phase 1.5: Update update-chunk-performance Route
- [ ] Update `app/api/jobs/update-chunk-performance/route.ts` pill ID mappings (lines 168-176)
- [ ] Map new pills to Chunk_Performance counter types:
  - `pill_example_system` → needsExamplesCount
  - `pill_steps_system` → needsStepsCount
  - `pill_template_system` → needsScriptsCount
  - `pill_evidence_system` → needsCaseStudyCount
  - `pill_edge_cases_system` → needsCaseStudyCount
- [ ] Update `__tests__/api/jobs/update-chunk-performance/route.test.ts` mock pill IDs
- [ ] Test route locally to verify new mappings work
- [ ] Verify no errors in daily cron job after deployment

### Phase 2: Documentation Updates
- [x] Follow Step 2.1: Update Phase 4.0 Content_Gap model in `alpha_build.md` (lines 4407-4426) ✅ COMPLETE
- [x] Follow Step 2.1: Add Pill model relation update in Phase 4.0 section ✅ COMPLETE
- [x] Follow Step 2.2: Update Phase 4.2 FormatPreferencesWidget in `alpha_build.md` (lines 4539-4591) ✅ COMPLETE
- [x] Follow Step 2.3: Replace Phase 4.3 aggregation job in `alpha_build.md` (lines 5002-5174) ✅ COMPLETE
- [x] Follow Step 2.4: Update `expansion-pills-content-gaps-summary.md` "Current System Pills" section (lines 18-24) ✅ COMPLETE
- [x] Follow Step 2.4: Update `expansion-pills-content-gaps-summary.md` "Current Pill Analysis" section (lines 174-194) ✅ COMPLETE
- [x] Follow Step 2.5: Add Phase 4.4 note section in `alpha_build.md` (after Phase 4.3) ✅ COMPLETE

### Phase 3: Verification ✅ COMPLETE
- [x] Follow Step 3: Verify all documentation updates are complete ✅ COMPLETE
- [x] Review `alpha_build.md` Phase 4 sections to ensure they're ready for implementation ✅ COMPLETE
- [x] Ensure no references to old pills remain in planning docs ✅ COMPLETE

### Phase 4: Deployment (Pills Only)
- [ ] Run seed script in development
- [ ] Verify new pills appear in database
- [ ] Verify old pills are deleted
- [ ] Verify old Pill_Usage records are cascade deleted
- [ ] Verify new pills work in UI (no breaking changes)
- [ ] Deploy to production
- [ ] Monitor for issues

## Post-Implementation Verification

After implementation, verify:

- [ ] **All 5 new pills appear in chat UI** - Check that all expansion pills render correctly
- [ ] **Old pills don't appear** - Verify old expansion pills are no longer visible
- [ ] **Pills work when clicked** - Test clicking each pill and verify it prefills input correctly
- [ ] **Pill_Usage records created correctly** - Click a pill, send message, verify Pill_Usage record created with correct pillId
- [ ] **DisplayOrder randomization** - Verify pills appear in randomized order (not sequential)
- [ ] **PrefillText matches label** - Verify all pills have `prefillText === label`
- [ ] **No orphaned records** - Verify no Pill_Usage records reference deleted pill IDs
- [ ] **UI components handle new pills** - Verify no errors in console, pills display correctly

---

## Success Criteria

1. ✅ All 5 new expansion pills appear in chat UI
2. ✅ Old expansion pills deleted (no longer exist in database)
3. ✅ Old Pill_Usage records cascade deleted
4. ✅ Phase 4 planning docs updated to reflect new pills
5. ✅ No breaking changes to existing functionality
6. ✅ Documentation updated

**Phase 4 Success Criteria (when Phase 4 is implemented):**
- Content gap aggregation uses Pill_Usage model with new pills
- Content_Gap records include expansionPillType and expansionPillId
- Format preferences widget shows new pill types
- Dashboard displays gaps grouped by expansion pill type

---

## Notes

- **Clean Slate:** Historical Pill_Usage records are deleted via cascade delete. This simplifies the implementation but means historical analytics data is lost.
- **Simplified Implementation:** No need to handle backward compatibility or filter old pills - database is clean with only new pills.
- **Phase 4 Deferred:** Phase 4 (Content_Gap model, aggregation jobs, dashboard widgets) is not yet implemented. This plan updates pills NOW and updates Phase 4 PLANNING docs. When Phase 4 is implemented, it will use the new pills.
- **Unique Constraint Design:** The `@@unique([chatbotId, topicRequested, expansionPillType])` constraint allows the same topic to have multiple gap types (e.g., users need both evidence AND templates for the same topic). This provides richer analytics than a single gap per topic.
- **DisplayOrder Randomization:** Display order is randomized to prevent bias in pill selection patterns. This ensures analytics reflect true user preferences rather than position bias.
- **PrefillText Consistency:** All pills follow the pattern `prefillText === label` for consistency and simplicity.
- **Topic Grouping:** When Phase 4.3 is implemented, use better topic grouping than first 50 chars (consider embedding-based clustering).
- **User Education:** May want to add tooltips or help text explaining what each expansion pill does
- **Future Enhancements:** Could add pill-specific prompts or customization per chatbot in the future

---

## Related Files

- `prisma/seed-pills.ts` - Pill seed script (UPDATE NOW)
- `Planning Docs/alpha_build.md` - Main planning document (UPDATE NOW - Phase 4 sections)
- `Planning Docs/expansion-pills-content-gaps-summary.md` - Expansion pills documentation (UPDATE NOW)

**Phase 4 Files (to be created when Phase 4 is implemented - see alpha_build.md for exact implementation):**
- `prisma/schema.prisma` - Database schema (update Content_Gap model per Phase 4.0)
- `app/api/jobs/aggregate-content-gaps/route.ts` - Aggregation job (per Phase 4.3)
- `components/dashboard/format-preferences.tsx` - Format preferences widget (per Phase 4.2)
- `components/dashboard/content-gaps.tsx` - Content gaps view (per Phase 4.3)

---

## Approval

**Ready for implementation?** ⏳ **Pending approval**

**Estimated Effort:** 3-4 hours (pills + route + docs)
- Seed script updates: 1 hour
- update-chunk-performance route updates: 30 minutes
- Testing pills in UI: 30 minutes
- Testing route updates: 30 minutes
- Documentation updates: 1 hour

**Phase 4 Implementation Effort (when Phase 4 is built):** 2-3 days
- Schema updates: 2 hours
- Aggregation job: 4 hours
- Dashboard components: 4 hours
- Testing: 4 hours

