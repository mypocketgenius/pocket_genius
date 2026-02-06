# Chat Route: System Prompt & Intake Substitution

> LLM-ready implementation plan to make `app/api/chat/route.ts` use the chatbot's stored `systemPrompt` with `{intake.SLUG}` and `{rag_context}` template variable substitution.

**Created:** 2026-02-06
**Status:** ✅ IMPLEMENTED (2026-02-06)
**Related:** `02-06_story-crafter-implementation.md` (depends on this)

---

## Problem

The chat API route (`app/api/chat/route.ts`, lines 487-499) ignores the chatbot's stored `systemPrompt` and constructs a hardcoded generic prompt:

```typescript
// CURRENT (lines 493-499) - hardcoded, ignores chatbot.systemPrompt
const systemPrompt = retrievedChunks.length > 0
  ? `You are a helpful assistant that answers questions based on the provided context...`
  : `You are a helpful assistant...`;
```

This means:
- Custom system prompts (like Story Crafter's) never reach the LLM
- `{intake.SLUG}` template variables are never substituted with user intake responses
- `{rag_context}` is never substituted (RAG context is baked into the hardcoded prompt instead)

---

## Solution

Three changes to `app/api/chat/route.ts`:

1. **Move intake response fetch earlier** (before `streamText` call)
2. **Replace hardcoded prompt logic** with chatbot.systemPrompt + template substitution
3. **Reuse the fetched intake data** for pill generation (remove duplicate query)

---

## Change 1: Fetch intake responses before streaming

Currently intake responses are fetched at **line 530** inside the streaming callback (only for pill generation). Move this fetch to **before the system prompt construction** (~line 487) so the data is available for template substitution.

### What to add (insert after line 486, before the system prompt block)

```typescript
    // 12a. Fetch intake responses for system prompt substitution and pill generation
    // Include question slug for {intake.SLUG} template matching
    let intakeResponsePairs: Array<{ slug: string; question: string; answer: string }> = [];
    try {
      const responses = await prisma.intake_Response.findMany({
        where: {
          userId: dbUserId,
          chatbotId: chatbot.id,
        },
        include: {
          intakeQuestion: {
            select: {
              slug: true,
              questionText: true,
            },
          },
        },
      });

      intakeResponsePairs = responses.map((response) => {
        let answerText = '';
        if (response.value && typeof response.value === 'object') {
          const value = response.value as any;
          if (Array.isArray(value)) {
            answerText = value.join(', ');
          } else if (typeof value === 'string') {
            answerText = value;
          } else if (value.text) {
            answerText = value.text;
          } else {
            answerText = JSON.stringify(value);
          }
        } else if (typeof response.value === 'string') {
          answerText = response.value;
        }

        return {
          slug: response.intakeQuestion.slug,
          question: response.intakeQuestion.questionText,
          answer: answerText,
        };
      });
    } catch (intakeError) {
      console.warn('Error fetching intake responses for prompt substitution:', intakeError);
    }
```

---

## Change 2: Replace hardcoded system prompt logic

Replace the current lines **487-499** with logic that uses `chatbot.systemPrompt` with template substitution. If `systemPrompt` is null, use a generic fallback so the chatbot still functions.

### What to replace

**Delete lines 487-499** (the current hardcoded prompt block).

**Insert this in its place:**

```typescript
    // 13. Build system prompt with template substitution
    const userContextString = Object.keys(userContext).length > 0
      ? `\n\nUser context: ${JSON.stringify(userContext)}`
      : '';

    let finalSystemPrompt: string;

    if (chatbot.systemPrompt) {
      finalSystemPrompt = chatbot.systemPrompt;
    } else {
      // Fallback generic prompt when chatbot has no systemPrompt configured
      finalSystemPrompt = `You are a helpful assistant. Answer the user's question using the retrieved context when available. If the context doesn't contain relevant information, say so and respond using your general knowledge.\n\n## Retrieved Context\n{rag_context}`;
    }

    // Substitute {intake.SLUG} placeholders with user's intake responses
    for (const response of intakeResponsePairs) {
      finalSystemPrompt = finalSystemPrompt.replace(
        `{intake.${response.slug}}`,
        response.answer || '(not provided)'
      );
    }

    // Clean up any remaining unsubstituted {intake.*} placeholders
    // (e.g., optional questions the user skipped)
    finalSystemPrompt = finalSystemPrompt.replace(
      /\{intake\.\w+\}/g,
      '(not provided)'
    );

    // Substitute {rag_context} with retrieved chunks
    finalSystemPrompt = finalSystemPrompt.replace(
      '{rag_context}',
      context || 'No relevant context retrieved for this query.'
    );

    // Append user context (from User_Context table, separate from intake)
    finalSystemPrompt += userContextString;
```

### Update the streamText call (line 502-507)

Change the variable name from `systemPrompt` to `finalSystemPrompt`:

```typescript
    const result = streamText({
      model: DEFAULT_CHAT_MODEL,
      system: finalSystemPrompt,
      messages,
      temperature: CHAT_TEMPERATURE,
    });
```

---

## Change 3: Reuse intake data for pill generation

The intake response fetch inside the streaming callback (lines 527-572) is now redundant. Replace it with a conversion from the already-fetched `intakeResponsePairs`.

### What to replace

**Delete the duplicate fetch block** (lines 527-572, the `let intakeResponses` declaration through the `catch (intakeError)` block).

**Insert this simpler conversion:**

```typescript
            // Reuse intake responses already fetched for prompt substitution
            const intakeResponses = intakeResponsePairs.length > 0
              ? intakeResponsePairs.map(({ question, answer }) => ({ question, answer }))
              : undefined;
```

Then update the `generateFollowUpPills` call (line 574-580) to use `intakeResponses` directly:

```typescript
            const pillsResult = await generateFollowUpPills({
              assistantResponse: fullResponse,
              configJson: chatbot.configJson as Record<string, any> | null,
              chatbotId: chatbot.id,
              conversationId,
              intakeResponses,
            });
```

---

## Summary of line-level changes

| Location | Action | Description |
|----------|--------|-------------|
| After line 486 | **INSERT** | Intake response fetch with `slug` included |
| Lines 487-499 | **REPLACE** | Hardcoded prompt -> `chatbot.systemPrompt` with template substitution + fallback |
| Lines 502-507 | **EDIT** | Rename `systemPrompt` -> `finalSystemPrompt` in `streamText` call |
| Lines 527-572 | **REPLACE** | Remove duplicate intake fetch, use `intakeResponsePairs` instead |
| Lines 574-580 | **EDIT** | Simplify pill generation intake param |

---

## Behavior

- Chatbots **with** `systemPrompt`: uses the custom prompt with full `{intake.SLUG}` and `{rag_context}` substitution
- Chatbots **without** `systemPrompt` (null): uses a generic fallback that still receives RAG context via `{rag_context}`
- Template substitution (`{intake.*}`, `{rag_context}`) runs on **both** paths — the fallback prompt includes `{rag_context}` so it goes through the same code
- Skipped/missing intake responses: unmatched `{intake.*}` placeholders are replaced with "(not provided)"
- No change to the request/response contract or database schema

---

## Testing

After implementation, verify with these scenarios:

1. **Story Crafter (custom prompt + intake):** Chat after completing intake. Verify the LLM references the user's intake answers (product area, persona, etc.) and cites Scrum Guide content from RAG.

2. **Skipped optional questions:** Start a Story Crafter conversation with only the 4 required intake questions answered. Verify the 3 optional fields show "(not provided)" in the prompt and don't break the response.

3. **No RAG results:** Send a query that returns no Pinecone chunks. Verify `{rag_context}` is replaced with the "No relevant context" fallback text.

4. **Chatbot with null systemPrompt:** Verify it uses the generic fallback and still receives RAG context.

---

---

## Implementation Notes (2026-02-06)

**All 3 changes implemented successfully** in `app/api/chat/route.ts`. TypeScript compiles clean (no new errors).

### What was implemented

1. **Change 1 (intake fetch):** Inserted at line 487. Fetches intake responses with `slug` included, stored in `intakeResponsePairs` array. Available for both prompt substitution and pill generation.

2. **Change 2 (system prompt substitution):** Replaced hardcoded prompt block (formerly lines 487-499) with `chatbot.systemPrompt` template substitution + generic fallback. Variable renamed from `systemPrompt` to `finalSystemPrompt` in `streamText` call.

3. **Change 3 (dedup intake fetch):** Replaced the duplicate 45-line intake fetch inside the streaming callback with a 3-line conversion from `intakeResponsePairs`.

### Improvements over the original plan

- **Used `replaceAll()` instead of `replace()`** for both `{intake.SLUG}` and `{rag_context}` substitutions. The original plan used `String.replace()` which only replaces the first match. `replaceAll()` handles edge cases where a system prompt references the same placeholder multiple times.

- **Regex cleanup still uses `/g` flag** for unmatched `{intake.*}` placeholders — this already handled all occurrences so no change needed there.

### Pre-existing issues (not introduced by this change)

- The test file `__tests__/api/chat/route.test.ts` has pre-existing TypeScript errors (mock typing issues, missing `generateFollowUpPills` import). These are unrelated to this change.

---

*Document version: 1.1*
*Created: 2026-02-06*
*Implemented: 2026-02-06*
