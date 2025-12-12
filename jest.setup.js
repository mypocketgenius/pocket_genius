// jest.setup.js
// Global test setup

// Mock environment variables for tests
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
process.env.PINECONE_API_KEY = process.env.PINECONE_API_KEY || 'test-key';
process.env.PINECONE_INDEX = process.env.PINECONE_INDEX || 'test-index';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test';
process.env.CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || 'sk_test';
process.env.BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || 'test-token';
process.env.NEXT_PUBLIC_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
