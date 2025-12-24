// Quick diagnostic script to check chatbot status
// Run: npx tsx scripts/check-chatbot-status.ts

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

import { prisma } from '../lib/prisma';

async function main() {
  console.log('🔍 Checking Art of War chatbot status...\n');

  const chatbot = await prisma.chatbot.findUnique({
    where: { id: 'chatbot_art_of_war' },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      categories: {
        include: {
          category: {
            select: {
              id: true,
              type: true,
              label: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  if (!chatbot) {
    console.log('❌ Chatbot not found! Run: npx prisma db seed');
    process.exit(1);
  }

  console.log('Chatbot Details:');
  console.log(`  ID: ${chatbot.id}`);
  console.log(`  Title: ${chatbot.title}`);
  console.log(`  Slug: ${chatbot.slug || '(not set)'}`);
  console.log(`  Description: ${chatbot.description || '(not set)'}`);
  console.log(`  Type: ${chatbot.type || '(not set)'}`);
  console.log(`  isPublic: ${chatbot.isPublic}`);
  console.log(`  isActive: ${chatbot.isActive}`);
  console.log(`  allowAnonymous: ${chatbot.allowAnonymous}`);
  console.log(`  priceCents: ${chatbot.priceCents}`);
  console.log(`  currency: ${chatbot.currency}`);
  console.log(`  Creator: ${chatbot.creator.name} (${chatbot.creator.slug})`);
  console.log(`  Categories: ${chatbot.categories.length}`);
  
  if (chatbot.categories.length > 0) {
    chatbot.categories.forEach((cc) => {
      console.log(`    - ${cc.category.type}: ${cc.category.label} (${cc.category.slug})`);
    });
  } else {
    console.log('    ⚠️  No categories assigned!');
  }

  console.log('\n✅ Status Check:');
  
  const issues: string[] = [];
  
  if (!chatbot.isPublic) {
    issues.push('❌ isPublic is false (should be true)');
  } else {
    console.log('✅ isPublic is true');
  }
  
  if (!chatbot.isActive) {
    issues.push('❌ isActive is false (should be true)');
  } else {
    console.log('✅ isActive is true');
  }
  
  if (!chatbot.slug) {
    issues.push('❌ slug is not set');
  } else {
    console.log('✅ slug is set');
  }
  
  if (!chatbot.type) {
    issues.push('❌ type is not set');
  } else {
    console.log('✅ type is set');
  }
  
  if (chatbot.categories.length === 0) {
    issues.push('⚠️  No categories assigned (chatbot may not appear on homepage)');
  } else {
    console.log('✅ Categories assigned');
  }

  if (issues.length > 0) {
    console.log('\n⚠️  Issues found:');
    issues.forEach(issue => console.log(`  ${issue}`));
    console.log('\n💡 Fix by running: npx prisma db seed');
  } else {
    console.log('\n✅ All checks passed! Chatbot should appear on homepage.');
  }

  // Test API query
  console.log('\n🔍 Testing API query...');
  const publicChatbots = await prisma.chatbot.findMany({
    where: {
      isPublic: true,
      isActive: true,
    },
    select: {
      id: true,
      title: true,
      slug: true,
    },
  });

  console.log(`Found ${publicChatbots.length} public, active chatbot(s):`);
  publicChatbots.forEach((cb) => {
    const isArtOfWar = cb.id === 'chatbot_art_of_war';
    console.log(`  ${isArtOfWar ? '✅' : '  '} ${cb.title} (${cb.slug || 'no slug'})`);
  });

  if (!publicChatbots.find(cb => cb.id === 'chatbot_art_of_war')) {
    console.log('\n❌ Art of War chatbot is NOT returned by public API query!');
    console.log('   This means it won\'t appear on the homepage.');
  } else {
    console.log('\n✅ Art of War chatbot IS returned by public API query!');
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

