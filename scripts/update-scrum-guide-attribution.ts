// scripts/update-scrum-guide-attribution.ts
// One-time script to populate Scrum Guide attribution data
// Usage: npx tsx scripts/update-scrum-guide-attribution.ts

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { prisma } from '../lib/prisma';

async function updateScrumGuideAttribution() {
  console.log('Updating Scrum Guide source with attribution data...');

  const result = await prisma.source.update({
    where: { id: 'scrum_guide' },
    data: {
      authors: 'Ken Schwaber & Jeff Sutherland',
      year: 2020,
      license: 'CC-BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl: 'https://scrumguides.org/scrum-guide.html',
    },
  });

  console.log('Updated source:', result.id);
  console.log('  authors:', result.authors);
  console.log('  year:', result.year);
  console.log('  license:', result.license);
  console.log('  licenseUrl:', result.licenseUrl);
  console.log('  sourceUrl:', result.sourceUrl);

  await prisma.$disconnect();
}

updateScrumGuideAttribution()
  .then(() => console.log('\n✅ Done!'))
  .catch(console.error);
