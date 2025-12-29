// prisma/migrations/add_chatbot_versioning_data.ts
// Phase 3.9: Data migration script for chatbot versioning
// Creates version 1 for all existing chatbots and assigns existing conversations to version 1

import { prisma } from '@/lib/prisma';

async function migrateExistingData() {
  console.log('Starting chatbot versioning data migration...');
  
  try {
    // Get all existing chatbots with their creators
    const chatbots = await prisma.chatbot.findMany({
      include: { 
        conversations: true,
        creator: {
          include: {
            users: {
              where: { role: 'OWNER' },
              take: 1,
            },
          },
        },
      },
    });
    
    console.log(`Found ${chatbots.length} chatbots to migrate`);
    
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const chatbot of chatbots) {
      try {
        // Skip if chatbot already has a version
        if (chatbot.currentVersionId) {
          console.log(`Skipping chatbot ${chatbot.id} - already has version`);
          continue;
        }
        
        // Get creator user ID
        const creatorUserId = chatbot.creator.users[0]?.userId;
        if (!creatorUserId) {
          console.error(`Skipping chatbot ${chatbot.id} - creator has no associated user`);
          errorCount++;
          continue;
        }
        
        // Create version 1 for this chatbot
        const version1 = await prisma.chatbot_Version.create({
          data: {
            chatbotId: chatbot.id,
            versionNumber: 1,
            title: chatbot.title,
            description: chatbot.description,
            systemPrompt: chatbot.systemPrompt || 'You are a helpful assistant.',
            modelProvider: chatbot.modelProvider || 'openai',
            modelName: chatbot.modelName || 'gpt-4o',
            pineconeNs: chatbot.pineconeNs || '',
            vectorNamespace: chatbot.vectorNamespace || '',
            configJson: chatbot.configJson || null,
            ragSettingsJson: chatbot.ragSettingsJson || null,
            ingestionRunIds: chatbot.ingestionRunIds || [],
            allowAnonymous: chatbot.allowAnonymous,
            priceCents: chatbot.priceCents,
            currency: chatbot.currency,
            type: chatbot.type || 'DEEP_DIVE',
            createdByUserId: creatorUserId,
            activatedAt: new Date(),
            notes: 'Migrated from pre-versioning system',
          },
        });
        
        // Update chatbot to point to version 1
        await prisma.chatbot.update({
          where: { id: chatbot.id },
          data: { currentVersionId: version1.id },
        });
        
        // Assign all existing conversations to version 1
        if (chatbot.conversations.length > 0) {
          await prisma.conversation.updateMany({
            where: { chatbotId: chatbot.id },
            data: { chatbotVersionId: version1.id },
          });
          console.log(`  - Created version 1 and assigned ${chatbot.conversations.length} conversations`);
        } else {
          console.log(`  - Created version 1 (no conversations to assign)`);
        }
        
        migratedCount++;
      } catch (error) {
        console.error(`Error migrating chatbot ${chatbot.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`\nMigration complete!`);
    console.log(`  - Migrated: ${migratedCount} chatbots`);
    console.log(`  - Errors: ${errorCount} chatbots`);
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

migrateExistingData()
  .catch((error) => {
    console.error('Migration error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

