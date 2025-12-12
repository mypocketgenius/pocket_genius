# Deployment Guide: Pocket Genius MVP

This guide covers deploying Pocket Genius to Vercel with production database, environment variables, and error monitoring.

---

## Prerequisites

Before deploying, ensure you have:

- ✅ [ ] Vercel account ([sign up](https://vercel.com))
- ✅ [ ] Neon project with production branch (or create new project)
- ✅ [ ] Sentry account for error monitoring ([sign up](https://sentry.io))
- ✅ [ ] All API keys ready (OpenAI, Pinecone, Clerk, Vercel Blob)

---

## Recommended Order of Operations

**Do these steps in order for smoother deployment:**

1. **Get Neon production branch connection string** (Step 1.1) - Quick, just copy it
2. **Create Sentry project and get DSN** (Step 2) - Takes 5 minutes
3. **Create Vercel project** (Step 3.1) - Connect your GitHub repo
4. **Add all environment variables** (Step 3.3) - Paste everything at once
5. **Deploy** (Step 3.5) - Let Vercel build and deploy

---

## Step 1: Get Production Database Connection String

### 1.1 Get Production Branch Connection String

**If you already have a Neon project with a production branch:**

1. Go to [Neon Dashboard](https://console.neon.tech)
2. Select your existing project
3. Switch to the **production** branch (or create one if needed)
4. Click **Connection Details** or find the connection string
5. Copy the **production branch connection string** - save it somewhere, you'll need it for Vercel
   - It looks like: `postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require`
6. **Also copy DIRECT_URL** if available (same connection string, used for migrations)

**Understanding Neon Branches:**
- **Development branch**: Use for local development (`.env.local`)
- **Production branch**: Use for Vercel deployment (environment variables)
- Branches are isolated databases - changes to one don't affect the other
- You can have multiple branches in the same Neon project

**Note:** You don't need to create a new Neon project. The production branch in your existing project is perfect for production deployment.

### 1.2 Run Production Migrations

**Option A: Via Vercel (Recommended)**
- Vercel will automatically run migrations during deployment if you configure `prisma` in `package.json`
- Ensure `prisma` seed script is configured (already done)
- **Important**: Make sure your production branch connection string is set in Vercel environment variables

**Option B: Manual Migration (Before First Deployment)**
```bash
# Set production DATABASE_URL (use your production branch connection string)
export DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/pocket-genius-prod?sslmode=require"

# Run migrations on production branch
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

**Which Option to Choose:**
- **Use Option A** if you trust Vercel to run migrations automatically (simpler)
- **Use Option B** if you want to verify migrations work before deploying (more control)

---

## Step 2: Configure Sentry (Error Monitoring)

### 2.1 Create Sentry Project

1. Go to [Sentry Dashboard](https://sentry.io)
2. Create a new project:
   - Platform: **Next.js**
   - Project name: `pocket-genius`
3. Copy your **DSN** (Data Source Name) - looks like: `https://xxx@xxx.ingest.sentry.io/xxx`

### 2.2 Get Sentry Auth Token (for Source Maps)

1. Go to Sentry → Settings → Account → API → Auth Tokens
2. Create a new token with scopes:
   - `project:releases`
   - `org:read`
3. Copy the token (you'll add this to Vercel)

### 2.3 Note Your Sentry Org and Project

- **Org**: Found in Sentry URL: `https://sentry.io/organizations/YOUR_ORG/`
- **Project**: The project slug you created (e.g., `pocket-genius`)

---

## Step 3: Deploy to Vercel

### 3.1 Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New Project**
3. Import your GitHub repository
4. Vercel will auto-detect Next.js

### 3.2 Configure Build Settings

Vercel should auto-detect these, but verify:

- **Framework Preset**: Next.js
- **Build Command**: `npm run build` (default)
- **Output Directory**: `.next` (default)
- **Install Command**: `npm install` (default)

### 3.3 Add Environment Variables

Add **all** of these in Vercel → Project → Settings → Environment Variables:

#### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/pocket-genius-prod?sslmode=require
DIRECT_URL=postgresql://user:pass@ep-xxx.neon.tech/pocket-genius-prod?sslmode=require

# App URL (your Vercel domain)
NEXT_PUBLIC_URL=https://your-app.vercel.app
NODE_ENV=production

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
CLERK_SECRET_KEY=sk_live_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx

# OpenAI
OPENAI_API_KEY=sk-xxxxx

# Pinecone
PINECONE_API_KEY=xxxxx
PINECONE_INDEX=pocket-genius-prod

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_xxxxx

# Sentry (Error Monitoring)
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=pocket-genius
SENTRY_AUTH_TOKEN=your-auth-token-here
```

#### Environment-Specific Variables

**For Production:**
- Set all variables above with `Production` environment selected

**For Preview (optional):**
- Copy production variables but use a separate database/staging keys
- Set `NODE_ENV=production` (still use production mode for previews)

**For Development:**
- These are only used locally (`.env.local`)

### 3.4 Configure Prisma Build

Vercel needs to generate Prisma Client during build. Ensure `package.json` has:

```json
{
  "prisma": {
    "seed": "npx dotenv-cli -e .env.local -- npx tsx prisma/seed.ts"
  },
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

**Note:** The `postinstall` script ensures Prisma Client is generated after `npm install` on Vercel.

### 3.5 Deploy

1. Click **Deploy**
2. Wait for build to complete
3. Check build logs for any errors

---

## Step 4: Post-Deployment Setup

### 4.1 Seed Production Database (Optional)

If you need initial data in production:

```bash
# Set production DATABASE_URL locally
export DATABASE_URL="your-production-database-url"

# Run seed
npx prisma db seed
```

**⚠️ Warning:** Only seed production if you need test data. Real users will create their own data.

### 4.2 Verify Deployment

1. **Check App URL**: Visit `https://your-app.vercel.app`
2. **Test Authentication**: Sign in with Clerk
3. **Test Chat**: Send a test message
4. **Check Sentry**: Trigger a test error to verify monitoring works

### 4.3 Set Up Custom Domain (Optional)

1. Go to Vercel → Project → Settings → Domains
2. Add your domain (e.g., `pocketgenius.ai`)
3. Configure DNS records as instructed
4. Update `NEXT_PUBLIC_URL` environment variable to your custom domain

---

## Step 5: Monitor Production

### 5.1 Vercel Monitoring

- **Logs**: Vercel Dashboard → Project → Logs
- **Analytics**: Vercel Dashboard → Project → Analytics
- **Functions**: Monitor API route performance

### 5.2 Sentry Monitoring

- **Errors**: Sentry Dashboard → Issues
- **Performance**: Sentry Dashboard → Performance
- **Releases**: Track deployments automatically

### 5.3 Database Monitoring

- **Neon Dashboard**: Monitor query performance, connections
- **Set up alerts**: For high connection counts or slow queries

---

## Troubleshooting

### Build Fails: Prisma Client Not Generated

**Solution:** Add `postinstall` script to `package.json`:
```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

### Build Fails: Environment Variables Missing

**Solution:** 
- Check Vercel → Settings → Environment Variables
- Ensure all required variables are set for `Production` environment
- Rebuild after adding variables

### Runtime Error: Database Connection Failed

**Solution:**
- Verify `DATABASE_URL` is correct in Vercel
- Check Neon dashboard for connection limits
- Ensure database is not paused (Neon free tier pauses after inactivity)

### Sentry Not Capturing Errors

**Solution:**
- Verify `SENTRY_DSN` is set in Vercel
- Check Sentry dashboard for project status
- Test with: `throw new Error('Test error')` in an API route

### Clerk Authentication Not Working

**Solution:**
- Verify Clerk keys are correct (production keys, not test)
- Check Clerk dashboard → Applications → Your App → URLs
- Ensure `NEXT_PUBLIC_URL` matches your Vercel domain

---

## Environment Variables Reference

### Required for Production

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `DATABASE_URL` | Neon Postgres connection string | Neon Dashboard |
| `NEXT_PUBLIC_URL` | Your app URL | Vercel domain |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Clerk Dashboard |
| `CLERK_SECRET_KEY` | Clerk secret key | Clerk Dashboard |
| `OPENAI_API_KEY` | OpenAI API key | OpenAI Platform |
| `PINECONE_API_KEY` | Pinecone API key | Pinecone Dashboard |
| `PINECONE_INDEX` | Pinecone index name | Pinecone Dashboard |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token | Vercel Dashboard |

### Optional (Recommended)

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `SENTRY_DSN` | Sentry error monitoring DSN | Sentry Dashboard |
| `SENTRY_ORG` | Sentry organization slug | Sentry Dashboard |
| `SENTRY_PROJECT` | Sentry project slug | Sentry Dashboard |
| `SENTRY_AUTH_TOKEN` | Sentry auth token (for source maps) | Sentry Settings → API |
| `DIRECT_URL` | Direct database connection (for migrations) | Neon Dashboard |

---

## Next Steps After Deployment

1. ✅ **Monitor Errors**: Check Sentry dashboard daily
2. ✅ **Review Logs**: Check Vercel logs for API errors
3. ✅ **Test Core Features**: Verify chat, feedback, dashboard work
4. ✅ **Set Up Alerts**: Configure Sentry email alerts for critical errors
5. ✅ **Performance Monitoring**: Review Vercel Analytics for slow pages

---

## Security Checklist

- ✅ [ ] All environment variables are set in Vercel (not committed to git)
- ✅ [ ] Production database uses strong password
- ✅ [ ] Clerk webhook secret is configured
- ✅ [ ] API keys are production keys (not test keys)
- ✅ [ ] Sentry DSN is set (errors are monitored)
- ✅ [ ] Custom domain has SSL (automatic with Vercel)

---

## Support

- **Vercel Docs**: https://vercel.com/docs
- **Sentry Next.js Docs**: https://docs.sentry.io/platforms/javascript/guides/nextjs
- **Neon Docs**: https://neon.tech/docs
- **Project Issues**: Check GitHub issues or create new one

---

**Last Updated:** December 2024
