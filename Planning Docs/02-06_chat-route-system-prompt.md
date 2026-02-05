# Chat Route: System Prompt & Intake Substitution

> LLM-ready implementation plan to make `app/api/chat/route.ts` use the chatbot's stored `systemPrompt` with `{intake.SLUG}` and `{rag_context}` template variable substitution.

**Created:** 2026-02-06
**Status:** Ready for implementation
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

Replace the current lines **487-499** with logic that uses `chatbot.systemPrompt` when available, substituting template variables. Falls back to existing generic prompt for chatbots without a custom prompt (backwards compatible).

### What to replace

**Delete lines 487-499** (the current hardcoded prompt block).

**Insert this in its place:**

```typescript
    // 13. Build system prompt
    // If chatbot has a custom systemPrompt, use it with template substitution.
    // Otherwise fall back to generic prompt (backwards compatible).
    const userContextString = Object.keys(userContext).length > 0
      ? `\n\nUser context: ${JSON.stringify(userContext)}`
      : '';

    let finalSystemPrompt: string;

    if (chatbot.systemPrompt) {
      finalSystemPrompt = chatbot.systemPrompt;

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
      if (context) {
        finalSystemPrompt = finalSystemPrompt.replace('{rag_context}', context);
      } else {
        finalSystemPrompt = finalSystemPrompt.replace(
          '{rag_context}',
          'No relevant context retrieved for this query.'
        );
      }

      // Append user context (from User_Context table, separate from intake)
      finalSystemPrompt += userContextString;
    } else {
      // Fallback: generic prompt for chatbots without a custom systemPrompt
      finalSystemPrompt = retrievedChunks.length > 0
        ? `You are a helpful assistant that answers questions based on the provided context. Use the following context to answer the user's question:\n\n${context}\n\nIf the context doesn't contain relevant information to answer the question, say so and provide a helpful response based on your general knowledge.${userContextString}`
        : `You are a helpful assistant. Answer the user's question to the best of your ability using your general knowledge.${userContextString}`;
    }
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

## Backwards Compatibility

- Chatbots **with** `systemPrompt` set: uses the custom prompt with full substitution
- Chatbots **without** `systemPrompt` (null): falls back to the existing hardcoded generic prompt
- No change to the request/response contract
- No change to the database schema
- Intake responses that don't exist yet: placeholders replaced with "(not provided)"

---

## Testing

After implementation, verify with these scenarios:

1. **Story Crafter (custom prompt):** Chat with Story Crafter after completing intake. Verify the LLM response references the user's intake answers (product area, persona, etc.) and cites Scrum Guide content.

2. **Art of War (custom prompt, if systemPrompt is set):** Same test - verify intake context appears in responses.

3. **Chatbot without systemPrompt:** Verify existing chatbots that have `systemPrompt: null` continue to work identically with the generic fallback prompt.

4. **Skipped optional questions:** Start a Story Crafter conversation with only the required intake questions answered. Verify optional fields show "(not provided)" and don't break the prompt.

5. **No RAG results:** Send a query that returns no Pinecone chunks. Verify `{rag_context}` is replaced with the "No relevant context" fallback text.

---

*Document version: 1.0*
*Created: 2026-02-06*
