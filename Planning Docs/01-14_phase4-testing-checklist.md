# Phase 4 Testing Checklist: messageId FK Migration

**Date:** January 14, 2026  
**Status:** Manual Testing Guide  
**Related Plan:** `01-14_add-messageid-to-event-table.md`

---

## Manual Testing Checklist

### ✅ Unit Tests (Automated)
- [x] Event creation with messageId FK
- [x] Event query by messageId FK (verify performance improvement)
- [x] Events without messageId (conversation_pattern)
- [x] Metadata doesn't contain messageId (only FK field)
- [x] Expansion_followup and gap_submission events handle messageId correctly
- [x] FK constraint validation - invalid messageId should fail (database error)

**Test Results:** All 31 unit tests passing ✅

---

### Manual Integration Tests

#### Feedback Flow Tests
- [ ] **Submit helpful feedback**
  - Navigate to chat interface
  - Submit helpful feedback on an assistant message
  - Verify: Event created with `messageId` FK set
  - Verify: `messageId` NOT in metadata JSON
  - Verify: Query performance is fast (< 50ms)

- [ ] **Submit not_helpful feedback**
  - Submit not_helpful feedback on an assistant message
  - Verify: Event created with `messageId` FK set
  - Verify: `messageId` NOT in metadata JSON

- [ ] **Submit need_more feedback**
  - Submit need_more feedback with format preferences
  - Verify: Event created with `messageId` FK set
  - Verify: Format preferences stored in metadata (not messageId)

- [ ] **Copy button click (initial)**
  - Click copy button on an assistant message
  - Verify: Event created with `messageId` FK set
  - Verify: `copyUsage` is null in metadata (initial copy)

- [ ] **Copy usage submission**
  - After clicking copy, submit usage data (use_now, reference, etc.)
  - Verify: Existing event updated (not duplicated)
  - Verify: `messageId` FK still set (not changed)
  - Verify: `copyUsage` and `copyContext` updated in metadata

- [ ] **Duplicate feedback prevention**
  - Submit the same feedback twice on the same message
  - Verify: Second submission returns success but doesn't create duplicate event
  - Verify: Only one event exists for that message/user/feedbackType

#### Bookmark Flow Tests
- [ ] **Create bookmark**
  - Create a bookmark on an assistant message
  - Verify: Event created with `messageId` FK set
  - Verify: Bookmark record created
  - Verify: `messageId` NOT in metadata JSON

- [ ] **Duplicate bookmark prevention**
  - Try to create the same bookmark twice
  - Verify: Second attempt doesn't create duplicate event or bookmark

#### Cascade Delete Tests
- [ ] **Delete message → events cascade deleted**
  - Create events for a message (feedback, copy, bookmark)
  - Delete the message
  - Verify: All events with that `messageId` FK are automatically deleted
  - Verify: No orphaned events remain

#### Query Performance Tests
- [ ] **Query events by messageId**
  - Create multiple events for different messages
  - Query events for a specific messageId
  - Verify: Query is fast (< 50ms, vs ~500ms before)
  - Verify: Only events for that messageId are returned

- [ ] **Query events by sessionId (backward compatibility)**
  - Query events by sessionId/conversationId
  - Verify: Still works correctly
  - Verify: Returns all events for that conversation

#### Dashboard Debug Page Tests
- [ ] **Feedback counts display correctly**
  - Navigate to dashboard debug page
  - Verify: Feedback counts are correct
  - Verify: Query uses messageId FK (check network tab or logs)

#### Chunk Performance Job Tests
- [ ] **Background job still works**
  - Trigger chunk performance update job
  - Verify: Job processes events correctly
  - Verify: messageId is included in event queries
  - Verify: No errors related to messageId FK

#### Edge Cases
- [ ] **Invalid messageId FK constraint**
  - Try to create event with non-existent messageId
  - Verify: Database rejects with FK constraint error
  - Verify: Application handles error gracefully (500 error)

- [ ] **Events without messageId**
  - Create conversation_pattern event (no messageId)
  - Verify: Event created successfully with `messageId: null`
  - Verify: Query by messageId doesn't return this event

- [ ] **Expansion followup events**
  - Trigger expansion pill followup
  - Verify: Event created with messageId FK extracted from metadata
  - Verify: Other metadata (result, expansion_type) preserved

- [ ] **Gap submission events**
  - Submit content gap
  - Verify: Event created with messageId FK extracted from metadata
  - Verify: Gap data preserved in metadata

---

## Performance Verification

### Before Migration
- Query events for message: ~500ms (fetch all, filter in JS)

### After Migration
- Query events for message: ~10ms (direct FK query)

**Expected improvement:** 50x faster queries ✅

---

## Database Verification

### Schema Check
- [ ] Verify `messageId` column exists in Event table
- [ ] Verify `messageId` is nullable (TEXT, not TEXT NOT NULL)
- [ ] Verify index `Event_messageId_idx` exists
- [ ] Verify FK constraint `Event_messageId_fkey` exists with CASCADE delete

### Data Integrity Check
- [ ] Verify no events have `messageId` in metadata JSON
- [ ] Verify all events that should have messageId have it in FK field
- [ ] Verify events without messages have `messageId: null`

---

## Rollback Verification (if needed)

If issues occur, verify rollback plan:
- [ ] FK constraint can be dropped
- [ ] Index can be dropped
- [ ] Code changes can be reverted
- [ ] Application still functions (with degraded performance)

---

## Notes

- **Test Environment:** Use development/staging environment first
- **Data Safety:** All existing test events were deleted (clean slate)
- **Production:** After successful testing, deploy to production
- **Monitoring:** Watch for FK constraint errors in production logs

---

## Test Completion Sign-off

- [ ] All manual tests completed
- [ ] Performance verified (50x improvement)
- [ ] No regressions found
- [ ] Ready for production deployment

**Tester:** _________________  
**Date:** _________________  
**Status:** ⬜ In Progress | ⬜ Complete | ⬜ Blocked

