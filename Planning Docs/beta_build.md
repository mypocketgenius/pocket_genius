# Beta Build Plan
## Post-MVP: Beta Release (Weeks 11-20+)
**Goal:** Add creator onboarding, monetization, mobile platform, and advanced features
**Focus:** Scale platform with paid features, team collaboration, and mobile access

---

## Overview

This document contains all tasks for the **Beta release** - a comprehensive 10+ week build focused on creator onboarding, monetization, mobile platform, and advanced analytics features. Beta builds on Alpha's foundation to create a full-featured platform.

**Alpha Status:** ✅ Completed through Week 10

**Beta Timeline:** 10+ weeks (Weeks 11-20+)

**Total Beta Tasks:** 15 advanced tasks

---

## Beta Task Dependencies

```
Alpha Complete (Week 10)
  ↓
┌─────────────────────┬──────────────────────┬────────────────────┐
│                     │                      │                    │
Phase 3.6            Phase 4.4-4.5         Phase 5.1-5.2       Phase 6.1-6.3
Embeddable Widget    Advanced Analytics    Testing             Mobile Platform
  ↓                    ↓                      ↓                    ↓
Phase 8.1-8.3        Phase 9.1-9.3         Phase 10.1-10.3    Phase 7.3
Payments             Workspaces            Email              Docs
```

**Critical Path:** Alpha → Mobile (6.1-6.3) → Payments (8.1-8.3)
**Parallel Paths:** 
- Embeddable Widget (3.6) can run parallel
- Advanced Analytics (4.4-4.5) can run parallel
- Testing (5.1-5.2) ongoing throughout

---

## New Files Created in Beta

```
app/
├── api/
│   ├── stripe/
│   │   ├── checkout/route.ts          # NEW Phase 8.1
│   │   └── webhook/route.ts           # NEW Phase 8.1
│   ├── workspaces/
│   │   ├── create/route.ts            # NEW Phase 9.1
│   │   └── [id]/
│   │       └── invite/route.ts        # NEW Phase 9.1
│   └── jobs/
│       └── cluster-questions/route.ts  # NEW Phase 4.4
│
├── embed/
│   └── [chatbotId]/page.tsx           # NEW Phase 3.6
│
├── pricing/page.tsx                    # NEW Phase 8.2
│
└── mobile/                             # NEW Phase 6 (separate repo)
    └── (entire React Native app)

public/
└── embed.js                            # NEW Phase 3.6

lib/
├── stripe.ts                           # NEW Phase 8.1
├── email.ts                            # NEW Phase 10.1
├── permissions.ts                      # NEW Phase 9.2
└── pricing.ts                          # NEW Phase 8.2

components/
└── dashboard/
    └── question-trends.tsx             # NEW Phase 4.4

prisma/
└── schema.prisma                       # UPDATED multiple times
    # Add: Subscription, Payment, Usage
    # Add: Workspace, Workspace_Member
    # Add: Revenue_Attribution, Creator_Payout
```

---

## Phase 3: Additional Features (Weeks 11-12)

**Estimated Time:** 1-2 weeks

### **DEFER TO BETA**

#### Phase 3.6: Embeddable Widget ❌ BETA

**Estimated Time:** 3-5 days

**Objective:** Create iframe-based embeddable widget for external sites

**Why defer:** Not needed until creators want to embed on their sites

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

4. **Configure CORS:**

   Update Next.js config to allow embedding:
   ```typescript
   // next.config.ts
   export default {
     async headers() {
       return [
         {
           source: '/embed/:path*',
           headers: [
             { key: 'X-Frame-Options', value: 'ALLOWALL' },
             { key: 'Content-Security-Policy', value: "frame-ancestors *" },
           ],
         },
       ];
     },
   };
   ```

5. **Create documentation for creators:**

   **`docs/embedding.md`:**
   - How to get embed code
   - Customization options
   - Styling guide
   - Examples

**Deliverables:**
- ✅ Iframe embed route at `/embed/[chatbotId]`
- ✅ Loader script at `/embed.js`
- ✅ Documentation for creators
- ✅ Same chat functionality as main app
- ✅ CORS configured

**Testing Checkpoint:**
- [ ] Embed widget loads correctly in iframe
- [ ] Chat functionality works in embedded mode
- [ ] CORS headers configured properly
- [ ] Documentation complete and accurate

---

## Phase 4: Advanced Analytics & Intelligence (Weeks 13-14)

**Estimated Time:** 2 weeks

### **DEFER TO BETA**

#### Phase 4.4: Question Clustering ❌ BETA

**Estimated Time:** 4-5 days

**Objective:** Implement nightly job to cluster user questions and track trends

**Why defer:** Advanced analytics, not critical for initial user validation

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

**Testing Checkpoint:**
- [ ] Clustering job runs successfully
- [ ] Question trends display correctly
- [ ] No performance issues with large question sets
- [ ] Integration tests passing

---

#### Phase 4.5: Advanced RAG Improvements ❌ BETA

**Estimated Time:** 5-7 days

**Objective:** Enhance answer relevance through better retrieval and ranking

**Why defer:** Only needed if Alpha users report relevance issues

**Tasks:**

1. **Hybrid Search:**

   Implement BM25 (keyword) + embeddings (semantic):
   - Weight combination: 0.3 BM25 + 0.7 embeddings
   - Use Pinecone sparse-dense vectors
   - Update retrieval logic in `lib/rag/query.ts`

   ```typescript
   // lib/rag/hybrid-search.ts
   import { generateEmbeddings } from '@/lib/embeddings/openai';
   import { pinecone } from '@/lib/pinecone/client';
   
   export async function hybridSearch(
     query: string,
     chatbotId: string,
     topK: number = 5
   ) {
     // Generate embeddings
     const embeddings = await generateEmbeddings([query]);
     const queryEmbedding = embeddings[0];
     
     // BM25 keyword matching (simplified - use Pinecone metadata filtering)
     const keywordMatches = await pinecone.query({
       vector: queryEmbedding,
       topK: topK * 2,
       filter: { chatbotId },
       includeMetadata: true,
     });
     
     // Re-rank by combining BM25 score (from metadata) and semantic similarity
     const scored = keywordMatches.matches.map(match => {
       const semanticScore = match.score || 0;
       const keywordScore = calculateBM25Score(query, match.metadata?.text || '');
       const hybridScore = 0.3 * keywordScore + 0.7 * semanticScore;
       
       return {
         ...match,
         hybridScore,
       };
     });
     
     return scored
       .sort((a, b) => b.hybridScore - a.hybridScore)
       .slice(0, topK);
   }
   
   function calculateBM25Score(query: string, text: string): number {
     // Simplified BM25 - in production, use a proper BM25 library
     const queryTerms = query.toLowerCase().split(/\s+/);
     const textLower = text.toLowerCase();
     
     let score = 0;
     queryTerms.forEach(term => {
       const termFreq = (textLower.match(new RegExp(term, 'g')) || []).length;
       if (termFreq > 0) {
         score += termFreq / (termFreq + 1.2 * (0.25 + 0.75 * (text.length / 1000)));
       }
     });
     
     return score;
   }
   ```

2. **Query Rewriting:**

   Expand user queries with synonyms and rephrase ambiguous questions:
   - Use GPT-4o-mini for query enhancement
   - Create query rewriting utility

   ```typescript
   // lib/rag/query-rewrite.ts
   import OpenAI from 'openai';
   import { env } from '@/lib/env';
   
   const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
   
   export async function rewriteQuery(
     originalQuery: string,
     conversationContext?: string[]
   ): Promise<string> {
     const prompt = `Rewrite this search query to be more effective for retrieving relevant information. 
     Return ONLY the rewritten query, no explanation.

Original query: "${originalQuery}"
${conversationContext ? `Conversation context: ${conversationContext.join(' ')}` : ''}

Rewritten query:`;
     
     const response = await openai.chat.completions.create({
       model: 'gpt-4o-mini',
       messages: [{ role: 'user', content: prompt }],
       temperature: 0.3,
     });
     
     return response.choices[0].message.content!.trim();
   }
   ```

3. **Re-ranking:**

   After retrieval, re-rank chunks by relevance:
   - Use cross-encoder model (optional)
   - Consider conversation context

   ```typescript
   // lib/rag/rerank.ts
   export async function rerankChunks(
     query: string,
     chunks: Array<{ id: string; text: string; score: number }>,
     conversationContext?: string[]
   ) {
     // Simple re-ranking based on keyword overlap and position
     // In production, use a cross-encoder model
     
     const queryTerms = query.toLowerCase().split(/\s+/);
     
     return chunks.map(chunk => {
       const textLower = chunk.text.toLowerCase();
       let relevanceScore = chunk.score;
       
       // Boost score for exact phrase matches
       if (textLower.includes(query.toLowerCase())) {
         relevanceScore *= 1.2;
       }
       
       // Boost score for multiple query term matches
       const termMatches = queryTerms.filter(term => textLower.includes(term)).length;
       relevanceScore *= (1 + termMatches / queryTerms.length);
       
       return {
         ...chunk,
         rerankedScore: relevanceScore,
       };
     }).sort((a, b) => b.rerankedScore - a.rerankedScore);
   }
   ```

4. **Citation Accuracy:**

   Track if users click "see source" and monitor complaints:
   - Add citation click tracking
   - Add validation step
   - Track citation accuracy metrics

   ```typescript
   // app/api/feedback/citation/route.ts
   import { auth } from '@clerk/nextjs';
   import { prisma } from '@/lib/prisma';
   
   export async function POST(request: Request) {
     const { userId } = auth();
     const { messageId, chunkId, wasAccurate } = await request.json();
     
     await prisma.citation_Feedback.create({
       data: {
         messageId,
         chunkId,
         userId: userId || undefined,
         wasAccurate,
       },
     });
     
     return Response.json({ success: true });
   }
   ```

**Deliverables:**
- ✅ Hybrid search implementation (BM25 + embeddings)
- ✅ Query rewriting pipeline
- ✅ Re-ranking algorithm
- ✅ Citation tracking and accuracy metrics

**Testing Checkpoint:**
- [ ] Hybrid search improves relevance scores
- [ ] Query rewriting generates better queries
- [ ] Re-ranking improves chunk order
- [ ] Citation accuracy metrics tracked correctly

---

## Phase 5: Testing & Quality (Week 15)

**Estimated Time:** 1-2 weeks (ongoing throughout Beta)

### **DEFER TO BETA**

#### Phase 5.1: Enhanced Seed Data ❌ BETA

**Estimated Time:** 2-3 days

**Objective:** Create comprehensive seed data for testing

**Why defer:** MVP seed data sufficient for Alpha testing

**Tasks:**

1. **Enhance seed script with full data:**

   Update `prisma/seed.ts` to include:
   - Multiple creators
   - Multiple chatbots
   - Multiple sources
   - Sample conversations and messages
   - Sample feedback data
   - Sample performance metrics

   ```typescript
   // prisma/seed.ts
   import { PrismaClient } from '@prisma/client';
   
   const prisma = new PrismaClient();
   
   async function main() {
     // Create multiple creators
     const creators = await Promise.all([
       prisma.creator.create({
         data: {
           name: 'Classic Literature Publisher',
           users: {
             create: {
               userId: 'user_classic_1',
             },
           },
           chatbots: {
             create: [
               {
                 title: 'The Art of War',
                 description: 'Ancient Chinese military strategy',
               },
               {
                 title: 'Meditations',
                 description: 'Stoic philosophy by Marcus Aurelius',
               },
             ],
           },
         },
       }),
       prisma.creator.create({
         data: {
           name: 'Business Books Inc',
           users: {
             create: {
               userId: 'user_business_1',
             },
           },
           chatbots: {
             create: [
               {
                 title: 'The Lean Startup',
                 description: 'Startup methodology',
               },
             ],
           },
         },
       }),
     ]);
     
     // Create sources for each chatbot
     for (const creator of creators) {
       for (const chatbot of creator.chatbots) {
         await prisma.source.create({
           data: {
             title: `${chatbot.title} - Full Text`,
             creatorId: creator.id,
             chatbotId: chatbot.id,
             type: 'book',
             // Add sample chunks, etc.
           },
         });
       }
     }
     
     // Create sample conversations and feedback
     // ... (add comprehensive test data)
   }
   
   main()
     .catch((e) => {
       console.error(e);
       process.exit(1);
     })
     .finally(async () => {
       await prisma.$disconnect();
     });
   ```

2. **Create test data fixtures:**

   **`tests/fixtures/seed-data.ts`:**
   ```typescript
   import { prisma } from '@/lib/prisma';
   
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
- ✅ Multiple creators, chatbots, sources
- ✅ Sample conversations and feedback

**Testing Checkpoint:**
- [ ] Seed script runs without errors
- [ ] Test fixtures work correctly
- [ ] All data relationships valid
- [ ] Seed data covers edge cases

---

#### Phase 5.2: Comprehensive Testing Strategy ❌ BETA

**Estimated Time:** 1 week

**Objective:** Implement full testing suite beyond MVP

**Why defer:** Basic testing from MVP is adequate for Alpha

**Tasks:**

1. **Set up testing infrastructure:**

   Install dependencies:
   ```bash
   npm install -D jest @types/jest ts-jest @testing-library/react @testing-library/jest-dom
   npm install -D supertest @types/supertest
   npm install -D msw  # For mocking external APIs
   npm install -D @playwright/test  # For E2E tests
   ```

2. **Create unit tests:**

   **`__tests__/lib/chunking/text.test.ts`:**
   ```typescript
   import { chunkText } from '@/lib/chunking/text';
   
   describe('chunkText', () => {
     it('should chunk text into smaller pieces', () => {
       const text = 'This is a long text that needs to be chunked. '.repeat(100);
       const chunks = chunkText(text, 500);
       
       expect(chunks.length).toBeGreaterThan(1);
       chunks.forEach(chunk => {
         expect(chunk.length).toBeLessThanOrEqual(500);
       });
     });
   });
   ```

3. **Create integration tests:**

   **`__tests__/api/chat/route.test.ts`:**
   ```typescript
   import { POST } from '@/app/api/chat/route';
   import { createMocks } from 'node-mocks-http';
   
   describe('/api/chat', () => {
     it('should return streaming response', async () => {
       const { req, res } = createMocks({
         method: 'POST',
         body: {
           messages: [{ role: 'user', content: 'Hello' }],
           conversationId: 'test-conv-1',
           chatbotId: 'test-bot-1',
         },
       });
       
       await POST(req);
       
       expect(res._getStatusCode()).toBe(200);
     });
   });
   ```

4. **Create E2E tests:**

   **`e2e/chat-flow.spec.ts`:**
   ```typescript
   import { test, expect } from '@playwright/test';
   
   test('user can chat with chatbot', async ({ page }) => {
     await page.goto('/chat/test-bot-1');
     
     await page.fill('input[type="text"]', 'What is strategy?');
     await page.click('button[type="submit"]');
     
     await expect(page.locator('.message-assistant')).toBeVisible();
   });
   ```

5. **Set up CI/CD:**

   **`.github/workflows/test.yml`:**
   ```yaml
   name: Tests
   
   on: [push, pull_request]
   
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
         - run: npm ci
         - run: npm test
         - run: npm run test:e2e
   ```

**Deliverables:**
- ✅ Unit test suite (70%+ coverage)
- ✅ Integration test suite (80%+ coverage)
- ✅ E2E test suite (all critical flows)
- ✅ CI/CD pipeline with automated tests

**Testing Checkpoint:**
- [ ] All tests passing in CI/CD
- [ ] Coverage targets met
- [ ] E2E tests cover critical user flows
- [ ] Test suite runs in reasonable time

---

## Phase 6: Mobile Platform (Weeks 16-17)

**Estimated Time:** 2-3 weeks

### **DEFER TO BETA**

#### Phase 6.1: React Native Project Setup ❌ BETA

**Estimated Time:** 2-3 days (includes monorepo migration)

**Objective:** Initialize React Native project with Expo

**Why defer:** Focus on web experience first, validate concept before mobile investment

**Note on Project Structure:**

Since we're adding mobile in Beta, now is the time to migrate to monorepo structure (deferred from MVP/Alpha):

```
pocket-genius/
├── apps/
│   ├── web/                    # Move existing Next.js here
│   └── mobile/                 # New React Native app
├── packages/
│   ├── database/               # Shared Prisma
│   └── shared/                 # Shared types
└── package.json                # Root workspace config
```

**Migration steps:**
1. Create monorepo structure
2. Move existing web app to `apps/web/`
3. Move Prisma to `packages/database/`
4. Create `packages/shared/` for API types
5. Initialize mobile app in `apps/mobile/`
6. Configure npm/pnpm workspaces

**Estimated time:** 2-3 hours

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

#### Phase 6.2: Mobile Chat Interface ❌ BETA

**Estimated Time:** 5-7 days

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

#### Phase 6.3: Mobile Testing & App Store Submission ❌ BETA

**Estimated Time:** 1-2 weeks (includes app store review wait time)

**Objective:** Verify mobile app works identically to web and prepare for app store submission

**Test Scenarios:**
- [ ] Install Expo Go app
- [ ] Run: `npx expo start`
- [ ] Scan QR code with phone
- [ ] Login with Clerk
- [ ] Navigate to chat
- [ ] Send messages and verify responses
- [ ] Test feedback buttons
- [ ] Verify data appears in dashboard

**Additional Tasks:**

1. **Prepare for App Store submission:**
   - Create app store assets (screenshots, icons, descriptions)
   - Privacy policy URL
   - Terms of service URL
   - App review notes

2. **iOS App Store:**
   ```bash
   # Build for iOS
   eas build --platform ios --profile production
   
   # Submit to App Store Connect
   eas submit --platform ios
   ```

3. **Google Play Store:**
   ```bash
   # Build for Android
   eas build --platform android --profile production
   
   # Submit to Google Play
   eas submit --platform android
   ```

4. **Wait for review:**
   - iOS: 1-3 days typically
   - Android: 1-7 days typically

**Deliverables:**
- ✅ Mobile app functional on iOS/Android
- ✅ Same data as web app
- ✅ Feedback collection works
- ✅ **App submitted to both stores**
- ✅ **App approved and published**

---

## Phase 8: Payments & Monetization (Weeks 18-19)

**Estimated Time:** 2 weeks

### **NEW - DEFER TO BETA** ❌

#### Phase 8.1: Stripe Integration ❌ BETA

**Estimated Time:** 3-4 days

**Task: Integrate Stripe for Paid Conversations**

**Objective:** Enable paid access to premium content/features

**Why defer to Beta:** Alpha uses free public domain content, no monetization needed yet

**Database Tables:**

Add to `prisma/schema.prisma`:
```prisma
model Subscription {
  id String @id @default(cuid())
  userId String
  stripeSubscriptionId String @unique
  stripePriceId String
  status String // 'active' | 'canceled' | 'past_due'
  currentPeriodStart DateTime
  currentPeriodEnd DateTime
  cancelAtPeriodEnd Boolean @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([userId])
  @@index([status])
}

model Payment {
  id String @id @default(cuid())
  userId String
  stripePaymentIntentId String @unique
  amount Int
  currency String
  status String // 'succeeded' | 'failed' | 'pending'
  conversationId String?
  createdAt DateTime @default(now())
  
  @@index([userId])
  @@index([conversationId])
}

model Usage {
  id String @id @default(cuid())
  userId String
  conversationId String
  messageCount Int
  creditsUsed Int
  createdAt DateTime @default(now())
  
  @@index([userId])
  @@index([conversationId])
}
```

**Run migration:**
```bash
npx prisma migrate dev --name add_payment_tables
npx prisma generate
```

**Implementation:**

1. **Stripe setup:**
```typescript
// lib/stripe.ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});
```

2. **Checkout API:**
```typescript
// app/api/stripe/checkout/route.ts
export async function POST(req: Request) {
  const { userId, priceId } = await req.json();
  
  const session = await stripe.checkout.sessions.create({
    customer_email: user.email,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${process.env.NEXT_PUBLIC_URL}/dashboard?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/pricing?canceled=true`,
    metadata: { userId },
  });
  
  return Response.json({ url: session.url });
}
```

3. **Webhook handler:**
```typescript
// app/api/stripe/webhook/route.ts
export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')!;
  const body = await req.text();
  
  const event = stripe.webhooks.constructEvent(
    body,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
  
  switch (event.type) {
    case 'checkout.session.completed':
      // Create subscription record
      const session = event.data.object;
      await prisma.subscription.create({
        data: {
          userId: session.metadata.userId,
          stripeSubscriptionId: session.subscription,
          stripePriceId: session.line_items.data[0].price.id,
          status: 'active',
          currentPeriodStart: new Date(session.current_period_start * 1000),
          currentPeriodEnd: new Date(session.current_period_end * 1000),
        },
      });
      break;
    case 'customer.subscription.deleted':
      // Cancel subscription
      const subscription = event.data.object;
      await prisma.subscription.update({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: 'canceled' },
      });
      break;
  }
  
  return Response.json({ received: true });
}
```

**Deliverables:**
- ✅ Stripe integration complete
- ✅ Subscription management
- ✅ Webhook handling
- ✅ Payment processing

**Testing Checkpoint:**
- [ ] Checkout flow works end-to-end
- [ ] Webhook events processed correctly
- [ ] Subscription status updates properly
- [ ] Payment records created accurately

---

#### Phase 8.2: Paid Conversations ❌ BETA

**Estimated Time:** 3-4 days

**Task: Implement Usage-Based Pricing**

**Objective:** Track and limit conversations based on subscription tier

**Why defer to Beta:** Not needed for free Alpha release

**Pricing Tiers:**
```typescript
// lib/pricing.ts
export const PRICING_TIERS = {
  FREE: {
    name: 'Free',
    messagesPerMonth: 50,
    price: 0,
  },
  PREMIUM: {
    name: 'Premium',
    messagesPerMonth: 500,
    price: 1999, // $19.99
  },
  UNLIMITED: {
    name: 'Unlimited',
    messagesPerMonth: -1, // unlimited
    price: 4999, // $49.99
  },
};
```

**Implementation:**

1. **Usage middleware:**
```typescript
// lib/middleware/check-usage.ts
export async function checkUsageLimit(userId: string): Promise<boolean> {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: 'active' },
  });
  
  const tier = subscription ? getTier(subscription.stripePriceId) : 'FREE';
  const limit = PRICING_TIERS[tier].messagesPerMonth;
  
  if (limit === -1) return true; // unlimited
  
  const usage = await prisma.usage.aggregate({
    where: {
      userId,
      createdAt: {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1),
      },
    },
    _sum: { messageCount: true },
  });
  
  return (usage._sum.messageCount || 0) < limit;
}
```

2. **Pricing page:**
```typescript
// app/pricing/page.tsx
export default function PricingPage() {
  return (
    <div className="container mx-auto py-12">
      <h1 className="text-4xl font-bold text-center mb-12">
        Choose Your Plan
      </h1>
      <div className="grid grid-cols-3 gap-8">
        {Object.entries(PRICING_TIERS).map(([key, tier]) => (
          <PricingCard key={key} tier={tier} />
        ))}
      </div>
    </div>
  );
}
```

**Deliverables:**
- ✅ Usage tracking
- ✅ Tier-based limits
- ✅ Pricing page
- ✅ Upgrade flow

**Testing Checkpoint:**
- [ ] Usage limits enforced correctly
- [ ] Tier upgrades work smoothly
- [ ] Pricing page displays correctly
- [ ] Usage tracking accurate

---

#### Phase 8.3: Revenue Attribution & Payouts ❌ BETA

**Estimated Time:** 4-5 days

**Task: Track Revenue by Source and Handle Creator Payouts**

**Objective:** Attribute subscription revenue to content sources for creator payouts

**Why defer to Beta:** Not needed until creators join platform

**Database Addition:**

Add to `prisma/schema.prisma`:
```prisma
model Revenue_Attribution {
  id String @id @default(cuid())
  subscriptionId String
  sourceId String
  creatorId String
  
  // Attribution
  attributedAmount Int // in cents
  usageCount Int // how many times this source was used
  
  // Period
  month Int
  year Int
  
  createdAt DateTime @default(now())
  
  @@index([subscriptionId])
  @@index([sourceId, month, year])
  @@index([creatorId, month, year])
}

model Creator_Payout {
  id String @id @default(cuid())
  creatorId String
  amount Int // in cents
  status String // 'pending' | 'processing' | 'paid' | 'failed'
  stripeTransferId String?
  
  // Period
  month Int
  year Int
  
  createdAt DateTime @default(now())
  paidAt DateTime?
  
  @@index([creatorId])
  @@index([status])
}
```

**Run migration:**
```bash
npx prisma migrate dev --name add_revenue_attribution
npx prisma generate
```

**Implementation:**

1. **Attribution logic:**
```typescript
// Monthly job to attribute revenue
export async function attributeRevenue() {
  const subscriptions = await prisma.subscription.findMany({
    where: { status: 'active' },
  });
  
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 1);
  
  for (const sub of subscriptions) {
    // Get all conversations this month
    const conversations = await prisma.conversation.findMany({
      where: {
        userId: sub.userId,
        createdAt: { gte: startOfMonth, lt: endOfMonth },
      },
      include: {
        messages: {
          where: { role: 'assistant' },
          select: { context: true },
        },
      },
    });
    
    // Count source usage
    const sourceUsage: Record<string, number> = {};
    conversations.forEach(conv => {
      conv.messages.forEach(msg => {
        const context = msg.context as any;
        const sourceIds = context?.chunks?.map((c: any) => c.sourceId) || [];
        sourceIds.forEach((sourceId: string) => {
          sourceUsage[sourceId] = (sourceUsage[sourceId] || 0) + 1;
        });
      });
    });
    
    // Attribute revenue proportionally
    const totalUsage = Object.values(sourceUsage).reduce((a, b) => a + b, 0);
    const subscriptionRevenue = getSubscriptionAmount(sub.stripePriceId);
    
    for (const [sourceId, count] of Object.entries(sourceUsage)) {
      const attributedAmount = Math.floor(
        (count / totalUsage) * subscriptionRevenue
      );
      
      const source = await prisma.source.findUnique({
        where: { id: sourceId },
      });
      
      await prisma.revenue_Attribution.create({
        data: {
          subscriptionId: sub.id,
          sourceId,
          creatorId: source!.creatorId,
          attributedAmount,
          usageCount: count,
          month,
          year,
        },
      });
    }
  }
}
```

2. **Payout processing:**
```typescript
// Monthly payout to creators
export async function processPayouts() {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  
  const attributions = await prisma.revenue_Attribution.groupBy({
    by: ['creatorId', 'month', 'year'],
    _sum: { attributedAmount: true },
    where: {
      month,
      year,
    },
  });
  
  for (const attr of attributions) {
    const creator = await prisma.creator.findUnique({
      where: { id: attr.creatorId },
    });
    
    if (!creator?.stripeAccountId) continue;
    
    // Create Stripe transfer
    const transfer = await stripe.transfers.create({
      amount: attr._sum.attributedAmount!,
      currency: 'usd',
      destination: creator.stripeAccountId,
    });
    
    await prisma.creator_Payout.create({
      data: {
        creatorId: attr.creatorId,
        amount: attr._sum.attributedAmount!,
        status: 'paid',
        stripeTransferId: transfer.id,
        month,
        year,
        paidAt: new Date(),
      },
    });
  }
}
```

**Deliverables:**
- ✅ Revenue attribution by source
- ✅ Creator payout calculation
- ✅ Stripe Connect integration
- ✅ Payout dashboard for creators

**Testing Checkpoint:**
- [ ] Revenue attribution calculations correct
- [ ] Payout amounts accurate
- [ ] Stripe transfers successful
- [ ] Dashboard displays payout data correctly

---

## Phase 9: Multi-User Workspaces (Week 20)

**Estimated Time:** 1 week

### **NEW - DEFER TO BETA** ❌

#### Phase 9.1: Team Workspace Creation ❌ BETA

**Estimated Time:** 2-3 days

**Task: Enable Team Accounts for Creators**

**Objective:** Allow multiple users to collaborate on a creator account

**Why defer to Beta:** Not needed for solo creators in Alpha

**Database Tables:**

Add to `prisma/schema.prisma`:
```prisma
model Workspace {
  id String @id @default(cuid())
  name String
  slug String @unique
  ownerId String
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([ownerId])
}

model Workspace_Member {
  id String @id @default(cuid())
  workspaceId String
  userId String
  role String // 'owner' | 'admin' | 'editor' | 'viewer'
  
  createdAt DateTime @default(now())
  
  @@unique([workspaceId, userId])
  @@index([workspaceId])
  @@index([userId])
}

model Workspace_Invitation {
  id String @id @default(cuid())
  workspaceId String
  email String
  role String
  token String @unique
  status String // 'pending' | 'accepted' | 'expired'
  expiresAt DateTime
  
  createdAt DateTime @default(now())
  
  @@index([workspaceId])
  @@index([token])
}
```

**Run migration:**
```bash
npx prisma migrate dev --name add_workspace_tables
npx prisma generate
```

**Implementation:**

1. **Workspace creation:**
```typescript
// app/api/workspaces/create/route.ts
export async function POST(req: Request) {
  const { userId } = auth();
  const { name, slug } = await req.json();
  
  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug,
      ownerId: userId,
      members: {
        create: {
          userId,
          role: 'owner',
        },
      },
    },
  });
  
  return Response.json({ workspace });
}
```

2. **Invite members:**
```typescript
// app/api/workspaces/[workspaceId]/invite/route.ts
export async function POST(req: Request, { params }) {
  const { email, role } = await req.json();
  
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  await prisma.workspace_Invitation.create({
    data: {
      workspaceId: params.workspaceId,
      email,
      role,
      token,
      status: 'pending',
      expiresAt,
    },
  });
  
  await sendInvitationEmail(email, token);
  
  return Response.json({ success: true });
}
```

**Deliverables:**
- ✅ Workspace creation
- ✅ Member invitations
- ✅ Role management

**Testing Checkpoint:**
- [ ] Workspace creation works
- [ ] Invitations sent and accepted correctly
- [ ] Role assignments persist
- [ ] Multiple workspaces per user supported

---

#### Phase 9.2: Role-Based Permissions ❌ BETA

**Estimated Time:** 2-3 days

**Task: Implement RBAC for Workspace Actions**

**Objective:** Control what each role can do in workspace

**Why defer to Beta:** Not needed for solo creators

**Permission Matrix:**
```typescript
// lib/permissions.ts
export const PERMISSIONS = {
  owner: [
    'workspace:delete',
    'workspace:update',
    'member:invite',
    'member:remove',
    'chatbot:create',
    'chatbot:update',
    'chatbot:delete',
    'source:create',
    'source:update',
    'source:delete',
    'dashboard:view',
    'analytics:view',
  ],
  admin: [
    'workspace:update',
    'member:invite',
    'chatbot:create',
    'chatbot:update',
    'chatbot:delete',
    'source:create',
    'source:update',
    'source:delete',
    'dashboard:view',
    'analytics:view',
  ],
  editor: [
    'chatbot:update',
    'source:update',
    'dashboard:view',
  ],
  viewer: [
    'dashboard:view',
  ],
};
```

**Implementation:**
```typescript
// lib/permissions/check.ts
export async function checkPermission(
  userId: string,
  workspaceId: string,
  permission: string
): Promise<boolean> {
  const member = await prisma.workspace_Member.findUnique({
    where: {
      workspaceId_userId: { workspaceId, userId },
    },
  });
  
  if (!member) return false;
  
  return PERMISSIONS[member.role].includes(permission);
}
```

**Deliverables:**
- ✅ RBAC implementation
- ✅ Permission checks on all actions
- ✅ UI elements conditional on permissions

**Testing Checkpoint:**
- [ ] Permission checks work correctly
- [ ] UI reflects user permissions
- [ ] Unauthorized actions blocked
- [ ] Role changes take effect immediately

---

#### Phase 9.3: Multi-Seat Subscriptions ❌ BETA

**Estimated Time:** 2-3 days

**Task: Support Team Pricing Plans**

**Objective:** Charge for additional workspace members

**Why defer to Beta:** Not needed for individual creators

**Pricing:**
```typescript
export const TEAM_PRICING = {
  STARTER: {
    basePrice: 4999, // $49.99
    includedSeats: 3,
    additionalSeatPrice: 1999, // $19.99/seat
  },
  PROFESSIONAL: {
    basePrice: 9999, // $99.99
    includedSeats: 10,
    additionalSeatPrice: 999, // $9.99/seat
  },
  ENTERPRISE: {
    basePrice: 'custom',
    includedSeats: 'unlimited',
    additionalSeatPrice: 0,
  },
};
```

**Deliverables:**
- ✅ Team subscription plans
- ✅ Seat management
- ✅ Prorated billing for seat changes

---

## Phase 10: Email Notifications (Week 21)

**Estimated Time:** 1 week

### **NEW - DEFER TO BETA** ❌

#### Phase 10.1: Email Service Setup ❌ BETA

**Estimated Time:** 1-2 days

**Task: Integrate Email Service (Resend/SendGrid)**

**Objective:** Send transactional and marketing emails

**Why defer to Beta:** Can manually contact Alpha users

**Setup:**
```typescript
// lib/email.ts
import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  await resend.emails.send({
    from: 'Pocket Genius <noreply@pocketgenius.ai>',
    to,
    subject,
    html,
  });
}
```

**Deliverables:**
- ✅ Email service configured
- ✅ Email templates created
- ✅ Transactional email sending

**Testing Checkpoint:**
- [ ] Emails send successfully
- [ ] Templates render correctly
- [ ] Email delivery reliable
- [ ] Error handling works

---

#### Phase 10.2: Analytics Digests ❌ BETA

**Estimated Time:** 2-3 days

**Task: Weekly Analytics Emails for Creators**

**Objective:** Keep creators informed of content performance

**Why defer to Beta:** Not needed until creators are active

**Email Content:**
- Top performing chunks this week
- New content gaps identified
- User satisfaction trends
- Popular questions

**Implementation:**
```typescript
// Weekly cron job
export async function sendWeeklyDigest() {
  const creators = await prisma.creator.findMany({
    include: { users: true },
  });
  
  for (const creator of creators) {
    const digest = await generateDigest(creator.id);
    
    for (const user of creator.users) {
      await sendEmail({
        to: user.email,
        subject: 'Your Weekly Content Performance Digest',
        html: digestTemplate(digest),
      });
    }
  }
}
```

**Deliverables:**
- ✅ Weekly digest emails
- ✅ Digest content generation
- ✅ Email templates

**Testing Checkpoint:**
- [ ] Weekly cron job runs successfully
- [ ] Digest content accurate
- [ ] Emails sent to all creators
- [ ] Email formatting correct

---

#### Phase 10.3: Alert Notifications ❌ BETA

**Estimated Time:** 2-3 days

**Task: Real-Time Alerts for Important Events**

**Objective:** Notify creators of critical issues

**Why defer to Beta:** Not critical for Alpha validation

**Alerts:**
- Content gap with 10+ requests
- Chunk satisfaction drops below 50%
- New payout processed
- Subscription canceled

**Implementation:**
```typescript
// Trigger alert when threshold met
export async function checkAndSendAlerts() {
  const contentGaps = await prisma.content_Gap.findMany({
    where: {
      requestCount: { gte: 10 },
      status: 'open',
    },
    include: {
      chatbot: {
        include: {
          creator: {
            include: { users: true },
          },
        },
      },
    },
  });
  
  for (const gap of contentGaps) {
    for (const user of gap.chatbot.creator.users) {
      await sendEmail({
        to: user.email,
        subject: 'Content Gap Alert: High Demand Topic',
        html: contentGapAlertTemplate(gap),
      });
    }
  }
}
```

**Deliverables:**
- ✅ Alert triggering logic
- ✅ Alert email templates
- ✅ Alert preferences for creators

**Testing Checkpoint:**
- [ ] Alerts trigger at correct thresholds
- [ ] Alert emails sent promptly
- [ ] Creator preferences respected
- [ ] No duplicate alerts sent

---

## Phase 7: Additional Documentation (Week 22)

**Estimated Time:** 1 week

### **DEFER TO BETA**

#### Phase 7.3: Comprehensive Documentation (Full) ❌ BETA

**Estimated Time:** 3-5 days

**Objective:** Document the system for future development

**For Beta: Complete documentation**

**Create documentation:**

1. **ARCHITECTURE.md** - System overview
2. **ANALYTICS.md** - How analytics pipeline works
3. **MOBILE.md** - Mobile app setup and deployment
4. **TESTING.md** - Testing strategy and guidelines
5. **CONTRIBUTING.md** - Contribution guidelines
6. **API.md** - API documentation for integrations
7. **CREATOR_ONBOARDING.md** - Creator onboarding guide

**Deliverables:**
- ✅ Complete documentation
- ✅ Code comments
- ✅ Deployment runbook
- ✅ Creator guides

---

## Additional Environment Variables for Beta

**Beyond Alpha, add these to Vercel:**

**Stripe (Phase 8):**
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

**Email Service (Phase 10):**
- [ ] `RESEND_API_KEY` (or `SENDGRID_API_KEY`)

**Mobile App (Phase 6):**
- [ ] `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- [ ] `EXPO_PUBLIC_API_URL`

**Optional:**
- [ ] `SENTRY_DSN_MOBILE` (separate Sentry project for mobile)

---

## Beta Rollback Strategy

**If critical issues in Beta:**

1. **Immediate (< 1 hour):**
   - Revert to Alpha version
   - Notify affected users
   - Investigate issue

2. **Short-term (1-24 hours):**
   - Fix issue in staging
   - Deploy hotfix with testing
   - Monitor closely

3. **Medium-term (1-7 days):**
   - Root cause analysis
   - Implement preventive measures
   - Update testing suite

**Beta-Specific Rollback Considerations:**
- Payments: Ensure no revenue loss, refund if needed
- Mobile: Push emergency update via app stores
- Workspaces: Preserve all workspace data
- Email: Stop all scheduled sends immediately

---

## Beta Launch Communication Plan

**Pre-Launch (2 weeks before):**
- [ ] Email Alpha users about upcoming features
- [ ] Create Beta announcement content
- [ ] Prepare mobile app store listings
- [ ] Set up payment processing
- [ ] Test all new features thoroughly

**Launch Week:**
- [ ] Monday: Beta announcement (email + social)
- [ ] Tuesday: Mobile app goes live
- [ ] Wednesday: Payments enabled
- [ ] Thursday: Creator onboarding begins
- [ ] Friday: Weekly recap and user feedback

**Post-Launch (first month):**
- [ ] Weekly beta user interviews
- [ ] Daily monitoring of payment flows
- [ ] Mobile app bug triage
- [ ] Creator onboarding support
- [ ] Feature usage analytics review

---

## Beta Release Checklist

**Before launching Beta:**

- [ ] All Alpha features stable
- [ ] Embeddable widget working
- [ ] Advanced analytics complete
- [ ] Mobile app functional
- [ ] Stripe integration complete
- [ ] Usage tracking working
- [ ] Revenue attribution implemented
- [ ] Workspace features complete
- [ ] Email notifications working
- [ ] Comprehensive documentation

**Beta Success Criteria:**
- 1000+ users across web and mobile
- 50+ creators onboarded
- $10K+ MRR
- < 1% error rate
- < 2s response time
- Creator satisfaction > 4/5

---

## Summary: Beta Build Checklist

### Additional Features
- [ ] Phase 3.6: Embeddable Widget

### Advanced Analytics
- [ ] Phase 4.4: Question Clustering
- [ ] Phase 4.5: Advanced RAG Improvements

### Testing & Quality
- [ ] Phase 5.1: Enhanced Seed Data
- [ ] Phase 5.2: Comprehensive Testing Strategy

### Mobile Platform
- [ ] Phase 6.1: React Native Setup
- [ ] Phase 6.2: Mobile Chat Interface
- [ ] Phase 6.3: Mobile Testing

### Payments & Monetization
- [ ] Phase 8.1: Stripe Integration
- [ ] Phase 8.2: Paid Conversations
- [ ] Phase 8.3: Revenue Attribution & Payouts

### Multi-User Workspaces
- [ ] Phase 9.1: Team Workspace Creation
- [ ] Phase 9.2: Role-Based Permissions
- [ ] Phase 9.3: Multi-Seat Subscriptions

### Email Notifications
- [ ] Phase 10.1: Email Service Setup
- [ ] Phase 10.2: Analytics Digests
- [ ] Phase 10.3: Alert Notifications

### Documentation
- [ ] Phase 7.3: Comprehensive Documentation (Full)

**Total Beta Tasks:** 15 tasks

**Timeline:** 10+ weeks (Weeks 11-20+)

**Beta adds creator onboarding, monetization, and mobile platform.**

