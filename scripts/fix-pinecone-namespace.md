# Fix: Pinecone Namespace Issue

## Problem
Pinecone Starter plan doesn't support namespaces. When you upsert vectors to a namespace on Starter plan, they may succeed silently but not actually be stored.

## Solution

### Option 1: Use Default Namespace (Recommended for Starter Plan)

Add this to your `.env.local`:
```env
PINECONE_USE_NAMESPACES=false
```

Then re-run ingestion:
1. Set file status back to PENDING:
   ```sql
   UPDATE "File" SET status = 'PENDING' WHERE id = 'your-file-id';
   ```

2. Re-trigger ingestion via API or test page

### Option 2: Upgrade Pinecone Plan

Upgrade to a Pinecone plan that supports namespaces (Standard or higher).

## Verification

After re-ingesting, run:
```bash
npx tsx scripts/check-ingestion.ts
```

You should see vectors in Pinecone (either in the namespace or default namespace depending on your plan).
