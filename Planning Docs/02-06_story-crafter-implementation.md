# Story Crafter Chatbot - Implementation Guide

> LLM-ready implementation steps for creating the Story Crafter chatbot on Pocket Genius.

**Created:** 2026-02-06
**Status:** Ready for implementation
**Prerequisites:**
- Source `scrum_guide` exists and is vectorized in Pinecone namespace `creator-scrum_genius`
- Creator `scrum_genius` exists (id: `scrum_genius`, slug: `scrum-genius`)
- **Separate task:** Chat API route (`app/api/chat/route.ts`) must be updated to use `chatbot.systemPrompt` with `{intake.SLUG}` and `{rag_context}` substitution. Currently the route uses a hardcoded generic prompt. This seed script creates the data; the chat route update makes it functional.

---

## Overview

Story Crafter generates INVEST-compliant user stories with proper personas, value statements, and acceptance criteria. It uses RAG to ground responses in best practices from Mike Cohn, Roman Pichler, and the Scrum Guide.

### Template Variable Convention

System prompts use `{intake.SLUG}` placeholders where `SLUG` is the intake question's `slug` field (underscored). At chat time, the chat API route substitutes each placeholder with the user's intake response value. The slug is the canonical key — no separate mapping is needed.

Example: question with `slug: "sc_product_area"` is referenced in the prompt as `{intake.sc_product_area}`.

RAG context uses `{rag_context}` which is replaced with retrieved Pinecone chunks.

---

## Step 1: Create Creator_User Link

Link the creator to the owner user account.

### Database Record

```
Model: Creator_User
Fields:
  id: (auto-generated cuid)
  creatorId: "scrum_genius"
  userId: "cmj256oei0000chlu8qmj8fs0"
  role: "OWNER"
  createdAt: (auto now())
  updatedAt: (auto now())
```

### Prisma Command

```typescript
await prisma.creator_User.create({
  data: {
    creatorId: "scrum_genius",
    userId: "cmj256oei0000chlu8qmj8fs0",
    role: "OWNER",
  },
});
```

---

## Step 2: Create Chatbot Record

### Database Record

```
Model: Chatbot
Fields:
  id: "story_crafter" (explicit ID for easy reference)
  title: "Story Crafter"
  creatorId: "scrum_genius"
  slug: "story-crafter"
  description: "Generates INVEST-compliant user stories with proper personas, value statements, and acceptance criteria. Based on best practices from Mike Cohn, Roman Pichler, and the Scrum Guide 2020. Stop wasting sprint time clarifying vague stories."
  shortDescription: "User stories that don't need refinement meetings to fix"
  imageUrl: null (add later)
  isPublic: true
  allowAnonymous: false
  publicDashboard: false
  type: "FRAMEWORK"
  priceCents: 0
  currency: "USD"
  isActive: true
  systemPrompt: (see below)
  modelProvider: "openai"
  modelName: "gpt-4o"
  pineconeNs: "creator-scrum_genius"
  vectorNamespace: "creator-scrum_genius"
  configJson: { "enableFollowUpPills": true }
  ragSettingsJson: { "topK": 5, "minScore": 0.7 }
  welcomeMessage: "I'm Story Crafter! I help you write INVEST-compliant user stories with clear personas, acceptance criteria in Given-When-Then format, and explicit value statements. What feature would you like to create a story for?"
  fallbackSuggestionPills: ["Write a user story for user login", "Help me split this epic into stories", "What makes a good acceptance criterion?"]
```

### System Prompt

```
You are Story Crafter, an expert at writing INVEST-compliant user stories for Scrum teams.

## Your Knowledge
You have access to best practices from Mike Cohn, Roman Pichler, and the Scrum Guide. Use the retrieved context to ground your recommendations in established practices. Always cite sources when referencing specific frameworks or techniques.

## User Context
The user has provided the following context through intake questions:
- Product/Feature Area: {intake.sc_product_area}
- User Persona: {intake.sc_persona}
- What the user needs: {intake.sc_user_need}
- Why they need it: {intake.sc_why}
- Known acceptance criteria: {intake.sc_acceptance_criteria}
- Complexity estimate: {intake.sc_complexity}
- Technical constraints: {intake.sc_constraints}

## Your Task
When asked to generate a user story, create a complete story with all required elements. When asked questions about user stories or Scrum practices, respond conversationally without forcing the structured format.

## Output Format (for story generation)
When generating a user story, format your response as follows:

## User Story
**As a** [specific persona - use the provided persona, make it concrete and relatable]
**I want to** [need - what capability or action]
**So that** [benefit - why this matters, the value delivered]

## Acceptance Criteria
1. **Given** [context/precondition] **When** [action/trigger] **Then** [expected outcome]
2. **Given** [context] **When** [action] **Then** [outcome]
3. [Continue for 3-5 criteria total]

## Complexity: [XS/S/M/L/XL]
[Brief justification based on user's estimate and the scope]

## Edge Cases to Consider
- [edge case 1 - potential failure scenario or unusual input]
- [edge case 2]
- [Continue as needed]

## INVEST Compliance
- **Independent:** [Yes/No - can this be developed without depending on other stories?]
- **Negotiable:** [Yes/No - is there room for discussion on implementation details?]
- **Valuable:** [Yes/No - does it deliver clear value to the user?]
- **Estimable:** [Yes/No - can the team reasonably estimate this?]
- **Small:** [Yes/No - can it be completed in one sprint?]
- **Testable:** [Yes/No - can we verify when it's done?]

[If any INVEST criteria fail, suggest how to fix it]

---
Generated by Story Crafter | Try it free at mypocketgenius.com/story-crafter

## Guidelines
- Make the persona specific and relatable (not generic "As a user")
- The value statement should answer "why does this matter to the business or user?"
- Acceptance criteria must be testable - if you can't verify it, rewrite it
- Flag any INVEST violations with specific suggestions to fix
- If the request is too large for one story, suggest how to split it using SPIDR or workflow steps
- When suggesting complexity, consider the user's provided estimate but adjust if scope seems different

## What NOT to Do
- Don't prescribe implementation details (e.g., "using React" or "via REST API") unless constraints require it
- Don't create compound stories with multiple "and" conjunctions in the need
- Don't write acceptance criteria that merely restate the story narrative
- Don't ignore the user's provided context - incorporate their constraints and known criteria

## Retrieved Best Practices
{rag_context}
```

### Prisma Command

```typescript
const systemPrompt = `[paste the system prompt above]`;

await prisma.chatbot.create({
  data: {
    id: "story_crafter",
    title: "Story Crafter",
    creatorId: "scrum_genius",
    slug: "story-crafter",
    description: "Generates INVEST-compliant user stories with proper personas, value statements, and acceptance criteria. Based on best practices from Mike Cohn, Roman Pichler, and the Scrum Guide 2020. Stop wasting sprint time clarifying vague stories.",
    shortDescription: "User stories that don't need refinement meetings to fix",
    isPublic: true,
    allowAnonymous: false,
    publicDashboard: false,
    type: "FRAMEWORK",
    priceCents: 0,
    currency: "USD",
    isActive: true,
    systemPrompt: systemPrompt,
    modelProvider: "openai",
    modelName: "gpt-4o",
    pineconeNs: "creator-scrum_genius",
    vectorNamespace: "creator-scrum_genius",
    configJson: { enableFollowUpPills: true },
    ragSettingsJson: { topK: 5, minScore: 0.7 },
    welcomeMessage: "I'm Story Crafter! I help you write INVEST-compliant user stories with clear personas, acceptance criteria in Given-When-Then format, and explicit value statements. What feature would you like to create a story for?",
    fallbackSuggestionPills: [
      "Write a user story for user login",
      "Help me split this epic into stories",
      "What makes a good acceptance criterion?"
    ],
  },
});
```

---

## Step 3: Create Intake Questions

Create 7 intake questions. These are global questions that can be reused across chatbots.

**Convention:** Slugs use underscores and match the `{intake.SLUG}` template variables in the system prompt exactly. The `sc_` prefix namespaces them to Story Crafter while keeping global uniqueness.

### Question 1: Product/Feature Area

```
Model: Intake_Question
Fields:
  id: "sc_product_area"
  slug: "sc_product_area"
  questionText: "What product or feature area is this story for?"
  helperText: "e.g., 'Mobile checkout flow' or 'Admin dashboard reporting'"
  responseType: "TEXT"
  options: Prisma.JsonNull
  createdByUserId: "cmj256oei0000chlu8qmj8fs0"
```

### Question 2: User Persona

```
Model: Intake_Question
Fields:
  id: "sc_persona"
  slug: "sc_persona"
  questionText: "Who is the primary user of this feature?"
  helperText: "Select the type of user who will benefit from this story"
  responseType: "SELECT"
  options: ["End customer", "Admin user", "Internal team member", "API consumer", "Other"]
  createdByUserId: "cmj256oei0000chlu8qmj8fs0"
```

### Question 3: User Need

```
Model: Intake_Question
Fields:
  id: "sc_user_need"
  slug: "sc_user_need"
  questionText: "What does this user need to do?"
  helperText: "Describe the action or capability, e.g., 'filter search results by date range'"
  responseType: "TEXT"
  options: Prisma.JsonNull
  createdByUserId: "cmj256oei0000chlu8qmj8fs0"
```

### Question 4: Why (Value Statement)

```
Model: Intake_Question
Fields:
  id: "sc_why"
  slug: "sc_why"
  questionText: "Why do they need this? What problem does it solve?"
  helperText: "This becomes the 'so that...' part of your story"
  responseType: "TEXT"
  options: Prisma.JsonNull
  createdByUserId: "cmj256oei0000chlu8qmj8fs0"
```

### Question 5: Known Acceptance Criteria

```
Model: Intake_Question
Fields:
  id: "sc_acceptance_criteria"
  slug: "sc_acceptance_criteria"
  questionText: "Are there specific acceptance criteria you already know?"
  helperText: "Optional - paste any requirements or conditions that must be met"
  responseType: "TEXT"
  options: Prisma.JsonNull
  createdByUserId: "cmj256oei0000chlu8qmj8fs0"
```

### Question 6: Complexity

```
Model: Intake_Question
Fields:
  id: "sc_complexity"
  slug: "sc_complexity"
  questionText: "What's the rough complexity?"
  helperText: "Your initial estimate helps calibrate the story scope"
  responseType: "SELECT"
  options: ["Small (under 1 day)", "Medium (1-3 days)", "Large (3-5 days)", "Epic (needs splitting)", "Not sure"]
  createdByUserId: "cmj256oei0000chlu8qmj8fs0"
```

### Question 7: Technical Constraints

```
Model: Intake_Question
Fields:
  id: "sc_constraints"
  slug: "sc_constraints"
  questionText: "Any technical constraints or dependencies?"
  helperText: "Optional - mention API limitations, existing systems, or blockers"
  responseType: "TEXT"
  options: Prisma.JsonNull
  createdByUserId: "cmj256oei0000chlu8qmj8fs0"
```

### Prisma Command (All Questions)

```typescript
import { Prisma } from '@prisma/client';

const questions = [
  {
    id: "sc_product_area",
    slug: "sc_product_area",
    questionText: "What product or feature area is this story for?",
    helperText: "e.g., 'Mobile checkout flow' or 'Admin dashboard reporting'",
    responseType: "TEXT" as const,
    options: Prisma.JsonNull,
  },
  {
    id: "sc_persona",
    slug: "sc_persona",
    questionText: "Who is the primary user of this feature?",
    helperText: "Select the type of user who will benefit from this story",
    responseType: "SELECT" as const,
    options: ["End customer", "Admin user", "Internal team member", "API consumer", "Other"],
  },
  {
    id: "sc_user_need",
    slug: "sc_user_need",
    questionText: "What does this user need to do?",
    helperText: "Describe the action or capability, e.g., 'filter search results by date range'",
    responseType: "TEXT" as const,
    options: Prisma.JsonNull,
  },
  {
    id: "sc_why",
    slug: "sc_why",
    questionText: "Why do they need this? What problem does it solve?",
    helperText: "This becomes the 'so that...' part of your story",
    responseType: "TEXT" as const,
    options: Prisma.JsonNull,
  },
  {
    id: "sc_acceptance_criteria",
    slug: "sc_acceptance_criteria",
    questionText: "Are there specific acceptance criteria you already know?",
    helperText: "Optional - paste any requirements or conditions that must be met",
    responseType: "TEXT" as const,
    options: Prisma.JsonNull,
  },
  {
    id: "sc_complexity",
    slug: "sc_complexity",
    questionText: "What's the rough complexity?",
    helperText: "Your initial estimate helps calibrate the story scope",
    responseType: "SELECT" as const,
    options: ["Small (under 1 day)", "Medium (1-3 days)", "Large (3-5 days)", "Epic (needs splitting)", "Not sure"],
  },
  {
    id: "sc_constraints",
    slug: "sc_constraints",
    questionText: "Any technical constraints or dependencies?",
    helperText: "Optional - mention API limitations, existing systems, or blockers",
    responseType: "TEXT" as const,
    options: Prisma.JsonNull,
  },
];

for (const q of questions) {
  await prisma.intake_Question.create({
    data: {
      ...q,
      createdByUserId: OWNER_USER_ID,
    },
  });
}
```

---

## Step 4: Link Intake Questions to Chatbot

Create junction table entries linking each question to the chatbot with display order and required flags.

### Junction Table Records

| displayOrder | intakeQuestionId | isRequired |
|--------------|------------------|------------|
| 1 | sc_product_area | true |
| 2 | sc_persona | true |
| 3 | sc_user_need | true |
| 4 | sc_why | true |
| 5 | sc_acceptance_criteria | false |
| 6 | sc_complexity | false |
| 7 | sc_constraints | false |

### Prisma Command

```typescript
const questionLinks = [
  { intakeQuestionId: "sc_product_area", displayOrder: 1, isRequired: true },
  { intakeQuestionId: "sc_persona", displayOrder: 2, isRequired: true },
  { intakeQuestionId: "sc_user_need", displayOrder: 3, isRequired: true },
  { intakeQuestionId: "sc_why", displayOrder: 4, isRequired: true },
  { intakeQuestionId: "sc_acceptance_criteria", displayOrder: 5, isRequired: false },
  { intakeQuestionId: "sc_complexity", displayOrder: 6, isRequired: false },
  { intakeQuestionId: "sc_constraints", displayOrder: 7, isRequired: false },
];

for (const link of questionLinks) {
  await prisma.chatbot_Intake_Question.create({
    data: {
      chatbotId: "story_crafter",
      ...link,
    },
  });
}
```

---

## Step 5: Link Source to Chatbot

Create the junction table entry linking the Scrum Guide source to the chatbot.

### Database Record

```
Model: Chatbot_Source
Fields:
  id: (auto-generated cuid)
  chatbotId: "story_crafter"
  sourceId: "scrum_guide"
  isActive: true
  addedAt: (auto now())
```

### Prisma Command

```typescript
await prisma.chatbot_Source.create({
  data: {
    chatbotId: "story_crafter",
    sourceId: "scrum_guide",
    isActive: true,
  },
});
```

---

## Step 6: Create Initial Chatbot Version

Create an immutable version snapshot for conversation tracking.

### Database Record

```
Model: Chatbot_Version
Fields:
  id: "story_crafter_v1"
  chatbotId: "story_crafter"
  versionNumber: 1
  title: "Story Crafter"
  description: "Initial release"
  systemPrompt: (same as chatbot)
  modelProvider: "openai"
  modelName: "gpt-4o"
  pineconeNs: "creator-scrum_genius"
  vectorNamespace: "creator-scrum_genius"
  configJson: { enableFollowUpPills: true }
  ragSettingsJson: { topK: 5, minScore: 0.7 }
  allowAnonymous: false
  priceCents: 0
  currency: "USD"
  type: "FRAMEWORK"
  notes: "Initial release of Story Crafter"
  changelog: "Initial version"
  createdByUserId: "cmj256oei0000chlu8qmj8fs0"
  activatedAt: (now)
```

### Prisma Command

```typescript
const version = await prisma.chatbot_Version.create({
  data: {
    id: "story_crafter_v1",
    chatbotId: "story_crafter",
    versionNumber: 1,
    title: "Story Crafter",
    description: "Initial release",
    systemPrompt: systemPrompt, // Same as chatbot
    modelProvider: "openai",
    modelName: "gpt-4o",
    pineconeNs: "creator-scrum_genius",
    vectorNamespace: "creator-scrum_genius",
    configJson: { enableFollowUpPills: true },
    ragSettingsJson: { topK: 5, minScore: 0.7 },
    allowAnonymous: false,
    priceCents: 0,
    currency: "USD",
    type: "FRAMEWORK",
    notes: "Initial release of Story Crafter",
    changelog: "Initial version",
    createdByUserId: "cmj256oei0000chlu8qmj8fs0",
    activatedAt: new Date(),
  },
});

// Update chatbot to point to this version
await prisma.chatbot.update({
  where: { id: "story_crafter" },
  data: { currentVersionId: version.id },
});
```

---

## Complete Seed Script

Save as `scripts/seed-story-crafter.ts` and run with `npx tsx scripts/seed-story-crafter.ts`

```typescript
// scripts/seed-story-crafter.ts
// Creates the Story Crafter chatbot with all related records

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const OWNER_USER_ID = "cmj256oei0000chlu8qmj8fs0";
const CREATOR_ID = "scrum_genius";
const CHATBOT_ID = "story_crafter";
const SOURCE_ID = "scrum_guide";

const systemPrompt = `You are Story Crafter, an expert at writing INVEST-compliant user stories for Scrum teams.

## Your Knowledge
You have access to best practices from Mike Cohn, Roman Pichler, and the Scrum Guide. Use the retrieved context to ground your recommendations in established practices. Always cite sources when referencing specific frameworks or techniques.

## User Context
The user has provided the following context through intake questions:
- Product/Feature Area: {intake.sc_product_area}
- User Persona: {intake.sc_persona}
- What the user needs: {intake.sc_user_need}
- Why they need it: {intake.sc_why}
- Known acceptance criteria: {intake.sc_acceptance_criteria}
- Complexity estimate: {intake.sc_complexity}
- Technical constraints: {intake.sc_constraints}

## Your Task
When asked to generate a user story, create a complete story with all required elements. When asked questions about user stories or Scrum practices, respond conversationally without forcing the structured format.

## Output Format (for story generation)
When generating a user story, format your response as follows:

## User Story
**As a** [specific persona - use the provided persona, make it concrete and relatable]
**I want to** [need - what capability or action]
**So that** [benefit - why this matters, the value delivered]

## Acceptance Criteria
1. **Given** [context/precondition] **When** [action/trigger] **Then** [expected outcome]
2. **Given** [context] **When** [action] **Then** [outcome]
3. [Continue for 3-5 criteria total]

## Complexity: [XS/S/M/L/XL]
[Brief justification based on user's estimate and the scope]

## Edge Cases to Consider
- [edge case 1 - potential failure scenario or unusual input]
- [edge case 2]
- [Continue as needed]

## INVEST Compliance
- **Independent:** [Yes/No - can this be developed without depending on other stories?]
- **Negotiable:** [Yes/No - is there room for discussion on implementation details?]
- **Valuable:** [Yes/No - does it deliver clear value to the user?]
- **Estimable:** [Yes/No - can the team reasonably estimate this?]
- **Small:** [Yes/No - can it be completed in one sprint?]
- **Testable:** [Yes/No - can we verify when it's done?]

[If any INVEST criteria fail, suggest how to fix it]

---
Generated by Story Crafter | Try it free at mypocketgenius.com/story-crafter

## Guidelines
- Make the persona specific and relatable (not generic "As a user")
- The value statement should answer "why does this matter to the business or user?"
- Acceptance criteria must be testable - if you can't verify it, rewrite it
- Flag any INVEST violations with specific suggestions to fix
- If the request is too large for one story, suggest how to split it using SPIDR or workflow steps
- When suggesting complexity, consider the user's provided estimate but adjust if scope seems different

## What NOT to Do
- Don't prescribe implementation details (e.g., "using React" or "via REST API") unless constraints require it
- Don't create compound stories with multiple "and" conjunctions in the need
- Don't write acceptance criteria that merely restate the story narrative
- Don't ignore the user's provided context - incorporate their constraints and known criteria

## Retrieved Best Practices
{rag_context}`;

async function main() {
  console.log("Starting Story Crafter seed...\n");

  // Step 0: Verify prerequisites exist
  console.log("Step 0: Verifying prerequisites...");
  const creator = await prisma.creator.findUnique({ where: { id: CREATOR_ID } });
  if (!creator) {
    throw new Error(
      `Creator "${CREATOR_ID}" not found. ` +
      'Please create the creator record before running this seed script.'
    );
  }
  console.log(`  Found creator: ${creator.name} (${creator.id})`);

  const source = await prisma.source.findUnique({ where: { id: SOURCE_ID } });
  if (!source) {
    throw new Error(
      `Source "${SOURCE_ID}" not found. ` +
      'Please create and ingest the source before running this seed script.'
    );
  }
  console.log(`  Found source: ${source.title} (${source.id})`);

  const ownerUser = await prisma.user.findUnique({ where: { id: OWNER_USER_ID } });
  if (!ownerUser) {
    throw new Error(
      `User "${OWNER_USER_ID}" not found. ` +
      'Please verify the OWNER_USER_ID constant is correct.'
    );
  }
  console.log(`  Found owner user: ${ownerUser.email} (${ownerUser.id})`);

  // Step 1: Create Creator_User link
  console.log("\nStep 1: Creating Creator_User link...");
  const existingLink = await prisma.creator_User.findFirst({
    where: { creatorId: CREATOR_ID, userId: OWNER_USER_ID },
  });
  if (!existingLink) {
    await prisma.creator_User.create({
      data: {
        creatorId: CREATOR_ID,
        userId: OWNER_USER_ID,
        role: "OWNER",
      },
    });
    console.log("  Creator_User link created");
  } else {
    console.log("  Creator_User link already exists");
  }

  // Step 2: Create Chatbot
  console.log("\nStep 2: Creating Chatbot...");
  const existingChatbot = await prisma.chatbot.findUnique({ where: { id: CHATBOT_ID } });
  if (!existingChatbot) {
    await prisma.chatbot.create({
      data: {
        id: CHATBOT_ID,
        title: "Story Crafter",
        creatorId: CREATOR_ID,
        slug: "story-crafter",
        description: "Generates INVEST-compliant user stories with proper personas, value statements, and acceptance criteria. Based on best practices from Mike Cohn, Roman Pichler, and the Scrum Guide 2020. Stop wasting sprint time clarifying vague stories.",
        shortDescription: "User stories that don't need refinement meetings to fix",
        isPublic: true,
        allowAnonymous: false,
        publicDashboard: false,
        type: "FRAMEWORK",
        priceCents: 0,
        currency: "USD",
        isActive: true,
        systemPrompt: systemPrompt,
        modelProvider: "openai",
        modelName: "gpt-4o",
        pineconeNs: `creator-${CREATOR_ID}`,
        vectorNamespace: `creator-${CREATOR_ID}`,
        configJson: { enableFollowUpPills: true },
        ragSettingsJson: { topK: 5, minScore: 0.7 },
        welcomeMessage: "I'm Story Crafter! I help you write INVEST-compliant user stories with clear personas, acceptance criteria in Given-When-Then format, and explicit value statements. What feature would you like to create a story for?",
        fallbackSuggestionPills: [
          "Write a user story for user login",
          "Help me split this epic into stories",
          "What makes a good acceptance criterion?"
        ],
      },
    });
    console.log("  Chatbot created");
  } else {
    console.log("  Chatbot already exists");
  }

  // Step 3: Create Intake Questions
  console.log("\nStep 3: Creating Intake Questions...");
  const questions = [
    {
      id: "sc_product_area",
      slug: "sc_product_area",
      questionText: "What product or feature area is this story for?",
      helperText: "e.g., 'Mobile checkout flow' or 'Admin dashboard reporting'",
      responseType: "TEXT" as const,
      options: Prisma.JsonNull,
    },
    {
      id: "sc_persona",
      slug: "sc_persona",
      questionText: "Who is the primary user of this feature?",
      helperText: "Select the type of user who will benefit from this story",
      responseType: "SELECT" as const,
      options: ["End customer", "Admin user", "Internal team member", "API consumer", "Other"],
    },
    {
      id: "sc_user_need",
      slug: "sc_user_need",
      questionText: "What does this user need to do?",
      helperText: "Describe the action or capability, e.g., 'filter search results by date range'",
      responseType: "TEXT" as const,
      options: Prisma.JsonNull,
    },
    {
      id: "sc_why",
      slug: "sc_why",
      questionText: "Why do they need this? What problem does it solve?",
      helperText: "This becomes the 'so that...' part of your story",
      responseType: "TEXT" as const,
      options: Prisma.JsonNull,
    },
    {
      id: "sc_acceptance_criteria",
      slug: "sc_acceptance_criteria",
      questionText: "Are there specific acceptance criteria you already know?",
      helperText: "Optional - paste any requirements or conditions that must be met",
      responseType: "TEXT" as const,
      options: Prisma.JsonNull,
    },
    {
      id: "sc_complexity",
      slug: "sc_complexity",
      questionText: "What's the rough complexity?",
      helperText: "Your initial estimate helps calibrate the story scope",
      responseType: "SELECT" as const,
      options: ["Small (under 1 day)", "Medium (1-3 days)", "Large (3-5 days)", "Epic (needs splitting)", "Not sure"],
    },
    {
      id: "sc_constraints",
      slug: "sc_constraints",
      questionText: "Any technical constraints or dependencies?",
      helperText: "Optional - mention API limitations, existing systems, or blockers",
      responseType: "TEXT" as const,
      options: Prisma.JsonNull,
    },
  ];

  for (const q of questions) {
    const existing = await prisma.intake_Question.findUnique({ where: { id: q.id } });
    if (!existing) {
      await prisma.intake_Question.create({
        data: {
          ...q,
          createdByUserId: OWNER_USER_ID,
        },
      });
      console.log(`  Created question: ${q.slug}`);
    } else {
      console.log(`  Question already exists: ${q.slug}`);
    }
  }

  // Step 4: Link Intake Questions to Chatbot
  console.log("\nStep 4: Linking Intake Questions to Chatbot...");
  const questionLinks = [
    { intakeQuestionId: "sc_product_area", displayOrder: 1, isRequired: true },
    { intakeQuestionId: "sc_persona", displayOrder: 2, isRequired: true },
    { intakeQuestionId: "sc_user_need", displayOrder: 3, isRequired: true },
    { intakeQuestionId: "sc_why", displayOrder: 4, isRequired: true },
    { intakeQuestionId: "sc_acceptance_criteria", displayOrder: 5, isRequired: false },
    { intakeQuestionId: "sc_complexity", displayOrder: 6, isRequired: false },
    { intakeQuestionId: "sc_constraints", displayOrder: 7, isRequired: false },
  ];

  for (const link of questionLinks) {
    const existing = await prisma.chatbot_Intake_Question.findUnique({
      where: {
        intakeQuestionId_chatbotId: {
          intakeQuestionId: link.intakeQuestionId,
          chatbotId: CHATBOT_ID,
        },
      },
    });
    if (!existing) {
      await prisma.chatbot_Intake_Question.create({
        data: {
          chatbotId: CHATBOT_ID,
          ...link,
        },
      });
      console.log(`  Linked question: ${link.intakeQuestionId}`);
    } else {
      console.log(`  Link already exists: ${link.intakeQuestionId}`);
    }
  }

  // Step 5: Link Source to Chatbot
  console.log("\nStep 5: Linking Source to Chatbot...");
  const existingSourceLink = await prisma.chatbot_Source.findUnique({
    where: {
      chatbotId_sourceId: {
        chatbotId: CHATBOT_ID,
        sourceId: SOURCE_ID,
      },
    },
  });
  if (!existingSourceLink) {
    await prisma.chatbot_Source.create({
      data: {
        chatbotId: CHATBOT_ID,
        sourceId: SOURCE_ID,
        isActive: true,
      },
    });
    console.log("  Source linked to Chatbot");
  } else {
    console.log("  Source link already exists");
  }

  // Step 6: Create Chatbot Version
  console.log("\nStep 6: Creating Chatbot Version...");
  const versionId = "story_crafter_v1";
  const existingVersion = await prisma.chatbot_Version.findUnique({ where: { id: versionId } });
  if (!existingVersion) {
    const version = await prisma.chatbot_Version.create({
      data: {
        id: versionId,
        chatbotId: CHATBOT_ID,
        versionNumber: 1,
        title: "Story Crafter",
        description: "Initial release",
        systemPrompt: systemPrompt,
        modelProvider: "openai",
        modelName: "gpt-4o",
        pineconeNs: `creator-${CREATOR_ID}`,
        vectorNamespace: `creator-${CREATOR_ID}`,
        configJson: { enableFollowUpPills: true },
        ragSettingsJson: { topK: 5, minScore: 0.7 },
        allowAnonymous: false,
        priceCents: 0,
        currency: "USD",
        type: "FRAMEWORK",
        notes: "Initial release of Story Crafter",
        changelog: "Initial version",
        createdByUserId: OWNER_USER_ID,
        activatedAt: new Date(),
      },
    });
    console.log("  Chatbot Version created");

    // Update chatbot to point to this version
    await prisma.chatbot.update({
      where: { id: CHATBOT_ID },
      data: { currentVersionId: version.id },
    });
    console.log("  Chatbot updated with currentVersionId");
  } else {
    console.log("  Chatbot Version already exists");
  }

  console.log("\nStory Crafter seed complete!");
  console.log(`\nAccess the chatbot at: /chat/story-crafter`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## Verification Checklist

After running the seed script, verify:

- [ ] Creator_User record exists linking `scrum_genius` to `cmj256oei0000chlu8qmj8fs0`
- [ ] Chatbot `story_crafter` exists with slug `story-crafter`
- [ ] 7 Intake_Question records exist with `sc_` prefix and underscore slugs
- [ ] 7 Chatbot_Intake_Question junction records link questions to chatbot
- [ ] Chatbot_Source links `scrum_guide` to `story_crafter`
- [ ] Chatbot_Version `story_crafter_v1` exists and is set as currentVersionId
- [ ] Chatbot is accessible at `/chat/story-crafter`
- [ ] Intake form shows 7 questions in correct order
- [ ] RAG retrieval works (test query returns Scrum Guide chunks)
- [ ] **Separate task:** Chat route uses `chatbot.systemPrompt` with `{intake.SLUG}` substitution

---

## Post-Implementation: Add More Sources

After initial setup, add more sources to improve RAG quality:

1. Mike Cohn's user story materials (INVEST criteria, story splitting)
2. Roman Pichler's persona templates
3. BDD/Given-When-Then resources
4. Story splitting techniques (SPIDR method)

For each source:
1. Create Source record
2. Upload and ingest content to Pinecone namespace `creator-scrum_genius`
3. Create Chatbot_Source junction record

---

*Document version: 1.1*
*Updated: 2026-02-06*
*Changes: Aligned slug/template convention, Prisma.JsonNull for TEXT options, shared prisma import, prerequisite verification, "Other" persona option, allowAnonymous: false*
