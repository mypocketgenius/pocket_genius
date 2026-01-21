import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function checkIndex() {
  try {
    const result = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'Chatbot' 
        AND indexname = 'Chatbot_isPublic_isActive_type_idx'
    `;

    if (result.length > 0) {
      console.log('✅ Composite index EXISTS!');
      console.log(`   Index name: ${result[0].indexname}`);
      console.log(`   Definition: ${result[0].indexdef}`);
    } else {
      console.log('❌ Composite index NOT FOUND');
      console.log('   Checking all Chatbot indexes...');
      
      const allIndexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'Chatbot'
        ORDER BY indexname
      `;
      
      console.log(`\n   Found ${allIndexes.length} indexes on Chatbot table:`);
      allIndexes.forEach(idx => {
        console.log(`   - ${idx.indexname}`);
      });
    }
  } catch (error) {
    console.error('❌ Error checking index:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkIndex();

