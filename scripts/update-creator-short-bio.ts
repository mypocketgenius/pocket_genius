// scripts/update-creator-short-bio.ts
// Simple script to update creator shortBio field
// Usage: npx tsx scripts/update-creator-short-bio.ts <creatorSlug> <shortBio>

import { prisma } from '../lib/prisma';

async function updateCreatorShortBio(identifier: string, shortBio: string) {
  try {
    // Try ID first, then slug
    const whereClause = identifier.startsWith('creator_') 
      ? { id: identifier }
      : { slug: identifier };
    
    const creator = await prisma.creator.update({
      where: whereClause,
      data: { shortBio },
      select: {
        id: true,
        slug: true,
        name: true,
        bio: true,
        shortBio: true,
      },
    });

    console.log('✅ Creator updated successfully:');
    console.log(`   Name: ${creator.name}`);
    console.log(`   Slug: ${creator.slug}`);
    console.log(`   Short Bio: ${creator.shortBio}`);
    console.log(`   Full Bio: ${creator.bio?.substring(0, 50)}...`);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Record to update not found')) {
        console.error(`❌ Creator "${identifier}" not found (tried as both ID and slug)`);
      } else {
        console.error('❌ Error updating creator:', error.message);
      }
    } else {
      console.error('❌ Unknown error:', error);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get arguments from command line
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: npx tsx scripts/update-creator-short-bio.ts <creatorIdOrSlug> <shortBio>');
  console.error('Example: npx tsx scripts/update-creator-short-bio.ts creator_sun_tzu "Ancient Chinese military strategist"');
  console.error('Example: npx tsx scripts/update-creator-short-bio.ts sun-tzu "Ancient Chinese military strategist"');
  process.exit(1);
}

const [identifier, shortBio] = args;
updateCreatorShortBio(identifier, shortBio);

