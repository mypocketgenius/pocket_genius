# Working with UTS Firewall

**Goal:** Use port 443 (HTTPS/WebSocket) for app runtime whenever possible, and only switch to hotspot/VPN when migrations require port 5432.

## Quick Summary

- ✅ **App runtime** (`npm run dev`, API routes, database queries): Works on UTS WiFi using port 443
- ❌ **Migrations** (`npm run build`, `prisma migrate`): Requires port 5432 → use hotspot/VPN
- ✅ **Best of both worlds:** Develop on UTS WiFi, build on hotspot

---

## Understanding the Problem

UTS WiFi blocks outbound connections to port **5432** (PostgreSQL's default port). This means:
- ❌ Direct PostgreSQL connections fail
- ✅ HTTPS/WebSocket (port 443) works fine
- ✅ DNS resolution works fine

**Solution:** Use Neon's serverless driver for app runtime (port 443), but migrations still need port 5432.

---

## Step 1: Install Required Packages

Install the Neon serverless driver and Prisma adapter:

```bash
npm install @neondatabase/serverless @prisma/adapter-neon ws
npm install -D @types/ws
```

**Why these packages:**
- `@neondatabase/serverless`: Neon's driver that uses HTTP/WebSocket instead of TCP
- `@prisma/adapter-neon`: Prisma adapter to use Neon's serverless driver
- `ws`: WebSocket library for Node.js environments

---

## Step 2: Update Your Prisma Client Configuration

Update `lib/prisma.ts` to use the Neon serverless adapter:

```typescript
// lib/prisma.ts
// Prisma Client singleton
// Prevents multiple instances in development (hot reload)

// Load environment variables FIRST (before importing PrismaClient)
if (!process.env.DATABASE_URL) {
  try {
    const dotenv = require('dotenv');
    const path = require('path');
    dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
    if (!process.env.DATABASE_URL) {
      dotenv.config({ path: path.resolve(process.cwd(), '.env') });
    }
  } catch (e) {
    // dotenv not available, assume env vars are set externally
  }
}

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Configure Neon serverless driver to use WebSocket in Node.js
// This allows connections over port 443 (HTTPS/WebSocket) instead of 5432
neonConfig.webSocketConstructor = ws;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not set in environment variables.\n' +
      'Please ensure .env.local contains DATABASE_URL or set it in your environment.'
  );
}

// Use Neon serverless adapter for Prisma Client
// This enables connections over HTTP/WebSocket (port 443) instead of TCP (port 5432)
const adapter = new PrismaNeon({ connectionString: databaseUrl });

// Prisma Client with Neon adapter - works over port 443!
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

**What changed:**
- Replaced `@prisma/adapter-pg` with `@prisma/adapter-neon`
- Added WebSocket configuration for Node.js
- Prisma Client now uses HTTP/WebSocket (port 443) instead of TCP (port 5432)

---

## Step 3: Update Environment Variables

Your `.env.local` should have:

```bash
# Use pooled connection for app runtime (works with serverless driver over 443)
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.c-2.us-east-1.aws.neon.tech:5432/dbname?sslmode=require

# Optional: Direct URL for migrations (only needed if you want to specify it explicitly)
# DIRECT_URL=postgresql://user:pass@ep-xxx.c-2.us-east-1.aws.neon.tech:5432/dbname?sslmode=require
```

**Note:** The `DATABASE_URL` can still have `:5432` in it - the serverless driver will automatically use HTTP/WebSocket instead of TCP.

---

## Step 4: Update Prisma Config (Optional but Recommended)

Update `prisma.config.ts` to ensure migrations use the correct connection:

```typescript
// prisma.config.ts
import 'dotenv/config';
import { resolve } from 'path';
import { defineConfig, env } from 'prisma/config';

// Load .env.local first (Next.js convention), then fall back to .env
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx dotenv-cli -e .env.local -- npx tsx prisma/seed.ts',
  },
  // In Prisma 7, datasource URL must be configured here
  // Migrations will use this URL (requires port 5432 access)
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

---

## Step 5: Day-to-Day Workflow

### ✅ On UTS WiFi (Port 443 Works)

**These commands work without hotspot:**

```bash
# Start development server
npm run dev

# Run tests
npm test

# Use Prisma Studio (if it can connect)
npx prisma studio
```

**What works:**
- ✅ All API routes making database queries
- ✅ All Prisma Client operations in your app
- ✅ Development server
- ✅ Testing

**What doesn't work:**
- ❌ `npm run build` (runs migrations which need port 5432)
- ❌ `npx prisma migrate dev`
- ❌ `npx prisma migrate deploy`
- ❌ `npx prisma db push`

### 🔥 On Hotspot/VPN (Port 5432 Required)

**Switch to hotspot/VPN for these commands:**

```bash
# Build the app (runs migrations)
npm run build

# Run migrations manually
npx prisma migrate dev
npx prisma migrate deploy

# Push schema changes
npx prisma db push

# Generate Prisma Client (if schema changed)
npx prisma generate
```

**When to use hotspot:**
- Before deploying (build runs migrations)
- When creating new migrations
- When updating database schema
- When running seed scripts that need migrations

---

## Step 6: Update Build Script (Optional Enhancement)

You can make the build script smarter to detect network restrictions:

```typescript
// scripts/check-and-migrate.ts (already exists, but you can enhance it)
// The existing script will detect connection errors and provide guidance
// Migrations will fail on UTS WiFi, but the error message will guide you
```

The existing `check-and-migrate.ts` script already handles this - it will detect when port 5432 is blocked and provide helpful error messages.

---

## Step 7: Verify It Works

### Test on UTS WiFi:

1. **Start dev server:**
   ```bash
   npm run dev
   ```
   Should start successfully ✅

2. **Test a database query:**
   - Navigate to a page that queries the database
   - Should work without errors ✅

3. **Try building (will fail, but that's expected):**
   ```bash
   npm run build
   ```
   Will fail with connection error ❌ (expected - needs hotspot)

### Test on Hotspot:

1. **Switch to hotspot**

2. **Run build:**
   ```bash
   npm run build
   ```
   Should succeed ✅

---

## Common Issues & Solutions

### Issue: "bufferUtil.mask is not a function"

**Solution:** Install `bufferutil`:
```bash
npm install -D bufferutil
```

### Issue: WebSocket connection fails

**Solution:** Ensure `ws` is installed and configured:
```bash
npm install ws @types/ws
```

Make sure `neonConfig.webSocketConstructor = ws;` is set in `lib/prisma.ts`.

### Issue: Migrations still fail on UTS WiFi

**Expected behavior:** Migrations require port 5432 and will fail on UTS WiFi. Use hotspot/VPN for migrations.

### Issue: "Cannot find module '@prisma/adapter-neon'"

**Solution:** Make sure you installed it:
```bash
npm install @prisma/adapter-neon @neondatabase/serverless ws
```

---

## Recommended Workflow

### Daily Development (On UTS WiFi):

1. ✅ Code changes
2. ✅ Run `npm run dev` - works on UTS WiFi
3. ✅ Test features - works on UTS WiFi
4. ✅ Commit changes

### Before Deploying (Switch to Hotspot):

1. 🔥 Switch to hotspot/VPN
2. 🔥 Run `npm run build` - migrations run successfully
3. 🔥 Test build locally
4. 🔥 Deploy to production

### Alternative: Use CI/CD

Set up GitHub Actions or Vercel to handle builds:
- Push code to GitHub
- CI/CD runs migrations and builds (has port 5432 access)
- Deploy automatically

See `NETWORK_CONNECTION_TROUBLESHOOTING.md` for CI/CD setup instructions.

---

## What Changed vs. Before

**Before:**
- All database operations required port 5432
- Nothing worked on UTS WiFi
- Had to use hotspot/VPN for everything

**After:**
- App runtime uses port 443 (works on UTS WiFi)
- Migrations still need port 5432 (use hotspot/VPN)
- Best of both worlds: develop on WiFi, build on hotspot

---

## Summary Checklist

- [ ] Install packages: `@neondatabase/serverless @prisma/adapter-neon ws @types/ws`
- [ ] Update `lib/prisma.ts` to use `PrismaNeon` adapter
- [ ] Configure WebSocket: `neonConfig.webSocketConstructor = ws`
- [ ] Test `npm run dev` on UTS WiFi - should work ✅
- [ ] Test `npm run build` on hotspot - should work ✅
- [ ] Update workflow: develop on WiFi, build on hotspot

---

## Need Help?

- Run diagnostic: `npm run test:db-connection`
- See troubleshooting: `NETWORK_CONNECTION_TROUBLESHOOTING.md`
- Check Prisma docs: https://www.prisma.io/docs/guides/database/neon
- Check Neon docs: https://neon.tech/docs/guides/prisma

---

**Last Updated:** Based on Prisma 7 and Neon serverless driver setup

