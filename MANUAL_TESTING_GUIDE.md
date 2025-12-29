# Manual Testing Guide for New Homepage

## Quick Setup to Test New Homepage

**Note**: The new homepage migration is complete. The new simplified homepage (`app/page.tsx`) is now active. The old homepage has been backed up to `app/page-old.tsx` for reference.

### Step 1: Start Development Server
```bash
# If not already running, start the dev server
npm run dev
```

**Note**: By default, Next.js runs on port `3000`. If you're using port `3001`, you may have a custom port configured or another process on 3000.

### Step 2: Access Homepage
- **URL**: `http://localhost:3000/` (or `http://localhost:3001/` if that's your configured port)
- The homepage should now show the new simplified grid layout

---

## Manual Testing Checklist

### ✅ Test 1: Verify All 5 Grids Display
**What to check:**
1. Navigate to homepage (`http://localhost:3000/`)
2. Scroll down and verify you see these sections in order:
   - ✅ **Creators** grid (with title "Creators" and description "Discover experts and thought leaders")
   - ✅ **Frameworks** grid (with title "Frameworks" and description "Structured methodologies and approaches")
   - ✅ **Deep Dives** grid (with title "Deep Dives" and description "In-depth explorations and analyses")
   - ✅ **Body of Work** grid (with title "Body of Work" and description "AI advisors trained on comprehensive creator content")
   - ✅ **Advisor Boards** grid (with title "Advisor Boards" and description "Collective wisdom from expert panels")

**Expected**: All 5 sections visible, even if some are empty

---

### ✅ Test 2: Verify Loading States
**What to check:**
1. Open browser DevTools (F12 or Cmd+Option+I)
2. Go to Network tab
3. Enable "Slow 3G" throttling (or "Fast 3G")
4. Refresh the page (`Cmd+R` or `F5`)
5. Observe each grid section

**Expected**: 
- Each grid shows skeleton loaders (gray boxes) while loading
- Skeleton loaders appear for ~6 items per grid
- Loaders disappear when data loads

---

### ✅ Test 3: Verify Error States
**What to check:**
1. Open browser DevTools → Network tab
2. Right-click on one of the API requests (e.g., `/api/chatbots/public?type=FRAMEWORK`)
3. Select "Block request URL" or use "Offline" mode
4. Refresh the page

**Expected**:
- Only the affected grid shows an error message
- Error message says: "Unable to load {type}. Please try again."
- Error message includes a "Retry" button
- Other grids continue to display normally
- Clicking "Retry" refetches that grid's data

---

### ✅ Test 4: Verify Empty States
**What to check:**
1. If you have empty chatbot types in your database, those grids should show empty states
2. Otherwise, check the empty state message format

**Expected**:
- Empty grids show message: "No {type} available yet" (e.g., "No frameworks available yet")
- Empty state is centered and visible (not hidden)
- Message is user-friendly

---

### ✅ Test 5: Verify "Load More" Functionality
**What to check:**
1. Find a grid that has more than 6 items (if available)
2. Scroll to bottom of that grid section
3. Look for "Load More" button
4. Click "Load More"

**Expected**:
- "Load More" button appears only when more pages are available
- Button shows loading spinner while fetching
- New items **append** to the grid (don't replace existing items)
- Button disappears when all pages are loaded
- Favorites persist when loading more items

---

### ✅ Test 6: Verify Favorites Functionality
**What to check:**
1. If you're logged in, find a chatbot card with a star icon
2. Click the star to favorite/unfavorite
3. Scroll down and click "Load More" on that grid
4. Verify favorite state persists

**Expected**:
- Star icon toggles when clicked
- Favorite state persists after pagination
- Favorites sync across all grids (if same chatbot appears in multiple grids)

---

### ✅ Test 7: Verify Search Does NOT Affect Homepage
**What to check:**
1. Type something in the search bar in the header
2. Observe the homepage grids below

**Expected**:
- Homepage grids remain unchanged
- Search only affects dropdown results
- No filters appear on homepage
- Grids continue to show their fixed content

---

### ✅ Test 8: Verify Parallel Loading
**What to check:**
1. Open DevTools → Network tab
2. Clear network log
3. Refresh the page
4. Look at the timing of API requests

**Expected**:
- All 5 API calls start simultaneously (within ~50ms of each other):
  - `/api/creators`
  - `/api/chatbots/public?type=FRAMEWORK&pageSize=6&page=1`
  - `/api/chatbots/public?type=DEEP_DIVE&pageSize=6&page=1`
  - `/api/chatbots/public?type=BODY_OF_WORK&pageSize=6&page=1`
  - `/api/chatbots/public?type=ADVISOR_BOARD&pageSize=6&page=1`
- Requests don't wait for each other (parallel, not sequential)

---

### ✅ Test 9: Verify No Filter UI
**What to check:**
1. Look at the homepage below the hero section
2. Check for any filter-related UI elements

**Expected**:
- ❌ No category type filter buttons (By Role, By Challenge, By Stage)
- ❌ No category badges
- ❌ No creator dropdown filter
- ❌ No chatbot type checkboxes (BODY_OF_WORK, FRAMEWORK, etc.)
- ❌ No "Active filters" display
- ❌ No "Clear all" button
- ✅ Only the 5 grid sections visible

---

### ✅ Test 10: Verify Hero Section
**What to check:**
1. Look at the top of the homepage (below header)

**Expected**:
- Hero section displays: "Turn Any Expert Into Your Advisor"
- Subtitle: "AI trained on their work. Personalized to your situation."
- Centered layout
- Proper spacing

---

## Browser DevTools Tips

### Network Tab
- **Filter by**: Type "api" in the filter box to see only API calls
- **Throttling**: Use "Slow 3G" to test loading states
- **Block requests**: Right-click → "Block request URL" to test error states

### Console Tab
- Check for any JavaScript errors
- Should see no errors related to homepage code

### Elements Tab
- Inspect grid sections to verify structure
- Check that skeleton loaders have correct classes

---

## Rollback Instructions

If you encounter issues and want to restore the old homepage:

```bash
# Restore old homepage (backup exists at app/page-old.tsx)
mv app/page.tsx app/page-new.tsx
mv app/page-old.tsx app/page.tsx
```

Then refresh your browser.

**Note**: The old homepage (`app/page-old.tsx`) contains filter functionality that has been removed in the new implementation. Only use rollback if absolutely necessary.

---

## Port Configuration

If your app runs on a different port:

1. Check `.env.local` or `.env` for `PORT` variable
2. Or check terminal output when running `npm run dev` - it shows the port
3. Default Next.js port is `3000`

To specify a port:
```bash
PORT=3001 npm run dev
```

---

## Common Issues

### Issue: "Cannot find module" errors
**Solution**: Make sure all supporting files exist:
- `lib/hooks/use-chatbot-grid.ts`
- `lib/hooks/use-creators.ts`
- `components/homepage-grid-section.tsx`
- `components/homepage-creators-section.tsx`

### Issue: Grids not loading
**Solution**: 
1. Check browser console for errors
2. Check Network tab - are API calls failing?
3. Verify database connection is working

### Issue: TypeScript errors
**Solution**: Run `npx tsc --noEmit` to check for type errors

---

## Success Criteria

✅ All 5 grids display correctly
✅ Loading states work (skeleton loaders)
✅ Error states work (retry buttons)
✅ Empty states display (not hidden)
✅ "Load More" works and appends items
✅ Favorites toggle works
✅ Search doesn't affect homepage
✅ No filter UI visible
✅ Parallel loading confirmed
✅ No console errors

If all criteria pass, the new homepage is ready for production! 🎉

