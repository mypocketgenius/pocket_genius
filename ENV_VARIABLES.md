# Environment Variables Reference

Complete reference for all environment variables used in Pocket Genius.

---

## Required Variables (Production)

### Database
```bash
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/pocket-genius-prod?sslmode=require
DIRECT_URL=postgresql://user:pass@ep-xxx.neon.tech/pocket-genius-prod?sslmode=require
```
- **Source**: Neon Dashboard → Project → Connection String
- **Purpose**: Database connection for Prisma
- **Note**: `DIRECT_URL` is optional but recommended for migrations

### Application
```bash
NEXT_PUBLIC_URL=https://your-app.vercel.app
NODE_ENV=production
```
- **NEXT_PUBLIC_URL**: Your production domain (Vercel URL or custom domain)
- **NODE_ENV**: Set to `production` for production deployments

### Authentication (Clerk)
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
CLERK_SECRET_KEY=sk_live_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx
```
- **Source**: Clerk Dashboard → Applications → Your App → API Keys
- **Note**: Use **production** keys (`pk_live_`, `sk_live_`) for production
- **CLERK_WEBHOOK_SECRET**: Optional, only needed if using Clerk webhooks

### AI Services
```bash
OPENAI_API_KEY=sk-xxxxx
PINECONE_API_KEY=xxxxx
PINECONE_INDEX=pocket-genius-prod
```
- **OPENAI_API_KEY**: From [OpenAI Platform](https://platform.openai.com/api-keys)
- **PINECONE_API_KEY**: From [Pinecone Dashboard](https://app.pinecone.io)
- **PINECONE_INDEX**: Your Pinecone index name (create separate index for production)

### Storage
```bash
BLOB_READ_WRITE_TOKEN=vercel_blob_xxxxx
```
- **Source**: Vercel Dashboard → Storage → Blob → Create Token

---

## Optional Variables (Recommended)

### Error Monitoring (Sentry)
```bash
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=pocket-genius
SENTRY_AUTH_TOKEN=your-auth-token-here
SENTRY_RELEASE=1.0.0
```
- **Source**: Sentry Dashboard → Settings
- **SENTRY_DSN**: Required for server-side error tracking
- **NEXT_PUBLIC_SENTRY_DSN**: Required for client-side error tracking (same value as SENTRY_DSN)
- **SENTRY_ORG/PROJECT**: Required for source maps upload
- **SENTRY_AUTH_TOKEN**: Required for source maps (create in Sentry → Settings → API)
- **SENTRY_RELEASE**: Optional, auto-set by Vercel if using Sentry integration

---

## Development-Only Variables

These are only needed for local development (`.env.local`):

```bash
# Seed Script (Local Development Only)
SEED_USER_CLERK_ID=user_xxxxx
SEED_USER_EMAIL=your@email.com
SEED_USER_FIRST_NAME=Your
SEED_USER_LAST_NAME=Name

# Sentry Development (Optional)
SENTRY_ENABLE_DEV=true  # Set to enable Sentry in development
```

---

## Environment Variable Setup by Environment

### Local Development (`.env.local`)
- Copy all **Required Variables** above
- Use **test** Clerk keys (`pk_test_`, `sk_test_`)
- Use **development** database (separate from production)
- Set `NODE_ENV=development`
- Set `NEXT_PUBLIC_URL=http://localhost:3000`
- Add development-only variables (seed script, etc.)

### Production (Vercel Environment Variables)
- Copy all **Required Variables** above
- Use **production** Clerk keys (`pk_live_`, `sk_live_`)
- Use **production** database
- Set `NODE_ENV=production`
- Set `NEXT_PUBLIC_URL` to your production domain
- Add Sentry variables for error monitoring

### Preview/Staging (Vercel Preview Environment)
- Same as production, but can use separate:
  - Database (staging database)
  - Clerk keys (test keys are fine)
  - Pinecone index (staging index)

---

## Validation

Environment variables are validated at build time via `lib/env.ts`:

- ✅ Missing variables throw clear errors
- ✅ Invalid formats (e.g., invalid URLs) are caught
- ✅ TypeScript autocomplete for all variables

**If build fails with env var errors:**
1. Check `.env.local` (local) or Vercel Settings (production)
2. Ensure all required variables are set
3. Verify variable formats (URLs must be valid, strings must not be empty)

---

## Security Notes

- ⚠️ **Never commit** `.env.local` to git (already in `.gitignore`)
- ⚠️ **Never share** API keys or secrets
- ⚠️ **Use production keys** only in production environment
- ⚠️ **Rotate keys** if accidentally exposed
- ✅ **Use Vercel Environment Variables** for production (not hardcoded)
- ✅ **Use different databases** for development and production

---

## Quick Checklist

Before deploying to production, ensure:

- [ ] All required variables are set in Vercel
- [ ] Production database URL is correct
- [ ] Production Clerk keys are used (not test keys)
- [ ] `NEXT_PUBLIC_URL` matches your production domain
- [ ] Sentry DSN is configured (for error monitoring)
- [ ] All API keys are valid and have sufficient credits/quota

---

**See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.**
