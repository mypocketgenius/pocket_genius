# Pocket Genius

MVP Roadmap: Core Features Implementation

## Phase 1: Foundation (Week 1)

### Task 1: Next.js Project Setup with TypeScript ✅

- Next.js 15 with App Router
- TypeScript configuration
- Tailwind CSS setup
- ESLint configuration
- Basic folder structure

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables

Copy the example environment file and fill in your actual values:
```bash
cp .env.local.example .env.local
```

Then edit `.env.local` and replace the placeholder values with your actual credentials:

- **Database**: Get your Neon Postgres connection string from [Neon Dashboard](https://neon.tech)
- **Clerk**: Get your keys from [Clerk Dashboard](https://dashboard.clerk.com)
- **OpenAI**: Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
- **Pinecone**: Get your API key and index name from [Pinecone Dashboard](https://app.pinecone.io)
  - **Important**: Pinecone Starter plan doesn't support namespaces. If you're on Starter plan, set `PINECONE_USE_NAMESPACES=false` in your `.env.local`
- **Vercel Blob**: Get your token from [Vercel Dashboard](https://vercel.com/dashboard) → Storage → Blob

**Required Environment Variables:**
- `DATABASE_URL` - Neon Postgres connection string
- `DIRECT_URL` - Neon Postgres direct connection (optional)
- `NEXT_PUBLIC_URL` - Your app URL (use `http://localhost:3000` for local dev)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- `CLERK_SECRET_KEY` - Clerk secret key
- `OPENAI_API_KEY` - OpenAI API key
- `PINECONE_API_KEY` - Pinecone API key
- `PINECONE_INDEX` - Pinecone index name
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token

**Seed Script Environment Variables (for development):**
- `SEED_USER_CLERK_ID` - Your Clerk user ID (get from Clerk dashboard → Users → Your User)
- `SEED_USER_EMAIL` - Your email address
- `SEED_USER_FIRST_NAME` - Your first name (optional)
- `SEED_USER_LAST_NAME` - Your last name (optional)

### 3. Set Up Database and Seed Data

First, run database migrations:
```bash
npx prisma migrate dev
```

Then, generate Prisma Client:
```bash
npx prisma generate
```

Finally, seed the database with test data:
```bash
npx prisma db seed
```

**Note:** The seed script requires `SEED_USER_CLERK_ID` and `SEED_USER_EMAIL` in your `.env.local`. 
- Get your Clerk user ID by signing up/logging in via Clerk, then going to Clerk dashboard → Users → Your User
- Copy the user ID (starts with `user_`) and add it to `.env.local`

### 4. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
pocket-genius/
├── app/                        # Next.js App Router
├── components/                 # React components
├── lib/                        # Utilities, helpers
│   ├── prisma.ts              # Prisma singleton
│   ├── env.ts                 # Environment variables
│   ├── pinecone/              # Pinecone utilities
│   ├── openai/                # OpenAI utilities
│   └── ...
├── prisma/                     # Database schema
│   ├── schema.prisma
│   └── seed.ts
├── public/                     # Static assets
├── Planning Docs/              # Project documentation
├── .env.local                 # Environment variables (create from .env.local.example)
├── .gitignore
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Environment Variable Validation

The project uses type-safe environment variables via `lib/env.ts`. This means:
- ✅ Missing or invalid env vars are caught at **build time** (not runtime)
- ✅ TypeScript autocomplete for all environment variables
- ✅ Clear error messages if any required variables are missing

If you see an error about missing environment variables, check that:
1. `.env.local` exists and contains all required variables
2. All placeholder values (`xxxxx`) have been replaced with actual credentials
3. No quotes are needed around values (except for URLs)

## Deployment

For production deployment to Vercel, see **[DEPLOYMENT.md](./DEPLOYMENT.md)** for complete instructions.

**Quick Summary:**
1. Set up production database (Neon)
2. Configure Sentry for error monitoring
3. Deploy to Vercel with environment variables
4. Monitor production logs and errors

See `DEPLOYMENT.md` for detailed steps, troubleshooting, and security checklist.

## Next Steps

- ✅ Task 9: Set up environment variables in `.env.local`
- ✅ Task 2: Install core dependencies (Prisma, Clerk, OpenAI, Pinecone, Vercel Blob)
- ✅ Task 3: Set up Neon Postgres database
- ✅ Task 4: Create simplified Prisma schema
- ✅ Phase 6 Task 5: Deploy to Vercel with monitoring

