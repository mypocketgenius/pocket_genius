# Testing Guide - Phase 3 Task 1

This guide explains how to test Phase 3 Task 1 implementation to ensure all requirements are met.

## Quick Start

### Run Comprehensive End-to-End Test

```bash
npm run test:phase3
```

This runs a comprehensive test suite that validates:
- ✅ Chat API responds correctly
- ✅ Streaming responses work
- ✅ Messages stored with context chunks
- ✅ Source IDs extracted and stored
- ✅ Conversation messageCount updated
- ✅ Chunk performance tracked
- ✅ Rate limit headers present
- ✅ Conversation ID in headers

### Run Unit Tests

```bash
npm test
```

This runs Jest unit tests for:
- Rate limiting utility (`lib/rate-limit.ts`)
- RAG query utility (`lib/rag/query.ts`)

### Run Integration Tests

```bash
npm test -- __tests__/api/chat/route.test.ts
```

This tests the chat API route with mocked dependencies.

## Test Coverage

### Unit Tests

**`__tests__/lib/rate-limit.test.ts`**
- ✅ Rate limit checking (under/at/over limit)
- ✅ Anonymous user handling
- ✅ Error handling (fail open)
- ✅ Remaining messages calculation

**`__tests__/lib/rag/query.test.ts`**
- ✅ Pinecone query with correct parameters
- ✅ Empty query validation
- ✅ Error handling
- ✅ Default and custom topK
- ✅ Optional metadata fields

### Integration Tests

**`__tests__/api/chat/route.test.ts`**
- ✅ Conversation creation
- ✅ Rate limiting enforcement
- ✅ Message storage with context
- ✅ Chunk performance tracking
- ✅ Error handling (404, 400, 429)
- ✅ Source IDs extraction

### End-to-End Tests

**`scripts/test-phase3-task1.ts`**
- ✅ Full API flow with real database
- ✅ Streaming response validation
- ✅ Database state verification
- ✅ Header validation

## Manual Testing Checklist

### 1. Basic Chat Flow
- [ ] Send message and receive streaming response
- [ ] Response is relevant to question
- [ ] Can have multi-turn conversation (use conversationId)

### 2. Rate Limiting
- [ ] Send 10 messages rapidly (should work)
- [ ] Send 11th message within 1 minute (should get 429)
- [ ] Check rate limit headers in response

### 3. Database Verification
- [ ] Messages stored with `context.chunks` array
- [ ] `sourceIds` array populated
- [ ] `conversation.messageCount` increments
- [ ] `Chunk_Performance.timesUsed` increments

### 4. Error Handling
- [ ] Invalid chatbotId returns 404
- [ ] Empty messages array returns 400
- [ ] Rate limit exceeded returns 429 with headers
- [ ] Network errors handled gracefully

## Running Tests

### Prerequisites

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   - Copy `.env.local.example` to `.env.local`
   - Fill in all required values

3. **Set up database:**
   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```

### Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run comprehensive E2E test
npm run test:phase3

# Run specific test file
npm test -- __tests__/lib/rate-limit.test.ts
```

## Test Results Interpretation

### ✅ All Tests Passing
If all tests pass, Phase 3 Task 1 is complete and working correctly.

### ❌ Some Tests Failing

**Rate Limiting Tests Fail:**
- Check database connection
- Verify Prisma mocks are correct
- Check time window calculation

**RAG Query Tests Fail:**
- Verify Pinecone mocks are set up correctly
- Check embedding generation mock
- Verify namespace handling

**Integration Tests Fail:**
- Check all mocks are properly configured
- Verify Clerk auth mock
- Check OpenAI streaming mock

**E2E Tests Fail:**
- Ensure dev server is running (`npm run dev`)
- Verify database has test data
- Check Pinecone has vectors uploaded
- Verify environment variables are set

## Troubleshooting

### Tests Can't Connect to Database
- Ensure DATABASE_URL is set in `.env.local`
- Run `npx prisma generate` to regenerate Prisma Client
- Check database is accessible

### Tests Can't Find Modules
- Run `npm install` to ensure all dependencies are installed
- Check `jest.config.js` moduleNameMapper is correct
- Verify TypeScript paths match Jest paths

### Mock Errors
- Ensure all external services are mocked
- Check mock implementations match actual API signatures
- Verify mock return values match expected types

## Next Steps

After all tests pass:
1. ✅ Phase 3 Task 1 is complete
2. Move to Phase 3 Task 2: Rate limiting (already implemented)
3. Move to Phase 3 Task 3: Chat UI component
4. Move to Phase 3 Task 4: Conversation management (already implemented)
5. Move to Phase 3 Task 5: Error handling (already implemented)
