# Theme System Testing Checklist

## Test Environment Setup
- [ ] Dev server is running (`npm run dev`)
- [ ] Browser console shows no errors
- [ ] No TypeScript compilation errors in Next.js build

## Test 1: Theme Mode Selection ✅
**Test**: User selects "dark-cycle" mode  
**Steps**:
1. Navigate to chat page (`/chat/chatbot_art_of_war`)
2. Click Settings button (gear icon in header)
3. Select "Dark Cycle" radio button
4. Click "Save"

**Expected Results**:
- ✅ Modal opens with current theme mode selected
- ✅ Theme cycles through dark periods only (8pm-6am range)
- ✅ Gradient colors match dark periods (night, evening)
- ✅ Settings persist after page reload

**Verify**: Check gradient colors match dark periods

---

## Test 2: Custom Mode Lock ✅
**Test**: User selects custom mode → "golden hour"  
**Steps**:
1. Open Settings modal
2. Select "Custom" mode
3. Select "Golden Hour" period
4. Click "Save"
5. Wait 10 minutes

**Expected Results**:
- ✅ Gradient stays at golden hour colors
- ✅ Gradient does NOT change with time
- ✅ Period selector shows all 8 periods with gradient previews
- ✅ Selected period has blue border and checkmark

**Verify**: Wait 10 minutes, gradient unchanged

---

## Test 3: Persistence ✅
**Test**: User selects "light-cycle", refresh page  
**Steps**:
1. Open Settings modal
2. Select "Light Cycle" mode
3. Click "Save"
4. Refresh page (F5 or Cmd+R)

**Expected Results**:
- ✅ Theme mode persists after refresh
- ✅ Still shows "Light Cycle" mode
- ✅ Theme cycles through light periods only (6am-8pm range)

**Verify**: 
- Check localStorage: `localStorage.getItem('pocket-genius-theme')`
- Verify theme applied correctly

---

## Test 4: Cycle Mode Updates ✅
**Test**: Set to "cycle" mode, wait 5 minutes  
**Steps**:
1. Open Settings modal
2. Select "Cycle" mode
3. Click "Save"
4. Note current gradient colors
5. Wait 5 minutes

**Expected Results**:
- ✅ Gradient updates to match current time
- ✅ Updates happen automatically every 5 minutes
- ✅ Smooth transitions (2s ease)

**Verify**: Check gradient colors match time period

---

## Test 5: Settings Modal ✅
**Test**: Click settings button  
**Steps**:
1. Navigate to chat page
2. Click Settings button (gear icon)

**Expected Results**:
- ✅ Modal opens
- ✅ Current theme mode is selected (radio button highlighted)
- ✅ If custom mode, current period is selected

**Verify**: Radio button matches current mode

---

## Test 6: Period Preview Display ✅
**Test**: Select custom mode in settings  
**Steps**:
1. Open Settings modal
2. Select "Custom" mode
3. Review period selector rows

**Expected Results**:
- ✅ All 8 period rows display in chronological order:
  - Night → Dawn → Morning → Midday → Afternoon → Golden Hour → Dusk → Evening
- ✅ Each row shows:
  - ✅ Correct gradient background (`linear-gradient(135deg, period.start, period.end)`)
  - ✅ Correct text color:
    - Light periods (dawn, morning, midday, afternoon, golden, dusk): Dark text (#1a1a1a)
    - Dark periods (night, evening): Light text (#e8e8e8)
  - ✅ User-friendly names (Night, Dawn, Morning, etc.)
  - ✅ Selected period has blue border and checkmark icon
  - ✅ Hover states work

**Verify**: Visual inspection of each row matches expected gradient and text color

---

## Test 7: Site-Wide Theme Application ✅
**Test**: Theme applies to all pages  
**Steps**:
1. Navigate to home page (`/`)
2. Check background gradient
3. Navigate to chat page (`/chat/chatbot_art_of_war`)
4. Check background gradient
5. Navigate to dashboard (`/dashboard/chatbot_art_of_war`)
6. Check background gradient

**Expected Results**:
- ✅ Theme gradient visible on all pages
- ✅ Consistent gradient across pages
- ✅ Smooth transitions when navigating

**Verify**: All pages show theme gradient background

---

## Test 8: Theme Context Integration ✅
**Test**: Components can access theme values  
**Steps**:
1. Check chat component uses theme
2. Verify bubble styles use theme colors
3. Verify chrome colors use theme colors

**Expected Results**:
- ✅ Chat component uses `useTheme()` hook
- ✅ Bubble styles match theme (light/dark)
- ✅ Chrome colors derived from gradient
- ✅ Text colors match theme

**Verify**: Inspect component code and rendered styles

---

## Test 9: Default Theme ✅
**Test**: First-time user (no localStorage)  
**Steps**:
1. Clear localStorage: `localStorage.removeItem('pocket-genius-theme')`
2. Refresh page
3. Check theme mode

**Expected Results**:
- ✅ Default theme mode is "cycle"
- ✅ Theme applies correctly
- ✅ Full 24-hour cycle works

**Verify**: Theme mode is "cycle" by default

---

## Test 10: Theme Transitions ✅
**Test**: Change theme mode and verify smooth transitions  
**Steps**:
1. Set theme to "cycle" mode
2. Note current gradient
3. Change to "custom" → "golden hour"
4. Observe transition

**Expected Results**:
- ✅ Smooth gradient transition (2s ease)
- ✅ No flicker or jump
- ✅ Colors transition smoothly

**Verify**: Visual inspection of transition smoothness

---

## Known Issues / Notes
- None identified yet

## Browser Compatibility
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari
- [ ] Mobile browsers

## Performance
- [ ] No performance degradation
- [ ] Theme updates don't cause re-renders
- [ ] localStorage operations are fast

