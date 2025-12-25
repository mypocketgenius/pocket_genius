# Side Menu Button with Account & Chat/Favorites List

## Objective
Add a side menu button in the top right of the header that opens a right-side sidebar menu (via button click or swipe gesture). The sidebar displays account information, theme settings, a toggle between "Your Chats" and "Your Favorites", and a list of items based on the selected toggle state. The theme settings button is moved from the chat title button into the sidebar.

## Acceptance Criteria
- [ ] Side menu button appears in top right of header (alongside UserButton) on all screens including chat (on the chat page it is to the right of the rating stars)
- [ ] Clicking button OR swiping in from the right opens sidebar from right side, taking up most of screen width
- [ ] Sidebar displays:
  - [ ] Account name (from Clerk)
  - [ ] Account email (from Clerk)
  - [ ] "Manage account" link (opens Clerk account management)
  - [ ] Theme settings button (opens ThemeSettings modal) - moved from chat title button
  - [ ] Toggle between "Your Chats" and "Your Favorites"
  - [ ] List of items (chats or favorites) with:
    - [ ] Chat/Chatbot name
    - [ ] Chat Type displayed as a pill/badge
    - [ ] Creator name ("by Creator")
  - [ ] Sign out button
- [ ] Toggle switches between:
  - [ ] "Your Chats": Shows all user conversations, sorted by most recent
  - [ ] "Your Favorites": Shows favorited chatbots, sorted by most recent favorite date
- [ ] List items resemble search dropdown styling
- [ ] Skeleton loader shown while data is loading (like search dropdown)
- [ ] Clicking a list item navigates to the appropriate page (chat or chatbot detail)

## Clarifying Questions
1. **Button placement**: Should the side menu button replace the existing `UserButton` from Clerk, or appear alongside it? ALONGSIDE. We will replace it later.
2. **Sidebar width**: What percentage/width should "most of the screen" be? (e.g., 80%, 90%, fixed px like 600px?) Try 100% up to a certain pixel limit.
3. **Chat display**: For "Your Chats", should we show:
   - The chatbot title as the chat name? Chatbot title.
   - Or a conversation title if one exists? 
   - Or the first message preview?
4. **Chat type pill**: Should this show the chatbot type (CREATOR, FRAMEWORK, etc.) or something else? Chatbot type.
5. **Navigation**: When clicking a chat item, should it navigate to `/chat/[chatbotId]`? YES. When clicking a favorite, should it navigate to the chatbot detail page or start a chat? CHATBOT DETAIL.
6. **API endpoint**: Do we need to create a new API endpoint `/api/conversations` to fetch all user conversations, or does one exist? I DONT KNOW.
7. **Empty states**: What should display when there are no chats or no favorites? MESSAGE: FIND CHATS ON THE HOMESCREEN
8. **Mobile behavior**: Should the sidebar be full-width on mobile, or still partial width?  full width

## Assumptions Gate
**Proceeding with confirmed answers:**
- Side menu button appears **alongside** UserButton (will replace later)
- Sidebar width: 100% up to a certain pixel limit (e.g., max-width: 600px or 80% desktop, 100% mobile)
- Chat display: Show chatbot title as chat name
- Chat type pill: Show chatbot type (CREATOR, FRAMEWORK, DEEP_DIVE, ADVISOR_BOARD)
- Navigation: Chat items → `/chat/[chatbotId]`, Favorite items → chatbot detail modal
- **Need to create `/api/conversations` endpoint** (does not exist - only `/api/conversations/[conversationId]/messages` exists)
- Empty states: Show message "FIND CHATS ON THE HOMESCREEN"
- Mobile: Full-width sidebar
- Chat page: Menu button appears to the right of rating stars in chat header (Chat component has its own header, not AppHeader)

**Proceed with assumptions? (Yes / Edit / Answer questions)**

## Minimal Approach
1. Create new API endpoint `/api/conversations` to fetch user's conversations with chatbot info
2. Create `SideMenu` component with:
   - Account section (name, email, manage account link)
   - Theme settings button (opens ThemeSettings modal)
   - Toggle component for Chats/Favorites
   - List component (reuse search dropdown patterns)
   - Sign out button
   - Swipe gesture support (swipe from right edge to open)
3. Add side menu button to `app-header.tsx` (alongside UserButton)
4. Add side menu button to Chat component header (to the right of rating stars)
5. Remove Settings button from Chat component title button
6. Implement state management for sidebar open/close
7. Add skeleton loading states

## Text Diagram

```
┌─────────────────────────────────────────────────────────┐
│ [PG Logo]  [Search Bar]              [☰ Menu Button] │ ← Header
└─────────────────────────────────────────────────────────┘
                                                           │
                                    ┌──────────────────────┤
                                    │ Account Name         │
                                    │ user@example.com     │
                                    │ [Manage Account]     │
                                    │ [Theme Settings]     │ ← Theme button
                                    ├──────────────────────┤
                                    │ [Your Chats] [Favs] │ ← Toggle
                                    ├──────────────────────┤
                                    │ ┌──────────────────┐ │
                                    │ │ Chat Name        │ │
                                    │ │ CREATOR          │ │ ← Pill
                                    │ │ by Creator Name  │ │
                                    │ └──────────────────┘ │
                                    │ ┌──────────────────┐ │
                                    │ │ ...more items... │ │
                                    │ └──────────────────┘ │
                                    ├──────────────────────┤
                                    │ [Sign Out]          │
                                    └──────────────────────┘
                                    ↑
                                    Opens via button click OR swipe from right edge
```

## Plan File Contents

### 1. API Endpoint: `/api/conversations`

**File**: `app/api/conversations/route.ts`

**Purpose**: Fetch all conversations for the authenticated user, including chatbot details.

**Response Format**:
```typescript
{
  conversations: Array<{
    id: string;
    chatbotId: string;
    chatbot: {
      id: string;
      title: string;
      type: ChatbotType | null;
      creator: {
        id: string;
        name: string;
        slug: string;
      };
    };
    updatedAt: string; // For sorting by recent
    createdAt: string;
    messageCount: number;
  }>;
}
```

**Implementation**:
- Authenticate user via Clerk
- Query `Conversation` table filtered by `userId`
- Include `chatbot` relation with `creator` relation
- Order by `updatedAt DESC` (most recent first)
- Return chatbot title, type, and creator info

### 2. Side Menu Component

**File**: `components/side-menu.tsx`

**Props**:
```typescript
interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**Swipe Gesture Implementation**:
- Add touch event listeners to document or window
- Track touch start position: `touchStartX`, `touchStartY`
- On touch start: Check if touch started within 20px of right edge
- **On touch move**: 
  - Calculate horizontal distance (`touchMoveX - touchStartX`)
  - **Update sidebar position in real-time** using `transform: translateX()` to follow finger
  - If sidebar is open and user swipes from right edge, move sidebar to follow finger (closing direction)
- **On touch end**: 
  - If sidebar is closed: If horizontal distance > 50px and direction is left (negative), open sidebar
  - If sidebar is open: If user swiped from right edge and distance > threshold, close sidebar
  - Snap to fully open or fully closed position based on final swipe distance
- Only trigger if vertical movement is minimal (to avoid conflicts with scrolling)
- Clean up event listeners when component unmounts

**Features**:
- Right-side slide-in animation
- Backdrop overlay (click to close)
- Swipe-in gesture support (swipe from right edge to open)
- Account section at top
- Theme settings button (opens ThemeSettings modal)
- Toggle between Chats/Favorites
- List component with skeleton loading
- Empty state message: "FIND CHATS ON THE HOMESCREEN"
- Sign out button

**State Management**:
- `activeTab: 'chats' | 'favorites'`
- `chats: Conversation[]`
- `favorites: Chatbot[]`
- `isLoadingChats: boolean`
- `isLoadingFavorites: boolean`
- `themeSettingsOpen: boolean` (for ThemeSettings modal)

### 3. Side Menu List Item Component

**File**: `components/side-menu-item.tsx`

**Purpose**: Reuse styling from `SearchResultItem` but adapted for sidebar.

**Props**:
```typescript
interface SideMenuItemProps {
  title: string;
  type: ChatbotType | null;
  creatorName: string;
  onClick: () => void;
}
```

**Styling**: Similar to `SearchResultItem` but adapted for sidebar width.

### 4. Update App Header

**File**: `components/app-header.tsx`

**Changes**:
- Add side menu button alongside UserButton (don't replace)
- Import `SideMenu` component
- Add state for sidebar open/close
- Button icon: Menu/Hamburger icon from lucide-react

### 4b. Update Chat Component Header

**File**: `components/chat.tsx`

**Changes**:
- Add side menu button to chat header (to the right of StarRating component)
- Import `SideMenu` component
- Add state for sidebar open/close (can be shared via context or separate state)
- Button icon: Menu/Hamburger icon from lucide-react
- **Remove Settings button from chat title button** (lines 738-757)
- **Remove `handleSettings` function** (line 444)
- **Remove `themeSettingsOpen` state** (line 56)
- **Remove `ThemeSettings` modal** from Chat component (lines 1222-1225)
- **Remove `ThemeSettings` import** (line 10) - no longer needed in Chat component

### 5. Skeleton Loader

**File**: Reuse existing `Skeleton` component from `components/ui/skeleton.tsx`

**Pattern**: Match the skeleton pattern from `SearchDropdown` component (3 skeleton items while loading).

## Work Plan

### Task 1: Create Conversations API Endpoint
**Subtask 1.1** — Create `app/api/conversations/route.ts`
  - Visible output: File created with GET handler
  - Authenticate user via Clerk
  - Query conversations with chatbot and creator relations
  - Order by `updatedAt DESC`
  - Return formatted response

**Subtask 1.2** — Add error handling and validation
  - Visible output: 401 for unauthenticated, 500 for errors

**Subtask 1.3** — Test endpoint
  - Visible output: API returns conversations array

**Task 1 Status: ✅ COMPLETE**
- Created `app/api/conversations/route.ts` with GET handler
- Implemented Clerk authentication (401 for unauthenticated, 404 for user not found)
- Queries conversations filtered by userId with chatbot and creator relations
- Orders by `updatedAt DESC` (most recent first)
- Returns formatted response matching plan specification
- Added comprehensive error handling (500 for database errors, dev vs prod messages)
- Created test suite (`__tests__/api/conversations/route.test.ts`) with 9 passing tests:
  - Authentication tests (401, 404)
  - Happy path tests (ordered results, empty state, null handling)
  - Error handling tests (500 errors, dev messages, non-Error exceptions)
- All tests passing ✅

### Task 2: Create Side Menu Component
**Subtask 2.1** — Create `components/side-menu.tsx`
  - Visible output: Component file created
  - Add sidebar structure with account section
  - Add toggle component
  - Add list container
  - Add sign out button

**Subtask 2.2** — Implement slide-in animation, backdrop, and swipe gesture
  - Visible output: Sidebar animates from right, backdrop appears
  - Add touch event handlers for swipe-in gesture (swipe from right edge)
  - Detect swipe start position (must start near right edge, e.g., within 20px)
  - Track swipe distance and direction (left swipe from right edge)
  - **Sidebar follows finger during swipe**: Update sidebar position in real-time during `touchmove` event
  - **Swipe behavior when sidebar is open**: If sidebar is already open, swipe from right edge closes it
  - Open sidebar when swipe threshold is met (e.g., 50px swipe distance) OR when swipe completes past threshold
  - Close sidebar if user swipes back past threshold while closing
  - Use `touchstart`, `touchmove`, `touchend` events
  - Prevent default scrolling when swipe gesture is detected
  - Only trigger on horizontal swipes (not vertical scrolling)
  - Use CSS `transform: translateX()` to animate sidebar position during swipe

**Subtask 2.3** — Integrate Clerk user data and theme button
  - Visible output: Account name and email display
  - **Add "Manage account" using Clerk's `UserButton` component directly**
    - Use `<UserButton />` from `@clerk/nextjs` in the account section
    - Configure `UserButton` to show account management options
    - Alternatively, use `UserButton.MenuItems` with `UserButton.Link` for custom styling
  - Add Theme settings button (opens ThemeSettings modal)
  - Import ThemeSettings component
  - Add state for themeSettingsOpen

**Subtask 2.4** — Add toggle state management
  - Visible output: Toggle switches between Chats/Favorites

### Task 3: Create Side Menu List Components
**Subtask 3.1** — Create `components/side-menu-item.tsx`
  - Visible output: List item component created
  - Reuse styling patterns from `SearchResultItem`
  - Display title, type pill, creator name

**Subtask 3.2** — Create skeleton loader for list
  - Visible output: Skeleton items match search dropdown pattern

**Subtask 3.3** — Implement data fetching
  - Visible output: Fetches conversations and favorites on toggle
  - Shows skeleton while loading

### Task 4: Integrate Side Menu into Header
**Subtask 4.1** — Update `components/app-header.tsx`
  - Visible output: Menu button added to header alongside UserButton
  - Import `SideMenu` component
  - Add state for sidebar open/close

**Subtask 4.2** — Add menu button to Chat component header and remove theme button
  - Visible output: Menu button appears to the right of rating stars in chat page header
  - Chat component has its own header structure (not using AppHeader)
  - Place button after StarRating component
  - Remove Settings button from chat title button (lines 738-757 in chat.tsx)
  - Remove handleSettings function and themeSettingsOpen state from Chat component
  - Remove ThemeSettings modal from Chat component (moved to sidebar)

**Subtask 4.3** — Add navigation handlers
  - Visible output: Clicking items navigates to correct pages
  - Chat items → `/chat/[chatbotId]`
  - **Favorite items → chatbot detail modal**
    - Use chatbot data directly from `/api/favorites` API response
    - The favorites endpoint returns full chatbot data with all needed fields (title, description, type, creator, etc.)
    - Pass chatbot data to `ChatbotDetailModal` component (reuse existing modal component)
    - No additional API call needed - use data already fetched

**Subtask 4.4** — Handle empty states
  - Visible output: "FIND CHATS ON THE HOMESCREEN" message when no chats/favorites

### Task 5: Styling and Polish
**Subtask 5.1** — Responsive design
  - Visible output: Sidebar full-width on mobile, 100% up to max-width (e.g., 600px) on desktop

**Subtask 5.2** — Match search dropdown styling
  - Visible output: List items have consistent styling

**Subtask 5.3** — Add keyboard support (ESC to close)
  - Visible output: ESC key closes sidebar

**Subtask 5.4** — Ensure menu button visibility on all pages
  - Visible output: Menu button appears in AppHeader (homepage, etc.) and Chat component header (chat page)

## Architectural Discipline

### File Structure
- `components/side-menu.tsx` — Main sidebar component (target: ≤150 lines)
- `components/side-menu-item.tsx` — List item component (target: ≤60 lines)
- `app/api/conversations/route.ts` — API endpoint (target: ≤100 lines)

### Code Reuse
- **Reuse**: `SearchResultItem` styling patterns for list items
- **Reuse**: `SearchDropdown` skeleton loading pattern
- **Reuse**: `Skeleton` component from UI library
- **Reuse**: Clerk hooks (`useAuth`, `useUser`) for account data
- **Reuse**: Clerk's `UserButton` component for account management
- **Reuse**: `ThemeSettings` component (import from `components/theme-settings.tsx`)
- **Reuse**: Theme context (`useTheme`) for theme state
- **Reuse**: `ChatbotDetailModal` component for favorites navigation (use chatbot data from favorites API)

### Dependencies
- **No new dependencies**: Use existing Clerk, lucide-react, Tailwind CSS

## Risks & Edge Cases

1. **No conversations**: User has no chats → Show empty state
2. **No favorites**: User has no favorites → Show empty state
3. **Unauthenticated access**: Side menu should only show when signed in
4. **Large lists**: Consider pagination if needed (start with all items, add pagination later if needed)
5. **Mobile responsiveness**: Ensure sidebar doesn't break on small screens
6. **Z-index conflicts**: Ensure sidebar appears above other content (z-50+)
7. **Clerk account management**: Need to verify how to open Clerk's account management modal
8. **Swipe gesture conflicts**: Ensure swipe gesture doesn't interfere with scrolling or other touch interactions
9. **Swipe detection**: Only trigger on swipes starting from right edge (e.g., within 20px) to avoid accidental opens
10. **Swipe following finger**: Sidebar must smoothly follow finger during swipe gesture (use transform translateX)
11. **Swipe when sidebar open**: Swipe from right edge when sidebar is open should close it (reverse direction)
12. **Theme modal z-index**: Ensure ThemeSettings modal appears above sidebar (higher z-index)
13. **Chat component cleanup**: Remove theme-related code from Chat component after moving to sidebar
14. **Favorites data**: Use chatbot data directly from favorites API response (no additional API call needed)

## Tests

### Test 1: API Endpoint
**Input**: GET `/api/conversations` (authenticated user)
**Expected Output**: 
- Status 200
- JSON with `conversations` array
- Each conversation includes chatbot title, type, creator name
- Ordered by `updatedAt DESC`

### Test 2: Side Menu Opens
**Input**: Click menu button in header
**Expected Output**: Sidebar slides in from right, backdrop appears

### Test 3: Toggle Functionality
**Input**: Click "Your Favorites" toggle
**Expected Output**: 
- List switches to favorites
- Fetches favorites from `/api/favorites`
- Shows skeleton while loading
- Displays favorite chatbots

### Test 4: Navigation
**Input**: Click a chat item
**Expected Output**: Navigates to `/chat/[chatbotId]`

### Test 5: Sign Out
**Input**: Click "Sign Out" button
**Expected Output**: User is signed out (via Clerk)

### Test 6: Empty States
**Input**: User with no conversations
**Expected Output**: Shows "FIND CHATS ON THE HOMESCREEN" message

### Test 7: Chat Page Integration
**Input**: Navigate to `/chat/[chatbotId]`
**Expected Output**: Menu button appears to the right of rating stars in chat header

### Test 8: Swipe Gesture - Open Sidebar
**Input**: Swipe from right edge of screen (within 20px of edge) when sidebar is closed
**Expected Output**: 
- Sidebar follows finger during swipe (position updates in real-time)
- Sidebar opens when swipe distance exceeds threshold (~50px)
- Sidebar snaps to fully open position on touch end

### Test 9: Swipe Gesture - Close Sidebar
**Input**: Swipe from right edge of screen when sidebar is already open
**Expected Output**: 
- Sidebar follows finger in closing direction (moves right)
- Sidebar closes when swipe distance exceeds threshold
- Sidebar snaps to fully closed position on touch end

### Test 10: Theme Button in Sidebar
**Input**: Click theme settings button in sidebar
**Expected Output**: ThemeSettings modal opens

### Test 11: Theme Button Removed from Chat Header
**Input**: View chat page header
**Expected Output**: Settings button no longer appears in chat title button

### Test 12: Favorites Navigation
**Input**: Click a favorite item in sidebar
**Expected Output**: 
- ChatbotDetailModal opens with chatbot data from favorites API response
- No additional API call is made (uses data already fetched)
- Modal displays correct chatbot information

## Approval Prompt

**Approve the plan to proceed to BUILD? (Yes / Answer questions / Edit)**

