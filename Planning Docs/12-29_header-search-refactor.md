# Header Search Refactor - December 29, 2024

## Summary

Refactored the search functionality to be available in the header across all pages, with mobile-responsive expandable search and consistent behavior throughout the application.

## Objectives Achieved

### 1. Mobile-Responsive Header Branding
- ✅ Changed "Pocket Genius" to "PG" on mobile devices
- ✅ Kept full "Pocket Genius" text on desktop (md breakpoint and above)
- ✅ Applied consistently across all pages

### 2. Search Functionality Migration
- ✅ Moved search from homepage hero section to header
- ✅ Made search available on all pages (homepage, chat, dashboard)
- ✅ Implemented expandable search on mobile (icon expands to show search bar)
- ✅ Desktop search always visible in header

### 3. Code Refactoring & Architecture
- ✅ Created reusable `SearchBar` component (`components/search-bar.tsx`)
- ✅ Refactored `AppHeader` component to use `SearchBar`
- ✅ Refactored `Chat` component to use `SearchBar`
- ✅ Refactored `Dashboard` component to use `SearchBar`
- ✅ Eliminated ~240 lines of duplicate code
- ✅ Consistent debouncing (300ms) across all search implementations

## Technical Implementation

### Components Created

#### `components/search-bar.tsx`
- Reusable search bar component with debouncing
- Supports two variants:
  - `header`: For AppHeader (expands below header on mobile)
  - `inline`: For Chat/Dashboard (expands in header row on mobile)
- Features:
  - Debounced search (300ms delay)
  - Mobile expandable behavior
  - Navigation support (optional)
  - Callback support for custom handling
  - Theme-aware styling support
  - Custom placeholder and styling props

#### `components/app-header.tsx` (Refactored)
- Simplified from ~190 lines to ~87 lines
- Uses `SearchBar` component
- Maintains all original functionality
- Supports custom left/right content
- Configurable auth buttons

### Components Refactored

#### `app/page.tsx` (Homepage)
- Removed search bar from hero section
- Integrated `AppHeader` with search
- Uses `navigateOnSearch={false}` with `onSearchChange` callback
- Search updates homepage state without navigation

#### `components/chat.tsx`
- Removed duplicate search implementation (~80 lines)
- Integrated `SearchBar` with `variant="inline"`
- Theme-aware styling preserved
- Uses `navigateOnSearch={true}` (redirects to homepage on search)

#### `components/dashboard-content.tsx`
- Removed duplicate search implementation (~60 lines)
- Integrated `SearchBar` with `variant="inline"`
- Uses `navigateOnSearch={true}` (redirects to homepage on search)

## Search Behavior

### Current Implementation

**Homepage:**
- Search updates page state (no navigation)
- Filters chatbots in real-time
- Debounced for performance

**Chat Page:**
- Search redirects to homepage with search query
- User can search for chatbots while in a conversation

**Dashboard Page:**
- Search redirects to homepage with search query
- User can search for chatbots from dashboard

### Mobile UX

**Desktop (md and above):**
- Search bar always visible in header
- Full-width search input in center of header

**Mobile (below md breakpoint):**
- Search icon button visible in header
- Clicking icon expands search bar below header
- Expanded search has close button
- Auto-focuses input when expanded

## Code Quality Improvements

### Before Refactoring
- Search logic duplicated in 3 components
- Inconsistent debouncing (homepage had it, chat/dashboard didn't)
- ~240 lines of duplicate code
- Different implementations for same functionality

### After Refactoring
- Single source of truth (`SearchBar` component)
- Consistent debouncing everywhere (300ms)
- ~240 lines of code eliminated
- Easier to maintain and extend
- Better performance (debouncing prevents excessive navigation)

## Files Modified

### Created
- `components/search-bar.tsx` - New reusable component

### Modified
- `components/app-header.tsx` - Refactored to use SearchBar
- `app/page.tsx` - Integrated header search, removed hero search
- `components/chat.tsx` - Refactored to use SearchBar
- `components/dashboard-content.tsx` - Refactored to use SearchBar
- `jest.config.js` - Updated test configuration (temporarily, then reverted)

### Fixed Issues
- ✅ Fixed `useSearchParams()` Suspense boundary requirement
- ✅ Fixed useEffect dependency warnings
- ✅ Prevented double navigation on homepage
- ✅ Ensured auth buttons remain visible on mobile

## Responsive Design

### Breakpoints
- **Mobile**: `< md` (below 768px)
  - "PG" branding
  - Expandable search icon
  - Search expands below header when clicked

- **Desktop**: `>= md` (768px and above)
  - "Pocket Genius" branding
  - Always-visible search bar
  - Search in center of header

## Testing

Created comprehensive test suite (later removed per user request):
- 20 test cases covering all functionality
- Rendering tests for both variants
- Debouncing behavior verification
- Navigation behavior tests
- Mobile expansion/collapse tests
- Callback integration tests
- Accessibility checks

All tests passed successfully before removal.

## Future Considerations

### Potential Enhancements
1. **Search Dropdown**: Add dropdown with search results instead of redirecting
2. **Inline Results**: Show results on current page without navigation
3. **Search History**: Remember recent searches
4. **Keyboard Shortcuts**: Add keyboard shortcuts for search (e.g., Cmd/Ctrl+K)
5. **Search Suggestions**: Show autocomplete suggestions as user types

### Current Behavior Notes
- Search from Chat/Dashboard redirects to homepage
- No dropdown or inline results currently
- All search functionality routes through homepage

## Metrics

- **Lines of Code Reduced**: ~240 lines eliminated
- **Components Refactored**: 3 major components
- **New Components Created**: 1 reusable component
- **Code Duplication**: Eliminated
- **Consistency**: 100% (all pages use same search component)
- **Performance**: Improved (debouncing everywhere)

## Conclusion

Successfully refactored search functionality to be consistent, maintainable, and mobile-responsive across all pages. The implementation follows React best practices with proper component composition, debouncing, and responsive design patterns.

---

## Future Enhancement: Dropdown Search Implementation

### Overview

Instead of navigating away from the current page when searching, implement a dropdown that shows search results inline. Users can click on a chatbot from the dropdown to navigate to it, without leaving their current page context.

### Current Behavior vs. Desired Behavior

**Current:**
- Homepage: Search updates page state (no navigation)
- Chat/Dashboard: Search redirects to homepage with query
- No dropdown or inline results

**Desired:**
- All pages: Search shows dropdown with matching chatbots
- Clicking a chatbot in dropdown navigates to `/chat/${chatbotId}`
- Dropdown closes on selection or outside click
- Keyboard navigation support (arrow keys, Enter, Escape)
- No navigation away from current page unless user clicks a result

### Components That Need Modification

#### 1. `components/search-bar.tsx` (Major Refactor)

**Current Responsibilities:**
- Debounced search input
- Mobile expandable behavior
- Navigation via `navigateOnSearch` prop
- Callback via `onSearchChange` prop

**New Responsibilities:**
- Fetch chatbots from API as user types (debounced)
- Display dropdown with search results
- Handle keyboard navigation
- Manage dropdown open/close state
- Handle click outside to close
- Navigate to chatbot on selection

**Key Changes:**
- Remove `navigateOnSearch` prop (no longer needed)
- Add `showDropdown` prop (default: true) to control dropdown visibility
- Add state for search results (`searchResults`, `isLoadingResults`, `isDropdownOpen`)
- Add API call to `/api/chatbots/public?search=${query}&pageSize=10` (limit to 10 results)
- Add dropdown UI component below search input
- Add keyboard event handlers (ArrowUp, ArrowDown, Enter, Escape)
- Add click-outside detection using `useEffect` + refs or `onClickOutside` hook

**Complete Updated Props Interface:**
```typescript
interface SearchBarProps {
  // Initial search query value
  initialValue?: string;
  // Custom placeholder text
  placeholder?: string;
  // Custom styling for the input (for theme-aware components)
  inputStyle?: React.CSSProperties;
  // Custom className for the input
  inputClassName?: string;
  // Variant: 'header' (for AppHeader) or 'inline' (for Chat/Dashboard)
  variant?: 'header' | 'inline';
  // NEW: Show dropdown results (default: true)
  showDropdown?: boolean;
  // NEW: Max results in dropdown (default: 10)
  maxResults?: number;
  // NEW: Optional callback when chatbot selected
  onChatbotSelect?: (chatbotId: string) => void;
  // DEPRECATED: Will be removed - no longer used
  // onSearchChange?: (query: string) => void;
  // DEPRECATED: Will be removed - no longer used
  // navigateOnSearch?: boolean;
}
```

**Type Definitions (to be shared/imported):**
```typescript
// These types match the API response format from /api/chatbots/public
type ChatbotType = 'CREATOR' | 'FRAMEWORK' | 'DEEP_DIVE' | 'ADVISOR_BOARD';
type CategoryType = 'ROLE' | 'CHALLENGE' | 'STAGE';

interface Chatbot {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  type: ChatbotType | null;
  priceCents: number;
  currency: string;
  allowAnonymous: boolean;
  creator: {
    id: string;
    slug: string;
    name: string;
    avatarUrl: string | null;
  };
  rating: {
    averageRating: number | null;
    ratingCount: number;
  } | null;
  categories: Array<{
    id: string;
    type: CategoryType;
    label: string;
    slug: string;
  }>;
  favoriteCount: number;
}
```

#### 2. `components/app-header.tsx` (Minor Update)

**Changes:**
- Remove `navigateOnSearch` prop (no longer needed)
- Remove `onSearchChange` prop (no longer needed for homepage)
- SearchBar handles its own dropdown and navigation

#### 3. `app/page.tsx` (Homepage) (Minor Update)

**Changes:**
- Remove `handleSearchChange` callback
- Remove `navigateOnSearch={false}` prop
- SearchBar dropdown will work independently
- Homepage search filtering can remain for the main grid (optional - could be removed if dropdown is primary search)

**Decision Point:** Should homepage still filter the grid when searching, or rely entirely on dropdown? Likely keep both - dropdown for quick navigation, grid filtering for browsing.

#### 4. `components/chat.tsx` (Minor Update)

**Changes:**
- Remove `navigateOnSearch={true}` prop
- SearchBar handles its own dropdown and navigation

#### 5. `components/dashboard-content.tsx` (Minor Update)

**Changes:**
- Remove `navigateOnSearch={true}` prop
- SearchBar handles its own dropdown and navigation

### New Components Needed

#### 1. `components/search-dropdown.tsx` (New Component)

**Purpose:** Reusable dropdown component for search results

**Props:**
```typescript
interface SearchDropdownProps {
  results: Chatbot[]; // Array of chatbot results
  isLoading: boolean; // Loading state
  isOpen: boolean; // Whether dropdown is visible
  selectedIndex: number; // Currently selected index (for keyboard nav, -1 if none)
  onSelect: (chatbotId: string) => void; // Callback when chatbot selected
  onClose: () => void; // Callback to close dropdown (for "See all results" link)
  query: string; // Current search query (for "No results" messaging)
  maxResults: number; // Max results limit (to show "See all results" link)
  dropdownRef?: React.RefObject<HTMLDivElement>; // Ref for click-outside detection
}
```

**Component Structure:**
```typescript
export function SearchDropdown({
  results,
  isLoading,
  isOpen,
  selectedIndex,
  onSelect,
  onClose,
  query,
  maxResults,
  dropdownRef,
}: SearchDropdownProps) {
  if (!isOpen) return null;

  const handleSeeAll = () => {
    onClose();
    // Navigation handled by parent or via router.push(`/?search=${query}`)
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 right-0 md:left-auto md:right-auto mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto py-1"
    >
      {isLoading ? (
        // Loading state: skeleton items
        <div className="px-4 py-2 space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
              <div className="h-3 bg-gray-100 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        // Empty state
        <div className="px-4 py-8 text-center text-gray-500">
          <p>No chatbots found for &quot;{query}&quot;</p>
        </div>
      ) : (
        <>
          {/* Results list */}
          {results.map((chatbot, index) => (
            <SearchResultItem
              key={chatbot.id}
              chatbot={chatbot}
              isSelected={index === selectedIndex}
              onClick={() => onSelect(chatbot.id)}
            />
          ))}
          
          {/* "See all results" link */}
          {results.length === maxResults && (
            <div className="border-t border-gray-200 px-4 py-2">
              <button
                onClick={handleSeeAll}
                className="text-sm text-blue-600 hover:underline w-full text-left"
              >
                See all results for &quot;{query}&quot;
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

**Features:**
- Display list of chatbots (title, creator, type badge)
- Highlight selected item (keyboard navigation)
- Show loading state (skeleton/spinner)
- Show "No results" state
- Show "See all results" link (optional - navigates to homepage with search query)
- Handle click on result item
- Responsive styling (works on mobile and desktop)
- Max height with scroll (e.g., max-h-96)

**Styling Specifications:**
- Position: `absolute` with `top-full` and `left-0` (or `right-0` for RTL)
- Z-index: `z-50` (same as header sticky positioning)
- Width: 
  - Desktop: `w-full` (matches search input width)
  - Mobile: `w-full` (full container width)
- Max height: `max-h-96` (384px) with `overflow-y-auto`
- Background: `bg-white`
- Border: `border border-gray-200`
- Shadow: `shadow-lg`
- Border radius: `rounded-md` (matches input styling)
- Margin top: `mt-1` (small gap from input)
- Padding: `py-1` (minimal vertical padding for items)

#### 2. `components/search-result-item.tsx` (New Component - Required)

**Purpose:** Individual chatbot result item in dropdown

**Props:**
```typescript
interface SearchResultItemProps {
  chatbot: Chatbot; // Chatbot data
  isSelected: boolean; // Whether this item is keyboard-selected
  onClick: () => void; // Click handler
  index: number; // Index for data-index attribute (for scroll-into-view)
}
```

**Component Structure:**
```typescript
export function SearchResultItem({
  chatbot,
  isSelected,
  onClick,
  index,
}: SearchResultItemProps) {
  return (
    <button
      data-index={index}
      onClick={onClick}
      className={`
        w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors
        ${isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Title - truncated to 1 line */}
          <h4 className="font-medium text-sm truncate">
            {chatbot.title}
          </h4>
          {/* Creator name */}
          <p className="text-xs text-gray-500 truncate">
            by {chatbot.creator.name}
          </p>
        </div>
        {/* Chatbot type badge - only if type exists */}
        {chatbot.type && (
          <Badge variant="secondary" className="text-xs flex-shrink-0">
            {chatbot.type.replace(/_/g, ' ')}
          </Badge>
        )}
      </div>
    </button>
  );
}
```

**Styling:**
- Padding: `px-4 py-2`
- Hover: `hover:bg-gray-50`
- Selected: `bg-blue-50 border-l-2 border-blue-500`
- Title: `font-medium text-sm truncate` (single line)
- Creator: `text-xs text-gray-500 truncate` (single line)
- Badge: `text-xs flex-shrink-0` (prevents truncation)

**Note:** Keep minimal - no price/rating in dropdown for cleaner UX. User can see full details after clicking.

### API Considerations

#### Existing API Endpoint: `/api/chatbots/public`

**Current Usage:**
- Supports `search` query parameter
- Supports pagination (`page`, `pageSize`)
- Returns chatbots with full data

**For Dropdown:**
- Use same endpoint with `search` parameter
- Set `pageSize=10` (or configurable via prop)
- Debounce API calls (already handled by existing debounce hook)
- Handle loading states
- Handle empty results
- Handle errors gracefully (show error message or fail silently)

**No API Changes Needed:** Existing endpoint already supports search functionality.

### UX Considerations

#### 1. Dropdown Positioning

**Desktop:**
- Dropdown appears directly below search input
- Width matches search input width (or slightly wider)
- Max height with scroll if many results

**Mobile:**
- When search is expanded, dropdown appears below expanded search bar
- Full width of container
- Max height with scroll

#### 2. Keyboard Navigation

**Arrow Keys:**
- ArrowDown: Move selection down
- ArrowUp: Move selection up
- Wrap around at top/bottom (optional)

**Enter Key:**
- Select currently highlighted chatbot
- Navigate to `/chat/${chatbotId}`

**Escape Key:**
- Close dropdown
- Clear search (optional - might be annoying)

**Tab Key:**
- Close dropdown (standard behavior)

#### 3. Mouse/Touch Interaction

- Click on result: Navigate to chatbot
- Click outside dropdown: Close dropdown
- Hover over result: Highlight (desktop)
- Keep search input focused when dropdown is open

#### 4. Loading States

- Show loading indicator while fetching results
- Debounce prevents excessive API calls
- Show "No results" when query returns empty array
- Show error state if API call fails (optional - could fail silently)

#### 5. Empty States

- "No chatbots found" when search returns empty
- "Start typing to search" when query is empty (or don't show dropdown)
- "See all results" link to homepage with search query (optional)

### Technical Implementation Details

#### 1. State Management in SearchBar

```typescript
const [searchResults, setSearchResults] = useState<Chatbot[]>([]);
const [isLoadingResults, setIsLoadingResults] = useState(false);
const [isDropdownOpen, setIsDropdownOpen] = useState(false);
const [selectedIndex, setSelectedIndex] = useState(-1);
const dropdownRef = useRef<HTMLDivElement>(null);
const inputRef = useRef<HTMLInputElement>(null);
```

#### 2. API Fetching Logic with Request Cancellation

```typescript
useEffect(() => {
  if (!debouncedSearch || debouncedSearch.length < 2) {
    setSearchResults([]);
    setIsDropdownOpen(false);
    return;
  }

  setIsLoadingResults(true);
  setIsDropdownOpen(true);

  // Create AbortController for request cancellation
  const abortController = new AbortController();

  fetch(
    `/api/chatbots/public?search=${encodeURIComponent(debouncedSearch)}&pageSize=${maxResults || 10}`,
    { signal: abortController.signal }
  )
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      // Only update if request wasn't cancelled
      if (!abortController.signal.aborted) {
        setSearchResults(data.chatbots || []);
        setSelectedIndex(-1); // Reset selection
      }
    })
    .catch(err => {
      // Ignore abort errors (expected when new search starts)
      if (err.name !== 'AbortError') {
        console.error('Search error:', err);
      }
      // Only update if request wasn't cancelled
      if (!abortController.signal.aborted) {
        setSearchResults([]);
      }
    })
    .finally(() => {
      // Only update if request wasn't cancelled
      if (!abortController.signal.aborted) {
        setIsLoadingResults(false);
      }
    });

  // Cleanup: abort request if component unmounts or new search starts
  return () => {
    abortController.abort();
  };
}, [debouncedSearch, maxResults]);
```

#### 3. Click Outside Detection

```typescript
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node) &&
      inputRef.current &&
      !inputRef.current.contains(event.target as Node)
    ) {
      setIsDropdownOpen(false);
    }
  };

  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);
```

#### 4. Keyboard Navigation

```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (!isDropdownOpen || searchResults.length === 0) return;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < searchResults.length - 1 ? prev + 1 : 0
      );
      break;
    case 'ArrowUp':
      e.preventDefault();
      setSelectedIndex(prev => 
        prev > 0 ? prev - 1 : searchResults.length - 1
      );
      break;
    case 'Enter':
      e.preventDefault();
      if (selectedIndex >= 0) {
        handleChatbotSelect(searchResults[selectedIndex].id);
      }
      break;
    case 'Escape':
      e.preventDefault();
      setIsDropdownOpen(false);
      break;
  }
};
```

#### 5. Navigation on Selection

```typescript
const handleChatbotSelect = (chatbotId: string) => {
  // Close dropdown immediately
  setIsDropdownOpen(false);
  
  // Clear search query
  setSearchQuery('');
  
  // Reset selection index
  setSelectedIndex(-1);
  
  // Call optional callback
  if (onChatbotSelect) {
    onChatbotSelect(chatbotId);
  }
  
  // Navigate to chatbot chat page
  router.push(`/chat/${chatbotId}`);
};
```

#### 6. Input Focus Management

```typescript
// Keep input focused when dropdown is open (for keyboard navigation)
useEffect(() => {
  if (isDropdownOpen && inputRef.current) {
    inputRef.current.focus();
  }
}, [isDropdownOpen]);
```

#### 7. Scroll Selected Item into View

```typescript
// Scroll selected item into view when using keyboard navigation
useEffect(() => {
  if (selectedIndex >= 0 && dropdownRef.current) {
    const selectedElement = dropdownRef.current.querySelector(
      `[data-index="${selectedIndex}"]`
    ) as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }
}, [selectedIndex]);
```

### File Structure Changes

#### Files to Create:
1. `components/search-dropdown.tsx` - Dropdown component for search results
   - Props: `results`, `isLoading`, `isOpen`, `selectedIndex`, `onSelect`, `onClose`, `query`, `maxResults`
   - Features: Loading state, empty state, "See all results" link, keyboard navigation highlighting

#### Files to Modify:
1. `components/search-bar.tsx` - Major refactor
   - Add dropdown state management
   - Add API fetching with AbortController
   - Add keyboard navigation handlers
   - Add click-outside detection
   - Remove `navigateOnSearch` prop (deprecated)
   - Remove `onSearchChange` prop (deprecated)
   - Add `showDropdown`, `maxResults`, `onChatbotSelect` props
   - Import and render `SearchDropdown` component

2. `components/app-header.tsx` - Minor update
   - Remove `navigateOnSearch` prop
   - Remove `onSearchChange` prop
   - Remove `initialSearchQuery` prop (no longer needed)
   - SearchBar handles its own state

3. `app/page.tsx` - Minor update
   - Remove `handleSearchChange` callback function
   - Remove `onSearchChange={handleSearchChange}` prop from AppHeader
   - Remove `initialSearchQuery={searchQuery}` prop from AppHeader
   - Keep existing grid filtering logic (works independently)

4. `components/chat.tsx` - Minor update
   - Remove `navigateOnSearch={true}` prop from SearchBar
   - SearchBar handles its own dropdown and navigation

5. `components/dashboard-content.tsx` - Minor update
   - Remove `navigateOnSearch={true}` prop from SearchBar
   - SearchBar handles its own dropdown and navigation

#### Optional: Shared Types File
Consider creating `lib/types/chatbot.ts` to share Chatbot type definitions:
- Export `Chatbot`, `ChatbotType`, `CategoryType` interfaces
- Import in both `search-bar.tsx` and `app/page.tsx`
- Prevents type duplication

### Testing Considerations

#### Unit Tests:
- SearchBar component with dropdown
- Keyboard navigation (arrow keys, Enter, Escape)
- API fetching and error handling
- Click outside to close
- Mobile vs desktop behavior

#### Integration Tests:
- Search from homepage → dropdown appears → select chatbot → navigates correctly
- Search from chat page → dropdown appears → select chatbot → navigates correctly
- Search from dashboard → dropdown appears → select chatbot → navigates correctly

#### E2E Tests:
- Type search query → see dropdown → click result → navigate to chat
- Type search query → use arrow keys → press Enter → navigate to chat
- Type search query → click outside → dropdown closes
- Mobile: Expand search → type query → see dropdown → select result

### Performance Considerations

1. **Debouncing:** Already implemented (300ms) - prevents excessive API calls
2. **Result Limit:** Limit to 10 results in dropdown (configurable)
3. **Caching:** Could cache recent searches (future enhancement)
4. **Request Cancellation:** Cancel in-flight requests when new search starts (use AbortController)

### Implementation Work Plan

**Format:** Task → Subtasks → Visible Outputs

#### Task 1: Create SearchResultItem Component
**Subtask 1.1** — Create `components/search-result-item.tsx` file
  - Visible output: File created with basic component structure
  - Props interface: `Chatbot`, `isSelected`, `onClick`, `index`
  - Basic JSX: button with title, creator name, type badge
  - Styling: hover states, selected state (blue highlight)

**Subtask 1.2** — Add responsive styling and truncation
  - Visible output: Component handles long titles/names gracefully
  - Title truncates to 1 line with ellipsis
  - Creator name truncates to 1 line
  - Badge doesn't truncate (flex-shrink-0)

**Subtask 1.3** — Test SearchResultItem in isolation
  - Visible output: Component renders correctly with sample data
  - Test selected vs unselected states
  - Test with/without type badge

---

#### Task 2: Create SearchDropdown Component
**Subtask 2.1** — Create `components/search-dropdown.tsx` file
  - Visible output: File created with component structure
  - Props interface: `results`, `isLoading`, `isOpen`, `selectedIndex`, `onSelect`, `onClose`, `query`, `maxResults`, `dropdownRef`
  - Basic conditional rendering: return null if `!isOpen`

**Subtask 2.2** — Implement loading state UI
  - Visible output: Skeleton/spinner shows when `isLoading === true`
  - Show 3 skeleton items (title + creator placeholders)
  - Use Tailwind animate-pulse

**Subtask 2.3** — Implement empty state UI
  - Visible output: "No chatbots found" message shows when `results.length === 0` and `!isLoading`
  - Display query in message: `No chatbots found for "{query}"`
  - Center-aligned, gray text

**Subtask 2.4** — Implement results list rendering
  - Visible output: Results map to SearchResultItem components
  - Pass `isSelected` based on `index === selectedIndex`
  - Pass `onClick` handler that calls `onSelect(chatbot.id)`

**Subtask 2.5** — Add "See all results" link
  - Visible output: Link appears when `results.length === maxResults`
  - Link text: `See all results for "{query}"`
  - Border-top separator above link
  - Calls `onClose()` on click

**Subtask 2.6** — Add responsive styling and positioning
  - Visible output: Dropdown positioned correctly (absolute, top-full, z-50)
  - Desktop: matches input width
  - Mobile: full container width
  - Max height: max-h-96 with overflow-y-auto
  - Shadow, border, rounded corners

**Subtask 2.7** — Test SearchDropdown in isolation
  - Visible output: Component renders all states correctly
  - Test loading, empty, and results states
  - Test "See all results" link visibility
  - Test keyboard selection highlighting

---

#### Task 3: Add Type Definitions
**Subtask 3.1** — Create `lib/types/chatbot.ts` file (or verify existing types)
  - Visible output: File created with Chatbot type definitions
  - Export: `Chatbot`, `ChatbotType`, `CategoryType` interfaces
  - Match API response format from `/api/chatbots/public`

**Subtask 3.2** — Import types in SearchResultItem and SearchDropdown
  - Visible output: Components use shared types (no duplication)

---

#### Task 4: Refactor SearchBar - Add State Management
**Subtask 4.1** — Add new state variables to SearchBar
  - Visible output: State added: `searchResults`, `isLoadingResults`, `isDropdownOpen`, `selectedIndex`
  - Types: `Chatbot[]`, `boolean`, `boolean`, `number` (default: -1)

**Subtask 4.2** — Add refs for dropdown and input
  - Visible output: Refs created: `dropdownRef`, `inputRef`
  - Types: `React.RefObject<HTMLDivElement>`, `React.RefObject<HTMLInputElement>`

**Subtask 4.3** — Update SearchBar props interface
  - Visible output: Props updated with new optional props
  - Add: `showDropdown?: boolean` (default: true)
  - Add: `maxResults?: number` (default: 10)
  - Add: `onChatbotSelect?: (chatbotId: string) => void`
  - Mark as deprecated (with comments): `navigateOnSearch`, `onSearchChange`

---

#### Task 5: Refactor SearchBar - Add API Fetching
**Subtask 5.1** — Add useEffect for API fetching with debounced search
  - Visible output: API call triggers when `debouncedSearch.length >= 2`
  - Endpoint: `/api/chatbots/public?search=${encodeURIComponent(debouncedSearch)}&pageSize=${maxResults || 10}`
  - Set `isLoadingResults` to true before fetch
  - Set `isDropdownOpen` to true when fetching

**Subtask 5.2** — Implement AbortController for request cancellation
  - Visible output: Previous requests cancelled when new search starts
  - Create AbortController in useEffect
  - Pass `signal` to fetch options
  - Cleanup function calls `abortController.abort()`
  - Ignore AbortError in catch block

**Subtask 5.3** — Handle API response and errors
  - Visible output: Results update state correctly
  - On success: `setSearchResults(data.chatbots || [])`, reset `selectedIndex` to -1
  - On error: Log to console, set empty results array
  - Always set `isLoadingResults` to false in finally block
  - Check `!abortController.signal.aborted` before state updates

**Subtask 5.4** — Handle empty/minimal search queries
  - Visible output: Dropdown closes when query < 2 characters
  - Clear results, close dropdown, return early from useEffect

---

#### Task 6: Refactor SearchBar - Add Click Outside Detection
**Subtask 6.1** — Add useEffect for click-outside detection
  - Visible output: Dropdown closes when clicking outside
  - Check if click target is outside both `dropdownRef.current` and `inputRef.current`
  - Close dropdown (`setIsDropdownOpen(false)`)
  - Keep search query (don't clear it)

**Subtask 6.2** — Attach refs to DOM elements
  - Visible output: `dropdownRef` attached to SearchDropdown, `inputRef` attached to Input
  - Pass `dropdownRef` to SearchDropdown component

---

#### Task 7: Refactor SearchBar - Add Keyboard Navigation
**Subtask 7.1** — Create handleKeyDown function
  - Visible output: Function handles ArrowDown, ArrowUp, Enter, Escape
  - Only active when `isDropdownOpen && searchResults.length > 0`

**Subtask 7.2** — Implement ArrowDown handler
  - Visible output: Selection moves down, wraps to top at bottom
  - `setSelectedIndex(prev => prev < searchResults.length - 1 ? prev + 1 : 0)`
  - Prevent default behavior

**Subtask 7.3** — Implement ArrowUp handler
  - Visible output: Selection moves up, wraps to bottom at top
  - `setSelectedIndex(prev => prev > 0 ? prev - 1 : searchResults.length - 1)`
  - Prevent default behavior

**Subtask 7.4** — Implement Enter handler
  - Visible output: Selected chatbot navigates on Enter press
  - If `selectedIndex >= 0`, call `handleChatbotSelect(searchResults[selectedIndex].id)`
  - Prevent default behavior

**Subtask 7.5** — Implement Escape handler
  - Visible output: Dropdown closes on Escape
  - `setIsDropdownOpen(false)`
  - Don't clear search query
  - Prevent default behavior

**Subtask 7.6** — Attach handleKeyDown to input element
  - Visible output: Keyboard events trigger handlers
  - Add `onKeyDown={handleKeyDown}` to Input component

---

#### Task 8: Refactor SearchBar - Add Selection Handler
**Subtask 8.1** — Create handleChatbotSelect function
  - Visible output: Function handles chatbot selection
  - Close dropdown (`setIsDropdownOpen(false)`)
  - Clear search query (`setSearchQuery('')`)
  - Reset selection index (`setSelectedIndex(-1)`)
  - Call optional `onChatbotSelect` callback if provided
  - Navigate: `router.push(\`/chat/${chatbotId}\`)`

**Subtask 8.2** — Pass handleChatbotSelect to SearchDropdown
  - Visible output: SearchDropdown calls handler on item click

---

#### Task 9: Refactor SearchBar - Add Focus and Scroll Management
**Subtask 9.1** — Add useEffect to keep input focused when dropdown opens
  - Visible output: Input stays focused for keyboard navigation
  - Focus `inputRef.current` when `isDropdownOpen` becomes true

**Subtask 9.2** — Add useEffect to scroll selected item into view
  - Visible output: Selected item scrolls into view during keyboard nav
  - Find element with `data-index="${selectedIndex}"`
  - Call `scrollIntoView({ block: 'nearest', behavior: 'smooth' })`
  - Only when `selectedIndex >= 0`

---

#### Task 10: Refactor SearchBar - Integrate SearchDropdown
**Subtask 10.1** — Import SearchDropdown component
  - Visible output: Import statement added at top of file

**Subtask 10.2** — Render SearchDropdown conditionally
  - Visible output: Dropdown renders when `showDropdown !== false && isDropdownOpen`
  - Position: Wrap in relative container, render after Input
  - Pass all required props: `results`, `isLoading`, `isOpen`, `selectedIndex`, `onSelect`, `onClose`, `query`, `maxResults`, `dropdownRef`

**Subtask 10.3** — Remove old navigation logic
  - Visible output: Old useEffect for `navigateOnSearch` removed or disabled
  - Old useEffect for `onSearchChange` callback removed or disabled
  - Keep backward compatibility: if `navigateOnSearch` prop exists, log deprecation warning

---

#### Task 11: Update AppHeader Component
**Subtask 11.1** — Remove deprecated props from AppHeader interface
  - Visible output: Props removed: `onSearchChange`, `initialSearchQuery`, `navigateOnSearch`
  - Update AppHeaderProps interface

**Subtask 11.2** — Remove prop destructuring and usage
  - Visible output: Props no longer passed to SearchBar
  - Remove from function parameters
  - Remove from SearchBar component props

**Subtask 11.3** — Test AppHeader search functionality
  - Visible output: Search works with dropdown on header
  - Dropdown appears when typing
  - Navigation works on selection

---

#### Task 12: Update Homepage (app/page.tsx)
**Subtask 12.1** — Remove handleSearchChange callback function
  - Visible output: Function removed from component
  - Remove state if only used for search callback

**Subtask 12.2** — Remove props from AppHeader usage
  - Visible output: AppHeader no longer receives search-related props
  - Remove `onSearchChange`, `initialSearchQuery`, `navigateOnSearch` props

**Subtask 12.3** — Verify grid filtering still works
  - Visible output: Homepage grid filtering independent of dropdown
  - Test that existing search filtering logic still functions
  - Both dropdown and grid filtering work simultaneously

**Subtask 12.4** — Test homepage search
  - Visible output: Dropdown appears, grid filters, both work independently

---

#### Task 13: Update Chat Component
**Subtask 13.1** — Remove navigateOnSearch prop from SearchBar
  - Visible output: Prop removed from SearchBar usage in Chat component
  - SearchBar handles its own navigation via dropdown

**Subtask 13.2** — Test chat page search
  - Visible output: Dropdown works on chat page
  - Navigation to selected chatbot works correctly

---

#### Task 14: Update Dashboard Component
**Subtask 14.1** — Remove navigateOnSearch prop from SearchBar
  - Visible output: Prop removed from SearchBar usage in Dashboard component
  - SearchBar handles its own navigation via dropdown

**Subtask 14.2** — Test dashboard search
  - Visible output: Dropdown works on dashboard page
  - Navigation to selected chatbot works correctly

---

#### Task 15: Testing and Verification
**Subtask 15.1** — Test dropdown visibility and states
  - Visible output: All states render correctly
  - Dropdown appears after 2+ characters
  - Loading state shows skeleton
  - Empty state shows message
  - Results display correctly

**Subtask 15.2** — Test keyboard navigation
  - Visible output: All keyboard shortcuts work
  - Arrow keys navigate selection
  - Enter selects and navigates
  - Escape closes dropdown
  - Selected item scrolls into view

**Subtask 15.3** — Test mouse/touch interaction
  - Visible output: Click interactions work
  - Click on result navigates
  - Click outside closes dropdown
  - "See all results" link works

**Subtask 15.4** — Test mobile responsiveness
  - Visible output: Mobile behavior works correctly
  - Dropdown appears below expanded search
  - Full width, scrollable
  - Touch interactions work

**Subtask 15.5** — Test edge cases
  - Visible output: Edge cases handled gracefully
  - Rapid typing cancels previous requests
  - API errors handled silently
  - Empty queries don't show dropdown
  - Special characters encoded properly

---

#### Task 16: Cleanup (Optional - Can Defer)
**Subtask 16.1** — Remove deprecated props from SearchBar interface
  - Visible output: Props removed after confirming no usage
  - Remove `navigateOnSearch` and `onSearchChange` from interface
  - Remove implementation code

**Subtask 16.2** — Verify no remaining usage of deprecated props
  - Visible output: Grep confirms no references to deprecated props
  - All components updated to new API

### Edge Cases to Handle

1. **Rapid typing:** AbortController cancels previous requests
2. **Empty search:** Don't show dropdown if query < 2 characters
3. **API errors:** Fail silently, show empty dropdown
4. **No results:** Show "No chatbots found" message
5. **Click outside:** Close dropdown, keep search query
6. **Escape key:** Close dropdown, keep search query
7. **Tab key:** Close dropdown (standard browser behavior)
8. **Mobile search expansion:** Dropdown appears below expanded search
9. **Keyboard navigation at boundaries:** Wrap around (ArrowUp at top goes to bottom, ArrowDown at bottom goes to top)
10. **Selected item out of view:** Scroll into view automatically
11. **Component unmount during fetch:** AbortController prevents state updates
12. **Multiple SearchBars on page:** Each manages its own state independently
13. **Very long chatbot titles:** Truncate with ellipsis in dropdown
14. **Special characters in search:** URL encode properly in API call

### Implementation Decisions (Final)

1. **Homepage Grid Filtering:** ✅ **DECIDED** - Keep both behaviors:
   - Dropdown for quick navigation to specific chatbots
   - Homepage grid continues to filter when search query is present (existing behavior)
   - Both work independently - dropdown doesn't interfere with grid filtering

2. **"See All Results" Link:** ✅ **DECIDED** - Include link in dropdown:
   - Show "See all results" link at bottom of dropdown when results.length === maxResults (10)
   - Link navigates to `/?search=${query}` to show full results on homepage
   - Only show when there are exactly 10 results (indicating more may exist)

3. **Search History:** ✅ **DECIDED** - Defer to future enhancement
   - Not implementing in this iteration
   - Can be added later without breaking changes

4. **Empty Query Behavior:** ✅ **DECIDED** - Only show dropdown when typing:
   - Minimum query length: 2 characters
   - Don't show dropdown when query is empty
   - Don't show "recent searches" or suggestions (future enhancement)

5. **Mobile UX:** ✅ **DECIDED** - Dropdown appears below expanded search:
   - When mobile search is expanded, dropdown appears directly below
   - Full width of container
   - Scrollable if results exceed viewport height

6. **Error Handling:** ✅ **DECIDED** - Fail silently:
   - On API error, show empty dropdown (no error message)
   - Log error to console for debugging
   - Don't disrupt user experience

7. **Escape Key Behavior:** ✅ **DECIDED** - Close dropdown only:
   - Escape closes dropdown
   - Does NOT clear search query (user may want to continue typing)
   - User can manually clear with X button or backspace

8. **Clear Search on Selection:** ✅ **DECIDED** - Clear search query:
   - When chatbot is selected, clear the search input
   - This provides clean state for next search

### Implementation Checklist

**Before Starting:**
- [ ] Review current SearchBar implementation
- [ ] Review Chatbot type definitions
- [ ] Test current search behavior on all pages
- [ ] Understand API endpoint response format

**Implementation Steps:**
- [ ] Create `components/search-result-item.tsx` with proper styling
- [ ] Create `components/search-dropdown.tsx` with all states (loading, empty, results)
- [ ] Add "See all results" link logic
- [ ] Refactor `components/search-bar.tsx`:
  - [ ] Add state management (results, loading, dropdown open, selected index)
  - [ ] Add refs (dropdownRef, inputRef)
  - [ ] Add API fetching with AbortController
  - [ ] Add keyboard navigation handlers
  - [ ] Add click-outside detection
  - [ ] Add focus management
  - [ ] Add scroll-into-view logic
  - [ ] Integrate SearchDropdown component
  - [ ] Mark deprecated props (keep for backward compat)
- [ ] Update `components/app-header.tsx` (remove props)
- [ ] Update `app/page.tsx` (remove callback, verify grid filtering)
- [ ] Update `components/chat.tsx` (remove prop)
- [ ] Update `components/dashboard-content.tsx` (remove prop)

**Testing Checklist:**
- [ ] Dropdown appears after typing 2+ characters
- [ ] Loading state shows while fetching
- [ ] Results display correctly
- [ ] Empty state shows when no results
- [ ] "See all results" link appears when results.length === maxResults
- [ ] Keyboard navigation works (ArrowUp, ArrowDown, Enter, Escape)
- [ ] Click outside closes dropdown
- [ ] Click on result navigates to `/chat/${chatbotId}`
- [ ] Search query clears after selection
- [ ] Works on homepage (dropdown + grid filtering)
- [ ] Works on chat page
- [ ] Works on dashboard page
- [ ] Mobile: Dropdown appears below expanded search
- [ ] Mobile: Full width, scrollable
- [ ] Rapid typing cancels previous requests
- [ ] API errors handled gracefully
- [ ] Selected item scrolls into view

**Cleanup (Optional):**
- [ ] Remove deprecated props after confirming no usage
- [ ] Create shared types file
- [ ] Update imports to use shared types

### Estimated Complexity

- **SearchBar Refactor:** Medium-High (adds API fetching, dropdown, keyboard nav, click-outside, AbortController)
- **New Components:** Low-Medium (SearchDropdown and SearchResultItem are straightforward)
- **Page Updates:** Low (just removing props)
- **Testing:** Medium (keyboard nav, click-outside, mobile behavior, edge cases)

**Total Estimated Time:** 4-6 hours for implementation + 2-3 hours for testing

### Success Criteria

- ✅ Dropdown appears when typing in search (after 2+ characters)
- ✅ Dropdown shows up to 10 chatbot results
- ✅ Clicking a result navigates to `/chat/${chatbotId}`
- ✅ Keyboard navigation works (arrow keys, Enter, Escape)
- ✅ Click outside closes dropdown
- ✅ Works consistently on homepage, chat, and dashboard pages
- ✅ Mobile responsive (dropdown appears below expanded search)
- ✅ Loading states shown while fetching
- ✅ Empty state shown when no results
- ✅ No navigation away from page unless user clicks a result

---

### Approval Prompt

**Approve the plan to proceed to BUILD?** (Yes / Answer questions / Edit)

This plan breaks down the dropdown search implementation into 16 tasks with 50+ granular subtasks, each with clear visible outputs. The implementation follows a logical dependency order:
1. Create new components (SearchResultItem, SearchDropdown)
2. Add types
3. Refactor SearchBar incrementally (state → API → interactions → integration)
4. Update consuming components
5. Test and verify

All architectural decisions are documented, edge cases are identified, and success criteria are clearly defined.

