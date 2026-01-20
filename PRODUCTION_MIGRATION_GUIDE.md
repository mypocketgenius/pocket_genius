# Production Database Migration Guide: CREATOR → BODY_OF_WORK

This guide walks you through applying the `CREATOR` → `BODY_OF_WORK` migration to your production database.

## Migration Overview

**Migration File**: `prisma/migrations/20251229152358_rename_creator_to_body_of_work/migration.sql`

**What it does**:
1. Creates new enum type with `BODY_OF_WORK` instead of `CREATOR`
2. Updates all existing `CREATOR` records to `BODY_OF_WORK`
3. Replaces the old enum type

**Status**: ✅ Migration created and tested locally

---

## Option A: Automatic Migration (During Deployment)

**When to use**: If you want to deploy code changes and migration together in one deployment.

**How it works**:
- Your `package.json` has `"build": "prisma migrate deploy && next build"`
- When you deploy to Vercel, it will automatically run `prisma migrate deploy` before building
- Migration runs against production database using `DATABASE_URL` from Vercel environment variables

**Steps**:
1. **Ensure production DATABASE_URL is set in Vercel**:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Verify `DATABASE_URL` is set for Production environment
   - Verify `DIRECT_URL` is set (same value, used for migrations)

2. **Deploy to Vercel**:
   ```bash
   git add .
   git commit -m "Apply CREATOR → BODY_OF_WORK migration"
   git push origin main  # or your main branch
   ```

3. **Monitor deployment logs**:
   - Go to Vercel Dashboard → Your Project → Deployments → Latest
   - Check build logs for migration output
   - Look for: `Applying migration 20251229152358_rename_creator_to_body_of_work`

4. **Verify migration succeeded**:
   - See "Verification Steps" section below

**Pros**:
- ✅ Simple - just deploy and it happens automatically
- ✅ Code and database changes deploy together
- ✅ No manual steps required

**Cons**:
- ⚠️ If migration fails, entire deployment fails
- ⚠️ Less control over timing

---

## Option B: Manual Migration (Before Deployment) ⭐ RECOMMENDED

**When to use**: If you want to verify the migration works before deploying code changes, or if you want more control over timing.

**Steps**:

### Step 1: Get Production Database Connection String

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Copy the `DATABASE_URL` value (Production environment)
   - It looks like: `postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require`
5. **Also copy `DIRECT_URL`** if available (same value, used for migrations)

**Alternative**: Get from Neon Dashboard directly:
1. Go to [Neon Dashboard](https://console.neon.tech)
2. Select your project
3. Switch to **production** branch
4. Copy connection string

### Step 2: Set Environment Variable Locally

**Option A: Terminal Export (Recommended)**
```bash
# Set production DATABASE_URL (replace with your actual connection string)
export DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/pocket-genius-prod?sslmode=require"

# If you have DIRECT_URL, set it too (same value)
export DIRECT_URL="postgresql://user:pass@ep-xxx.neon.tech/pocket-genius-prod?sslmode=require"
```

**Option B: Temporary .env File**
```bash
# Create temporary file (don't commit this!)
cat > .env.production << 'EOF'
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/pocket-genius-prod?sslmode=require
DIRECT_URL=postgresql://user:pass@ep-xxx.neon.tech/pocket-genius-prod?sslmode=require
EOF

# Load it when running commands
npx dotenv-cli -e .env.production -- npx prisma migrate deploy
```

### Step 3: Check Current Production State (Optional but Recommended)

Before migrating, check if there are any `CREATOR` records in production:

```bash
# Set DATABASE_URL first (from Step 2)
export DATABASE_URL="your-production-url"

# Run verification script
npx tsx scripts/verify-creator-to-body-of-work-migration.ts
```

**Expected output** (before migration):
- `CREATOR records remaining: X` (where X is number of records to migrate)
- `BODY_OF_WORK records: 0` (or existing count if already migrated)

### Step 4: Run Migration

```bash
# Make sure DATABASE_URL is set (from Step 2)
export DATABASE_URL="your-production-url"

# Run migration
npx prisma migrate deploy

# Generate Prisma Client (if needed)
npx prisma generate
```

**Expected output**:
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "pocket-genius-prod", schema "public" at "ep-xxx.neon.tech:5432"

Applying migration `20251229152358_rename_creator_to_body_of_work`

The following migration(s) have been applied:

migrations/
  └─ 20251229152358_rename_creator_to_body_of_work/
    └─ migration.sql

All migrations have been successfully applied.
```

### Step 5: Verify Migration Succeeded

```bash
# Run verification script
npx tsx scripts/verify-creator-to-body-of-work-migration.ts
```

**Expected output** (after migration):
```
Migration Verification Results:
================================
CREATOR records remaining: 0
BODY_OF_WORK records: X (where X is migrated count)

Enum Type Verification:
======================
✅ FRAMEWORK type exists: Yes
✅ DEEP_DIVE type exists: Yes
✅ ADVISOR_BOARD type exists: Yes
✅ BODY_OF_WORK type exists: Yes
✅ CREATOR type removed from enum (verified by TypeScript types)

✅ Migration verification complete!
✅ All CREATOR records successfully migrated to BODY_OF_WORK
```

### Step 6: Deploy Code Changes

After migration is verified, deploy your code changes:

```bash
git add .
git commit -m "Deploy homepage changes (migration already applied)"
git push origin main
```

**Note**: Since migration is already applied, Vercel build will skip it (no-op).

**Pros**:
- ✅ Verify migration works before deploying code
- ✅ Can test migration independently
- ✅ More control over timing
- ✅ Can rollback code if needed (migration already applied)

**Cons**:
- ⚠️ Requires manual steps
- ⚠️ Need to coordinate migration and code deployment

---

## Verification Steps

After migration (either Option A or B), verify everything works:

### 1. Check Database Enum

```bash
# Set DATABASE_URL
export DATABASE_URL="your-production-url"

# Run verification script
npx tsx scripts/verify-creator-to-body-of-work-migration.ts
```

### 2. Test API Endpoint

```bash
# Test that API accepts BODY_OF_WORK
curl "https://your-app.vercel.app/api/chatbots/public?type=BODY_OF_WORK"

# Test that API rejects CREATOR (should return 400)
curl "https://your-app.vercel.app/api/chatbots/public?type=CREATOR"
```

**Expected**:
- `BODY_OF_WORK` → Returns 200 with chatbots (or empty array)
- `CREATOR` → Returns 400 with error message

### 3. Test Homepage

1. Visit your production homepage: `https://your-app.vercel.app`
2. Verify all 5 grids load:
   - Creators grid
   - Frameworks grid
   - Deep Dives grid
   - **Body of Work grid** (should display correctly)
   - Advisor Boards grid
3. Check browser console for errors

### 4. Check Vercel Logs

1. Go to Vercel Dashboard → Your Project → Logs
2. Look for any database-related errors
3. Verify no `CREATOR` type errors

---

## Troubleshooting

### Migration Fails: "enum type does not exist"

**Cause**: Migration file references enum that doesn't exist yet.

**Solution**: This shouldn't happen with the current migration file, but if it does:
1. Check migration file syntax
2. Verify PostgreSQL version supports enum operations
3. Try running migration in smaller steps

### Migration Fails: "column type cannot be cast automatically"

**Cause**: PostgreSQL can't convert enum values automatically.

**Solution**: The migration file handles this correctly by:
1. Converting column to TEXT first
2. Updating data
3. Converting back to enum

If this still fails, check migration file syntax.

### Migration Succeeds but API Still Returns Errors

**Cause**: Prisma Client not regenerated, or code still references `CREATOR`.

**Solution**:
```bash
# Regenerate Prisma Client
npx prisma generate

# Verify code doesn't reference CREATOR
grep -r "'CREATOR'" app/ components/ --include="*.ts" --include="*.tsx"
# Should return 0 results (except in migration files)
```

### Verification Script Shows CREATOR Records Still Exist

**Cause**: Migration didn't update all records.

**Solution**:
```bash
# Check database directly
export DATABASE_URL="your-production-url"
npx prisma studio
# Or query directly:
npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM \"Chatbot\" WHERE type::text = 'CREATOR';"
```

If records still exist, manually update:
```sql
UPDATE "Chatbot" SET type = 'BODY_OF_WORK' WHERE type::text = 'CREATOR';
```

---

## Rollback Plan (If Needed)

If migration causes issues, you can rollback:

### Step 1: Revert Code Changes

```bash
git revert HEAD  # Revert latest commit
git push origin main
```

### Step 2: Revert Database (If Needed)

**⚠️ Warning**: This is complex and may cause data loss. Only do this if absolutely necessary.

1. Create reverse migration manually
2. Or restore from database backup (if available)

**Better approach**: Fix forward rather than rollback. The migration is safe and tested.

---

## Summary

**Recommended Approach**: Option B (Manual Migration)

1. ✅ Get production `DATABASE_URL` from Vercel
2. ✅ Run `npx prisma migrate deploy` locally with production URL
3. ✅ Verify migration succeeded
4. ✅ Deploy code changes

**Quick Command**:
```bash
# One-liner (after setting DATABASE_URL)
export DATABASE_URL="your-production-url" && \
npx prisma migrate deploy && \
npx tsx scripts/verify-creator-to-body-of-work-migration.ts
```

**Time Required**: ~5 minutes

**Risk Level**: Low (migration tested locally, reversible if needed)

---

**Last Updated**: December 2024









