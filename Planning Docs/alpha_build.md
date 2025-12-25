# Alpha Build Plan
## Post-MVP: Alpha Release (Weeks 5-10)
**Goal:** Market to users with public domain content (Art of War, etc.)
**No creator onboarding needed yet, but UI must support it later**

---

## Overview

This document contains all tasks for the **Alpha release** - a focused 6-week build focused on user validation with public domain content. Alpha prioritizes core feedback features, basic analytics, and production readiness.

**MVP Status:** ✅ Completed through Phase 6, Task 7 (Documentation)

**Alpha Timeline:** 6 weeks (Weeks 5-10)

**Total Alpha Tasks:** 10 critical tasks

---

## Task Dependencies

```
Phase 0.1 (Feedback API Fix)
  ↓
Phase 3.3, 3.4, 3.5 (Advanced Feedback)
  ↓
Phase 4.1 (Sentiment Analysis)
  ↓
Phase 4.2, 4.3 (Dashboard & Content Gaps)
  ↓
Phase 3.7, 3.8 (UI/UX & Multiple Chatbots)
  ↓
Phase 7.1, 7.2, 7.3 (Deployment)
```

**Critical Path:** 0.1 → 3.3-3.5 → 4.1 → 4.2  
**Parallel Path:** 3.7, 3.8 can be done alongside Phase 4 tasks

---

## File Structure Changes

New files created in Alpha:

```
app/
├── api/
│   ├── feedback/
│   │   ├── message/route.ts           # Enhanced for Phase 3.3-3.5
│   │   └── conversation/route.ts       # NEW in Phase 3.5
│   ├── intake/
│   │   ├── questions/route.ts         # NEW in Phase 3.10
│   │   └── responses/route.ts          # NEW in Phase 3.10
│   ├── user-context/route.ts           # NEW in Phase 3.10
│   ├── jobs/
│   │   ├── attribute-sentiment/route.ts    # NEW in Phase 4.1
│   │   ├── aggregate-source-performance/   # NEW in Phase 4.2
│   │   │   route.ts
│   │   └── aggregate-content-gaps/         # NEW in Phase 4.3
│   │       route.ts
│   └── analysis/
│       └── sentiment/route.ts          # NEW in Phase 4.1
├── profile/
│   └── page.tsx                        # NEW in Phase 3.10 (user context settings)
│
components/
├── feedback-modal.tsx                  # NEW in Phase 3.3
├── copy-feedback-modal.tsx             # NEW in Phase 3.4
├── conversation-feedback-modal.tsx     # NEW in Phase 3.5
├── intake-form.tsx                     # NEW in Phase 3.10
├── user-context-editor.tsx             # NEW in Phase 3.10
└── dashboard/
    ├── format-preferences.tsx          # NEW in Phase 4.2
    ├── chunk-performance.tsx           # ENHANCED in Phase 4.2
    ├── source-performance.tsx          # NEW in Phase 4.2
    ├── content-gaps.tsx                # NEW in Phase 4.3
    └── version-history.tsx            # NEW in Phase 3.9 (optional)

lib/
├── analysis/
│   └── sentiment.ts                    # NEW in Phase 4.1
└── chatbot/
    └── versioning.ts                   # NEW in Phase 3.9

prisma/
└── schema.prisma                       # UPDATED: Chatbot_Version, Intake_Question, Intake_Response, User_Context, Favorited_Chatbots, Message_Feedback (copyUsage, copyContext), Chunk_Performance (copyToUseNowCount), Source_Performance
```

---

## Phase 0: Critical Fixes (Week 5) 🚨

### **MUST DO FIRST - BLOCKING**

#### Phase 0.1: Fix Feedback API Performance ✅ COMPLETE

**Status:** ✅ **COMPLETE**

**Priority:** CRITICAL - Do immediately

**Why:** Current implementation queries all chunks in message context synchronously, causing 2-3s delays. Poor UX - users think app is broken.

**Impact:** Poor user experience - users click feedback buttons and wait several seconds for response.

**Solution:** Batch database operations instead of sequential queries.

**Tasks:**

1. **Update `app/api/feedback/message/route.ts`:**

   Replace the sequential loop (lines 112-204) with batched operations:

   ```typescript
   // OLD CODE (SLOW - sequential queries):
   // for (const chunk of chunks) {
   //   let current = await prisma.chunk_Performance.findUnique(...);
   //   if (!current) {
   //     current = await prisma.chunk_Performance.create(...);
   //   }
   //   await prisma.chunk_Performance.update(...);
   // }

   // NEW CODE (FAST - batched operations):
   
   // 1. Get all existing chunk performance records in one query
   const existingRecords = await prisma.chunk_Performance.findMany({
     where: {
       chatbotId,
       month,
       year,
       chunkId: { in: chunks.map(c => c.chunkId) },
     },
   });
   
   // 2. Prepare batch creates and updates
   const recordsToCreate = chunks.filter(chunk => 
     !existingRecords.find(r => r.chunkId === chunk.chunkId)
   );
   const recordsToUpdate = chunks.filter(chunk =>
     existingRecords.find(r => r.chunkId === chunk.chunkId)
   );
   
   // 3. Batch create new records
   if (recordsToCreate.length > 0) {
     await prisma.chunk_Performance.createMany({
       data: recordsToCreate.map(chunk => ({
         chunkId: chunk.chunkId,
         sourceId: chunk.sourceId,
         chatbotId,
         month,
         year,
         timesUsed: 0,
         helpfulCount: feedbackType === 'helpful' ? 1 : 0,
         notHelpfulCount: feedbackType === 'not_helpful' ? 1 : 0,
         satisfactionRate: feedbackType === 'helpful' ? 1.0 : 0.0,
       })),
       skipDuplicates: true, // Handle race conditions
     });
   }
   
   // 4. Batch update existing records (use transaction)
   if (recordsToUpdate.length > 0) {
     await prisma.$transaction(
       recordsToUpdate.map(chunk => {
         const current = existingRecords.find(r => r.chunkId === chunk.chunkId)!;
         const newHelpfulCount = feedbackType === 'helpful' 
           ? current.helpfulCount + 1 
           : current.helpfulCount;
         const newNotHelpfulCount = feedbackType === 'not_helpful'
           ? current.notHelpfulCount + 1
           : current.notHelpfulCount;
         const totalFeedback = newHelpfulCount + newNotHelpfulCount;
         const satisfactionRate = totalFeedback > 0 
           ? newHelpfulCount / totalFeedback 
           : 0;
         
         return prisma.chunk_Performance.update({
           where: {
             chunkId_chatbotId_month_year: {
               chunkId: chunk.chunkId,
               chatbotId,
               month,
               year,
             },
           },
           data: {
             [feedbackType === 'helpful' ? 'helpfulCount' : 'notHelpfulCount']: {
               increment: 1,
             },
             satisfactionRate,
           },
         });
       })
     );
   }
   ```

2. **Test the fix:**
   - Click feedback buttons in chat
   - Verify response time is <500ms
   - Verify feedback is still stored correctly
   - Verify chunk performance counters update correctly

**Expected Results:**
- ✅ Feedback API response time: **<500ms** (down from 2-5 seconds)
- ✅ No functional changes - same behavior, faster execution
- ✅ Better user experience - instant feedback

**Deliverables:**
- ✅ Optimized feedback API route
- ✅ Batched database operations
- ✅ Response time <500ms
- ✅ All tests passing

**Testing:**
- [x] Unit tests pass ✅
- [x] Integration tests pass ✅
- [x] Manual testing checklist complete ✅

**⚠️ IMPORTANT:** Complete Phase 0.1 before moving to any other features below.

**✅ COMPLETED:** Phase 0.1 is complete. Feedback API now uses batched operations and responds in <500ms. All tests passing. Ready to proceed to Phase 3.

**📝 NOTE:** After completing Phase 3.3 and 3.4 (Dec 18, 2025), a side quest was undertaken to migrate from modal-based feedback to pill-based feedback UX (see `Planning Docs/12-19_feedback_ux_update.md`). This migration:
- Replaced the "Need More" modal (Phase 3.3) with expansion pills
- Kept the copy feedback modal (Phase 3.4) per plan decision
- Integrated Phase 3.5 conversation feedback into the star rating system instead of creating a separate modal
- All functionality is working, but implemented differently than originally planned

---

## Phase 3: Advanced Feedback & Core Features (Weeks 5-7)

### **CRITICAL FOR ALPHA**

#### Phase 3.3: "Need More" Modal ✅ COMPLETE

**Objective:** Add detailed feedback modal when user needs more information

**Why needed for Alpha:** Core feedback mechanism for understanding what content is missing

**Prerequisites:**
- ✅ Basic feedback API working (`/api/feedback/message`)
- ✅ Message_Feedback table supports `needsMore` array and `specificSituation` field

**Tasks:**

1. **Create feedback modal component:**

   **`components/feedback-modal.tsx`:**
   ```typescript
   'use client';
   
   import { useState } from 'react';
   import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
   import { Button } from './ui/button';
   import { Textarea } from './ui/textarea';
   import { Checkbox } from './ui/checkbox';
   
   interface FeedbackModalProps {
     open: boolean;
     onClose: () => void;
     messageId: string;
   }
   
   export function FeedbackModal({ open, onClose, messageId }: FeedbackModalProps) {
     const [needsMore, setNeedsMore] = useState<string[]>([]);
     const [situation, setSituation] = useState('');
     const [submitting, setSubmitting] = useState(false);
     
     const options = [
       { value: 'scripts', label: 'Scripts or exact words to use' },
       { value: 'examples', label: 'More examples' },
       { value: 'steps', label: 'Step-by-step instructions' },
       { value: 'case_studies', label: 'Case studies or real scenarios' },
     ];
     
     async function handleSubmit() {
       setSubmitting(true);
       
       await fetch('/api/feedback/message', {
         method: 'POST',
         body: JSON.stringify({
           messageId,
           feedbackType: 'need_more',
           needsMore,
           specificSituation: situation,
         }),
       });
       
       setSubmitting(false);
       onClose();
     }
     
     return (
       <Dialog open={open} onOpenChange={onClose}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>What would make this more helpful?</DialogTitle>
           </DialogHeader>
           
           <div className="space-y-4">
             <div className="space-y-2">
               {options.map((option) => (
                 <label key={option.value} className="flex items-center gap-2">
                   <Checkbox
                     checked={needsMore.includes(option.value)}
                     onCheckedChange={(checked) => {
                       if (checked) {
                         setNeedsMore([...needsMore, option.value]);
                       } else {
                         setNeedsMore(needsMore.filter(v => v !== option.value));
                       }
                     }}
                   />
                   <span>{option.label}</span>
                 </label>
               ))}
             </div>
             
             <div>
               <label className="text-sm font-medium">
                 What's your specific situation? (optional)
               </label>
               <Textarea
                 value={situation}
                 onChange={(e) => setSituation(e.target.value)}
                 placeholder="I'm trying to..."
                 rows={3}
               />
             </div>
             
             <Button
               onClick={handleSubmit}
               disabled={submitting || needsMore.length === 0}
               className="w-full"
             >
               Submit Feedback
             </Button>
           </div>
         </DialogContent>
       </Dialog>
     );
   }
   ```

2. **Update feedback API to handle needsMore:**

   Update `app/api/feedback/message/route.ts` to:
   - Accept `needsMore` array and `specificSituation` string
   - Store in `Message_Feedback` table
   - Update `Chunk_Performance` counters (`needsScriptsCount`, `needsExamplesCount`, `needsStepsCount`, `needsCaseStudyCount`)

3. **Integrate modal into message list:**

   Update `components/chat.tsx` (or `components/message-list.tsx`):
   ```typescript
   import { FeedbackModal } from './feedback-modal';
   import { Lightbulb } from 'lucide-react';
   
   // Add state
   const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
   const [selectedMessageId, setSelectedMessageId] = useState('');
   
   // Update lightbulb button
   <Button
     size="sm"
     variant="ghost"
     onClick={() => {
       setSelectedMessageId(message.id);
       setFeedbackModalOpen(true);
     }}
   >
     <Lightbulb className="w-4 h-4" />
   </Button>
   
   // Add modal at end of component
   <FeedbackModal
     open={feedbackModalOpen}
     onClose={() => setFeedbackModalOpen(false)}
     messageId={selectedMessageId}
   />
   ```

**Deliverables:**
- ✅ "Need more" modal with checkboxes
- ✅ Free text for user situation
- ✅ Feedback stored with needsMore array
- ✅ Chunk_Performance counters updated
- ✅ Thank you message with 4-second display
- ✅ Button state tracking (blue when clicked)
- ✅ Authorization fix for anonymous conversations

**Testing:**
- [x] Unit tests pass ✅
- [x] Integration tests pass ✅
- [x] Manual testing checklist complete ✅

**Status:** ✅ **COMPLETE** (Dec 18, 2025) - All deliverables implemented and tested

**Note:** This modal was later replaced by expansion pills during the feedback UX update (Dec 19, 2025). See `Planning Docs/12-19_feedback_ux_update.md` for details.

---

#### Phase 3.4: Copy Button with Feedback ✅ COMPLETE

**Objective:** Add copy button that triggers feedback modal immediately after copy

**Why needed for Alpha:** Key behavioral signal for content usefulness

**Prerequisites:**
- ✅ Message_Feedback table supports `copyUsage` and `copyContext` fields
- ✅ Chunk_Performance table supports `copyToUseNowCount` counter

**Implementation Summary:**

1. **Copy Button:**
   - Added as first button (before helpful) on all AI messages
   - Uses iOS clipboard fallback (execCommand) for Safari/Chrome compatibility
   - Mobile responsive (icon-only on small screens, icon+text on larger)
   - Immediately opens feedback modal after copy (no toast prompt)

2. **Copy Feedback Modal:**
   - Opens immediately when copy button is clicked
   - Title: "✓ Copied! What will you use this for?"
   - Radio-style buttons for usage selection:
     - Reference / save for later
     - Use in my work right now
     - Share with my team
     - Adapt for my specific situation
   - Conditional textarea for "adapt" option
   - No skip button (removed)
   - Shows success toast notification on submit (same as helpful/not_helpful)

3. **API Implementation:**
   - Prevents duplicate copy feedback records (one per message/user)
   - Updates existing copy feedback record when usage is submitted
   - Tracks copy events with `copyUsage` and `copyContext` fields
   - Updates `Chunk_Performance.copyToUseNowCount` when `copyUsage === 'use_now'`
   - Prevents duplicate feedback for all types (helpful, not_helpful, need_more, copy)

**Key Features:**
- ✅ Copy button on AI messages (first button, responsive design)
- ✅ Modal opens immediately after copy (no intermediate toast)
- ✅ iOS clipboard fallback support
- ✅ Mobile responsive (icons adapt to screen size)
- ✅ Copy usage tracking (reference, use_now, share_team, adapt)
- ✅ Context collection for "adapt" usage
- ✅ Chunk_Performance.copyToUseNowCount counter updates
- ✅ Duplicate prevention (one record per message/user/type)
- ✅ Toast notification on success (consistent with other feedback)
- ✅ Database schema updated with copyUsage and copyContext fields

**Files Created/Modified:**
- `components/copy-feedback-modal.tsx` - Copy feedback modal component
- `components/chat.tsx` - Added copy button and modal integration
- `app/api/feedback/message/route.ts` - Copy feedback handling and duplicate prevention
- `prisma/schema.prisma` - Added copyUsage, copyContext, copyToUseNowCount fields
- `tailwind.config.ts` - Added xs breakpoint for responsive design

**Testing:**
- [x] Unit tests pass ✅
- [x] Integration tests pass ✅
- [x] Manual testing checklist complete ✅

**Status:** ✅ **COMPLETE** (Dec 18, 2025) - All deliverables implemented and tested

**Note:** The copy feedback modal was kept during the feedback UX update (Dec 19, 2025) per plan decision. It remains functional and collects copy usage data.

---

#### Phase 3.5: End-of-Conversation Survey ⚠️ PARTIALLY IMPLEMENTED (Different Approach)

**Status:** ⚠️ **PARTIALLY IMPLEMENTED** - Functionality exists but implemented differently than originally planned

**What Actually Happened:**
- **Original Plan:** Create separate `conversation-feedback-modal.tsx` component triggered by copy button click
- **Actual Implementation:** Phase 3.5 functionality was absorbed into the `StarRating` component's follow-up modal during the feedback UX update side quest (Dec 19, 2025)
- **Current State:** 
  - ✅ Conversation feedback API route exists (`app/api/feedback/conversation/route.ts`)
  - ✅ `Conversation_Feedback` table exists in schema
  - ✅ Star rating component includes all Phase 3.5 questions in its follow-up modal:
    - "What were you trying to accomplish?"
    - "Did you get what you needed?" (Yes/Partially/No)
    - "What's still missing?" (conditional)
    - "How much time did this save you?" (NEW field added)
  - ✅ Star rating is integrated into chat header (top-right)
  - ❌ No separate conversation feedback modal triggered by copy button
  - ❌ Survey not triggered by copy button click (triggered by star rating instead)

**Side Quest: Feedback UX Update (Dec 19, 2025)**
- After completing Phase 3.3 and 3.4, a side quest was undertaken to migrate from modal-based feedback to pill-based feedback UX
- See `Planning Docs/12-19_feedback_ux_update.md` for full details
- This migration replaced the "Need More" modal (Phase 3.3) with expansion pills
- The copy feedback modal (Phase 3.4) was kept per plan decision
- Phase 3.5's conversation feedback functionality was integrated into the star rating system instead of being a separate modal

**Original Plan (Not Implemented):**

1. **Create conversation feedback modal:**
   - Planned: `components/conversation-feedback-modal.tsx`
   - Status: ❌ Never created

2. **Integrate survey trigger into copy button:**
   - Planned: Show modal after copy button click (if 3+ messages)
   - Status: ❌ Not implemented

3. **Create conversation feedback API:**
   - Planned: `app/api/feedback/conversation/route.ts`
   - Status: ✅ Created (but as part of feedback UX update, not Phase 3.5)

**Current Implementation:**
- Conversation feedback is collected via the `StarRating` component's follow-up modal
- Users click a star rating (1-5) → follow-up modal appears with all Phase 3.5 questions
- Data is stored in `Conversation_Feedback` table via `/api/feedback/conversation` route
- Star rating is displayed in chat header (top-right corner)

**Deliverables:**
- ✅ Conversation feedback functionality (via star rating modal)
- ✅ Conversation_Feedback API route
- ✅ All Phase 3.5 questions included in star rating follow-up
- ❌ Not triggered by copy button (triggered by star rating instead)
- ❌ No separate conversation feedback modal component

**Note:** The original Phase 3.5 plan (copy-button-triggered survey) was not implemented. Instead, conversation feedback was integrated into the star rating system. This achieves the same goal (collecting conversation-level feedback) but through a different UX flow.

**Testing:**
- [x] Star rating follow-up modal works ✅
- [x] Conversation feedback API works ✅
- [x] Data stored in Conversation_Feedback table ✅
- [ ] Original copy-button trigger (not implemented)

---

#### Phase 3.7: UI/UX Improvements ⚠️ PARTIALLY COMPLETE

**Objective:** Polish homepage, chat interface, and dashboard screens

**Why needed for Alpha:** Professional appearance for public marketing

**Prerequisites:**
- ✅ MVP functionality working
- ✅ Basic UI components in place

**Status:** ⚠️ **PARTIALLY COMPLETE** - Chat interface is polished, homepage needs Amazon-style redesign

**What's Been Completed:**

1. **Chat interface polish:** ✅ **COMPLETE**
   - ✅ Time-of-day adaptive themes (sky gradients with 8 periods)
   - ✅ Theme settings modal (cycle, dark-cycle, light-cycle, custom period)
   - ✅ Glassmorphism message bubbles with adaptive contrast
   - ✅ Typography: Inter (body) + Lora (headings) configured
   - ✅ Loading animations for streaming (bouncing dots)
   - ✅ Error states with user-friendly messages
   - ✅ Copy/Save buttons with feedback modals
   - ✅ Source attribution integrated
   - ✅ Pills system for feedback/expansion/suggestions
   - ✅ Star rating component in header
   - ✅ Responsive design (mobile-optimized)
   - ✅ Smooth transitions and animations

2. **Dashboard enhancements (basic):** ✅ **COMPLETE**
   - ✅ Modern card layouts (shadcn/ui components)
   - ✅ Improved color scheme and spacing
   - ✅ Loading skeletons
   - ✅ Empty states with helpful messages
   - ✅ Responsive tables/lists
   - ✅ Sort controls and pagination

**What's Missing:**

1. **Homepage improvements:** ❌ **NOT STARTED** (needs Amazon-style redesign)

---

### Phase 3.7.1: Database Schema Migration for Homepage

**Objective:** Add required fields and models to support public chatbot browsing

**Prerequisites:**
- ✅ Existing `schema.prisma` with MVP models
- ✅ `Chatbot_Ratings_Aggregate` model exists
- ✅ `Creator` model exists

**Tasks:**

1. **Add ChatbotType enum:**
   ```prisma
   enum ChatbotType {
     CREATOR
     FRAMEWORK
     DEEP_DIVE
     ADVISOR_BOARD
   }
   ```

2. **Add CategoryType enum:**
   ```prisma
   enum CategoryType {
     ROLE      // sales_leader, founder, product_manager
     CHALLENGE // customer_acquisition, pricing, positioning
     STAGE     // early_stage, growth_stage, scale_stage
   }
   ```

3. **Update Chatbot model** - Add fields:
   ```prisma
   model Chatbot {
     // ... existing fields ...
     slug              String      @unique
     description       String?
     isPublic          Boolean     @default(false)
     allowAnonymous    Boolean     @default(false)
     type              ChatbotType
     priceCents        Int         @default(0)
     currency          String      @default("USD")
     
     // ... existing relations ...
     categories        Chatbot_Category[]
     favoritedBy       Favorited_Chatbots[]
     
     @@index([slug])
     @@index([isPublic])
     @@index([isActive])
     @@index([type])
   }
   ```

4. **Add Category model:**
   ```prisma
   model Category {
     id        String   @id @default(cuid())
     type      CategoryType
     label     String
     slug      String
     icon      String?
     color     String?
     
     chatbots  Chatbot_Category[]
     
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
     
     @@unique([type, slug])
     @@index([type])
   }
   ```

5. **Add Chatbot_Category junction table:**
   ```prisma
   model Chatbot_Category {
     id              String   @id @default(cuid())
     chatbotId       String
     chatbot         Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
     categoryId      String
     category        Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
     relevanceScore  Float?
     
     createdAt       DateTime @default(now())
     
     @@unique([chatbotId, categoryId])
     @@index([categoryId])
     @@index([chatbotId])
   }
   ```

6. **Add Favorited_Chatbots model:**
   ```prisma
   model Favorited_Chatbots {
     id                String   @id @default(cuid())
     userId            String
     user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     chatbotId         String
     chatbot           Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
     
     createdAt         DateTime @default(now())
     
     @@unique([userId, chatbotId])
     @@index([userId])
     @@index([chatbotId])
   }
   ```

7. **Update User model** - Add relation:
   ```prisma
   model User {
     // ... existing fields ...
     favoritedChatbots Favorited_Chatbots[]
   }
   ```

8. **Update Creator model** - Add fields if missing:
   ```prisma
   model Creator {
     // ... existing fields ...
     slug          String   @unique
     avatarUrl     String?
     bio           String?
     socialLinks   Json?    // { website, linkedin, x, facebook, tiktok, masterclass, youtube }
   }
   ```

9. **Create and apply migration:**
   
   **Step 9a: Verify Database Sync (IMPORTANT)**
   - Before creating new migrations, verify dev and prod are in sync:
     ```bash
     # Check dev database
     npx tsx scripts/check-migration-status.ts
     
     # Check prod database (set prod DATABASE_URL temporarily)
     DATABASE_URL="your-production-url" npx tsx scripts/check-migration-status.ts
     ```
   - Both databases should have the same migrations applied
   - If prod is behind, apply missing migrations first:
     ```bash
     export DATABASE_URL="your-production-url"
     npx prisma migrate deploy
     ```
   
   **Step 9b: Update Development Database (Local)**
   - Ensure your `.env.local` points to your **development Neon branch**
   - Run migration locally (creates migration files + applies to dev DB):
     ```bash
     npx prisma migrate dev --name add_homepage_fields
     npx prisma generate
     ```
   - This updates your **development Neon database** and creates migration files in `prisma/migrations/`
   
   **Step 9c: Commit Migration Files**
   - Commit the new migration files to git:
     ```bash
     git add prisma/migrations/
     git commit -m "Add homepage fields migration"
     ```
   
   **Step 9d: Deploy to Production (Vercel)**
   - Push to your repository and deploy to Vercel
   - Vercel will automatically run `prisma migrate deploy` during build (using production `DATABASE_URL` from Vercel env vars)
   - This applies the migration to your **production Neon database**
   
   **Note:** This workflow ensures:
   - Dev and prod are verified to be in sync before adding new migrations
   - Development database is updated first (for testing)
   - Migration files are version-controlled
   - Production database is updated automatically on deployment via Vercel

10. **Update existing Art of War chatbot:**
    - Set `isPublic: true`
    - Set `allowAnonymous: true`
    - Set `type: DEEP_DIVE`
    - Set `priceCents: 0`
    - Set `currency: "USD"`
    - Generate `slug` from title (e.g., "art-of-war")
    - Add `description` if available

11. **Seed initial categories:**
    **Use seed script** (add to `prisma/seed.ts` or create `prisma/seed-categories.ts`):
    ```typescript
    // Add to prisma/seed.ts or create separate seed-categories.ts
    async function seedCategories() {
      const categories = [
        // ROLE categories
        { type: 'ROLE', slug: 'founder', label: 'Founder' },
        { type: 'ROLE', slug: 'sales_leader', label: 'Sales Leader' },
        { type: 'ROLE', slug: 'product_manager', label: 'Product Manager' },
        // CHALLENGE categories
        { type: 'CHALLENGE', slug: 'customer_acquisition', label: 'Customer Acquisition' },
        { type: 'CHALLENGE', slug: 'pricing', label: 'Pricing' },
        { type: 'CHALLENGE', slug: 'positioning', label: 'Positioning' },
        // STAGE categories
        { type: 'STAGE', slug: 'early_stage', label: 'Early Stage' },
        { type: 'STAGE', slug: 'growth_stage', label: 'Growth Stage' },
        { type: 'STAGE', slug: 'scale_stage', label: 'Scale Stage' },
      ];
      
      for (const cat of categories) {
        await prisma.category.upsert({
          where: { type_slug: { type: cat.type, slug: cat.slug } },
          update: {},
          create: cat,
        });
      }
    }
    ```
    Run: `npm run seed` (or `npx prisma db seed` if using separate file)

**Acceptance Criteria:**
- ✅ Migration runs successfully
- ✅ All new fields queryable
- ✅ Enums defined correctly
- ✅ Indexes created
- ✅ Existing chatbot updated with new fields
- ✅ Categories seeded

**Deliverables:**
- ✅ Updated `schema.prisma` with all required fields
- ✅ Migration file created
- ✅ Existing chatbot updated
- ✅ Categories seeded

---

### Phase 3.7.2: Public Chatbots API Endpoint ✅ COMPLETE

**Status:** ✅ **COMPLETE** (Jan 2025)

**Objective:** Create API endpoint to fetch public chatbots with filtering, search, and pagination

**Prerequisites:**
- ✅ Phase 3.7.1 complete (schema migration)
- ✅ Categories seeded

**Tasks:**

1. **Create API route:** `app/api/chatbots/public/route.ts`

2. **Endpoint:** `GET /api/chatbots/public`

3. **Query Parameters:**
   - `page` (number, default: 1) - Page number (1-indexed)
   - `pageSize` (number, default: 20) - Items per page
   - `category` (string, optional) - Category ID to filter by
   - `categoryType` (string, optional) - CategoryType enum (ROLE, CHALLENGE, STAGE)
   - `creator` (string, optional) - Creator ID to filter by
   - `type` (string, optional) - ChatbotType enum (CREATOR, FRAMEWORK, DEEP_DIVE, ADVISOR_BOARD)
   - `search` (string, optional) - Search query (searches title, description, creator name)

4. **Response Format:**
   ```typescript
   {
     chatbots: [
       {
         id: string;
         slug: string;
         title: string;
         description: string | null;
         type: ChatbotType;
         priceCents: number;
         currency: string;
         allowAnonymous: boolean;
         createdAt: string;
         creator: {
           id: string;
           slug: string;
           name: string;
           avatarUrl: string | null;
         };
         rating: {
           averageRating: number | null;  // Decimal as number
           ratingCount: number;
         } | null;
         categories: Array<{
           id: string;
           type: CategoryType;
           label: string;
           slug: string;
         }>;
         favoriteCount: number;  // Aggregated count
       }
     ];
     pagination: {
       page: number;
       pageSize: number;
       totalPages: number;
       totalItems: number;
     };
   }
   ```

5. **Filter Logic:**
   - Base filter: `WHERE isPublic = true AND isActive = true`
   - If `category` provided: Join `Chatbot_Category` and filter by `categoryId`
   - If `categoryType` provided: Join `Chatbot_Category` → `Category` and filter by `type`
   - If `creator` provided: Filter by `creatorId`
   - If `type` provided: Filter by `type` enum
   - If `search` provided: `WHERE (title ILIKE '%search%' OR description ILIKE '%search%' OR creator.name ILIKE '%search%')`

6. **Pagination:**
   - Calculate `totalItems` with same filters (without LIMIT/OFFSET)
   - Calculate `totalPages = Math.ceil(totalItems / pageSize)`
   - Use `LIMIT pageSize OFFSET (page - 1) * pageSize`

7. **Include Relations:**
   - `creator` (select: id, slug, name, avatarUrl)
   - `ratingsAggregate` (Chatbot_Ratings_Aggregate - select: averageRating, ratingCount)
     - **Note:** `averageRating` is `Decimal` type - convert to `number` using `Number(averageRating)` or `averageRating.toNumber()`
   - `categories` (via Chatbot_Category → Category - select: id, type, label, slug)
   - **Favorite Count:** Use Prisma aggregation in query:
     ```typescript
     // In the query, use _count for efficient aggregation
     include: {
       _count: {
         select: { favoritedBy: true }
       }
     }
     // Then access as: chatbot._count.favoritedBy
     ```

8. **Error Handling:**
   - Invalid query params → 400 with error message
   - Database errors → 500 with generic error message
   - No chatbots found → 200 with empty array

9. **No Authentication Required:**
   - Endpoint is public (no auth check)

**Acceptance Criteria:**
- ✅ Returns paginated results
- ✅ Filters work correctly (category, creator, type, search)
- ✅ Search works on title, description, creator name
- ✅ Includes creator info, ratings, categories, favorite count
- ✅ Pagination metadata correct
- ✅ Handles empty results gracefully
- ✅ Error handling works

**Deliverables:**
- ✅ `app/api/chatbots/public/route.ts` created
- ✅ All filters implemented
- ✅ Pagination working
- ✅ Response format matches spec

**Testing:**
- [x] Returns chatbots when no filters ✅
- [x] Category filter works ✅
- [x] Creator filter works ✅
- [x] Type filter works ✅
- [x] Search works (title, description, creator) ✅
- [x] Pagination works (page, pageSize) ✅
- [x] Empty results handled correctly ✅
- [x] Invalid params return 400 ✅
- [x] Includes all required fields ✅

**Test Results:**
- ✅ All 18 unit tests passing
- ✅ Comprehensive test coverage for all filters, pagination, error handling, and rating conversion
- ✅ Test file: `__tests__/api/chatbots/public/route.test.ts`

---

### Phase 3.7.3: Chatbot Detail Modal Component ✅ COMPLETE

**Status:** ✅ **COMPLETE** (Jan 2025)

**Objective:** Create modal component that shows detailed chatbot information when card is clicked

**Prerequisites:**
- ✅ Phase 3.7.2 complete (API endpoint)

**Tasks:**

1. **Create component:** `components/chatbot-detail-modal.tsx`

2. **Props Interface:**
   ```typescript
   interface ChatbotDetailModalProps {
     chatbot: {
       id: string;
       slug: string;
       title: string;
       description: string | null;
       type: ChatbotType;
       priceCents: number;
       currency: string;
       allowAnonymous: boolean;
       creator: {
         id: string;
         slug: string;
         name: string;
         avatarUrl: string | null;
       };
       rating: {
         averageRating: number | null;
         ratingCount: number;
       } | null;
       categories: Array<{
         id: string;
         type: CategoryType;
         label: string;
         slug: string;
       }>;
     };
     open: boolean;
     onClose: () => void;
     onStartChat: (chatbotId: string) => void;
   }
   ```

3. **Modal Content:**
   - **Header:**
     - Chatbot title (large)
     - Chatbot type badge
     - Close button (X)
   - **Creator Section:**
     - Creator avatar (or placeholder)
     - Creator name (clickable link to `/creators/[creatorSlug]`)
     - Creator bio (if available, truncated)
   - **Description:**
     - Full description (not truncated)
   - **Categories:**
     - List of category badges (grouped by CategoryType: ROLE, CHALLENGE, STAGE)
   - **Rating Section:**
     - Average rating (stars display)
     - Rating count (e.g., "4.5 (123 reviews)")
     - **Rating Distribution:** Display if `ratingDistribution` JSON exists from `Chatbot_Ratings_Aggregate`
       - Show as horizontal bars or percentage breakdown: "5★: 60% (75)", "4★: 25% (31)", etc.
       - Format: Parse JSON `{"1": 5, "2": 10, "3": 25, "4": 31, "5": 75}` and display visually
     - Link to "See all reviews" (scrolls to reviews section in modal, or link to full reviews page if exists)
   - **Reviews List:**
     - Fetch reviews from `Conversation_Feedback` model (via separate API call)
     - **Reviews API Endpoint:** `GET /api/chatbots/[chatbotId]/reviews`
       - Query params: `page` (default: 1), `pageSize` (default: 5), `sort` (default: "recent")
       - Response: `{ reviews: Array<{ id, userId, userName, rating, comment, timeSaved, createdAt }>, pagination: {...} }`
       - **Note:** `comment` comes from `userGoal` or `stillNeed` fields in `Conversation_Feedback`
       - **Note:** `timeSaved` comes from `timeSaved` field (string: "5 minutes", "30 minutes", etc.)
       - For anonymous users (`userId === null`): Show "Anonymous" as userName
       - Sort options: "recent" (createdAt DESC), "rating_high" (rating DESC), "rating_low" (rating ASC)
     - Display: user name (or "Anonymous"), rating (stars), comment (from userGoal/stillNeed), timeSaved, createdAt
     - Limit to 5 most recent reviews initially
     - "Load more reviews" button (if >5) - fetches next page
   - **Pricing Section:**
     - If `priceCents === 0`: Show "Free" badge
     - If `priceCents > 0`: Show formatted price (e.g., "$9.99")
     - Show `allowAnonymous` status ("Anonymous users allowed" or "Login required")
   - **Actions:**
     - "Start Chat" button (primary CTA)
       - If `priceCents === 0` AND `allowAnonymous === true`: Navigate directly to `/chat/[chatbotId]`
       - If `priceCents === 0` AND `allowAnonymous === false`: Check auth, redirect to login if needed, then navigate
       - If `priceCents > 0`: **Show disabled button with tooltip** "Payment coming soon" (defer payment flow to Beta)
     - Favorite button (heart icon) - if user is authenticated

4. **Data Fetching:**
   - Reviews fetched separately via `GET /api/chatbots/[chatbotId]/reviews` (create this endpoint)
   - Show loading skeleton while fetching reviews
   - Handle errors gracefully

5. **Styling:**
   - Use shadcn/ui Dialog component
   - Responsive (full screen on mobile, centered modal on desktop)
   - Scrollable content area
   - Smooth animations

**Acceptance Criteria:**
- ✅ Modal opens/closes correctly
- ✅ All chatbot info displayed
- ✅ Creator link works
- ✅ Reviews load and display
- ✅ "Start Chat" button works correctly
- ✅ Favorite button works (if authenticated)
- ✅ Responsive design
- ✅ Loading states shown

**Deliverables:**
- ✅ `components/chatbot-detail-modal.tsx` created
- ✅ Reviews API endpoint created (`/api/chatbots/[chatbotId]/reviews`)
- ✅ Basic chatbot card component created (`components/chatbot-card.tsx`) for modal integration
- ✅ Comprehensive test suite created (`__tests__/api/chatbots/[chatbotId]/reviews/route.test.ts`)

**Implementation Details:**
- **Modal Component:** Full-featured modal with all required sections:
  - Header with title, type badge, and close button
  - Creator section with avatar, name (linkable), and placeholder for bio
  - Full description display
  - Categories grouped by type (ROLE, CHALLENGE, STAGE) with badges
  - Rating section with star display, rating count, and rating distribution visualization
  - Reviews list with pagination ("Load More" button)
  - Pricing section with formatted price or "Free" badge
  - Actions: "Start Chat" button with auth logic, Favorite button (placeholder for Phase 3.7.6)
- **Reviews API:** Complete endpoint with:
  - Pagination (page, pageSize, max 50 per page)
  - Sorting (recent, rating_high, rating_low)
  - Filters to only show reviews with rating or comment
  - Anonymous user handling (userName = null displayed as "Anonymous")
  - Comment field uses userGoal (preferred) or stillNeed (fallback)
- **Test Coverage:** 20 comprehensive unit tests covering:
  - Happy path scenarios (6 tests)
  - Pagination (2 tests)
  - Sorting (3 tests)
  - Filtering (1 test)
  - Empty results (1 test)
  - Error handling - invalid params (4 tests)
  - Error handling - chatbot not found (1 test)
  - Error handling - database errors (1 test)
  - Date formatting (1 test)
  - **All 20 tests passing ✅**

**Testing:**
- ✅ Reviews API endpoint fully tested (20 tests passing)
- ✅ Modal component created with all required features
- ✅ Basic chatbot card component created for integration
- ✅ Modal opens/closes correctly (via Dialog component)
- ✅ All information displays correctly (title, description, creator, categories, ratings, reviews, pricing)
- ✅ Creator link implemented (navigates to `/creators/[creatorSlug]`)
- ✅ Reviews load and display with pagination
- ✅ "Start Chat" button logic implemented (handles free+anonymous, free+login required, paid scenarios)
- ✅ Favorite button placeholder implemented (full functionality in Phase 3.7.6)
- ✅ Modal closes on X click (via Dialog component)
- ✅ Modal closes on backdrop click (via Dialog component)
- ✅ Responsive design (uses shadcn/ui Dialog with responsive classes)
- ✅ Loading states shown (skeleton components for reviews)
- ✅ Error handling implemented (graceful error messages)

**Notes:**
- Favorite button functionality is a placeholder - full implementation will be in Phase 3.7.6 (Favorites System)
- Basic chatbot card component created for modal integration - full card design will be completed in Phase 3.7.4
- Rating distribution visualization displays as horizontal bars with percentages
- Reviews API properly handles anonymous users (userId = null) by setting userName to null (displayed as "Anonymous" in UI)

---

### Phase 3.7.4: Homepage Component with Grid Layout ✅ COMPLETE

**Status:** ✅ **COMPLETE** (Jan 2025)

**Objective:** Create Amazon-style homepage with categorized chatbot grids

**Prerequisites:**
- ✅ Phase 3.7.2 complete (API endpoint)
- ✅ Phase 3.7.3 complete (Detail modal)

**Tasks:**

1. **Update homepage:** `app/page.tsx`

2. **Page Structure:**
   - **Hero Section** (small):
     - Title: "Chat with AI-powered knowledge"
     - Subtitle: "Explore chatbots built on books, courses, and expert content"
     - Search bar (prominent)
   - **Filters Section:**
     - Category filter chips (ROLE, CHALLENGE, STAGE) - show active categories
     - Creator filter (searchable dropdown/combobox)
     - Chatbot type filter (checkboxes: CREATOR, FRAMEWORK, DEEP_DIVE, ADVISOR_BOARD)
     - Active filters display (chips showing current filters)
     - "Clear all filters" button
   - **Categorized Grids:**
     - For each CategoryType (ROLE, CHALLENGE, STAGE):
       - Section heading (e.g., "By Role", "By Challenge", "By Stage")
       - Grid of chatbots in that category
       - "See all" link (if >6 chatbots)
     - If no category filters active: Show "All Chatbots" grid
     - If category filters active: Show filtered results in single grid
   - **Pagination:**
     - **Use "Load More" button** (loads next page, appends to current results)
     - Button shows "Load More" or "Loading..." state
     - Button disabled when no more pages available

3. **Grid Layout:**
   - **Mobile:** 2 columns
   - **Tablet:** 4 columns
   - **Desktop:** 6+ columns (responsive)
   - Use CSS Grid with `grid-template-columns: repeat(auto-fill, minmax(250px, 1fr))`

4. **Chatbot Card Component:** `components/chatbot-card.tsx`
   - **Props:**
     ```typescript
     interface ChatbotCardProps {
       chatbot: {
         id: string;
         slug: string;
         title: string;
         description: string | null;
         type: ChatbotType;
         priceCents: number;
         currency: string;
         allowAnonymous: boolean;
         creator: { name: string; slug: string; avatarUrl: string | null };
         rating: { averageRating: number | null; ratingCount: number } | null;
         categories: Array<{ label: string; type: CategoryType }>;
         favoriteCount: number;  // Note: Display in detail modal, not on card
       };
       onCardClick: (chatbot: ChatbotCardProps['chatbot']) => void;
       isFavorite?: boolean;
       onFavoriteToggle?: (chatbotId: string, isFavorite: boolean) => void;
     }
     ```
   - **Card Content:**
     - Image placeholder (or creator avatar)
     - Title (truncated to 2 lines)
     - Description (truncated to ~100 chars with "...")
     - Creator name (clickable, links to `/creators/[creatorSlug]`)
     - Chatbot type badge
     - Rating display (stars + count, or "No ratings yet")
     - Price indicator ("Free" or formatted price)
     - Favorite button (heart icon, top-right corner) - only if authenticated
     - **Note:** `favoriteCount` is available but not displayed on card (shown in detail modal instead)
     - Hover effect (slight elevation/shadow)

5. **Search Functionality:**
   - Debounced search (300ms delay using `useDebouncedCallback` or custom hook)
   - Updates URL query params using Next.js `useSearchParams` and `useRouter`
   - Format: `?search=query&category=id&type=TYPE&page=1`
   - Triggers API call with search param
   - Shows loading indicator while searching
   - Shows "No results" message if empty

6. **Filter Functionality:**
   - Filters update URL query params using `useSearchParams` and `useRouter`
   - Format: `?category=id&categoryType=TYPE&creator=id&type=TYPE`
   - API call triggered on filter change (debounced 300ms)
   - Active filters shown as removable chips
   - "Clear all" resets URL params and fetches default results

7. **Data Fetching:**
   - **Use native `fetch` with React state** (`useState`, `useEffect`)
   - **No React Query/SWR** - keep it simple for Alpha
   - Fetch on mount with current URL params (from `useSearchParams`)
   - Refetch on filter/search change (debounced)
   - Show skeleton loaders while loading
   - Store results in state, append on "Load More"

8. **Empty States:**
   - No chatbots: "You've reached the end" message
   - No search results: "No chatbots found matching your search"
   - No filter results: "No chatbots match your filters"

9. **Error Handling:**
   - Show error message: "Unable to load chatbots. Please try again."
   - Retry button
   - Log errors to console/Sentry

**Acceptance Criteria:**
- ✅ Homepage loads without login
- ✅ Hero section displays
- ✅ Search works (debounced)
- ✅ Filters work (category, creator, type)
- ✅ Grids display correctly (categorized or filtered)
- ✅ Cards display all required info
- ✅ Cards clickable → opens modal
- ✅ Creator links work
- ✅ Favorite button works (if authenticated)
- ✅ Pagination works ("Load More")
- ✅ Responsive design (2/4/6+ cols)
- ✅ Loading states shown
- ✅ Empty states shown
- ✅ Error handling works

**Deliverables:**
- ✅ Updated `app/page.tsx` - Full homepage with hero, filters, search, and grids
- ✅ `components/chatbot-card.tsx` - Complete card design with all features
- ✅ `app/api/categories/route.ts` - API endpoint for fetching categories
- ✅ `app/api/creators/route.ts` - API endpoint for fetching creators
- ✅ `lib/hooks/use-debounce.ts` - Custom debounce hook for search
- ✅ `components/ui/input.tsx` - Input component for search bar
- ✅ Search functionality (debounced 300ms)
- ✅ Filter functionality (category, creator, type)
- ✅ Categorized grids (ROLE, CHALLENGE, STAGE)
- ✅ Responsive layout (2/4/6+ columns)
- ✅ URL query parameter synchronization
- ✅ Loading states with skeleton loaders
- ✅ Empty states for different scenarios
- ✅ Error handling with retry functionality

**Implementation Notes:**
- Homepage uses native `fetch` with React state (no React Query/SWR)
- Search is debounced using custom `useDebounce` hook (300ms delay)
- Filters update URL query params and trigger API calls automatically
- Categorized grids show chatbots grouped by category type when no filters active
- Filtered grid shows single unified results when filters are active
- "Load More" pagination appends results to current list
- Favorite button UI implemented (API integration pending Phase 3.7.6)
- All state synchronized with URL query parameters for shareable/bookmarkable URLs

**Testing:**
- ✅ Unit tests created for Categories API (`__tests__/api/categories/route.test.ts`)
- ✅ Unit tests created for Creators API (`__tests__/api/creators/route.test.ts`)
- ✅ Unit tests created for useDebounce hook (`__tests__/lib/hooks/use-debounce.test.ts`)
- ✅ All 13 tests passing
- [ ] Manual testing: Homepage loads without login
- [ ] Manual testing: Search works
- [ ] Manual testing: Category filters work
- [ ] Manual testing: Creator filter works
- [ ] Manual testing: Type filter works
- [ ] Manual testing: Cards display correctly
- [ ] Manual testing: Card click opens modal
- [ ] Manual testing: Creator links navigate
- [ ] Manual testing: Favorite button works (UI ready, API pending)
- [ ] Manual testing: Pagination works
- [ ] Manual testing: Responsive on mobile/tablet/desktop
- [ ] Manual testing: Loading states show
- [ ] Manual testing: Empty states show
- [ ] Manual testing: Error handling works

---

### Side Quest: Header Search Refactor ✅ COMPLETE (Dec 29, 2024)

**Status:** ✅ **COMPLETE** (Dec 29, 2024)

**Objective:** Refactor search functionality to be available in the header across all pages, with mobile-responsive expandable search and dropdown results

**Why:** After completing Phase 3.7.4, search was only available on the homepage hero section. This side quest moved search to the header for better accessibility and consistency across all pages.

**Prerequisites:**
- ✅ Phase 3.7.4 complete (Homepage with search)
- ✅ Search API endpoint working (`/api/chatbots/public`)

**What Was Done:**

1. **Created Reusable SearchBar Component:**
   - Created `components/search-bar.tsx` - Single source of truth for search functionality
   - Supports two variants: `header` (for AppHeader) and `inline` (for Chat/Dashboard)
   - Mobile-responsive: Expands below header on mobile, always visible on desktop
   - Eliminated ~240 lines of duplicate code across components

2. **Implemented Dropdown Search Results:**
   - Created `components/search-dropdown.tsx` - Dropdown container with loading/empty/results states
   - Created `components/search-result-item.tsx` - Individual chatbot result item
   - Created `lib/types/chatbot.ts` - Shared type definitions
   - Dropdown shows inline results (no navigation away from page)
   - Clicking a chatbot in dropdown navigates to `/chat/${chatbotId}`
   - Keyboard navigation (Arrow keys, Enter, Escape)
   - Click-outside detection to close dropdown

3. **Refactored Components:**
   - **AppHeader** (`components/app-header.tsx`): Simplified from ~190 lines to ~87 lines, uses SearchBar
   - **Homepage** (`app/page.tsx`): Removed search from hero section, integrated header search
   - **Chat** (`components/chat.tsx`): Removed duplicate search, uses SearchBar with dropdown
   - **Dashboard** (`components/dashboard-content.tsx`): Removed duplicate search, uses SearchBar with dropdown

4. **Key Features Implemented:**
   - ✅ Mobile-responsive branding ("PG" on mobile, "Pocket Genius" on desktop)
   - ✅ Expandable search on mobile (icon expands to show search bar)
   - ✅ Dropdown with search results (up to 10 results)
   - ✅ Keyboard navigation (ArrowUp, ArrowDown, Enter, Escape)
   - ✅ Click-outside detection
   - ✅ Loading states (skeleton items)
   - ✅ Empty states ("No chatbots found")
   - ✅ "See all results" link (navigates to homepage with search query)
   - ✅ Request cancellation (AbortController for rapid typing)
   - ✅ Debounced API calls (300ms)
   - ✅ Scroll selected item into view during keyboard navigation

**Deliverables:**
- ✅ `components/search-bar.tsx` - Reusable search component (439 lines, down from 479 after cleanup)
- ✅ `components/search-dropdown.tsx` - Dropdown component with all states
- ✅ `components/search-result-item.tsx` - Individual result item component
- ✅ `lib/types/chatbot.ts` - Shared type definitions
- ✅ Refactored `components/app-header.tsx` - Simplified, uses SearchBar
- ✅ Updated `app/page.tsx` - Header search integrated, hero search removed
- ✅ Updated `components/chat.tsx` - Uses SearchBar with dropdown
- ✅ Updated `components/dashboard-content.tsx` - Uses SearchBar with dropdown
- ✅ ~240 lines of duplicate code eliminated
- ✅ Consistent debouncing (300ms) across all search implementations
- ✅ Mobile-responsive design (expandable search, full-width dropdown)

**Implementation Details:**
- Search available on all pages (homepage, chat, dashboard)
- Dropdown shows results inline without navigating away
- Homepage grid filtering still works independently of dropdown
- All deprecated props removed (`navigateOnSearch`, `onSearchChange`)
- Clean API with 7 props (down from 9)

**Code Quality Improvements:**
- **Before:** Search logic duplicated in 3 components, inconsistent debouncing, ~240 lines of duplicate code
- **After:** Single source of truth (`SearchBar` component), consistent debouncing everywhere, easier to maintain and extend

**Testing:**
- ✅ Dropdown appears after typing 2+ characters
- ✅ Loading state shows while fetching
- ✅ Results display correctly
- ✅ Empty state shows when no results
- ✅ Keyboard navigation works (ArrowUp, ArrowDown, Enter, Escape)
- ✅ Click outside closes dropdown
- ✅ Click on result navigates to `/chat/${chatbotId}`
- ✅ Works consistently on homepage, chat, and dashboard pages
- ✅ Mobile responsive (dropdown appears below expanded search)
- ✅ Rapid typing cancels previous requests (AbortController)
- ✅ API errors handled gracefully

**Documentation:**
- Full implementation details documented in `Planning Docs/12-29_header-search-refactor.md`
- Comprehensive test results and verification completed
- All edge cases handled and documented

**Note:** This refactoring improved code maintainability and user experience by making search consistently available across all pages with a modern dropdown interface. The implementation follows React best practices with proper component composition, debouncing, and responsive design patterns.

---

### Phase 3.7.5: Creator Pages ✅ COMPLETE

**Status:** ✅ **COMPLETE** (Jan 2025)

**Objective:** Create creator profile pages showing their chatbots

**Prerequisites:**
- ✅ Phase 3.7.4 complete (Homepage)

**Tasks:**

1. **Create page:** `app/creators/[creatorSlug]/page.tsx` ✅

2. **Page Structure:**
   - **Creator Header:** ✅
     - Creator avatar (large)
     - Creator name
     - Creator bio (if available)
     - Social links (if available) - icons for website, LinkedIn, X, etc.
   - **Creator's Chatbots Grid:** ✅
     - Heading: "Chatbots by [Creator Name]"
     - Grid of chatbots (same card component as homepage)
     - Filter by chatbot type (optional) - Deferred (not needed for Alpha)
     - Pagination if >20 chatbots ✅ ("Load More" button)

3. **Data Fetching:** ✅
   - Fetch creator by slug: `GET /api/creators/[creatorSlug]`
   - **Reuse `/api/chatbots/public` endpoint** with `creator` query param (don't duplicate)
   - Show loading skeletons while fetching

4. **API Endpoint:** `app/api/creators/[creatorSlug]/route.ts` ✅
   - **Returns creator info only:** `{ id, slug, name, avatarUrl, bio, socialLinks }`
   - **Note:** Chatbots fetched separately via `/api/chatbots/public?creator=[creatorId]`
   - **Social Links Format:** JSON object `{ website?: string, linkedin?: string, x?: string, facebook?: string, tiktok?: string, masterclass?: string, youtube?: string }`
   - **Social Links Display:** Render as clickable icons/links with:
     - `rel="nofollow noopener noreferrer"` for external links
     - `target="_blank"` to open in new tab
     - Icons from `lucide-react` (Globe, Linkedin, Twitter, Facebook, etc.)

5. **Error Handling:** ✅
   - Creator not found → 404 page
   - No chatbots → Show "No chatbots yet" message

6. **Navigation:** ✅
   - Creator name links from chatbot cards → `/creators/[creatorSlug]`
   - Breadcrumb: Home > Creators > [Creator Name]

**Acceptance Criteria:**
- ✅ Creator page loads correctly
- ✅ Creator info displays (name, avatar, bio, social links)
- ✅ Creator's chatbots display in grid
- ✅ Chatbot cards work (click → modal)
- ✅ Links from homepage work
- ✅ 404 handled for invalid slugs

**Deliverables:**
- ✅ `app/creators/[creatorSlug]/page.tsx` created (420 lines)
- ✅ `app/api/creators/[creatorSlug]/route.ts` created (103 lines)
- ✅ Creator links integrated into cards (verified in `components/chatbot-card.tsx` line 225)
- ✅ `__tests__/api/creators/[creatorSlug]/route.test.ts` created (133 lines, 7 tests passing)

**Implementation Details:**
- **Creator Page Component:** Full-featured page with:
  - Creator header card with avatar, name, bio, and social links
  - Breadcrumb navigation (Home > Creators > [Creator Name])
  - Chatbots grid using existing `ChatbotCard` component
  - "Load More" pagination button (appends results)
  - Loading states with skeleton loaders
  - Empty state for creators with no chatbots
  - 404 page for invalid creator slugs
  - Responsive design (mobile-friendly)
- **API Endpoint:** Complete endpoint with:
  - Creator lookup by slug
  - SocialLinks JSON parsing (handles both string and object formats)
  - Graceful error handling for invalid JSON
  - Proper error responses (400, 404, 500)
- **Social Links:** Icons from `lucide-react`:
  - Globe (website, masterclass)
  - Linkedin (LinkedIn)
  - Twitter (X/Twitter)
  - Facebook (Facebook)
  - Music (TikTok)
  - Youtube (YouTube)
- **Test Coverage:** 7 comprehensive unit tests covering:
  - Happy path scenarios (4 tests)
  - Error handling - invalid params (1 test)
  - Error handling - creator not found (1 test)
  - Error handling - database errors (1 test)
  - **All 7 tests passing ✅**

**Testing:**
- ✅ Creator page loads
- ✅ Creator info displays correctly
- ✅ Chatbots grid displays
- ✅ Links from homepage work (creator links in chatbot cards navigate correctly)
- ✅ Invalid slug shows 404
- ✅ Social links work (if available)
- ✅ Unit tests pass (7/7 tests passing)

---

### Phase 3.7.6: Favorites System

**Objective:** Allow users to favorite chatbots and view their favorites

**Prerequisites:**
- ✅ Phase 3.7.4 complete (Homepage)
- ✅ User authentication working

**Tasks:**

1. **API Endpoints:**

   **Toggle Favorite:** `POST /api/favorites/[chatbotId]`
   - **Authentication:** Use Clerk `auth()` pattern (same as other endpoints)
     ```typescript
     const { userId: clerkUserId } = await auth();
     if (!clerkUserId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
     // Look up DB user, then toggle favorite
     ```
   - Toggles favorite status (create if not exists, delete if exists)
   - Returns: `{ isFavorite: boolean }`
   - **Error Format:** `{ error: string }` (consistent with other endpoints)

   **Get User Favorites:** `GET /api/favorites`
   - **Authentication:** Get userId from auth (not query param)
     ```typescript
     const { userId: clerkUserId } = await auth();
     if (!clerkUserId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
     ```
   - **Returns:** Full chatbot objects (same format as `/api/chatbots/public` response)
     - Response: `{ chatbots: Array<ChatbotObject>, pagination: {...} }`
     - **Rationale:** Consistency with homepage API, includes all needed data

2. **Update Chatbot Cards:**
   - Add favorite button (heart icon)
   - Show filled heart if favorited, outline if not
   - Toggle on click (optimistic update)
   - Show loading state while toggling
   - **Optimistic Update Rollback:** If API call fails, revert UI state and show error toast
     ```typescript
     // Pseudo-code:
     const [isFavorite, setIsFavorite] = useState(originalValue);
     const handleToggle = async () => {
       const previousValue = isFavorite;
       setIsFavorite(!isFavorite); // Optimistic update
       try {
         await toggleFavorite(chatbotId);
       } catch (error) {
         setIsFavorite(previousValue); // Rollback on error
         toast.error('Failed to update favorite');
       }
     };
     ```

3. **Favorites Page:** `app/favorites/page.tsx`
   - Requires authentication (redirect to login if not authenticated)
   - Shows grid of favorited chatbots (reuse `chatbot-card.tsx` component)
   - Empty state: "You haven't favorited any chatbots yet"
   - Link in navigation/header (if navigation exists)

4. **Update Homepage API (`/api/chatbots/public`):**
   - **Accept optional authentication** (check auth but don't require it)
   - **If user authenticated:** Include `isFavorite: boolean` field in each chatbot object
   - **If user not authenticated:** Omit `isFavorite` field
   - Calculate based on `Favorited_Chatbots` table:
     ```typescript
     // In query, if userId exists:
     include: {
       favoritedBy: {
         where: { userId: dbUserId },
         select: { id: true }
       }
     }
     // Then: isFavorite: chatbot.favoritedBy.length > 0
     ```

**Acceptance Criteria:**
- ✅ Favorite button toggles correctly
- ✅ Favorites persist across sessions
- ✅ Favorites page shows favorited chatbots
- ✅ Optimistic updates work
- ✅ Requires authentication

**Deliverables:**
- ✅ `app/api/favorites/[chatbotId]/route.ts` created
- ✅ `app/api/favorites/route.ts` created
- ✅ `app/favorites/page.tsx` created
- ✅ Favorite button integrated into cards
- ✅ Homepage API includes `isFavorite` field

**Testing:**
- [ ] Favorite button toggles
- [ ] Favorites persist
- [ ] Favorites page shows correct chatbots
- [ ] Requires authentication
- [ ] Optimistic updates work
- [ ] Rollback works on API failure

---

### Cross-Cutting Clarifications for Phase 3.7

**1. Authentication Pattern:**
   - **All authenticated endpoints** follow this pattern:
     ```typescript
     import { auth } from '@clerk/nextjs/server';
     
     const { userId: clerkUserId } = await auth();
     if (!clerkUserId) {
       return NextResponse.json(
         { error: 'Authentication required' },
         { status: 401 }
       );
     }
     
     // Look up DB user
     const user = await prisma.user.findUnique({
       where: { clerkId: clerkUserId },
       select: { id: true },
     });
     
     if (!user) {
       return NextResponse.json(
         { error: 'User not found' },
         { status: 404 }
       );
     }
     ```
   - **Optional auth endpoints** (like `/api/chatbots/public`):
     - Check auth but don't require it
     - If authenticated, include additional fields (e.g., `isFavorite`)
     - If not authenticated, omit those fields

**2. Error Handling Consistency:**
   - **All API endpoints** use consistent error format:
     ```typescript
     // Success: Return data object
     return NextResponse.json({ chatbots: [...], pagination: {...} });
     
     // Error: Return { error: string } with appropriate status code
     return NextResponse.json(
       { error: 'Descriptive error message' },
       { status: 400 | 401 | 404 | 500 }
     );
     ```
   - **Status Codes:**
     - `400`: Bad request (invalid params, validation errors)
     - `401`: Unauthorized (authentication required)
     - `404`: Not found (resource doesn't exist)
     - `500`: Server error (database errors, unexpected errors)
   - **Client-side error handling:**
     - Show user-friendly messages
     - Log errors to console/Sentry
     - Provide retry mechanisms where appropriate

**3. TypeScript Types:**
   - **Create shared types file:** `lib/types/homepage.ts`
   - **Define all interfaces there:**
     ```typescript
     // lib/types/homepage.ts
     export type ChatbotType = 'CREATOR' | 'FRAMEWORK' | 'DEEP_DIVE' | 'ADVISOR_BOARD';
     export type CategoryType = 'ROLE' | 'CHALLENGE' | 'STAGE';
     
     export interface ChatbotCardData {
       id: string;
       slug: string;
       title: string;
       description: string | null;
       type: ChatbotType;
       // ... etc
     }
     
     export interface PublicChatbotsResponse {
       chatbots: ChatbotCardData[];
       pagination: {
         page: number;
         pageSize: number;
         totalPages: number;
         totalItems: number;
       };
     }
     ```
   - **Import in components/API routes:**
     ```typescript
     import type { ChatbotCardData, PublicChatbotsResponse } from '@/lib/types/homepage';
     ```
   - **Rationale:** Single source of truth, easier to maintain, type safety across codebase

**4. API Response Format Standard:**
   - **Paginated responses:**
     ```typescript
     {
       [dataKey]: T[];  // e.g., chatbots, reviews, etc.
       pagination: {
         page: number;
         pageSize: number;
         totalPages: number;
         totalItems: number;
       };
     }
     ```
   - **Single resource responses:**
     ```typescript
     {
       [resourceKey]: T;  // e.g., creator, chatbot, etc.
     }
     ```
   - **Error responses:**
     ```typescript
     {
       error: string;
     }
     ```

---

**Phase 3.7 Summary:**

**Sub-Phases:**
- ✅ Phase 3.7.1: Database Schema Migration
- ✅ Phase 3.7.2: Public Chatbots API Endpoint
- ✅ Phase 3.7.3: Chatbot Detail Modal Component
- ✅ Phase 3.7.4: Homepage Component with Grid Layout
- ✅ Phase 3.7.5: Creator Pages ✅ **COMPLETE** (Jan 2025)
- ✅ Phase 3.7.6: Favorites System

**Defer to Beta:**
- Advanced dashboard visualizations (Recharts)
- Advanced filtering (price range, date range, etc.)
- Payment flow for paid chatbots
- Reviews page (full reviews list)

**Overall Acceptance Criteria:**
- ✅ Homepage loads public chatbots without login
- ✅ Search works (title, description, creator)
- ✅ Filters work (category, creator, type)
- ✅ Chatbot cards display correctly
- ✅ Detail modal works
- ✅ Creator pages work
- ✅ Favorites system works
- ✅ Responsive design works
- ✅ All tests pass

**Schema Items Planning Status:**

The following models/features from `database_schema.md` have been assigned to Alpha or Beta:

**Alpha (This Document):**
- ✅ **Chatbot_Version** - Versioning system (Phase 3.9) - Needed for tracking prompt changes during rapid testing
- ✅ **Intake_Question / Intake_Response** - User intake forms (Phase 3.10) - Critical for personalization
- ✅ **User_Context** - User context storage (Phase 3.10) - Editable via profile settings, synced from intake forms
- ✅ **Favorited_Chatbots** - User favorites system (Phase 3.7) - Needed for homepage browsing

**Beta (See `beta_build.md`):**
- **Source_Creator** - Multi-creator source sharing (Phase 9) - Multi-creator collaboration
- **Chatbot_Creator** - Multi-creator chatbot ownership (Phase 9) - Multi-creator collaboration
- **Conversation_File** - User-uploaded context files (Phase 3) - Advanced user context
- **Report** - Content reporting system (Phase 7) - Content moderation
- **Chatbot_Audience_Profile** - Audience demographics (Phase 4) - Advanced analytics
- **Conversation_Source_Usage** - Source usage tracking (Phase 8) - Revenue attribution
- **Creator_Revenue_Summary** - Revenue aggregation (Phase 8) - Revenue dashboards
- **Revenue_per_Conversation** - Revenue attribution (Phase 8) - Revenue tracking

---

#### Phase 3.8: Multiple Chatbots Support ✅ ALPHA

**Objective:** Support multiple chatbot instances (Art of War, other public domain works)

**Why needed for Alpha:** Essential for offering multiple public domain books/works

**Prerequisites:**
- ✅ Creator can own multiple chatbots (schema supports this)
- ✅ Homepage/dashboard navigation working

**Tasks:**

1. **Create chatbot selection page:**

   **`app/chatbots/page.tsx`:**
   ```typescript
   import { auth } from '@clerk/nextjs/server';
   import { prisma } from '@/lib/prisma';
   import Link from 'next/link';
   import { Card } from '@/components/ui/card';
   
   export default async function ChatbotsPage() {
     const { userId } = auth();
     
     if (!userId) {
       return <div>Please sign in</div>;
     }
     
     // Get user's chatbots
     const user = await prisma.user.findUnique({
       where: { clerkId: userId },
       include: {
         creators: {
           include: {
             creator: {
               include: {
                 chatbots: true,
               },
             },
           },
         },
       },
     });
     
     const chatbots = user?.creators.flatMap(cu => cu.creator.chatbots) || [];
     
     return (
       <div className="container mx-auto py-8">
         <h1 className="text-3xl font-bold mb-8">Your Chatbots</h1>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {chatbots.map((chatbot) => (
             <Link key={chatbot.id} href={`/chat/${chatbot.id}`}>
               <Card className="p-6 hover:shadow-lg transition-shadow">
                 <h2 className="text-xl font-semibold mb-2">{chatbot.title}</h2>
                 <p className="text-gray-600">{chatbot.description}</p>
               </Card>
             </Link>
           ))}
         </div>
       </div>
     );
   }
   ```

2. **Add chatbot switcher to navigation:**

   Update navigation component to show chatbot dropdown/switcher

3. **Update homepage to show chatbot list:**

   Allow users to browse and select chatbots

**Deliverables:**
- ✅ Chatbot selection page
- ✅ Navigation with chatbot switcher
- ✅ Homepage shows available chatbots
- ✅ Multi-chatbot support working

**Testing:**
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing checklist complete

---

#### Phase 3.9: Chatbot Versioning System ✅ ALPHA

**Objective:** Implement versioning system to track chatbot configuration changes

**Why needed for Alpha:** Critical for tracking prompt changes during rapid testing and iteration

**Prerequisites:**
- ✅ Chatbot model exists
- ✅ Need to track system prompt, config, and RAG settings changes

**Tasks:**

1. **Add Chatbot_Version model to schema:**

   **`prisma/schema.prisma`:**
   ```prisma
   model Chatbot_Version {
     id                String   @id @default(cuid())
     chatbotId         String
     chatbot           Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
     versionNumber     Int
     title             String
     description       String?
     systemPrompt      String
     modelProvider     String
     modelName         String
     pineconeNs        String
     vectorNamespace   String
     configJson        Json?
     ragSettingsJson   Json?
     ingestionRunIds   String[]
     allowAnonymous    Boolean  @default(false)
     priceCents        Int
     currency          String
     type              ChatbotType
     notes             String?
     changelog         String?
     createdByUserId   String
     createdBy         User     @relation("ChatbotVersionCreator", fields: [createdByUserId], references: [id])
     
     activatedAt       DateTime?   // When it became current
     deactivatedAt     DateTime?   // When it was replaced
     
     createdAt         DateTime @default(now())
     updatedAt         DateTime @updatedAt
     
     conversations     Conversation[]
     
     @@unique([chatbotId, versionNumber])
     @@index([chatbotId])
     @@index([activatedAt])
   }
   
   // Update Chatbot model
   model Chatbot {
     // ... existing fields ...
     currentVersionId  String?
     currentVersion    Chatbot_Version? @relation("CurrentVersion", fields: [currentVersionId], references: [id])
     versions          Chatbot_Version[]
   }
   ```

   **Run migration:**
   
   **Step 1a: Update Development Database (Local)**
   - Ensure your `.env.local` points to your **development Neon branch**
   - Run migration locally (creates migration files + applies to dev DB):
     ```bash
     npx prisma migrate dev --name add_chatbot_versioning
     npx prisma generate
     ```
   - This updates your **development Neon database** and creates migration files in `prisma/migrations/`
   
   **Step 1b: Commit Migration Files**
   - Commit the new migration files to git:
     ```bash
     git add prisma/migrations/
     git commit -m "Add chatbot versioning migration"
     ```
   
   **Step 1c: Deploy to Production (Vercel)**
   - Push to your repository and deploy to Vercel
   - Vercel will automatically run `prisma migrate deploy` during build (using production `DATABASE_URL` from Vercel env vars)
   - This applies the migration to your **production Neon database**

2. **Create version creation utility:**

   **`lib/chatbot/versioning.ts`:**
   ```typescript
   import { prisma } from '@/lib/prisma';
   
   export async function createChatbotVersion(
     chatbotId: string,
     userId: string,
     changes: {
       systemPrompt?: string;
       configJson?: any;
       ragSettingsJson?: any;
       notes?: string;
       changelog?: string;
     }
   ) {
     const chatbot = await prisma.chatbot.findUnique({
       where: { id: chatbotId },
       include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
     });
     
     if (!chatbot) throw new Error('Chatbot not found');
     
     const nextVersionNumber = chatbot.versions[0]?.versionNumber 
       ? chatbot.versions[0].versionNumber + 1 
       : 1;
     
     // Deactivate current version
     if (chatbot.currentVersionId) {
       await prisma.chatbot_Version.update({
         where: { id: chatbot.currentVersionId },
         data: { deactivatedAt: new Date() },
       });
     }
     
     // Create new version
     const newVersion = await prisma.chatbot_Version.create({
       data: {
         chatbotId,
         versionNumber: nextVersionNumber,
         title: chatbot.title,
         description: chatbot.description,
         systemPrompt: changes.systemPrompt || chatbot.systemPrompt,
         modelProvider: chatbot.modelProvider,
         modelName: chatbot.modelName,
         pineconeNs: chatbot.pineconeNs,
         vectorNamespace: chatbot.vectorNamespace,
         configJson: changes.configJson || chatbot.configJson,
         ragSettingsJson: changes.ragSettingsJson || chatbot.ragSettingsJson,
         ingestionRunIds: chatbot.ingestionRunIds || [],
         allowAnonymous: chatbot.allowAnonymous,
         priceCents: chatbot.priceCents,
         currency: chatbot.currency,
         type: chatbot.type,
         notes: changes.notes,
         changelog: changes.changelog,
         createdByUserId: userId,
         activatedAt: new Date(),
       },
     });
     
     // Update chatbot to point to new version
     await prisma.chatbot.update({
       where: { id: chatbotId },
       data: { currentVersionId: newVersion.id },
     });
     
     return newVersion;
   }
   ```

3. **Update chatbot update API to create versions:**

   **`app/api/chatbots/[chatbotId]/route.ts`:**
   ```typescript
   // When updating chatbot config, create new version
   if (req.method === 'PATCH') {
     const { systemPrompt, configJson, ragSettingsJson, notes, changelog } = await req.json();
     
     await createChatbotVersion(chatbotId, userId, {
       systemPrompt,
       configJson,
       ragSettingsJson,
       notes,
       changelog,
     });
     
     // Update chatbot fields that aren't versioned
     await prisma.chatbot.update({
       where: { id: chatbotId },
       data: { /* non-versioned fields */ },
     });
   }
   ```

4. **Update Conversation model to reference version:**

   **`prisma/schema.prisma`:**
   ```prisma
   model Conversation {
     // ... existing fields ...
     chatbotVersionId   String
     chatbotVersion      Chatbot_Version @relation(fields: [chatbotVersionId], references: [id])
   }
   ```

5. **Create version history view (optional for Alpha):**

   **`components/dashboard/version-history.tsx`:**
   ```typescript
   export async function VersionHistory({ chatbotId }: { chatbotId: string }) {
     const versions = await prisma.chatbot_Version.findMany({
       where: { chatbotId },
       orderBy: { versionNumber: 'desc' },
       include: { createdBy: { select: { firstName: true, lastName: true } } },
     });
     
     return (
       <div className="space-y-4">
         {versions.map((version) => (
           <Card key={version.id}>
             <div className="flex justify-between">
               <div>
                 <h3>Version {version.versionNumber}</h3>
                 <p className="text-sm text-gray-600">
                   Created {version.createdAt.toLocaleDateString()}
                 </p>
                 {version.changelog && <p>{version.changelog}</p>}
               </div>
               {version.activatedAt && (
                 <Badge>Current</Badge>
               )}
             </div>
           </Card>
         ))}
       </div>
     );
   }
   ```

**Deliverables:**
- ✅ Chatbot_Version model added to schema
- ✅ Version creation utility
- ✅ Automatic versioning on chatbot updates
- ✅ Conversations reference chatbot versions
- ✅ Version history tracking
- ✅ Optional version history UI component

**Testing:**
- [ ] Creating chatbot creates version 1
- [ ] Updating chatbot creates new version
- [ ] Conversations reference correct version
- [ ] Version history displays correctly
- [ ] Can rollback to previous version (if implemented)

---

#### Phase 3.10: User Intake Forms ✅ ALPHA

**Objective:** Implement intake forms to collect user context for personalization

**Why needed for Alpha:** Critical for personalizing chatbot responses based on user context

**Prerequisites:**
- ✅ Chatbot model exists
- ✅ User model exists
- ✅ Need to collect user context (industry, role, goals, etc.)

**Tasks:**

1. **Add Intake_Question, Intake_Response, and User_Context models to schema:**

   **`prisma/schema.prisma`:**
   ```prisma
   enum IntakeResponseType {
     TEXT
     NUMBER
     SELECT
     MULTI_SELECT
     FILE
     DATE
     BOOLEAN
   }
   
   enum ContextSource {
     USER_PROVIDED
     INFERRED
     INTAKE_FORM
     PLATFORM_SYNC
   }
   
   model Intake_Question {
     id                String   @id @default(cuid())
     chatbotId         String
     chatbot           Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
     slug              String
     questionText      String
     helperText        String?
     responseType      IntakeResponseType
     displayOrder      Int
     isRequired        Boolean  @default(false)
     
     responses         Intake_Response[]
     
     createdAt         DateTime @default(now())
     updatedAt         DateTime @updatedAt
     
     @@unique([chatbotId, slug])
     @@index([chatbotId])
   }
   
   model Intake_Response {
     id                String   @id @default(cuid())
     intakeQuestionId  String
     intakeQuestion    Intake_Question @relation(fields: [intakeQuestionId], references: [id], onDelete: Cascade)
     userId            String
     user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     chatbotId         String?
     chatbot           Chatbot? @relation("IntakeResponseChatbot", fields: [chatbotId], references: [id], onDelete: Cascade)
     fileId            String?
     file              File?    @relation("IntakeResponseFile", fields: [fileId], references: [id], onDelete: Cascade)
     value             Json
     reusableAcrossFrameworks Boolean @default(false)
     
     createdAt         DateTime @default(now())
     updatedAt         DateTime @updatedAt
     
     @@index([userId])
     @@index([intakeQuestionId])
   }
   
   // Flexible user context storage (editable via profile settings)
   model User_Context {
     id              String   @id @default(cuid())
     userId          String
     user            User     @relation("UserContext", fields: [userId], references: [id], onDelete: Cascade)
     chatbotId       String?  // Null = global context (applies to all chatbots)
     chatbot         Chatbot? @relation("ChatbotContext", fields: [chatbotId], references: [id], onDelete: Cascade)
     
     key             String   // e.g., 'industry', 'role', 'goals', 'company_size'
     value           Json     // Flexible value storage
     source          ContextSource @default(USER_PROVIDED)
     confidence      Float?   // 0.0-1.0 for inferred context
     
     expiresAt       DateTime? // Optional expiration for temporary context
     isVisible       Boolean  @default(true)  // User can see this in profile
     isEditable      Boolean  @default(true)  // User can edit this in profile
     
     createdAt       DateTime @default(now())
     updatedAt       DateTime @updatedAt
     
     @@unique([userId, chatbotId, key])
     @@index([userId])
     @@index([chatbotId])
   }
   ```

   **Run migration:**
   
   **Step 1a: Update Development Database (Local)**
   - Ensure your `.env.local` points to your **development Neon branch**
   - Run migration locally (creates migration files + applies to dev DB):
     ```bash
     npx prisma migrate dev --name add_intake_forms
     npx prisma generate
     ```
   - This updates your **development Neon database** and creates migration files in `prisma/migrations/`
   
   **Step 1b: Commit Migration Files**
   - Commit the new migration files to git:
     ```bash
     git add prisma/migrations/
     git commit -m "Add intake forms migration"
     ```
   
   **Step 1c: Deploy to Production (Vercel)**
   - Push to your repository and deploy to Vercel
   - Vercel will automatically run `prisma migrate deploy` during build (using production `DATABASE_URL` from Vercel env vars)
   - This applies the migration to your **production Neon database**

2. **Create intake form API:**

   **`app/api/intake/questions/route.ts`:**
   ```typescript
   // GET /api/intake/questions?chatbotId=xxx
   export async function GET(request: Request) {
     const { searchParams } = new URL(request.url);
     const chatbotId = searchParams.get('chatbotId');
     
     const questions = await prisma.intake_Question.findMany({
       where: { chatbotId: chatbotId! },
       orderBy: { displayOrder: 'asc' },
     });
     
     return Response.json({ questions });
   }
   
   // POST /api/intake/questions
   export async function POST(request: Request) {
     const { chatbotId, slug, questionText, helperText, responseType, displayOrder, isRequired } = await request.json();
     
     const question = await prisma.intake_Question.create({
       data: {
         chatbotId,
         slug,
         questionText,
         helperText,
         responseType,
         displayOrder,
         isRequired,
       },
     });
     
     return Response.json({ question });
   }
   ```

   **`app/api/intake/responses/route.ts`:**
   ```typescript
   // POST /api/intake/responses
   export async function POST(request: Request) {
     const { userId, intakeQuestionId, chatbotId, value, reusableAcrossFrameworks } = await request.json();
     
     const response = await prisma.intake_Response.create({
       data: {
         userId,
         intakeQuestionId,
         chatbotId,
         value,
         reusableAcrossFrameworks,
       },
     });
     
     return Response.json({ response });
   }
   ```

3. **Create intake form component:**

   **`components/intake-form.tsx`:**
   ```typescript
   'use client';
   
   import { useState, useEffect } from 'react';
   import { Button } from './ui/button';
   import { Input } from './ui/input';
   import { Textarea } from './ui/textarea';
   import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
   import { Checkbox } from './ui/checkbox';
   
   interface IntakeQuestion {
     id: string;
     slug: string;
     questionText: string;
     helperText?: string;
     responseType: 'TEXT' | 'NUMBER' | 'SELECT' | 'MULTI_SELECT' | 'FILE' | 'DATE' | 'BOOLEAN';
     displayOrder: number;
     isRequired: boolean;
   }
   
   export function IntakeForm({ chatbotId, userId, onComplete }: { 
     chatbotId: string; 
     userId: string;
     onComplete: () => void;
   }) {
     const [questions, setQuestions] = useState<IntakeQuestion[]>([]);
     const [responses, setResponses] = useState<Record<string, any>>({});
     const [loading, setLoading] = useState(true);
     
     useEffect(() => {
       fetch(`/api/intake/questions?chatbotId=${chatbotId}`)
         .then(res => res.json())
         .then(data => {
           setQuestions(data.questions);
           setLoading(false);
         });
     }, [chatbotId]);
     
     async function handleSubmit() {
       // Validate required fields
       const missing = questions.filter(q => q.isRequired && !responses[q.id]);
       if (missing.length > 0) {
         alert(`Please answer: ${missing.map(q => q.questionText).join(', ')}`);
         return;
       }
       
       // Submit all responses
       await Promise.all(
         Object.entries(responses).map(([questionId, value]) =>
           fetch('/api/intake/responses', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               userId,
               intakeQuestionId: questionId,
               chatbotId,
               value,
             }),
           })
         )
       );
       
       onComplete();
     }
     
     if (loading) return <div>Loading...</div>;
     if (questions.length === 0) {
       onComplete(); // No questions, skip form
       return null;
     }
     
     return (
       <div className="space-y-6 p-6">
         <h2 className="text-2xl font-bold">Tell us about yourself</h2>
         <p className="text-gray-600">Help us personalize your experience</p>
         
         {questions.map((question) => (
           <div key={question.id} className="space-y-2">
             <label className="font-medium">
               {question.questionText}
               {question.isRequired && <span className="text-red-500">*</span>}
             </label>
             {question.helperText && (
               <p className="text-sm text-gray-500">{question.helperText}</p>
             )}
             
             {question.responseType === 'TEXT' && (
               <Input
                 value={responses[question.id] || ''}
                 onChange={(e) => setResponses({ ...responses, [question.id]: e.target.value })}
               />
             )}
             
             {question.responseType === 'SELECT' && (
               <Select
                 value={responses[question.id]}
                 onValueChange={(value) => setResponses({ ...responses, [question.id]: value })}
               >
                 <SelectTrigger>
                   <SelectValue placeholder="Select..." />
                 </SelectTrigger>
                 <SelectContent>
                   {/* Options would come from question metadata */}
                 </SelectContent>
               </Select>
             )}
             
             {/* Add other response types as needed */}
           </div>
         ))}
         
         <Button onClick={handleSubmit} className="w-full">
           Continue
         </Button>
       </div>
     );
   }
   ```

4. **Integrate intake form into chat flow:**

   **`app/chat/[chatbotId]/page.tsx`:**
   ```typescript
   // Show intake form before first message if user hasn't completed it
   const [showIntakeForm, setShowIntakeForm] = useState(false);
   
   useEffect(() => {
     // Check if user has completed intake for this chatbot
     checkIntakeCompletion(chatbotId, userId).then(completed => {
       if (!completed) setShowIntakeForm(true);
     });
   }, [chatbotId, userId]);
   
   if (showIntakeForm) {
     return (
       <IntakeForm
         chatbotId={chatbotId}
         userId={userId}
         onComplete={() => setShowIntakeForm(false)}
       />
     );
   }
   ```

5. **Sync intake responses to User_Context:**

   **`app/api/intake/responses/route.ts`:**
   ```typescript
   // After creating intake response, sync to User_Context
   export async function POST(request: Request) {
     const { userId, intakeQuestionId, chatbotId, value, reusableAcrossFrameworks } = await request.json();
     
     const question = await prisma.intake_Question.findUnique({
       where: { id: intakeQuestionId },
     });
     
     // Create intake response
     const response = await prisma.intake_Response.create({
       data: {
         userId,
         intakeQuestionId,
         chatbotId,
         value,
         reusableAcrossFrameworks,
       },
     });
     
     // Sync to User_Context (global if reusable, chatbot-specific otherwise)
     const targetChatbotId = reusableAcrossFrameworks ? null : chatbotId;
     
     await prisma.user_Context.upsert({
       where: {
         userId_chatbotId_key: {
           userId,
           chatbotId: targetChatbotId,
           key: question.slug,
         },
       },
       create: {
         userId,
         chatbotId: targetChatbotId,
         key: question.slug,
         value,
         source: 'INTAKE_FORM',
         isVisible: true,
         isEditable: true,
       },
       update: {
         value,
         source: 'INTAKE_FORM',
         updatedAt: new Date(),
       },
     });
     
     return Response.json({ response });
   }
   ```

6. **Use User_Context in chat:**

   **`app/api/chat/route.ts`:**
   ```typescript
   // Fetch user context (global + chatbot-specific)
   const userContexts = await prisma.user_Context.findMany({
     where: {
       userId: user.id,
       OR: [
         { chatbotId: null }, // Global context
         { chatbotId },        // Chatbot-specific context
       ],
       isVisible: true,
     },
   });
   
   // Build user context object
   const userContext = userContexts.reduce((acc, ctx) => {
     acc[ctx.key] = ctx.value;
     return acc;
   }, {} as Record<string, any>);
   
   // Include in system prompt or RAG query
   const systemPrompt = `You are a helpful assistant. User context: ${JSON.stringify(userContext)}`;
   ```

7. **Create user profile settings page:**

   **`app/profile/page.tsx`:**
   ```typescript
   import { auth } from '@clerk/nextjs/server';
   import { prisma } from '@/lib/prisma';
   import { UserContextEditor } from '@/components/user-context-editor';
   
   export default async function ProfilePage() {
     const { userId: clerkId } = auth();
     const user = await prisma.user.findUnique({
       where: { clerkId },
     });
     
     // Get all user context (global + chatbot-specific)
     const userContexts = await prisma.user_Context.findMany({
       where: {
         userId: user.id,
         isVisible: true,
       },
       include: {
         chatbot: {
           select: { title: true },
         },
       },
       orderBy: [
         { chatbotId: 'asc' }, // Global context first (null)
         { key: 'asc' },
       ],
     });
     
     return (
       <div className="container mx-auto py-8">
         <h1 className="text-3xl font-bold mb-8">Profile Settings</h1>
         <UserContextEditor contexts={userContexts} userId={user.id} />
       </div>
     );
   }
   ```

8. **Create user context editor component:**

   **`components/user-context-editor.tsx`:**
   ```typescript
   'use client';
   
   import { useState } from 'react';
   import { Button } from './ui/button';
   import { Input } from './ui/input';
   import { Textarea } from './ui/textarea';
   import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
   import { Card } from './ui/card';
   import { Badge } from './ui/badge';
   
   interface UserContext {
     id: string;
     key: string;
     value: any;
     chatbotId: string | null;
     chatbot?: { title: string } | null;
     source: string;
     isEditable: boolean;
   }
   
   export function UserContextEditor({ contexts, userId }: { contexts: UserContext[]; userId: string }) {
     const [editing, setEditing] = useState<Record<string, any>>({});
     
     async function handleSave(contextId: string, newValue: any) {
       await fetch('/api/user-context', {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           contextId,
           value: newValue,
         }),
       });
       
       setEditing({ ...editing, [contextId]: false });
       window.location.reload(); // Refresh to show updated values
     }
     
     // Group by chatbot
     const globalContexts = contexts.filter(c => !c.chatbotId);
     const chatbotContexts = contexts.filter(c => c.chatbotId);
     const byChatbot = chatbotContexts.reduce((acc, ctx) => {
       const chatbotId = ctx.chatbotId!;
       if (!acc[chatbotId]) acc[chatbotId] = [];
       acc[chatbotId].push(ctx);
       return acc;
     }, {} as Record<string, UserContext[]>);
     
     return (
       <div className="space-y-8">
         {/* Global Context */}
         <Card className="p-6">
           <h2 className="text-xl font-semibold mb-4">Global Context</h2>
           <p className="text-sm text-gray-600 mb-4">
             This information applies to all chatbots
           </p>
           <div className="space-y-4">
             {globalContexts.map((ctx) => (
               <div key={ctx.id} className="flex items-center gap-4">
                 <div className="w-32 font-medium capitalize">{ctx.key.replace(/_/g, ' ')}</div>
                 {editing[ctx.id] ? (
                   <div className="flex-1 flex gap-2">
                     <Input
                       value={editing[ctx.id]}
                       onChange={(e) => setEditing({ ...editing, [ctx.id]: e.target.value })}
                     />
                     <Button size="sm" onClick={() => handleSave(ctx.id, editing[ctx.id])}>
                       Save
                     </Button>
                     <Button size="sm" variant="ghost" onClick={() => setEditing({ ...editing, [ctx.id]: false })}>
                       Cancel
                     </Button>
                   </div>
                 ) : (
                   <>
                     <div className="flex-1">{JSON.stringify(ctx.value)}</div>
                     {ctx.isEditable && (
                       <Button size="sm" variant="outline" onClick={() => setEditing({ ...editing, [ctx.id]: ctx.value })}>
                         Edit
                       </Button>
                     )}
                     <Badge variant="secondary">{ctx.source}</Badge>
                   </>
                 )}
               </div>
             ))}
           </div>
         </Card>
         
         {/* Chatbot-Specific Context */}
         {Object.entries(byChatbot).map(([chatbotId, ctxs]) => (
           <Card key={chatbotId} className="p-6">
             <h2 className="text-xl font-semibold mb-4">
               {ctxs[0].chatbot?.title || 'Chatbot'} Context
             </h2>
             <div className="space-y-4">
               {ctxs.map((ctx) => (
                 <div key={ctx.id} className="flex items-center gap-4">
                   <div className="w-32 font-medium capitalize">{ctx.key.replace(/_/g, ' ')}</div>
                   {editing[ctx.id] ? (
                     <div className="flex-1 flex gap-2">
                       <Input
                         value={editing[ctx.id]}
                         onChange={(e) => setEditing({ ...editing, [ctx.id]: e.target.value })}
                       />
                       <Button size="sm" onClick={() => handleSave(ctx.id, editing[ctx.id])}>
                         Save
                       </Button>
                       <Button size="sm" variant="ghost" onClick={() => setEditing({ ...editing, [ctx.id]: false })}>
                         Cancel
                       </Button>
                     </div>
                   ) : (
                     <>
                       <div className="flex-1">{JSON.stringify(ctx.value)}</div>
                       {ctx.isEditable && (
                         <Button size="sm" variant="outline" onClick={() => setEditing({ ...editing, [ctx.id]: ctx.value })}>
                           Edit
                         </Button>
                       )}
                       <Badge variant="secondary">{ctx.source}</Badge>
                     </>
                   )}
                 </div>
               ))}
             </div>
           </Card>
         ))}
       </div>
     );
   }
   ```

9. **Create user context API:**

   **`app/api/user-context/route.ts`:**
   ```typescript
   import { auth } from '@clerk/nextjs/server';
   import { prisma } from '@/lib/prisma';
   
   // GET /api/user-context
   export async function GET(request: Request) {
     const { userId: clerkId } = auth();
     const user = await prisma.user.findUnique({ where: { clerkId } });
     
     const contexts = await prisma.user_Context.findMany({
       where: { userId: user.id },
     });
     
     return Response.json({ contexts });
   }
   
   // PATCH /api/user-context
   export async function PATCH(request: Request) {
     const { userId: clerkId } = auth();
     const user = await prisma.user.findUnique({ where: { clerkId } });
     const { contextId, value } = await request.json();
     
     const context = await prisma.user_Context.findUnique({
       where: { id: contextId },
     });
     
     if (context.userId !== user.id || !context.isEditable) {
       return Response.json({ error: 'Unauthorized' }, { status: 403 });
     }
     
     await prisma.user_Context.update({
       where: { id: contextId },
       data: {
         value,
         source: 'USER_PROVIDED', // Mark as user-provided when edited
         updatedAt: new Date(),
       },
     });
     
     return Response.json({ success: true });
   }
   
   // POST /api/user-context (create new context)
   export async function POST(request: Request) {
     const { userId: clerkId } = auth();
     const user = await prisma.user.findUnique({ where: { clerkId } });
     const { chatbotId, key, value } = await request.json();
     
     const context = await prisma.user_Context.create({
       data: {
         userId: user.id,
         chatbotId: chatbotId || null,
         key,
         value,
         source: 'USER_PROVIDED',
         isVisible: true,
         isEditable: true,
       },
     });
     
     return Response.json({ context });
   }
   ```

**Deliverables:**
- ✅ Intake_Question and Intake_Response models
- ✅ User_Context model (editable via profile settings)
- ✅ Intake form API endpoints
- ✅ Intake form UI component
- ✅ User profile settings page (`/profile`)
- ✅ User context editor component
- ✅ User context API (GET/PATCH/POST)
- ✅ Automatic sync from intake responses to User_Context
- ✅ Integration into chat flow
- ✅ User context used in chat responses (global + chatbot-specific)

**Testing:**
- [ ] Intake questions can be created
- [ ] Intake form displays correctly
- [ ] Responses are saved
- [ ] Intake responses sync to User_Context
- [ ] Form shows before first chat message
- [ ] User context used in chat responses
- [ ] Required fields validated
- [ ] Can skip form if no questions
- [ ] User profile page displays all context
- [ ] Users can edit context in profile settings
- [ ] Global context applies to all chatbots
- [ ] Chatbot-specific context applies only to that chatbot
- [ ] Context source (INTAKE_FORM, USER_PROVIDED) tracked correctly

---

## Phase 4: Analytics & Intelligence (Weeks 8-10)

### **CRITICAL FOR ALPHA**

#### Phase 4.1: Sentiment Analysis Job ✅ ALPHA

**Objective:** Implement async sentiment analysis of user messages

**Why needed for Alpha:** Foundation for content intelligence, informs what's working

**Prerequisites:**
- ✅ Message_Analysis table exists in schema
- ✅ OpenAI API key configured
- ✅ Chunk_Performance table supports sentiment fields (`satisfactionSum`, `satisfactionCount`, `confusionCount`, etc.)

**Tasks:**

1. **Create sentiment analysis utility:**

   **`lib/analysis/sentiment.ts`:**
   ```typescript
   import OpenAI from 'openai';
   import { env } from '@/lib/env';
   
   const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
   
   export interface SentimentAnalysis {
     sentiment: {
       satisfaction: number;  // 0-1
       confusion: number;     // 0-1
       frustration: number;   // 0-1
     };
     intent: 'question' | 'clarification' | 'followup' | 'gratitude' | 'complaint';
   }
   
   export async function analyzeMessageSentiment(
     userMessage: string,
     previousBotMessage?: string
   ): Promise<SentimentAnalysis> {
     const prompt = `Analyze this user message and respond with ONLY a JSON object (no markdown, no explanation):

User message: "${userMessage}"
${previousBotMessage ? `Previous bot response: "${previousBotMessage}"` : ''}

Return JSON with:
{
  "sentiment": {
    "satisfaction": 0.0-1.0,
    "confusion": 0.0-1.0,
    "frustration": 0.0-1.0
  },
  "intent": "question" | "clarification" | "followup" | "gratitude" | "complaint"
}`;
     
     const response = await openai.chat.completions.create({
       model: 'gpt-4o-mini',  // Cheaper for analysis
       messages: [{ role: 'user', content: prompt }],
       temperature: 0,
     });
     
     const content = response.choices[0].message.content!;
     return JSON.parse(content);
   }
   ```

2. **Create sentiment analysis API route:**

   **`app/api/analysis/sentiment/route.ts`:**
   ```typescript
   import { prisma } from '@/lib/prisma';
   import { analyzeMessageSentiment } from '@/lib/analysis/sentiment';
   
   export async function POST(request: Request) {
     const { messageId } = await request.json();
     
     const message = await prisma.message.findUnique({
       where: { id: messageId },
       include: {
         conversation: {
           include: {
             messages: {
               orderBy: { createdAt: 'asc' },
             },
           },
         },
       },
     });
     
     if (!message || message.role !== 'user') {
       return Response.json({ error: 'Invalid message' }, { status: 400 });
     }
     
     // Find previous bot message
     const messages = message.conversation.messages;
     const userMessageIndex = messages.findIndex(m => m.id === messageId);
     const previousBotMessage = messages
       .slice(0, userMessageIndex)
       .reverse()
       .find(m => m.role === 'assistant');
     
     // Analyze sentiment
     const analysis = await analyzeMessageSentiment(
       message.content,
       previousBotMessage?.content
     );
     
     // Store analysis
     await prisma.message_Analysis.create({
       data: {
         messageId,
         analysis,
       },
     });
     
     return Response.json({ success: true, analysis });
   }
   ```

3. **Create attribution job (links sentiment → chunks):**

   **`app/api/jobs/attribute-sentiment/route.ts`:**
   ```typescript
   import { prisma } from '@/lib/prisma';
   
   export async function POST(request: Request) {
     // Get unprocessed messages with analysis
     const analyses = await prisma.message_Analysis.findMany({
       where: {
         attributed: false,  // Only process unattributed analyses
       },
       include: {
         message: {
           include: {
             conversation: {
               include: {
                 messages: {
                   orderBy: { createdAt: 'asc' },
                 },
               },
             },
           },
         },
       },
       take: 100,  // Process in batches
     });
     
     for (const analysis of analyses) {
       const userMessage = analysis.message;
       const messages = userMessage.conversation.messages;
       
       // Find previous bot message
       const userMessageIndex = messages.findIndex(m => m.id === userMessage.id);
       const previousBotMessage = messages
         .slice(0, userMessageIndex)
         .reverse()
         .find(m => m.role === 'assistant');
       
       if (!previousBotMessage?.context) continue;
       
       const context = previousBotMessage.context as any;
       const chunks = context.chunks || [];
       
       if (chunks.length === 0) continue;
       
       // Get sentiment from analysis
       const sentiment = analysis.analysis as any;
       
       // Attribution with position weighting
       const totalWeight = chunks.reduce((sum: number, _: any, idx: number) => 
         sum + (1 / (idx + 1)), 0
       );
       
       const month = new Date().getMonth() + 1;
       const year = new Date().getFullYear();
       
       // Update each chunk's performance
       for (let i = 0; i < chunks.length; i++) {
         const chunk = chunks[i];
         const weight = (1 / (i + 1)) / totalWeight;
         
         await prisma.chunk_Performance.upsert({
           where: {
             chunkId_chatbotId_month_year: {
               chunkId: chunk.chunkId,
               chatbotId: userMessage.conversation.chatbotId,
               month,
               year,
             },
           },
           create: {
             chunkId: chunk.chunkId,
             sourceId: chunk.sourceId,
             chatbotId: userMessage.conversation.chatbotId,
             month,
             year,
             satisfactionSum: sentiment.sentiment.satisfaction * weight,
             satisfactionCount: 1,
             confusionCount: sentiment.sentiment.confusion > 0.6 ? 1 : 0,
             clarificationCount: sentiment.intent === 'clarification' ? 1 : 0,
             responseCount: 1,
           },
           update: {
             satisfactionSum: { increment: sentiment.sentiment.satisfaction * weight },
             satisfactionCount: { increment: 1 },
             confusionCount: { increment: sentiment.sentiment.confusion > 0.6 ? 1 : 0 },
             clarificationCount: { increment: sentiment.intent === 'clarification' ? 1 : 0 },
             responseCount: { increment: 1 },
           },
         });
       }
       
       // Mark analysis as attributed
       await prisma.message_Analysis.update({
         where: { id: analysis.id },
         data: { attributed: true },
       });
     }
     
     return Response.json({ processed: analyses.length });
   }
   ```

4. **Set up Vercel Cron for analysis:**

   Update `vercel.json`:
   ```json
   {
     "crons": [
       {
         "path": "/api/jobs/attribute-sentiment",
         "schedule": "*/15 * * * *"  // Every 15 minutes
       }
     ]
   }
   ```

5. **Trigger sentiment analysis after user messages:**

   Update chat API (`app/api/chat/route.ts`) to trigger sentiment analysis job after storing user message (non-blocking).

**Deliverables:**
- ✅ Sentiment analysis with GPT-4o-mini
- ✅ Message_Analysis table populated
- ✅ Attribution job links sentiment → chunks
- ✅ Chunk_Performance counters updated with sentiment
- ✅ Cron job runs every 15 minutes

**Testing:**
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing checklist complete

---

#### Phase 4.2: Enhanced Creator Dashboard ✅ ALPHA (Basic Version)

**Objective:** Build dashboard showing underperforming and top-performing chunks, plus source performance

**Why needed for Alpha:** Shows which public domain works resonate most with users

**Prerequisites:**
- ✅ Sentiment analysis job running
- ✅ Chunk_Performance table has sentiment data
- ✅ Format preferences data from "need more" feedback

**Tasks:**

1. **Create format preferences widget:**

   **`components/dashboard/format-preferences.tsx`:**
   ```typescript
   import { prisma } from '@/lib/prisma';
   
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

2. **Create enhanced chunk performance view:**

   **`components/dashboard/chunk-performance.tsx`:**
   ```typescript
   import { prisma } from '@/lib/prisma';
   import { Card } from '../ui/card';
   
   export async function ChunkPerformanceView({ chatbotId }: { chatbotId: string }) {
     const month = new Date().getMonth() + 1;
     const year = new Date().getFullYear();
     
     // Get underperforming chunks
     const underperforming = await prisma.$queryRaw<any[]>`
       SELECT 
         "chunkId",
         "sourceId",
         "chunkText",
         "chunkMetadata",
         "timesUsed",
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
         "needsScriptsCount",
         "needsExamplesCount",
         "needsStepsCount"
       FROM "Chunk_Performance"
       WHERE "chatbotId" = ${chatbotId}
         AND "month" = ${month}
         AND "year" = ${year}
         AND "timesUsed" >= 10
         AND "satisfactionCount" > 0
         AND "satisfactionSum" / "satisfactionCount" < 3.0
       ORDER BY "timesUsed" DESC
       LIMIT 10
     `;
     
     // Get top performing chunks
     const topPerforming = await prisma.$queryRaw<any[]>`
       SELECT 
         "chunkId",
         "sourceId",
         "chunkText",
         "chunkMetadata",
         "timesUsed",
         CASE 
           WHEN "satisfactionCount" > 0 
           THEN "satisfactionSum" / "satisfactionCount" 
           ELSE NULL 
         END as "avgSatisfaction",
         "copyToUseNowCount",
         "helpfulCount"
       FROM "Chunk_Performance"
       WHERE "chatbotId" = ${chatbotId}
         AND "month" = ${month}
         AND "year" = ${year}
         AND "timesUsed" >= 10
         AND "satisfactionCount" > 0
         AND "satisfactionSum" / "satisfactionCount" >= 4.0
       ORDER BY "avgSatisfaction" DESC, "copyToUseNowCount" DESC
       LIMIT 10
     `;
     
     return (
       <div className="space-y-8">
         <div>
           <h2 className="text-2xl font-bold mb-4">⚠️ Underperforming Content</h2>
           {underperforming.length === 0 && (
             <p className="text-gray-600">No underperforming content found (yet!)</p>
           )}
           <div className="space-y-4">
             {underperforming.map((chunk) => (
               <Card key={chunk.chunkId} className="p-6">
                 <div className="flex justify-between items-start mb-4">
                   <div>
                     <h3 className="font-semibold">
                       {chunk.chunkMetadata?.sourceTitle || 'Unknown Source'}
                     </h3>
                     <p className="text-sm text-gray-600">
                       Page {chunk.chunkMetadata?.page} • {chunk.chunkMetadata?.chapter}
                     </p>
                   </div>
                   <div className="text-right">
                     <div className="text-2xl font-bold text-red-600">
                       {chunk.avgSatisfaction.toFixed(1)}★
                     </div>
                     <div className="text-sm text-gray-600">{chunk.timesUsed} uses</div>
                   </div>
                 </div>
                 
                 <div className="bg-gray-50 p-4 rounded mb-4">
                   <p className="text-sm">{chunk.chunkText?.substring(0, 300)}...</p>
                 </div>
                 
                 <div className="flex gap-4 text-sm">
                   {chunk.confusionRate > 0.3 && (
                     <span className="text-orange-600">
                       {Math.round(chunk.confusionRate * 100)}% confusion rate
                     </span>
                   )}
                   {chunk.needsScriptsCount > 0 && (
                     <span className="text-blue-600">
                       {chunk.needsScriptsCount} need scripts
                     </span>
                   )}
                   {chunk.needsExamplesCount > 0 && (
                     <span className="text-purple-600">
                       {chunk.needsExamplesCount} need examples
                     </span>
                   )}
                 </div>
               </Card>
             ))}
           </div>
         </div>
         
         <div>
           <h2 className="text-2xl font-bold mb-4">✨ Top Performing Content</h2>
           <div className="space-y-4">
             {topPerforming.map((chunk) => (
               <Card key={chunk.chunkId} className="p-6">
                 <div className="flex justify-between items-start mb-4">
                   <div>
                     <h3 className="font-semibold">
                       {chunk.chunkMetadata?.sourceTitle || 'Unknown Source'}
                     </h3>
                     <p className="text-sm text-gray-600">
                       Page {chunk.chunkMetadata?.page} • {chunk.chunkMetadata?.chapter}
                     </p>
                   </div>
                   <div className="text-right">
                     <div className="text-2xl font-bold text-green-600">
                       {chunk.avgSatisfaction.toFixed(1)}★
                     </div>
                     <div className="text-sm text-gray-600">{chunk.timesUsed} uses</div>
                   </div>
                 </div>
                 
                 <div className="bg-gray-50 p-4 rounded mb-4">
                   <p className="text-sm">{chunk.chunkText?.substring(0, 300)}...</p>
                 </div>
                 
                 <div className="flex gap-4 text-sm text-green-600">
                   {chunk.copyToUseNowCount > 0 && (
                     <span>{chunk.copyToUseNowCount} copied to use now</span>
                   )}
                   {chunk.helpfulCount > 0 && (
                     <span>{chunk.helpfulCount} marked helpful</span>
                   )}
                 </div>
               </Card>
             ))}
           </div>
         </div>
       </div>
     );
   }
   ```

3. **Add Source Performance Rollups (NEW):**

   **Objective:** Aggregate chunk performance by source to show which books/works perform best

   **Add to `prisma/schema.prisma`:**
   ```prisma
   model Source_Performance {
     id String @id @default(cuid())
     sourceId String
     chatbotId String
     
     // Aggregated from chunks
     totalUses Int @default(0)
     uniqueUsers Int @default(0)
     avgSatisfactionRate Float @default(0)
     
     // Feedback aggregation
     totalHelpful Int @default(0)
     totalNotHelpful Int @default(0)
     totalCopies Int @default(0)
     
     // Time period
     month Int
     year Int
     
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
     
     @@unique([sourceId, chatbotId, month, year])
     @@index([chatbotId, month, year])
     @@index([sourceId])
   }
   ```

   **Then run migration:**
   
   **Step 1a: Update Development Database (Local)**
   - Ensure your `.env.local` points to your **development Neon branch**
   - Run migration locally (creates migration files + applies to dev DB):
     ```bash
     npx prisma migrate dev --name add_source_performance
     npx prisma generate
     ```
   - This updates your **development Neon database** and creates migration files in `prisma/migrations/`
   
   **Step 1b: Commit Migration Files**
   - Commit the new migration files to git:
     ```bash
     git add prisma/migrations/
     git commit -m "Add source performance migration"
     ```
   
   **Step 1c: Deploy to Production (Vercel)**
   - Push to your repository and deploy to Vercel
   - Vercel will automatically run `prisma migrate deploy` during build (using production `DATABASE_URL` from Vercel env vars)
   - This applies the migration to your **production Neon database**

   **Implementation:**

   **Nightly aggregation job:**
   ```typescript
   // app/api/jobs/aggregate-source-performance/route.ts
   export async function POST(req: Request) {
     const month = new Date().getMonth() + 1;
     const year = new Date().getFullYear();
     
     // Get all chunks with performance data
     const chunkPerformance = await prisma.chunk_Performance.findMany({
       where: { month, year },
     });
     
     // Group by sourceId
     const bySource = chunkPerformance.reduce((acc, chunk) => {
       if (!acc[chunk.sourceId]) {
         acc[chunk.sourceId] = {
           sourceId: chunk.sourceId,
           chatbotId: chunk.chatbotId,
           totalUses: 0,
           totalHelpful: 0,
           totalNotHelpful: 0,
           totalCopies: 0,
           satisfactionSum: 0,
           satisfactionCount: 0,
         };
       }
       
       acc[chunk.sourceId].totalUses += chunk.timesUsed;
       acc[chunk.sourceId].totalHelpful += chunk.helpfulCount;
       acc[chunk.sourceId].totalNotHelpful += chunk.notHelpfulCount;
       acc[chunk.sourceId].totalCopies += chunk.copyToUseNowCount || 0;
       
       if (chunk.satisfactionRate > 0) {
         acc[chunk.sourceId].satisfactionSum += chunk.satisfactionRate;
         acc[chunk.sourceId].satisfactionCount += 1;
       }
       
       return acc;
     }, {} as Record<string, any>);
     
     // Upsert source performance
     for (const [sourceId, data] of Object.entries(bySource)) {
       await prisma.source_Performance.upsert({
         where: {
           sourceId_chatbotId_month_year: {
             sourceId,
             chatbotId: data.chatbotId,
             month,
             year,
           },
         },
         create: {
           sourceId,
           chatbotId: data.chatbotId,
           totalUses: data.totalUses,
           totalHelpful: data.totalHelpful,
           totalNotHelpful: data.totalNotHelpful,
           totalCopies: data.totalCopies,
           avgSatisfactionRate: data.satisfactionCount > 0 
             ? data.satisfactionSum / data.satisfactionCount 
             : 0,
           month,
           year,
         },
         update: {
           totalUses: data.totalUses,
           totalHelpful: data.totalHelpful,
           totalNotHelpful: data.totalNotHelpful,
           totalCopies: data.totalCopies,
           avgSatisfactionRate: data.satisfactionCount > 0 
             ? data.satisfactionSum / data.satisfactionCount 
             : 0,
         },
       });
     }
     
     return Response.json({ success: true });
   }
   ```

   **Dashboard component:**
   ```typescript
   // components/dashboard/source-performance.tsx
   export async function SourcePerformanceView({ chatbotId }: { chatbotId: string }) {
     const month = new Date().getMonth() + 1;
     const year = new Date().getFullYear();
     
     const sourcePerformance = await prisma.source_Performance.findMany({
       where: { chatbotId, month, year },
       orderBy: { totalUses: 'desc' },
       include: {
         source: {
           select: {
             title: true,
             author: true,
             type: true,
           },
         },
       },
     });
     
     return (
       <div className="space-y-4">
         <h2 className="text-2xl font-bold">Source Performance</h2>
         {sourcePerformance.map((perf) => (
           <Card key={perf.id} className="p-6">
             <div className="flex justify-between items-start">
               <div>
                 <h3 className="font-semibold text-lg">{perf.source.title}</h3>
                 <p className="text-sm text-gray-600">by {perf.source.author}</p>
               </div>
               <div className="text-right">
                 <div className="text-2xl font-bold">
                   {(perf.avgSatisfactionRate * 100).toFixed(0)}%
                 </div>
                 <div className="text-sm text-gray-600">satisfaction</div>
               </div>
             </div>
             
             <div className="grid grid-cols-3 gap-4 mt-4">
               <div>
                 <div className="text-sm text-gray-600">Total Uses</div>
                 <div className="text-xl font-semibold">{perf.totalUses}</div>
               </div>
               <div>
                 <div className="text-sm text-gray-600">Helpful</div>
                 <div className="text-xl font-semibold text-green-600">
                   {perf.totalHelpful}
                 </div>
               </div>
               <div>
                 <div className="text-sm text-gray-600">Copied</div>
                 <div className="text-xl font-semibold text-blue-600">
                   {perf.totalCopies}
                 </div>
               </div>
             </div>
           </Card>
         ))}
       </div>
     );
   }
   ```

   **Add to Vercel Cron:**
   ```json
   // vercel.json
   {
     "crons": [
       {
         "path": "/api/jobs/attribute-sentiment",
         "schedule": "*/15 * * * *"  // Every 15 minutes
       },
       {
         "path": "/api/jobs/aggregate-source-performance",
         "schedule": "0 3 * * *"      // Daily at 3 AM UTC
       }
     ]
   }
   ```

4. **Update dashboard page:**

   Update `app/dashboard/[chatbotId]/page.tsx` to include:
   - FormatPreferencesWidget
   - Enhanced ChunkPerformanceView
   - SourcePerformanceView

**Deliverables:**
- ✅ Format preferences widget showing aggregate stats
- ✅ Underperforming chunks with actual text displayed
- ✅ Top performing chunks with copy metrics
- ✅ Sentiment-based metrics displayed
- ✅ Source_Performance table created
- ✅ Nightly aggregation job
- ✅ Dashboard shows source-level metrics
- ✅ Can compare performance across books/works

**Testing:**
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing checklist complete

---

#### Phase 4.3: Content Gap Aggregation ⚠️ ALPHA (Simplified)

**Objective:** Implement basic content gap aggregation from feedback

**Why needed for Alpha:** Identifies missing content in public domain works

**Prerequisites:**
- ✅ Content_Gap table exists in schema
- ✅ "Need more" feedback being collected

**Tasks:**

1. **Create simplified content gap aggregation job:**

   **`app/api/jobs/aggregate-content-gaps/route.ts`:**
   ```typescript
   import { prisma } from '@/lib/prisma';
   
   export async function POST(request: Request) {
     const thirtyDaysAgo = new Date();
     thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
     
     // Get all "need more" feedback from last 30 days
     const feedback = await prisma.message_Feedback.findMany({
       where: {
         feedbackType: { in: ['need_more', 'not_helpful'] },
         createdAt: { gte: thirtyDaysAgo },
       },
       include: {
         message: {
           include: { conversation: true },
         },
       },
     });
     
     if (feedback.length === 0) {
       return Response.json({ message: 'No feedback to process' });
     }
     
     // Group by chatbot and simple keyword matching
     const byChatbot = feedback.reduce((acc, f) => {
       const chatbotId = f.message.conversation.chatbotId;
       if (!acc[chatbotId]) acc[chatbotId] = [];
       acc[chatbotId].push(f);
       return acc;
     }, {} as Record<string, typeof feedback>);
     
     let totalGapsProcessed = 0;
     
     // Process each chatbot - simple clustering by message content similarity
     for (const [chatbotId, chatbotFeedback] of Object.entries(byChatbot)) {
       // Simple grouping by first few words of message
       const grouped = chatbotFeedback.reduce((acc, f) => {
         const key = f.message.content.substring(0, 50).toLowerCase();
         if (!acc[key]) acc[key] = [];
         acc[key].push(f);
         return acc;
       }, {} as Record<string, typeof chatbotFeedback>);
       
       for (const [key, group] of Object.entries(grouped)) {
         if (group.length < 2) continue; // Skip single requests
         
         const representativeQuestion = group[0].message.content;
         
         // Count format preferences
         const formatCounts = {
           scripts: 0,
           examples: 0,
           steps: 0,
           case_studies: 0,
         };
         
         group.forEach((f: any) => {
           if (f.needsMore?.includes('scripts')) formatCounts.scripts++;
           if (f.needsMore?.includes('examples')) formatCounts.examples++;
           if (f.needsMore?.includes('steps')) formatCounts.steps++;
           if (f.needsMore?.includes('case_studies')) formatCounts.case_studies++;
         });
         
         const formatRequested = Object.entries(formatCounts)
           .filter(([_, count]) => count > 0)
           .map(([format, _]) => format);
         
         // Collect user contexts
         const userContexts = group
           .filter((f: any) => f.specificSituation)
           .map((f: any) => ({
             userId: f.userId,
             situation: f.specificSituation,
           }));
         
         // Upsert Content_Gap
         await prisma.content_Gap.upsert({
           where: {
             chatbotId_topicRequested: {
               chatbotId,
               topicRequested: representativeQuestion.substring(0, 200),
             },
           },
           create: {
             chatbotId,
             topicRequested: representativeQuestion.substring(0, 200),
             specificQuestion: representativeQuestion,
             requestCount: group.length,
             lastRequestedAt: new Date(),
             formatRequested,
             userContexts,
             status: 'open',
           },
           update: {
             requestCount: { increment: group.length },
             lastRequestedAt: new Date(),
             formatRequested,
             userContexts: { push: userContexts },
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

2. **Add to Vercel cron:**

   Update `vercel.json`:
   ```json
   {
     "crons": [
       {
         "path": "/api/jobs/attribute-sentiment",
         "schedule": "*/15 * * * *"  // Every 15 minutes
       },
       {
         "path": "/api/jobs/aggregate-content-gaps",
         "schedule": "0 2 * * *"      // Daily at 2 AM UTC
       }
     ]
   }
   ```

3. **Create content gaps dashboard view:**

   **`components/dashboard/content-gaps.tsx`:**
   ```typescript
   import { prisma } from '@/lib/prisma';
   import { Card } from '../ui/card';
   import { Badge } from '../ui/badge';
   
   export async function ContentGapsView({ chatbotId }: { chatbotId: string }) {
     const gaps = await prisma.content_Gap.findMany({
       where: {
         chatbotId,
         status: 'open',
       },
       orderBy: {
         requestCount: 'desc',
       },
       take: 20,
     });
     
     if (gaps.length === 0) {
       return (
         <div className="text-center py-12">
           <p className="text-gray-600">No content gaps identified yet.</p>
           <p className="text-sm text-gray-500 mt-2">
             As users provide feedback, we'll identify what content is missing.
           </p>
         </div>
       );
     }
     
     return (
       <div className="space-y-4">
         {gaps.map((gap) => {
           const contexts = gap.userContexts as any[];
           
           return (
             <Card key={gap.id} className="p-6">
               <div className="flex justify-between items-start mb-4">
                 <div className="flex-1">
                   <h3 className="font-semibold text-lg mb-2">
                     {gap.topicRequested}
                   </h3>
                   <div className="flex gap-2 mb-4">
                     <Badge variant="outline">{gap.requestCount} requests</Badge>
                     <Badge>Open</Badge>
                   </div>
                 </div>
               </div>
               
               <div className="mb-4">
                 <h4 className="font-medium text-sm mb-2">Formats wanted:</h4>
                 <div className="flex gap-2">
                   {gap.formatRequested.map((format: string) => (
                     <Badge key={format} variant="secondary">
                       {format}
                     </Badge>
                   ))}
                 </div>
               </div>
               
               {contexts.length > 0 && (
                 <div>
                   <h4 className="font-medium text-sm mb-2">User situations:</h4>
                   <div className="space-y-2">
                     {contexts.slice(0, 3).map((ctx: any, idx: number) => (
                       <div key={idx} className="bg-gray-50 p-3 rounded text-sm">
                         "{ctx.situation}"
                       </div>
                     ))}
                     {contexts.length > 3 && (
                       <p className="text-sm text-gray-600">
                         +{contexts.length - 3} more situations
                       </p>
                     )}
                   </div>
                 </div>
               )}
             </Card>
           );
         })}
       </div>
     );
   }
   ```

4. **Add content gaps to dashboard:**

   Update `app/dashboard/[chatbotId]/page.tsx`:
   ```typescript
   import { ContentGapsView } from '@/components/dashboard/content-gaps';
   
   // Add to page
   <div>
     <h2 className="text-2xl font-bold mb-4">Content Roadmap</h2>
     <ContentGapsView chatbotId={params.chatbotId} />
   </div>
   ```

**Deliverables:**
- ✅ Basic content gap aggregation job (nightly at 2 AM)
- ✅ Simple keyword-based clustering (no embeddings needed for Alpha)
- ✅ Format preferences aggregated
- ✅ User contexts collected
- ✅ Content gaps dashboard view

**Note:** For Alpha, using simple keyword matching instead of embeddings. Full embedding-based clustering deferred to Beta.

**Testing:**
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing checklist complete

---

## Phase 7: Deployment & Polish (Week 10)

### **CRITICAL FOR ALPHA**

#### Phase 7.1: Production Deployment Enhancements ✅ ALPHA

**Objective:** Enhance production deployment beyond MVP

**Tasks:**

1. **Set up custom domain:**
   - Add domain in Vercel settings
   - Configure DNS
   - Set up SSL certificates

2. **Enable Sentry (if not already done):**
   ```bash
   npx @sentry/wizard@latest -i nextjs
   ```
   - Add DSN to environment variables
   - Test error reporting

3. **Set up production monitoring:**
   - Configure Vercel Analytics
   - Set up uptime monitoring
   - Configure alerting

4. **Optional: Vercel AI Gateway or Helicone integration:**
   - Request logging
   - Caching for LLM calls
   - Rate limiting enforcement

**Deliverables:**
- ✅ Production app at custom domain
- ✅ Sentry monitoring active
- ✅ Uptime monitoring configured
- ✅ Optional: AI Gateway/Helicone integration

**Testing:**
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing checklist complete

---

#### Phase 7.2: Performance Optimization ✅ ALPHA

**Objective:** Optimize for production performance

**Note:** Critical feedback API performance fix is in Phase 0.1 (do that first). This section covers additional optimizations.

**Tasks:**

1. **Add React Query for client-side caching:**
   ```bash
   npm install @tanstack/react-query
   ```

2. **Optimize images with Next.js Image component**

3. **Add loading states and skeletons**

4. **Implement database query optimization:**
   - Review slow queries
   - Add missing indexes
   - Optimize N+1 queries

5. **Add caching layer:**
   - Implement Redis/Upstash for rate limiting
   - Cache frequently accessed data

**Deliverables:**
- ✅ Fast page loads (<2s)
- ✅ Smooth interactions
- ✅ Optimized database queries
- ✅ Caching layer implemented

**Note:** Feedback API performance fix is in Phase 0.1 (already completed if following recommended order).

**Testing:**
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing checklist complete

---

#### Phase 7.3: Comprehensive Documentation ⚠️ ALPHA (Basic)

**Objective:** Document the system for users

**For Alpha: User-facing only**

**Create documentation:**

1. **User guide** - How to use chat
2. **FAQ** - Common questions
3. **Privacy policy** - Data handling
4. **Terms of service** - Usage terms

**Defer to Beta:**
- Creator onboarding docs
- API documentation for integrations
- Architecture documentation
- Developer guides

**Deliverables:**
- ✅ User guide
- ✅ FAQ
- ✅ Privacy policy
- ✅ Terms of service

**Testing:**
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing checklist complete

---

## Environment Variables Required for Alpha

**Verify all of these are set in Vercel:**

- [ ] `DATABASE_URL` (Neon Postgres)
- [ ] `DIRECT_URL` (Neon Postgres direct)
- [ ] `NEXT_PUBLIC_URL` (https://yourdomain.com)
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- [ ] `CLERK_SECRET_KEY`
- [ ] `OPENAI_API_KEY`
- [ ] `PINECONE_API_KEY`
- [ ] `PINECONE_INDEX`
- [ ] `BLOB_READ_WRITE_TOKEN`
- [ ] `SENTRY_DSN` (if using Sentry)

**Optional (for Phase 7.1):**
- [ ] `HELICONE_API_KEY` or Vercel AI Gateway config

---

## Alpha Release Checklist

**Before launching Alpha:**

- [ ] Phase 0.1 complete (feedback API fast)
- [ ] All advanced feedback features working
- [ ] Multiple public domain chatbots created
- [ ] Sentiment analysis running
- [ ] Dashboard shows source performance
- [ ] Content gaps identified
- [ ] UI polished and mobile-responsive
- [ ] Performance optimized
- [ ] User documentation complete
- [ ] Landing page ready for marketing

**Alpha Success Criteria:**
- 100+ users chatting with public domain content
- Average satisfaction > 4/5
- < 2% error rate
- < 3s response time
- Users provide actionable feedback

---

## Rollback Plan

If critical issues arise in production:

1. **Immediate:** Revert to MVP deployment
2. **Within 24h:** Fix issue in staging
3. **Within 48h:** Redeploy with fix

---

## Summary: Alpha Build Checklist

### Critical Fixes (Do First)
- [x] Phase 0.1: Fix Feedback API Performance ✅ **COMPLETE**

### Advanced Feedback Features
- [x] Phase 3.3: "Need More" Modal ✅ **COMPLETE** (Dec 18, 2025)
- [x] Phase 3.4: Copy Button with Feedback ✅ **COMPLETE** (Dec 18, 2025)
- [x] Phase 3.5: End-of-Conversation Survey ⚠️ **PARTIALLY IMPLEMENTED** (Different approach - integrated into star rating system during feedback UX update, Dec 19, 2025)
- [x] Phase 3.7: UI/UX Improvements (subset) ⚠️ **PARTIALLY COMPLETE**
  - [x] Phase 3.7.1: Database Schema Migration ✅ **COMPLETE**
  - [x] Phase 3.7.2: Public Chatbots API Endpoint ✅ **COMPLETE**
  - [x] Phase 3.7.3: Chatbot Detail Modal Component ✅ **COMPLETE**
  - [x] Phase 3.7.4: Homepage Component with Grid Layout ✅ **COMPLETE**
  - [x] Phase 3.7.5: Creator Pages ✅ **COMPLETE** (Jan 2025)
  - [ ] Phase 3.7.6: Favorites System ← **NEXT TO RESUME**
- [ ] Phase 3.8: Multiple Chatbots Support
- [ ] Phase 3.9: Chatbot Versioning System
- [ ] Phase 3.10: User Intake Forms

### Analytics & Intelligence
- [ ] Phase 4.1: Sentiment Analysis Job
- [ ] Phase 4.2: Enhanced Creator Dashboard (with Source Performance)
- [ ] Phase 4.3: Content Gap Aggregation (basic)

### Deployment & Polish
- [ ] Phase 7.1: Production Deployment Enhancements
- [ ] Phase 7.2: Performance Optimization
- [ ] Phase 7.3: Documentation (user-facing)

**Total Alpha Tasks:** 12 tasks (added Phase 3.9 and 3.10)

**Timeline:** 6 weeks (Weeks 5-10)

**Alpha is lean and focused on user validation with public domain content.**

