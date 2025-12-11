# Pocket Genius – Tech Stack Summary

## Overview
Pocket Genius provides AI-powered chatbots trained on creator content, with deep analytics showing chunk-level performance, content gaps, and actionable insights that helps thought leaders understand what content to create next and what needs improvement.

---

## 1. Hosting & Platform
- **Vercel**
  - Fast deployment + previews
  - Native support for Next.js, AI SDK, streaming responses
  - Edge functions for low-latency chat responses
  - Optional: Vercel AI Gateway & Fluid Compute for advanced workloads

---

## 2. Frontend

### Web App (Creator Dashboard + Audience Chat)
- **Next.js 14+ (App Router)**
- **TypeScript**
- **Vercel AI SDK** for streaming chat responses
- **TailwindCSS + shadcn/ui** for UI components
- **Recharts or D3.js** for creator analytics dashboards
- Hosted fully on Vercel

**Key Features:**
- Creator dashboard with content intelligence views
- Chunk performance visualization with actual text display
- Content gap prioritization with user contexts
- Format preference analytics
- Audience chat interface with feedback collection

### Embeddable Chatbot Widget
- Lightweight `<script>` that injects an `<iframe>`
- Iframe renders from `https://pocketgenius.ai/embed/[botId]`
- Integrated feedback buttons (👍 👎 💡) in chat interface
- Copy button with optional context collection
- Uses same chat API as main app

### React Native Mobile App
- **React Native + TypeScript**
- **Clerk RN SDK** for auth
- Optimized for audience chat experience
- Feedback collection integrated into mobile UI
- Fetches chat results via same Next.js API routes

---

## 3. Backend

### API Layer
Implemented via **Next.js Route Handlers** (serverless):
- **Chat endpoints:**
  - RAG + LLM generation
  - Message creation with chunk tracking (Message.context)
  - Real-time feedback collection (thumbs up/down, copy)
- **Creator intelligence endpoints:**
  - Chunk performance queries
  - Content gap aggregation
  - Dashboard analytics
- **Bot management:**
  - Chatbot CRUD
  - Source/file management
- **Feedback collection:**
  - Message feedback (POST /api/feedback/message)
  - Conversation feedback (POST /api/feedback/conversation)
  - Copy event tracking
- **File upload:**
  - Initiation and status tracking
  - Ingestion pipeline triggers
- **Workspace/account management**
- **Stripe webhooks** for revenue tracking

### Serverless Execution Model
- All backend logic runs in Vercel serverless or edge functions
- Stateless compute; DB & storage handle persistence
- Background jobs for analytics aggregation

---

## 4. Database & ORM

### Primary Database
- **Neon Postgres**
  - Serverless Postgres with connection pooling
  - Perfect with Vercel + Prisma
  - Scales with serverless architecture

### Schema Structure
**Core Tables:**
- Creator, Chatbot, Source, Message, Conversation
- User, Purchase, Revenue_per_Conversation
- Conversation_Source_Usage (revenue attribution)

**Creator Intelligence Tables (NEW):**
- **Chunk_Performance** – Individual content section metrics
- **Message_Analysis** – Async sentiment analysis
- **Message_Feedback** – User feedback (👍 👎 💡, copy events)
- **Conversation_Feedback** – Goal achievement tracking
- **Content_Gap** – Aggregated unmet demand
- **Question_Cluster_Aggregate** – Question volume trends
- **Source_Performance** – Enhanced with quality metrics

### ORM / Schema Management
- **Prisma**
  - Type-safe DB client
  - Automatic migrations
  - End-to-end TS type safety
  - Excellent serverless support

---

## 5. Authentication & Identity

### Auth Provider
- **Clerk**
  - Unified identity for web, embedded chat, mobile
  - Multi-tenant support for creators
  - Secure JWT/session support

### User Models
- **Creators** → Own chatbots, sources, view intelligence dashboards
- **Creator_User** → Multiple users can manage one creator entity
- **End Users** → Chat with bots, provide feedback, purchase conversations
- **Anonymous Users** → Can chat if chatbot allows

---

## 6. Payments & Subscriptions

### Stripe Billing
- **Products:**
  - Creator subscription plans (includes intelligence dashboard)
  - Pay-per-conversation for audience members
  - Enterprise subscriptions
- **Webhooks:**
  - Purchase confirmation → Create conversations
  - Subscription updates → Update creator access
  - Payment failures → Handle gracefully
- **Revenue Attribution:**
  - 7-day window before payout (refund protection)
  - Token-based revenue split via Conversation_Source_Usage
  - Tracked in Revenue_per_Conversation table

---

## 7. File Storage

### Object Storage
- **Vercel Blob Storage**
  - Uploaded PDFs, transcripts, Excel files
  - Signed URLs for secure access
  - Source files for RAG ingestion

### Metadata
- Stored in **Neon Postgres** (File table)
- Statuses: PENDING → PROCESSING → READY → ACTIVE
- Links to Source table for content attribution

---

## 8. RAG + AI Layer

### Vector Database
- **Pinecone**
  - Namespaced per chatbot/creator
  - Stores embeddings for chunked content
  - Metadata includes: sourceId, page, section, chapter
  - Separate namespace for user questions (for clustering)

### LLMs
- **Primary: OpenAI GPT-4o** for chat generation
- **Embeddings: OpenAI text-embedding-3-small**
- **Sentiment Analysis: OpenAI GPT-4o-mini** (cost-effective for analysis)
- Abstraction layer supports swapping models

### RAG Pipeline

**Ingestion Flow:**
1. Upload file → Store in Vercel Blob
2. Background job triggers ingestion:
   - Extract text (PDF, DOCX, etc.)
   - Chunk strategically (preserve context)
   - Enrich metadata (source, page, section)
   - Generate embeddings
   - Upsert to Pinecone namespace with full metadata
3. Update File status → READY

**Query Flow:**
1. User asks question → Generate embedding
2. Query Pinecone → Retrieve top K chunks
3. Store retrieved chunks in `Message.context.chunks`:
   ```typescript
   {
     chunks: [
       { chunkId, sourceId, text, page, section, relevanceScore }
     ]
   }
   ```
4. Generate response using retrieved chunks
5. Track usage in Conversation_Source_Usage (for revenue)

---

## 9. Analytics & Intelligence Pipeline

### Real-Time Tracking
- **Message creation:** Store chunks used in Message.context
- **User feedback:** Capture thumbs up/down, copy events immediately
- **Behavioral signals:** Track time spent, copy-to-clipboard events

### Async Analysis
- **Message_Analysis job:**
  - Analyze user message sentiment (satisfaction, confusion, frustration)
  - Detect intent (question, clarification, gratitude)
  - Run selectively (3+ message conversations, frustration keywords)
- **Attribution job:**
  - Link user sentiment → chunks in previous bot message
  - Update Chunk_Performance counters with position weighting

### Nightly Jobs
1. **Content Gap Aggregation:**
   - Cluster similar "need more" feedback by embeddings
   - Use representative question (most common in cluster)
   - Aggregate format preferences and user contexts
   - Update Content_Gap table

2. **Question Clustering:**
   - Reuse Pinecone question embeddings
   - Update Question_Cluster_Aggregate with daily snapshots

3. **Chunk Performance Cleanup:**
   - Aggregate commonRequests and userSituations
   - Cache chunk text from Pinecone (if not already cached)

### Monthly Jobs
- **Source Performance Aggregation:**
  - Roll up Chunk_Performance → Source_Performance
  - Calculate avgSatisfaction, confusionRate, copyRate
  - Aggregate topRequests across all chunks

---

## 10. Background Jobs & Task Queue

### MVP
- **Vercel Cron Jobs** calling Next.js API routes
  - Daily: Question clustering, content gap aggregation
  - Nightly: Message analysis, chunk performance updates
  - Monthly: Source performance rollups
  - Continuous: File ingestion status checks

### Future Upgrades
Consider upgrading to:
- **Vercel Fluid Compute** (long-running tasks)
- **Inngest** (durable execution, retries)
- **Trigger.dev** (developer-friendly job orchestration)

For:
- Large file ingestion (100+ page PDFs)
- Batch sentiment analysis
- Complex clustering jobs at scale

---

## 11. Observability & Monitoring

### Error & Performance Monitoring
- **Sentry**
  - Frontend errors (React, React Native)
  - Backend errors (API routes, background jobs)
  - Performance traces
  - Custom context for creator/chatbot debugging

### LLM & AI Monitoring
Choose one:
- **Vercel AI Gateway** → Request logging, caching, routing
  OR
- **Helicone** → Deep usage analytics, cost tracking

Track:
- Token usage per conversation (for revenue attribution)
- Latency per RAG query
- Chunk retrieval quality
- Sentiment analysis accuracy

### Dashboard Analytics
- **Custom built-in metrics:**
  - Chunk performance queries (real-time)
  - Content gap prioritization
  - Format preference aggregations
  - Question volume trends
- Stored directly in Neon Postgres for fast access

### Optional Evaluations
- **Braintrust** for:
  - A/B testing prompts
  - Comparing RAG strategies
  - Evaluating sentiment analysis accuracy

---

## 12. Creator Dashboard Features

### Key Views Powered by Tech Stack

**1. Content Performance (Main View):**
- **Underperforming Chunks:**
  - Query Chunk_Performance with avgSatisfaction < 3.0
  - Display cached chunkText and chunkMetadata
  - Show user feedback: needsScriptsCount, commonRequests
  - Drill into actual conversations
- **Top Performing Chunks:**
  - Query Chunk_Performance with avgSatisfaction >= 4.0
  - Sort by copyToUseNowCount (behavioral signal)
  - Show why it works (helpfulReasons)
- **Format Preferences Widget:**
  - Aggregate needsScripts, needsExamples, needsSteps
  - Display as summary at top of page

**2. Content Roadmap:**
- **Content Gaps:**
  - Query Content_Gap ordered by requestCount
  - Show representative question, format preferences
  - Display actual user contexts (situations)
  - Lifecycle: open → planned → created
- **Question Volume:**
  - Query Question_Cluster_Aggregate for trends
  - Show what's popular (even if well-answered)

**3. Source Performance (Navigation):**
- Aggregate view from Source_Performance
- Drill down: Source → Chunks
- Shows which books/courses need work

**4. Revenue Dashboard:**
- Revenue_per_Conversation breakdown
- Source-level revenue attribution
- Creator_Revenue_Summary monthly view

---

## 13. Feedback Collection UI

### In-Chat Feedback
- **Thumbs up/down buttons** on every AI message
- **"Need more" button (💡)** opens modal:
  - Checkboxes: Scripts, Examples, Steps, Case Studies
  - Free text: "What's your specific situation?"
- **Copy button** with optional feedback:
  - Toast: "Copied! Quick question?" (optional)
  - Modal: "What will you use this for?"
    - Radio: Reference / Use now / Share team / Adapt
    - If "Adapt": "What's your situation?" (free text)

### End-of-Conversation Survey
- Shown after 5 min inactivity or on chat close
- 3 questions (30 seconds):
  1. What were you trying to accomplish?
  2. Did you get what you needed? (Yes/Partially/No)
  3. What's still missing? (if Partially/No)
- Incentive: "Get 10 bonus questions for feedback"

### Mobile-Optimized
- Simplified feedback buttons
- Swipe gestures for thumbs up/down
- Bottom sheet modals for feedback forms

---

## Final Tech Stack Snapshot

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14+, React Native, Vercel AI SDK, Tailwind, shadcn/ui, Recharts | Creator dashboard, audience chat, mobile app |
| **Backend** | Next.js API routes, TypeScript, serverless functions | Chat, RAG, feedback collection, analytics |
| **Database** | Neon Postgres + Prisma | Creator intelligence schema (6 new tables) |
| **Auth** | Clerk | Multi-tenant identity |
| **Storage** | Vercel Blob | Source files, PDFs, transcripts |
| **Vector DB** | Pinecone | Content embeddings, question embeddings |
| **LLMs** | OpenAI (GPT-4o, GPT-4o-mini, embeddings) | Chat, sentiment analysis, embeddings |
| **Payments** | Stripe Billing | Subscriptions, pay-per-conversation, revenue attribution |
| **Jobs** | Vercel Cron → (Future: Inngest/Trigger.dev) | Ingestion, analytics aggregation, nightly jobs |
| **Monitoring** | Sentry + (Vercel AI Gateway OR Helicone) | Errors, performance, LLM usage |
| **Analytics** | Custom (Postgres queries) + Recharts | Chunk performance, content gaps, dashboards |

---

## Key Technical Decisions

### Why Chunk-Level Tracking?
- **Actionable granularity:** "Fix Chapter 7, pg 89" vs. "Your book is mediocre"
- **Behavioral attribution:** User sentiment → specific paragraphs
- **Scalable:** Cache text from Pinecone on first use

### Why Separate Intelligence Tables?
- **Message table stays fast:** Hot path for real-time chat
- **Analytics isolated:** Chunk_Performance, Content_Gap don't slow conversations
- **Async processing:** Message_Analysis runs after response sent

### Why Simplified Content_Gap?
- **No LLM topic extraction:** Use actual user questions as "topics"
- **Simple clustering:** Just embedding similarity, no semantic ontology
- **Lifecycle tracking:** open → planned → created (actionable workflow)

### Why Keep Question_Cluster_Aggregate?
- **Different purpose:** Shows ALL questions (demand landscape)
- **Content_Gap:** Shows ONLY unmet needs (creation roadmap)
- **Together:** Complete picture of what's asked vs. what's missing

---

## Scaling Considerations

### Current (MVP):
- Vercel serverless functions
- Neon Postgres (generous free tier)
- Pinecone (starter plan)
- Vercel Cron for jobs

### At 100+ Creators:
- Upgrade Neon to paid tier (connection pooling)
- Move heavy jobs to Inngest/Trigger.dev
- Consider Vercel Fluid Compute for large ingestions
- Add Redis for caching (dashboard queries)

### At 1,000+ Creators:
- Multi-region Pinecone deployment
- Read replicas for Neon (analytics queries)
- CDN for cached chunk text
- Dedicated job workers (not cron)