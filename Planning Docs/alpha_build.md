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
│   ├── jobs/
│   │   ├── attribute-sentiment/route.ts    # NEW in Phase 4.1
│   │   ├── aggregate-source-performance/   # NEW in Phase 4.2
│   │   │   route.ts
│   │   └── aggregate-content-gaps/         # NEW in Phase 4.3
│   │       route.ts
│   └── analysis/
│       └── sentiment/route.ts          # NEW in Phase 4.1
│
components/
├── feedback-modal.tsx                  # NEW in Phase 3.3
├── copy-feedback-modal.tsx             # NEW in Phase 3.4
├── conversation-feedback-modal.tsx     # NEW in Phase 3.5
└── dashboard/
    ├── format-preferences.tsx          # NEW in Phase 4.2
    ├── chunk-performance.tsx           # ENHANCED in Phase 4.2
    ├── source-performance.tsx          # NEW in Phase 4.2
    └── content-gaps.tsx                # NEW in Phase 4.3

lib/
└── analysis/
    └── sentiment.ts                    # NEW in Phase 4.1

prisma/
└── schema.prisma                       # UPDATED: Message_Feedback (copyUsage, copyContext), Chunk_Performance (copyToUseNowCount), Source_Performance
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

**Status:** ✅ **COMPLETE** - All deliverables implemented and tested

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

**Status:** ✅ **COMPLETE** - All deliverables implemented and tested

---

#### Phase 3.5: End-of-Conversation Survey ✅ ALPHA

**Objective:** Show survey when user clicks copy button (not after inactivity)

**Why needed for Alpha:** Critical for understanding user satisfaction and improving content

**Prerequisites:**
- ✅ Conversation_Feedback table exists in schema
- ✅ Copy button implemented (Phase 3.4)

**Tasks:**

1. **Create conversation feedback modal:**

   **`components/conversation-feedback-modal.tsx`:**
   ```typescript
   'use client';
   
   import { useState } from 'react';
   import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
   import { Button } from './ui/button';
   import { Textarea } from './ui/textarea';
   import { RadioGroup, RadioGroupItem } from './ui/radio-group';
   
   export function ConversationFeedbackModal({
     open,
     onClose,
     conversationId,
   }: {
     open: boolean;
     onClose: () => void;
     conversationId: string;
   }) {
     const [goal, setGoal] = useState('');
     const [achieved, setAchieved] = useState('');
     const [stillNeed, setStillNeed] = useState('');
     
     async function handleSubmit() {
       await fetch('/api/feedback/conversation', {
         method: 'POST',
         body: JSON.stringify({
           conversationId,
           userGoal: goal,
           goalAchieved: achieved,
           stillNeed: stillNeed,
         }),
       });
       
       onClose();
     }
     
     return (
       <Dialog open={open} onOpenChange={onClose}>
         <DialogContent className="max-w-md">
           <DialogHeader>
             <DialogTitle>Quick feedback (30 seconds)</DialogTitle>
           </DialogHeader>
           
           <div className="space-y-4">
             <div>
               <label className="text-sm font-medium block mb-2">
                 1. What were you trying to accomplish?
               </label>
               <Textarea
                 value={goal}
                 onChange={(e) => setGoal(e.target.value)}
                 placeholder="I wanted to learn..."
                 rows={2}
               />
             </div>
             
             <div>
               <label className="text-sm font-medium block mb-2">
                 2. Did you get what you needed?
               </label>
               <RadioGroup value={achieved} onValueChange={setAchieved}>
                 <div className="flex items-center space-x-2">
                   <RadioGroupItem value="yes" id="yes" />
                   <label htmlFor="yes">Yes, completely</label>
                 </div>
                 <div className="flex items-center space-x-2">
                   <RadioGroupItem value="partially" id="partially" />
                   <label htmlFor="partially">Partially</label>
                 </div>
                 <div className="flex items-center space-x-2">
                   <RadioGroupItem value="no" id="no" />
                   <label htmlFor="no">No, still need help</label>
                 </div>
               </RadioGroup>
             </div>
             
             {(achieved === 'partially' || achieved === 'no') && (
               <div>
                 <label className="text-sm font-medium block mb-2">
                   3. What's still missing?
                 </label>
                 <Textarea
                   value={stillNeed}
                   onChange={(e) => setStillNeed(e.target.value)}
                   placeholder="I still need..."
                   rows={2}
                 />
               </div>
             )}
             
             <div className="bg-blue-50 p-3 rounded">
               <p className="text-sm text-blue-900">
                 Get 10 bonus questions as thanks for your feedback! 🎁
               </p>
             </div>
             
             <div className="flex gap-2">
               <Button variant="outline" onClick={onClose} className="flex-1">
                 Skip
               </Button>
               <Button onClick={handleSubmit} disabled={!goal || !achieved} className="flex-1">
                 Submit
               </Button>
             </div>
           </div>
         </DialogContent>
       </Dialog>
     );
   }
   ```

2. **Integrate survey trigger into copy button:**

   Update `components/chat.tsx` copy handler (from Phase 3.4):
   ```typescript
   import { ConversationFeedbackModal } from './conversation-feedback-modal';
   
   const [showConversationFeedback, setShowConversationFeedback] = useState(false);
   
   async function handleCopy(messageId: string, content: string) {
     await navigator.clipboard.writeText(content);
     
     // Track copy event
     await fetch('/api/feedback/message', {
       method: 'POST',
       body: JSON.stringify({
         messageId,
         feedbackType: 'copy',
       }),
     });
     
     // Show conversation feedback modal after copy
     // Only show if conversation has 3+ messages (meaningful conversation)
     if (messages.length >= 3) {
       setShowConversationFeedback(true);
     }
   }
   
   // Add modal to component
   <ConversationFeedbackModal
     open={showConversationFeedback}
     onClose={() => setShowConversationFeedback(false)}
     conversationId={conversationId!}
   />
   ```

3. **Create conversation feedback API:**

   **`app/api/feedback/conversation/route.ts`:**
   ```typescript
   import { auth } from '@clerk/nextjs';
   import { prisma } from '@/lib/prisma';
   
   export async function POST(request: Request) {
     const { userId } = auth();
     const { conversationId, rating, userGoal, goalAchieved, stillNeed } = await request.json();
     
     await prisma.conversation_Feedback.create({
       data: {
         conversationId,
         userId: userId || undefined,
         rating,
         userGoal,
         goalAchieved,
         stillNeed,
       },
     });
     
     return Response.json({ success: true });
   }
   ```

**Deliverables:**
- ✅ End-of-conversation survey modal
- ✅ Triggered on copy button click (not inactivity)
- ✅ Only shows for meaningful conversations (3+ messages)
- ✅ Bonus questions incentive
- ✅ Conversation_Feedback stored

**Testing:**
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing checklist complete

---

#### Phase 3.7: UI/UX Improvements ✅ ALPHA (Subset)

**Objective:** Polish homepage, chat interface, and dashboard screens

**Why needed for Alpha:** Professional appearance for public marketing

**Prerequisites:**
- ✅ MVP functionality working
- ✅ Basic UI components in place

**Tasks:**

1. **Homepage improvements:**
   - Modern hero section with value proposition
   - Featured chatbots showcase
   - Clear CTAs (Sign up, Try demo)
   - Responsive design for mobile

2. **Chat interface polish:**
   - Better message styling (rounded corners, shadows)
   - Improved typography and spacing
   - Loading animations for streaming
   - Better error states
   - Message timestamps
   - Copy/regenerate buttons

3. **Dashboard enhancements (basic):**
   - Modern card layouts
   - Improved color scheme and spacing
   - Loading skeletons
   - Empty states with helpful messages
   - Responsive tables/lists

**Defer to Beta:**
- Advanced dashboard visualizations (Recharts)
- Creator-specific UI elements

**Deliverables:**
- ✅ Polished homepage
- ✅ Enhanced chat interface
- ✅ Basic dashboard UI improvements
- ✅ Responsive design
- ✅ Better UX throughout

**Testing:**
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing checklist complete

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

   **Then run:**
   ```bash
   npx prisma migrate dev --name add_source_performance
   npx prisma generate
   ```

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
- [x] Phase 3.3: "Need More" Modal ✅ **COMPLETE**
- [x] Phase 3.4: Copy Button with Feedback ✅ **COMPLETE**
- [ ] Phase 3.5: End-of-Conversation Survey (triggered on copy, not inactivity)
- [ ] Phase 3.7: UI/UX Improvements (subset)
- [ ] Phase 3.8: Multiple Chatbots Support

### Analytics & Intelligence
- [ ] Phase 4.1: Sentiment Analysis Job
- [ ] Phase 4.2: Enhanced Creator Dashboard (with Source Performance)
- [ ] Phase 4.3: Content Gap Aggregation (basic)

### Deployment & Polish
- [ ] Phase 7.1: Production Deployment Enhancements
- [ ] Phase 7.2: Performance Optimization
- [ ] Phase 7.3: Documentation (user-facing)

**Total Alpha Tasks:** 10 tasks

**Timeline:** 6 weeks (Weeks 5-10)

**Alpha is lean and focused on user validation with public domain content.**

