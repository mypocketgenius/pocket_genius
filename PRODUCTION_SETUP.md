# Production Setup Guide: The Art of War Bot

This guide walks you through setting up The Art of War chatbot in production after deploying to Vercel.

---

## Quick Start

**Where to run commands:** All commands run **locally** in your project directory (`/Users/ben/Developer/Next(dot)js/Pocket_Genius/`)

**Quick steps:**
1. Copy `DATABASE_URL` from Vercel Dashboard → Settings → Environment Variables
2. Get your Clerk User ID from Clerk Dashboard → Users → Your User
3. Export them in your terminal, then run: `npx prisma db seed`
4. Upload file via production UI
5. Wait for ingestion to complete

See detailed steps below ↓

---

## Prerequisites

Before starting, ensure you have:

- ✅ Vercel deployment is live and working
- ✅ Production database (Neon) is empty and ready
- ✅ Production blob storage (Vercel Blob) is empty
- ✅ All production environment variables are set in Vercel
- ✅ Your Clerk user ID (from Clerk Dashboard → Users → Your User)

---

## Step 1: Seed Production Database

The seed script creates the initial data structure: User, Creator, Chatbot, and Source.

### 1.1 Get Your Production Clerk User ID

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **Users** → Find your user
3. Copy your **User ID** (starts with `user_`)
4. Save it - you'll need it for the seed script

### 1.2 Get Production Environment Variables

You have two options to get your production environment variables:

**Option A: Copy from Vercel Dashboard (Easiest)**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Copy the `DATABASE_URL` value (production environment)
5. Copy your Clerk user ID from [Clerk Dashboard](https://dashboard.clerk.com) → Users → Your User

**Option B: Use Vercel CLI (Advanced)**
```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Pull environment variables (creates .env.local with production vars)
vercel env pull .env.production
```

### 1.3 Set Environment Variables Locally

You have **two options** for setting production environment variables:

#### Option A: Terminal Export (Recommended - Simplest)

**Just export them in your terminal** - no file needed. These only last for that terminal session:

```bash
# Get DATABASE_URL from Vercel Dashboard → Settings → Environment Variables
export DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/pocket-genius-prod?sslmode=require"

# Get your Clerk User ID from Clerk Dashboard → Users → Your User
export SEED_USER_CLERK_ID="user_xxxxx"
export SEED_USER_EMAIL="your@email.com"
export SEED_USER_FIRST_NAME="Your"  # Optional
export SEED_USER_LAST_NAME="Name"    # Optional
```

**Pros:** 
- ✅ No file to manage
- ✅ Won't accidentally commit to git
- ✅ Easy to use once

**Cons:**
- ⚠️ Only lasts for that terminal session
- ⚠️ Need to re-export if you open a new terminal

#### Option B: Temporary File (If You Prefer Files)

Create a temporary `.env.production` file in your project root:

```bash
# Create file in project root
cat > .env.production << 'EOF'
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/pocket-genius-prod?sslmode=require
SEED_USER_CLERK_ID=user_xxxxx
SEED_USER_EMAIL=your@email.com
SEED_USER_FIRST_NAME=Your
SEED_USER_LAST_NAME=Name
EOF
```

Then load it when running the seed script:

```bash
# Load .env.production and run seed
npx dotenv-cli -e .env.production -- npx tsx prisma/seed.ts
```

**Or** temporarily rename it to `.env.local` (seed script reads this automatically):

```bash
# Temporarily use production vars
mv .env.local .env.local.backup  # Backup your dev vars
cp .env.production .env.local     # Use prod vars
npx prisma db seed                # Run seed
mv .env.local.backup .env.local   # Restore dev vars
rm .env.production                # Clean up
```

**⚠️ Important:** 
- Use your **production** Clerk user ID (starts with `user_`), not a test user ID
- The `DATABASE_URL` should be from your **production** Neon branch
- **Don't commit** `.env.production` to git (it's already in `.gitignore`)

**Recommendation:** Use **Option A** (terminal export) - it's simpler and safer.

### 1.4 Run Seed Script Against Production Database

**Run this command in your terminal** (in your project root directory):

```bash
npx prisma db seed
```

**Where to run:** In your local project directory (`/Users/ben/Developer/Next(dot)js/Pocket_Genius/`)

The seed script will:
- Read `DATABASE_URL` from your exported environment variable
- Read `SEED_USER_CLERK_ID` and `SEED_USER_EMAIL` from exported variables
- Connect to your production database
- Create the initial data structure

**Expected Output:**
```
🌱 Starting seed...
✓ DATABASE_URL loaded (length: 123, preview: postgresql://user...)
✅ Created test user: your@email.com
✅ Created creator: Sun Tzu
✅ Linked user to creator
✅ Created chatbot: Art of War Deep Dive
✅ Created source: The Art of War

🎉 Seed completed successfully!

Summary:
  - User: your@email.com (user_xxxxx)
  - Creator: Sun Tzu
  - Chatbot: Art of War Deep Dive
  - Source: The Art of War

Next steps:
  1. Upload Art of War PDF to this source
  2. Wait for ingestion to complete
  3. Visit /chat/chatbot_art_of_war to test
  4. Visit /dashboard/chatbot_art_of_war to see analytics
```

**✅ Verification:** Check your Neon production database - you should see:
- 1 User record
- 1 Creator record (Sun Tzu)
- 1 Chatbot record (Art of War Deep Dive)
- 1 Source record (The Art of War)
- 1 Creator_User link

---

## Step 2: Upload The Art of War File

Since file upload requires Clerk authentication, you'll need to upload via the production UI.

### 2.1 Sign In to Production

1. Go to your production URL: `https://your-app.vercel.app`
2. Sign in with your Clerk account (the same account you used in Step 1.1)

### 2.2 Navigate to Source Upload Page

1. Go to: `https://your-app.vercel.app/dashboard/chatbot_art_of_war`
2. Or navigate to the source upload page (check your app's routing structure)

**Alternative:** If you have a direct upload route, use that. Otherwise, you may need to:
- Create a simple upload page, OR
- Use the API directly with authentication (see Step 2.3)

### 2.3 Upload via API (Alternative Method)

If you prefer to upload programmatically, you can use curl with your Clerk session cookie:

```bash
# First, get your Clerk session cookie from browser DevTools:
# 1. Open production site in browser
# 2. Sign in
# 3. Open DevTools → Application → Cookies
# 4. Copy the value of `__session` cookie

# Then upload:
curl -X POST https://your-app.vercel.app/api/files/upload \
  -H "Cookie: __session=your-session-cookie-here" \
  -F "file=@MVP_Sources/The_Art_of_War.txt" \
  -F "sourceId=source_art_of_war"
```

**Expected Response:**
```json
{
  "fileId": "file_xxxxx",
  "status": "PENDING",
  "message": "File uploaded successfully. Processing will begin shortly."
}
```

**✅ Verification:** 
- Check Vercel Blob Storage - you should see the file at `sources/source_art_of_war/The_Art_of_War.txt`
- Check database - you should see a File record with status `PENDING` or `PROCESSING`

---

## Step 3: Trigger Ingestion (If Not Automatic)

The upload endpoint should automatically trigger ingestion, but if it didn't:

### 3.1 Check File Status

First, check if the file is being processed:

```bash
# Query your production database
# File status should be: PENDING → PROCESSING → READY
```

### 3.2 Manually Trigger Ingestion

If the file is stuck in `PENDING`, manually trigger ingestion:

```bash
# Get fileId from database or upload response
curl -X POST https://your-app.vercel.app/api/ingestion/trigger \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=your-session-cookie-here" \
  -d '{"fileId": "file_xxxxx"}'
```

**Expected Response:**
```json
{
  "message": "Ingestion started",
  "fileId": "file_xxxxx",
  "chunks": 150,
  "status": "PROCESSING"
}
```

**Note:** Ingestion can take several minutes for large files. The Art of War is ~6,777 lines, so expect:
- ~150-200 chunks (at 1000 chars per chunk)
- ~2-5 minutes processing time
- Status will change: `PENDING` → `PROCESSING` → `READY`

---

## Step 4: Verify Everything Works

### 4.1 Check Database Records

Verify all records exist in production database:

```sql
-- Check User
SELECT * FROM "User" WHERE "clerkId" = 'user_xxxxx';

-- Check Creator
SELECT * FROM "Creator" WHERE "id" = 'creator_sun_tzu';

-- Check Chatbot
SELECT * FROM "Chatbot" WHERE "id" = 'chatbot_art_of_war';

-- Check Source
SELECT * FROM "Source" WHERE "id" = 'source_art_of_war';

-- Check File
SELECT * FROM "File" WHERE "sourceId" = 'source_art_of_war';
-- Status should be 'READY'
```

### 4.2 Check Pinecone Index

Verify embeddings are in Pinecone:

```bash
# Check Pinecone dashboard or use Pinecone API
# You should see ~150-200 vectors in the namespace
```

**Pinecone Namespace:** The chatbot uses the namespace from `chatbot.vectorNamespace` or defaults to the chatbot ID.

### 4.3 Test Chat Interface

1. Go to: `https://your-app.vercel.app/chat/chatbot_art_of_war`
2. Send a test message: "What is The Art of War about?"
3. You should get a RAG-powered response with relevant quotes

**✅ Success Indicators:**
- Chat loads without errors
- Messages are sent and received
- Responses include relevant content from The Art of War
- No errors in browser console or Vercel logs

---

## Step 5: Monitor Production

### 5.1 Check Vercel Logs

Monitor ingestion progress:

1. Go to Vercel Dashboard → Your Project → Logs
2. Look for ingestion-related logs
3. Check for any errors during processing

### 5.2 Check Sentry (If Configured)

1. Go to Sentry Dashboard
2. Check for any errors during upload/ingestion
3. Verify error tracking is working

### 5.3 Verify Blob Storage

1. Go to Vercel Dashboard → Storage → Blob
2. Verify file exists: `sources/source_art_of_war/The_Art_of_War.txt`
3. Check file size matches original

---

## Troubleshooting

### Seed Script Fails: "DATABASE_URL not found"

**Solution:** Make sure you've exported `DATABASE_URL` before running seed:
```bash
export DATABASE_URL="your-production-url"
npx prisma db seed
```

### Seed Script Fails: "SEED_USER_CLERK_ID required"

**Solution:** Export your Clerk user ID:
```bash
export SEED_USER_CLERK_ID="user_xxxxx"
export SEED_USER_EMAIL="your@email.com"
```

### Upload Fails: "Unauthorized"

**Solution:** 
- Make sure you're signed in to production
- Check that your Clerk session cookie is valid
- Verify `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are production keys

### Upload Fails: "Source not found"

**Solution:** 
- Verify seed script ran successfully
- Check that `sourceId=source_art_of_war` matches the seeded source ID
- Query database to confirm source exists

### Ingestion Stuck in "PENDING"

**Solution:**
- Check Vercel logs for errors
- Manually trigger ingestion (Step 3.2)
- Verify `NEXT_PUBLIC_URL` is set correctly in Vercel (needed for ingestion trigger)

### Ingestion Fails: "Failed to fetch or extract text"

**Solution:**
- Verify blob file exists in Vercel Blob Storage
- Check file URL is accessible
- Verify `BLOB_READ_WRITE_TOKEN` is set correctly

### Chat Returns No Results

**Solution:**
- Verify file status is `READY` in database
- Check Pinecone index has vectors
- Verify `PINECONE_INDEX` and `PINECONE_API_KEY` are correct
- Check Pinecone namespace matches chatbot configuration

---

## Quick Checklist

Before considering setup complete:

- [ ] Production database seeded (User, Creator, Chatbot, Source)
- [ ] File uploaded to Vercel Blob Storage
- [ ] File record created in database
- [ ] Ingestion completed (status = `READY`)
- [ ] Embeddings stored in Pinecone
- [ ] Chat interface works and returns relevant responses
- [ ] No errors in Vercel logs
- [ ] No errors in Sentry (if configured)

---

## Next Steps

After setup is complete:

1. **Test thoroughly:** Try various questions about The Art of War
2. **Monitor performance:** Check Vercel Analytics for response times
3. **Set up alerts:** Configure Sentry alerts for critical errors
4. **Share with users:** Make the chatbot public (if not already)

---

## Summary

To get The Art of War bot working in production:

1. **Seed database** → Creates User, Creator, Chatbot, Source
2. **Upload file** → Stores file in Vercel Blob, creates File record
3. **Ingest content** → Chunks text, generates embeddings, stores in Pinecone
4. **Test chat** → Verify RAG-powered responses work

Total time: ~10-15 minutes (mostly waiting for ingestion to complete)

---

**Last Updated:** December 2024
