# Production Database Migration Guide: Chatbot Versioning System

This guide walks you through applying the chatbot versioning migration to your production database.

## Migration Overview

**Migration File**: `prisma/migrations/[timestamp]_add_chatbot_versioning/migration.sql`

**What it does**:
1. Adds versioning fields to Chatbot model (systemPrompt, modelProvider, modelName, pineconeNs, vectorNamespace, configJson, ragSettingsJson, ingestionRunIds, currentVersionId)
2. Creates Chatbot_Version table for immutable snapshots
3. Adds chatbotVersionId field to Conversation table
4. Creates indexes for performance

**Data Migration Script**: `prisma/migrations/add_chatbot_versioning_data.ts`

**What it does**:
1. Creates version 1 for all existing chatbots
2. Assigns all existing conversations to version 1
3. Updates chatbots to point to their version 1

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
   git commit -m "Add chatbot versioning system"
   git push origin main  # or your main branch
   ```

3. **Monitor deployment logs**:
   - Go to Vercel Dashboard → Your Project → Deployments → Latest
   - Check build logs for migration output
   - Look for: `Applying migration [timestamp]_add_chatbot_versioning`

4. **Run data migration script** (after deployment):
   ```bash
   # Set production DATABASE_URL
   export DATABASE_URL="your-production-url"
   
   # Run data migration
   npx tsx prisma/migrations/add_chatbot_versioning_data.ts
   ```

5. **Verify migration succeeded**:
   - See "Verification Steps" section below

**Pros**:
- ✅ Simple - just deploy and it happens automatically
- ✅ Code and database changes deploy together
- ✅ No manual steps required (except data migration script)

**Cons**:
- ⚠️ If migration fails, entire deployment fails
- ⚠️ Less control over timing
- ⚠️ Data migration script must be run manually after deployment

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

Before migrating, check current chatbot and conversation counts:

```bash
# Set DATABASE_URL first (from Step 2)
export DATABASE_URL="your-production-url"

# Check chatbot count
npx prisma db execute --stdin <<< "SELECT COUNT(*) as chatbot_count FROM \"Chatbot\";"

# Check conversation count
npx prisma db execute --stdin <<< "SELECT COUNT(*) as conversation_count FROM \"Conversation\";"
```

**Expected output**:
- Chatbot count: X (number of chatbots to migrate)
- Conversation count: Y (number of conversations to assign to versions)

### Step 4: Run Schema Migration

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

Applying migration `[timestamp]_add_chatbot_versioning`

The following migration(s) have been applied:

migrations/
  └─ [timestamp]_add_chatbot_versioning/
    └─ migration.sql

All migrations have been successfully applied.
```

### Step 5: Run Data Migration Script

**⚠️ IMPORTANT**: This step creates version 1 for all existing chatbots and assigns conversations to versions.

```bash
# Make sure DATABASE_URL is set (from Step 2)
export DATABASE_URL="your-production-url"

# Run data migration script
npx tsx prisma/migrations/add_chatbot_versioning_data.ts
```

**Expected output**:
```
Starting chatbot versioning data migration...
Found X chatbots to migrate
  - Created version 1 and assigned Y conversations
  - Created version 1 (no conversations to assign)
...

Migration complete!
  - Migrated: X chatbots
  - Errors: 0 chatbots
```

### Step 6: Verify Migration Succeeded

```bash
# Set DATABASE_URL
export DATABASE_URL="your-production-url"

# Check that all chatbots have versions
npx prisma db execute --stdin <<< "SELECT COUNT(*) as chatbots_with_versions FROM \"Chatbot\" WHERE \"currentVersionId\" IS NOT NULL;"

# Check that all conversations have chatbotVersionId
npx prisma db execute --stdin <<< "SELECT COUNT(*) as conversations_with_version FROM \"Conversation\" WHERE \"chatbotVersionId\" IS NOT NULL;"

# Check version count
npx prisma db execute --stdin <<< "SELECT COUNT(*) as version_count FROM \"Chatbot_Version\";"
```

**Expected output** (after migration):
- Chatbots with versions: X (should match total chatbot count)
- Conversations with version: Y (should match total conversation count)
- Version count: X (one version per chatbot)

### Step 7: Deploy Code Changes

After migration is verified, deploy your code changes:

```bash
git add .
git commit -m "Deploy chatbot versioning system (migration already applied)"
git push origin main
```

**Note**: Since migration is already applied, Vercel build will skip it (no-op).

**Pros**:
- ✅ Verify migration works before deploying code
- ✅ Can test migration independently
- ✅ More control over timing
- ✅ Can rollback code if needed (migration already applied)
- ✅ Data migration script runs before code deployment

**Cons**:
- ⚠️ Requires manual steps
- ⚠️ Need to coordinate migration and code deployment

---

## Verification Steps

After migration (either Option A or B), verify everything works:

### 1. Check Database Tables

```bash
# Set DATABASE_URL
export DATABASE_URL="your-production-url"

# Verify Chatbot_Version table exists
npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM \"Chatbot_Version\";"

# Verify all chatbots have currentVersionId
npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM \"Chatbot\" WHERE \"currentVersionId\" IS NOT NULL;"

# Verify all conversations have chatbotVersionId
npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM \"Conversation\" WHERE \"chatbotVersionId\" IS NOT NULL;"
```

### 2. Test Chat API

```bash
# Test that new conversations are created with chatbotVersionId
curl -X POST "https://your-app.vercel.app/api/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "chatbotId": "your-chatbot-id",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

**Expected**: Conversation should be created successfully with chatbotVersionId set.

### 3. Test Chatbot Update API

```bash
# Test updating chatbot configuration (creates new version)
curl -X PATCH "https://your-app.vercel.app/api/chatbots/your-chatbot-id" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "systemPrompt": "Updated prompt",
    "notes": "Test version creation"
  }'
```

**Expected**: Should return `{ success: true, version: {...} }` with new version created.

### 4. Check Vercel Logs

1. Go to Vercel Dashboard → Your Project → Logs
2. Look for any database-related errors
3. Verify no missing `chatbotVersionId` errors

---

## Troubleshooting

### Migration Fails: "column does not exist"

**Cause**: Migration file references column that doesn't exist yet.

**Solution**: 
1. Check migration file syntax
2. Verify you're running migrations in order
3. Check that previous migrations are applied

### Migration Fails: "relation already exists"

**Cause**: Migration was partially applied or table already exists.

**Solution**:
```bash
# Check migration status
npx prisma migrate status

# If migration shows as applied but table doesn't exist, manually create it
# Or mark migration as rolled back and re-run
```

### Data Migration Script Fails: "creator has no associated user"

**Cause**: Some chatbots have creators without associated users in Creator_User table.

**Solution**:
1. Check which chatbots are failing:
   ```bash
   npx prisma db execute --stdin <<< "SELECT c.id, c.title, cr.id as creator_id FROM \"Chatbot\" c JOIN \"Creator\" cr ON c.\"creatorId\" = cr.id LEFT JOIN \"Creator_User\" cu ON cr.id = cu.\"creatorId\" WHERE cu.\"userId\" IS NULL;"
   ```

2. Create Creator_User records for missing associations, or update the script to handle this case.

### Verification Shows Conversations Without chatbotVersionId

**Cause**: Data migration script didn't assign versions to all conversations.

**Solution**:
```bash
# Find conversations without chatbotVersionId
npx prisma db execute --stdin <<< "SELECT id, \"chatbotId\" FROM \"Conversation\" WHERE \"chatbotVersionId\" IS NULL;"

# Manually assign to chatbot's current version
# (This should be rare - script should handle all cases)
```

### Chat API Fails: "Cannot create version: chatbot creator has no associated user"

**Cause**: Chat API tries to auto-create version 1 but chatbot creator has no user.

**Solution**: 
1. Run data migration script first (it handles this case)
2. Or create Creator_User record for the chatbot's creator

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

**Option A: Restore from Backup** (Recommended)
1. Restore database from backup taken before migration
2. This preserves all data

**Option B: Manual Rollback** (Risky)
1. Drop Chatbot_Version table
2. Remove versioning fields from Chatbot table
3. Remove chatbotVersionId from Conversation table
4. This will lose all version history

**Better approach**: Fix forward rather than rollback. The migration is safe and tested.

---

## Summary

**Recommended Approach**: Option B (Manual Migration)

1. ✅ Get production `DATABASE_URL` from Vercel
2. ✅ Run `npx prisma migrate deploy` locally with production URL
3. ✅ Run data migration script: `npx tsx prisma/migrations/add_chatbot_versioning_data.ts`
4. ✅ Verify migration succeeded
5. ✅ Deploy code changes

**Quick Command Sequence**:
```bash
# 1. Get production DATABASE_URL from Vercel Dashboard → Settings → Environment Variables
export DATABASE_URL="your-production-url"

# 2. Run schema migration
npx prisma migrate deploy

# 3. Run data migration script (creates version 1 for all chatbots)
npx tsx prisma/migrations/add_chatbot_versioning_data.ts

# 4. Verify it worked
npx tsx scripts/verify-chatbot-versioning-migration.ts

# 5. Then deploy your code changes
git push origin main
```

**Time Required**: ~10 minutes (5 min migration + 5 min data migration)

**Risk Level**: Low (migration tested locally, data migration script handles edge cases)

---

## Important Notes

1. **Data Migration Script Must Run**: The schema migration creates the tables, but the data migration script is required to create version 1 for existing chatbots and assign conversations.

2. **No Downtime Required**: Both migrations can run while the app is running. New conversations will automatically get versions (via chat API fallback).

3. **Backward Compatibility**: The chat API includes fallback logic to create version 1 if none exists, so the app will continue working even if data migration script hasn't run yet.

4. **Creator-User Association**: The data migration script requires chatbots to have creators with associated users. If this isn't the case, you'll need to create Creator_User records first.

---

**Last Updated**: December 2024

