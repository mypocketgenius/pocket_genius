#!/bin/bash
# Wrapper script for prisma migrate dev that fixes checksums before running
# Usage: ./scripts/migrate-dev.sh --name migration_name

set -e

echo "🔍 Checking for migration checksum issues..."

# Fix checksums if needed
npx tsx scripts/fix-migration-checksums.ts

# Run the actual migration
echo ""
echo "🚀 Running prisma migrate dev..."
npx prisma migrate dev "$@"

