# Homepage Creator Cards

**Date**: 2024-12-26  
**Status**: PLAN

## Objective

Add creator cards to the homepage in a separate section displayed before the chatbot cards. Creator cards will show avatar, name, bio snippet, and chatbot count, matching the chatbot card design and grid layout.

## Acceptance Criteria

- [ ] Creator cards appear in a dedicated section above chatbot cards on homepage
- [ ] Creator cards are always visible (not affected by chatbot filters/search)
- [ ] Each creator card displays: avatar, name, bio snippet (truncated), chatbot count
- [ ] Creator cards match chatbot card design and responsive grid (2/4/6 columns)
- [ ] Creator cards link to `/creators/[creatorSlug]` page when clicked
- [ ] Creators are sorted alphabetically by name
- [ ] API endpoint `/api/creators` includes `bio` and `chatbotCount` fields
- [ ] Loading states and empty states handled appropriately

## Clarifying Questions

All questions answered:
1. ✅ Creators in separate section, shown BEFORE chatbots
2. ✅ Always visible, no filtering/searching
3. ✅ Card content: avatar, name, bio snippet, chatbot count
4. ✅ No groups, alphabetical sorting
5. ✅ API should include chatbot count (and bio)
6. ✅ Match chatbot card design and columns

## Assumptions Gate

Proceeding with assumptions:
- Bio truncation: ~100 characters (matching chatbot description truncation)
- Chatbot count shows only public, active chatbots
- Empty state: "Error returning creators" if no creators exist
- Loading state: reuse existing skeleton pattern from homepage (lines 522-530 in app/page.tsx)

## Minimal Approach

1. Update `/api/creators` endpoint to include `bio` and `chatbotCount`
2. Create `CreatorCard` component matching `ChatbotCard` design
3. Add creators section to homepage before chatbot section
4. Fetch creators on homepage mount (already fetching, just need to use them)

## Text Diagram

```
Homepage Layout:
┌─────────────────────────────────────┐
│ AppHeader                           │
├─────────────────────────────────────┤
│ Hero Section                        │
├─────────────────────────────────────┤
│ Filters Section                     │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ Creators Section                │ │
│ │ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ │ │
│ │ │ C │ │ C │ │ C │ │ C │ │ C │ │ │
│ │ └───┘ └───┘ └───┘ └───┘ └───┘ │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ Chatbots Section                │ │
│ │ (existing categorized grids)     │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Plan File Contents

### 1. API Endpoint Update

**File**: `app/api/creators/route.ts`

**Changes**:
- Add `bio` to select fields
- Add `_count.chatbots` aggregation for chatbot count
- Filter chatbots count to only public + active
- Update response type to include `bio` and `chatbotCount`

**Pseudo-code**:
```typescript
const creators = await prisma.creator.findMany({
  where: {
    chatbots: {
      some: {
        isPublic: true,
        isActive: true,
      },
    },
  },
  orderBy: { name: 'asc' },
  select: {
    id: true,
    slug: true,
    name: true,
    avatarUrl: true,
    bio: true,
    _count: {
      select: {
        chatbots: {
          where: {
            isPublic: true,
            isActive: true,
          },
        },
      },
    },
  },
});

// Transform response
creators.map(creator => ({
  id: creator.id,
  slug: creator.slug,
  name: creator.name,
  avatarUrl: creator.avatarUrl,
  bio: creator.bio,
  chatbotCount: creator._count.chatbots,
}))
```

### 2. CreatorCard Component

**File**: `components/creator-card.tsx` (new file)

**Design**: Match `ChatbotCard` component structure

**Features**:
- Card wrapper with hover effect
- Avatar display (or initial fallback)
- Name (truncated if needed)
- Bio snippet (~100 chars, truncated)
- Chatbot count badge
- Click handler navigates to `/creators/[slug]`
- Responsive grid compatible

**Props Interface**:
```typescript
interface CreatorCardProps {
  creator: {
    id: string;
    slug: string;
    name: string;
    avatarUrl: string | null;
    bio: string | null;
    chatbotCount: number;
  };
}
```

**Layout Structure**:
```
┌─────────────────┐
│   [Avatar]      │ ← h-48, rounded or full
├─────────────────┤
│ Creator Name    │ ← font-semibold, line-clamp-2
│ Bio snippet...  │ ← text-sm, line-clamp-2
│ [X chatbots]   │ ← badge
└─────────────────┘
```

### 3. Homepage Update

**File**: `app/page.tsx`

**Changes**:
1. Update `Creator` interface to include `bio` and `chatbotCount`
2. Add creators section before chatbot section
3. Render creator cards in grid matching chatbot grid
4. Handle loading/empty states for creators
   - Loading: Reuse existing skeleton pattern (lines 522-530) for creators section
   - Empty: Show "Error returning creators" message

**Location**: After filters section, before chatbot grids

**Grid**: `grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4`

**Section Header**: "Creators" (h2, text-2xl font-bold mb-4)

### 4. Type Updates

**File**: `app/page.tsx`

**Interface Update**:
```typescript
interface Creator {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  chatbotCount: number;
}
```

## Work Plan

### Task 1: Update API Endpoint
- **Subtask 1.1** — Update `/api/creators` to include `bio` and `chatbotCount`  
  **Visible output**: API returns creators with bio and chatbotCount fields

- **Subtask 1.2** — Update API response type documentation  
  **Visible output**: JSDoc comments updated

### Task 2: Create CreatorCard Component
- **Subtask 2.1** — Create `components/creator-card.tsx`  
  **Visible output**: CreatorCard component file created

- **Subtask 2.2** — Implement card layout matching ChatbotCard design  
  **Visible output**: Card displays avatar, name, bio snippet, chatbot count

- **Subtask 2.3** — Add click handler to navigate to creator page  
  **Visible output**: Clicking card navigates to `/creators/[slug]`

- **Subtask 2.4** — Add bio truncation logic (~100 chars)  
  **Visible output**: Bio text truncated with ellipsis

### Task 3: Update Homepage
- **Subtask 3.1** — Update Creator interface in `app/page.tsx`  
  **Visible output**: Interface includes bio and chatbotCount

- **Subtask 3.2** — Add creators section before chatbot section  
  **Visible output**: Creators section appears above chatbots

- **Subtask 3.3** — Render creator cards in grid  
  **Visible output**: Creator cards displayed in responsive grid

- **Subtask 3.4** — Add loading skeleton for creators (reuse existing pattern from lines 522-530)  
  **Visible output**: Skeleton cards shown while loading using same grid/skeleton structure

- **Subtask 3.5** — Add empty state for creators  
  **Visible output**: "Error returning creators" message if empty

### Task 4: Testing & Verification
- **Subtask 4.1** — Verify API returns correct data  
  **Visible output**: API response includes bio and chatbotCount

- **Subtask 4.2** — Verify creator cards render correctly  
  **Visible output**: Cards display all required fields

- **Subtask 4.3** — Verify navigation works  
  **Visible output**: Clicking card navigates to creator page

- **Subtask 4.4** — Verify responsive grid layout  
  **Visible output**: Grid adapts to screen sizes (2/4/6 columns)

## Architectural Discipline

### File Limits Check
- `app/api/creators/route.ts`: Currently ~54 lines, adding ~15 lines → **~69 lines** ✅
- `components/creator-card.tsx`: New file, estimated ~150 lines ✅
- `app/page.tsx`: Currently 679 lines, adding ~50 lines → **~729 lines** ⚠️
  - **Action**: Monitor, but acceptable as homepage component

### Single Responsibility
- ✅ API endpoint: Returns creator data
- ✅ CreatorCard: Displays creator information
- ✅ Homepage: Orchestrates display of creators and chatbots

### Pattern Extraction
- Bio truncation logic matches chatbot description truncation → **Reuse existing pattern**
- Card hover effects match ChatbotCard → **Reuse existing Card component**
- Loading skeleton pattern → **Reuse existing skeleton grid from homepage (lines 522-530)**

### Dependencies
- No new dependencies required
- Uses existing: Card, Badge, Image components

## Risks & Edge Cases

1. **Bio is null**: Display placeholder text or hide bio section
2. **Avatar is null**: Show initial letter fallback (matching ChatbotCard)
3. **ChatbotCount is 0**: Should not happen (API filters creators with chatbots), but handle gracefully
4. **Slug is null**: Should not happen (schema constraint), but add null check
5. **Long names**: Truncate with line-clamp-2
6. **Many creators**: Grid handles overflow, consider pagination if >50 creators (future)

## Tests

### Test 1: API Returns Correct Data
**Input**: GET `/api/creators`  
**Expected Output**: 
```json
{
  "creators": [
    {
      "id": "...",
      "slug": "creator-slug",
      "name": "Creator Name",
      "avatarUrl": "https://...",
      "bio": "Bio text...",
      "chatbotCount": 5
    }
  ]
}
```

### Test 2: CreatorCard Renders All Fields
**Input**: Creator object with all fields  
**Expected Output**: Card displays avatar, name, bio snippet, chatbot count

### Test 3: CreatorCard Navigation
**Input**: Click on creator card  
**Expected Output**: Navigate to `/creators/[slug]`

### Test 4: Bio Truncation
**Input**: Bio > 100 characters  
**Expected Output**: Bio truncated to ~100 chars with ellipsis

### Test 5: Empty Bio Handling
**Input**: Creator with null bio  
**Expected Output**: Bio section hidden or shows placeholder

### Test 6: Responsive Grid
**Input**: View on mobile/tablet/desktop  
**Expected Output**: Grid shows 2/4/6 columns respectively

## Approval Prompt

Approve the plan to proceed to BUILD? (Yes / Answer questions / Edit)

