# Implementation Code for Creator Intelligence System

## 2. Message.context JSON Structure

```typescript
// Structure for Message.context field (AI messages only)
interface MessageContext {
  // Chunks used to generate this response (SOURCE OF TRUTH for analytics)
  chunks: Array<{
    chunkId: string;        // Pinecone vector ID
    sourceId: string;       // Reference to Source table
    text: string;           // Actual content text
    tokenCount: number;     // Tokens used from this chunk
    page?: number;          // Page number in source
    section?: string;       // Section/chapter name
    relevanceScore: number; // RAG relevance score (0-1)
  }>;
  
  // User-specific context that informed the response
  userContext?: {
    industry?: string;
    role?: string;
    goals?: string[];
    // ... from User_Context table
  };
  
  // RAG retrieval metadata
  retrievalMetadata?: {
    topK: number;
    filter: Record<string, any>;
    namespace: string;
  };
}

// Example usage
const messageContext: MessageContext = {
  chunks: [
    {
      chunkId: 'chunk_abc123',
      sourceId: 'purple-cow-book',
      text: 'Purple Cow is about being remarkable...',
      tokenCount: 150,
      page: 42,
      section: 'Chapter 3: Be Remarkable',
      relevanceScore: 0.89
    }
  ],
  userContext: {
    industry: 'SaaS',
    role: 'founder',
    goals: ['increase sales', 'improve positioning']
  },
  retrievalMetadata: {
    topK: 10,
    filter: { sourceType: 'book' },
    namespace: 'seth-godin'
  }
};
```

---

## 3. Core Attribution Logic

```typescript
// Attribute user sentiment to chunks from previous bot message
async function attributeSentimentToChunks(userMessageId: string) {
  // Get user message with analysis
  const userMessage = await prisma.message.findUnique({
    where: { id: userMessageId },
    include: { 
      analysis: true,
      conversation: {
        include: { messages: { orderBy: { createdAt: 'asc' } } }
      }
    }
  });
  
  if (!userMessage?.analysis) return;
  
  // Find previous bot message
  const messages = userMessage.conversation.messages;
  const userMessageIndex = messages.findIndex(m => m.id === userMessageId);
  const previousBotMessage = messages
    .slice(0, userMessageIndex)
    .reverse()
    .find(m => m.role === 'assistant');
  
  if (!previousBotMessage?.context) return;
  
  // Extract chunks from previous bot message
  const context = previousBotMessage.context as MessageContext;
  const chunks = context.chunks || [];
  
  if (chunks.length === 0) return;
  
  // Get sentiment from analysis
  const sentiment = userMessage.analysis.analysis as {
    sentiment: {
      satisfaction: number;
      confusion: number;
      frustration: number;
    };
    intent: string;
  };
  
  // Attribution with position weighting
  const totalWeight = chunks.reduce((sum, _, idx) => 
    sum + (1 / (idx + 1)), 0
  );
  
  // Update each chunk's performance
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const weight = (1 / (i + 1)) / totalWeight; // First chunk gets most weight
    
    await updateChunkPerformance({
      chunkId: chunk.chunkId,
      sourceId: chunk.sourceId,
      chatbotId: userMessage.conversation.chatbotId,
      satisfactionDelta: sentiment.sentiment.satisfaction * weight,
      confusionDelta: sentiment.sentiment.confusion > 0.6 ? weight : 0,
      clarificationDelta: sentiment.intent === 'clarification' ? weight : 0,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear()
    });
  }
}

// Update chunk performance counters
async function updateChunkPerformance(params: {
  chunkId: string;
  sourceId: string;
  chatbotId: string;
  satisfactionDelta?: number;
  confusionDelta?: number;
  clarificationDelta?: number;
  month: number;
  year: number;
}) {
  const { chunkId, sourceId, chatbotId, month, year } = params;
  
  // Upsert chunk performance record
  await prisma.chunk_Performance.upsert({
    where: {
      chunkId_chatbotId_month_year: { chunkId, chatbotId, month, year }
    },
    create: {
      chunkId,
      sourceId,
      chatbotId,
      month,
      year,
      satisfactionSum: params.satisfactionDelta || 0,
      satisfactionCount: params.satisfactionDelta ? 1 : 0,
      confusionCount: params.confusionDelta ? 1 : 0,
      clarificationCount: params.clarificationDelta ? 1 : 0,
      responseCount: 1
    },
    update: {
      satisfactionSum: { 
        increment: params.satisfactionDelta || 0 
      },
      satisfactionCount: { 
        increment: params.satisfactionDelta ? 1 : 0 
      },
      confusionCount: { 
        increment: params.confusionDelta ? 1 : 0 
      },
      clarificationCount: { 
        increment: params.clarificationDelta ? 1 : 0 
      },
      responseCount: { increment: 1 }
    }
  });
  
  // Cache chunk text from Pinecone on first use
  const existing = await prisma.chunk_Performance.findUnique({
    where: { chunkId_chatbotId_month_year: { chunkId, chatbotId, month, year } }
  });
  
  if (existing && !existing.chunkText) {
    const pineconeData = await fetchChunkFromPinecone(chunkId);
    
    await prisma.chunk_Performance.update({
      where: { id: existing.id },
      data: {
        chunkText: pineconeData.text,
        chunkMetadata: {
          page: pineconeData.metadata.page,
          section: pineconeData.metadata.section,
          chapter: pineconeData.metadata.chapter,
          sourceTitle: pineconeData.metadata.sourceTitle
        }
      }
    });
  }
}
```

---

## 4. Feedback Collection Handlers

```typescript
// Handle message feedback (thumbs up/down, copy)
async function handleMessageFeedback(data: {
  messageId: string;
  userId?: string;
  feedbackType: 'helpful' | 'not_helpful' | 'need_more' | 'copy';
  wasHelpful?: boolean;
  helpfulReasons?: string[];
  notHelpfulReasons?: string[];
  needsMore?: string[];
  specificSituation?: string;
  copyUsage?: string;
  copyContext?: string;
}) {
  // Get message to extract chunks
  const message = await prisma.message.findUnique({
    where: { id: data.messageId }
  });
  
  if (!message?.context) return;
  
  const context = message.context as MessageContext;
  const chunkIds = context.chunks.map(c => c.chunkId);
  
  // Store feedback
  await prisma.message_Feedback.create({
    data: {
      messageId: data.messageId,
      userId: data.userId,
      feedbackType: data.feedbackType,
      wasHelpful: data.wasHelpful,
      helpfulReasons: data.helpfulReasons || [],
      notHelpfulReasons: data.notHelpfulReasons || [],
      needsMore: data.needsMore || [],
      specificSituation: data.specificSituation,
      copyUsage: data.copyUsage,
      copyContext: data.copyContext,
      chunkIds: chunkIds
    }
  });
  
  // Update chunk performance counters
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  
  for (const chunk of context.chunks) {
    const updates: any = {};
    
    if (data.wasHelpful === true) {
      updates.helpfulCount = { increment: 1 };
    }
    if (data.wasHelpful === false) {
      updates.notHelpfulCount = { increment: 1 };
    }
    if (data.needsMore?.includes('scripts')) {
      updates.needsScriptsCount = { increment: 1 };
    }
    if (data.needsMore?.includes('examples')) {
      updates.needsExamplesCount = { increment: 1 };
    }
    if (data.needsMore?.includes('steps')) {
      updates.needsStepsCount = { increment: 1 };
    }
    if (data.needsMore?.includes('case_studies')) {
      updates.needsCaseStudyCount = { increment: 1 };
    }
    if (data.feedbackType === 'copy') {
      updates.copyCount = { increment: 1 };
      if (data.copyUsage === 'use_now') {
        updates.copyToUseNowCount = { increment: 1 };
      }
      if (data.copyUsage === 'adapt') {
        updates.copyToAdaptCount = { increment: 1 };
      }
    }
    
    await prisma.chunk_Performance.update({
      where: {
        chunkId_chatbotId_month_year: {
          chunkId: chunk.chunkId,
          chatbotId: message.conversation.chatbotId,
          month,
          year
        }
      },
      data: updates
    });
  }
}

// Handle conversation feedback (end-of-conversation survey)
async function handleConversationFeedback(data: {
  conversationId: string;
  userId?: string;
  rating?: number;
  userGoal?: string;
  goalAchieved?: 'yes' | 'partially' | 'no';
  stillNeed?: string;
}) {
  await prisma.conversation_Feedback.create({
    data: {
      conversationId: data.conversationId,
      userId: data.userId,
      rating: data.rating,
      userGoal: data.userGoal,
      goalAchieved: data.goalAchieved,
      stillNeed: data.stillNeed
    }
  });
}
```

---

## 5. Nightly Jobs

```typescript
// Job 1: Aggregate Content Gaps (nightly)
async function aggregateContentGaps() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Get all "need more" feedback from last 30 days
  const feedback = await prisma.message_Feedback.findMany({
    where: {
      feedbackType: { in: ['need_more', 'not_helpful'] },
      createdAt: { gte: thirtyDaysAgo }
    },
    include: { 
      message: {
        include: { conversation: true }
      }
    }
  });
  
  // Group by chatbot
  const byChatbot = feedback.reduce((acc, f) => {
    const chatbotId = f.message.conversation.chatbotId;
    if (!acc[chatbotId]) acc[chatbotId] = [];
    acc[chatbotId].push(f);
    return acc;
  }, {} as Record<string, typeof feedback>);
  
  // Process each chatbot
  for (const [chatbotId, chatbotFeedback] of Object.entries(byChatbot)) {
    // Get embeddings for all questions
    const questions = chatbotFeedback.map(f => f.message.content);
    const embeddings = await getEmbeddings(questions);
    
    // Cluster by similarity
    const clusters = clusterByEmbedding(embeddings, questions, threshold: 0.85);
    
    // Process each cluster
    for (const cluster of clusters) {
      // Use most common question as representative
      const representativeQuestion = cluster.questions
        .sort((a, b) => b.count - a.count)[0];
      
      // Count format preferences
      const needsScripts = cluster.feedback.filter(f => 
        f.needsMore.includes('scripts')
      ).length;
      const needsExamples = cluster.feedback.filter(f => 
        f.needsMore.includes('examples')
      ).length;
      const needsSteps = cluster.feedback.filter(f => 
        f.needsMore.includes('steps')
      ).length;
      
      // Collect user contexts
      const userContexts = cluster.feedback
        .filter(f => f.specificSituation)
        .map(f => ({
          userId: f.userId,
          situation: f.specificSituation
        }));
      
      // Get related chunks
      const relatedChunkIds = [...new Set(
        cluster.feedback.flatMap(f => f.chunkIds)
      )];
      
      // Upsert Content_Gap
      await prisma.content_Gap.upsert({
        where: {
          chatbotId_topicRequested: {
            chatbotId,
            topicRequested: representativeQuestion
          }
        },
        create: {
          chatbotId,
          topicRequested: representativeQuestion,
          specificQuestion: cluster.questions[0],
          requestCount: cluster.feedback.length,
          lastRequestedAt: new Date(),
          formatRequested: [
            ...(needsScripts > 0 ? ['scripts'] : []),
            ...(needsExamples > 0 ? ['examples'] : []),
            ...(needsSteps > 0 ? ['steps'] : [])
          ],
          userContexts,
          relatedChunkIds,
          status: 'open'
        },
        update: {
          requestCount: { increment: cluster.feedback.length },
          lastRequestedAt: new Date(),
          formatRequested: [
            ...(needsScripts > 0 ? ['scripts'] : []),
            ...(needsExamples > 0 ? ['examples'] : []),
            ...(needsSteps > 0 ? ['steps'] : [])
          ],
          userContexts: { push: userContexts }
        }
      });
    }
  }
}

// Job 2: Aggregate Source Performance from Chunks (monthly)
async function aggregateSourcePerformance() {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  
  // Get all unique source/chatbot combinations
  const combinations = await prisma.chunk_Performance.findMany({
    where: { month, year },
    select: { sourceId: true, chatbotId: true },
    distinct: ['sourceId', 'chatbotId']
  });
  
  for (const { sourceId, chatbotId } of combinations) {
    // Get all chunks for this source
    const chunks = await prisma.chunk_Performance.findMany({
      where: { sourceId, chatbotId, month, year }
    });
    
    if (chunks.length === 0) continue;
    
    // Calculate aggregates
    const totalResponses = chunks.reduce((sum, c) => sum + c.responseCount, 0);
    const totalSatisfaction = chunks.reduce((sum, c) => sum + c.satisfactionSum, 0);
    const totalConfusion = chunks.reduce((sum, c) => sum + c.confusionCount, 0);
    const totalClarification = chunks.reduce((sum, c) => sum + c.clarificationCount, 0);
    const totalCopies = chunks.reduce((sum, c) => sum + c.copyCount, 0);
    
    const avgSatisfaction = totalResponses > 0 
      ? totalSatisfaction / totalResponses 
      : null;
    const confusionRate = totalResponses > 0 
      ? totalConfusion / totalResponses 
      : null;
    const clarificationRate = totalResponses > 0 
      ? totalClarification / totalResponses 
      : null;
    const copyRate = totalResponses > 0 
      ? totalCopies / totalResponses 
      : null;
    
    // Aggregate top requests
    const topRequests: Record<string, number> = {};
    chunks.forEach(c => {
      if (c.needsScriptsCount > 0) {
        topRequests['scripts'] = (topRequests['scripts'] || 0) + c.needsScriptsCount;
      }
      if (c.needsExamplesCount > 0) {
        topRequests['examples'] = (topRequests['examples'] || 0) + c.needsExamplesCount;
      }
      if (c.needsStepsCount > 0) {
        topRequests['steps'] = (topRequests['steps'] || 0) + c.needsStepsCount;
      }
    });
    
    // Update Source_Performance
    await prisma.source_Performance.update({
      where: {
        sourceId_chatbotId_month_year: {
          sourceId,
          chatbotId,
          month,
          year
        }
      },
      data: {
        avgSatisfaction,
        confusionRate,
        clarificationRate,
        copyRate,
        topRequests
      }
    });
  }
}
```

---

## 6. Dashboard Queries

```typescript
// Query 1: Underperforming Chunks
async function getUnderperformingChunks(chatbotId: string, limit: number = 10) {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  
  const chunks = await prisma.$queryRaw<Array<{
    chunkId: string;
    sourceId: string;
    chunkText: string;
    chunkMetadata: any;
    timesUsed: number;
    avgSatisfaction: number;
    confusionRate: number;
    needsScriptsCount: number;
    needsExamplesCount: number;
    needsStepsCount: number;
  }>>`
    SELECT 
      chunkId,
      sourceId,
      chunkText,
      chunkMetadata,
      timesUsed,
      CASE 
        WHEN satisfactionCount > 0 
        THEN satisfactionSum / satisfactionCount 
        ELSE NULL 
      END as avgSatisfaction,
      CASE 
        WHEN responseCount > 0 
        THEN confusionCount::float / responseCount 
        ELSE NULL 
      END as confusionRate,
      needsScriptsCount,
      needsExamplesCount,
      needsStepsCount
    FROM Chunk_Performance
    WHERE chatbotId = ${chatbotId}
      AND month = ${month}
      AND year = ${year}
      AND timesUsed >= 20
      AND satisfactionCount > 0
      AND satisfactionSum / satisfactionCount < 3.0
    ORDER BY timesUsed DESC
    LIMIT ${limit}
  `;
  
  // Fetch chunk text from Pinecone if not cached
  for (const chunk of chunks) {
    if (!chunk.chunkText) {
      const pineconeData = await fetchChunkFromPinecone(chunk.chunkId);
      chunk.chunkText = pineconeData.text;
      chunk.chunkMetadata = pineconeData.metadata;
    }
  }
  
  return chunks;
}

// Query 2: Top Performing Chunks
async function getTopPerformingChunks(chatbotId: string, limit: number = 10) {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  
  return prisma.$queryRaw`
    SELECT 
      chunkId,
      sourceId,
      chunkText,
      chunkMetadata,
      timesUsed,
      CASE 
        WHEN satisfactionCount > 0 
        THEN satisfactionSum / satisfactionCount 
        ELSE NULL 
      END as avgSatisfaction,
      copyToUseNowCount,
      helpfulCount
    FROM Chunk_Performance
    WHERE chatbotId = ${chatbotId}
      AND month = ${month}
      AND year = ${year}
      AND timesUsed >= 20
      AND satisfactionCount > 0
      AND satisfactionSum / satisfactionCount >= 4.0
    ORDER BY 
      avgSatisfaction DESC,
      copyToUseNowCount DESC
    LIMIT ${limit}
  `;
}

// Query 3: Content Gaps
async function getContentGaps(chatbotId: string) {
  return prisma.content_Gap.findMany({
    where: {
      chatbotId,
      status: 'open'
    },
    orderBy: {
      requestCount: 'desc'
    },
    take: 20
  });
}

// Query 4: Format Preferences (Summary Widget)
async function getFormatPreferences(chatbotId: string) {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  
  const result = await prisma.chunk_Performance.aggregate({
    where: { chatbotId, month, year },
    _sum: {
      needsScriptsCount: true,
      needsExamplesCount: true,
      needsStepsCount: true,
      needsCaseStudyCount: true
    }
  });
  
  return {
    scripts: result._sum.needsScriptsCount || 0,
    examples: result._sum.needsExamplesCount || 0,
    steps: result._sum.needsStepsCount || 0,
    caseStudies: result._sum.needsCaseStudyCount || 0
  };
}

// Query 5: Question Volume Trends
async function getQuestionVolume(chatbotId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return prisma.question_Cluster_Aggregate.findMany({
    where: {
      chatbotId,
      date: { gte: startDate }
    },
    orderBy: {
      timesAsked: 'desc'
    },
    take: 20
  });
}
```

---

## 7. Helper Functions

```typescript
// Cluster questions by embedding similarity
function clusterByEmbedding(
  embeddings: number[][],
  questions: string[],
  threshold: number = 0.85
): Array<{
  questions: Array<{ text: string; count: number }>;
  feedback: any[];
}> {
  const clusters: any[] = [];
  const used = new Set<number>();
  
  for (let i = 0; i < embeddings.length; i++) {
    if (used.has(i)) continue;
    
    const cluster = {
      questions: [{ text: questions[i], count: 1 }],
      feedback: [feedback[i]]
    };
    used.add(i);
    
    // Find similar questions
    for (let j = i + 1; j < embeddings.length; j++) {
      if (used.has(j)) continue;
      
      const similarity = cosineSsimilarity(embeddings[i], embeddings[j]);
      if (similarity >= threshold) {
        cluster.questions.push({ text: questions[j], count: 1 });
        cluster.feedback.push(feedback[j]);
        used.add(j);
      }
    }
    
    clusters.push(cluster);
  }
  
  return clusters;
}

// Cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

// Fetch chunk from Pinecone
async function fetchChunkFromPinecone(chunkId: string) {
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pinecone.index(process.env.PINECONE_INDEX!);
  
  const result = await index.fetch([chunkId]);
  const vector = result.vectors[chunkId];
  
  return {
    text: vector.metadata.text,
    metadata: {
      page: vector.metadata.page,
      section: vector.metadata.section,
      chapter: vector.metadata.chapter,
      sourceTitle: vector.metadata.sourceTitle
    }
  };
}

// Get embeddings for text
async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts
  });
  
  return response.data.map(d => d.embedding);
}
```