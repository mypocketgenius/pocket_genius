# MVP Roadmap: Pocket Genius Core Features
## Simplified Implementation Plan - Core Features Only

---

## Objective

Build a **minimal viable product** that demonstrates core Pocket Genius capabilities:
- Users can chat with creator content via RAG
- Basic feedback collection
- Simple creator dashboard showing chunk usage
- Foundation for future analytics expansion

**Timeline Estimate:** 4-5 weeks (vs 8-10 weeks for full plan)

**Success Criteria:**
- ✅ Users can chat with Art of War content
- ✅ RAG pipeline retrieves relevant chunks
- ✅ Basic feedback (thumbs up/down) works
- ✅ Creator dashboard shows which chunks are used most
- ✅ System is stable and deployable

---

## What's IN MVP

### Core Features
1. **Chat Interface** - Users can ask questions, get RAG-powered answers
2. **RAG Pipeline** - File upload → chunking → embeddings → Pinecone → retrieval
3. **Basic Feedback** - Thumbs up/down buttons on AI messages
4. **Chunk Tracking** - Store which chunks were used in each message
5. **Simple Dashboard** - Show chunk usage counts and basic stats
6. **Authentication** - Clerk integration for creators and users
7. **File Upload** - PDF upload and basic ingestion

### Database Tables (Minimal Set)
- User, Creator, Chatbot, Source, File (core entities)
- Conversation, Message (chat functionality)
- Message_Feedback (thumbs up/down only)
- Chunk_Performance (basic counters: timesUsed, helpfulCount, notHelpfulCount)

---

## What's OUT of MVP (Defer to Later)

### Advanced Analytics
- ❌ Sentiment analysis (Message_Analysis table)
- ❌ Content gap aggregation (Content_Gap table)
- ❌ Question clustering (Question_Cluster_Aggregate)
- ❌ Source performance rollups
- ❌ Complex attribution jobs

### Advanced Feedback
- ❌ "Need more" modal with checkboxes
- ❌ Copy button with usage tracking
- ❌ End-of-conversation survey
- ❌ Copy-to-clipboard behavioral signals

### Additional Platforms
- ❌ React Native mobile app
- ❌ Embeddable widget (iframe)

### Advanced Features
- ❌ Stripe payments integration
- ❌ Revenue attribution
- ❌ Multi-user creator workspaces
- ❌ Advanced dashboard visualizations

---

## MVP Phase Breakdown

### Phase 1: Foundation (Week 1)
**Goal:** Get project running with database and auth

**Tasks:**
1. ✅ Next.js project setup with TypeScript DONE
2. ✅ Install core dependencies (Prisma, Clerk, OpenAI, Pinecone, Vercel Blob)
3. ✅ Install `zod` for environment variable validation: `npm install zod`
4. ✅ Set up Neon Postgres database
   - **Note:** The `lib/prisma.ts` file reads `DATABASE_URL` directly from `process.env` instead of using `env.DATABASE_URL` from `lib/env.ts`. This is intentional and still accurate:
     - **Why:** Prisma Client automatically reads `DATABASE_URL` from `process.env`, so we don't need to pass it explicitly. More importantly, this allows database operations (migrations, seeds, queries) to work independently even if other env vars (Clerk, OpenAI, etc.) aren't configured yet.
     - **Trade-off:** Using `env.DATABASE_URL` would require ALL env vars to be validated at import time, which would prevent the app from starting if any service isn't configured. The current approach is production-ready and doesn't need to be changed.
     - **Best practice:** Use `env` from `lib/env.ts` for all other services (OpenAI, Pinecone, Clerk, etc.) that need type-safe access. Keep `lib/prisma.ts` reading directly from `process.env` for flexibility.
5. ✅ Create **simplified Prisma schema** (only MVP tables)
6. ✅ Create Prisma Client singleton (`lib/prisma.ts`)
7. ✅ **Create type-safe environment variables** (`lib/env.ts`)
8. ✅ Configure Clerk authentication
9. ✅ Set up environment variables in `.env.local`
10. ✅ Basic folder structure
11. ✅ Create seed script with test user

**Prisma 7 Adapter Configuration (Task 11 - Issue & Solution):**

**Problem:** When running the seed script via `tsx`, Prisma Client threw error: "Using engine type 'client' requires either 'adapter' or 'accelerateUrl'". This is because Prisma 7 changed how database connections work - it no longer reads `DATABASE_URL` directly from the schema file and requires an adapter for all database connections.

**Root Cause:**
- Prisma 7 removed `url` field from `datasource` block in `schema.prisma`
- Prisma Client now requires an adapter (e.g., `@prisma/adapter-pg`) or `accelerateUrl` for Accelerate
- The `datasource.url` must be configured in `prisma.config.ts` instead

**Solution Applied:**
1. **Updated `prisma.config.ts`** - Added `datasource.url` configuration:
   ```typescript
   import 'dotenv/config';
   import { defineConfig, env } from 'prisma/config';
   
   export default defineConfig({
     schema: 'prisma/schema.prisma',
     datasource: {
       url: env('DATABASE_URL'), // Required in Prisma 7
     },
     // ... rest of config
   });
   ```

2. **Installed adapter packages:**
   ```bash
   npm install @prisma/adapter-pg pg
   ```

3. **Updated `lib/prisma.ts`** - Configured PrismaClient with PostgreSQL adapter:
   ```typescript
   import { PrismaClient } from '@prisma/client';
   import { PrismaPg } from '@prisma/adapter-pg';
   
   const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
   export const prisma = new PrismaClient({ adapter });
   ```

4. **Enhanced `prisma/seed.ts`** - Added explicit dotenv loading before importing Prisma:
   ```typescript
   import dotenv from 'dotenv';
   import path from 'path';
   
   // Load .env.local before importing Prisma
   dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
   ```

**Key Takeaways:**
- Prisma 7 requires adapters for all database connections (no more direct `DATABASE_URL` reading)
- `datasource.url` must be in `prisma.config.ts`, not `schema.prisma`
- Always load environment variables before importing PrismaClient in standalone scripts
- The adapter pattern provides better connection pooling and performance

**Deliverables:**
- ✅ Project runs locally
- ✅ Database connected
- ✅ Prisma Client singleton created
- ✅ Type-safe environment variables configured
- ✅ Auth working (login/logout)
- ✅ Test user created in seed data

**Type-Safe Environment Variables (`lib/env.ts`):**
```typescript
// lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  OPENAI_API_KEY: z.string().min(1),
  PINECONE_API_KEY: z.string().min(1),
  PINECONE_INDEX: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SECRET: z.string().min(1).optional(),
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
  NEXT_PUBLIC_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);

// Usage:
// import { env } from '@/lib/env';
// const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
```

**Why this matters:**
- Catches missing env vars at build time (not runtime)
- Provides TypeScript autocomplete
- Self-documenting (schema shows what's required)
- Prevents "undefined" errors in production

**Environment Variables Setup (`.env.local`):**
```env
# Database
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/pocket-genius?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-xxx.neon.tech/pocket-genius?sslmode=require"

# App URL
NEXT_PUBLIC_URL="http://localhost:3000"
NODE_ENV=development

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx

# OpenAI
OPENAI_API_KEY=sk-xxxxx

# Pinecone
PINECONE_API_KEY=xxxxx
PINECONE_INDEX=pocket-genius-prod

# Vercel Blob
BLOB_READ_WRITE_TOKEN=xxxxx
```

**Note on Clerk Webhook Setup:**
- Seed script creates test user with `clerkId: 'user_test_development'` for local testing only
- For production: Create real user via Clerk UI first, then manually link to creator
- OR skip test user in seed, create real user first via Clerk dashboard

**Simplified Schema:**
```prisma
// Core tables only
model User { 
  id String @id @default(cuid())
  clerkId String @unique
  email String
  username String?
  firstName String?
  lastName String?
  createdAt DateTime @default(now())
}

model Creator { 
  id String @id @default(cuid())
  name String
  createdAt DateTime @default(now())
  // ... relations
}

model Creator_User {
  id String @id @default(cuid())
  creatorId String
  userId String
  role String @default("OWNER") // 'OWNER' | 'ADMIN' | 'MEMBER'
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([creatorId, userId])
  @@index([creatorId])
  @@index([userId])
}

model Chatbot { 
  id String @id @default(cuid())
  title String
  creatorId String
  createdAt DateTime @default(now())
  // ... relations
}

model Source { 
  id String @id @default(cuid())
  title String
  creatorId String
  chatbotId String
  createdAt DateTime @default(now())
  // ... relations
}

model File { 
  id String @id @default(cuid())
  sourceId String
  creatorId String
  fileName String
  fileUrl String
  fileSize Int
  status String @default("PENDING") // 'PENDING' | 'PROCESSING' | 'READY' | 'ERROR'
  createdAt DateTime @default(now())
  
  @@index([sourceId])
  @@index([creatorId])
}

model Conversation { 
  id String @id @default(cuid())
  chatbotId String
  userId String?
  status String @default("active") // 'active' | 'completed'
  messageCount Int @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([chatbotId, status])
  @@index([userId])
}

model Message { 
  id String @id @default(cuid())
  conversationId String
  userId String?
  role String // 'user' | 'assistant'
  content String
  context Json? // { chunks: [{ chunkId, sourceId, text, page?, section? }] }
  sourceIds String[] @default([]) // Extracted from context.chunks for easier querying
  createdAt DateTime @default(now())
  
  @@index([conversationId])
  @@index([sourceIds])
  @@index([userId])
}

model Message_Feedback {
  id String @id @default(cuid())
  messageId String
  userId String?
  feedbackType String // 'helpful' | 'not_helpful'
  createdAt DateTime @default(now())
  
  @@index([messageId])
  @@index([userId])
}

model Chunk_Performance {
  id String @id @default(cuid())
  chunkId String
  sourceId String
  chatbotId String
  
  // Counters
  timesUsed Int @default(0)
  helpfulCount Int @default(0)
  notHelpfulCount Int @default(0)
  
  // Computed satisfaction rate (updated on each feedback)
  satisfactionRate Float @default(0)
  
  // Cached chunk text for dashboard display (populated on first use from Pinecone)
  chunkText String?
  chunkMetadata Json? // { page, section, sourceTitle }
  
  // Time period
  month Int
  year Int
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([chunkId, chatbotId, month, year])
  @@index([chatbotId, month, year, satisfactionRate])
  @@index([chatbotId, month, year, timesUsed])
  @@index([sourceId])
}
```

**Seed Script Example:**
```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create test user (for development)
  const testUser = await prisma.user.upsert({
    where: { clerkId: 'user_test_development' },
    update: {},
    create: {
      clerkId: 'user_test_development',
      email: 'test@pocketgenius.ai',
      username: 'testuser',
    },
  });
  
  // Create creator
  const creator = await prisma.creator.create({
    data: {
      name: 'Sun Tzu',
      users: {
        create: {
          userId: testUser.id,
          role: 'OWNER',
        },
      },
    },
  });
  
  // Create chatbot
  const chatbot = await prisma.chatbot.create({
    data: {
      title: 'Art of War Deep Dive',
      creatorId: creator.id,
    },
  });
  
  // Create source
  await prisma.source.create({
    data: {
      title: 'The Art of War',
      creatorId: creator.id,
      chatbotId: chatbot.id,
    },
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

### Phase 2: RAG Pipeline (Week 2)
**Goal:** Upload Art of War plain text file and make it searchable

**Tasks:**
1. ✅ File upload API route (POST /api/files/upload)
2. ✅ **File validation** (size limit, type check)
   - Max file size: 50MB
   - Allowed types: Plain text UTF-8 only (`text/plain`)
   - Return clear error messages
3. ✅ Store file in Vercel Blob
4. ✅ Text extraction (read file as UTF-8 string - no parsing needed)
5. ✅ Text chunking (simple strategy: preserve paragraphs)
6. ✅ Generate embeddings (OpenAI text-embedding-3-small)
7. ✅ **Upsert to Pinecone with retry logic** (3 retries with exponential backoff)
8. ✅ Update File status (PENDING → PROCESSING → READY)
9. ✅ Basic error handling

**Deliverables:**
- ✅ Can upload plain text UTF-8 files
- ✅ Content chunked and stored in Pinecone
- ✅ File status tracked in database

**File Upload Validation:**
```typescript
// app/api/files/upload/route.ts
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ['text/plain'];

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  
  // Validation
  if (file.size > MAX_FILE_SIZE) {
    return Response.json(
      { error: 'File too large (max 50MB)' }, 
      { status: 400 }
    );
  }
  
  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json(
      { error: 'Only plain text UTF-8 files supported' }, 
      { status: 400 }
    );
  }
  
  // ... rest of upload logic
}
```

**Text Extraction (Simple):**
```typescript
// lib/extraction/text.ts
export async function extractTextFromPlainText(file: File): Promise<string> {
  const text = await file.text(); // Reads as UTF-8 by default
  return text;
}
```

**Pinecone Retry Logic:**
```typescript
// lib/pinecone/upsert-with-retry.ts
import { env } from '@/lib/env';

async function upsertWithRetry(
  vectors: Vector[],
  chatbotId: string,
  maxRetries = 3
): Promise<void> {
  // Use explicit namespace convention to prevent collisions
  const namespace = `chatbot-${chatbotId}`; // e.g., "chatbot-art-of-war"
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pinecone.index(env.PINECONE_INDEX).namespace(namespace).upsert(vectors);
      return;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

**Note on Pinecone Namespace Convention:**
- Using `chatbot-${chatbotId}` prevents collision if you later add other namespaces
- Example: `chatbot-art-of-war` vs `questions-art-of-war` (for future question clustering)
- Current approach (`namespace: chatbotId`) works fine for MVP, but explicit prefix is safer

**Simplified Chunking:**
```typescript
// Simple paragraph-based chunking
function chunkText(text: string, maxChunkSize: number = 1000): Chunk[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: Chunk[] = [];
  let currentChunk = '';
  let page = 1;
  
  for (const para of paragraphs) {
    if (currentChunk.length + para.length > maxChunkSize && currentChunk) {
      chunks.push({ text: currentChunk, page });
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }
  if (currentChunk) chunks.push({ text: currentChunk, page });
  return chunks;
}
```

---

### Phase 3: Chat Interface (Week 2-3)
**Goal:** Users can chat and get RAG-powered responses

**Tasks:**
1. ✅ Chat API route (POST /api/chat)
   - Generate query embedding
   - Query Pinecone (top 5 chunks)
   - Store chunks in Message.context
   - **Extract and store sourceIds array** (for easier querying)
   - Generate response with OpenAI GPT-4o
   - Stream response to client
   - **Update conversation.messageCount**
2. ✅ **Rate limiting** (10 messages per minute per authenticated user - anonymous users not rate limited for MVP)
3. ✅ Chat UI component
   - Message list
   - Input field
   - Streaming display
4. ✅ Conversation management
   - Create conversation on first message
   - Link messages to conversation
   - Update conversation status and messageCount
5. ✅ Basic error handling

**Deliverables:**
- ✅ Users can ask questions
- ✅ Bot responds with relevant content
- ✅ Responses stream in real-time
- ✅ Chunks tracked in Message.context

**Simplified Chat Route:**
```typescript
// app/api/chat/route.ts
export async function POST(req: Request) {
  const { message, conversationId, chatbotId } = await req.json();
  
  // 1. Generate embedding
  const embedding = await generateEmbedding(message);
  
  // 2. Query Pinecone
  const results = await pinecone.query({
    vector: embedding,
    topK: 5,
    namespace: chatbotId,
  });
  
  // 3. Store message with chunks
  const userMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'user',
      content: message,
    },
  });
  
  // 4. Generate response
  const chunks = results.matches.map(m => ({
    chunkId: m.id,
    text: m.metadata.text,
    sourceId: m.metadata.sourceId,
    page: m.metadata.page,
    section: m.metadata.section,
  }));
  
  // Extract unique sourceIds for easier querying
  const sourceIds = [...new Set(chunks.map(c => c.sourceId))];
  
  const response = await generateResponse(message, chunks);
  
  // 5. Store assistant message with context and sourceIds
  await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: response,
      context: { chunks },
      sourceIds, // Store for easier querying
    },
  });
  
  // 6. Update conversation messageCount
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { messageCount: { increment: 2 } }, // User + assistant
  });
  
  // 7. Update chunk performance (basic counter)
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  
  for (const chunk of chunks) {
    await prisma.chunk_Performance.upsert({
      where: {
        chunkId_chatbotId_month_year: {
          chunkId: chunk.chunkId,
          chatbotId,
          month,
          year,
        },
      },
      create: {
        chunkId: chunk.chunkId,
        sourceId: chunk.sourceId,
        chatbotId,
        timesUsed: 1,
        month,
        year,
      },
      update: {
        timesUsed: { increment: 1 },
      },
    });
  }
  
  return Response.json({ response });
}
```

---

### Phase 4: Basic Feedback (Week 3)
**Goal:** Users can give thumbs up/down feedback

**Tasks:**
1. ✅ Feedback API route (POST /api/feedback/message)
2. ✅ Thumbs up/down buttons in chat UI
3. ✅ Update Chunk_Performance counters
   - helpfulCount +1 for thumbs up
   - notHelpfulCount +1 for thumbs down
4. ✅ Visual feedback (button state, toast)

**Deliverables:**
- ✅ Thumbs up/down buttons work
- ✅ Feedback stored in Message_Feedback
- ✅ Chunk_Performance counters update

**Note on Duplicate Feedback Prevention:**
- The current schema does not have a unique constraint on `[messageId, userId]` in the `Message_Feedback` table
- This means users can submit multiple feedbacks for the same message, which could skew counters
- For MVP, this is acceptable, but consider adding duplicate prevention in post-MVP:
  - Option 1: Add unique constraint `@@unique([messageId, userId])` to schema (requires migration)
  - Option 2: Check for existing feedback before creating (adds query overhead)
  - Option 3: Handle in UI by disabling buttons after feedback is submitted

**Simplified Feedback:**
```typescript
// app/api/feedback/message/route.ts
export async function POST(req: Request) {
  const { messageId, feedbackType } = await req.json();
  
  // Store feedback
  await prisma.message_Feedback.create({
    data: {
      messageId,
      feedbackType, // 'helpful' | 'not_helpful'
    },
  });
  
  // Get message and its chunks
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { conversation: true },
  });
  
  if (!message?.context) return Response.json({ success: true });
  
  const chunks = (message.context as any).chunks || [];
  const chatbotId = message.conversation.chatbotId;
  
  // Update chunk performance with satisfactionRate computation
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  
  for (const chunk of chunks) {
    // Get current performance record
    const current = await prisma.chunk_Performance.findUnique({
      where: {
        chunkId_chatbotId_month_year: {
          chunkId: chunk.chunkId,
          chatbotId,
          month,
          year,
        },
      },
    });
    
    if (!current) continue;
    
    // Calculate new counts
    const newHelpfulCount = feedbackType === 'helpful' 
      ? current.helpfulCount + 1 
      : current.helpfulCount;
    const newNotHelpfulCount = feedbackType === 'not_helpful'
      ? current.notHelpfulCount + 1
      : current.notHelpfulCount;
    
    // Compute satisfaction rate
    const totalFeedback = newHelpfulCount + newNotHelpfulCount;
    const satisfactionRate = totalFeedback > 0 
      ? newHelpfulCount / totalFeedback 
      : 0;
    
    // Update with computed satisfactionRate
    await prisma.chunk_Performance.update({
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
  }
  
  return Response.json({ success: true });
}
```

---

### Phase 5: Simple Dashboard (Week 4)
**Goal:** Creators can see which chunks are used most

**Tasks:**
1. ✅ Dashboard page (app/dashboard/[chatbotId]/page.tsx)
2. ✅ Chunk usage list component
   - Show chunks sorted by timesUsed or satisfactionRate
   - Display chunk text (use cached chunkText, fetch from Pinecone if missing)
   - Show helpfulCount vs notHelpfulCount
   - Display satisfactionRate (pre-computed)
   - **Pagination** (20 per page, infinite scroll)
3. ✅ Basic authentication check (creator owns chatbot)
4. ✅ Simple UI with shadcn/ui components
5. ✅ **Cache chunk text on first dashboard view** (populate chunkText from Pinecone)

**Deliverables:**
- ✅ Dashboard shows chunk usage
- ✅ Creators can see which content is popular
- ✅ Basic satisfaction metrics visible

**Simplified Dashboard Query:**
```typescript
// Get top chunks by usage (with pagination)
const page = parseInt(searchParams.page || '1');
const pageSize = 20;
const skip = (page - 1) * pageSize;

const topChunks = await prisma.chunk_Performance.findMany({
  where: {
    chatbotId,
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    timesUsed: { gte: 5 }, // Only show chunks used 5+ times
  },
  orderBy: { timesUsed: 'desc' },
  skip,
  take: pageSize,
});

// Fetch chunk text from Pinecone if not cached
for (const chunk of topChunks) {
  if (!chunk.chunkText) {
    const pineconeData = await fetchFromPinecone(chunk.chunkId);
    await prisma.chunk_Performance.update({
      where: { id: chunk.id },
      data: {
        chunkText: pineconeData.text,
        chunkMetadata: {
          page: pineconeData.page,
          section: pineconeData.section,
        },
      },
    });
    chunk.chunkText = pineconeData.text;
  }
}

// satisfactionRate is already computed, no need to calculate
```

**Rate Limiting Implementation:**
```typescript
// lib/rate-limit.ts
import { prisma } from './prisma';

const RATE_LIMIT = 10; // messages per minute
const WINDOW_MS = 60 * 1000; // 1 minute

export async function checkRateLimit(userId: string): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - WINDOW_MS);
  
  const recentMessages = await prisma.message.count({
    where: {
      conversation: { userId },
      role: 'user',
      createdAt: { gte: oneMinuteAgo },
    },
  });
  
  return recentMessages < RATE_LIMIT;
}
```

**Note on Rate Limiting:**
- **For MVP:** This Prisma-based approach works fine
- **Anonymous users:** Not rate limited for now (MVP only applies rate limiting to authenticated users)
- **Post-MVP optimization:** Consider Redis/Upstash for better performance at scale:
  ```typescript
  // Future: Use Upstash Redis for rate limiting
  import { Ratelimit } from '@upstash/ratelimit';
  import { Redis } from '@upstash/redis';
  
  const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '1 m'),
  });
  
  const { success } = await ratelimit.limit(userId);
  if (!success) return Response.json({ error: 'Rate limited' }, { status: 429 });
  ```
- **Current approach:** Database query is acceptable for MVP traffic levels

---

### Phase 6: Testing & Deployment (Week 4-5)
**Goal:** System is stable and deployable

**Tasks:**
1. ✅ Write unit tests (see MVP Testing Strategy section)
   - Critical utilities (chunking, weighting)
   - ~4-6 hours
2. ✅ Write integration tests
   - Chat API (happy path + errors)
   - Feedback API (counter updates)
   - ~4-6 hours
3. ✅ Manual testing checklist
   - Complete all items in testing section
   - ~2 hours
4. ✅ Error handling review
   - Invalid file types
   - Pinecone failures
   - OpenAI API errors
   - Database connection issues
5. ✅ Deploy to Vercel
   - Production database
   - Environment variables
   - Basic monitoring (Sentry)
6. ✅ **Set up Vercel monitoring**
   - View logs in Vercel dashboard
   - Track error rates
   - Monitor API response times
7. ✅ Documentation
   - README with setup instructions
   - Basic API documentation

**Deliverables:**
- ✅ System deployed and stable
- ✅ Basic monitoring in place
- ✅ Documentation complete

---

## MVP Testing Strategy (Simplified)

### Overview

MVP testing focuses on **critical paths only** - ensuring core functionality works reliably. Skip advanced testing (E2E automation, performance benchmarks) until post-MVP.

### Testing Philosophy for MVP

- **Test what breaks** - Focus on error-prone areas (RAG retrieval, database updates)
- **Manual testing first** - Validate user experience before automating
- **Mock external services** - Don't hit real APIs in tests
- **Fast feedback** - Quick unit tests catch bugs early

---

### 1. Unit Tests (Essential Only)

**Tools:** Jest + TypeScript

**What to Test:**

#### 1.1 Critical Utilities

**`lib/rag/chunking.ts`** - Text chunking logic
```typescript
describe('chunkText', () => {
  it('should split text into chunks', () => {
    const text = 'Para 1\n\nPara 2';
    const chunks = chunkText(text, 100);
    expect(chunks.length).toBeGreaterThan(0);
  });
  
  it('should handle empty text', () => {
    expect(chunkText('')).toEqual([]);
  });
});
```

**`lib/attribution/position-weighting.ts`** - Chunk weight calculation
```typescript
describe('calculateChunkWeights', () => {
  it('should weight first chunk highest', () => {
    const chunks = [{ chunkId: '1' }, { chunkId: '2' }];
    const weights = calculateChunkWeights(chunks);
    expect(weights[0]).toBeGreaterThan(weights[1]);
  });
});
```

**Coverage Target:** 60%+ for utility functions

---

### 2. Integration Tests (Core APIs Only)

**Tools:** Jest + Supertest + MSW (for mocking)

**What to Test:**

#### 2.1 Chat API (Critical Path)

**`app/api/chat/route.test.ts`:**
```typescript
import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { pinecone } from '@/lib/pinecone';

jest.mock('@/lib/prisma');
jest.mock('@/lib/pinecone');

describe('POST /api/chat', () => {
  it('should create conversation and messages', async () => {
    // Mock Pinecone
    (pinecone.query as jest.Mock).mockResolvedValue({
      matches: [{ id: 'chunk-1', metadata: { text: 'Test', sourceId: 'src-1' } }],
    });
    
    // Mock Prisma
    (prisma.conversation.create as jest.Mock).mockResolvedValue({ id: 'conv-1' });
    (prisma.message.create as jest.Mock).mockResolvedValue({ id: 'msg-1' });
    
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Test', chatbotId: 'bot-123' }),
    });
    
    const response = await POST(request);
    expect(response.status).toBe(200);
  });
  
  it('should handle Pinecone errors', async () => {
    (pinecone.query as jest.Mock).mockRejectedValue(new Error('Pinecone error'));
    
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Test', chatbotId: 'bot-123' }),
    });
    
    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
```

#### 2.2 Feedback API

**`app/api/feedback/message/route.test.ts`:**
```typescript
describe('POST /api/feedback/message', () => {
  it('should update chunk performance', async () => {
    (prisma.message.findUnique as jest.Mock).mockResolvedValue({
      id: 'msg-1',
      context: { chunks: [{ chunkId: 'chunk-1', sourceId: 'src-1' }] },
      conversation: { chatbotId: 'bot-123' },
    });
    
    const request = new Request('http://localhost/api/feedback/message', {
      method: 'POST',
      body: JSON.stringify({ messageId: 'msg-1', feedbackType: 'helpful' }),
    });
    
    await POST(request);
    expect(prisma.chunk_Performance.updateMany).toHaveBeenCalled();
  });
});
```

**Coverage Target:** Chat API + Feedback API only (skip file upload for MVP)

---

### 3. Manual Testing Checklist (MVP Focus)

**Test before each deployment:**

#### Core Chat Flow
- [ ] Can send message and receive response YES
- [ ] Response is relevant to question YES
- [ ] Can have multi-turn conversation YES
- [ ] Error messages are user-friendly YES

#### Feedback Collection
- [ ] Thumbs up button works YES
- [ ] Thumbs down button works YES
- [ ] Feedback persists after refresh YES (Fixed: API now includes feedback data, component loads feedback state on mount) 

#### File Upload (Basic)
- [ ] Can upload TXT YES
- [ ] File status updates (Pending → Processing → Ready) YEA
- [ ] Error shown for invalid file types MD files work... cant even upload weird file types

#### Dashboard (Basic)
- [ ] Dashboard loads without errors YES
- [ ] Chunk usage list displays YES
- [ ] Can see chunk text and usage counts YES

#### Error Handling
- [ ] Network errors show user-friendly message
- [ ] Invalid input shows validation error
- [ ] Database errors don't crash app

---

### 4. Test Setup (Minimal)

**Install dependencies:**
```bash
npm install -D jest @types/jest ts-jest supertest @types/supertest
npm install -D msw  # For mocking external APIs
```

**`jest.config.js`:**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
```

**`package.json` scripts:**
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

---

### 5. What to Skip in MVP

**Defer to post-MVP:**
- ❌ E2E tests with Playwright/Cypress
- ❌ Performance/load testing (k6)
- ❌ Component tests (React Testing Library)
- ❌ Visual regression tests
- ❌ CI/CD automated test runs
- ❌ Test coverage reports

**Why skip:**
- MVP goal is to validate core concept works
- Manual testing is faster for MVP scope
- Can add automation after proving value

---

### 6. Testing Workflow for MVP

**During Development:**
1. Write unit tests for critical utilities (chunking, weighting)
2. Write integration tests for chat + feedback APIs
3. Run tests before committing: `npm test`

**Before Deployment:**
1. Run full test suite: `npm test`
2. Complete manual testing checklist
3. Test on staging environment
4. Deploy to production

**Post-Deployment:**
1. Monitor Sentry for errors
2. Check logs for failed requests
3. Fix critical bugs immediately
4. Add tests for bugs found in production

---

### 7. MVP Testing Summary

**What we test:**
- ✅ Critical utility functions (chunking, weighting)
- ✅ Chat API (happy path + error handling)
- ✅ Feedback API (counter updates)
- ✅ Manual testing checklist

**What we skip:**
- ❌ E2E automation
- ❌ Performance benchmarks
- ❌ Component tests
- ❌ CI/CD test automation

**Coverage Goals:**
- Unit tests: 60%+ for utilities
- Integration tests: Chat + Feedback APIs only
- Manual testing: All critical user flows

**Time Investment:**
- ~4-6 hours for unit tests
- ~4-6 hours for integration tests
- ~2 hours for manual testing checklist
- **Total: ~10-14 hours** (vs 40+ hours for full test suite)

---

## MVP Database Schema (Simplified)

**Only these tables needed:**

1. **User** - Clerk user sync
2. **Creator** - Creator accounts
3. **Chatbot** - Bot instances
4. **Source** - Content sources (books, courses)
5. **File** - Uploaded files
6. **Conversation** - Chat sessions
7. **Message** - Individual messages (with context.chunks)
8. **Message_Feedback** - Thumbs up/down only
9. **Chunk_Performance** - Basic counters (timesUsed, helpfulCount, notHelpfulCount)

**Tables to skip for MVP:**
- Message_Analysis (sentiment)
- Content_Gap
- Question_Cluster_Aggregate
- Conversation_Feedback (end survey)
- Source_Performance
- Revenue tables
- Purchase tables

---

## MVP vs Full Plan Comparison

| Feature | MVP | Full Plan |
|---------|-----|-----------|
| **Chat** | ✅ Basic RAG | ✅ Advanced RAG + streaming |
| **Feedback** | ✅ Thumbs up/down | ✅ Thumbs + need more + copy + survey |
| **Analytics** | ✅ Usage counts | ✅ Sentiment + gaps + clustering |
| **Dashboard** | ✅ Chunk usage list | ✅ Performance + gaps + trends |
| **Mobile** | ❌ Web only | ✅ React Native app |
| **Widget** | ❌ Not included | ✅ Embeddable iframe |
| **Payments** | ❌ Not included | ✅ Stripe integration |
| **Jobs** | ❌ No background jobs | ✅ Sentiment + aggregation jobs |

---

## Success Metrics for MVP

**Functional:**
- ✅ Users can upload PDF and chat within 5 minutes
- ✅ Chat responses are relevant (manual review)
- ✅ Feedback buttons work reliably
- ✅ Dashboard loads and shows data

**Performance:**
- ✅ Chat response time < 3 seconds
- ✅ Dashboard load time < 2 seconds
- ✅ No critical errors in production

**Stability:**
- ✅ System handles 100+ concurrent users
- ✅ Error rate < 1%
- ✅ Database queries optimized

---

## Post-MVP Expansion Path

**Phase 6+ (Weeks 5-8):**
1. Add sentiment analysis job
2. Add "need more" feedback modal
3. Add content gap aggregation
4. Enhance dashboard with visualizations
5. Add React Native mobile app
6. Add embeddable widget

**Phase 7+ (Weeks 9-10):**
1. Add Stripe payments
2. Add advanced analytics
3. Add question clustering
4. Add source performance rollups
5. Polish and optimization

---

## Critical Path for MVP

**Must-have before moving to next phase:**

**Before Phase 1 (Foundation):**
- [ ] Have Neon account ready
- [ ] Have Clerk account ready
- [ ] Have OpenAI API key (with credits)
- [ ] Have Pinecone account ready
- [ ] Have Vercel account ready
- [ ] Have clean Art of War PDF downloaded

**Before Phase 2 (RAG):**
- ✅ Database schema migrated
- ✅ Prisma Client generated (singleton pattern)
- ✅ Environment variables configured
- ✅ Clerk auth working locally
- ✅ Can connect to Prisma

**Before Phase 3 (Chat):**
- ✅ PDF uploaded and chunked
- ✅ Content in Pinecone (verify with dashboard)
- ✅ Can query Pinecone successfully
- ✅ Embeddings generating correctly
- ✅ File validation working

**Before Phase 4 (Feedback):**
- ✅ Chat works end-to-end
- ✅ Messages stored with chunks and sourceIds
- ✅ Can retrieve message context
- ✅ Rate limiting implemented

**Before Phase 5 (Dashboard):**
- ✅ Feedback stored correctly
- ✅ Chunk_Performance counters updating
- ✅ satisfactionRate computed correctly
- ✅ Can query chunk performance data

**Before Phase 6 (Deployment):**
- ✅ All features working locally
- ✅ Error handling in place
- ✅ Basic tests passing
- ✅ Manual test checklist complete
- ✅ No critical errors in logs

---

## Risk Mitigation

**Technical Risks:**
1. **Pinecone connection issues** → Add retry logic, fallback error messages
2. **OpenAI API rate limits** → Implement rate limiting, queue system
3. **Large PDF processing** → Add file size limits, async processing
4. **Database performance** → Add indexes, optimize queries

**Scope Risks:**
1. **Feature creep** → Stick to MVP list, defer advanced features
2. **Over-engineering** → Use simplest solution that works
3. **Timeline slip** → Focus on core chat first, dashboard can be basic

---

## Next Steps

1. ✅ Review this MVP roadmap
2. ✅ Create simplified Prisma schema (MVP tables only)
3. ✅ Start Phase 1: Foundation setup
4. ✅ Validate each phase before moving forward
5. ✅ Deploy MVP, then iterate

---

**Remember:** MVP goal is to prove the core concept works. Advanced features can wait.

---

## Go/No-Go Checklist

**Before Starting Phase 1:**

- [ ] Have Neon account ready
- [ ] Have Clerk account ready
- [ ] Have OpenAI API key (with credits)
- [ ] Have Pinecone account ready
- [ ] Have Vercel account ready
- [ ] Have clean Art of War PDF downloaded (Project Gutenberg recommended)

**Before Starting Phase 2:**

- [ ] Database schema migrated successfully
- [ ] Can connect to Prisma Client
- [ ] Clerk auth working locally
- [ ] All environment variables configured
- [ ] Test user created via seed script

**Before Starting Phase 3:**

- [ ] PDF uploaded and chunked successfully
- [ ] Content verified in Pinecone (check dashboard)
- [ ] Can query Pinecone successfully
- [ ] Embeddings generating correctly
- [ ] File validation working (size, type)

**Before Starting Phase 4:**

- [ ] Chat works end-to-end
- [ ] Messages storing with chunks and sourceIds
- [ ] Can retrieve message context from database
- [ ] Rate limiting implemented and tested

**Before Starting Phase 5:**

- [ ] Feedback storing correctly
- [ ] Chunk_Performance counters updating
- [ ] satisfactionRate computed correctly
- [ ] Can query chunk performance data
- [ ] Chunk text caching working

**Before Starting Phase 6:**

- [ ] All features working locally
- [ ] Error handling in place
- [ ] Basic tests passing
- [ ] Manual test checklist complete
- [ ] No critical errors in logs
- [ ] Performance acceptable (< 3s chat, < 2s dashboard)

---

## Risk Assessment: MVP-Specific

### Low Risk ✅

- **Chat functionality** - Proven pattern, well-documented
- **File upload** - Vercel Blob is stable and reliable
- **Feedback buttons** - Simple state management, straightforward
- **Basic dashboard** - Standard CRUD operations

### Medium Risk ⚠️

- **Pinecone retrieval quality** - Might need chunking strategy tweaks
  - **Mitigation:** Test with various question types, adjust chunk size (500-1500 chars)
  - **Fallback:** Manual review of top retrieved chunks, refine chunking strategy

- **Dashboard performance** - Could be slow with many chunks
  - **Mitigation:** Add indexes (satisfactionRate, timesUsed), implement pagination
  - **Fallback:** Limit dashboard to top 50 chunks, add loading states

- **OpenAI rate limits** - Could hit limits during testing
  - **Mitigation:** Implement retry with exponential backoff, monitor usage
  - **Fallback:** Use GPT-4o-mini for testing, upgrade to GPT-4o for production

### High Risk 🚨

- **PDF extraction quality** - Some PDFs have bad OCR/formatting
  - **Mitigation:** Start with clean PDF (Project Gutenberg Art of War), add validation
  - **Fallback:** Manual text extraction, use DOCX format as alternative

- **Chunk text caching** - Pinecone fetch failures could break dashboard
  - **Mitigation:** Cache chunk text on first use, store in database
  - **Fallback:** Show "Chunk text unavailable" message, allow manual refresh

---

## Timeline Validation

**Your 4-5 week estimate:**

| Week | Phase | Hours | Realistic? |
|------|-------|-------|------------|
| 1 | Foundation | 20-25h | ✅ Yes |
| 2 | RAG Pipeline | 25-30h | ✅ Yes |
| 2-3 | Chat Interface | 15-20h | ✅ Yes |
| 3 | Basic Feedback | 10-15h | ✅ Yes |
| 4 | Simple Dashboard | 15-20h | ✅ Yes |
| 4-5 | Testing & Deploy | 15-20h | ✅ Yes |

**Total: 100-130 hours = 4-5 weeks at 25-30 hours/week**

**This is realistic if:**
- You work full-time on this (no major distractions)
- No major blockers (Pinecone setup, Clerk config)
- PDF extraction works first try
- External services are stable

**More realistic buffer: 5-6 weeks** (accounting for unexpected issues)

**Critical path items that could delay:**
- PDF extraction issues (add 1-2 days)
- Pinecone setup/configuration (add 1 day)
- Dashboard performance optimization (add 1-2 days)
- Unexpected bugs in feedback flow (add 1-2 days)

---

## Final Schema Summary (Complete MVP)

**All tables with enhancements:**

```prisma
model Message {
  id String @id @default(cuid())
  conversationId String
  role String // 'user' | 'assistant'
  content String
  context Json? // { chunks: [{ chunkId, sourceId, text, page?, section? }] }
  sourceIds String[] @default([]) // ADDED: For easier querying
  createdAt DateTime @default(now())
  
  @@index([conversationId])
  @@index([sourceIds]) // ADDED
}

model Chunk_Performance {
  id String @id @default(cuid())
  chunkId String
  sourceId String
  chatbotId String
  
  // Counters
  timesUsed Int @default(0)
  helpfulCount Int @default(0)
  notHelpfulCount Int @default(0)
  
  // Computed (ADDED)
  satisfactionRate Float @default(0)
  
  // Cached text (ADDED)
  chunkText String?
  chunkMetadata Json? // { page, section, sourceTitle }
  
  // Time period
  month Int
  year Int
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([chunkId, chatbotId, month, year])
  @@index([chatbotId, month, year, satisfactionRate]) // ADDED
  @@index([chatbotId, month, year, timesUsed])
  @@index([sourceId])
}

model Conversation {
  id String @id @default(cuid())
  chatbotId String
  userId String?
  status String @default("active") // ADDED: 'active' | 'completed'
  messageCount Int @default(0) // ADDED
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([chatbotId, status]) // ADDED
}
```

---

## Summary of Enhancements Applied

### ✅ Schema Improvements
1. Added `sourceIds` array to Message for easier querying
2. Added `chunkText` and `chunkMetadata` caching to Chunk_Performance
3. Added `satisfactionRate` computed field with indexes
4. Added `status` and `messageCount` to Conversation

### ✅ Phase Enhancements
1. Phase 1: Added Prisma singleton and test user seed
2. Phase 2: Added file validation and Pinecone retry logic
3. Phase 3: Added rate limiting and sourceIds population
4. Phase 4: Added satisfactionRate computation
5. Phase 5: Added pagination and chunk text caching
6. Phase 6: Added Vercel monitoring

### ✅ Risk Mitigation
- File size/type validation prevents abuse
- Retry logic handles transient failures
- Rate limiting prevents API abuse
- Caching improves dashboard performance
- Indexes optimize database queries

**Recommendation:** ✅ **Proceed with confidence** - This MVP roadmap is production-ready with all critical enhancements applied.

---

## Success Metrics - Restated for Clarity

**Functional Success = MVP is "done" when:**

- ✅ User uploads PDF → within 5 min, can chat about content
- ✅ User asks question → receives relevant answer in < 3 seconds
- ✅ User clicks thumbs up/down → feedback persists, counters update
- ✅ Creator visits dashboard → sees which chunks are used most

**Performance Success:**

- ✅ Chat response: < 3 seconds end-to-end
- ✅ Dashboard load: < 2 seconds with 20 chunks displayed
- ✅ System handles 100+ concurrent users without degradation

**Stability Success:**

- ✅ Error rate < 1% over 24 hour period
- ✅ No critical errors in Sentry
- ✅ Database queries execute in < 200ms

**If you hit all these metrics, MVP is successful.**

---

## Post-MVP Expansion - When to Do It

**Don't start Phase 6+ (advanced features) until:**

- ✅ MVP deployed for 2+ weeks
- ✅ At least 50 real conversations in database
- ✅ At least 5 creators using dashboard
- ✅ Feedback from users on what's missing

**Why wait:**

- Real usage will reveal what features actually matter
- Premature optimization wastes time
- Users might want something different than you expect

**Example:** You might find users don't care about sentiment analysis, but desperately want source citations in responses. Build what users actually need, not what you think they need.

**Post-MVP Features to Consider:**

1. **Sentiment Analysis** - Only if users want to understand why feedback is negative
2. **Content Gap Aggregation** - Only if creators struggle to know what to create
3. **Question Clustering** - Only if there are patterns in user questions
4. **Mobile App** - Only if users request mobile access
5. **Embeddable Widget** - Only if creators want to embed on their sites
6. **Stripe Payments** - Only if you have paying customers ready

**Build what users actually need, not what you think they need.**

