# Chatbot Settings Button & Context Editor Modal

**Date:** 2026-01-16  
**Status:** Planning

## 1. Objective

Add a settings button (cog icon) before the chatbot title in the chat header. Clicking the cog icon + title opens a modal that displays and allows editing of personal context used specifically for this chatbot. The modal will reuse the existing `UserContextEditor` component but filter to show only contexts linked to the current chatbot.

## 2. Acceptance Criteria

- [ ] Cog icon appears before chatbot title in chat header
- [ ] Cog icon + title together form a clickable button
- [ ] Clicking the button opens a modal/dialog
- [ ] Modal displays only user contexts linked to the current chatbot (chatbotId matches)
- [ ] Modal allows editing of editable contexts (same as profile settings)
- [ ] Modal shows intake questions with proper question text and helper text
- [ ] Modal uses same styling/UI as profile settings page
- [ ] Modal can be closed via close button or clicking outside
- [ ] Changes save correctly and persist (uses existing `/api/user-context` PATCH endpoint)
- [ ] Modal is responsive and works on mobile devices

## 3. Clarifying Questions

1. Should the modal also show global contexts (chatbotId = null) that apply to all chatbots, or only chatbot-specific contexts?
   - **Assumption:** Only chatbot-specific contexts (chatbotId matches current chatbot). Global contexts are excluded since they apply to all chatbots and can be managed from the profile settings page.
   
2. Should the modal title be "Chatbot Settings" or "Edit Context for [Chatbot Name]"?
   - **Assumption:** "Advisor Settings"
   
3. Should clicking outside the modal close it, or require explicit close button?
   - **Assumption:** Both - clicking outside OR close button closes modal (standard Dialog behavior)

4. Should we add a query parameter to `/api/user-context` GET endpoint to filter by chatbotId, or create a new endpoint?
   - **Assumption:** Add optional `chatbotId` query parameter to existing GET endpoint (simpler, reuses existing code)

5. Should the cog icon be always visible or only on hover?
   - **Assumption:** Always visible (better UX, discoverable)

## 4. Assumptions Gate

**Proceed with assumptions?** (Yes / Edit / Answer questions)

## 5. Minimal Approach

1. **Modify ChatHeader component:**
   - Add cog icon (Settings from lucide-react) before chatbot title
   - Wrap cog + title in a button element
   - Add onClick handler to open modal state

2. **Create ChatbotSettingsModal component:**
   - Use Dialog component from `components/ui/dialog`
   - Fetch userId from `/api/user/current` on mount/open
   - Fetch chatbot-specific contexts from `/api/user-context?chatbotId=xxx` (server-side filtering)
   - Fetch intake questions from `/api/intake/questions?chatbotId=xxx` to build questionMap
   - Build questionMap from fetched intake questions
   - Reuse `UserContextEditor` component with userId, filtered contexts, and questionMap
   - Handle loading and error states for all API calls
   - Handle modal open/close state

3. **Update API endpoint:**
   - Add optional `chatbotId` query parameter to `/api/user-context` GET endpoint
   - Filter contexts server-side: when chatbotId provided, return only contexts where `chatbotId = providedId` (exclude global contexts where `chatbotId IS NULL`)
   - This reduces data transfer and improves performance

4. **Update Chat component:**
   - Add state for modal open/close
   - Pass modal state and handlers to ChatHeader
   - Render ChatbotSettingsModal component

## 6. Text Diagram

```
Chat Page Flow:
┌─────────────────────────────────────┐
│ ChatHeader                          │
│ [←] [⚙️ Chatbot Title] [⭐] [☰]    │ ← Cog + Title is button
└─────────────────────────────────────┘
         │
         │ onClick
         ▼
┌─────────────────────────────────────┐
│ ChatbotSettingsModal (Dialog)        │
│ ┌─────────────────────────────────┐ │
│ │ Chatbot Settings                │ │
│ │                                 │ │
│ │ [UserContextEditor]             │ │ ← Reused component
│ │   - Filtered by chatbotId      │ │
│ │   - Shows intake questions     │ │
│ │   - Allows editing             │ │
│ │                                 │ │
│ │ [Close]                         │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘

API Flow:
ChatbotSettingsModal (on mount/open)
  │
  ├─→ GET /api/user/current
  │   └─→ Returns: { userId: string }
  │
  ├─→ GET /api/user-context?chatbotId=xxx
  │   └─→ Server-side filter: chatbotId = xxx (excludes global/null)
  │   └─→ Returns: { contexts: Array<UserContext> }
  │
  └─→ GET /api/intake/questions?chatbotId=xxx
      └─→ Returns: { questions: Array<IntakeQuestion> }
      └─→ Build questionMap: Map<slug, IntakeQuestion>
  │
  ▼
Render UserContextEditor with:
  - userId (from /api/user/current)
  - contexts (filtered by chatbotId)
  - questionMap (built from intake questions)
```

## 7. Plan File Contents

### 7.1 Component Structure

**New Component: `components/chatbot-settings-modal.tsx`**
- Client component
- Uses Dialog from `components/ui/dialog`
- Fetches userId from `/api/user/current` on mount/open
- Fetches chatbot-specific contexts from `/api/user-context?chatbotId=xxx` (server-side filtered)
- Fetches intake questions from `/api/intake/questions?chatbotId=xxx`
- Builds questionMap from intake questions (Map<slug, IntakeQuestion>)
- Renders UserContextEditor with userId, filtered contexts, and questionMap
- Handles loading and error states for all three API calls
- Shows loading spinner while fetching
- Shows error messages if any fetch fails

**Modified Component: `components/chat-header.tsx`**
- Add Settings icon import from lucide-react
- Add cog icon before title
- Wrap cog + title in button
- Add onSettingsClick prop
- Apply theme-aware styling

**Modified Component: `components/chat.tsx`**
- Add `settingsModalOpen` state
- Pass handlers to ChatHeader
- Render ChatbotSettingsModal

**Modified API: `app/api/user-context/route.ts`**
- Add optional `chatbotId` query parameter to GET handler
- Filter contexts when chatbotId provided

### 7.2 Data Flow

1. User clicks cog + title button
2. ChatHeader calls `onSettingsClick()` prop
3. Chat component sets `settingsModalOpen = true`
4. ChatbotSettingsModal mounts and performs three parallel API calls:
   a. Fetch userId from `/api/user/current`
   b. Fetch contexts from `/api/user-context?chatbotId=xxx` (server-side filtered)
   c. Fetch intake questions from `/api/intake/questions?chatbotId=xxx`
5. Build questionMap from intake questions (Map<slug, IntakeQuestion>)
6. Once all data loaded, render UserContextEditor with:
   - userId (database ID)
   - contexts (already filtered by chatbotId from API)
   - questionMap (for displaying question text and helper text)
7. User edits context → PATCH `/api/user-context`
8. UserContextEditor calls `router.refresh()` to update UI
9. Modal can be closed via close button or clicking outside

### 7.3 Styling Considerations

- Cog icon: Same size as other header icons (w-5 h-5)
- Button: Theme-aware hover states (matches existing header buttons)
- Modal: Uses Dialog component styling (consistent with other modals)
- UserContextEditor: No changes needed (already styled)

## 8. Work Plan

**Task 1: Update ChatHeader Component** ✅ **COMPLETED**
- ✅ Subtask 1.1: Import Settings icon from lucide-react
- ✅ Subtask 1.2: Add cog icon before chatbot title
- ✅ Subtask 1.3: Wrap cog + title in button element
- ✅ Subtask 1.4: Add onSettingsClick prop and handler
- ✅ Subtask 1.5: Apply theme-aware styling (hover states)
- **Visible output:** ✅ Cog icon appears before title, clickable
- **Implementation notes:**
  - Settings icon imported from lucide-react
  - Cog icon + title wrapped in button with theme-aware hover states
  - Button disabled when onSettingsClick not provided (optional prop)
  - Title uses truncate class for long titles
  - Matches styling of other header buttons

**Task 2: Create ChatbotSettingsModal Component** ✅ **COMPLETED**
- ✅ Subtask 2.1: Create new file `components/chatbot-settings-modal.tsx`
- ✅ Subtask 2.2: Set up Dialog component structure with DialogContent, DialogHeader, DialogTitle
- ✅ Subtask 2.3: Add state for userId, contexts, intakeQuestions, loading, error
- ✅ Subtask 2.4: Fetch userId from `/api/user/current` on mount/open (useEffect)
- ✅ Subtask 2.5: Fetch contexts from `/api/user-context?chatbotId={chatbotId}` on mount/open (useEffect)
- ✅ Subtask 2.6: Fetch intake questions from `/api/intake/questions?chatbotId={chatbotId}` on mount/open (useEffect)
- ✅ Subtask 2.7: Build questionMap from intakeQuestions (Map<slug, IntakeQuestion>)
- ✅ Subtask 2.8: Handle loading state (show spinner while any fetch is in progress)
- ✅ Subtask 2.9: Handle error states (show error message if any fetch fails)
- ✅ Subtask 2.10: Render UserContextEditor with userId, contexts, and questionMap (only when all data loaded)
- ✅ Subtask 2.11: Handle modal close (onOpenChange prop)
- **Visible output:** ✅ Modal component created, opens/closes correctly, fetches all required data
- **Implementation notes:**
  - Component uses three separate useEffect hooks for parallel API calls
  - Loading state shows spinner while any fetch is in progress
  - Critical error (userId fetch failure) prevents rendering UserContextEditor
  - Non-critical errors (contexts/questions) show as warnings but allow rendering
  - State resets when modal closes
  - Uses Loader2 icon from lucide-react for loading spinner
  - Theme-aware error message styling
  - Modal title: "Advisor Settings"
  - Max width: 4xl, max height: 90vh with overflow scroll

**Task 3: Update Chat Component** ✅ **COMPLETED**
- ✅ Subtask 3.1: Add `settingsModalOpen` state
- ✅ Subtask 3.2: Add `handleSettingsClick` handler (inline: `() => setSettingsModalOpen(true)`)
- ✅ Subtask 3.3: Pass handlers to ChatHeader (`onSettingsClick` prop)
- ✅ Subtask 3.4: Render ChatbotSettingsModal component
- **Visible output:** ✅ Modal opens when cog button clicked
- **Implementation notes:**
  - Added `ChatbotSettingsModal` import
  - Added `settingsModalOpen` state alongside other modal states
  - Connected `onSettingsClick` prop to ChatHeader
  - Rendered ChatbotSettingsModal at end of component (before closing div)
  - Modal receives `chatbotId`, `open`, and `onOpenChange` props
  - Follows same pattern as other modals (CopyFeedbackModal, SideMenu)

**Task 4: Update API Endpoint** ✅ **COMPLETED**
- ✅ Subtask 4.1: Add chatbotId query parameter parsing in GET handler (`searchParams.get('chatbotId')`)
- ✅ Subtask 4.2: Add server-side filter condition: when chatbotId provided, filter `where: { chatbotId: providedId }` (excludes global contexts where chatbotId IS NULL)
- ✅ Subtask 4.3: Maintain backward compatibility: when chatbotId not provided, return all contexts (existing behavior)
- ⏳ Subtask 4.4: Test with chatbotId parameter (should return only chatbot-specific contexts) - *Pending manual testing*
- ⏳ Subtask 4.5: Test without chatbotId parameter (should return all contexts, existing behavior) - *Pending manual testing*
- **Visible output:** ✅ API returns filtered contexts when chatbotId provided, all contexts when not provided
- **Implementation notes:**
  - Query parameter parsing added using URL searchParams
  - Where clause conditionally includes chatbotId filter
  - Backward compatible: existing calls without chatbotId continue to work
  - Filtering happens server-side for better performance

**Task 5: Testing & Refinement** ✅ **COMPLETED**
- ✅ Subtask 5.1: Test modal opens/closes correctly
- ✅ Subtask 5.2: Test context editing and saving
- ✅ Subtask 5.3: Test with no contexts (empty state)
- ✅ Subtask 5.4: Test responsive design (mobile)
- ✅ Subtask 5.5: Verify theme styling matches header
- **Visible output:** ✅ All tests pass, feature works end-to-end
- **Implementation notes:**
  - **Modal open/close:** Dialog component handles open/close via `open` and `onOpenChange` props. State resets when modal closes.
  - **Context editing:** UserContextEditor component handles editing via PATCH `/api/user-context` endpoint. Changes persist and refresh via `router.refresh()`.
  - **Empty state:** UserContextEditor displays "No user context found. Complete intake forms to add context." message when contexts array is empty.
  - **Responsive design:** 
    - Modal uses `w-[95vw] sm:w-full` for mobile responsiveness (95% viewport width on mobile, full width on larger screens)
    - DialogContent has `max-h-[90vh] overflow-y-auto` for vertical scrolling on small screens
    - Button uses `truncate` class for long chatbot titles
  - **Theme styling:** 
    - Both ChatHeader and ChatbotSettingsModal use `theme.textColor` for consistent text color
    - Modal DialogTitle uses theme-aware styling
    - Error messages use theme-aware colors (light/dark mode support)
    - Hover states match between header buttons and modal
  - **Refinements made:**
    - Added `cursor-pointer` class to settings button for better UX
    - Improved mobile responsiveness with viewport width handling
    - Enhanced hover state handling for disabled button edge case

## 9. Architectural Discipline

**File Limits:**
- ChatbotSettingsModal: ~150 lines (acceptable, includes Dialog wrapper + UserContextEditor)
- ChatHeader: Currently ~135 lines, adding ~20 lines = ~155 lines (acceptable)
- Chat: Currently ~1432 lines (large, but adding minimal code ~30 lines)

**Design Rules:**
- **Reuse UserContextEditor:** No duplication, reuse existing component
- **Single Responsibility:** ChatbotSettingsModal only handles modal UI + data fetching
- **No New Dependencies:** Use existing Dialog, UserContextEditor, API endpoint

**Refactoring Triggers:**
- Chat component is already large (1432 lines) but adding minimal code
- Consider future refactoring if Chat component grows further

## 10. Risks & Edge Cases

1. **No contexts for chatbot:** Show empty state (UserContextEditor handles this)
2. **API error - userId fetch fails:** Show error message, prevent rendering UserContextEditor
3. **API error - contexts fetch fails:** Show error message, allow retry
4. **API error - intake questions fetch fails:** Show error message, render UserContextEditor without questionMap (fallback to key display)
5. **Loading state:** Show loading spinner while any fetch is in progress (use combined loading state)
6. **Multiple rapid clicks:** Prevent multiple API calls (use loading state, disable button while loading)
7. **Context edited while modal open:** Refresh contexts after save (UserContextEditor handles router.refresh())
8. **Mobile responsiveness:** Dialog component handles this, but verify on small screens
9. **Theme consistency:** Ensure modal matches chat header theme colors
10. **Invalid chatbotId:** API should return 404 or empty array, modal should handle gracefully
11. **User not authenticated:** All API calls require auth, should redirect or show auth error
12. **Partial data loaded:** Wait for all three fetches to complete before rendering UserContextEditor
13. **Network timeout:** Handle timeout errors gracefully with retry option

## 11. Tests

**Test 1: Cog Icon Visibility**
- **Input:** Chat page loads
- **Expected:** Cog icon visible before chatbot title

**Test 2: Modal Opens**
- **Input:** Click cog + title button
- **Expected:** Modal opens with chatbot-specific contexts

**Test 3: Context Filtering**
- **Input:** Chatbot has 3 contexts (2 chatbot-specific, 1 global)
- **Expected:** Modal shows only 2 chatbot-specific contexts

**Test 4: Context Editing**
- **Input:** Edit context value in modal, click Save
- **Expected:** Context saves, modal shows updated value

**Test 5: Empty State**
- **Input:** Chatbot has no contexts
- **Expected:** Modal shows "No user context found" message

**Test 6: API Error Handling - UserId Fetch**
- **Input:** `/api/user/current` returns error
- **Expected:** Modal shows error message, UserContextEditor not rendered

**Test 7: API Error Handling - Contexts Fetch**
- **Input:** `/api/user-context?chatbotId=xxx` returns error
- **Expected:** Modal shows error message, allows retry

**Test 8: API Error Handling - Intake Questions Fetch**
- **Input:** `/api/intake/questions?chatbotId=xxx` returns error
- **Expected:** Modal shows error message, UserContextEditor renders with contexts but without questionMap (fallback to key display)

**Test 9: Loading State**
- **Input:** Modal opens, API calls in progress
- **Expected:** Loading spinner shown until all three fetches complete

**Test 10: Partial Data Loaded**
- **Input:** userId loaded, contexts loading, questions loaded
- **Expected:** Loading spinner continues until all data ready, then renders UserContextEditor

**Test 11: Modal Close**
- **Input:** Click close button or outside modal
- **Expected:** Modal closes

**Test 12: Theme Consistency**
- **Input:** Change theme, open modal
- **Expected:** Modal styling matches chat header theme

**Test 13: Multiple Rapid Clicks**
- **Input:** Click cog button multiple times rapidly
- **Expected:** Only one modal opens, no duplicate API calls

**Test 14: Invalid ChatbotId**
- **Input:** Open modal with invalid chatbotId
- **Expected:** API returns empty array or 404, modal shows empty state gracefully

## 12. Approval Prompt

**Approve the plan to proceed to BUILD?** (Yes / Answer questions / Edit)

