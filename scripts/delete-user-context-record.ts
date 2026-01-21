// Use the project's Prisma client
import { prisma } from '../lib/prisma.js';

async function deleteRecord() {
  try {
    const recordId = 'cmkahgidk0003d3lurfix92kr';

    // First check if record exists
    const record = await prisma.user_Context.findUnique({
      where: { id: recordId }
    });

    if (record) {
      console.log('Found record:', JSON.stringify(record, null, 2));

      // Delete the record
      await prisma.user_Context.delete({
        where: { id: recordId }
      });

      console.log(`✓ Successfully deleted record ${recordId}`);
    } else {
      console.log(`Record not found with id: ${recordId}`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteRecord();
