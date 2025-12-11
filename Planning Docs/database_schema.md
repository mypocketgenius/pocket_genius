# Database Schema (Prisma)

## Model Overview

| Model | Purpose | Key Fields |
|-------|---------|------------|
| **User** | Clerk user mirror | `clerkId` (unique), `email`, `username`, `firstName`, `lastName`, `phone`, `metadata` |
| **Creator** | AI creator profile | `name`, `slug` (unique), `avatarUrl`, `bio`, `urls` (JSONB) |
| **Chatbot** | Live chatbot entity | `slug`, `title`, `type` (CREATOR\|FRAMEWORK\|DEEP_DIVE\|ADVISOR_BOARD), `currentVersionId`, `priceCents`, `isPublic` |
| **Chatbot_Version** | Immutable snapshots | `versionNumber`, `systemPrompt`, `configJson`, `ragSettingsJson`, `ingestionRunIds`, `allowAnonymous`, `priceCents`, `currency`, `type` |
| **Source** | Source metadata | `title`, `type` (BOOK\|ARTICLE\|PODCAST\|VIDEO\|DOCUMENT\|OTHER), `author`, `publisher`, `isbn`, `url` |
| **File** | Uploaded assets | `sourceId`, `blobUrl`, `fileName`, `status` (PENDING\|PROCESSING\|READY\|FAILED), `isActive`, `replacedByFileId` |
| **Conversation** | Chat sessions | `chatbotId`, `chatbotVersionId`, `userId`/`anonymousId`, `messageAllowance`, `messagesUsed`, `status`, `attributedAt`, `purchaseId` |
| **Message** | Individual turns | `conversationId`, `role`, `content`, `attribution` (JSONB), `context` (JSONB) |
| **Revenue_per_Conversation** | Revenue tracking | `conversationId`, `purchaseId`, `sourceId`, `creatorId`, `amountCents`, `tokenCount`, `payoutStatus` |
| **User_Context** | User context storage | `userId`, `chatbotId` (nullable for global), `key`, `value` (JSONB), `source`, `confidence`, `expiresAt`, `isVisible`, `isEditable` |
| **Creator_Revenue_Summary** | Monthly revenue aggregation | `creatorId`, `month`, `year`, `totalRevenueCents`, `creatorShareCents`, `platformShareCents`, `conversationCount` |
| **Conversation_Source_Usage** | Source usage per conversation | `conversationId`, `sourceId`, `totalTokens`, `messageCount`, `firstUsedAt`, `lastUsedAt` |
| **Enterprise_Subscription** | Enterprise subscriptions | `companyName`, `seats`, `amountCents`, `currency`, `startsAt`, `endsAt`, `status`, `stripeSubscriptionId` |
| **Enterprise_User** | Enterprise user memberships | `subscriptionId`, `userId`, `role` (ADMIN\|MEMBER) |
| **Question_Cluster_Aggregate** | Question clustering analytics | `chatbotId`, `canonicalQuestion`, `timesAsked`, `exampleQuestions`, `avgSatisfaction`, `relatedSourceIds`, `avgResponseQuality`, `date` |
| **Message_Feedback** | Structured feedback on messages | `messageId`, `userId`, `feedbackType`, `wasHelpful`, `helpfulReasons`, `notHelpfulReasons`, `needsMore`, `copyUsage`, `chunkIds` |
| **Conversation_Feedback** | End-of-conversation feedback | `conversationId` (unique), `userId`, `rating`, `userGoal`, `goalAchieved`, `stillNeed` |
| **Content_Gap** | Aggregated unmet demand | `chatbotId`, `topicRequested`, `specificQuestion`, `requestCount`, `formatRequested`, `userContexts`, `status` |

### Join Tables

| Table | Purpose | Key Constraints |
|-------|---------|----------------|
| **Creator_User** | Multi-user creators | `(creatorId, userId)` unique, roles: OWNER\|ADMIN\|MEMBER |
| **Chatbot_Creator** | Multi-creator ownership | `(chatbotId, creatorId)` unique, roles: PRIMARY_OWNER\|CO_OWNER\|CONTRIBUTOR |
| **Source_Creator** | Source sharing | `(sourceId, creatorId)` unique, `revenueShare` (0.0-1.0, must sum to 1.0) |
| **Chatbot_Category** | Taxonomy | `(chatbotId, categoryId)` unique, `relevanceScore` (0-1) |
| **Conversation_File** | File references | `(conversationId, fileId)` unique |

### Business Rules

- **Creator-Chatbot**: Each creator owns exactly one CREATOR chatbot (enforced via `Chatbot_Creator` + app logic)
- **Chatbot Versions**: Append-only; `Chatbot.currentVersionId` points to latest
- **Revenue Share**: All `Source_Creator.revenueShare` values for a source must sum to 1.0 (app logic)
- **Permissions**: At least one PRIMARY_OWNER per chatbot; cannot delete last primary owner
- **Traceability**: Conversations/ratings/reports always reference both `chatbotId` and `chatbotVersionId`

## Prisma Schema

```prisma
// MVP: Implemented
// Future: Schema ready, not implemented

// The entity of Seth Godin, etc. who controls the chat bots, sources, gets revenue.
model Creator {
  id            String   @id @default(cuid())
  name          String
  slug          String   @unique
  avatarUrl     String?
  bio           String?
  socialLinks   Json?    // { website, linkedin, x, facebook, tiktok, masterclass, youtube }
  
  users         Creator_User[]
  sources       Source_Creator[]
  chatbots      Chatbot[]
  files         File[]
  revenuePerConversations Revenue_per_Conversation[]
  revenueSummaries Creator_Revenue_Summary[] @relation("CreatorRevenue")
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// Each book, podcast episode, YouTube video etc. uploaded by the Creator
// Chunks in the Pinecode db reference their source IDs.
model Source {
  id              String   @id @default(cuid())
  title           String
  type            SourceType
  author          String?
  publisher       String?
  publicationDate DateTime?
  isbn            String?
  url             String?
  description     String?
  metadata        Json?
  
  createdByUserId String
  createdBy       User     @relation(fields: [createdByUserId], references: [id])
  
  files           File[]
  creators        Source_Creator[]
  performance     Source_Performance[]
  chunkPerformances Chunk_Performance[]
  revenuePerConversations Revenue_per_Conversation[]
  conversationSourceUsages Conversation_Source_Usage[] @relation("SourceUsage")
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Source_Creator {
  id            String   @id @default(cuid())
  sourceId      String
  source        Source   @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  creatorId     String
  creator       Creator  @relation(fields: [creatorId], references: [id], onDelete: Cascade)
  addedByUserId String
  addedBy       User     @relation("SourceCreatorAddedBy", fields: [addedByUserId], references: [id])
  
  // Revenue share: 0.0-1.0, all shares for a source must sum to 1.0
  revenueShare  Decimal? @db.Decimal(5, 4)
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  // Source ownership, and also what exact user uploaded the source material
  
  @@unique([sourceId, creatorId])
  @@index([creatorId])
  @@index([sourceId])
  @@index([addedByUserId])
}

// There are 2 types of files:
// 1. The PDFs, transcripts, etc. of sources that have been uploaded by Creators. They will get embedded after upload.
// 2. The files that users (audience members) upload for their own personal context. They will not get embedded.
// Supports saving older files if for example a better formatted version becomes available
model File {
  id              String   @id @default(cuid())
  sourceId        String?
  source          Source?  @relation(fields: [sourceId], references: [id])
  
  ownerUserId     String
  owner           User     @relation("FileOwner", fields: [ownerUserId], references: [id])
  
  creatorId       String
  creator         Creator  @relation(fields: [creatorId], references: [id])
  
  blobUrl         String
  fileName        String
  mimeType        String
  status          FileStatus @default(PENDING)
  sizeBytes       Int
  
  isActive        Boolean  @default(true)
  replacedByFileId String?
  replacedBy      File?    @relation("FileReplacement", fields: [replacedByFileId], references: [id])
  replacedFiles   File[]   @relation("FileReplacement")
  
  // Relations
  conversationFiles Conversation_File[]
  intakeResponses Intake_Response[] @relation("IntakeResponseFile")
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([sourceId])
  @@index([ownerUserId])
  @@index([creatorId])
}

// A creator entity can be controlled by multiple users. E.g. Personal assistants.
model Creator_User {
  id          String   @id @default(cuid())
  creatorId  String
  creator     Creator  @relation(fields: [creatorId], references: [id], onDelete: Cascade)
  userId      String
  user        User     @relation("CreatorMembers", fields: [userId], references: [id], onDelete: Cascade)
  role        CreatorRole @default(MEMBER)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([creatorId, userId])
  @@index([creatorId])
  @@index([userId])
}

// Creators can share ownership (or other roles) over chatbots. E.g. Advisory boards, Deep dives into material with multiple authors.
// Ownership doesnt determine revenue. That comes from sources.
model Chatbot_Creator {
  id          String   @id @default(cuid())
  chatbotId   String
  chatbot     Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  creatorId   String
  creator     Creator  @relation("ChatbotOwners", fields: [creatorId], references: [id], onDelete: Cascade)
  role        ChatbotOwnerRole @default(CO_OWNER)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([chatbotId, creatorId])
  @@index([chatbotId])
  @@index([creatorId])
}

// Keeps a record of the config of older versions of chatbot
// The current version is in the chatbot table
// If we add fields to chatbot table, we should add them here too
model Chatbot_Version {
  id                String   @id @default(cuid())
  chatbotId         String
  chatbot           Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  versionNumber     Int
  title             String
  description       String?
  metaDescription   String?
  seoSchema         Json?
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
  
  // NEW: Track when this version was live
  activatedAt       DateTime?   // When it became current
  deactivatedAt     DateTime?   // When it was replaced
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  conversations     Conversation[]
  ratings           Rating[]
  reports           Report[]
  
  @@unique([chatbotId, versionNumber])
  @@index([chatbotId])
  @@index([activatedAt])
}

enum SourceType {
  BOOK
  ARTICLE
  PODCAST
  VIDEO
  DOCUMENT
  OTHER
}

enum FileStatus {
  PENDING
  PROCESSING
  READY
  FAILED
}

enum CreatorRole {
  OWNER   // Can delete creator, manage all settings, add/remove members
  ADMIN   // Can update creator profile, manage chatbots/files, cannot delete creator
  MEMBER  // Can view and contribute, limited edit permissions
}

enum ChatbotOwnerRole {
  PRIMARY_OWNER   // Can delete chatbot, manage all settings, add/remove owners, change revenue splits
  CO_OWNER        // Can edit chatbot (system prompt, files, settings), view analytics
  CONTRIBUTOR      // Can add files/content, limited edit permissions
}

enum ChatbotType {
  CREATOR       // General Q&A chatbot trained on all creator content (one per creator)
  FRAMEWORK     // Focused on specific transformations/curricula
  DEEP_DIVE     // Q&A chatbot for asking questions about a specific work
  ADVISOR_BOARD // Advisory board chatbot with multiple expert perspectives
}

enum MessageRole {
  USER
  AI
  SYSTEM
}

enum ReportReason {
  INCORRECT_INFORMATION
  HALLUCINATION
  INAPPROPRIATE_CONTENT
  OFF_TOPIC
  HARMFUL_CONTENT
  COPYRIGHT_VIOLATION
  OTHER
}

enum ReportStatus {
  PENDING
  REVIEWED
  RESOLVED
  DISMISSED
}

enum IntakeResponseType {
  TEXT
  NUMBER
  SELECT
  MULTI_SELECT
  FILE
  DATE
  BOOLEAN
}

// All users. Including audience and the users that will control the Creator entities.
model User {
  id            String   @id @default(cuid())
  clerkId       String   @unique
  email         String
  username      String?
  firstName     String?
  lastName      String?
  phone         String?
  metadata      Json?
  
  // Relations
  createdSources Source[] @relation("SourceCreator")
  createdChatbotVersions Chatbot_Version[] @relation("ChatbotVersionCreator")
  creatorMemberships Creator_User[] @relation("CreatorMembers")
  ownedFiles File[] @relation("FileOwner")
  userContext User_Context[] @relation("UserContext")
  enterpriseMemberships Enterprise_User[] @relation("EnterpriseMembers")
  revenuePurchases Revenue_per_Conversation[] @relation("RevenuePurchaser")
  purchases Purchase[] @relation("PurchasePurchaser")
  addedSourceCreators Source_Creator[] @relation("SourceCreatorAddedBy")
  conversations Conversation[]
  messages Message[]
  ratings Rating[]
  reports Report[]
  favoritedChatbots Favorited_Chatbots[]
  intakeResponses Intake_Response[]
  messageFeedbacks Message_Feedback[] @relation("MessageFeedbackUser")
  conversationFeedbacks Conversation_Feedback[] @relation("ConversationFeedbackUser")
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// Every chatbot. E.g. Seth Godin's chatbot. Purple Cow Deep Dive chatbot. Marketing advisor board chatbot.
// Contains all its config as well
// When the chatbot is updated, the old version should be saved to chatbot_version
model Chatbot {
  id                String   @id @default(cuid())
  slug              String   @unique
  title             String
  description       String?
  metaDescription   String?
  seoSchema         Json?
  systemPrompt      String
  modelProvider     String
  modelName         String
  pineconeNs        String
  vectorNamespace   String
  isPublic          Boolean  @default(false)
  allowAnonymous    Boolean  @default(false)
  isActive          Boolean  @default(true)
  priceCents        Int
  currency          String
  type              ChatbotType
  currentVersionId  String?
  
  // Relations
  versions          Chatbot_Version[]
  creators          Chatbot_Creator[]
  categories        Chatbot_Category[]
  conversations     Conversation[]
  purchases         Purchase[]
  favoritedBy       Favorited_Chatbots[]
  intakeQuestions   Intake_Question[]
  intakeResponses   Intake_Response[] @relation("IntakeResponseChatbot")
  questionClusters  Question_Cluster_Aggregate[]
  audienceProfiles Chatbot_Audience_Profile[]
  userContexts      User_Context[] @relation("ChatbotContext")
  sourcePerformance Source_Performance[]
  chunkPerformances Chunk_Performance[]
  reports           Report[]
  contentGaps       Content_Gap[]
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([slug])
  @@index([isActive])
  @@index([isPublic])
}

// Categories are used to filter and discover chatbots
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

// A chatbot can have many categories, with different relevance scores
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

enum CategoryType {
  ROLE      // sales_leader, founder, product_manager
  CHALLENGE // customer_acquisition, pricing, positioning
  STAGE     // early_stage, growth_stage, scale_stage
}

// Each individual conversation. 
// Sets time and message limits
// Linked to a purchase
// Stores data like token use, when the convo was completed, when revenue attribution happened
// status values: 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'ATTRIBUTED' | 'ARCHIVED'
// Can be started by anonymous or registered users
model Conversation {
  id                  String   @id @default(cuid())
  chatbotId           String
  chatbot             Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  chatbotVersionId   String
  chatbotVersion      Chatbot_Version @relation(fields: [chatbotVersionId], references: [id], onDelete: Cascade)
  userId              String?
  user                User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  anonymousId         String?
  title               String?
  
  messageAllowance   Int      // e.g., 100
  messagesUsed        Int      @default(0)
  expiresAt           DateTime
  
  status              ConversationStatus @default(ACTIVE)
  completedAt         DateTime?
  attributedAt        DateTime?  // When revenue attribution happened (7 days after completion)
  
  purchaseId          String?
  purchase            Purchase? @relation("ConversationPurchase", fields: [purchaseId], references: [id])
  
  tokenCounts         Json?
  metadata            Json?
  
  // Relations
  messages            Message[]
  ratings             Rating[]
  reports             Report[]
  files               Conversation_File[]
  revenuePerConversations Revenue_per_Conversation[]
  sourceUsages        Conversation_Source_Usage[]
  conversationFeedback Conversation_Feedback?
  
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  @@index([chatbotId])
  @@index([userId])
  @@index([anonymousId])
  @@index([status])
}

model Conversation_Feedback {
  id              String   @id @default(cuid())
  conversationId  String   @unique
  conversation    Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  userId          String?
  user            User?    @relation("ConversationFeedbackUser", fields: [userId], references: [id])
  
  rating          Int?     // 1-5 stars
  userGoal        String?  // Free text: "I wanted to learn how to..."
  goalAchieved    String?  // 'yes' | 'partially' | 'no'
  stillNeed       String?  // Free text: "I still need help with..."
  
  createdAt       DateTime @default(now())
  
  @@index([conversationId])
  @@index([userId])
  @@index([goalAchieved])
}

// Overall conversation goal achievement
// Captures end-of-conversation feedback and goal achievement status
// Used for content gap analysis and creator insights

// Users will rate chatbots when a conversation ends
// Also used in Creator dashboards
model Rating {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  conversationId    String
  conversation      Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  chatbotId         String
  chatbot           Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  chatbotVersionId  String
  chatbotVersion    Chatbot_Version @relation(fields: [chatbotVersionId], references: [id], onDelete: Cascade)
  rating            Int      // 1-5
  comment           String?
  hoursSaved        Int?
  trigger           ReviewTriggerType
  contextData       Json?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([chatbotId])
  @@index([userId])
}

// We need to have a mechanism of user reporting, at the chatbot and message level
model Report {
  id                String   @id @default(cuid())
  reporterUserId    String
  reporter          User     @relation(fields: [reporterUserId], references: [id], onDelete: Cascade)
  chatbotId         String
  chatbot           Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  conversationId    String?
  conversation      Conversation? @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  chatbotVersionId  String
  chatbotVersion    Chatbot_Version @relation(fields: [chatbotVersionId], references: [id], onDelete: Cascade)
  messageId         String?
  message           Message? @relation(fields: [messageId], references: [id], onDelete: Cascade)
  description       String
  reason            ReportReason
  status            ReportStatus @default(PENDING)
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([chatbotId])
  @@index([reporterUserId])
  @@index([status])
}

model Message {
  id                String   @id @default(cuid())
  conversationId    String
  conversation      Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role              MessageRole
  content           String
  tokenCount        Int
  senderUserId      String?
  sender            User?     @relation(fields: [senderUserId], references: [id], onDelete: Cascade)
  attribution       Json?
  context           Json?
  
  // Relations
  reports           Report[]
  messageAnalysis   Message_Analysis?
  messageFeedbacks  Message_Feedback[]
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([conversationId])
  @@index([conversationId, createdAt])
  @@index([role])
  @@index([senderUserId])
}

// Each individual message in a conversation, from both the AI and user
// attribution JSON (AI messages): Citations/sources shown to user in the UI
// context JSON (AI messages): Complete generation context - SOURCE OF TRUTH for analytics
//   Structure: {
//     chunks: [{ chunkId, sourceId, text, tokenCount, page, section, relevanceScore }],
//     userContext: { industry, role, goals, etc. },
//     retrievalMetadata: { topK, filter, namespace }
//   }
// context.chunks is used by Chunk_Performance for attribution
// For user messages: analyzed async via Message_Analysis table
// Attribution is for display - context.chunks used for performance tracking

model Message_Analysis {
  id                String   @id @default(cuid())
  messageId         String   @unique
  message           Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  analysis          Json
  analyzedAt        DateTime @default(now())
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([messageId])
  @@index([analyzedAt])
}

// Async sentiment analysis of user messages
// To get chunks user is responding to: Query for previous bot message → extract from Message.context.chunks
// analysis JSON structure: { sentiment: { satisfaction, confusion, frustration }, intent: 'question'|'clarification'|'followup'|'gratitude'|'complaint' }
// Used to attribute user sentiment to specific content chunks
// Populated by async job after message is sent (no user-facing latency)
// Only analyzes USER messages in conversations with 3+ messages, long messages, or frustration keywords
// Attribution logic: userMessage → find previousBotMessage → get chunks from previousBotMessage.context.chunks → update Chunk_Performance

model Message_Feedback {
  id                String   @id @default(cuid())
  messageId         String
  message           Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  userId            String?
  user              User?    @relation("MessageFeedbackUser", fields: [userId], references: [id])
  
  feedbackType      String   // 'helpful' | 'not_helpful' | 'need_more' | 'copy'
  
  // Structured responses
  wasHelpful        Boolean?
  helpfulReasons    String[] // ['clear_explanation', 'good_examples', 'actionable', 'specific']
  notHelpfulReasons String[] // ['too_vague', 'missing_examples', 'confusing', 'wrong_info']
  
  // What user needs more of
  needsMore         String[] // ['scripts', 'examples', 'steps', 'case_studies', 'video']
  specificSituation String?  // Free text: "I'm dealing with..." or "I'm trying to..."
  
  // Copy feedback
  copyUsage         String?  // 'reference' | 'use_now' | 'share_team' | 'adapt'
  copyContext       String?  // Free text: what they'll use it for
  
  // Track which chunks were in the message being rated
  chunkIds          String[]
  
  createdAt         DateTime @default(now())
  
  @@index([messageId])
  @@index([userId])
  @@index([feedbackType])
  @@index([createdAt])
}

// User feedback on AI responses
// Used to capture structured feedback on individual messages
// Populates Chunk_Performance counters and Content_Gap aggregations

// Users may favourite chatbots to return later
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

// The questions a chatbot will ask a user to personalise its response to them
// May be reused across multiple chatbots
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
  
  // Relations
  responses         Intake_Response[]
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@unique([chatbotId, slug])
  @@index([chatbotId])
}

// The responses given to each question
// May be reused across multiple chatbots
model Intake_Response {
  id                String   @id @default(cuid())
  intakeQuestionId  String
  intakeQuestion    Intake_Question @relation(fields: [intakeQuestionId], references: [id], onDelete: Cascade)
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  chatbotId String?
  chatbot   Chatbot? @relation("IntakeResponseChatbot", fields: [chatbotId], references: [id], onDelete: Cascade)
  fileId            String?
  file              File?    @relation("IntakeResponseFile", fields: [fileId], references: [id], onDelete: Cascade)
  value             Json
  reusableAcrossFrameworks Boolean @default(false)
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([userId])
  @@index([intakeQuestionId])
}

// The 2nd type of files (user's context files) are linked to conversations here
// These types are not embedded. They directly give context.
model Conversation_File {
  id                String   @id @default(cuid())
  conversationId    String
  conversation      Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  fileId            String
  file              File     @relation(fields: [fileId], references: [id], onDelete: Cascade)
  
  createdAt         DateTime @default(now())
  
  @@unique([conversationId, fileId])
  @@index([conversationId])
  @@index([fileId])
}

enum ConversationStatus {
  ACTIVE       // User can send messages
  COMPLETED    // All messages used
  EXPIRED      // Time limit reached
  ATTRIBUTED   // Revenue distributed
  ARCHIVED     // User archived
}

enum ReviewTriggerType {
  INLINE_RATING
  HIGH_RATING_FOLLOWUP
  NATURAL_ENDING
  GOAL_ACHIEVED
  OUTPUT_DOWNLOADED
  INACTIVITY_PROMPT
  MESSAGE_LIMIT
  TIME_EXPIRED
  RETURN_PROMPT
  EMAIL_FOLLOWUP
}

// When someone purchases a Conversation
// Generic payment fields support multiple processors (Stripe, Paddle, Lemon Squeezy, PayPal)
model Purchase {
  id                String   @id @default(cuid())
  purchaserUserId   String
  purchaser         User     @relation("PurchasePurchaser", fields: [purchaserUserId], references: [id], onDelete: Cascade)
  chatbotId         String
  chatbot           Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  
  // Generic payment fields (processor-agnostic)
  paymentProcessor  PaymentProcessor  // Which processor was used
  externalPaymentId String            // RENAME from stripePaymentId
  processingFeeCents Int              // RENAME from stripeFeesCents
  paymentMetadata   Json?             // Flexible storage for processor-specific data
  
  currency          String
  amountCents       Int
  netAmountCents    Int
  status            PurchaseStatus @default(COMPLETED)
  refundedAt        DateTime?
  
  // Relations
  conversations     Conversation[] @relation("ConversationPurchase")
  revenuePerConversations Revenue_per_Conversation[]
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([purchaserUserId])
  @@index([chatbotId])
  @@index([status])
}

enum PurchaseStatus {
  PENDING
  COMPLETED
  REFUNDED
  FAILED
}

enum PayoutStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

enum PaymentProcessor {
  STRIPE
  PADDLE
  LEMON_SQUEEZY
  PAYPAL
  // Easy to add more processors
}

// Financial record of creator earnings. Calculates amount and tracks payout.
// Created 7 days after conversation is completed (refund window)
// Uses Conversation_Source_Usage data
// One row for each Creator
// Also used in Creator dashboards
model Revenue_per_Conversation {
  id                String   @id @default(cuid())
  conversationId    String
  conversation      Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  purchaseId        String
  purchase          Purchase @relation(fields: [purchaseId], references: [id], onDelete: Cascade)
  
  sourceId          String
  source            Source   @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  
  creatorId         String
  creator           Creator  @relation(fields: [creatorId], references: [id], onDelete: Cascade)
  
  purchaserUserId   String
  purchaser         User     @relation("RevenuePurchaser", fields: [purchaserUserId], references: [id], onDelete: Cascade)
  
  amountCents       Int
  currency          String
  tokenCount        Int
  tokenPercentage   Float
  
  payoutStatus      PayoutStatus @default(PENDING)
  
  // Payment transfer tracking (processor-agnostic)
  payoutProcessor   PaymentProcessor?  // Which processor paid out
  externalTransferId String?           // RENAME from stripeTransferId
  
  paidOutAt         DateTime?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([conversationId])
  @@index([purchaseId])
  @@index([sourceId])
  @@index([creatorId])
  @@index([payoutStatus])
}

// Creator dashboard metric - shows question volume and trends
// Different purpose than Content_Gap:
//   - Question_Cluster: "What are people asking about?" (ALL questions, including well-answered ones)
//   - Content_Gap: "What content is missing?" (ONLY unmet needs where users need more)
// Use cases:
//   - Identify popular topics to promote (high volume + high satisfaction = promote this content)
//   - See question trends over time (what's becoming more/less popular)
//   - Understand total audience interests (not just gaps)
// We embed all user questions and store in Pinecone
// This table aggregates similar questions with their frequency using embedding-based clustering (reuses existing Pinecone infrastructure)
// We run the aggregation daily (stores daily snapshots with date field)
// Simplified approach: Just canonical question + count, no complex semantic extraction
// Used in Creator dashboards
model Question_Cluster_Aggregate {
  id                String   @id @default(cuid())
  chatbotId         String
  chatbot           Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  
  canonicalQuestion String
  timesAsked        Int      @default(0)
  exampleQuestions  String[]
  
  avgSatisfaction   Float?
  relatedSourceIds  String[] // Which sources were used to answer questions in this cluster
  avgResponseQuality Float?  // Average rating when answering these questions
  
  date              DateTime  // 2025-02-15
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@unique([chatbotId, date, canonicalQuestion])
  @@index([chatbotId])
  @@index([date])
  @@index([timesAsked])
}

model Content_Gap {
  id                String   @id @default(cuid())
  chatbotId         String
  chatbot           Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  
  // Representative question (most common in cluster)
  topicRequested    String
  specificQuestion  String   // First question that revealed this gap
  
  // Demand metrics
  requestCount      Int      @default(1)
  lastRequestedAt   DateTime @default(now())
  
  // Format preferences
  formatRequested   String[] // ['script', 'template', 'checklist', 'example', 'steps']
  
  // User contexts (who needs this and why)
  userContexts      Json[]   // [{ userId, situation: "I'm a SaaS founder..." }]
  
  // Partial coverage
  relatedChunkIds   String[] // Chunks that partially addressed this
  
  // Lifecycle
  status            String   @default('open') // 'open' | 'planned' | 'created'
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@unique([chatbotId, topicRequested])
  @@index([chatbotId, status])
  @@index([requestCount])
  @@index([lastRequestedAt])
}

// Aggregated unmet demand into content creation roadmap
// Populated by nightly job: 
// 1. Get Message_Feedback with 'need_more' type
// 2. Cluster similar questions by embedding similarity (simple, no LLM extraction)
// 3. Use most common question as representative
// 4. Aggregate format preferences and user contexts
// Simplified approach: No semantic topic extraction, just cluster + aggregate
// Shows creators "47 users need SaaS pricing scripts" with actual user situations
// Used in Creator dashboards to prioritize content creation

// Creator dashboard metric.
// Tracks how all conversations this month have used a source 
// Tracks token usage and how happy people were with it
// Used in creator dashboards
model Source_Performance {
  id                String   @id @default(cuid())
  sourceId          String
  source            Source   @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  chatbotId         String?  // Null = across all chatbots
  chatbot           Chatbot? @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  
  totalTokens       Int      @default(0)
  conversationCount Int      @default(0)
  messageCount       Int      @default(0)
  
  // Aggregated quality metrics (from Chunk_Performance)
  avgSatisfaction    Float?
  confusionRate      Float?
  clarificationRate Float?
  copyRate           Float?
  topRequests        Json?    // Aggregated from chunk commonRequests
  
  month             Int      // 1-12
  year              Int
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@unique([sourceId, chatbotId, year, month])
  @@index([sourceId])
  @@index([chatbotId])
}

model Chunk_Performance {
  id                String   @id @default(cuid())
  chunkId           String
  sourceId          String
  source            Source   @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  chatbotId         String
  chatbot           Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  
  chunkText         String?  // OPTIONAL cached content text (NULL until first dashboard view)
  chunkMetadata     Json?    // OPTIONAL cached { page, section, chapter, sourceTitle }
  
  timesUsed         Int      @default(0)
  conversationCount Int      @default(0)
  satisfactionSum   Float    @default(0)
  satisfactionCount Int      @default(0)
  confusionCount    Int      @default(0)
  clarificationCount Int     @default(0)
  responseCount      Int      @default(0)
  helpfulCount       Int      @default(0)
  notHelpfulCount    Int      @default(0)
  needsScriptsCount Int      @default(0)
  needsExamplesCount Int      @default(0)
  needsStepsCount    Int      @default(0)
  needsCaseStudyCount Int     @default(0)
  copyCount          Int      @default(0)
  copyToUseNowCount  Int      @default(0)
  copyToAdaptCount   Int      @default(0)
  commonRequests     Json?
  userSituations     Json?
  
  month             Int      // 1-12
  year              Int
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@unique([chunkId, chatbotId, month, year])
  @@index([sourceId])
  @@index([chatbotId, month, year])
}

// Tracks performance of individual content sections with rich feedback
// chunkId: Pinecone vector ID
// Composite unique constraint: (chunkId, chatbotId, month, year) - same chunk tracked separately per chatbot/month
// chunkText: OPTIONAL cached content text (NULL until first dashboard view, populated on-demand from Pinecone)
// chunkMetadata: OPTIONAL cached { page, section, chapter, sourceTitle } (NULL until populated from Pinecone)
// Both cached fields reduce Pinecone API calls but can be NULL - dashboard fetches from Pinecone if missing
// Cached fields can be invalidated if source is updated
// Counters are source of truth - rates computed on read:
//   avgSatisfaction = satisfactionSum / satisfactionCount
//   confusionRate = confusionCount / responseCount
//   clarificationRate = clarificationCount / responseCount
// Populated by:
//   1. Usage tracking when chunk retrieved and used (from Message.context.chunks)
//   2. Sentiment from Message_Analysis (attributed via previous bot message)
//   3. Direct feedback from Message_Feedback
//   4. Copy events from Message_Feedback
// Shows creators: "Chapter 7, pg 89-92 has 2.1★ - 68% need more detail, 54% want scripts"
// Used in Creator dashboards to identify content to improve or expand

// Creator dashboard metric
// The demographics that use each chatbot.
// Used in creator dashboards
// Runs nightly but is aggretated each month
model Chatbot_Audience_Profile {
  id                    String   @id @default(cuid())
  chatbotId             String
  chatbot               Chatbot  @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  
  industries            Json     // { "b2b_saas": 45, "e_commerce": 30, ... }
  roles                 Json     // { "founder": 60, "marketing_leader": 25, ... }
  stages                Json     // { "early_stage": 55, "growth_stage": 30, ... }
  
  avgConversationLength Int
  avgSessionDuration    Int      // Minutes
  returnRate            Float    // 0.0-1.0
  
  commonGoals           Json     // { "customer_acquisition": 40, "pricing": 30, ... }
  
  month                 Int      // 1-12
  year                  Int
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  @@unique([chatbotId, year, month])
  @@index([chatbotId])
}

// This is a really broad bunch of data that we determine about the user - using a flexible 'key' and 'value' that can be anything
// E.g. industry: real estate. goals: make a million dollars.
// It can be gleaned from intake questions, inferred from the conversations, and can be directly viewed/edited by the user.
// Also will be used to save intelligence learned about the user. E.g. Mastered concepts, in progress concepts, struggled concepts, expertise level.
model User_Context {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation("UserContext", fields: [userId], references: [id], onDelete: Cascade)
  chatbotId       String?  // Null = global context
  chatbot         Chatbot? @relation("ChatbotContext", fields: [chatbotId], references: [id], onDelete: Cascade)
  
  key             String
  value           Json
  source          ContextSource
  confidence      Float?
  
  expiresAt       DateTime?
  isVisible       Boolean  @default(true)
  isEditable      Boolean  @default(true)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([userId, chatbotId, key])
  @@index([userId])
  @@index([chatbotId])
}

enum ContextSource {
  USER_PROVIDED
  INFERRED
  INTAKE_FORM
  PLATFORM_SYNC
}

// Creator dashboard metric. 
// Tracks the revenue each creator makes each month
// Not used for payouts. Revenue_Per_Conversation determines payouts.
model Creator_Revenue_Summary {
  id                String   @id @default(cuid())
  creatorId         String
  creator           Creator  @relation("CreatorRevenue", fields: [creatorId], references: [id], onDelete: Cascade)
  
  month             Int      // 1-12
  year              Int
  
  totalRevenueCents Int      // Total earned this month
  creatorShareCents Int      // What creator received (after platform cut)
  platformShareCents Int     // What platform kept
  conversationCount Int      // How many conversations
  
  createdAt         DateTime @default(now())
  
  @@unique([creatorId, year, month])
  @@index([creatorId])
}

// A record of each source used in a conversation. Records are updated as the conversation goes on.
// Used to calculate what sources were used in the conversation when it is completed, and how to distribute the revenue
// We dont want to have to parse Messages > JSONB field to do it (they are for debugging), so we keep track here
// Also used in Creator dashboards
// Also will be used to discover how Creator A's approach complements Creator B's for people's specific situations
model Conversation_Source_Usage {
  id                String   @id @default(cuid())
  conversationId    String
  conversation      Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sourceId          String
  source            Source   @relation("SourceUsage", fields: [sourceId], references: [id], onDelete: Cascade)
  
  totalTokens       Int      // Aggregated from messages
  messageCount       Int      // How many messages used this source
  firstUsedAt       DateTime
  lastUsedAt        DateTime
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@unique([conversationId, sourceId])
  @@index([conversationId])
  @@index([sourceId])
}

// The subscription purchased by a company
// E.g. They pay $10k/month for all access for their users
// Each month we calculate the source tokens used by each of their users (from Conversation_Source_Usage)
// We allocate the $10k across those sources.
model Enterprise_Subscription {
  id                  String   @id @default(cuid())
  companyName         String
  seats                Int
  amountCents          Int
  currency             String
  startsAt             DateTime
  endsAt               DateTime
  status               SubscriptionStatus
  stripeSubscriptionId String
  
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  users                Enterprise_User[]
  
  @@index([status])
  @@index([stripeSubscriptionId])
}

enum SubscriptionStatus {
  ACTIVE
  CANCELLED
  EXPIRED
}

// The users that have been added to a company's enterprise subscription
model Enterprise_User {
  id              String   @id @default(cuid())
  subscriptionId  String
  subscription    Enterprise_Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  userId          String
  user            User     @relation("EnterpriseMembers", fields: [userId], references: [id], onDelete: Cascade)
  role            EnterpriseRole
  
  createdAt       DateTime @default(now())
  
  @@unique([subscriptionId, userId])
  @@index([subscriptionId])
  @@index([userId])
}

enum EnterpriseRole {
  ADMIN
  MEMBER
}
```

## Database Indexes for Performance

Critical indexes for the Creator Intelligence system:

### Message_Analysis

- `messageId` (unique) - Primary lookup to link analysis to message

- `analyzedAt` - For batch processing and cleanup queries

### Message_Feedback

- `messageId` - Link feedback to messages

- `feedbackType` - Filter by feedback type ('helpful', 'not_helpful', 'need_more', 'copy')

- `createdAt` - Time-based queries for aggregation jobs

### Message

- `conversationId` - Get all messages in a conversation

- `(conversationId, createdAt)` - Messages in chronological order

- `role` - Filter by user vs assistant messages

- `senderUserId` - User message history across conversations

### Conversation_Feedback

- `conversationId` (unique) - Primary lookup

- `goalAchieved` - Filter by achievement status for content gap analysis

- `createdAt` - Time-based queries

### Content_Gap

Aggregates unmet demand into content creation roadmap

- `topicRequested`: Representative question for this gap (e.g., "How do I handle 'your price is too high' in SaaS sales?")
  - Uses actual user questions as topic names (NOT abstract LLM-generated labels)
  - Discovered by clustering similar user questions via embeddings
  - Uses most-asked question in cluster as the representative
- `specificQuestion`: First question that revealed this gap (for reference)
- `requestCount`: How many times this has been requested
- `formatRequested`: ['script', 'template', 'checklist', 'example', 'steps']
- `userContexts`: [{ userId, situation: "I'm a SaaS founder..." }] - raw user contexts, no processing
- `relatedChunkIds`: Chunks that partially addressed this but didn't satisfy
- `status`: 'open' | 'planned' | 'created' - lifecycle tracking for creator workflow

Populated by nightly job: 
1. Get Message_Feedback with 'need_more' type
2. Cluster similar questions by embedding similarity (simple, no LLM extraction)
3. Use most common question as representative
4. Aggregate format preferences and user contexts

Simplified approach: No semantic topic extraction, just cluster + aggregate

Shows creators "47 users need SaaS pricing scripts" with actual user situations

Used in Creator dashboards to prioritize content creation

- `(chatbotId, status)` - Creator dashboard queries filtering by status

- `requestCount` - Sort by demand (most requested gaps)

- `(chatbotId, topicRequested)` (unique) - Upsert operations in aggregation jobs

- `lastRequestedAt` - Identify stale/recent gaps

### Chunk_Performance

- `(chunkId, chatbotId, month, year)` (unique) - Composite primary key for monthly tracking

- `sourceId` - Aggregate chunk performance to source level

- `(chatbotId, month, year)` - Dashboard queries by chatbot and time period

- `satisfactionSum`, `satisfactionCount`, `responseCount` - For computed avgSatisfaction sorting

  Note: avgSatisfaction computed as satisfactionSum/satisfactionCount on read, not stored

### Source_Performance

- `(sourceId, chatbotId, month, year)` (unique) - Monthly aggregates per source

- `chatbotId` - Creator dashboard queries

- `avgSatisfaction` - Sort by quality

### Question_Cluster_Aggregate

- `(chatbotId, date)` - Daily aggregates

- `timesAsked` - Sort by frequency

## Examples & Templates

<details>
<summary><strong>Message.attribution JSON Structure</strong></summary>

```json
{
  "sourcesUsed": [
    {
      "sourceId": "3454",
      "creatorId": "664",
      "tokenCount": 200,
      "chunkIds": ["chunk_123"],
      "citations": [
        {
          "text": "quoted text from source",
          "page": 42,
          "chunkId": "chunk_123"
        }
      ]
    }
  ],
  "totalTokens": 200,
  "model": "claude-sonnet-4"
}
```
</details>

<details>
<summary><strong>Message.context JSON Structure</strong></summary>

```json
{
  "used": {
    "business_type": { "value": "b2b_saas", "source": "USER_PROVIDED" },
    "current_mrr": { "value": 15000, "source": "INFERRED" }
  },
  "learned": {
    "target_market": {
      "key": "target_market",
      "value": { "segment": "enterprise", "size": "500+" },
      "confidence": 0.8,
      "source": "INFERRED"
    }
  }
}
```
</details>

<details>
<summary><strong>Default SEO Schema JSON</strong></summary>

```json
{
  "url": "",
  "name": "",
  "@type": "WebApplication",
  "review": [
    {
      "@type": "Review",
      "author": {
        "name": "",
        "@type": "Person"
      },
      "reviewBody": "",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": ""
      },
      "datePublished": ""
    }
  ],
  "@context": "https://schema.org",
  "publisher": {
    "url": "",
    "name": "",
    "@type": "Organization"
  },
  "installUrl": "",
  "description": "",
  "dateModified": "",
  "thumbnailUrl": "",
  "datePublished": "",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingCount": "",
    "ratingValue": ""
  },
  "operatingSystem": "Any",
  "softwareVersion": "1",
  "applicationCategory": "BusinessApplication",
  "browserRequirements": "Requires a modern web browser with JavaScript enabled",
  "applicationSubCategory": "Project Management"
}
```
</details>

<details>
<summary><strong>MVP Implementation Checklist</strong></summary>

- [ ] Create Source table migration
- [ ] Create Source_Creator join table migration (with indexes on creatorId and sourceId)
- [ ] Add File.sourceId (nullable FK)
- [ ] Add File.isActive, File.replacedByFileId
- [ ] Source CRUD API (create, read, update, delete)
- [ ] Source-Creator linking API (add/remove source from creator)
- [ ] Creator sources query API (get all sources for a creator - efficient with join table)
- [ ] Link source to file during/after upload
- [ ] Update ingestion: store sourceId in Pinecone chunk metadata
- [ ] File replacement flow: mark old inactive, delete old chunks, ingest new
- [ ] Citation display: lookup Source by sourceId in RAG endpoint
- [ ] Store citations in Message.attribution
</details>

<details>
<summary><strong>Future Extensions</strong></summary>

- [ ] File_Creator join table (file sharing)
- [ ] Creator_User join table (multi-user creators)
- [ ] Soft deletes (deletedAt fields)
- [ ] Source versioning
</details>

## Creator Intelligence System Summary

### Key Tables

- `Chunk_Performance`: Individual content section performance with rich feedback
  - Format preferences computed as aggregate: Sum of needsScriptsCount, needsExamplesCount, etc.
  - Displayed as summary widget at top of dashboard (not separate section)
  - Shows: "Your audience prefers Scripts (67%), Examples (54%), Steps (48%)"

- `Source_Performance`: Monthly aggregates showing how sources perform across conversations

- `Question_Cluster_Aggregate`: Daily snapshots of question volume and trends (all questions)

- `Content_Gap`: Unmet demand aggregated into content creation roadmap (only unmet needs)

- `Message_Analysis`: Async sentiment analysis of user messages

- `Message_Feedback`: Structured feedback on individual messages

- `Conversation_Feedback`: End-of-conversation feedback and goal achievement

### Understanding Question_Cluster vs Content_Gap

These tables serve different purposes and are both valuable:

**Question_Cluster_Aggregate:**

- Purpose: "What are people asking about?" (descriptive)

- Shows: ALL questions, including those answered well

- Use case: "Discovery calls get 89 questions with 4.6★ - promote this content!"

- Value: Identify popular topics for promotion, see trends over time

**Content_Gap:**

- Purpose: "What content should I create?" (prescriptive)

- Shows: ONLY unmet needs (where users clicked "need more" or "not helpful")

- Use case: "47 requests for pricing scripts with 2.1★ - create this content!"

- Value: Actionable creation roadmap with user contexts and format preferences

**Together they provide:**

- Question_Cluster: Total demand landscape (what's being asked)

- Content_Gap: Specific gaps to fill (what's missing or broken)

- Chunk_Performance: Quality of existing content (what's working/not working)

### Creator Dashboard Views

Main View - Content Performance:

1. Format Preferences Summary Widget - Aggregate view at top showing preferred content formats

2. Underperforming Content - What to fix (quality-driven with actual text shown)

3. Top Performing Content - What works (validation + template)

Content Roadmap Section:

4. Content Gaps - What to create next (unmet demand with user contexts)

5. Question Volume - What topics are popular (all questions, for promotion and planning)

Navigation Layer:

6. Source Performance - Drill-down entry point (overview → chapters → chunks)

### Data Flows

1. User asks → Bot responds using chunks (stored in Message.context.chunks)

2. User responds → Message_Analysis extracts sentiment (links to previous bot message)

3. User gives feedback → Message_Feedback captures structured responses

4. Nightly job: Attribute sentiment to chunks → Update Chunk_Performance

5. Nightly job: Cluster feedback by question similarity → Create/update Content_Gap (simplified - no semantic extraction)

6. Daily job: Cluster questions in Pinecone → Update Question_Cluster_Aggregate (reuses existing infrastructure)

7. Monthly job: Aggregate chunks → Update Source_Performance

8. Dashboard: 
   - Main view shows Chunk_Performance with Format Preferences widget at top
   - Content Roadmap shows Content_Gap (unmet demand) + Question_Cluster (total volume)
   - All with actual text, user quotes, and actionable insights

### Simplifications from Original Design

1. **Content_Gap:** Uses representative questions (actual user questions) instead of LLM-generated semantic topic names
   - Simpler: No complex topic extraction or ontology
   - More concrete: Creators see actual questions, not abstract categories
   - Still clusters: Groups similar questions by embedding similarity

2. **Question_Cluster_Aggregate:** Reuses existing Pinecone question embeddings
   - No separate clustering pipeline
   - Just counts and aggregates what's already in Pinecone
   - Daily snapshots for trend analysis

3. **Format Preferences:** Not a separate dashboard section
   - Summary widget at top of Chunk_Performance view
   - Simple aggregation query, not separate table or complex logic
   - Shows aggregate preferences across all content

**Result:** Same value, less complexity, more maintainable

## Commands

```bash
npx prisma init
npx prisma migrate dev --name init
```
