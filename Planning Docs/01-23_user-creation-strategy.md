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

**Step 0: Install Dependencies**

Install the `svix` package for webhook signature verification:
```bash
npm install svix
```

**Step 1: Create Webhook Endpoint**

Create `app/api/webhooks/clerk/route.ts`:
```typescript
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
      console.error('Missing CLERK_WEBHOOK_SECRET');
      return Response.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    // Verify webhook signature
    const headerPayload = await headers();
    const svix_id = headerPayload.get('svix-id');
    const svix_timestamp = headerPayload.get('svix-timestamp');
    const svix_signature = headerPayload.get('svix-signature');

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return Response.json({ error: 'Missing svix headers' }, { status: 400 });
    }

    const body = await req.text();
    const wh = new Webhook(WEBHOOK_SECRET);

    let evt: WebhookEvent;
    try {
      evt = wh.verify(body, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      }) as WebhookEvent;
    } catch (err) {
      console.error('Webhook verification failed:', err);
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Handle user.created event
    if (evt.type === 'user.created') {
      const { id: clerkId, email_addresses, first_name, last_name } = evt.data;

      if (!clerkId) {
        console.error('Missing clerkId in webhook payload');
        return Response.json({ error: 'Invalid payload' }, { status: 400 });
      }

      const primaryEmail = email_addresses?.find(
        e => e.id === evt.data.primary_email_address_id
      )?.email_address;

      // Use upsert to handle potential duplicates (e.g., webhook retries)
      await prisma.user.upsert({
        where: { clerkId },
        update: {
          email: primaryEmail || '',
          firstName: first_name,
          lastName: last_name,
        },
        create: {
          clerkId,
          email: primaryEmail || '',
          firstName: first_name,
          lastName: last_name,
        },
      });

      console.log(`✅ User created/updated: ${clerkId}`);
    }

    // Handle user.updated event
    if (evt.type === 'user.updated') {
      const { id: clerkId, email_addresses, first_name, last_name } = evt.data;

      if (!clerkId) {
        console.error('Missing clerkId in webhook payload');
        return Response.json({ error: 'Invalid payload' }, { status: 400 });
      }

      const primaryEmail = email_addresses?.find(
        e => e.id === evt.data.primary_email_address_id
      )?.email_address;

      await prisma.user.update({
        where: { clerkId },
        data: {
          email: primaryEmail || '',
          firstName: first_name,
          lastName: last_name,
        },
      });

      console.log(`✅ User updated: ${clerkId}`);
    }

    // Handle user.deleted event
    if (evt.type === 'user.deleted') {
      const { id: clerkId } = evt.data;

      if (!clerkId) {
        console.error('Missing clerkId in webhook payload');
        return Response.json({ error: 'Invalid payload' }, { status: 400 });
      }

      // Delete user and cascade to related records
      // Note: Prisma cascade rules in schema will handle related data cleanup
      await prisma.user.delete({
        where: { clerkId },
      });

      console.log(`✅ User deleted: ${clerkId}`);
    }

    return Response.json({ success: true, type: evt.type });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Note:** The User schema does not include an `avatarUrl` field, so avatar images are not synced to the local database. If you need to store avatars, add `avatarUrl String?` to the User model and create a migration first.

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

**Step 4: Test Webhook Locally**

Before deploying, test the webhook locally:

1. **Option A: Use Clerk's webhook testing UI**
   - In Clerk Dashboard → Webhooks → Your webhook → Testing tab
   - Send test events to verify your endpoint works

2. **Option B: Use ngrok for local testing**
   ```bash
   # Install ngrok
   npm install -g ngrok

   # Start your local dev server
   npm run dev

   # In another terminal, expose your local server
   ngrok http 3000

   # Use the ngrok URL in Clerk Dashboard temporarily
   # Example: https://abc123.ngrok.io/api/webhooks/clerk
   ```

3. **Verify logs show successful webhook processing**

**Step 5: Backfill Existing Clerk Users**

Run a one-time script to sync existing Clerk users who don't have local records:

Create `scripts/sync-clerk-users.ts`:
```typescript
import { clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

async function syncClerkUsers() {
  try {
    console.log('🔄 Syncing Clerk users to local database...');

    const { data: users } = await clerkClient.users.getUserList();
    console.log(`Found ${users.length} users in Clerk`);

    let synced = 0;
    let errors = 0;

    for (const user of users) {
      try {
        const primaryEmail = user.emailAddresses.find(
          e => e.id === user.primaryEmailAddressId
        )?.emailAddress;

        await prisma.user.upsert({
          where: { clerkId: user.id },
          update: {
            email: primaryEmail || '',
            firstName: user.firstName,
            lastName: user.lastName,
          },
          create: {
            clerkId: user.id,
            email: primaryEmail || '',
            firstName: user.firstName,
            lastName: user.lastName,
          },
        });

        synced++;
        console.log(`✅ Synced user: ${user.id} (${primaryEmail})`);
      } catch (error) {
        errors++;
        console.error(`❌ Failed to sync user ${user.id}:`, error);
      }
    }

    console.log(`\n✅ Sync complete: ${synced} synced, ${errors} errors`);
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
syncClerkUsers();
```

Run the script:
```bash
npx tsx scripts/sync-clerk-users.ts
```

**Step 6: Add Monitoring**

Add monitoring to catch webhook failures:

1. **Log all webhook events** (already included in webhook code)

2. **Set up Sentry alerts** for webhook errors:
   - Webhook verification failures
   - Database operation failures
   - Missing required fields

3. **Monitor Clerk Dashboard → Webhooks → Logs** for failed deliveries

4. **Add health check** (optional):
   ```typescript
   // app/api/webhooks/clerk/health/route.ts
   export async function GET() {
     return Response.json({ status: 'ok' });
   }
   ```

---

## Deployment Checklist

Follow this sequence to deploy the webhook implementation:

### Pre-Deployment
- [ ] Install `svix` dependency: `npm install svix`
- [ ] Create webhook endpoint file: `app/api/webhooks/clerk/route.ts`
- [ ] Create backfill script: `scripts/sync-clerk-users.ts`
- [ ] Test webhook locally using ngrok or Clerk's test UI
- [ ] Verify logs show successful webhook processing

### Production Deployment
1. [ ] Deploy webhook code to production
2. [ ] Add `CLERK_WEBHOOK_SECRET` to production environment variables
3. [ ] Configure webhook in Clerk Dashboard:
   - Endpoint URL: `https://www.mypocketgenius.com/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`, `user.deleted`
   - Copy signing secret to env var
4. [ ] Run backfill script: `npx tsx scripts/sync-clerk-users.ts`
5. [ ] Test with new user signup in production
6. [ ] Monitor Clerk Dashboard → Webhooks → Logs for successful deliveries
7. [ ] Verify Sentry is capturing any webhook errors

### Verification
- [ ] Create test user in Clerk
- [ ] Verify user record created in database
- [ ] Verify user can access app features without 404 errors
- [ ] Check webhook logs in Clerk Dashboard
- [ ] Update test user in Clerk
- [ ] Verify changes synced to database

---

## Conclusion

The Clerk webhook is the correct architectural solution. Clerk is the source of truth for users, and your local database should sync from it via webhooks. This is the pattern Clerk is designed for, and it ensures users exist in your database before they ever interact with your app.

The slightly higher setup cost (env var + dashboard config) is worth it for a clean, reliable, future-proof solution.

### Implementation Notes

**Email Field:** The User schema requires `email: String` (non-optional). The webhook code sets empty string as fallback for users without primary email addresses. If this is unacceptable, consider making email optional in the schema: `email: String?`

**Username Field:** The User schema includes `username: String?` but it's not populated by the webhook. Clerk doesn't provide a username field by default. This field can remain null unless you add custom username logic to your Clerk configuration.

**Avatar Storage:** Avatar URLs from Clerk (`image_url`) are not stored in the local database since the User schema doesn't include an `avatarUrl` field. Avatars can be fetched directly from Clerk when needed, or you can add the field to the schema if local storage is required.

**Database Cascade:** When users are deleted via webhook, Prisma cascade rules in your schema will automatically clean up related records (conversations, messages, etc.). Verify your schema has proper cascade delete rules configured.

### Ready for Implementation

This plan is now ready for LLM implementation. All code examples include proper error handling, the backfill script is complete and executable, testing strategies are documented, and monitoring recommendations are provided.

**Action:** Implement Clerk webhook following the deployment checklist above.
