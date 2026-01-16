// scripts/update-creator-slug.ts
// Simple script to update creator slug field
// Usage: npx tsx scripts/update-creator-slug.ts <creatorIdentifier> <newSlug>
// creatorIdentifier can be: creator ID, current slug, or name

import { prisma } from '../lib/prisma';

async function updateCreatorSlug(identifier: string, newSlug: string) {
  try {
    // First, try to find the creator
    let creator;
    
    // Try ID first (if it starts with 'creator_' or looks like a cuid)
    if (identifier.startsWith('creator_') || identifier.length > 20) {
      creator = await prisma.creator.findUnique({
        where: { id: identifier },
      });
    }
    
    // If not found, try slug
    if (!creator) {
      creator = await prisma.creator.findUnique({
        where: { slug: identifier },
      });
    }
    
    // If still not found, try name (case-insensitive)
    if (!creator) {
      creator = await prisma.creator.findFirst({
        where: {
          name: {
            equals: identifier,
            mode: 'insensitive',
          },
        },
      });
    }
    
    if (!creator) {
      console.error(`❌ Creator "${identifier}" not found (tried as ID, slug, and name)`);
      process.exit(1);
      return;
    }
    
    // Check if the new slug is already taken by another creator
    const existingCreator = await prisma.creator.findUnique({
      where: { slug: newSlug },
    });
    
    if (existingCreator && existingCreator.id !== creator.id) {
      console.error(`❌ Slug "${newSlug}" is already taken by creator: ${existingCreator.name} (${existingCreator.id})`);
      process.exit(1);
      return;
    }
    
    // Update the creator
    const updated = await prisma.creator.update({
      where: { id: creator.id },
      data: { slug: newSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        bio: true,
        shortBio: true,
      },
    });

    console.log('✅ Creator updated successfully:');
    console.log(`   ID: ${updated.id}`);
    console.log(`   Name: ${updated.name}`);
    console.log(`   Slug: ${updated.slug}`);
    if (updated.bio) {
      console.log(`   Bio: ${updated.bio.substring(0, 50)}...`);
    }
    if (updated.shortBio) {
      console.log(`   Short Bio: ${updated.shortBio}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        console.error(`❌ Slug "${newSlug}" is already taken by another creator`);
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
  console.error('Usage: npx tsx scripts/update-creator-slug.ts <creatorIdentifier> <newSlug>');
  console.error('Example: npx tsx scripts/update-creator-slug.ts "Sun Tzu" sun-tzu');
  console.error('Example: npx tsx scripts/update-creator-slug.ts creator_abc123 sun-tzu');
  console.error('Example: npx tsx scripts/update-creator-slug.ts old-slug sun-tzu');
  process.exit(1);
}

const [identifier, newSlug] = args;
updateCreatorSlug(identifier, newSlug);

