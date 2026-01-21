# Debugging: Slow Homepage Loading Issue

## Problem Summary

**Symptom**: Homepage at `http://localhost:3000/` takes an agonizingly long time to load chatbot lists in development, but works fine in production.

**Additional Issues**:
- Creators section never loads
- Sometimes get `Runtime ChunkLoadError`: "Loading chunk app/layout failed (timeout)"
- Error occurs at `app/layout.tsx` line 35 (`ClerkProvider`)

## Root Cause Hypothesis

The homepage makes **5 simultaneous API requests** on mount:
1. `/api/creators` (via `useCreators` hook)
2. `/api/chatbots/public?type=FRAMEWORK` (via `useChatbotGrid` hook)
3. `/api/chatbots/public?type=DEEP_DIVE` (via `useChatbotGrid` hook)
4. `/api/chatbots/public?type=BODY_OF_WORK` (via `useChatbotGrid` hook)
5. `/api/chatbots/public?type=ADVISOR_BOARD` (via `useChatbotGrid` hook)

In development, these simultaneous requests overwhelm:
- The Next.js dev server
- The database connection pool
- Network resources

This causes:
- Slow response times
- Timeouts
- Chunk loading failures (Next.js dev server gets overwhelmed)

## Solution Attempted

### Changes Made

1. **Request Deduplication** (`lib/hooks/use-chatbot-grid.ts` & `lib/hooks/use-creators.ts`)
   - Added `inFlightRequests` Map to track active requests
   - Prevents duplicate API calls if component re-renders
   - Multiple hooks requesting same data share the same promise

2. **Staggered Loading** (Development Only)
   - Added delays between requests in development mode
   - Creators: 50ms delay
   - FRAMEWORK: 200ms delay
   - DEEP_DIVE: 400ms delay
   - BODY_OF_WORK: 600ms delay
   - ADVISOR_BOARD: 800ms delay
   - Production: No delays (immediate execution)

3. **Development Mode Detection**
   - Primary: `process.env.NODE_ENV === 'development'`
   - Fallback: `window.location.hostname === 'localhost'`

### Files Modified

- `lib/hooks/use-chatbot-grid.ts` - Added deduplication and staggered loading
- `lib/hooks/use-creators.ts` - Added deduplication and staggered loading

## Current Status

**Logging Implemented** ✅ - Comprehensive logging has been added to all hooks and API routes.

**Root Cause Identified** ✅ - Terminal logs reveal database queries are the bottleneck.

### Key Findings from Terminal Logs

**Database queries are taking 2.5-4.5 seconds each:**
- Creators: 2,462ms database query time
- Chatbot queries: 2,834-4,466ms database query time
- Auth checks: ~80-110ms (fast ✅)

**Missing composite index**: The query filters by `(isPublic, isActive, type)` but only has separate indexes, not a composite index.

**Multiple queries per request**: Each chatbot request executes:
1. COUNT query for pagination
2. Main SELECT query
3. Separate queries for Creator, Ratings, Categories (Prisma includes)

**Initial Test Results** (from console logs):
- ✅ Staggered loading is working correctly (delays: 0ms, 50ms, 200ms, 400ms, 600ms)
- ✅ Development mode detection is working (`isDevelopment: true`)
- ❌ **CRITICAL ISSUE**: API requests are taking **4-6 seconds each**:
  - Creators: 4,143ms
  - ADVISOR_BOARD: 4,112ms
  - BODY_OF_WORK: 4,395ms
  - FRAMEWORK: 4,829ms
  - DEEP_DIVE: 6,207ms

**Root Cause Identified**: The problem is NOT the staggered loading (which works), but rather **extremely slow API response times**. Each request takes 4-6 seconds, which means:
- Even with staggering, requests still overlap significantly
- Database queries are likely the bottleneck
- Connection pool may be exhausted or queries are inefficient

**Next Steps**:
1. Check server-side API logs (terminal) to see database query times
2. Investigate database connection pool configuration
3. Optimize Prisma queries if needed
4. Consider sequential loading instead of staggered if database is the bottleneck

## Recommended Debugging Approach

### 1. Add Comprehensive Logging

Add logging to understand what's actually happening:

**In `lib/hooks/use-chatbot-grid.ts`:**
```typescript
// At the start of useEffect
console.log(`[useChatbotGrid:${type}] Mounting, priority: ${priority}, delay: ${delay}, isDev: ${isDevelopment}`);

// At the start of fetchChatbotsByType
console.log(`[useChatbotGrid:${type}] Starting fetch, page: ${pageNum}, reset: ${reset}, cacheKey: ${cacheKey}`);

// When reusing cached request
if (requestPromise) {
  console.log(`[useChatbotGrid:${type}] Reusing in-flight request for ${cacheKey}`);
}

// On success/error
console.log(`[useChatbotGrid:${type}] Fetch completed, chatbots: ${data.chatbots.length}`);
```

**In `lib/hooks/use-creators.ts`:**
```typescript
// Similar logging pattern
console.log(`[useCreators] Mounting, delay: ${delay}, isDev: ${isDevelopment}`);
console.log(`[useCreators] Starting fetch, cacheKey: ${cacheKey}`);
```

**In API routes** (`app/api/chatbots/public/route.ts` & `app/api/creators/route.ts`):
```typescript
// At start of GET handler
const startTime = Date.now();
console.log(`[API:${req.url}] Request started at ${new Date().toISOString()}`);

// Before database query
console.log(`[API:${req.url}] Starting database query`);

// After database query
const queryTime = Date.now() - startTime;
console.log(`[API:${req.url}] Database query completed in ${queryTime}ms, returned ${chatbots.length} items`);

// Before response
const totalTime = Date.now() - startTime;
console.log(`[API:${req.url}] Request completed in ${totalTime}ms`);
```

### 2. Check Network Tab

Open browser DevTools → Network tab and check:
- Are requests actually staggered? (Check `Started` column)
- How long do requests take? (Check `Time` column)
- Are requests timing out? (Look for red/failed requests)
- Are there duplicate requests? (Check request count)

### 3. Check Database Performance

The API routes perform complex Prisma queries with:
- Multiple joins (`creator`, `categories`, `ratingsAggregate`, `favoritedBy`)
- Aggregations (`_count`, `ratingsAggregate`)
- Conditional includes based on authentication

**Check**:
- Database connection pool size
- Query execution time (add logging as above)
- Database server performance

### 4. Verify Development Mode Detection

Add temporary logging to verify:
```typescript
console.log('Environment check:', {
  processEnv: typeof process !== 'undefined' ? process.env.NODE_ENV : 'undefined',
  hostname: typeof window !== 'undefined' ? window.location.hostname : 'undefined',
  isDevelopment: isDevelopment
});
```

### 5. Alternative Solutions to Consider

If staggered loading doesn't help, consider:

**A. Sequential Loading (One at a time)**
- Wait for each request to complete before starting the next
- More noticeable delay but guaranteed to work

**B. Batch API Endpoint**
- Create `/api/homepage-data` that fetches all data in one request
- Single database query with proper joins
- Faster overall, but requires API changes

**C. Server Components**
- Move data fetching to server components
- Next.js handles this more efficiently
- Requires refactoring from client components

**D. Increase Delays**
- Try larger delays (500ms, 1000ms) to see if it helps
- If it does, the issue is definitely request overload

**E. Database Query Optimization**
- Review Prisma queries for inefficiencies
- Add database indexes if missing
- Consider query result caching

## Log Analysis (From Test Run)

### What's Working ✅
- Staggered loading is functioning correctly:
  - FRAMEWORK: 0ms delay (starts immediately)
  - Creators: 50ms delay
  - DEEP_DIVE: 200ms delay
  - BODY_OF_WORK: 400ms delay
  - ADVISOR_BOARD: 600ms delay
- Development mode detection: `isDevelopment: true`
- Request deduplication: Each request creates a new promise (no duplicates)
- Fast Refresh: Working (168ms, 696ms rebuild times)

### Critical Issues ❌

**1. API Response Times Are Extremely Slow (4-6 seconds each)**
```
Creators:        4,143ms
ADVISOR_BOARD:   4,112ms
BODY_OF_WORK:    4,395ms
FRAMEWORK:       4,829ms
DEEP_DIVE:       6,207ms
```

**Impact**: Even with 600ms staggering, all requests overlap because they take 4-6 seconds to complete.

**2. Database Queries Are the Bottleneck** ✅ CONFIRMED
From terminal logs, database queries are taking **2.5-4.5 seconds each**:
- Creators: **2,462ms** database query (line 462)
- ADVISOR_BOARD: **2,834ms** database queries (line 494)
- BODY_OF_WORK: **2,848ms** database queries (line 509)
- FRAMEWORK: **3,030ms** database queries (line 527)
- DEEP_DIVE: **4,466ms** database queries (line 545)

**Breakdown of time per request:**
- Auth check: ~80-110ms (fast ✅)
- Database queries: 2,462-4,466ms (SLOW ❌)
- Total request time: 4,090-5,893ms

**3. Multiple Queries Per Request (N+1 Problem?)**
Each chatbot request executes multiple Prisma queries:
1. COUNT query for pagination (lines 457-460 - 4 queries start simultaneously)
2. Main SELECT query for chatbots (lines 476-479)
3. Separate queries for Creator data (lines 482-484)
4. Separate queries for Ratings (lines 485-486, 491)
5. Separate queries for Categories (lines 487-490, 492-493, 508, 526)

**4. Connection Pool Exhaustion Likely**
- All 4 COUNT queries start at the same time (lines 457-460)
- They take 2.5-4.5 seconds to complete
- This suggests connections are being queued or database is slow
- Default Prisma pool (~10 connections) may be insufficient for 5 simultaneous requests

## Next Steps

### Immediate Actions

1. **Check Server-Side Logs** (Terminal/Server Console)
   - Look for `[API:chatbots/public]` and `[API:creators]` logs
   - Check database query times specifically
   - Verify where the 4-6 seconds is being spent

2. **Check Database Connection Pool**
   - Verify `DATABASE_URL` includes connection pool parameters
   - Check if using Neon pooler (should have `-pooler` in hostname)
   - Consider increasing `connection_limit` parameter
   - Default Prisma pool is ~10 connections - may need more for dev

3. **Check Network Tab in Browser**
   - Verify request timing matches console logs
   - Check if requests are timing out or retrying
   - Look for any failed requests

### Solutions to Try (Prioritized Based on Terminal Log Analysis)

**🔴 CRITICAL: Optimize Database Queries** (Highest Priority)
The database queries are taking 2.5-4.5 seconds each. This is the root cause.

**A. Fix N+1 Query Problem**
Looking at the Prisma queries, each request does:
- 1 COUNT query
- 1 main SELECT query  
- Multiple follow-up queries for Creator, Ratings, Categories

**Solution**: Use Prisma's `include` more efficiently or combine queries:
- The API already uses `include`, but Prisma may be executing separate queries
- Consider using raw SQL or optimizing the Prisma query structure
- Check if indexes exist on `isPublic`, `isActive`, `type`, `creatorId`

**B. Add Composite Database Index** ⚠️ MISSING INDEX FOUND
The schema has separate indexes on `isPublic`, `isActive`, and `type`, but **NOT a composite index** on all three.

The query filters by: `WHERE isPublic = true AND isActive = true AND type = ?`

**Current indexes** (from schema.prisma):
- `@@index([isPublic])`
- `@@index([isActive])`
- `@@index([type])`

**Missing**: Composite index on `(isPublic, isActive, type)`

**Solution**: Add composite index to schema:
```prisma
model Chatbot {
  // ... existing fields ...
  
  @@index([isPublic, isActive, type]) // Add this composite index
  @@index([slug])
  @@index([isPublic])
  @@index([isActive])
  @@index([type])
  // ... rest of indexes
}
```

Then run migration:
```bash
npx prisma migrate dev --name add_composite_index_chatbot_public_active_type
```

**Why this helps**: PostgreSQL can use the composite index directly instead of scanning multiple indexes or doing a full table scan.

**C. Increase Connection Pool Size**
Add to `DATABASE_URL`:
```
?connection_limit=20&pool_timeout=10
```
This helps but won't fix slow queries - it just prevents queuing.

**D. Sequential Loading (Temporary Workaround)**
Wait for each request to complete before starting the next:
- Prevents connection pool exhaustion
- More noticeable delay but guaranteed to work
- Better than current 4-6 second delays

**E. Batch API Endpoint** (Best Long-term Solution)
Create `/api/homepage-data` that fetches all data in one request:
- Single database connection
- Single optimized query with proper joins
- Faster overall, but requires API refactoring

## Files to Review

- `app/page.tsx` - Homepage component (uses the hooks)
- `lib/hooks/use-chatbot-grid.ts` - Chatbot grid hook
- `lib/hooks/use-creators.ts` - Creators hook
- `app/api/chatbots/public/route.ts` - Chatbots API endpoint
- `app/api/creators/route.ts` - Creators API endpoint
- `lib/prisma.ts` - Database client configuration
- `app/layout.tsx` - Root layout (ChunkLoadError location)

## Related Issues

- ChunkLoadError suggests Next.js dev server instability
- May need to clear `.next` cache: `rm -rf .next && npm run dev`
- Check for port conflicts or resource limits
- Consider Next.js dev server configuration options

