# Beyond MVP: Complete Implementation Plan
## Everything Not Included in MVP - Step-by-Step Guide

---

## Overview

This document contains **all features and phases** from the full implementation plan (`plan.md`) that were **excluded from MVP** (`12-12_mvp-roadmap.md`).

**MVP Status:** ✅ Completed through Phase 6, Task 7 (Documentation)

**What's Next:** All features below, organized by priority and dependencies.

---

## ⚠️ Phase 0: Critical Performance Fixes (DO FIRST)

### 0.1 Fix Feedback API Performance

**Status:** 🔴 **CRITICAL - Do this immediately before any other features**

**Problem:** Feedback API (`/api/feedback/message`) takes 2-5 seconds to respond because it does sequential database queries in a loop (lines 112-204 in `app/api/feedback/message/route.ts`).

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

---

**⚠️ IMPORTANT:** Complete Phase 0.1 before moving to any other features below.

---

## Phase 3: Advanced Feedback Features (Post-MVP)

### 3.3 "Need More" Modal

**Objective:** Add detailed feedback modal when user needs more information

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

---

### 3.4 Copy Button with Optional Feedback

**Objective:** Add copy button that triggers optional feedback modal

**Prerequisites:**
- ✅ Message_Feedback table supports `copyUsage` and `copyContext` fields
- ✅ Chunk_Performance table supports `copyToUseNowCount` counter

**Tasks:**

1. **Add copy button to messages:**

   Update `components/chat.tsx`:
   ```typescript
   import { Copy } from 'lucide-react';
   import { CopyFeedbackModal } from './copy-feedback-modal';
   import { useToast } from './ui/use-toast';
   
   const [copyModalOpen, setCopyModalOpen] = useState(false);
   const [copiedMessageId, setCopiedMessageId] = useState('');
   const { toast } = useToast();
   
   async function handleCopy(messageId: string, content: string) {
     await navigator.clipboard.writeText(content);
     
     // Show toast
     toast({
       title: '✓ Copied',
       description: 'Quick question?',
       action: (
         <Button
           size="sm"
           onClick={() => {
             setCopiedMessageId(messageId);
             setCopyModalOpen(true);
           }}
         >
           Yes
         </Button>
       ),
     });
     
     // Track copy event
     await fetch('/api/feedback/message', {
       method: 'POST',
       body: JSON.stringify({
         messageId,
         feedbackType: 'copy',
       }),
     });
   }
   
   // Add copy button next to feedback buttons
   <Button
     size="sm"
     variant="ghost"
     onClick={() => handleCopy(message.id, message.content)}
   >
     <Copy className="w-4 h-4" />
   </Button>
   ```

2. **Create copy feedback modal:**

   **`components/copy-feedback-modal.tsx`:**
   ```typescript
   'use client';
   
   import { useState } from 'react';
   import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
   import { Button } from './ui/button';
   import { Textarea } from './ui/textarea';
   import { RadioGroup, RadioGroupItem } from './ui/radio-group';
   
   export function CopyFeedbackModal({
     open,
     onClose,
     messageId,
   }: {
     open: boolean;
     onClose: () => void;
     messageId: string;
   }) {
     const [usage, setUsage] = useState('');
     const [context, setContext] = useState('');
     
     async function handleSubmit() {
       await fetch('/api/feedback/message', {
         method: 'POST',
         body: JSON.stringify({
           messageId,
           feedbackType: 'copy',
           copyUsage: usage,
           copyContext: context,
         }),
       });
       
       onClose();
     }
     
     return (
       <Dialog open={open} onOpenChange={onClose}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>What will you use this for?</DialogTitle>
           </DialogHeader>
           
           <div className="space-y-4">
             <RadioGroup value={usage} onValueChange={setUsage}>
               <div className="flex items-center space-x-2">
                 <RadioGroupItem value="reference" id="reference" />
                 <label htmlFor="reference">Reference / save for later</label>
               </div>
               <div className="flex items-center space-x-2">
                 <RadioGroupItem value="use_now" id="use_now" />
                 <label htmlFor="use_now">Use in my work right now</label>
               </div>
               <div className="flex items-center space-x-2">
                 <RadioGroupItem value="share_team" id="share_team" />
                 <label htmlFor="share_team">Share with my team</label>
               </div>
               <div className="flex items-center space-x-2">
                 <RadioGroupItem value="adapt" id="adapt" />
                 <label htmlFor="adapt">Adapt for my specific situation</label>
               </div>
             </RadioGroup>
             
             {usage === 'adapt' && (
               <div>
                 <label className="text-sm font-medium">
                   What's your specific situation?
                 </label>
                 <Textarea
                   value={context}
                   onChange={(e) => setContext(e.target.value)}
                   placeholder="I'm trying to..."
                   rows={3}
                 />
               </div>
             )}
             
             <div className="flex gap-2">
               <Button variant="outline" onClick={onClose} className="flex-1">
                 Skip
               </Button>
               <Button onClick={handleSubmit} disabled={!usage} className="flex-1">
                 Submit
               </Button>
             </div>
           </div>
         </DialogContent>
       </Dialog>
     );
   }
   ```

3. **Update feedback API to handle copy usage:**

   Update `app/api/feedback/message/route.ts` to:
   - Accept `copyUsage` and `copyContext`
   - Update `Chunk_Performance.copyToUseNowCount` when `copyUsage === 'use_now'`

**Deliverables:**
- ✅ Copy button on AI messages
- ✅ Toast with optional feedback
- ✅ Copy usage tracking (use_now, adapt, etc.)
- ✅ Chunk_Performance.copyToUseNowCount updated

---

### 3.5 End-of-Conversation Survey

**Objective:** Show survey when user clicks copy button (not after inactivity)

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

---

### 3.6 Embeddable Chatbot Widget

**Objective:** Create iframe-based embeddable widget for external sites

**Prerequisites:**
- ✅ Chat interface component works standalone
- ✅ CORS configured to allow embedding

**Tasks:**

1. **Create embed route:**

   **`app/embed/[chatbotId]/page.tsx`:**
   ```typescript
   import { ChatInterface } from '@/components/chat-interface';
   import { prisma } from '@/lib/prisma';
   
   export default async function EmbedPage({
     params,
   }: {
     params: { chatbotId: string };
   }) {
     const chatbot = await prisma.chatbot.findUnique({
       where: { id: params.chatbotId },
     });
     
     if (!chatbot) {
       return <div>Chatbot not found</div>;
     }
     
     return (
       <html>
         <head>
           <title>{chatbot.title}</title>
           <meta name="viewport" content="width=device-width, initial-scale=1" />
         </head>
         <body style={{ margin: 0, padding: 0, height: '100vh' }}>
           <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
             <ChatInterface chatbotId={params.chatbotId} embedded />
           </div>
         </body>
       </html>
     );
   }
   ```

2. **Create embed loader script:**

   **`public/embed.js`:**
   ```javascript
   (function() {
     window.PocketGenius = {
       init: function(options) {
         const { chatbotId, container } = options;
         
         const iframe = document.createElement('iframe');
         iframe.src = `https://pocketgenius.ai/embed/${chatbotId}`;
         iframe.style.width = '100%';
         iframe.style.height = '600px';
         iframe.style.border = 'none';
         iframe.style.borderRadius = '8px';
         
         const containerEl = typeof container === 'string' 
           ? document.querySelector(container)
           : container;
         
         if (containerEl) {
           containerEl.appendChild(iframe);
         }
       }
     };
   })();
   ```

3. **Update ChatInterface to support embedded mode:**

   Update `components/chat.tsx` to accept `embedded` prop and adjust styling accordingly.

**Deliverables:**
- ✅ Iframe embed route at `/embed/[chatbotId]`
- ✅ Loader script at `/embed.js`
- ✅ Documentation for creators
- ✅ Same chat functionality as main app

---

## Phase 4: Analytics & Intelligence

### 4.1 Sentiment Analysis Job

**Objective:** Implement async sentiment analysis of user messages

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
         "schedule": "*/15 * * * *"
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

---

### 4.2 Creator Dashboard - Enhanced Chunk Performance View

**Objective:** Build dashboard showing underperforming and top-performing chunks

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

3. **Update dashboard page:**

   Update `app/dashboard/[chatbotId]/page.tsx` to include:
   - FormatPreferencesWidget
   - Enhanced ChunkPerformanceView

**Deliverables:**
- ✅ Format preferences widget showing aggregate stats
- ✅ Underperforming chunks with actual text displayed
- ✅ Top performing chunks with copy metrics
- ✅ Sentiment-based metrics displayed

---

### 4.3 Content Gap Aggregation

**Objective:** Implement nightly job to cluster feedback into content gaps

**Prerequisites:**
- ✅ Content_Gap table exists in schema
- ✅ "Need more" feedback being collected
- ✅ Embedding generation utility available

**Tasks:**

1. **Create content gap aggregation job:**

   **`app/api/jobs/aggregate-content-gaps/route.ts`:**
   ```typescript
   import { prisma } from '@/lib/prisma';
   import { generateEmbeddings } from '@/lib/embeddings/openai';
   
   function cosineSimilarity(a: number[], b: number[]): number {
     const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
     const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
     const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
     return dotProduct / (magnitudeA * magnitudeB);
   }
   
   function clusterByEmbedding(
     embeddings: number[][],
     questions: string[],
     feedback: any[],
     threshold: number = 0.85
   ) {
     const clusters: any[] = [];
     const used = new Set<number>();
     
     for (let i = 0; i < embeddings.length; i++) {
       if (used.has(i)) continue;
       
       const cluster = {
         questions: [questions[i]],
         feedback: [feedback[i]],
       };
       used.add(i);
       
       for (let j = i + 1; j < embeddings.length; j++) {
         if (used.has(j)) continue;
         
         const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
         if (similarity >= threshold) {
           cluster.questions.push(questions[j]);
           cluster.feedback.push(feedback[j]);
           used.add(j);
         }
       }
       
       clusters.push(cluster);
     }
     
     return clusters;
   }
   
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
     
     // Group by chatbot
     const byChatbot = feedback.reduce((acc, f) => {
       const chatbotId = f.message.conversation.chatbotId;
       if (!acc[chatbotId]) acc[chatbotId] = [];
       acc[chatbotId].push(f);
       return acc;
     }, {} as Record<string, typeof feedback>);
     
     let totalGapsProcessed = 0;
     
     // Process each chatbot
     for (const [chatbotId, chatbotFeedback] of Object.entries(byChatbot)) {
       const questions = chatbotFeedback.map(f => f.message.content);
       const embeddings = await generateEmbeddings(questions);
       
       const clusters = clusterByEmbedding(embeddings, questions, chatbotFeedback);
       
       for (const cluster of clusters) {
         // Use most common question as representative
         const representativeQuestion = cluster.questions[0];
         
         // Count format preferences
         const formatCounts = {
           scripts: 0,
           examples: 0,
           steps: 0,
           case_studies: 0,
         };
         
         cluster.feedback.forEach((f: any) => {
           if (f.needsMore?.includes('scripts')) formatCounts.scripts++;
           if (f.needsMore?.includes('examples')) formatCounts.examples++;
           if (f.needsMore?.includes('steps')) formatCounts.steps++;
           if (f.needsMore?.includes('case_studies')) formatCounts.case_studies++;
         });
         
         const formatRequested = Object.entries(formatCounts)
           .filter(([_, count]) => count > 0)
           .map(([format, _]) => format);
         
         // Collect user contexts
         const userContexts = cluster.feedback
           .filter((f: any) => f.specificSituation)
           .map((f: any) => ({
             userId: f.userId,
             situation: f.specificSituation,
           }));
         
         // Get related chunks
         const relatedChunkIds = [...new Set(
           cluster.feedback.flatMap((f: any) => f.chunkIds || [])
         )];
         
         // Upsert Content_Gap
         await prisma.content_Gap.upsert({
           where: {
             chatbotId_topicRequested: {
               chatbotId,
               topicRequested: representativeQuestion,
             },
           },
           create: {
             chatbotId,
             topicRequested: representativeQuestion,
             specificQuestion: cluster.questions[0],
             requestCount: cluster.feedback.length,
             lastRequestedAt: new Date(),
             formatRequested,
             userContexts,
             relatedChunkIds,
             status: 'open',
           },
           update: {
             requestCount: { increment: cluster.feedback.length },
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
         "schedule": "*/15 * * * *"
       },
       {
         "path": "/api/jobs/aggregate-content-gaps",
         "schedule": "0 2 * * *"
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
- ✅ Content gap aggregation job (nightly at 2 AM)
- ✅ Embedding-based clustering
- ✅ Format preferences aggregated
- ✅ User contexts collected
- ✅ Content gaps dashboard view

---

### 4.4 Question Clustering

**Objective:** Implement nightly job to cluster user questions and track trends

**Prerequisites:**
- ✅ Question_Cluster_Aggregate table exists in schema
- ✅ User questions being stored in Message table
- ✅ Embedding generation utility available

**Tasks:**

1. **Create question clustering job:**

   **`app/api/jobs/cluster-questions/route.ts`:**
   ```typescript
   import { prisma } from '@/lib/prisma';
   import { generateEmbeddings } from '@/lib/embeddings/openai';
   
   function cosineSimilarity(a: number[], b: number[]): number {
     const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
     const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
     const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
     return dotProduct / (magnitudeA * magnitudeB);
   }
   
   function clusterQuestions(
     embeddings: number[][],
     questions: string[],
     threshold: number = 0.85
   ) {
     const clusters: Array<{ questions: string[]; count: number }> = [];
     const used = new Set<number>();
     
     for (let i = 0; i < embeddings.length; i++) {
       if (used.has(i)) continue;
       
       const cluster = {
         questions: [questions[i]],
         count: 1,
       };
       used.add(i);
       
       for (let j = i + 1; j < embeddings.length; j++) {
         if (used.has(j)) continue;
         
         const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
         if (similarity >= threshold) {
           cluster.questions.push(questions[j]);
           cluster.count++;
           used.add(j);
         }
       }
       
       clusters.push(cluster);
     }
     
     return clusters;
   }
   
   export async function POST(request: Request) {
     const yesterday = new Date();
     yesterday.setDate(yesterday.getDate() - 1);
     yesterday.setHours(0, 0, 0, 0);
     
     const today = new Date();
     today.setHours(0, 0, 0, 0);
     
     // Get all user questions from yesterday
     const userMessages = await prisma.message.findMany({
       where: {
         role: 'user',
         createdAt: {
           gte: yesterday,
           lt: today,
         },
       },
       include: {
         conversation: true,
       },
     });
     
     if (userMessages.length === 0) {
       return Response.json({ message: 'No questions to process' });
     }
     
     // Group by chatbot
     const byChatbot = userMessages.reduce((acc, msg) => {
       const chatbotId = msg.conversation.chatbotId;
       if (!acc[chatbotId]) acc[chatbotId] = [];
       acc[chatbotId].push(msg);
       return acc;
     }, {} as Record<string, typeof userMessages>);
     
     let totalClustersProcessed = 0;
     
     // Process each chatbot
     for (const [chatbotId, chatbotMessages] of Object.entries(byChatbot)) {
       const questions = chatbotMessages.map(m => m.content);
       const embeddings = await generateEmbeddings(questions);
       
       const clusters = clusterQuestions(embeddings, questions);
       
       for (const cluster of clusters) {
         // Use most common question as representative
         const representativeQuestion = cluster.questions[0];
         
         // Upsert Question_Cluster_Aggregate
         await prisma.question_Cluster_Aggregate.upsert({
           where: {
             chatbotId_questionText_date: {
               chatbotId,
               questionText: representativeQuestion,
               date: yesterday,
             },
           },
           create: {
             chatbotId,
             questionText: representativeQuestion,
             date: yesterday,
             questionCount: cluster.count,
             relatedQuestions: cluster.questions,
           },
           update: {
             questionCount: cluster.count,
             relatedQuestions: cluster.questions,
           },
         });
         
         totalClustersProcessed++;
       }
     }
     
     return Response.json({
       success: true,
       clustersProcessed: totalClustersProcessed,
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
         "schedule": "*/15 * * * *"
       },
       {
         "path": "/api/jobs/aggregate-content-gaps",
         "schedule": "0 2 * * *"
       },
       {
         "path": "/api/jobs/cluster-questions",
         "schedule": "0 3 * * *"
       }
     ]
   }
   ```

3. **Create question trends dashboard view:**

   **`components/dashboard/question-trends.tsx`:**
   ```typescript
   import { prisma } from '@/lib/prisma';
   import { Card } from '../ui/card';
   import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
   
   export async function QuestionTrendsView({ chatbotId }: { chatbotId: string }) {
     const thirtyDaysAgo = new Date();
     thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
     
     const trends = await prisma.question_Cluster_Aggregate.findMany({
       where: {
         chatbotId,
         date: { gte: thirtyDaysAgo },
       },
       orderBy: {
         date: 'asc',
       },
     });
     
     // Group by question text and aggregate counts
     const questionData = trends.reduce((acc, trend) => {
       if (!acc[trend.questionText]) {
         acc[trend.questionText] = [];
       }
       acc[trend.questionText].push({
         date: trend.date,
         count: trend.questionCount,
       });
       return acc;
     }, {} as Record<string, Array<{ date: Date; count: number }>>);
     
     // Get top 5 questions by total count
     const topQuestions = Object.entries(questionData)
       .map(([question, data]) => ({
         question,
         totalCount: data.reduce((sum, d) => sum + d.count, 0),
         data,
       }))
       .sort((a, b) => b.totalCount - a.totalCount)
       .slice(0, 5);
     
     return (
       <div className="space-y-6">
         <h2 className="text-2xl font-bold">Question Trends (Last 30 Days)</h2>
         {topQuestions.map(({ question, totalCount, data }) => (
           <Card key={question} className="p-6">
             <h3 className="font-semibold mb-4">{question}</h3>
             <p className="text-sm text-gray-600 mb-4">Total: {totalCount} questions</p>
             <ResponsiveContainer width="100%" height={200}>
               <LineChart data={data}>
                 <CartesianGrid strokeDasharray="3 3" />
                 <XAxis dataKey="date" />
                 <YAxis />
                 <Tooltip />
                 <Line type="monotone" dataKey="count" stroke="#3b82f6" />
               </LineChart>
             </ResponsiveContainer>
           </Card>
         ))}
       </div>
     );
   }
   ```

4. **Add question trends to dashboard:**

   Update `app/dashboard/[chatbotId]/page.tsx`:
   ```typescript
   import { QuestionTrendsView } from '@/components/dashboard/question-trends';
   
   // Add to page
   <QuestionTrendsView chatbotId={params.chatbotId} />
   ```

**Deliverables:**
- ✅ Question clustering job (nightly at 3 AM)
- ✅ Embedding-based clustering
- ✅ Question trends visualization
- ✅ Dashboard shows popular questions over time

---

## Phase 5: Enhanced Testing & Seed Data

### 5.1 Enhanced Seed Data

**Objective:** Create comprehensive seed data for testing

**Tasks:**

1. **Enhance seed script with full data:**

   Update `prisma/seed.ts` to include:
   - Multiple creators
   - Multiple chatbots
   - Multiple sources
   - Sample conversations and messages
   - Sample feedback data

2. **Create test data fixtures:**

   **`tests/fixtures/seed-data.ts`:**
   ```typescript
   export async function seedTestData() {
     // Create test creator
     const creator = await prisma.creator.create({
       data: {
         name: 'Test Creator',
         users: {
           create: {
             userId: 'test-user-123',
           },
         },
       },
     });
     
     // Create test chatbot
     const chatbot = await prisma.chatbot.create({
       data: {
         title: 'Test Bot',
         creatorId: creator.id,
       },
     });
     
     // Create test source
     const source = await prisma.source.create({
       data: {
         title: 'Test Book',
         creatorId: creator.id,
         chatbotId: chatbot.id,
       },
     });
     
     return { creator, chatbot, source };
   }
   ```

**Deliverables:**
- ✅ Comprehensive seed data
- ✅ Test fixtures for automated testing

---

### 5.2 Comprehensive Testing Strategy

**Objective:** Implement full testing suite beyond MVP

**Tasks:**

1. **Set up testing infrastructure:**

   Install dependencies:
   ```bash
   npm install -D jest @types/jest ts-jest @testing-library/react @testing-library/jest-dom
   npm install -D supertest @types/supertest
   npm install -D msw  # For mocking external APIs
   npm install -D @playwright/test  # For E2E tests
   ```

2. **Create unit tests** (see plan.md lines 3671-3779)

3. **Create integration tests** (see plan.md lines 3783-3943)

4. **Create E2E tests** (see plan.md lines 3947-4033)

5. **Set up CI/CD** (see plan.md lines 4239-4306)

**Deliverables:**
- ✅ Unit test suite (70%+ coverage)
- ✅ Integration test suite (80%+ coverage)
- ✅ E2E test suite (all critical flows)
- ✅ CI/CD pipeline with automated tests

---

## Phase 6: React Native Mobile App

### 6.1 React Native Project Setup

**Objective:** Initialize React Native project with Expo

**Tasks:**

1. **Create React Native project:**
   ```bash
   npx create-expo-app pocket-genius-mobile --template
   cd pocket-genius-mobile
   ```

2. **Install dependencies:**
   ```bash
   # Auth
   npx expo install @clerk/clerk-expo
   npx expo install expo-secure-store
   npx expo install react-native-safe-area-context
   
   # Navigation
   npm install @react-navigation/native @react-navigation/stack
   npx expo install react-native-screens react-native-gesture-handler
   npx expo install expo-router
   
   # UI
   npm install react-native-paper
   npx expo install @expo/vector-icons
   
   # HTTP client
   npm install axios
   
   # Optional: Toast notifications
   npm install react-native-toast-message
   ```

3. **Configure Clerk:**

   **`app/_layout.tsx`:**
   ```typescript
   import { ClerkProvider } from '@clerk/clerk-expo';
   import * as SecureStore from 'expo-secure-store';
   
   const tokenCache = {
     async getToken(key: string) {
       try {
         return SecureStore.getItemAsync(key);
       } catch (err) {
         return null;
       }
     },
     async saveToken(key: string, value: string) {
       try {
         return SecureStore.setItemAsync(key, value);
       } catch (err) {
         return;
       }
     },
   };
   
   export default function RootLayout() {
     return (
       <ClerkProvider
         publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
         tokenCache={tokenCache}
       >
         <Stack />
       </ClerkProvider>
     );
   }
   ```

4. **Create `.env` file:**
   ```env
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
   EXPO_PUBLIC_API_URL=https://your-app.vercel.app
   ```

**Deliverables:**
- ✅ React Native project initialized
- ✅ Clerk auth configured
- ✅ Navigation setup
- ✅ Environment variables configured

---

### 6.2 Mobile Chat Interface

**Objective:** Build mobile chat UI that calls same API as web

**Tasks:**

1. **Create chat screen:**

   **`app/(app)/chat/[chatbotId].tsx`:**
   ```typescript
   import { useState, useEffect, useRef } from 'react';
   import { View, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
   import { Text } from 'react-native-paper';
   import { useLocalSearchParams } from 'expo-router';
   import { useAuth } from '@clerk/clerk-expo';
   
   interface Message {
     id: string;
     role: 'user' | 'assistant';
     content: string;
   }
   
   export default function ChatScreen() {
     const { chatbotId } = useLocalSearchParams();
     const { getToken } = useAuth();
     
     const [messages, setMessages] = useState<Message[]>([]);
     const [input, setInput] = useState('');
     const [loading, setLoading] = useState(false);
     const [conversationId, setConversationId] = useState<string | null>(null);
     
     const flatListRef = useRef<FlatList>(null);
     
     useEffect(() => {
       createConversation();
     }, []);
     
     async function createConversation() {
       const token = await getToken();
       const res = await fetch(
         `${process.env.EXPO_PUBLIC_API_URL}/api/conversations/create`,
         {
           method: 'POST',
           headers: {
             Authorization: `Bearer ${token}`,
             'Content-Type': 'application/json',
           },
           body: JSON.stringify({ chatbotId }),
         }
       );
       const data = await res.json();
       setConversationId(data.conversationId);
     }
     
     async function sendMessage() {
       if (!input.trim() || !conversationId) return;
       
       const userMessage: Message = {
         id: Date.now().toString(),
         role: 'user',
         content: input,
       };
       
       setMessages(prev => [...prev, userMessage]);
       setInput('');
       setLoading(true);
       
       // Add placeholder for assistant message
       const assistantMessageId = (Date.now() + 1).toString();
       setMessages(prev => [...prev, {
         id: assistantMessageId,
         role: 'assistant',
         content: '',
       }]);
       
       try {
         const token = await getToken();
         const response = await fetch(
           `${process.env.EXPO_PUBLIC_API_URL}/api/chat`,
           {
             method: 'POST',
             headers: {
               Authorization: `Bearer ${token}`,
               'Content-Type': 'application/json',
             },
             body: JSON.stringify({
               messages: [...messages, userMessage],
               conversationId,
               chatbotId,
             }),
           }
         );
         
         const reader = response.body?.getReader();
         const decoder = new TextDecoder();
         
         if (!reader) throw new Error('No reader available');
         
         let accumulatedContent = '';
         
         while (true) {
           const { done, value } = await reader.read();
           
           if (done) break;
           
           const chunk = decoder.decode(value);
           accumulatedContent += chunk;
           
           // Update the last message (assistant) with streamed content
           setMessages(prev => {
             const updated = [...prev];
             const lastMessage = updated[updated.length - 1];
             if (lastMessage.role === 'assistant') {
               lastMessage.content = accumulatedContent;
             }
             return updated;
           });
         }
         
       } catch (error) {
         console.error('Chat error:', error);
         // Remove placeholder message on error
         setMessages(prev => prev.filter(m => m.id !== assistantMessageId));
       } finally {
         setLoading(false);
       }
     }
     
     return (
       <KeyboardAvoidingView
         behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
         style={{ flex: 1 }}
       >
         <FlatList
           ref={flatListRef}
           data={messages}
           keyExtractor={item => item.id}
           onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
           renderItem={({ item }) => (
             <View
               style={{
                 padding: 12,
                 marginVertical: 4,
                 marginHorizontal: 8,
                 backgroundColor: item.role === 'user' ? '#3b82f6' : '#f3f4f6',
                 alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
                 borderRadius: 12,
                 maxWidth: '80%',
               }}
             >
               <Text style={{ color: item.role === 'user' ? 'white' : 'black' }}>
                 {item.content || '...'}
               </Text>
             </View>
           )}
         />
         
         <View style={{ flexDirection: 'row', padding: 8, borderTopWidth: 1, borderColor: '#e5e7eb' }}>
           <TextInput
             value={input}
             onChangeText={setInput}
             placeholder="Ask about The Art of War..."
             style={{
               flex: 1,
               padding: 12,
               backgroundColor: '#f3f4f6',
               borderRadius: 8,
               marginRight: 8,
             }}
           />
           <TouchableOpacity
             onPress={sendMessage}
             disabled={loading || !input.trim()}
             style={{
               backgroundColor: '#3b82f6',
               padding: 12,
               borderRadius: 8,
               justifyContent: 'center',
             }}
           >
             <Text style={{ color: 'white', fontWeight: 'bold' }}>Send</Text>
           </TouchableOpacity>
         </View>
       </KeyboardAvoidingView>
     );
   }
   ```

2. **Add mobile feedback buttons:**

   Update message rendering to include thumbs up/down:
   ```typescript
   import { Ionicons } from '@expo/vector-icons';
   
   // In renderItem
   {item.role === 'assistant' && (
     <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
       <TouchableOpacity onPress={() => handleFeedback(item.id, true)}>
         <Ionicons name="thumbs-up-outline" size={20} color="#666" />
       </TouchableOpacity>
       <TouchableOpacity onPress={() => handleFeedback(item.id, false)}>
         <Ionicons name="thumbs-down-outline" size={20} color="#666" />
       </TouchableOpacity>
     </View>
   )}
   
   async function handleFeedback(messageId: string, wasHelpful: boolean) {
     const token = await getToken();
     await axios.post(
       `${process.env.EXPO_PUBLIC_API_URL}/api/feedback/message`,
       { messageId, feedbackType: wasHelpful ? 'helpful' : 'not_helpful', wasHelpful },
       { headers: { Authorization: `Bearer ${token}` } }
     );
   }
   ```

**Deliverables:**
- ✅ Mobile chat screen
- ✅ Message sending/receiving
- ✅ Auto-scroll to latest message
- ✅ Feedback buttons integrated
- ✅ Calls same API as web app

---

### 6.3 Mobile Testing

**Objective:** Verify mobile app works identically to web

**Test Scenarios:**
- [ ] Install Expo Go app
- [ ] Run: `npx expo start`
- [ ] Scan QR code with phone
- [ ] Login with Clerk
- [ ] Navigate to chat
- [ ] Send messages and verify responses
- [ ] Test feedback buttons
- [ ] Verify data appears in dashboard

**Deliverables:**
- ✅ Mobile app functional on iOS/Android
- ✅ Same data as web app
- ✅ Feedback collection works

---

## Phase 3.7: UI/UX Improvements

**Objective:** Polish homepage, chat interface, and dashboard screens

**Prerequisites:**
- ✅ MVP functionality working
- ✅ Basic UI components in place

**Tasks:**

1. **Homepage improvements:**
   - Modern hero section with value proposition
   - Featured chatbots showcase
   - Creator testimonials
   - Clear CTAs (Sign up, Try demo)
   - Responsive design for mobile

2. **Chat interface polish:**
   - Better message styling (rounded corners, shadows)
   - Improved typography and spacing
   - Loading animations for streaming
   - Better error states
   - Keyboard shortcuts (Cmd+K for new chat)
   - Message timestamps
   - Copy/regenerate buttons

3. **Dashboard enhancements:**
   - Modern card layouts
   - Better data visualization (charts from Recharts)
   - Improved color scheme and spacing
   - Loading skeletons
   - Empty states with helpful messages
   - Responsive tables/lists
   - Export functionality

4. **Install Recharts for dashboard visualizations:**
   ```bash
   npm install recharts
   ```

**Deliverables:**
- ✅ Polished homepage
- ✅ Enhanced chat interface
- ✅ Professional dashboard UI
- ✅ Responsive design
- ✅ Better UX throughout

---

## Phase 3.8: Multiple Chatbots Support

**Objective:** Support multiple chatbots per creator with chatbot selection UI

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

---

## Phase 7: Deployment & Polish

### 7.1 Production Deployment Enhancements

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

**Deliverables:**
- ✅ Production app at custom domain
- ✅ Sentry monitoring active
- ✅ Uptime monitoring configured

---

### 7.2 Performance Optimization

**Objective:** Optimize for production performance

**Note:** Critical feedback API performance fix is in Phase 0.1 (do that first). This section covers additional optimizations.

**Tasks:**

1. **Add React Query for client-side caching:**
   ```bash
   npm install @tanstack/react-query
   ```

3. **Optimize images with Next.js Image component**

4. **Add loading states and skeletons**

5. **Implement database query optimization:**
   - Review slow queries
   - Add missing indexes
   - Optimize N+1 queries

6. **Add caching layer:**
   - Implement Redis/Upstash for rate limiting
   - Cache frequently accessed data

**Deliverables:**
- ✅ Fast page loads (<2s)
- ✅ Smooth interactions
- ✅ Optimized database queries
- ✅ Caching layer implemented

**Note:** Feedback API performance fix is in Phase 0.1 (already completed if following recommended order).

---

### 7.3 Comprehensive Documentation

**Objective:** Document the system for future development

**Create documentation:**

1. **ARCHITECTURE.md** - System overview
2. **ANALYTICS.md** - How analytics pipeline works
3. **MOBILE.md** - Mobile app setup and deployment
4. **TESTING.md** - Testing strategy and guidelines
5. **CONTRIBUTING.md** - Contribution guidelines

**Deliverables:**
- ✅ Complete documentation
- ✅ Code comments
- ✅ Deployment runbook

---

## Summary: Beyond MVP Checklist

### Critical Fixes (Do First)
- [ ] Phase 0.1: Fix Feedback API Performance ← **DO THIS NOW**

### Advanced Feedback Features
- [ ] Phase 3.3: "Need More" Modal
- [ ] Phase 3.4: Copy Button with Feedback
- [ ] Phase 3.5: End-of-Conversation Survey (triggered on copy, not inactivity)
- [ ] Phase 3.6: Embeddable Widget
- [ ] Phase 3.7: UI/UX Improvements (homepage, chat, dashboard)
- [ ] Phase 3.8: Multiple Chatbots Support

### Analytics & Intelligence
- [ ] Phase 4.1: Sentiment Analysis Job
- [ ] Phase 4.2: Enhanced Creator Dashboard
- [ ] Phase 4.3: Content Gap Aggregation
- [ ] Phase 4.4: Question Clustering (Question_Cluster_Aggregate)

### Testing & Quality
- [ ] Phase 5.1: Enhanced Seed Data
- [ ] Phase 5.2: Comprehensive Testing Strategy

### Mobile Platform
- [ ] Phase 6.1: React Native Project Setup
- [ ] Phase 6.2: Mobile Chat Interface
- [ ] Phase 6.3: Mobile Testing

### Deployment & Polish
- [ ] Phase 7.1: Production Deployment Enhancements (including Vercel AI Gateway/Helicone)
- [ ] Phase 7.2: Performance Optimization (CRITICAL: Fix feedback API slowness first)
- [ ] Phase 7.3: Comprehensive Documentation

---

## Missing Stack Items (Not Yet Planned)

### Vercel AI SDK Integration
**Status:** ✅ Already using `ai/react` for chat streaming (mentioned in stack.md)
- `useChat` hook from `ai/react` is already implemented
- `StreamingTextResponse` from `ai` is already used
- **No additional work needed** - already integrated

### Recharts for Dashboard Visualizations
**Status:** ❌ Not yet implemented
- **Add to Phase 3.7 (UI/UX Improvements)**
- Install: `npm install recharts`
- Use for: Format preferences charts, satisfaction trends, usage over time

### Vercel AI Gateway (Optional)
**Status:** ❌ Not planned (optional monitoring)
- **Add to Phase 7.1** as optional enhancement
- Provides: Request logging, caching, routing for LLM calls
- Alternative: Helicone (also mentioned in stack.md)

### Question Clustering (Question_Cluster_Aggregate)
**Status:** ❌ Mentioned in stack.md but not in beyond_mvp.md
- **Add to Phase 4.4** (new section)
- Nightly job to cluster user questions
- Update Question_Cluster_Aggregate table
- Show trends in dashboard

---

## Recommended Implementation Order

### Priority 1: Critical Performance Fixes
1. **Fix feedback API performance** (Phase 0.1) ← **DO THIS NOW**
   - **Do this immediately** - blocking user experience
   - Current: 2-5 second response time
   - Target: <500ms
   - **Complete before any other features**

### Priority 2: Core Features
2. **Start with Advanced Feedback** (Phase 3.3-3.5)
   - Builds on existing infrastructure
   - Provides richer data for analytics
   - Improves user experience

3. **UI/UX Improvements** (Phase 3.7)
   - Polish existing screens
   - Better user experience
   - Install Recharts for visualizations

4. **Multiple Chatbots** (Phase 3.8)
   - **Do this BEFORE analytics** - need multiple chatbots to test analytics properly
   - Enables testing with different content types
   - Better for real-world usage

### Priority 3: Analytics & Intelligence
5. **Then Analytics** (Phase 4)
   - Requires feedback data from Phase 3
   - Provides valuable insights
   - Enables content gap identification

6. **Question Clustering** (Phase 4.4 - new)
   - Cluster user questions
   - Show trends in dashboard

### Priority 4: Extended Reach
7. **Add Embeddable Widget** (Phase 3.6)
   - Extends reach
   - Relatively independent

8. **Build Mobile App** (Phase 6)
   - Requires stable API
   - Extends platform reach

### Priority 5: Quality & Polish
9. **Enhance Testing & Polish** (Phases 5 & 7)
   - Ongoing improvements
   - Quality assurance

---

## When to Add Multiple Chatbots

**Recommendation: Add multiple chatbots AFTER Phase 3.4 (Copy Button) but BEFORE Phase 4 (Analytics)**

**Why:**
- Need multiple chatbots to properly test analytics features
- Dashboard visualizations make more sense with multiple data sources
- Content gap aggregation works better with multiple chatbots
- But don't need it for basic feedback features

**Timeline:**
- **Phase 3.3-3.4:** Advanced feedback (single chatbot OK)
- **Phase 3.5:** End survey (single chatbot OK)
- **Phase 3.7:** UI improvements (single chatbot OK)
- **Phase 3.8:** Multiple chatbots ← **Add here**
- **Phase 4:** Analytics (needs multiple chatbots for meaningful data)

---

**Total Estimated Time:** 4-5 weeks beyond MVP (vs 8-10 weeks for full plan from scratch)

