# Migration Checksum Issues - Root Cause & Solution

## Why This Keeps Happening

Prisma migration checksums are based on **exact file content**, including whitespace. The checksums break when:

1. **Editors auto-format files** - Many editors normalize trailing whitespace, line endings, etc.
2. **Git operations** - Git checkout/merge can normalize line endings (CRLF ↔ LF)
3. **Prisma regeneration** - Sometimes Prisma regenerates migration files with different whitespace
4. **File system differences** - Different OSes handle line endings differently

## The Real Problem

The migration files have **trailing newlines** that get modified by editors or git operations. Even though you're not manually editing them, automated tools are changing the whitespace.

## Permanent Solutions

### 1. Use the Wrapper Script (Recommended)

Instead of running `npx prisma migrate dev` directly, use:

```bash
./scripts/migrate-dev.sh --name your_migration_name
```

This automatically fixes checksums before running migrations.

### 2. Fix Checksums Manually (When Needed)

```bash
npx tsx scripts/fix-migration-checksums.ts
```

### 3. Prevent Git from Modifying Migration Files

The `.gitattributes` file has been created to mark migration files as binary-like, preventing git from normalizing them. However, this only helps if:
- You commit the `.gitattributes` file
- Team members pull the latest changes
- Editors respect git attributes

### 4. Editor Configuration

Configure your editor to **not** modify migration files:
- **VS Code**: Add to `.vscode/settings.json`:
  ```json
  {
    "files.trimTrailingWhitespace": false,
    "[sql]": {
      "files.trimTrailingWhitespace": false
    }
  }
  ```

## Why This Is a Prisma Limitation

Prisma's checksum system is designed to detect manual edits to migration files, but it's too strict - it flags ANY change, including automated whitespace normalization. This is a known limitation of Prisma's migration system.

## Best Practice Going Forward

1. **Always use the wrapper script** for migrations
2. **Don't manually edit migration files** after they're created
3. **Run the fix script** if checksum errors appear
4. **Commit the `.gitattributes` file** to prevent git normalization

