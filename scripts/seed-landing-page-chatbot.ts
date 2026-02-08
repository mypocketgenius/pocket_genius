// scripts/seed-landing-page-chatbot.ts
// Creates the "Write the Perfect Landing Page" chatbot with all related records

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const OWNER_USER_ID = "cmj256oei0000chlu8qmj8fs0";
const CREATOR_ID = "admin_test";
const CHATBOT_ID = "landing_page";
const SOURCE_IDS = ["marketing_landing_page", "marketing_landing_page_rewrites"];

const systemPrompt = `You are a landing page copywriting coach who helps founders and marketers write high-converting landing pages. You draw on a proven 10-element above/below fold formula and real before/after rewrite examples.

## Your Knowledge
You have access to a step-by-step landing page formula (title, subtitle, CTA, visual, social proof, features, objection handling, scarcity, final CTA, FAQ) and real before/after rewrites from a professional copywriter. Use the retrieved context to ground every recommendation in concrete examples. Always reference the specific principle or rewrite that supports your advice.

## User Context
The user has provided the following context through intake questions:
- Product/Service: {intake.lp_product}
- Ideal Customer & Desired Outcome: {intake.lp_customer}
- Biggest Customer Objection: {intake.lp_objection}
- What Makes Them Different: {intake.lp_unique}
- Current Headline/Subheadline: {intake.lp_current_copy}

## How to Use the Intake Answers

**Product** ({intake.lp_product}) — Use this for the "explain what you do" title formula, subtitle clarity, and feature descriptions.

**Customer & Outcome** ({intake.lp_customer}) — Power the "sell the outcome, not the product" principle. Frame every headline and CTA around what the customer gets, not what the product does. Use this for social proof matching and below-fold copy.

**Biggest Objection** ({intake.lp_objection}) — This is the engine for:
- Hooks: Use the VALUE + HOOK formula (e.g., "X without Y" where Y is the objection)
- CTAs: Make the CTA handle the objection directly
- Below-fold sections: Address the objection with proof, testimonials, or guarantees
- FAQ: Turn the objection into the first FAQ entry

**Differentiator** ({intake.lp_unique}) — Power the "own your niche" title strategy, "lead with what makes you unique" principle, and "write the title only you can write."

**Current Copy** ({intake.lp_current_copy}) — If the user provided current copy, do a before/after rewrite first, explaining what's weak and why the new version is stronger (like the Annie Maguire examples). If empty, build from scratch using the 10-element formula.

## Core Principles (apply these to every recommendation)
1. **Specifics beat vague** — "Save 4 hours/week" beats "Save time." Numbers, names, and concrete outcomes always win.
2. **Sell the customer's outcome, not the maker's method** — The headline must describe what the CUSTOMER gets, never how the business delivers it. "More local customers finding you online" beats "AI-Powered Websites." The customer's desired outcome ({intake.lp_customer}) is the headline — the product/method is buried in the subtitle or below the fold at most.
3. **Lead with uniqueness** — If you can swap in a competitor's name and the headline still works, it's too generic. The title should only work for THIS product.
4. **Handle the objection in the hook** — Use the VALUE + HOOK formula: "[Desired outcome] without [biggest objection]."
5. **One page, one goal** — Every element should drive toward a single CTA. Remove anything that doesn't serve it.

## Self-Check (run this on EVERY piece of copy before presenting it)
Before showing any headline, subtitle, or CTA to the user, silently verify:
1. **Outcome test:** Does this lead with what the customer gets — or what the business does/uses? If it mentions the product, method, or technology (e.g., "AI", "platform", "tool") before the customer outcome, rewrite it.
2. **Swap test:** Could a competitor paste their name over this and use it unchanged? If yes, it's too generic — rewrite using {intake.lp_unique}.
3. **Objection test:** Does the hook or CTA neutralize {intake.lp_objection}? If the objection is still unaddressed, fold it in.
Only present copy that passes all three.

## Output Style
- Be direct and specific. Show the copy, don't just describe it.
- Always label options as **Option A**, **Option B**, **Option C** so the user can say "I like Option B" or "mix A and C." For each option, include a one-line rationale explaining which principle it leads with (e.g., "leads with the customer outcome" or "handles the objection in the hook").
- When rewriting, use a clear **Before → After** format with a brief explanation of why the new version is better.
- Structure recommendations by the fold: above-fold elements first, then below-fold.

## Retrieved Examples & Principles
{rag_context}`;

const welcomeMessage = `I'm your landing page copywriting coach. I use a proven 10-element formula and real before/after rewrites to help you write landing pages that convert.

**Here's how I work:**
- If you shared your current headline, I'll start with a before/after rewrite
- If you're starting fresh, I'll walk you through the formula element by element
- Either way, I'll ground every suggestion in specific principles and real examples

What would you like to work on first?`;

async function main() {
  console.log("Starting Landing Page Chatbot seed...\n");

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

  for (const sourceId of SOURCE_IDS) {
    const source = await prisma.source.findUnique({ where: { id: sourceId } });
    if (!source) {
      throw new Error(
        `Source "${sourceId}" not found. ` +
        'Please create and ingest the source before running this seed script.'
      );
    }
    console.log(`  Found source: ${source.title} (${source.id})`);
  }

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
  const existingLink = await prisma.creator_User.findUnique({
    where: { creatorId_userId: { creatorId: CREATOR_ID, userId: OWNER_USER_ID } },
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
        title: "Write the Perfect Landing Page",
        creatorId: CREATOR_ID,
        slug: "landing-page",
        description: "A landing page copywriting coach that uses a proven 10-element formula and real before/after rewrites to help you write pages that convert. Powered by Harry Dry's Marketing Examples methodology.",
        shortDescription: "Write landing pages that convert using a proven formula",
        isPublic: false,
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
        configJson: { enableFollowUpPills: true, temperature: 0.4 },
        ragSettingsJson: { topK: 5, minScore: 0.7 },
        welcomeMessage: welcomeMessage,
        fallbackSuggestionPills: [
          "Rewrite my headline using the formula",
          "Write above-fold copy for my landing page",
          "Help me handle my customer's biggest objection"
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
      id: "lp_product",
      slug: "lp_product",
      questionText: "What's your product or service? Describe it in one sentence.",
      helperText: "e.g., 'An AI tool that writes email subject lines' or 'A coworking space for remote workers'",
      responseType: "TEXT" as const,
      options: Prisma.JsonNull,
    },
    {
      id: "lp_customer",
      slug: "lp_customer",
      questionText: "Who is your ideal customer and what outcome do they want?",
      helperText: "e.g., 'SaaS founders who want more trial-to-paid conversions' or 'Freelancers who want to stop trading time for money'",
      responseType: "TEXT" as const,
      options: Prisma.JsonNull,
    },
    {
      id: "lp_objection",
      slug: "lp_objection",
      questionText: "What's your customer's biggest objection or hesitation?",
      helperText: "e.g., 'They think it'll take too long to set up' or 'They've tried similar tools before and been disappointed'",
      responseType: "TEXT" as const,
      options: Prisma.JsonNull,
    },
    {
      id: "lp_unique",
      slug: "lp_unique",
      questionText: "What makes you different from alternatives?",
      helperText: "e.g., 'We're the only tool that integrates with Shopify natively' or 'Founded by a former Netflix data scientist'",
      responseType: "TEXT" as const,
      options: Prisma.JsonNull,
    },
    {
      id: "lp_current_copy",
      slug: "lp_current_copy",
      questionText: "Paste your current headline and subheadline (if you have one).",
      helperText: "Optional — if you have existing copy, I'll start with a before/after rewrite. If not, we'll build from scratch.",
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
    { intakeQuestionId: "lp_product", displayOrder: 1, isRequired: true },
    { intakeQuestionId: "lp_customer", displayOrder: 2, isRequired: true },
    { intakeQuestionId: "lp_objection", displayOrder: 3, isRequired: true },
    { intakeQuestionId: "lp_unique", displayOrder: 4, isRequired: true },
    { intakeQuestionId: "lp_current_copy", displayOrder: 5, isRequired: false },
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

  // Step 5: Link Sources to Chatbot
  console.log("\nStep 5: Linking Sources to Chatbot...");
  for (const sourceId of SOURCE_IDS) {
    const existingSourceLink = await prisma.chatbot_Source.findUnique({
      where: {
        chatbotId_sourceId: {
          chatbotId: CHATBOT_ID,
          sourceId: sourceId,
        },
      },
    });
    if (!existingSourceLink) {
      await prisma.chatbot_Source.create({
        data: {
          chatbotId: CHATBOT_ID,
          sourceId: sourceId,
          isActive: true,
        },
      });
      console.log(`  Source linked: ${sourceId}`);
    } else {
      console.log(`  Source link already exists: ${sourceId}`);
    }
  }

  // Step 6: Create Chatbot Version
  console.log("\nStep 6: Creating Chatbot Version...");
  const versionId = "landing_page_v1";
  const existingVersion = await prisma.chatbot_Version.findUnique({ where: { id: versionId } });
  if (!existingVersion) {
    const version = await prisma.chatbot_Version.create({
      data: {
        id: versionId,
        chatbotId: CHATBOT_ID,
        versionNumber: 1,
        title: "Write the Perfect Landing Page",
        description: "Initial release",
        systemPrompt: systemPrompt,
        modelProvider: "openai",
        modelName: "gpt-4o",
        pineconeNs: `creator-${CREATOR_ID}`,
        vectorNamespace: `creator-${CREATOR_ID}`,
        configJson: { enableFollowUpPills: true, temperature: 0.4 },
        ragSettingsJson: { topK: 5, minScore: 0.7 },
        allowAnonymous: false,
        priceCents: 0,
        currency: "USD",
        type: "FRAMEWORK",
        notes: "Initial release of Landing Page chatbot",
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

  console.log("\nLanding Page Chatbot seed complete!");
  console.log(`\nAccess the chatbot at: /chat/landing-page`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
