// scripts/test-chat.ts
// Command-line test script for chat API
// Usage: npx tsx scripts/test-chat.ts [message]
//
// Example:
//   npx tsx scripts/test-chat.ts "What is the art of war?"
//   npx tsx scripts/test-chat.ts "Tell me about strategy"

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
const CHATBOT_ID = 'chatbot_art_of_war'; // From seed data

async function testChat(message: string, conversationId?: string) {
  console.log('🧪 Testing chat API...\n');
  console.log(`💬 Message: "${message}"`);
  console.log(`🤖 Chatbot ID: ${CHATBOT_ID}`);
  if (conversationId) {
    console.log(`💭 Conversation ID: ${conversationId}`);
  }
  console.log(`🌐 URL: ${BASE_URL}/api/chat\n`);

  try {
    console.log('📤 Sending request...\n');
    console.log('📥 Streaming response:\n');
    console.log('─'.repeat(60));

    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: message,
          },
        ],
        chatbotId: CHATBOT_ID,
        ...(conversationId && { conversationId }),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('\n❌ Request failed:');
      console.error(`   Status: ${response.status}`);
      console.error(`   Error: ${errorData.error || response.statusText}`);
      
      if (response.status === 401) {
        console.error('\n💡 Tip: Make sure you are authenticated via Clerk.');
        console.error('   For testing without auth, the API should allow anonymous users.');
      }
      
      if (response.status === 404) {
        console.error('\n💡 Tip: Make sure the chatbot exists in the database.');
        console.error('   Run: npx prisma db seed');
      }
      
      if (response.status === 429) {
        console.error('\n💡 Tip: Rate limit exceeded. Wait a minute and try again.');
      }
      
      process.exit(1);
    }

    // Handle streaming response
    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      process.stdout.write(chunk);
      fullResponse += chunk;
    }

    console.log('\n' + '─'.repeat(60));
    console.log('\n✅ Chat completed successfully!');
    console.log(`📊 Response length: ${fullResponse.length} characters`);

    // Try to extract conversation ID from response headers or return it
    // Note: The API doesn't return conversationId in the streaming response,
    // but it's created/stored in the database
    return { success: true, responseLength: fullResponse.length };
  } catch (error) {
    console.error('\n❌ Request failed:');
    
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        console.error('   Connection refused. Is the dev server running?');
        console.error(`   Start it with: npm run dev`);
      } else {
        console.error(`   Error: ${error.message}`);
      }
    } else {
      console.error('   Unknown error:', error);
    }
    
    process.exit(1);
  }
}

// Get message from command line args or use default
const message = process.argv[2] || 'What is the art of war?';
const conversationId = process.argv[3]; // Optional conversation ID for multi-turn

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: npx tsx scripts/test-chat.ts [message] [conversationId]');
  console.log('');
  console.log('Examples:');
  console.log('  npx tsx scripts/test-chat.ts "What is the art of war?"');
  console.log('  npx tsx scripts/test-chat.ts "Tell me about strategy"');
  console.log('  npx tsx scripts/test-chat.ts "What is deception?" <conversation-id>');
  console.log('');
  console.log('Note: Make sure the dev server is running (npm run dev)');
  console.log('      and that content has been uploaded and ingested into Pinecone.');
  process.exit(0);
}

testChat(message, conversationId)
  .then(() => {
    console.log('\n🎉 Test completed!');
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
