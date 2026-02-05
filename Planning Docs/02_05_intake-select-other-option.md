# Intake Questions: "Other" Option for SELECT

## Status: DEFERRED

**Decision date:** 2026-02-06
**Deferred to:** March 2026 "iterate based on feedback" phase

**Rationale:** The profitability plan requires the first Scrum chatbots deployed by mid-February. This feature is additive (`allowOther` defaults to `false`) and non-breaking to add later. The predefined SELECT options cover 90%+ of cases, and users can clarify edge cases in chat. Build this only if beta users (Feb Week 3-4) report that predefined options are insufficient.

**What changed in the Scrum tools:** "Other" options and conditional follow-up questions were removed from all intake question definitions in `02-02_scrum-chatbots-implementation-plan.md`. They can be re-added once this feature is implemented.

---

## Problem

SELECT intake questions currently only allow users to choose from predefined options. There's no way for users to select "Other" and type in a custom response.

## Current State

- `Intake_Question.options` stores options as `Json` (array of strings)
- `Intake_Response.value` stores the response as `Json`
- SELECT renders a dropdown with predefined options only (`components/intake-form.tsx:251-287`)

---

## Recommended: Schema-Based Approach

Add an explicit `allowOther` field to `Intake_Question`. This is cleaner than convention-based magic strings because:

- **Explicit intent** - The schema declares the behavior, not a magic string
- **No collisions** - Creators can have an option literally named "Other" without triggering special behavior
- **Automatic rendering** - "Other" appears at the end, controlled by the system
- **Localization-friendly** - The display text for "Other" can be changed without breaking logic

### Schema Change

```prisma
model Intake_Question {
  id              String             @id @default(cuid())
  slug            String             @unique
  questionText    String
  helperText      String?
  responseType    IntakeResponseType
  options         Json?              // Options for SELECT and MULTI_SELECT
  allowOther      Boolean            @default(false)  // NEW: Show "Other" option with text input
  createdByUserId String
  createdBy       User               @relation("IntakeQuestionCreator", fields: [createdByUserId], references: [id], onDelete: Cascade)

  chatbots  Chatbot_Intake_Question[]
  responses Intake_Response[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Migration

```bash
npx prisma migrate dev --name add_intake_question_allow_other
```

### Response Value Structure

To keep things simple and consistent, use a unified object structure for SELECT responses when "Other" is involved:

| Selection | Stored Value |
|-----------|--------------|
| Regular option | `"Option A"` (string) |
| Other selected | `{ "other": true, "value": "user's custom text" }` |

Using `"other": true` as a flag is more reliable than checking if `selected === "Other"`.

### TypeScript Types & Utility (`lib/intake-utils.ts`)

```ts
// Type for "Other" response
export interface OtherResponse {
  other: true;
  value: string;
}

// Type guard
export function isOtherResponse(response: unknown): response is OtherResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'other' in response &&
    (response as OtherResponse).other === true
  );
}

// Get display value for any response
export function getResponseDisplayValue(response: unknown): string {
  if (isOtherResponse(response)) {
    return response.value || 'Other (no text provided)';
  }
  if (Array.isArray(response)) {
    return response.join(', ');
  }
  return String(response ?? '');
}

// Check if response is empty (for validation)
export function isResponseEmpty(response: unknown): boolean {
  if (response === null || response === undefined || response === '') {
    return true;
  }
  if (isOtherResponse(response)) {
    return !response.value?.trim();
  }
  if (Array.isArray(response)) {
    return response.length === 0;
  }
  return false;
}
```

### UI Changes (`components/intake-form.tsx`)

Replace the SELECT section (~line 251-287):

```tsx
{/* SELECT response type */}
{question.responseType === 'SELECT' && (
  <div className="space-y-2">
    <Select
      value={
        isOtherResponse(responses[question.id])
          ? '__other__'
          : (responses[question.id] as string) || ''
      }
      onValueChange={(value) => {
        if (value === '__other__') {
          updateResponse(question.id, { other: true, value: '' });
        } else {
          updateResponse(question.id, value);
        }
      }}
      required={question.isRequired}
    >
      <SelectTrigger
        style={{
          backgroundColor: theme.chrome.input,
          color: theme.textColor,
          borderColor: theme.chrome.border,
        }}
      >
        <SelectValue placeholder="Select an option..." />
      </SelectTrigger>
      <SelectContent
        style={{
          backgroundColor: theme.chrome.input,
          color: theme.textColor,
          borderColor: theme.chrome.border,
        }}
      >
        {question.options?.map((option: string, index: number) => (
          <SelectItem key={index} value={option}>
            {option}
          </SelectItem>
        ))}
        {question.allowOther && (
          <SelectItem value="__other__">Other...</SelectItem>
        )}
      </SelectContent>
    </Select>

    {/* Text input when "Other" is selected */}
    {isOtherResponse(responses[question.id]) && (
      <Input
        value={responses[question.id].value}
        onChange={(e) =>
          updateResponse(question.id, { other: true, value: e.target.value })
        }
        placeholder="Please specify..."
        autoFocus
        style={{
          backgroundColor: theme.chrome.input,
          color: theme.textColor,
          borderColor: theme.chrome.border,
        }}
      />
    )}
  </div>
)}
```

### Validation Changes

Update required field validation to use the utility:

```tsx
import { isResponseEmpty } from '@/lib/intake-utils';

const missing = questions.filter(q => {
  if (!q.isRequired) return false;
  return isResponseEmpty(responses[q.id]);
});
```

### MULTI_SELECT: Not Supported

The "Other" option is intentionally **not** supported for MULTI_SELECT. Reasons:

- Multi-select with custom input is uncommon in forms and has clunky UX
- The data structure would require polymorphism (array vs object), complicating all consuming code
- If creators need freeform input alongside multi-select, they can add a follow-up TEXT question

This keeps the implementation simple and the response data structure predictable.

---

## Files to Modify

1. `prisma/schema.prisma` - Add `allowOther` field
2. `lib/intake-utils.ts` - Create utility functions (new file)
3. `components/intake-form.tsx` - UI changes for SELECT
4. Any admin UI for creating intake questions - Add toggle for `allowOther`
5. Any code displaying intake responses - Use `getResponseDisplayValue()`

---

## Implementation Steps

1. **Schema migration**
   - Add `allowOther Boolean @default(false)` to `Intake_Question`
   - Run `npx prisma migrate dev --name add_intake_question_allow_other`

2. **Create utility file**
   - Add `lib/intake-utils.ts` with types and helpers

3. **Update intake form**
   - Import utilities
   - Modify SELECT to conditionally render "Other" option
   - Add text input that appears when "Other" selected
   - Update validation logic

4. **Update response display** (if applicable)
   - Anywhere responses are shown, use `getResponseDisplayValue()`

5. **Update question creation UI** (if exists)
   - Add checkbox/toggle for "Allow 'Other' option"

---

## Testing

1. Create a SELECT question with `allowOther: false` - verify no "Other" option appears
2. Create a SELECT question with `allowOther: true` - verify "Other" appears at end
3. Select a regular option - verify stored as plain string
4. Select "Other" and type text - verify stored as `{ other: true, value: "..." }`
5. Select "Other" with required=true but no text - verify validation fails
6. Verify existing responses (plain strings) still display correctly
7. MULTI_SELECT questions never show "Other" regardless of `allowOther` value

---

## Alternative: Convention-Based (Not Recommended)

If you want to avoid the migration, you can use a convention where including `"Other"` in the options array triggers the behavior. However, this has drawbacks:

- Magic string dependency (`"Other"` must be exact)
- Can't have a literal "Other" option without triggering special behavior
- Localization issues

See git history for the original convention-based approach if needed.
