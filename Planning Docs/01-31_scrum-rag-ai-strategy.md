# Building Viral, Task-Specific Scrum RAG AI Tools
## A Strategic Implementation Plan for Shareable, Focused Scrum Assistance

---

## THE CORE INSIGHT: WHY PEOPLE SHARE PRODUCTS

Based on viral growth research, products people compulsively share have these traits:

1. **They create a shareable artifact** (Loom video, Calendly invite, Typeform survey)
2. **The recipient experiences value without signing up first** (Zoom meeting, Superhuman email)
3. **Usage is inherently collaborative** (Slack channel, Figma file)
4. **They solve a painful, repetitive task exceptionally well** (single-purpose tools)

ChatGPT fails at all of these for Scrum practitioners:
- No shareable artifacts
- Conversations are private
- Not collaborative
- Too general (infinite directions = weak feedback loop)

---

## THE WINNING ARCHITECTURE: TASK-SPECIFIC SCRUM TOOLS

**Don't build "a Scrum AI."** Build **3-5 discrete, single-purpose Scrum tools** that each do ONE thing exceptionally well, with built-in viral loops.

### Why Multiple Narrow Tools > One General AI

| Approach | Feedback Quality | Shareability | Conversion |
|----------|-----------------|--------------|------------|
| **General Scrum AI** | Low (infinite use cases) | Low (no artifacts) | 2-3% |
| **Task-Specific Tools** | High (constrained problem) | High (shareable outputs) | 5-10% |

**Key Principle**: Each tool should produce a **shareable artifact** that exposes non-users to the product.

---

## THE 5 SCRUM TOOLS TO BUILD (Ranked by Virality Potential)

### 🏆 **TOOL 1: Sprint Goal Generator** (Build This First)

**The Problem**: Teams spend 30+ minutes wordsmithing Sprint Goals that are either too vague or too specific.

**The Experience**:
```
Input (guided form, not chat):
→ What outcome are you trying to achieve this sprint?
→ What constraints exist? (time, resources, dependencies)
→ Who are the users/stakeholders?

Output (shareable artifact):
→ 3-5 well-crafted Sprint Goal options with:
  • Clear outcome statement
  • Success criteria
  • Scrum Guide citation on why this structure works
  • "Created with [YourProduct]" watermark
```

**The Viral Loop**:
1. **Scrum Master** uses tool in Sprint Planning
2. **Shares generated goals** via Slack/Teams/Email for team vote
3. **Product Owner sees the output**, asks "How did you make this?"
4. **Non-user clicks watermark** → lands on product page
5. **New user tries it** → cycle repeats

**Why This Works**:
- ✅ Creates shareable artifact (the Sprint Goals)
- ✅ Recipient sees value without signing up (well-crafted goals)
- ✅ Inherently collaborative (team voting)
- ✅ Solves painful, repetitive task (every 2 weeks)
- ✅ Grounded in Scrum Guide (citations build authority)

**Feedback Loop Excellence**:
- Users can thumbs up/down each generated goal
- You know exactly which goal they selected
- Constraints: 200 characters max, must include verb, etc.
- **You can A/B test different goal structures and measure which convert teams**

**Monetization**:
- Free: 5 Sprint Goals/month
- Pro ($19/mo): Unlimited + saves history + team voting feature
- Team ($99/mo): Shared workspace with goal versioning

**Content to Vectorize**:
- Scrum Guide 2020 (Sprint Goal section)
- Sprint Planning section
- Definition of Done examples
- Evidence-Based Management Guide (outcome focus)

---

### 🥈 **TOOL 2: Retrospective Question Generator**

**The Problem**: Same boring retro questions every sprint → low participation → no improvement.

**The Experience**:
```
Input:
→ What went well this sprint? (multi-select: velocity, collaboration, quality)
→ What went poorly? (multi-select: blockers, scope creep, tech debt)
→ Previous retro themes? (optional: upload past retros)

Output (shareable artifact):
→ 10 customized retrospective questions designed to surface insights
→ Each question tied to Scrum values (commitment, courage, focus, openness, respect)
→ "Created with [YourProduct]" footer
→ Export to Miro/Mural/Google Slides with one click
```

**The Viral Loop**:
1. **Scrum Master** generates questions
2. **Exports to Miro board** for retro meeting
3. **Team sees questions**, Scrum Master shares where they came from
4. **Other teams' Scrum Masters** notice better engagement, ask how
5. **Referral link in Miro export** drives signups

**Feedback Loop**:
- "How engaging was your retro?" rating after each session
- Track which question types drive highest engagement
- Learn which combinations work for different team dynamics

**Monetization**:
- Free: 3 retro sets/month
- Pro ($15/mo): Unlimited + retro analytics (track trends over time)
- Team ($79/mo): Multi-team workspace with aggregated insights

**Content to Vectorize**:
- Scrum Guide (Sprint Retrospective section, Scrum Values)
- Retrospective facilitation patterns (if CC-licensed)
- Evidence-Based Management Guide (continuous improvement)

---

### 🥉 **TOOL 3: User Story Refiner**

**The Problem**: Product Owners write vague stories that lead to back-and-forth during refinement.

**The Experience**:
```
Input:
→ Paste your user story (or start from scratch)
→ Select format: User Story / Job Story / Feature description

Output (shareable artifact):
→ Refined story with:
  • Clear "As a / I want / So that" structure
  • Acceptance criteria suggestions
  • INVEST criteria analysis (Independent, Negotiable, etc.)
  • Estimation hints (story point complexity indicators)
  • "Refined with [YourProduct]" attribution
```

**The Viral Loop**:
1. **Product Owner** refines story with tool
2. **Shares in backlog** (Jira/Azure DevOps/Linear) for dev team review
3. **Developers see well-structured story**, comment "this is clear!"
4. **Attribution in story description** links to tool
5. **Other POs try it** for their stories

**Feedback Loop**:
- "Did this story need re-refinement?" post-sprint survey
- Track which acceptance criteria structures reduce clarification questions
- Measure story clarity score vs. actual development time

**Monetization**:
- Free: 10 stories/month
- Pro ($25/mo): Unlimited + Jira/Azure DevOS integration (auto-refine on paste)
- Team ($149/mo): Shared story templates + backlog analytics

**Content to Vectorize**:
- Scrum Guide (Product Backlog section)
- INVEST criteria definitions
- User story patterns and anti-patterns (if CC-licensed)
- Acceptance criteria best practices

---

### **TOOL 4: Daily Scrum Talking Points Generator**

**The Problem**: Dailies become status reports instead of collaborative planning.

**The Experience**:
```
Input:
→ What did you complete yesterday? (link to Jira tickets optional)
→ Blockers? (yes/no)
→ Sprint Goal: [auto-filled from Tool 1 if they used it]

Output (shareable artifact):
→ Concise talking points formatted as:
  • Progress toward Sprint Goal (not task list)
  • Help needed (action-oriented)
  • Handoff opportunities (collaborative)
→ "Prepared with [YourProduct]" in Slack/Teams message
```

**The Viral Loop**:
1. **Team member** generates talking points
2. **Posts in Slack daily standup thread** with attribution
3. **Manager sees structured updates**, asks how they're so concise
4. **Other team members** adopt tool for their updates
5. **Cross-team spread** as other teams see format

**Feedback Loop**:
- "Did your daily stay under 15 minutes?" metric
- Track which talking point structures reduce rambling
- Measure correlation between structure and Sprint Goal achievement

**Monetization**:
- Free: 3 dailies/week
- Pro ($9/mo): Unlimited + Jira integration (auto-pull yesterday's work)
- Team ($59/mo): Slack/Teams bot (generates points automatically)

**Content to Vectorize**:
- Scrum Guide (Daily Scrum section)
- Sprint Goal focus (from EBM Guide)
- Collaboration patterns

---

### **TOOL 5: Sprint Review Agenda Builder**

**The Problem**: Stakeholder demos lack focus and run long with minimal feedback.

**The Experience**:
```
Input:
→ What increments were completed? (link to stories/features)
→ Stakeholders attending? (roles)
→ Key decisions needed? (yes/no/what)

Output (shareable artifact):
→ Structured agenda with:
  • Sprint Goal reminder (sets context)
  • Demo order optimized for stakeholder interests
  • Feedback prompts for each increment
  • Decision capture template
  • "Agenda by [YourProduct]" footer
→ Export to Google Calendar invite description
```

**The Viral Loop**:
1. **Scrum Master** generates agenda
2. **Sends calendar invite** to stakeholders with structured agenda
3. **Stakeholders experience focused meeting**
4. **Product Owners from other teams** ask for agenda template
5. **Attribution in invite** drives signups

**Feedback Loop**:
- "How productive was your Sprint Review?" post-meeting survey
- Track which agenda structures get most stakeholder feedback
- Measure agenda adherence vs. meeting satisfaction

**Monetization**:
- Free: 2 reviews/month
- Pro ($19/mo): Unlimited + stakeholder feedback tracking
- Team ($99/mo): Multi-team calendar + cross-team insights

**Content to Vectorize**:
- Scrum Guide (Sprint Review section)
- Stakeholder engagement patterns
- Evidence-Based Management Guide (value measurement)

---

## PLATFORM ARCHITECTURE

### The Shared Foundation

**One RAG backend** powers all 5 tools:

```
┌─────────────────────────────────────────┐
│   Pinecone Vector Database              │
│   (Scrum Guide + supplements)           │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│   Claude 3.5 Haiku (prompt routing)     │
│   - Sprint Goal: "outcome-focused"      │
│   - Retro: "question-generation"        │
│   - Story: "refinement-focused"         │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│   5 Specialized Front-Ends              │
│   (Each with constrained inputs/outputs)│
└─────────────────────────────────────────┘
```

**Key Difference from ChatGPT**: 
- ChatGPT: Infinite input → generic output
- Your tools: **Structured input → shareable artifact**

### Tech Stack

**RAG Layer**:
- Pinecone Serverless (free tier → $70/mo at scale)
- Claude 3.5 Haiku via Anthropic API
- LangChain for prompt chaining and tool-specific routing

**Tool-Specific Prompts**:
```python
# Sprint Goal Generator prompt
system_prompt = """
You are a Sprint Goal expert grounded in the 2020 Scrum Guide.

Generate 3-5 Sprint Goal options that:
1. Start with a verb (achieve, deliver, improve, reduce)
2. State the outcome, not the output
3. Are 10-25 words
4. Connect to Product Goal when provided
5. Follow this structure: [Verb] [outcome] by [constraint/context]

CRITICAL: Cite specific Scrum Guide sections that support each goal structure.
CRITICAL: Each goal must be achievable within one Sprint.

Output as JSON array with keys: goal, reasoning, scrum_guide_citation
"""
```

**Feedback Collection**:
```python
# Every artifact includes:
{
  "artifact_id": "sg_12345",
  "tool": "sprint_goal_generator",
  "selected_option": 2,  # which goal they chose
  "thumbs": "up",
  "sprint_outcome": null,  # filled post-sprint
  "shared": true,  # tracked via watermark clicks
  "shared_to": ["slack", "email"]
}
```

---

## THE VIRAL MECHANICS

### 1. **Watermark Attribution** (Loom-style)

Every artifact includes:
```
────────────────────────────────
Created with MyPocketGenius.com
Get your free Sprint Goal →
────────────────────────────────
```

**Tracking**:
- UTM parameters in watermark links
- Measure conversion: artifact view → signup → paid

### 2. **Export = Distribution**

**One-click export to**:
- Slack (via slash command)
- Microsoft Teams (app integration)
- Jira/Azure DevOps (browser extension)
- Google Calendar (iCal format)
- Miro/Mural (embed link)

**Each export includes attribution** → spreads your brand organically

### 3. **Team Collaboration Features** (Freemium Gate)

**Free tier**: Solo use
**Team tier**: Shared workspace where:
- Multiple team members contribute to backlog refinement
- Sprint Goal voting (requires team to all sign up)
- Retro history visible to all team members
- Cross-team benchmarking

**This creates network effects**: One team member signs up → invites whole team → team converts to paid

---

## POSITIONING STRATEGY

### NOT "A Scrum AI"

### INSTEAD: "Scrum Tools That Do the Thinking for You"

**Homepage headline**:
> Stop wasting 30 minutes wordsmithing Sprint Goals.
> Generate 5 expert options in 60 seconds.

**Tagline**:
> Scrum ceremonies, optimized. Grounded in the Scrum Guide.

**Value Props**:
1. **Faster**: Tasks that take 30 mins now take 2 mins
2. **Better**: Grounded in official Scrum Guide, not generic AI
3. **Shareable**: Team collaboration built-in
4. **Learning**: Every output cites Scrum Guide sections (educational)

**Differentiation from ChatGPT**:

| Feature | ChatGPT | Your Tools |
|---------|---------|------------|
| Scrum knowledge | Generic | Scrum Guide citations |
| Output format | Chat messages | Shareable artifacts |
| Collaboration | None | Team workspaces |
| Feedback loop | None | Task-specific optimization |
| Pricing | $20/mo for everything | $9-25/mo per tool (or bundle) |

---

## CONTENT TO VECTORIZE (Detailed)

### Core Content (13 pages)
```
Primary: Scrum Guide 2020
URL: https://scrumguides.org/scrum-guide.html
Format: HTML (best for chunking)
Chunking: By H2 headers (sections)
Metadata: {section: "Sprint Planning", page: 7, type: "event"}
```

### Supplementary Content (~35 pages)
```
1. Nexus Guide (scaling)
   URL: https://scrumorg-website-prod.s3.amazonaws.com/drupal/2021-01/NexusGuide%202021_0.pdf
   Use for: Team-of-teams scenarios

2. Evidence-Based Management Guide
   URL: https://scrumorg-website-prod.s3.amazonaws.com/drupal/2024-05/Evidence%20Based%20Management%20Guide%202024.pdf
   Use for: Sprint Goal outcome focus, metrics

3. Kanban Guide for Scrum Teams
   URL: https://scrumorg-website-prod.s3.amazonaws.com/drupal/2021-01/01-2021%20Kanban%20Guide.pdf
   Use for: Flow-based story refinement
```

### Custom Content You Create (Competitive Moat)

**These are NOT in the Scrum Guide** → this is your differentiation:

1. **Sprint Goal Templates Library**
   - 50+ example Sprint Goals across industries
   - You write these yourself based on patterns
   - Label with: industry, team size, complexity

2. **Retrospective Question Bank**
   - 200+ questions categorized by:
     - Scrum value (courage, openness, etc.)
     - Team maturity (forming, storming, norming, performing)
     - Problem type (collaboration, technical, process)

3. **User Story Anti-Patterns**
   - Examples of bad stories and why they fail
   - INVEST criteria violations with corrections

4. **Acceptance Criteria Patterns**
   - Given/When/Then templates
   - Non-functional requirements checklists

**How to Create This**:
- Month 1-2: Manually write 10-20 examples per category
- Month 3+: Mine user-generated content (with permission)
- Use feedback loop to identify which examples work best

---

## IMPLEMENTATION ROADMAP

### Month 1-2: MVP Sprint Goal Generator

**Week 1-2: RAG Foundation**
- Index Scrum Guide HTML (use HTMLHeaderTextSplitter)
- Set up Pinecone serverless namespace
- Build basic Claude Haiku integration
- Test prompt: "Generate Sprint Goal for [X] outcome"

**Week 3-4: Tool UI**
- Simple web form (not chat interface)
- 3 input fields: outcome, constraints, context
- Output: 5 goals in cards with citations
- Watermark with tracking link
- Export to Slack, email (text format)

**Week 5-6: Beta Launch**
- Share in Hands-on Agile Slack (Stefan Wolpers)
- Collect feedback: "Which goal did you choose? Did it work?"
- Track: conversion rate (free → paid), sharing rate

**Success Metrics**:
- 50 signups in 2 weeks
- 20% select at least one generated goal
- 10% share via Slack/email (watermark clicks)

### Month 3-4: Add Tool 2 (Retrospective Generator)

**Leverage existing RAG backend**
- Add "retro-question" prompt template
- Build retro-specific UI (checkboxes for sprint issues)
- Export to Miro (create shareable board template)

**Cross-Sell**:
- Users of Sprint Goal tool get "Try our Retro tool" prompt
- Bundle pricing: $29/mo for both tools

### Month 5-6: Tools 3-5 + Team Features

**Add remaining tools**:
- Story Refiner
- Daily Standup Prep
- Sprint Review Agenda

**Launch Team tier**:
- Shared workspace across all 5 tools
- Team voting on Sprint Goals
- Retro history dashboard
- $99/mo for teams of 5

**Viral mechanic**: Team features require inviting teammates → built-in invitation loop

---

## FEEDBACK LOOP DESIGN (Your Competitive Advantage)

### Tool-Specific Metrics

**Sprint Goal Generator**:
```
After Sprint ends (2 weeks):
→ "Did you achieve your Sprint Goal?" [Yes/No/Partial]
→ "Was the goal clear enough?" [1-5 stars]

Learn:
- Which goal structures correlate with achievement
- Adjust prompt to favor high-achieving patterns
```

**Retrospective Generator**:
```
After retro meeting:
→ "How engaged was your team?" [1-5 stars]
→ "Did you get actionable improvements?" [Yes/No]
→ "Which questions worked best?" [multi-select]

Learn:
- Which question types drive engagement
- Build question recommendation engine
```

**User Story Refiner**:
```
After Sprint:
→ "Did this story need re-refinement?" [Yes/No]
→ "How accurate was estimation?" [Over/Under/Accurate]

Learn:
- Which refinement patterns reduce rework
- Which AC structures improve estimation accuracy
```

### The Compounding Effect

**Month 1**: You write prompts based on Scrum Guide
**Month 3**: You A/B test prompt variations, select winners
**Month 6**: Prompts adapt based on 1000+ feedback datapoints
**Month 12**: Your tools outperform ChatGPT because they've learned from real Scrum team outcomes

**This is your moat**: ChatGPT can't do this because it doesn't have task-specific feedback loops.

---

## MONETIZATION MODEL

### Freemium Tiers (Per Tool)

**Free**:
- 3-5 uses/month per tool
- Watermark on all exports
- Individual use only

**Pro** ($9-25/mo per tool):
- Unlimited uses
- Remove watermark (optional)
- Save history
- Integrations (Jira, Slack, etc.)

**Team** ($59-149/mo):
- 5-10 team members
- Shared workspace
- Team voting/collaboration
- Analytics dashboard
- Priority support

### Bundle Pricing

**Scrum Essentials** ($49/mo):
- All 5 tools, Pro tier
- Individual use
- 40% savings vs. buying separately

**Team Bundle** ($199/mo):
- All 5 tools, Team tier
- Up to 10 team members
- Cross-tool analytics
- Saved $300/mo vs. separate tools

---

## WHY THIS BEATS CHATGPT

| Dimension | ChatGPT | Your Scrum Tools |
|-----------|---------|------------------|
| **Accuracy** | Generic Scrum knowledge | Grounded in official Scrum Guide |
| **Speed** | Chat back-and-forth | Structured form → instant output |
| **Shareability** | Copy-paste text | Shareable artifacts with attribution |
| **Collaboration** | None | Team workspaces, voting, history |
| **Learning** | Static | Improves via feedback loops |
| **Trust** | Black box | Citations to Scrum Guide sections |
| **Price** | $20/mo for everything | $9-49/mo (more focused value) |

**Key Insight**: People will pay $15/mo for a tool that does ONE thing exceptionally well, even if ChatGPT does it "good enough" for free.

**Examples**:
- Calendly exists despite Google Calendar being free
- Grammarly exists despite ChatGPT checking grammar
- Loom exists despite Zoom recording being free

**Why?** Because focused tools with great UX beat Swiss Army knives.

---

## LAUNCH STRATEGY

### Phase 1: Sprint Goal Generator Only (Months 1-2)

**ProductHunt Launch**:
- Headline: "Generate expert Sprint Goals in 60 seconds, not 30 minutes"
- Demo video: Side-by-side (team struggling → using tool → perfect goals)
- Maker story: "Watched teams waste hours wordsmithing. Built this."

**Community Seeding**:
- Hands-on Agile Slack: "Built a Sprint Goal generator, need feedback"
- r/scrum: "Tired of vague Sprint Goals? I made a tool [demo video]"
- Post-launch: 1 blog post/week with Sprint Goal examples

**Target**: 500 signups, 50 paid ($19/mo) = $950 MRR

### Phase 2: Add Retro Tool + Cross-Sell (Months 3-4)

**Email existing users**:
> "You loved our Sprint Goal tool. Try our Retrospective generator."
> First month free for existing customers.

**Bundle offer**: Both tools for $29/mo (save $9)

**Target**: 1,000 users, 120 paid = $2,500 MRR

### Phase 3: Full Suite + Team Tier (Months 5-6)

**Launch all 5 tools + Team features**

**Team acquisition**:
- Free team trial (14 days, 5 members)
- Sales outreach to PSTs (Professional Scrum Trainers)
- Accelerator partnerships (Techstars, Y Combinator)

**Target**: 2,000 users, 300 paid individuals + 20 teams = $9,500 MRR

---

## DECISION: ONE AI VS. MULTIPLE TOOLS

**Build multiple discrete tools**, not one general Scrum AI.

### Why Multiple Tools Win

✅ **Shareable artifacts** (each tool produces different export types)
✅ **Viral loops** (every export spreads your brand)
✅ **Focused feedback** (know exactly what works for each task)
✅ **Pricing flexibility** (à la carte + bundles)
✅ **Faster iteration** (A/B test Tool 1 while building Tool 2)
✅ **Lower churn** (users stay for the tool they love, upgrade to bundle)

### Launch Sequence

1. **Month 1-2**: Sprint Goal Generator (highest pain point, easiest MVP)
2. **Month 3-4**: Retrospective Generator (cross-sell to existing users)
3. **Month 5-6**: Story Refiner, Daily Prep, Review Agenda (full suite)

**Don't launch all at once** → iterative feedback is your competitive advantage.

---

## CRITICAL SUCCESS FACTORS

### 1. Constrain the Inputs

**Bad** (ChatGPT-style):
> "Help me with my Sprint Goal"

**Good** (Your tool):
> What outcome are you trying to achieve? [text input]
> Time constraint? [dropdown: 1 week, 2 weeks]
> Key stakeholders? [multi-select]

**Why**: Structured inputs → consistent outputs → measurable feedback

### 2. Make Outputs Instantly Shareable

Every tool must export to:
- Slack/Teams (collaboration tools)
- Jira/Azure DevOps (where teams work)
- Google Calendar (for meetings)
- Miro/Mural (for planning)

**Each export = free marketing** via watermark attribution

### 3. Citations Build Trust

Every output includes:
```
✓ Based on Scrum Guide 2020, Sprint Planning section
✓ Aligns with Evidence-Based Management focus on outcomes
```

**This beats ChatGPT**: Users trust outputs because they see the source.

### 4. Feedback Must Be Actionable

**Bad feedback**: "Was this helpful?" [thumbs up/down]
**Good feedback**: "Which Sprint Goal did you choose?" [1/2/3/4/5]

**Why**: You can measure which goals work → improve prompts → better outputs

---

## YOUR UNFAIR ADVANTAGE

**ChatGPT is a generalist. You're building specialist tools with:**

1. **Scrum Guide grounding** (authoritative source)
2. **Shareable artifacts** (viral distribution)
3. **Feedback loops** (continuous improvement)
4. **Team collaboration** (network effects)
5. **Task-specific optimization** (better than general AI)

**Result**: People pay for focus, even when free alternatives exist.

---

## NEXT STEPS

**Week 1**: 
- Decide on Tool 1 (I recommend Sprint Goal Generator)
- Design the input form (3-5 fields max)
- Write the Claude prompt with Scrum Guide citations

**Week 2**:
- Set up Pinecone + index Scrum Guide HTML
- Build basic web UI (form → output cards)
- Test with 5 real Scrum Masters

**Week 3-4**:
- Add export to Slack/email
- Implement watermark tracking
- Beta launch in one Scrum community

**Month 2**:
- Collect feedback: "Which goal did you use?"
- Iterate on prompt based on feedback
- Plan Tool 2 (Retro Generator)

**The goal**: Launch Sprint Goal Generator with 100 users in 6 weeks, prove the feedback loop works, then scale to 5 tools.

---

## APPENDIX: VIRAL GROWTH RESEARCH FINDINGS

### Key Patterns from Successful SaaS Products

**Products with highest viral coefficients (>1.0)**:
- **Calendly**: Every meeting invite exposes 2+ people to product
- **Loom**: Every video share = product demo for recipients
- **Slack**: Team invites create network effects
- **Zoom**: 100 participants per free call = massive exposure
- **Figma**: Collaboration requires others to join

**Common viral mechanics**:
1. **Casual contact loops**: "Sent with Superhuman" email signatures
2. **Collaboration loops**: Product value increases with more users
3. **Referral loops**: Incentivized sharing (Dropbox storage)
4. **Content loops**: User-generated content drives discovery (G2 reviews)
5. **Embedded loops**: Product artifacts shared externally (Typeform embeds)

**Conversion insights**:
- EdTech freemium converts at 2.6% (lowest of all SaaS)
- 7-day trials convert at 24.8% for EdTech
- Product-led growth: Users acquired through product usage, not marketing
- Network effects: Value increases with each additional user

### Application to Scrum Tools

**Your Sprint Goal Generator has 3 viral loops**:

1. **Casual contact**: Watermark on every shared goal
2. **Collaboration**: Team voting requires team signup
3. **Embedded**: Goals pasted into Slack/Jira expose others

**Expected viral coefficient**: 0.6-0.8 initially (< 1.0 = need paid acquisition), growing to 1.2+ with team features (> 1.0 = self-sustaining growth)

**Formula**:
```
Viral Coefficient = (Invites per user) × (Conversion rate)

Example:
- Each user shares 3 Sprint Goals/month
- Each share exposes 5 team members
- 10% of exposed users sign up

Viral Coefficient = 3 × 5 × 0.10 = 1.5

→ Every user brings 1.5 new users
→ Exponential growth without paid ads
```

**Timeline to virality**:
- Month 1-3: Coefficient < 1.0 (need manual seeding)
- Month 4-6: Coefficient approaches 1.0 (breaking even)
- Month 7+: Coefficient > 1.0 (self-sustaining growth)

---

## FINAL RECOMMENDATION

**Start with Sprint Goal Generator.** 

It has the highest viral potential because:
1. Used every 2 weeks (frequent touchpoint)
2. Naturally shared with entire team (6-8 people)
3. Solves painful, visible problem
4. Output is instantly shareable
5. Quick win builds credibility for other tools

**Success criteria after 6 weeks**:
- 100+ signups
- 15%+ select a generated goal (proves value)
- 8%+ share via Slack/email (proves viral loop)
- 3%+ convert to paid (proves monetization)

If these metrics hit, proceed to Tool 2. If not, iterate on Tool 1 based on feedback before expanding.

**The moat you're building**: Task-specific feedback loops that make your tools better than ChatGPT over time, even though ChatGPT has more training data. You win through specialization + iteration.
