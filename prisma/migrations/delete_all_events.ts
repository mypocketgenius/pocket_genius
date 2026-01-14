import { prisma } from '@/lib/prisma';

async function deleteAllEvents() {
  console.log('Deleting all existing events (test data only)...');
  
  // First, count existing events
  const countBefore = await prisma.event.count();
  console.log(`Found ${countBefore} events to delete`);
  
  if (countBefore === 0) {
    console.log('✅ No events to delete');
    return;
  }
  
  // Delete all events
  const result = await prisma.event.deleteMany({});
  
  console.log(`✅ Deleted ${result.count} events`);
}

deleteAllEvents()
  .catch((error) => {
    console.error('Error deleting events:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

