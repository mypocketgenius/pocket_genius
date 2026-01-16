# Expansion Pills & Content Gaps: Purpose & Design Context

## Executive Summary

**Expansion pills** are structured UI buttons that appear after AI responses, allowing users to request more information without typing. **Content gaps** are aggregated records of unmet user needs, created by analyzing which expansion pills are clicked most frequently. Together, they form a feedback loop that helps creators identify what content is missing from their knowledge base.

---

## Part 1: Expansion Pills

### What They Are

Expansion pills are clickable buttons displayed above the chat input field after an AI assistant message. They represent common follow-up questions users might have. When clicked, they:
1. Prefill the input field with the pill's text (e.g., "Give me an example")
2. Allow users to optionally modify the text before sending
3. Log usage in `Pill_Usage` table for analytics

### Current System Pills (Universal)

**Updated (Jan 15, 2026):** These 5 expansion pills apply to all chatbots:
- **"What's the evidence"** - Requests proof, research citations, data validation
- **"Give me a template"** - Requests structured formats, scripts, checklists
- **"What are the edge cases"** - Requests failure modes, risks, alternatives
- **"Break this into steps"** - Requests step-by-step implementation guides
- **"Give me an example"** - Requests concrete instances

### Key Characteristics

**Display Context:**
- Shown after assistant messages (not before first message)
- Displayed alongside feedback pills ("Helpful", "Not helpful") and suggested question pills
- Split across two rows if many pills exist
- Users can click multiple pills (they append to input)

**User Behavior:**
- Users can click a pill and send as-is (`wasModified: false`)
- Users can click a pill and modify the text (`wasModified: true`)
- The `sentText` field captures what was actually sent (may differ from `prefillText`)

**Data Captured:**
- `pillId` - Which pill was clicked
- `pill.label` - Display text ("Give me an example")
- `pill.prefillText` - Text that prefilled input
- `sentText` - What user actually sent (may include modifications)
- `sourceChunkIds` - Which chunks were in the message that triggered this request
- `wasModified` - Whether user customized the pill text
- `timestamp` - When it was clicked

### Purpose

Expansion pills serve three functions:

1. **Reduce Friction**: Users don't need to type common follow-up questions
2. **Standardize Feedback**: Creates structured data instead of free-form text
3. **Signal Content Gaps**: High usage of a pill indicates missing or insufficient content

---

## Part 2: Content Gaps

### What They Are

Content gaps are aggregated records showing what information users need but don't have. They're created by analyzing expansion pill usage patterns and identifying which topics are requested most frequently but aren't adequately covered.

### Schema Structure

```prisma
model Content_Gap {
  id                String   @id @default(cuid())
  chatbotId         String
  topicRequested    String   // Pill label or aggregated topic
  specificQuestion  String   // First actual question asked
  requestCount      Int      // How many times requested
  lastRequestedAt   DateTime
  formatRequested   String[] // ['script', 'template', 'example', 'steps']
  userContexts      Json[]   // User situations/contexts
  relatedChunkIds   String[] // Chunks that partially addressed this
  status            String   // 'open' | 'planned' | 'created'
  createdAt         DateTime
  updatedAt         DateTime
}
```

### How They're Created (Simplified Approach)

**Nightly Aggregation Job:**

1. **Query Expansion Pill Usage** (last 30 days)
   ```typescript
   Pill_Usage where pill.pillType === 'expansion'
   ```

2. **Group by Pill**
   - Count how many times each pill was clicked
   - Collect `sourceChunkIds` (which chunks didn't satisfy)
   - Collect `sentText` variations (how users customized it)
   - Collect user contexts

3. **Create/Update Content_Gap Records**
   - `topicRequested` = pill label (e.g., "Give me an example")
   - `specificQuestion` = first `sentText` from that pill
   - `requestCount` = number of times pill was clicked
   - `relatedChunkIds` = chunks that were shown but didn't satisfy
   - `status` = 'open' (default)

### Purpose

Content gaps help creators:
- **Prioritize Content Creation**: See what's most requested ("47 users need examples")
- **Understand Context**: See who needs it and why (`userContexts`)
- **Track Progress**: Mark gaps as 'planned' → 'created' as content is added
- **Identify Partial Coverage**: See which chunks partially addressed but didn't fully satisfy

---

## Part 3: The Feedback Loop

### How Expansion Pills → Content Gaps Works

```
User receives AI response
    ↓
User clicks expansion pill ("Give me an example")
    ↓
Pill_Usage record created (with sourceChunkIds, sentText, etc.)
    ↓
[Nightly job runs]
    ↓
Aggregate Pill_Usage by pillId
    ↓
Create/update Content_Gap record
    ↓
Creator sees gap in dashboard: "47 users clicked 'Give me an example'"
    ↓
Creator creates content addressing this gap
    ↓
Gap status: 'open' → 'planned' → 'created'
```

### Key Insight

**Expansion pills are the structured signal of content gaps.** Instead of analyzing free-form text ("need more" feedback), the system uses predefined pill categories. This means:
- No embeddings/clustering needed (pills are already categorized)
- Clear, actionable data ("47 users need examples" vs "users asked various things")
- Easy to track and prioritize

---

## Part 4: Design Considerations for Expansion Pills

### What Makes a Good Expansion Pill?

**1. Represents a Common Need**
- Should capture a frequent follow-up question
- Should be general enough to apply across topics
- Should be specific enough to be actionable

**2. Maps to Content Types**
- Examples → concrete instances
- How-to → step-by-step guidance
- Case studies → real-world applications
- Scripts → exact words to use
- Templates → reusable formats

**3. Signals Content Gaps**
- High usage = content gap exists
- Should correlate with `relatedChunkIds` (chunks that didn't satisfy)
- Should help creators understand what format users need

**4. User-Friendly**
- Short, clear label (fits in pill button)
- Natural language (sounds like a real question)
- Actionable (user knows what they'll get)

### Current Pill Analysis

**Updated (Jan 15, 2026):**

**"What's the evidence"**
- **Purpose**: Requests proof, research citations, data validation
- **Gap Signal**: Users need more evidence-backed content
- **Content Type**: Research citations, data, validation, proof
- **Maps to**: `expansionPillType: 'evidence'`

**"Give me a template"**
- **Purpose**: Requests structured formats, scripts, checklists
- **Gap Signal**: Users need reusable formats they can use immediately
- **Content Type**: Templates, scripts, checklists, structured formats
- **Maps to**: `expansionPillType: 'template'`

**"What are the edge cases"**
- **Purpose**: Requests failure modes, risks, alternatives
- **Gap Signal**: Users need information about when things might fail
- **Content Type**: Edge cases, troubleshooting, risks, alternatives
- **Maps to**: `expansionPillType: 'edge_cases'`

**"Break this into steps"**
- **Purpose**: Requests step-by-step implementation guides
- **Gap Signal**: Users need sequential, actionable instructions
- **Content Type**: Step-by-step guides, sequential instructions
- **Maps to**: `expansionPillType: 'steps'`

**"Give me an example"**
- **Purpose**: Requests concrete instances
- **Gap Signal**: Users need more examples in content
- **Content Type**: Examples, case studies, concrete instances
- **Maps to**: `expansionPillType: 'example'`

---

## Part 5: Thought Experiment Framework

### Questions to Consider

**1. Coverage Analysis**
- What types of follow-up questions do users commonly have?
- What content formats are users requesting? (scripts, templates, examples, steps)
- What gaps exist between what's provided and what's needed?

**2. User Psychology**
- What makes users want more information?
- What signals indicate content is insufficient?
- What follow-up patterns emerge in conversations?

**3. Content Creation Needs**
- What information helps creators prioritize?
- What format preferences matter most?
- What context helps creators understand the gap?

**4. System Constraints**
- Pills must be short (fit in button)
- Pills must be general (apply across topics)
- Pills must be actionable (clear what user gets)

### Evaluation Criteria

For each potential expansion pill, consider:

1. **Frequency**: How often would users click this?
2. **Clarity**: Is it clear what the user will get?
3. **Actionability**: Does it help creators understand what to create?
4. **Distinctness**: Does it differ meaningfully from existing pills?
5. **Coverage**: Does it capture a gap type not already covered?

### Potential Pill Categories to Explore

**Format Requests:**
- Scripts ("Give me exact words")
- Templates ("Give me a template")
- Checklists ("Give me a checklist")
- Steps ("Break this down into steps")

**Depth Requests:**
- Examples (covered: "Give me an example")
- Step-by-step guides (covered: "Break this into steps")
- Edge cases and risks (covered: "What are the edge cases")

**Proof Requests:**
- Evidence and citations (covered: "What's the evidence")
- Case studies (covered: "Give me an example" - can include case studies)
- Research ("What does research say?")

**Context Requests:**
- Specific situations ("What about [situation]?")
- Edge cases ("What if [edge case]?")
- Alternatives ("What are alternatives?")

---

## Part 6: Implementation Notes

### Current System

- **System pills**: `chatbotId: NULL` (apply to all chatbots)
- **Chatbot-specific pills**: Can be added per chatbot
- **Pill types**: `'feedback' | 'expansion' | 'suggested'`
- **Expansion pills**: Currently 4 system pills

### Data Flow

1. User clicks expansion pill → `Pill_Usage` created
2. Nightly job aggregates `Pill_Usage` by `pillId`
3. Creates/updates `Content_Gap` records
4. Creators see gaps in dashboard
5. Creators create content → update gap status

### Key Metrics

- **Pill usage frequency**: Which pills are clicked most?
- **Modification rate**: How often do users customize pill text?
- **Gap correlation**: Which pills correlate with content gaps?
- **Satisfaction**: Do gaps decrease after content creation?

---

## Conclusion

Expansion pills are structured signals of content gaps. They reduce user friction while creating actionable data for creators. The goal is to design pills that:
1. Capture common user needs
2. Signal clear content gaps
3. Help creators prioritize and understand what to create
4. Provide structured, analyzable data (no embeddings needed)

The current set of 4 expansion pills covers basic needs (examples, application, depth, proof). Consider whether additional pills would capture distinct gap types or if modifications to existing pills would be more effective.

