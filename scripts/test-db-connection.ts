// scripts/test-db-connection.ts
// Tests database connectivity and provides diagnostic information
// Usage: npx tsx scripts/test-db-connection.ts

import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import { URL } from 'url';
import * as net from 'net';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;

// Parse connection string to extract host and port
function parseDatabaseUrl(url: string): { host: string; port: number; database: string } | null {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : 5432,
      database: parsed.pathname.slice(1) || 'postgres',
    };
  } catch (error) {
    console.error('❌ Failed to parse DATABASE_URL:', error);
    return null;
  }
}

// Test DNS resolution
function testDNS(host: string): boolean {
  try {
    console.log(`\n🔍 Testing DNS resolution for ${host}...`);
    const result = execSync(`nslookup ${host}`, { encoding: 'utf-8', timeout: 5000 });
    const ipMatches = result.match(/\d+\.\d+\.\d+\.\d+/g);
    if (ipMatches && ipMatches.length > 0) {
      console.log(`✅ DNS resolves to: ${ipMatches.join(', ')}`);
      return true;
    }
    console.log('⚠️  DNS resolution returned no IP addresses');
    return false;
  } catch (error: any) {
    console.log(`❌ DNS resolution failed: ${error.message}`);
    return false;
  }
}

// Test port connectivity using Node.js net module (cross-platform)
function testPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`\n🔍 Testing connectivity to ${host}:${port}...`);
    
    // Use Node.js net module for cross-platform TCP connection test
    const socket = new net.Socket();
    let connected = false;

    const timeout = setTimeout(() => {
      if (!connected) {
        socket.destroy();
        console.log(`❌ Port ${port} is NOT accessible (connection timeout)`);
        resolve(false);
      }
    }, 5000);

    socket.on('connect', () => {
      connected = true;
      clearTimeout(timeout);
      socket.destroy();
      console.log(`✅ Port ${port} is accessible`);
      resolve(true);
    });

    socket.on('error', () => {
      if (!connected) {
        clearTimeout(timeout);
        console.log(`❌ Port ${port} is NOT accessible (connection refused)`);
        resolve(false);
      }
    });

    socket.connect(port, host);
  });
}

// Test HTTPS connectivity (port 443)
function testHTTPS(host: string): boolean {
  try {
    console.log(`\n🔍 Testing HTTPS connectivity to ${host}:443...`);
    execSync(`curl -v --connect-timeout 5 https://${host}:443`, {
      encoding: 'utf-8',
      timeout: 6000,
      stdio: 'pipe',
    });
    console.log(`✅ Port 443 (HTTPS) is accessible`);
    return true;
  } catch (error: any) {
    console.log(`⚠️  Port 443 test failed: ${error.message}`);
    return false;
  }
}

// Test actual Prisma connection
async function testPrismaConnection(): Promise<boolean> {
  try {
    console.log(`\n🔍 Testing Prisma database connection...`);
    execSync('npx prisma db execute --stdin', {
      input: 'SELECT 1;',
      encoding: 'utf-8',
      timeout: 10000,
      stdio: 'pipe',
    });
    console.log(`✅ Prisma connection successful`);
    return true;
  } catch (error: any) {
    // Try alternative: prisma db pull (read-only, safer)
    try {
      execSync('npx prisma db pull --print', {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: 'pipe',
      });
      console.log(`✅ Prisma connection successful (via db pull)`);
      return true;
    } catch (pullError: any) {
      console.log(`❌ Prisma connection failed`);
      return false;
    }
  }
}

// Print diagnostic guidance
function printGuidance(parsed: { host: string; port: number }, dnsWorks: boolean, portWorks: boolean, httpsWorks: boolean) {
  console.log('\n' + '='.repeat(70));
  console.log('📋 DIAGNOSTIC SUMMARY');
  console.log('='.repeat(70));

  if (portWorks) {
    console.log('\n✅ Database connection should work!');
    console.log('   All connectivity tests passed.');
    return;
  }

  console.log('\n❌ Database connection blocked by network restrictions');
  console.log(`\n   Host: ${parsed.host}`);
  console.log(`   Port: ${parsed.port}`);
  console.log(`   DNS Resolution: ${dnsWorks ? '✅' : '❌'}`);
  console.log(`   Port ${parsed.port} (PostgreSQL): ${portWorks ? '✅' : '❌'}`);
  console.log(`   Port 443 (HTTPS): ${httpsWorks ? '✅' : '❌'}`);

  if (!portWorks && httpsWorks) {
    console.log('\n🔍 ROOT CAUSE IDENTIFIED:');
    console.log('   Your network is blocking port 5432 (PostgreSQL) but allows HTTPS.');
    console.log('   This is common on university/corporate networks.');
  }

  console.log('\n💡 RECOMMENDED SOLUTIONS:\n');

  console.log('1️⃣  USE VPN (Quickest Fix)');
  console.log('   • Connect to VPN (university or personal)');
  console.log('   • Then run: npm run build');
  console.log('   • ✅ Immediate solution, no code changes\n');

  console.log('2️⃣  USE MOBILE HOTSPOT');
  console.log('   • Switch to mobile hotspot/mobile data');
  console.log('   • Then run: npm run build');
  console.log('   • ✅ Immediate workaround\n');

  console.log('3️⃣  CONTACT IT SUPPORT (Permanent Fix)');
  console.log('   • Request firewall exception for port 5432');
  console.log('   • Or whitelist Neon IPs: 3.218.140.61, 44.198.216.75, 54.156.15.30');
  console.log('   • ✅ Permanent solution\n');

  console.log('4️⃣  USE CI/CD FOR BUILDS');
  console.log('   • Push code to GitHub');
  console.log('   • Let Vercel/GitHub Actions handle builds');
  console.log('   • ✅ Production-ready workflow\n');

  console.log('📚 For more details, see: NETWORK_CONNECTION_TROUBLESHOOTING.md');
  console.log('='.repeat(70) + '\n');
}

// Main execution
async function main() {
  console.log('🔧 Database Connection Diagnostic Tool\n');

  const parsed = parseDatabaseUrl(databaseUrl);
  if (!parsed) {
    process.exit(1);
  }

  const dnsWorks = testDNS(parsed.host);
  const portWorks = await testPort(parsed.host, parsed.port);
  const httpsWorks = testHTTPS(parsed.host);

  // Only test Prisma if port is accessible (to avoid long timeout)
  let prismaWorks = false;
  if (portWorks) {
    prismaWorks = await testPrismaConnection();
  }

  printGuidance(parsed, dnsWorks, portWorks, httpsWorks);

  // Exit with error code if connection failed
  if (!portWorks || !prismaWorks) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

