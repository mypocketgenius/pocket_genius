// Script to fix Art of War chatbot in PRODUCTION database
// 
// Usage:
//   1. Set production DATABASE_URL in your terminal:
//      export DATABASE_URL="your-production-database-url"
//   2. Run: npx tsx scripts/fix-production-chatbot.ts
//
// OR use dotenv-cli:
//   npx dotenv-cli -e .env.production -- npx tsx scripts/fix-production-chatbot.ts

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

import { prisma } from '../lib/prisma';

// Warn if using production database
async function checkDatabase() {
  const dbUrl = process.env.DATABASE_URL || '';
  const isProduction = dbUrl.includes('prod') || dbUrl.includes('production') || dbUrl.includes('ep-');

  if (isProduction) {
    console.log('⚠️  WARNING: This appears to be a PRODUCTION database!');
    console.log('   Database URL preview:', dbUrl.substring(0, 30) + '...');
    console.log('   Continuing in 3 seconds... (Ctrl+C to cancel)');
    await new Promise(resolve => setTimeout(resolve, 3000));
  } else {
    console.log('ℹ️  Using development database');
  }
}

async function main() {
  await checkDatabase();
  console.log('\n🔍 Checking Art of War chatbot in database...\n');

  // Find the chatbot
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
    console.log('❌ Chatbot not found!');
    console.log('   The chatbot needs to be created first.');
    console.log('   Run the full seed script: npx prisma db seed');
    process.exit(1);
  }

  console.log('📊 Current Status:');
  console.log(`   Title: ${chatbot.title}`);
  console.log(`   Slug: ${chatbot.slug || '(not set)'}`);
  console.log(`   isPublic: ${chatbot.isPublic}`);
  console.log(`   isActive: ${chatbot.isActive}`);
  console.log(`   type: ${chatbot.type || '(not set)'}`);
  console.log(`   Categories: ${chatbot.categories.length}`);

  const needsUpdate: string[] = [];
  const updates: any = {};

  // Check what needs updating
  if (!chatbot.isPublic) {
    needsUpdate.push('isPublic (should be true)');
    updates.isPublic = true;
  }
  if (!chatbot.isActive) {
    needsUpdate.push('isActive (should be true)');
    updates.isActive = true;
  }
  if (!chatbot.slug) {
    needsUpdate.push('slug (should be "art-of-war")');
    updates.slug = 'art-of-war';
  }
  if (!chatbot.type) {
    needsUpdate.push('type (should be "DEEP_DIVE")');
    updates.type = 'DEEP_DIVE';
  }
  if (!chatbot.description) {
    needsUpdate.push('description (should be set)');
    updates.description = 'A deep dive into Sun Tzu\'s timeless military strategy classic, The Art of War.';
  }
  if (chatbot.priceCents !== 0) {
    needsUpdate.push('priceCents (should be 0)');
    updates.priceCents = 0;
  }
  if (chatbot.currency !== 'USD') {
    needsUpdate.push('currency (should be "USD")');
    updates.currency = 'USD';
  }
  if (!chatbot.allowAnonymous) {
    needsUpdate.push('allowAnonymous (should be true)');
    updates.allowAnonymous = true;
  }

  // Update chatbot if needed
  if (Object.keys(updates).length > 0) {
    console.log('\n🔧 Updating chatbot fields:');
    needsUpdate.forEach(item => console.log(`   - ${item}`));
    
    await prisma.chatbot.update({
      where: { id: 'chatbot_art_of_war' },
      data: updates,
    });
    
    console.log('\n✅ Chatbot updated successfully!');
  } else {
    console.log('\n✅ Chatbot fields are already correct!');
  }

  // Check and assign categories
  // Use findUnique for each category since we're querying by compound unique constraint
  const categoryPromises = [
    prisma.category.findUnique({ where: { type_slug: { type: 'ROLE', slug: 'founder' } } }),
    prisma.category.findUnique({ where: { type_slug: { type: 'CHALLENGE', slug: 'positioning' } } }),
    prisma.category.findUnique({ where: { type_slug: { type: 'STAGE', slug: 'early_stage' } } }),
  ];
  
  const categoryResults = await Promise.all(categoryPromises);
  const categories = categoryResults.filter((cat): cat is NonNullable<typeof cat> => cat !== null);

  if (categories.length === 0) {
    console.log('\n⚠️  Categories not found. Creating them...');
    
    const categoryData = [
      { type: 'ROLE' as const, slug: 'founder', label: 'Founder' },
      { type: 'CHALLENGE' as const, slug: 'positioning', label: 'Positioning' },
      { type: 'STAGE' as const, slug: 'early_stage', label: 'Early Stage' },
    ];

    for (const cat of categoryData) {
      await prisma.category.upsert({
        where: { type_slug: { type: cat.type, slug: cat.slug } },
        update: {},
        create: cat,
      });
    }

    // Re-fetch categories using findUnique
    const newCategoryPromises = [
      prisma.category.findUnique({ where: { type_slug: { type: 'ROLE', slug: 'founder' } } }),
      prisma.category.findUnique({ where: { type_slug: { type: 'CHALLENGE', slug: 'positioning' } } }),
      prisma.category.findUnique({ where: { type_slug: { type: 'STAGE', slug: 'early_stage' } } }),
    ];
    
    const newCategoryResults = await Promise.all(newCategoryPromises);
    const newCategories = newCategoryResults.filter((cat): cat is NonNullable<typeof cat> => cat !== null);
    
    categories.push(...newCategories);
    console.log('✅ Categories created');
  }

  // Assign categories to chatbot
  let categoriesAssigned = 0;
  for (const category of categories) {
    const existing = await prisma.chatbot_Category.findUnique({
      where: {
        chatbotId_categoryId: {
          chatbotId: chatbot.id,
          categoryId: category.id,
        },
      },
    });

    if (!existing) {
      await prisma.chatbot_Category.create({
        data: {
          chatbotId: chatbot.id,
          categoryId: category.id,
          relevanceScore: 0.8,
        },
      });
      categoriesAssigned++;
    }
  }

  if (categoriesAssigned > 0) {
    console.log(`\n✅ Assigned ${categoriesAssigned} categories to chatbot`);
  } else {
    console.log('\n✅ Categories already assigned');
  }

  // Final verification
  console.log('\n🔍 Final Verification:');
  const finalCheck = await prisma.chatbot.findUnique({
    where: { id: 'chatbot_art_of_war' },
    include: {
      categories: {
        include: {
          category: {
            select: {
              type: true,
              label: true,
            },
          },
        },
      },
    },
  });

  if (finalCheck) {
    console.log(`   isPublic: ${finalCheck.isPublic} ✅`);
    console.log(`   isActive: ${finalCheck.isActive} ✅`);
    console.log(`   Categories: ${finalCheck.categories.length} ✅`);
    
    // Test API query
    const publicChatbots = await prisma.chatbot.findMany({
      where: {
        isPublic: true,
        isActive: true,
      },
      select: {
        id: true,
        title: true,
      },
    });

    const isInResults = publicChatbots.some(cb => cb.id === 'chatbot_art_of_war');
    
    if (isInResults) {
      console.log('\n✅ SUCCESS! Chatbot will appear on homepage.');
      console.log(`   Found ${publicChatbots.length} public chatbot(s) total.`);
    } else {
      console.log('\n❌ ERROR: Chatbot still not returned by API query!');
      console.log('   This might be a database connection or query issue.');
    }
  }

  console.log('\n🎉 Done!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

