# Manual Testing Checklist: Follow-Up Pills Feature

**Date:** January 16, 2025  
**Feature:** Follow-Up Pills (Task 4.4)  
**Status:** Testing Checklist

---

## Prerequisites

- [ ] Database migration applied (`followUpPills String[]` field added to Message model)
- [ ] Development server running (`npm run dev`)
- [ ] OpenAI API key configured in environment variables
- [ ] At least one chatbot created in the system
- [ ] Browser developer tools open (for network inspection and console logs)

---

## Test Scenarios

### 1. Basic Functionality: Pills Appear Below Assistant Messages

**Objective:** Verify that follow-up pills appear below assistant messages after streaming completes.

**Steps:**
1. Navigate to a chatbot chat interface
2. Send a message: "Tell me about The Art of War"
3. Wait for assistant response to finish streaming
4. Observe the area below the assistant message

**Expected Results:**
- [ ] Follow-up pills appear below the assistant message content
- [ ] Pills appear BEFORE source attribution (if sources are shown)
- [ ] Pills are styled consistently with suggested pills (secondaryAccent color with border)
- [ ] 2-4 pills are displayed
- [ ] Pills are displayed in a horizontal scrollable row

**Screenshots:**
- [ ] Screenshot of pills below message

---

### 2. Pill Click: Prefill Input

**Objective:** Verify that clicking a pill prefills the chat input without sending.

**Steps:**
1. Send a message and wait for response with pills
2. Click on one of the follow-up pills
3. Observe the chat input field

**Expected Results:**
- [ ] Input field is prefilled with the pill text
- [ ] Input field is focused (cursor visible)
- [ ] Message is NOT sent automatically
- [ ] User can edit the prefilled text before sending

**Screenshots:**
- [ ] Screenshot of prefilled input

---

### 3. Pill Click: Event Logging

**Objective:** Verify that clicking a pill logs an event to the Event table.

**Steps:**
1. Send a message and wait for response with pills
2. Open browser developer tools → Network tab
3. Click on a follow-up pill
4. Check the Network tab for POST request to `/api/events`
5. Verify event in database (optional: check via database client)

**Expected Results:**
- [ ] POST request to `/api/events` is made
- [ ] Request body contains:
  - [ ] `eventType: 'follow_up_pill_click'`
  - [ ] `sessionId: <conversationId>`
  - [ ] `metadata: { pillText: <pill text>, messageId: <message id> }`
  - [ ] `chunkIds: <array of chunk IDs>`
- [ ] Request succeeds (status 200)
- [ ] Event record exists in database (if checking directly)

**Network Request Details:**
- [ ] Request method: POST
- [ ] Request URL: `/api/events`
- [ ] Request headers: `Content-Type: application/json`
- [ ] Response status: 200

---

### 4. Multiple Messages: Pills Persist

**Objective:** Verify that pills persist for all assistant messages, not just the most recent.

**Steps:**
1. Send first message: "What is The Art of War?"
2. Wait for response and pills
3. Send second message: "Tell me more about strategy"
4. Wait for second response and pills
5. Scroll up to view first message

**Expected Results:**
- [ ] First message still has its follow-up pills visible
- [ ] Second message has its own follow-up pills
- [ ] Each message has unique pills (not duplicated)
- [ ] Pills remain visible after page reload (if messages are persisted)

**Screenshots:**
- [ ] Screenshot showing pills on multiple messages

---

### 5. Visual Consistency: Styling Matches Design System

**Objective:** Verify that pills use the same styling as suggested pills.

**Steps:**
1. Send a message and observe follow-up pills
2. Compare with suggested pills (if visible on page)
3. Check pill styling in browser DevTools

**Expected Results:**
- [ ] Pills use secondaryAccent color (matches suggested pills)
- [ ] Pills have 1px border (matches suggested pills)
- [ ] Pills have 20% opacity background (matches suggested pills)
- [ ] Pills use regular font weight (400)
- [ ] Pills have rounded-full border radius
- [ ] Pills have correct padding (10px 16px)
- [ ] Pills have correct font size (0.875rem)

**Visual Inspection:**
- [ ] Pills match suggested pill styling
- [ ] Colors are theme-aware (adapt to light/dark theme)
- [ ] Pills are readable and accessible

---

### 6. Graceful Degradation: Pill Generation Failure

**Objective:** Verify that message still displays even if pill generation fails.

**Steps:**
1. Temporarily break OpenAI API (e.g., invalid API key or network error)
2. Send a message
3. Wait for assistant response

**Expected Results:**
- [ ] Assistant message still displays normally
- [ ] No pills appear (empty array)
- [ ] No error messages shown to user
- [ ] Console logs error details (for debugging)
- [ ] Request completes successfully (status 200)

**Error Handling:**
- [ ] Error logged to console (check browser DevTools)
- [ ] Error includes: chatbotId, conversationId, responseLength
- [ ] User experience is not broken

---

### 7. Feature Toggle: Disabled Per Chatbot

**Objective:** Verify that pills can be disabled per chatbot via configJson.

**Steps:**
1. Set `configJson.enableFollowUpPills: false` for a chatbot (via database)
2. Send a message to that chatbot
3. Wait for assistant response

**Expected Results:**
- [ ] No pills are generated (no API call to OpenAI)
- [ ] No pills appear below message
- [ ] Message displays normally
- [ ] No errors in console

**Database Configuration:**
- [ ] `configJson` field updated: `{ "enableFollowUpPills": false }`
- [ ] Feature disabled for that chatbot only
- [ ] Other chatbots still generate pills (if enabled)

---

### 8. Custom Prompts: Chatbot-Specific Prompts

**Objective:** Verify that custom prompts can be used per chatbot.

**Steps:**
1. Set `configJson.followUpPillsPrompt` for a chatbot (via database)
2. Send a message to that chatbot
3. Observe the generated pills

**Expected Results:**
- [ ] Pills reflect the custom prompt's instructions
- [ ] Pills are tailored to chatbot's domain/tone
- [ ] Custom prompt is used instead of default

**Database Configuration:**
- [ ] `configJson` field updated with custom prompt
- [ ] Example: `{ "followUpPillsPrompt": "Generate strategic questions about The Art of War..." }`

---

### 9. Empty Response: No Pills Generated

**Objective:** Verify that empty or very short responses don't generate pills.

**Steps:**
1. Send a message that results in a very short response (e.g., "Yes" or "No")
2. Wait for response

**Expected Results:**
- [ ] Message displays normally
- [ ] No pills appear (or fewer pills if response is short)
- [ ] No errors

---

### 10. Performance: Generation Time

**Objective:** Verify that pill generation doesn't block the user experience.

**Steps:**
1. Send a message
2. Observe when response finishes streaming
3. Observe when pills appear

**Expected Results:**
- [ ] Response streams normally (user sees text immediately)
- [ ] Pills appear ~500ms-1s AFTER streaming completes
- [ ] User can read response while pills generate (non-blocking)
- [ ] No noticeable delay in message display

**Performance Metrics:**
- [ ] Streaming completes first
- [ ] Pills appear after streaming (smooth transition)
- [ ] Total time: streaming + ~500ms-1s for pills

---

### 11. Stream Parsing: Pills Prefix

**Objective:** Verify that pills are sent via structured prefix `__PILLS__{json}`.

**Steps:**
1. Send a message
2. Open browser DevTools → Network tab
3. Find the chat request (SSE stream)
4. Inspect the stream data

**Expected Results:**
- [ ] Stream contains `__PILLS__` prefix
- [ ] Prefix is followed by valid JSON
- [ ] JSON contains: `{ "messageId": "...", "pills": [...] }`
- [ ] Pills are parsed correctly on frontend
- [ ] No regex errors in console

**Stream Format:**
- [ ] Format: `\n\n__PILLS__{"messageId":"...","pills":["..."]}`
- [ ] JSON is valid and parseable
- [ ] No flicker when pills appear (smooth update)

---

### 12. Database Storage: Separate Field

**Objective:** Verify that pills are stored in `followUpPills` field, not in `context` field.

**Steps:**
1. Send a message and wait for pills
2. Check database (via database client or API)
3. Inspect the Message record

**Expected Results:**
- [ ] `message.followUpPills` contains array of pill strings
- [ ] `message.context` contains RAG chunks (not pills)
- [ ] `message.context.followUpPills` is undefined (pills NOT in context)
- [ ] Pills persist after page reload

**Database Verification:**
- [ ] Query: `SELECT id, "followUpPills", context FROM "Message" WHERE id = '<messageId>'`
- [ ] `followUpPills` is `string[]` type
- [ ] `context` is JSON with `{ chunks: [...] }` structure

---

### 13. Reload: Pills Persist

**Objective:** Verify that pills persist after page reload.

**Steps:**
1. Send a message and wait for pills
2. Reload the page
3. Check if pills are still visible

**Expected Results:**
- [ ] Pills are loaded from database
- [ ] Pills appear below message after reload
- [ ] Pills are clickable and functional
- [ ] Event logging still works after reload

---

### 14. Edge Cases: Special Characters

**Objective:** Verify that pills with special characters work correctly.

**Steps:**
1. Send a message that might generate pills with special characters
2. Observe pill rendering and clicking

**Expected Results:**
- [ ] Pills with quotes, apostrophes, etc. render correctly
- [ ] Clicking pills with special characters works
- [ ] Event logging handles special characters correctly

---

### 15. Accessibility: Keyboard Navigation

**Objective:** Verify that pills are accessible via keyboard.

**Steps:**
1. Send a message and wait for pills
2. Use Tab key to navigate to pills
3. Press Enter/Space to activate pill

**Expected Results:**
- [ ] Pills are focusable via Tab key
- [ ] Focus indicator is visible
- [ ] Enter/Space activates pill (prefills input)
- [ ] Screen reader announces pills correctly (aria-label)

**Accessibility Checks:**
- [ ] `aria-label` attribute present on pills
- [ ] Keyboard navigation works
- [ ] Focus styles visible
- [ ] Screen reader compatible

---

## Test Results Summary

**Date Tested:** _______________

**Overall Status:** 
- [ ] ✅ All tests passed
- [ ] ⚠️ Some tests passed with minor issues
- [ ] ❌ Critical failures

**Issues Found:**
1. 
2. 
3. 

**Notes:**
- 

---

## Sign-off

**Tester:** _______________  
**Date:** _______________  
**Approved for Production:** [ ] Yes [ ] No

---

## Additional Test Scenarios (Optional)

### A. Multiple Chatbots: Different Configurations
- Test chatbot with pills enabled
- Test chatbot with pills disabled
- Test chatbot with custom prompt
- Verify each chatbot behaves independently

### B. Network Conditions
- Test with slow network (pills appear after delay)
- Test with network interruption (graceful degradation)
- Test with offline mode (pills from cache/reload)

### C. Browser Compatibility
- Chrome/Edge
- Firefox
- Safari
- Mobile browsers

### D. Theme Variations
- Light theme
- Dark theme
- Different time periods (dawn, midday, dusk, etc.)

---

## Known Limitations

1. **Missing Creator UI**: Custom prompts and feature toggle require direct database editing (acceptable for MVP)
2. **Performance**: Adds ~500ms-1s latency after streaming (non-blocking, acceptable)
3. **Cost**: Second API call doubles cost per message (monitor usage)

---

## Related Documentation

- Implementation Plan: `01-15_contextual-followup-pills.md`
- API Documentation: `API.md`
- Component Tests: `__tests__/components/follow-up-pills.test.tsx`
- Unit Tests: `__tests__/lib/follow-up-pills/generate-pills.test.ts`
- Integration Tests: `__tests__/api/chat/route.test.ts`

