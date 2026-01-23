# User Creation Strategy Analysis

**Date:** January 23, 2026
**Issue:** New users signing up via Clerk are not being created in the database, causing 404 errors on authenticated API routes.

---

## Current Situation

### The Problem
When a new user signs up via Clerk and attempts to start a chat, they receive a 404 error:
```
POST /api/conversations/create 404 (Not Found)
Error initializing intake flow: Error: Failed to create conversation
```

### Root Cause
The `/api/conversations/create` route (and all other authenticated routes) expects users to exist in the Prisma database with a matching `clerkId`. However, there is no mechanism to create this database record when users sign up through Clerk.

```typescript
// Current pattern in all authenticated routes:
const user = await prisma.user.findUnique({
  where: { clerkId: clerkUserId },
});

if (!user) {
  return NextResponse.json({ error: 'User not found' }, { status: 404 });
}
```

### Historical Context
- **Previously:** Authentication was optional. Anonymous users could chat without database records.
- **Change:** Auth was made required (commit `52b52df`), but user creation was never implemented.
- **Existing users:** Were created via the seed script using `SEED_USER_CLERK_ID`.

### Impact
- All new user signups are broken
- Users can sign up via Clerk but cannot use any features
- The app appears broken to new users immediately after signup

---

## Options Analysis

### Option 1: Clerk Webhook

**Description:** Create a webhook endpoint (`/api/webhooks/clerk`) that Clerk calls when users sign up. The webhook creates the user record in the database.

**Implementation:**
- Create `app/api/webhooks/clerk/route.ts`
- Configure webhook in Clerk dashboard
- Add `CLERK_WEBHOOK_SECRET` to environment variables

**Pros:**
- Industry standard pattern for Clerk + database sync
- User record created immediately on signup (before any app interaction)
- Handles user updates and deletions cleanly
- Single source of truth for user creation
- No latency added to user-facing requests

**Cons:**
- Requires Clerk dashboard configuration
- Requires new environment variable in production
- Webhook failures could silently fail (needs monitoring)
- Adds complexity (webhook verification with svix)

**Effort:** Medium (code + Clerk dashboard config + env vars)

---

### Option 2: Middleware Approach

**Description:** Add user creation logic to Next.js middleware that runs on every authenticated request.

**Implementation:**
```typescript
// middleware.ts
export default clerkMiddleware(async (auth, req) => {
  const { userId } = auth();
  if (userId) {
    await ensureUserExists(userId);
  }
});
```

**Pros:**
- Catches all authenticated routes automatically
- No changes needed to individual API routes
- Works immediately for any new routes added

**Cons:**
- Adds database call to EVERY request (performance impact)
- Middleware in Next.js can't easily use Prisma (edge runtime limitations)
- Harder to debug when things go wrong
- Overkill - most requests don't need user creation

**Effort:** Medium-High (edge runtime complications)

---

### Option 3: Helper Function (Route-Level)

**Description:** Create a reusable helper function that routes call to get-or-create the user.

**Implementation:**
```typescript
// lib/auth/ensure-user.ts
export async function ensureUser(clerkUserId: string) {
  return prisma.user.upsert({
    where: { clerkId: clerkUserId },
    update: {},
    create: { clerkId: clerkUserId },
  });
}

// In routes:
const user = await ensureUser(clerkUserId);
```

**Pros:**
- Simple implementation
- No external configuration needed
- Works immediately after deployment
- Only runs when actually needed
- Easy to understand and debug

**Cons:**
- Requires updating multiple routes (though could be done incrementally)
- Slightly redundant - upsert called even for existing users
- User record created lazily (on first API call, not on signup)

**Effort:** Low

---

### Option 4: Single Entry Point Fix

**Description:** Only add user creation to `/api/conversations/create` since it's always the first route new users hit in the intake flow.

**Implementation:**
```typescript
// app/api/conversations/create/route.ts
const user = await prisma.user.upsert({
  where: { clerkId: clerkUserId },
  update: {},
  create: { clerkId: clerkUserId },
  select: { id: true },
});
```

**Pros:**
- Minimal code change (one route)
- Fixes the immediate problem
- No external configuration
- Deploys instantly

**Cons:**
- Fragile - assumes this route is always hit first
- Other routes still fail if accessed directly
- Doesn't scale if user entry points change
- Technical debt - inconsistent patterns across routes

**Effort:** Very Low

---

## Comparison Matrix

| Criteria | Webhook | Middleware | Helper Function | Single Entry |
|----------|---------|------------|-----------------|--------------|
| Implementation effort | Medium | Medium-High | Low | Very Low |
| External config needed | Yes | No | No | No |
| Performance impact | None | High | Minimal | Minimal |
| Covers all routes | Yes | Yes | Requires updates | No |
| Industry standard | Yes | No | Partial | No |
| Deployment complexity | Medium | Low | Low | Low |
| Long-term maintainability | High | Medium | High | Low |
| Time to fix production | Hours | Hours | Minutes | Minutes |

---

## Recommendation

**Recommended approach: Option 1 (Clerk Webhook)**

### Key Insight: Clerk is the Source of Truth

Upon further analysis, Clerk already maintains a complete user table in its dashboard. Every user who signs up is stored in Clerk's database. Your local `User` table serves two purposes:
1. **Sync/mirror** of Clerk's user data
2. **Local UUID** for foreign key relationships (your schema uses `User.id`, not `clerkId`)

This changes the calculus significantly. The webhook isn't just "nice to have" - it's the architecturally correct way to sync an external auth provider's user lifecycle to your local database.

### Rationale

1. **Clerk owns the user lifecycle:** Users are created in Clerk first. Your database should react to Clerk's events, not try to catch up lazily.

2. **Proactive vs Reactive:**
   - **Webhook:** User created in your DB *before* they ever hit your app
   - **Helper function:** User created *when* they hit an API route (catching up to Clerk's state, risking race conditions)

3. **Clean data flow with webhook:**
   ```
   User signs up → Clerk creates user → Webhook fires → Local User created → User hits app → Works
   ```

   vs helper function (messy):
   ```
   User signs up → Clerk creates user → User hits app → 404 almost happens → Helper catches it → Creates user
   ```

4. **Future-proof:** Webhook handles the full user lifecycle:
   - `user.created` → Create local user
   - `user.updated` → Sync profile changes (name, email, avatar)
   - `user.deleted` → Clean up local data

5. **Industry standard:** This is exactly how Clerk is designed to work with databases. The webhook pattern is documented and recommended by Clerk.

### Implementation Plan

**Step 1: Create Webhook Endpoint**

Create `app/api/webhooks/clerk/route.ts`:
```typescript
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  // Verify webhook signature
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  const payload = await req.json();
  const wh = new Webhook(WEBHOOK_SECRET);
  const evt = wh.verify(JSON.stringify(payload), {
    'svix-id': svix_id,
    'svix-timestamp': svix_timestamp,
    'svix-signature': svix_signature,
  }) as WebhookEvent;

  // Handle user.created event
  if (evt.type === 'user.created') {
    const { id: clerkId, email_addresses, first_name, last_name, image_url } = evt.data;
    const primaryEmail = email_addresses?.find(e => e.id === evt.data.primary_email_address_id)?.email_address;

    await prisma.user.create({
      data: {
        clerkId,
        email: primaryEmail,
        firstName: first_name,
        lastName: last_name,
        avatarUrl: image_url,
      },
    });
  }

  return Response.json({ success: true });
}
```

**Step 2: Add Environment Variable**

Add to `.env.local` and production environment:
```
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

**Step 3: Configure Clerk Dashboard**

1. Go to Clerk Dashboard → Webhooks
2. Create new webhook endpoint: `https://www.mypocketgenius.com/api/webhooks/clerk`
3. Subscribe to events: `user.created`, `user.updated`, `user.deleted`
4. Copy the signing secret to your environment variable

**Step 4: Backfill Existing Clerk Users**

Run a one-time script to sync existing Clerk users who don't have local records:
```typescript
// scripts/sync-clerk-users.ts
import { clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

const users = await clerkClient.users.getUserList();
for (const user of users) {
  await prisma.user.upsert({
    where: { clerkId: user.id },
    update: {},
    create: {
      clerkId: user.id,
      email: user.emailAddresses[0]?.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.imageUrl,
    },
  });
}
```

---

## Conclusion

The Clerk webhook is the correct architectural solution. Clerk is the source of truth for users, and your local database should sync from it via webhooks. This is the pattern Clerk is designed for, and it ensures users exist in your database before they ever interact with your app.

The slightly higher setup cost (env var + dashboard config) is worth it for a clean, reliable, future-proof solution.

**Action:** Implement Clerk webhook and configure in Clerk dashboard.
