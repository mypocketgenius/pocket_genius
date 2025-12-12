// scripts/test-upload.ts
// Command-line test script for file upload API
// Usage: npx tsx scripts/test-upload.ts <path-to-file.txt>

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
const SOURCE_ID = 'source_art_of_war'; // From seed data

async function testUpload(filePath: string) {
  console.log('🧪 Testing file upload API...\n');

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  const fileStats = fs.statSync(filePath);
  const fileName = path.basename(filePath);

  console.log(`📄 File: ${fileName}`);
  console.log(`📊 Size: ${(fileStats.size / 1024).toFixed(2)} KB`);
  console.log(`🔗 Source ID: ${SOURCE_ID}`);
  console.log(`🌐 URL: ${BASE_URL}/api/files/upload\n`);

  // Read file
  const fileBuffer = fs.readFileSync(filePath);
  const fileBlob = new Blob([fileBuffer], { type: 'text/plain' });

  // Create FormData
  const formData = new FormData();
  formData.append('file', fileBlob, fileName);
  formData.append('sourceId', SOURCE_ID);

  try {
    console.log('📤 Uploading...\n');

    // Note: This requires a valid Clerk session token
    // For automated testing, you'd need to get a session token first
    // For now, this script shows the structure but manual testing via browser is easier

    const response = await fetch(`${BASE_URL}/api/files/upload`, {
      method: 'POST',
      body: formData,
      // In a real test, you'd add: headers: { 'Cookie': 'your-clerk-session-cookie' }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Upload failed:');
      console.error(`   Status: ${response.status}`);
      console.error(`   Error: ${data.error || 'Unknown error'}`);
      process.exit(1);
    }

    console.log('✅ Upload successful!');
    console.log(`   File ID: ${data.fileId}`);
    console.log(`   Status: ${data.status}`);
    console.log(`   Message: ${data.message}`);
  } catch (error) {
    console.error('❌ Request failed:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Get file path from command line args
const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: npx tsx scripts/test-upload.ts <path-to-file.txt>');
  console.error('Example: npx tsx scripts/test-upload.ts MVP_Sources/The_Art_of_War.txt');
  process.exit(1);
}

testUpload(filePath);
