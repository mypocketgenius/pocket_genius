# Implement Conversation Management Logic

**Date:** 2026-01-16  
**Status:** Implementation Plan  
**Purpose:** Implement conversation navigation fixes and ensure URL is source of truth

---

## 1. Objective

Fix conversation management issues and add missing "New Conversation" button:
1. Verify "Start Chat" always navigates to `?new=true` and shows empty interface
2. Verify side menu conversation clicks load the selected conversation
3. Add "New Conversation" button in chat interface (icon to left of hamburger menu)
4. Ensure URL is source of truth for conversation state

**Goal:** Make URL the source of truth for conversation state, ensuring users can reliably start new conversations and navigate to specific historic conversations.

---

## 2. Acceptance Criteria

- [ ] Clicking "Start Chat" from homepage/chatbot card navigates to `/chat/${chatbotId}?new=true` and shows empty interface
- [ ] Clicking a conversation in side menu navigates to `/chat/${chatbotId}?conversationId=${id}` and loads that specific conversation
- [ ] Chat component prioritizes URL parameters over localStorage
- [ ] When `?new=true` is present, localStorage is cleared for that chatbot
- [ ] When `conversationId` is in URL, that conversation loads (not localStorage)
- [ ] Invalid conversationId (404/403) shows error and redirects to `?new=true`
- [ ] New conversations are created only when first message is sent (not on page load)
- [ ] URL updates with conversationId after new conversation is created
- [ ] All "Start Chat" buttons use `?new=true` parameter
- [ ] "New Conversation" button appears in chat header (icon to left of hamburger menu)
- [ ] "New Conversation" button navigates to `/chat/${chatbotId}?new=true`
- [ ] "New Conversation" button only appears on chat page (not other pages)

---

## 3. Clarifying Questions

**All questions answered in original planning document:**
- ✅ "New Conversation" button: Yes, icon to left of hamburger menu, only on chat page
- ✅ Completed conversations: Keep read-only behavior (already implemented)
- ✅ Conversation titles: Out of scope

**Proceed with assumptions?** Yes

---

## 4. Assumptions Gate

**Assumptions:**
- Authentication requirement is already enforced (no changes needed)
- Conversation creation logic in API is correct (creates on first message, not on page load)
- Side menu already displays conversations correctly (only navigation needs verification)
- localStorage is only used for persistence across refreshes, URL is source of truth
- Most implementation is already complete (needs verification + new button)

**Proceed with assumptions?** Yes

---

## 5. Minimal Approach

**Smallest viable change:**
1. ✅ Verify "Start Chat" buttons use `?new=true` (already implemented)
2. ✅ Verify side menu conversation clicks include `conversationId` in URL (already implemented)
3. ✅ Verify Chat component correctly handles URL parameters (already implemented)
4. ✅ Verify error handling (404/403) (already implemented)
5. **NEW:** Add "New Conversation" button to ChatHeader component
6. **NEW:** Wire up button to navigate to `?new=true`

**Key insight:** Most logic is already implemented. This is primarily verification + adding the missing "New Conversation" button.

---

## 6. Text Diagram

```
User Flow:
┌─────────────────────────────────────────────────────────┐
│ Homepage / Chatbot Card                                  │
│ Click "Start Chat" → /chat/${chatbotId}?new=true        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Chat Component                                           │
│ - Reads URL params (conversationId, new)               │
│ - If ?new=true → clear localStorage, show empty        │
│ - If conversationId → load that conversation           │
│ - If no params → show empty (ready for new)             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ User sends first message                                 │
│ → API creates conversation                              │
│ → Returns conversationId in header                      │
│ → Chat component updates URL with conversationId        │
└─────────────────────────────────────────────────────────┘

Side Menu Flow:
┌─────────────────────────────────────────────────────────┐
│ Side Menu                                                │
│ Click conversation → /chat/${chatbotId}?conversationId=X│
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Chat Component                                           │
│ - Reads conversationId from URL                         │
│ - Fetches messages for that conversation                │
│ - Displays messages                                     │
└─────────────────────────────────────────────────────────┘

New Conversation Button Flow:
┌─────────────────────────────────────────────────────────┐
│ Chat Page (any conversation state)                      │
│ Click "New Conversation" icon → /chat/${chatbotId}?new=true│
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Chat Component                                           │
│ - Clears localStorage                                   │
│ - Shows empty interface                                 │
│ - Ready for new conversation                            │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Plan File Contents

### Files to Verify (No Changes Expected)

1. **`components/chatbot-card.tsx`**
   - **Location:** `handleStartChat` function (lines 107-110)
   - **Expected:** Already uses `?new=true` parameter ✅
   - **Action:** Verify only

2. **`components/side-menu.tsx`**
   - **Location:** `handleChatClick` function (lines 306-309), `handleStartChat` (lines 318-322)
   - **Expected:** Already passes `conversationId` in URL ✅
   - **Action:** Verify only

3. **`components/chatbot-detail-modal.tsx`**
   - **Location:** Uses `onStartChat` prop (line 221/226)
   - **Expected:** Already uses `?new=true` via prop ✅
   - **Action:** Verify only

4. **`components/chat.tsx`**
   - **Location:** URL parameter handling (lines 173-204)
   - **Expected:** Already prioritizes URL parameters ✅
   - **Location:** Error handling (lines 217-257)
   - **Expected:** Already handles 404/403 errors ✅
   - **Location:** URL update after creation (lines 543-551)
   - **Expected:** Already updates URL with conversationId ✅
   - **Action:** Verify only

### Files to Modify

1. **`components/chat-header.tsx`**
   - **Action:** Add "New Conversation" button
   - **Location:** Between settings button and hamburger menu button
   - **Icon:** Use `Plus` or `MessageSquarePlus` from lucide-react
   - **Behavior:** Navigate to `/chat/${chatbotId}?new=true` when clicked
   - **Visibility:** Always visible on chat page (no conditional rendering needed)

2. **`components/chat.tsx`**
   - **Action:** Pass `chatbotId` and router to ChatHeader for new conversation handler
   - **Location:** ChatHeader component usage (around line 957-967)
   - **Change:** Add `onNewConversation` prop handler

### Implementation Details

#### ChatHeader Component Changes

**Add to imports:**
```typescript
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
```

**Add to props interface:**
```typescript
interface ChatHeaderProps {
  // ... existing props
  chatbotId: string; // Already exists
  onNewConversation?: () => void; // NEW
}
```

**Add button in JSX (between settings and hamburger menu):**
```typescript
{/* New Conversation button */}
<button
  onClick={onNewConversation}
  className="flex-shrink-0 p-2 rounded-lg transition-colors opacity-80"
  style={{
    color: theme.textColor,
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.backgroundColor = hoverBgColor;
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.backgroundColor = 'transparent';
  }}
  aria-label="Start new conversation"
  title="New conversation"
>
  <Plus className="w-5 h-5" />
</button>
```

#### Chat Component Changes

**Add handler function:**
```typescript
const handleNewConversation = () => {
  router.push(`/chat/${chatbotId}?new=true`);
};
```

**Update ChatHeader usage:**
```typescript
<ChatHeader
  chatbotTitle={chatbotTitle}
  conversationId={conversationId}
  chatbotId={chatbotId}
  messages={messages}
  error={error}
  onBack={() => router.back()}
  onMenuClick={() => setSideMenuOpen(true)}
  onSettingsClick={() => setSettingsModalOpen(true)}
  onNewConversation={handleNewConversation} // NEW
  isSignedIn={isSignedIn}
/>
```

---

## 8. Work Plan

### Task 1: Verify Existing Implementation ✅
**Subtask 1.1** — Verify all "Start Chat" entry points  
**Status:** ✅ Complete - All entry points verified to use `?new=true`  
**Visible output:** Confirmation that all buttons use correct URL pattern

**Subtask 1.2** — Verify Chat component URL handling  
**Status:** ✅ Complete - URL parameters prioritized correctly  
**Visible output:** Code review confirms correct implementation

**Subtask 1.3** — Verify error handling  
**Status:** ✅ Complete - 404/403 handling implemented  
**Visible output:** Code review confirms error handling

### Task 2: Add "New Conversation" Button
**Subtask 2.1** — Add button to ChatHeader component  
**Visible output:** `components/chat-header.tsx` updated with new button

**Subtask 2.2** — Add handler in Chat component  
**Visible output:** `components/chat.tsx` updated with `handleNewConversation` function

**Subtask 2.3** — Wire up button to navigation  
**Visible output:** Button navigates to `?new=true` when clicked

### Task 3: Testing
**Subtask 3.1** — Test "Start Chat" flow from homepage  
**Visible output:** Test results showing navigation to `?new=true`

**Subtask 3.2** — Test side menu conversation navigation  
**Visible output:** Test results showing conversation loads correctly

**Subtask 3.3** — Test "New Conversation" button  
**Visible output:** Test results showing button navigates correctly

**Subtask 3.4** — Test URL parameter priority  
**Visible output:** Test results confirming URL takes precedence over localStorage

**Subtask 3.5** — Test localStorage clearing with `?new=true`  
**Visible output:** Test results confirming localStorage is cleared

**Subtask 3.6** — Test error handling (404, 403)  
**Visible output:** Test results showing errors handled correctly

---

## 9. Architectural Discipline

**File Limits:**
- `components/chat.tsx`: Currently ~1513 lines (exceeds 120 line limit, but acceptable as core component)
- `components/chat-header.tsx`: Currently ~158 lines (exceeds 120 line limit, but acceptable as header component)
- `components/side-menu.tsx`: Currently ~692 lines (exceeds 120 line limit, but acceptable as core component)
- No new files needed - changes are additions to existing components

**Function Limits:**
- Adding 1 new function (`handleNewConversation`) - within limits
- Existing functions are within reasonable limits

**Design Rules:**
- **Single Responsibility**: Each component maintains its current responsibility
- **No New Dependencies**: No new packages needed (using existing lucide-react icons)
- **Minimal Changes**: Only adding button and handler, no refactoring

---

## 10. Risks & Edge Cases

### Identified Risks

1. **Low Risk:** Most implementation is already complete
   - **Mitigation:** Focus on verification and adding missing button

2. **Edge Cases Already Handled:**
   - Invalid conversationId (404) → Error + redirect ✅
   - Unauthorized access (403) → Error + redirect ✅
   - localStorage corruption → URL is source of truth ✅
   - Multiple tabs → Each tab independent ✅
   - Anonymous users → Redirect to sign-in ✅

### Edge Cases to Test

1. **New Conversation button while in active conversation**
   - **Expected:** Clears current conversation, shows empty interface
   - **Test:** Click button → verify localStorage cleared → verify empty interface

2. **New Conversation button while viewing completed conversation**
   - **Expected:** Same behavior as active conversation
   - **Test:** Click button → verify navigation to `?new=true`

3. **New Conversation button with unsent messages**
   - **Expected:** Messages are cleared (no conversation exists yet)
   - **Test:** Type message but don't send → click button → verify empty interface

---

## 11. Tests

### Test 1: Start Chat from Homepage
**Input:** User clicks "Start Chat" on chatbot card  
**Expected Output:** 
- Navigate to `/chat/${chatbotId}?new=true`
- Chat component shows empty interface
- localStorage cleared for that chatbot

### Test 2: Click Historic Conversation in Side Menu
**Input:** User clicks conversation in side menu  
**Expected Output:**
- Navigate to `/chat/${chatbotId}?conversationId=${id}`
- Chat component loads that specific conversation
- Messages from that conversation are displayed

### Test 3: New Conversation Button
**Input:** User clicks "New Conversation" button in chat header  
**Expected Output:**
- Navigate to `/chat/${chatbotId}?new=true`
- Chat interface clears, shows empty state
- localStorage cleared for this chatbot

### Test 4: Invalid ConversationId
**Input:** User navigates to `/chat/${chatbotId}?conversationId=invalid`  
**Expected Output:**
- API returns 404
- Error message displayed: "Conversation not found"
- Redirect to `/chat/${chatbotId}?new=true` after 3 seconds

### Test 5: localStorage Priority
**Input:** User has conversationId in localStorage, navigates to `/chat/${chatbotId}?new=true`  
**Expected Output:**
- localStorage entry is cleared
- Empty interface is shown
- URL parameter takes precedence

### Test 6: URL Update After Creation
**Input:** User sends first message in new conversation  
**Expected Output:**
- API creates new conversation
- URL updates to `/chat/${chatbotId}?conversationId=${newId}`
- ConversationId stored in localStorage

---

## 12. Approval Prompt

**Approve the plan to proceed to BUILD?** (Yes / Answer questions / Edit)

---

## 13. Implementation Checklist

### Verification Tasks
- [ ] Verify Chat component prioritizes URL parameters over localStorage (`components/chat.tsx:173-204`)
- [ ] Verify Side Menu passes conversationId in URL when clicking conversations (`components/side-menu.tsx:306-309`)
- [ ] Verify Chatbot Card "Start Chat" uses `?new=true` parameter (`components/chatbot-card.tsx:107-110`)
- [ ] Verify Side Menu "Start Chat" uses `?new=true` parameter (`components/side-menu.tsx:318-322`)
- [ ] Verify Chatbot Detail Modal "Start Chat" uses `?new=true` parameter (via `onStartChat` prop)
- [ ] Verify Conversation creation only happens when first message is sent (`app/api/chat/route.ts:179-226`)
- [ ] Verify Edge cases (404, 403) are handled (`components/chat.tsx:217-257`)
- [ ] Verify URL updates with conversationId after creation (`components/chat.tsx:543-551`)

### Implementation Tasks
- [ ] Add `Plus` icon import to `components/chat-header.tsx`
- [ ] Add `onNewConversation` prop to `ChatHeaderProps` interface
- [ ] Add "New Conversation" button to ChatHeader JSX (between settings and hamburger menu)
- [ ] Add `handleNewConversation` function to `components/chat.tsx`
- [ ] Pass `onNewConversation` prop to ChatHeader component

### Testing Tasks
- [ ] Test "Start Chat" from homepage → should navigate to `?new=true`
- [ ] Test "Start Chat" from chatbot card → should navigate to `?new=true`
- [ ] Test "Start Chat" from chatbot detail modal → should navigate to `?new=true`
- [ ] Test clicking conversation in side menu → should navigate to `?conversationId=${id}`
- [ ] Test "New Conversation" button → should navigate to `?new=true`
- [ ] Test invalid conversationId → should show error and redirect to `?new=true`
- [ ] Test unauthorized conversation access → should show error and redirect to `?new=true`
- [ ] Test localStorage clearing when `?new=true` is present
- [ ] Test URL parameter priority over localStorage
- [ ] Test URL update after new conversation creation

---

## 14. Code Changes Summary

### File: `components/chat-header.tsx`

**Changes:**
1. Add `Plus` import from `lucide-react`
2. Add `onNewConversation?: () => void` to `ChatHeaderProps` interface
3. Add "New Conversation" button between settings button and hamburger menu button
4. Button uses `Plus` icon, calls `onNewConversation` when clicked
5. Button styled consistently with other header buttons (theme-aware)

**Lines to modify:** ~5-10 lines added

### File: `components/chat.tsx`

**Changes:**
1. Add `handleNewConversation` function that navigates to `?new=true`
2. Pass `onNewConversation={handleNewConversation}` prop to ChatHeader component

**Lines to modify:** ~5 lines added

---

## 15. Expected Outcomes

After implementation:
- ✅ Users can start new conversations from "Start Chat" buttons
- ✅ Users can navigate to specific conversations from side menu
- ✅ Users can start new conversations from chat interface via button
- ✅ URL is always source of truth for conversation state
- ✅ localStorage is cleared when starting new conversation
- ✅ Error handling works correctly for invalid/unauthorized conversations
- ✅ New conversations created only when first message is sent
- ✅ URL updates automatically after conversation creation

---

## 16. Notes

- Most implementation is already complete - this plan focuses on verification + adding missing button
- No database changes needed
- No API changes needed
- No new dependencies needed
- Minimal code changes required (~10-15 lines total)



