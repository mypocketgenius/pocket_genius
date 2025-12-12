# Phase 5 Test Suite

This directory contains comprehensive tests for Phase 5: Simple Dashboard implementation.

## Test Coverage

### API Route Tests (`api/dashboard/chunks/route.test.ts`)
Tests for the dashboard chunks API endpoint (`/api/dashboard/[chatbotId]/chunks`):

- ✅ **Authentication & Authorization**
  - Unauthenticated user (401)
  - Chatbot not found (404)
  - Unauthorized access (403)
  - Ownership verification

- ✅ **Query Parameter Validation**
  - Invalid page number
  - Invalid page size
  - Invalid sortBy
  - Invalid order
  - Default values

- ✅ **Pagination**
  - Correct skip/take calculation
  - Total pages calculation
  - Page boundaries

- ✅ **Sorting**
  - Sort by timesUsed (asc/desc)
  - Sort by satisfactionRate (asc/desc)
  - Default sorting

- ✅ **Filtering**
  - Filter by chatbotId, month, year
  - Filter by minTimesUsed
  - Include chunks with feedback

- ✅ **Chunk Text Caching (Phase 5, Task 5)**
  - Fetch text from Pinecone when fetchText=true
  - Skip fetch when chunkText is cached
  - Handle Pinecone errors gracefully
  - Update multiple chunks

- ✅ **Response Format**
  - Correct data structure
  - Pagination metadata

- ✅ **Error Handling**
  - Database errors
  - Unexpected errors

### Authentication Utility Tests (`lib/auth/chatbot-ownership.test.ts`)
Tests for the `verifyChatbotOwnership` function:

- ✅ **Successful Verification**
  - Authorized user access

- ✅ **Authentication Errors**
  - Unauthenticated user
  - User not found in database

- ✅ **Authorization Errors**
  - Chatbot not found
  - User not a member of creator
  - Edge cases

### Dashboard Page Tests (`app/dashboard/page.test.tsx`)
Tests for the dashboard page component:

- ✅ **Successful Rendering**
  - Authorized access

- ✅ **Authentication Errors**
  - Redirect on unauthenticated
  - Redirect on user not found

- ✅ **Authorization Errors**
  - Chatbot not found message
  - Access denied message

- ✅ **Error Handling**
  - Unexpected errors

### Dashboard Content Component Tests (`components/dashboard-content.test.tsx`)
Tests for the dashboard content React component:

- ✅ **Initial Load**
  - Loading skeleton display
  - Default fetch parameters
  - Chatbot title display

- ✅ **Data Display**
  - Chunk data rendering
  - Metadata badges
  - Empty state
  - Missing chunk text handling

- ✅ **Sorting**
  - Change sort field
  - Toggle order
  - Reset to page 1 on sort change

- ✅ **Pagination**
  - Pagination controls display
  - Next/Previous navigation
  - Button disabled states
  - Hide pagination when not needed

- ✅ **Chunk Text Caching (Phase 5, Task 5)**
  - Fetch text on initial load
  - Skip fetch on subsequent loads
  - Reset when chatbotId changes

- ✅ **Error Handling**
  - API error display
  - Network error handling
  - Authentication error handling

- ✅ **Date Formatting**
  - Correct date display

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Structure

```
__tests__/
├── api/
│   └── dashboard/
│       └── chunks/
│           └── route.test.ts          # API route tests
├── app/
│   └── dashboard/
│       └── page.test.tsx              # Page component tests
├── components/
│   └── dashboard-content.test.tsx    # React component tests
├── lib/
│   └── auth/
│       └── chatbot-ownership.test.ts  # Utility function tests
└── README.md                          # This file
```

## Phase 5 Requirements Coverage

All Phase 5 requirements are covered by these tests:

1. ✅ **Dashboard page** (`app/dashboard/[chatbotId]/page.tsx`)
   - Tested in `app/dashboard/page.test.tsx`

2. ✅ **Chunk usage list component**
   - Show chunks sorted by timesUsed or satisfactionRate → Tested
   - Display chunk text (use cached chunkText, fetch from Pinecone if missing) → Tested
   - Show helpfulCount vs notHelpfulCount → Tested
   - Display satisfactionRate (pre-computed) → Tested
   - Pagination (20 per page) → Tested
   - Tested in `components/dashboard-content.test.tsx`

3. ✅ **Basic authentication check** (creator owns chatbot)
   - Tested in `lib/auth/chatbot-ownership.test.ts`
   - Tested in `api/dashboard/chunks/route.test.ts`
   - Tested in `app/dashboard/page.test.tsx`

4. ✅ **Simple UI with shadcn/ui components**
   - Component rendering tested in `components/dashboard-content.test.tsx`

5. ✅ **Cache chunk text on first dashboard view** (populate chunkText from Pinecone)
   - Tested in `api/dashboard/chunks/route.test.ts`
   - Tested in `components/dashboard-content.test.tsx`

## Notes

- Tests use Jest with TypeScript support (`ts-jest`)
- Mocking is used for external dependencies (Prisma, Clerk, Pinecone)
- Component tests use React Testing Library
- API route tests mock Next.js Request/Response objects
- All tests follow the MVP testing strategy from the roadmap

## Future Enhancements

For post-MVP, consider adding:
- E2E tests with Playwright/Cypress
- Visual regression tests
- Performance benchmarks
- Integration tests with real database (test environment)
