# Scrum Tools Gap Analysis

**Date:** January 31, 2026
**Purpose:** Compare features needed for Scrum RAG AI tools vs. current Pocket Genius capabilities

---

## Features Needed for Scrum Tools NOT Yet in Pocket Genius

### Critical Missing Features

| Feature | Scrum Strategy Requires | Current State in Pocket Genius |
|---------|------------------------|-------------------------------|
| **Structured Forms (not chat)** | Guided input forms with dropdowns, multi-select | ❌ Chat-based only; intake forms exist but not for main output |
| **Shareable Artifacts** | Formatted cards/outputs with citations | ❌ No artifact generation system |
| **A/B Testing Outputs** | Test which goal structures work | ❌ No output variation testing |
| **Post-Event Surveys** | Follow-up after 2 weeks | ❌ Only immediate feedback exists |
| **Freemium Usage Limits** | "5 Sprint Goals/month" metering | ❌ No usage metering |

---

## From `alpha_build.md` - Incomplete Phases Still Needed

| Phase | Status | Needed for Scrum? |
|-------|--------|-------------------|
| **Phase 4.0**: Analytics Schema Migration | ❌ Not started | ✅ Yes - Content_Gap, Source_Performance models |
| **Phase 4.2**: Enhanced Creator Dashboard | ❌ Not started | ✅ Yes - shows what content works |
| **Phase 4.3**: Content Gap Aggregation | ❌ Not started | ✅ Yes - identifies missing Scrum content |
| **Phase 7.1**: Production Deployment | ❌ Unchecked | ⚠️ General infrastructure |
| **Phase 7.2**: Performance Optimization | ❌ Unchecked | ⚠️ General infrastructure |
| **Phase 7.3**: Documentation | ❌ Unchecked | ⚠️ User-facing docs |

---

## Completed Features That Transfer Well

- ✅ **RAG Pipeline** - Already have Pinecone + Claude integration
- ✅ **Intake Forms** - Conversational intake can be adapted
- ✅ **Feedback System** - Pills, star ratings, copy tracking all work
- ✅ **User Context** - Context personalization already built
- ✅ **Versioning** - Chatbot versioning for prompt iteration
- ✅ **Theme System** - UI polish transfers
- ✅ **Homepage/Browse** - Chatbot discovery grid works

---

## Key Gaps Summary

### The Biggest Architectural Difference

The Scrum strategy explicitly says "**Don't build chat - build structured forms**" with constrained inputs generating **shareable artifacts**. The current Pocket Genius system is chat-first with conversation history.

**Key quote from strategy:**
> ChatGPT: Infinite input → generic output
> Your tools: **Structured input → shareable artifact**

---

## Top 2 Things to Build for Scrum Tools

### 1. Artifact Output Component
- Formatted, shareable cards with Scrum Guide citations
- Copy buttons
- Multiple output options (3-5 Sprint Goal variations)

### 2. Structured Input Forms
- Per-tool forms (not chat) with specific fields
- Example for Sprint Goal Generator:
  - "What outcome are you trying to achieve?" (text)
  - "Time constraint?" (dropdown: 1 week, 2 weeks)
  - "Key stakeholders?" (multi-select)
- Constrained inputs → consistent, measurable outputs

---

## The 5 Scrum Tools (from strategy)

### Build Order (by virality potential):

1. **Sprint Goal Generator** (MVP - Build First)
   - Used every 2 weeks (frequent touchpoint)
   - Naturally shared with team (6-8 people)
   - Quick win builds credibility

2. **Retrospective Question Generator**
   - Cross-team spread

3. **User Story Refiner**
   - Developers see quality

4. **Daily Scrum Talking Points**
   - Team adoption

5. **Sprint Review Agenda Builder**
   - Stakeholder exposure

---

## Content to Vectorize (RAG Sources)

### Core Content (13 pages)
- Scrum Guide 2020 (scrumguides.org)
- Chunk by H2 headers
- Metadata: {section, page, type}

### Supplementary Content (~35 pages)
- Nexus Guide (scaling)
- Evidence-Based Management Guide
- Kanban Guide for Scrum Teams

### Custom Content (Competitive Moat)
- Sprint Goal Templates Library (50+ examples)
- Retrospective Question Bank (200+ questions)
- User Story Anti-Patterns
- Acceptance Criteria Patterns

---

## Monetization Model (from strategy)

### Per-Tool Pricing:
- **Free**: 3-5 uses/month
- **Pro** ($9-25/mo): Unlimited

---

## Recommended Next Steps

1. **Complete Phase 4.0-4.3** - Analytics infrastructure needed for feedback loops
2. **Design Artifact Output System** - Core differentiator from ChatGPT
3. **Build Sprint Goal Generator MVP** - First tool, highest virality

---

## References

- `Planning Docs/01-31_scrum-rag-ai-strategy.md` - Full Scrum tools strategy
- `Planning Docs/alpha_build.md` - Current Pocket Genius feature status
