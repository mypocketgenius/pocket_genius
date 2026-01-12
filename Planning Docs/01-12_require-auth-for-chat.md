# Plan: Require Authentication for Chat

## 1. Objective

Require users to sign in before they can start or continue a chat conversation. When an unauthenticated user attempts to access a chat page or send a message, they should be redirected to sign in.

## 2. Acceptance Criteria

- ✅ Unauthenticated users cannot access `/chat/[chatbotId]` pages (blocked by client-side check)
- ✅ Unauthenticated users cannot send messages via `/api/chat` endpoint
- ✅ Sign-in modal opens automatically when unauthenticated users attempt to access chat
- ✅ After signing in via modal, users are redirected back to the chat page they were trying to access
- ✅ Existing authenticated users can continue using chat without interruption
- ✅ Chat component shows appropriate loading/auth prompt during authentication check

## 3. Clarifying Questions

1. **Redirect behavior**: Should we redirect to Clerk's sign-in page or use Clerk's modal sign-in? (Current codebase uses modal mode in headers)
2. **Anonymous chatbot support**: Should we completely remove support for `allowAnonymous` chatbots, or keep that flag but require auth for all chats regardless?
3. **Existing conversations**: If a user has an existing conversation ID in localStorage but isn't authenticated, should we clear it or preserve it for after sign-in?

## 4. Assumptions Gate

**Proceeding with assumptions:**
- Use Clerk's modal sign-in (existing popup) for route protection - consistent with current UX
- Keep `allowAnonymous` flag in database but require authentication for all chat access (flag can be used for future features)
- Clear localStorage conversationId if user is not authenticated (they'll get a new conversation after sign-in)
- After sign-in via modal, redirect to the originally requested chat page
- Use `useClerk().openSignIn()` to programmatically open the modal when unauthenticated users access chat

**Proceed with assumptions? (Yes / Edit / Answer questions)**

## 5. Minimal Approach

1. **Protect chat route** - Skip middleware protection, handle auth in page component (allows modal)
2. **Protect chat API** - Require authentication in `/api/chat` route handler
3. **Update chat page** - Add server-side auth check, but allow page to render (for modal trigger)
4. **Update chat component** - Check auth on mount, open modal if not authenticated, handle redirect after sign-in
5. **Fix chatbot detail modal** - Use Clerk's `openSignIn()` with redirectUrl instead of router.push

## 6. Text Diagram

```
User Flow:
┌─────────────────┐
│ User clicks     │
│ "Start Chat"    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Navigate to     │
│ /chat/[id]      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│ Page component  │─────▶│ Not signed   │
│ checks auth     │      │ in?          │
└────────┬────────┘      └──────┬───────┘
         │                      │
         │ Yes                  │ No
         ▼                      ▼
┌─────────────────┐      ┌──────────────┐
│ Render chat     │      │ Open sign-in │
│ component       │      │ modal        │
└─────────────────┘      └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │ User signs in │
                         │ in modal      │
                         └──────┬───────┘
                                 │
                                 ▼
                         ┌──────────────┐
                         │ Modal closes,│
                         │ page reloads  │
                         │ with auth     │
                         └──────────────┘
```

## 7. Plan File Contents

### 7.1 Middleware Protection

**File**: `middleware.ts`

**Current state**: No route protection, all routes public

**Changes**:
- **No changes needed** - We'll handle auth in the page component to allow modal sign-in
- Keep middleware as-is (all routes public) so we can trigger modal instead of redirect
- API routes will handle their own auth checks

**Rationale**: Clerk middleware's `auth.protect()` redirects to a sign-in page. To use the modal instead, we skip middleware protection and handle auth in the page component, where we can programmatically open the modal.

### 7.2 Chat Page Server-Side Auth Check

**File**: `app/chat/[chatbotId]/page.tsx`

**Current state**: No auth check, renders chat for anyone

**Changes**:
- **No server-side redirect** - Allow page to render so client component can trigger modal
- Keep existing chatbot existence check
- Pass chatbotId to Chat component (already done)

**Rationale**: We want the page to render so the client component can check auth and open the modal. Server-side redirect would prevent modal usage.

### 7.3 Chat API Route Auth Requirement & Cleanup

**File**: `app/api/chat/route.ts`

**Current state**: Optional auth (line 52-63), allows anonymous users with fallback logic

**Changes**:
1. **Require authentication** - return 401 if not authenticated
2. **Remove anonymous user support logic** - clean up all fallbacks
3. **Ensure dbUserId is always present** - remove null checks and `|| undefined` fallbacks
4. **Simplify rate limit logic** - remove anonymous user branch
5. **Update conversation access check** - require auth, remove anonymous access comments
6. **Keep conversation upgrade logic** - useful for migrating existing anonymous conversations

**Specific cleanup locations**:

**Line ~52-63**: Replace optional auth with required auth check:
```typescript
// OLD (lines 52-63):
// 1. Authenticate user (optional for MVP - allow anonymous users)
const { userId: clerkUserId } = await auth();

// Get database user ID if authenticated
let dbUserId: string | null = null;
if (clerkUserId) {
  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
  dbUserId = user?.id || null;
}

// NEW:
// 1. Authenticate user (REQUIRED)
const { userId: clerkUserId } = await auth();
if (!clerkUserId) {
  return NextResponse.json(
    { error: 'Authentication required' },
    { status: 401 }
  );
}

// Get database user ID (required)
const user = await prisma.user.findUnique({
  where: { clerkId: clerkUserId },
  select: { id: true },
});

if (!user) {
  return NextResponse.json(
    { error: 'User not found' },
    { status: 404 }
  );
}

const dbUserId = user.id; // Always present, no null
```

**Line ~149-173**: Simplify rate limit logic - remove anonymous user branch:
```typescript
// OLD (lines 149-173):
// 5. Check rate limit (only for authenticated users)
let remainingMessages = RATE_LIMIT; // Default for anonymous users
if (dbUserId) {
  const allowed = await checkRateLimit(dbUserId);
  remainingMessages = await getRemainingMessages(dbUserId);
  // ... rate limit check
} else {
  // For anonymous users, get remaining (always RATE_LIMIT for now)
  remainingMessages = await getRemainingMessages(null);
}

// NEW:
// 5. Check rate limit (dbUserId always present now)
const allowed = await checkRateLimit(dbUserId);
const remainingMessages = await getRemainingMessages(dbUserId);

if (!allowed) {
  // ... rate limit error response
}
```

**Line ~216**: Remove `|| undefined` fallback in conversation creation:
```typescript
// OLD (line 216):
userId: dbUserId || undefined,

// NEW:
userId: dbUserId, // Always present
```

**Line ~243-253**: Update conversation access check - remove anonymous access comments:
```typescript
// OLD (lines 243-253):
// Verify conversation belongs to user (if authenticated)
// Allow access if:
// 1. Conversation has no userId (anonymous) - anyone can access
// 2. Conversation userId matches current user
// 3. Current user is anonymous - can access anonymous conversations
if (conversation.userId && dbUserId && conversation.userId !== dbUserId) {
  return NextResponse.json(
    { error: 'Unauthorized access to conversation' },
    { status: 403 }
  );
}

// NEW:
// Verify conversation belongs to user
// Allow access if:
// 1. Conversation has no userId (legacy anonymous) - upgrade ownership below
// 2. Conversation userId matches current user
if (conversation.userId && conversation.userId !== dbUserId) {
  return NextResponse.json(
    { error: 'Unauthorized access to conversation' },
    { status: 403 }
  );
}
```

**Line ~275**: Remove `|| undefined` fallback in user message creation:
```typescript
// OLD (line 275):
userId: dbUserId || undefined,

// NEW:
userId: dbUserId, // Always present
```

**Line ~527**: Remove `|| undefined` fallback in assistant message creation:
```typescript
// OLD (line 527):
userId: dbUserId || undefined,

// NEW:
userId: dbUserId, // Always present
```

**Keep unchanged**: Lines 255-266 (conversation upgrade logic) - useful for migrating existing anonymous conversations to authenticated users.

### 7.4 Chat Component Auth State Handling

**File**: `components/chat.tsx`

**Current state**: Uses `useAuth()` but doesn't block access

**Changes**:
- Add auth check on mount - open modal if not signed in
- Clear localStorage conversationId if not authenticated
- Show loading state during auth check
- Show auth prompt UI while waiting for sign-in
- Handle redirect after successful sign-in

```typescript
// components/chat.tsx
import { useAuth, useClerk } from '@clerk/nextjs';
// ... existing imports

export default function Chat({ chatbotId, chatbotTitle }: ChatProps) {
  const { isSignedIn, isLoaded } = useAuth();
  const clerk = useClerk();
  const router = useRouter();
  
  // Check auth and open modal if needed
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      // Clear any stored conversation data
      localStorage.removeItem(`conversationId_${chatbotId}`);
      // Open sign-in modal with redirect URL
      clerk.openSignIn({
        redirectUrl: `/chat/${chatbotId}`,
      });
    }
  }, [isLoaded, isSignedIn, chatbotId, clerk]);
  
  // Show loading while checking auth
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <div>Loading...</div>
      </div>
    );
  }
  
  // Show auth prompt if not signed in (modal should be open)
  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <div className="text-center">
          <p className="text-lg mb-4">Please sign in to continue</p>
          <p className="text-sm text-gray-500">Sign-in modal should open automatically...</p>
        </div>
      </div>
    );
  }
  
  // ... rest of existing code
}
```

### 7.5 Chatbot Detail Modal Sign-In Redirect Fix

**File**: `components/chatbot-detail-modal.tsx`

**Current state**: Line 218 tries to push to `/sign-in` which may not exist

**Changes**:
- Use Clerk's `useClerk().openSignIn()` to open modal with redirect URL
- Update logic to use modal sign-in instead of router.push

```typescript
// components/chatbot-detail-modal.tsx
import { useClerk } from '@clerk/nextjs';
// ... existing imports

// In component:
const clerk = useClerk();

// In handleStartChat function:
} else if (chatbot.priceCents === 0 && !chatbot.allowAnonymous) {
  // Free but requires login
  if (isSignedIn) {
    onStartChat(chatbot.id);
    onClose();
  } else {
    // Open sign-in modal with redirect URL
    clerk.openSignIn({
      redirectUrl: `/chat/${chatbot.id}`,
    });
    onClose(); // Close chatbot detail modal
  }
}
```

### 7.6 Sign-In Page

**Status**: **NOT NEEDED** - Using modal sign-in instead

**Rationale**: Since we're using Clerk's modal sign-in (`openSignIn()`), we don't need a dedicated sign-in page. The modal will handle authentication and redirect automatically.

## 8. Work Plan

### Task 1: Skip Middleware Protection (for modal compatibility)
- **Subtask 1.1** — Keep `middleware.ts` as-is (no changes needed)  
  **Visible output**: `middleware.ts` remains unchanged, allowing modal sign-in

### Task 2: Chat Page (no changes needed)
- **Subtask 2.1** — No changes to `app/chat/[chatbotId]/page.tsx`  
  **Visible output**: Page continues to render, allowing client component to handle auth

### Task 3: Require Authentication in Chat API & Cleanup
- **Subtask 3.1** — Update `app/api/chat/route.ts` to require auth (lines ~52-63)  
  **Visible output**: API returns 401 for unauthenticated requests
- **Subtask 3.2** — Remove anonymous user fallbacks: `dbUserId || undefined` (lines ~216, 275, 527)  
  **Visible output**: All userId fields use `dbUserId` directly (no fallbacks)
- **Subtask 3.3** — Simplify rate limit logic: remove anonymous branch (lines ~149-173)  
  **Visible output**: Rate limit check always uses `dbUserId` (no null checks)
- **Subtask 3.4** — Update conversation access check: remove anonymous access comments (lines ~243-253)  
  **Visible output**: Comments updated, access check simplified
- **Subtask 3.5** — Keep conversation upgrade logic unchanged (lines ~255-266)  
  **Visible output**: Legacy anonymous conversations can still be upgraded to authenticated users

### Task 4: Update Chat Component Auth Handling
- **Subtask 4.1** — Add auth check and modal trigger in `components/chat.tsx`  
  **Visible output**: Chat component opens sign-in modal when unauthenticated, shows loading/auth prompt

### Task 5: Fix Chatbot Detail Modal Sign-In
- **Subtask 5.1** — Update sign-in to use `clerk.openSignIn()` in `components/chatbot-detail-modal.tsx`  
  **Visible output**: Modal opens sign-in popup with redirect URL instead of router.push

### Task 6: Sign-In Page
- **Subtask 6.1** — **SKIP** - Not needed, using modal sign-in  
  **Visible output**: No sign-in page created

## 9. Architectural Discipline

**File Health Check**:
- `middleware.ts`: ~17 lines (no changes, within limit)
- `app/chat/[chatbotId]/page.tsx`: ~45 lines (no changes, within limit)
- `app/api/chat/route.ts`: ~766 lines (exceeds limit, but net change is ~-15 lines due to cleanup, not refactoring)
- `components/chat.tsx`: ~1284 lines (exceeds limit, but only adding ~25 lines for auth check)
- `components/chatbot-detail-modal.tsx`: ~547 lines (within limit for this change)

**No new files needed** - Using existing modal sign-in

**Dependencies**: None (using existing Clerk setup)

## 10. Risks & Edge Cases

1. **Modal not opening**: If Clerk's `openSignIn()` fails or doesn't trigger
   - **Mitigation**: Fallback to showing SignInButton component, or check Clerk initialization

2. **Lost conversation context**: Clearing localStorage on auth check might lose user's conversation
   - **Mitigation**: Only clear if not authenticated; authenticated users keep their conversations

3. **Race condition**: User signs in while on chat page, component might not update immediately
   - **Mitigation**: Use Clerk's `isLoaded` flag to wait for auth state

4. **API calls before redirect**: Client might send API request before redirect completes
   - **Mitigation**: API will return 401, client should handle gracefully

5. **Existing anonymous conversations**: Users with existing anonymous conversations from before auth requirement
   - **Mitigation**: Conversation upgrade logic (lines 255-266) automatically assigns ownership when authenticated user accesses them

## 11. Tests

### Test 1: Unauthenticated User Access
- **Input**: Navigate to `/chat/chatbot_123` without signing in
- **Expected**: Sign-in modal opens automatically, page shows auth prompt

### Test 2: Authenticated User Access
- **Input**: Navigate to `/chat/chatbot_123` while signed in
- **Expected**: Chat page loads normally, no modal

### Test 3: Unauthenticated API Request
- **Input**: POST to `/api/chat` without auth token
- **Expected**: Returns 401 with error message

### Test 4: Authenticated API Request
- **Input**: POST to `/api/chat` with valid auth token
- **Expected**: Request processes normally

### Test 5: Sign-In Modal Flow
- **Input**: User signs in via modal after accessing chat page
- **Expected**: After sign-in, page reloads/redirects to chat page, chat component renders

### Test 6: Chatbot Detail Modal Sign-In
- **Input**: Click "Start Chat" on chatbot requiring auth while not signed in
- **Expected**: Sign-in modal opens with redirect URL to chat page

## 12. Approval Prompt

**Approve the plan to proceed to BUILD? (Yes / Answer questions / Edit)**

---

## 13. Implementation Summary

**Status**: ✅ **COMPLETED**

### Changes Implemented

#### Task 1: Skip Middleware Protection
- ✅ No changes needed - middleware.ts remains unchanged, allowing modal sign-in

#### Task 2: Chat Page
- ✅ No changes needed - page continues to render, allowing client component to handle auth

#### Task 3: Require Authentication in Chat API & Cleanup
- ✅ **Lines 52-63**: Replaced optional auth with required auth check - returns 401 if not authenticated
- ✅ **Line 216**: Removed `|| undefined` fallback in conversation creation - uses `dbUserId` directly
- ✅ **Line 275**: Removed `|| undefined` fallback in user message creation - uses `dbUserId` directly
- ✅ **Line 527**: Removed `|| undefined` fallback in assistant message creation - uses `dbUserId` directly
- ✅ **Lines 149-173**: Simplified rate limit logic - removed anonymous user branch, always uses `dbUserId`
- ✅ **Lines 243-253**: Updated conversation access check - removed anonymous access comments, simplified logic
- ✅ **Lines 132-157**: Removed conditional check for user context fetch - `dbUserId` always present now
- ✅ **Lines 255-266**: Kept conversation upgrade logic unchanged - legacy anonymous conversations can still be upgraded

#### Task 4: Update Chat Component Auth Handling
- ✅ Added `useClerk` import from '@clerk/nextjs'
- ✅ Added `isLoaded` from `useAuth()` hook
- ✅ Added `useEffect` hook to check auth and open modal if not signed in
- ✅ Added loading state UI while checking auth (`!isLoaded`)
- ✅ Added auth prompt UI if not signed in (modal should be open)
- ✅ Clears localStorage conversationId if not authenticated

#### Task 5: Fix Chatbot Detail Modal Sign-In
- ✅ Added `useClerk` import from '@clerk/nextjs'
- ✅ Updated `handleStartChat` function to use `clerk.openSignIn()` with redirectUrl instead of `router.push('/sign-in')`
- ✅ Modal closes after opening sign-in modal

### Testing Notes

All acceptance criteria have been implemented:
- ✅ Unauthenticated users cannot access `/chat/[chatbotId]` pages (blocked by client-side check)
- ✅ Unauthenticated users cannot send messages via `/api/chat` endpoint (returns 401)
- ✅ Sign-in modal opens automatically when unauthenticated users attempt to access chat
- ✅ After signing in via modal, users are redirected back to the chat page they were trying to access
- ✅ Existing authenticated users can continue using chat without interruption
- ✅ Chat component shows appropriate loading/auth prompt during authentication check

### Files Modified

1. `app/api/chat/route.ts` - Required authentication, removed anonymous user support
2. `components/chat.tsx` - Added auth check and modal trigger
3. `components/chatbot-detail-modal.tsx` - Updated sign-in to use modal instead of router.push

### No Linter Errors

All files pass linting checks.

