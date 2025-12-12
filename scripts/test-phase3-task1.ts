// scripts/test-phase3-task1.ts
// Comprehensive end-to-end test for Phase 3 Task 1
// Tests all requirements: RAG, streaming, storage, rate limiting, chunk performance
// Usage: npx dotenv-cli -e .env.local -- npx tsx scripts/test-phase3-task1.ts

// Load environment variables FIRST
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

import { prisma } from '../lib/prisma';

const BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
const CHATBOT_ID = 'chatbot_art_of_war';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

async function testPhase3Task1(): Promise<void> {
  console.log('🧪 Phase 3 Task 1 - Comprehensive Test Suite\n');
  console.log('='.repeat(60));
  console.log('');

  const results: TestResult[] = [];

  // Test 1: Chat API responds
  console.log('1️⃣ Testing: Chat API responds');
  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'What is the art of war?' }],
        chatbotId: CHATBOT_ID,
      }),
    });

    if (response.ok) {
      results.push({ name: 'Chat API responds', passed: true });
      console.log('   ✅ PASSED\n');
    } else {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      results.push({
        name: 'Chat API responds',
        passed: false,
        error: error.error || `Status ${response.status}`,
      });
      console.log(`   ❌ FAILED: ${error.error || response.statusText}\n`);
    }
  } catch (error) {
    results.push({
      name: 'Chat API responds',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.log(`   ❌ FAILED: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  }

  // Test 2: Streaming response
  console.log('2️⃣ Testing: Streaming response');
  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Tell me about strategy' }],
        chatbotId: CHATBOT_ID,
      }),
    });

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let receivedChunks = 0;
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedChunks++;
      fullContent += decoder.decode(value, { stream: true });
    }

    if (receivedChunks > 0 && fullContent.length > 0) {
      results.push({
        name: 'Streaming response',
        passed: true,
        details: `Received ${receivedChunks} chunks, ${fullContent.length} characters`,
      });
      console.log(`   ✅ PASSED (${receivedChunks} chunks, ${fullContent.length} chars)\n`);
    } else {
      results.push({ name: 'Streaming response', passed: false, error: 'No chunks received' });
      console.log('   ❌ FAILED: No chunks received\n');
    }
  } catch (error) {
    results.push({
      name: 'Streaming response',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.log(`   ❌ FAILED: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  }

  // Test 3: Messages stored with context
  console.log('3️⃣ Testing: Messages stored with context');
  try {
    // Send a message
    await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'What is deception in warfare?' }],
        chatbotId: CHATBOT_ID,
      }),
    });

    // Wait a bit for async processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check database
    const assistantMessage = await prisma.message.findFirst({
      where: {
        conversation: { chatbotId: CHATBOT_ID },
        role: 'assistant',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (assistantMessage && assistantMessage.context) {
      const context = assistantMessage.context as any;
      if (context.chunks && Array.isArray(context.chunks) && context.chunks.length > 0) {
        results.push({
          name: 'Messages stored with context',
          passed: true,
          details: `${context.chunks.length} chunks stored`,
        });
        console.log(`   ✅ PASSED (${context.chunks.length} chunks stored)\n`);
      } else {
        results.push({
          name: 'Messages stored with context',
          passed: false,
          error: 'No chunks in context',
        });
        console.log('   ❌ FAILED: No chunks in context\n');
      }
    } else {
      results.push({
        name: 'Messages stored with context',
        passed: false,
        error: 'No assistant message or context found',
      });
      console.log('   ❌ FAILED: No assistant message or context found\n');
    }
  } catch (error) {
    results.push({
      name: 'Messages stored with context',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.log(`   ❌ FAILED: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  }

  // Test 4: Source IDs extracted
  console.log('4️⃣ Testing: Source IDs extracted');
  try {
    const assistantMessage = await prisma.message.findFirst({
      where: {
        conversation: { chatbotId: CHATBOT_ID },
        role: 'assistant',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (assistantMessage && assistantMessage.sourceIds && assistantMessage.sourceIds.length > 0) {
      results.push({
        name: 'Source IDs extracted',
        passed: true,
        details: `Source IDs: ${assistantMessage.sourceIds.join(', ')}`,
      });
      console.log(`   ✅ PASSED (${assistantMessage.sourceIds.join(', ')})\n`);
    } else {
      results.push({
        name: 'Source IDs extracted',
        passed: false,
        error: 'No sourceIds found',
      });
      console.log('   ❌ FAILED: No sourceIds found\n');
    }
  } catch (error) {
    results.push({
      name: 'Source IDs extracted',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.log(`   ❌ FAILED: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  }

  // Test 5: Conversation messageCount updated
  console.log('5️⃣ Testing: Conversation messageCount updated');
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { chatbotId: CHATBOT_ID },
      orderBy: { updatedAt: 'desc' },
    });

    if (conversation && conversation.messageCount > 0) {
      results.push({
        name: 'Conversation messageCount updated',
        passed: true,
        details: `messageCount: ${conversation.messageCount}`,
      });
      console.log(`   ✅ PASSED (messageCount: ${conversation.messageCount})\n`);
    } else {
      results.push({
        name: 'Conversation messageCount updated',
        passed: false,
        error: 'messageCount is 0 or conversation not found',
      });
      console.log('   ❌ FAILED: messageCount is 0 or conversation not found\n');
    }
  } catch (error) {
    results.push({
      name: 'Conversation messageCount updated',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.log(`   ❌ FAILED: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  }

  // Test 6: Chunk performance tracked
  console.log('6️⃣ Testing: Chunk performance tracked');
  try {
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    const chunkPerf = await prisma.chunk_Performance.findFirst({
      where: {
        chatbotId: CHATBOT_ID,
        month,
        year,
        timesUsed: { gt: 0 },
      },
    });

    if (chunkPerf && chunkPerf.timesUsed > 0) {
      results.push({
        name: 'Chunk performance tracked',
        passed: true,
        details: `Chunk ${chunkPerf.chunkId.substring(0, 20)}... used ${chunkPerf.timesUsed} times`,
      });
      console.log(`   ✅ PASSED (chunk used ${chunkPerf.timesUsed} times)\n`);
    } else {
      results.push({
        name: 'Chunk performance tracked',
        passed: false,
        error: 'No chunk performance records found',
      });
      console.log('   ❌ FAILED: No chunk performance records found\n');
    }
  } catch (error) {
    results.push({
      name: 'Chunk performance tracked',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.log(`   ❌ FAILED: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  }

  // Test 7: Rate limit headers present
  console.log('7️⃣ Testing: Rate limit headers present');
  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Test rate limit headers' }],
        chatbotId: CHATBOT_ID,
      }),
    });

    const hasRateLimitHeaders =
      response.headers.get('X-RateLimit-Limit') &&
      response.headers.get('X-RateLimit-Remaining') &&
      response.headers.get('X-RateLimit-Reset');

    if (hasRateLimitHeaders) {
      results.push({
        name: 'Rate limit headers present',
        passed: true,
        details: `Limit: ${response.headers.get('X-RateLimit-Limit')}, Remaining: ${response.headers.get('X-RateLimit-Remaining')}`,
      });
      console.log(`   ✅ PASSED\n`);
    } else {
      results.push({
        name: 'Rate limit headers present',
        passed: false,
        error: 'Missing rate limit headers',
      });
      console.log('   ❌ FAILED: Missing rate limit headers\n');
    }
  } catch (error) {
    results.push({
      name: 'Rate limit headers present',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.log(`   ❌ FAILED: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  }

  // Test 8: Conversation ID in headers
  console.log('8️⃣ Testing: Conversation ID in headers');
  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Test conversation ID' }],
        chatbotId: CHATBOT_ID,
      }),
    });

    const conversationId = response.headers.get('X-Conversation-Id');

    if (conversationId) {
      results.push({
        name: 'Conversation ID in headers',
        passed: true,
        details: `Conversation ID: ${conversationId}`,
      });
      console.log(`   ✅ PASSED (${conversationId})\n`);
    } else {
      results.push({
        name: 'Conversation ID in headers',
        passed: false,
        error: 'Missing X-Conversation-Id header',
      });
      console.log('   ❌ FAILED: Missing X-Conversation-Id header\n');
    }
  } catch (error) {
    results.push({
      name: 'Conversation ID in headers',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.log(`   ❌ FAILED: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  }

  // Summary
  console.log('='.repeat(60));
  console.log('\n📊 Test Summary:\n');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  results.forEach((result) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    if (result.details) {
      console.log(`   ${result.details}`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log(`\n📈 Results: ${passed}/${results.length} passed, ${failed} failed\n`);

  if (failed === 0) {
    console.log('🎉 All tests passed! Phase 3 Task 1 is complete.\n');
    await prisma.$disconnect();
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.\n');
    await prisma.$disconnect();
    process.exit(1);
  }
}

testPhase3Task1().catch((error) => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
