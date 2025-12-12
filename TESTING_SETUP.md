# Phase 5 Testing Setup Guide

## Overview

This document provides instructions for setting up and running the Phase 5 test suite.

## Prerequisites

The following dependencies need to be installed for running tests:

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

## Installation

1. **Install testing dependencies** (if not already installed):
   ```bash
   npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
   ```

2. **Verify Jest configuration**:
   - `jest.config.js` - Main Jest configuration
   - `jest.setup.js` - Global test setup

3. **Run tests**:
   ```bash
   npm test
   ```

## Test Files Created

### 1. API Route Tests
**File:** `__tests__/api/dashboard/chunks/route.test.ts`

**Coverage:**
- Authentication & authorization (401, 403, 404)
- Query parameter validation
- Pagination logic
- Sorting (timesUsed, satisfactionRate)
- Filtering (chatbotId, month, year, minTimesUsed)
- Chunk text caching from Pinecone
- Error handling

**Run specific test:**
```bash
npm test -- __tests__/api/dashboard/chunks/route.test.ts
```

### 2. Authentication Utility Tests
**File:** `__tests__/lib/auth/chatbot-ownership.test.ts`

**Coverage:**
- Successful ownership verification
- Authentication errors (unauthenticated, user not found)
- Authorization errors (chatbot not found, unauthorized access)
- Edge cases

**Run specific test:**
```bash
npm test -- __tests__/lib/auth/chatbot-ownership.test.ts
```

### 3. Dashboard Page Tests
**File:** `__tests__/app/dashboard/page.test.tsx`

**Coverage:**
- Successful rendering
- Authentication redirects
- Error message display
- Error handling

**Run specific test:**
```bash
npm test -- __tests__/app/dashboard/page.test.tsx
```

### 4. Dashboard Content Component Tests
**File:** `__tests__/components/dashboard-content.test.tsx`

**Coverage:**
- Initial load and loading states
- Data display (chunks, metadata, stats)
- Sorting functionality
- Pagination controls
- Chunk text caching behavior
- Error handling
- Date formatting

**Run specific test:**
```bash
npm test -- __tests__/components/dashboard-content.test.tsx
```

## Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- <path-to-test-file>

# Run tests matching a pattern
npm test -- --testNamePattern="authentication"
```

## Coverage Goals

Based on the MVP roadmap, Phase 5 tests aim for:
- **API Route Tests**: 80%+ coverage
- **Utility Function Tests**: 90%+ coverage
- **Component Tests**: 70%+ coverage (UI interactions)

## Mocking Strategy

Tests use mocks for:
- **Prisma Client** - Database operations
- **Clerk Auth** - Authentication
- **Pinecone** - Vector database
- **Next.js** - Router and navigation
- **Fetch API** - HTTP requests

## Environment Variables

Tests use mock environment variables defined in `jest.setup.js`. No real API keys or database connections are required.

## Troubleshooting

### Issue: Tests fail with "Cannot find module"
**Solution:** Ensure all dependencies are installed:
```bash
npm install
```

### Issue: TypeScript errors in tests
**Solution:** Verify `tsconfig.json` includes test files and Jest types are configured.

### Issue: React component tests fail
**Solution:** Ensure `@testing-library/react` and `@testing-library/jest-dom` are installed and imported.

### Issue: Mock functions not working
**Solution:** Clear Jest mocks between tests using `jest.clearAllMocks()` in `beforeEach`.

## Next Steps

After running tests:
1. Review coverage report: `npm run test:coverage`
2. Fix any failing tests
3. Add additional edge case tests as needed
4. Consider E2E tests for complete user flows (post-MVP)

## References

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/react)
- [Next.js Testing Guide](https://nextjs.org/docs/testing)
