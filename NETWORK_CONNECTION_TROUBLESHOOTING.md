# Network Connection Troubleshooting Guide

## Problem: Database Connection Fails on Restricted Networks

### Symptoms

- ✅ Application works on mobile hotspot/other networks
- ❌ Application fails on university/corporate WiFi
- Error: `P1001: Can't reach database server at ...:5432`
- DNS resolves correctly
- HTTPS (port 443) works
- PostgreSQL port (5432) is blocked

### Root Cause

**University/corporate firewalls commonly block outbound connections to database ports (5432) for security reasons.**

This is a network-level restriction, not an application issue. Your code is correct - the network is preventing the connection.

---

## Quick Diagnostic

Run the connection test script:

```bash
npx tsx scripts/test-db-connection.ts
```

This will:
- Test DNS resolution
- Test port 5432 connectivity
- Test port 443 (HTTPS) connectivity
- Provide specific guidance based on results

---

## Solutions (Priority Order)

### ✅ Solution 1: Use VPN (Quickest Fix)

**Action:** Connect to VPN before running builds

**Steps:**
1. Connect to your university VPN or a personal VPN service
2. Run: `npm run build`
3. Build should succeed

**Pros:**
- ✅ Immediate solution
- ✅ No code changes required
- ✅ Works for all network-restricted scenarios

**Cons:**
- Requires VPN access
- May have slight performance overhead

**When to use:** When you need to build immediately and have VPN access

---

### ✅ Solution 2: Use Mobile Hotspot

**Action:** Switch to mobile data/hotspot for builds

**Steps:**
1. Disconnect from university WiFi
2. Connect to mobile hotspot
3. Run: `npm run build`
4. Build should succeed

**Pros:**
- ✅ Immediate workaround
- ✅ No code changes required
- ✅ No VPN needed

**Cons:**
- Uses mobile data
- Inconvenient for frequent builds
- Not sustainable long-term

**When to use:** Quick one-off builds when VPN isn't available

---

### ✅ Solution 3: Contact IT Support (Permanent Fix)

**Action:** Request firewall exception from university IT

**What to request:**
- Allow outbound connections to port 5432 (PostgreSQL)
- Or whitelist Neon database IP addresses:
  - `3.218.140.61`
  - `44.198.216.75`
  - `54.156.15.30`

**Information to provide:**
- **Service:** Neon PostgreSQL database (hosted on AWS)
- **Purpose:** Development work for [your project name]
- **Port:** 5432 (PostgreSQL standard port)
- **Protocol:** TCP
- **Direction:** Outbound only
- **Test results:** DNS works, HTTPS works, but port 5432 times out

**Sample request:**

```
Subject: Firewall Exception Request - PostgreSQL Database Access

Hello IT Support,

I'm working on a development project that requires access to a PostgreSQL 
database hosted on Neon (AWS infrastructure). The database connection works 
fine on other networks but fails on university WiFi.

Diagnostic results:
- DNS resolution: ✅ Works
- HTTPS (port 443): ✅ Works  
- PostgreSQL (port 5432): ❌ Blocked (connection timeout)

Could you please allow outbound connections to port 5432, or whitelist 
these Neon IP addresses:
- 3.218.140.61
- 44.198.216.75
- 54.156.15.30

This is for development purposes only. The database uses SSL encryption 
and requires authentication.

Thank you!
```

**Pros:**
- ✅ Permanent solution
- ✅ No workarounds needed
- ✅ Works for entire team

**Cons:**
- May take time to process
- Requires IT approval
- May be denied depending on policy

**When to use:** For long-term development on university network

---

### ✅ Solution 4: Use CI/CD for Builds (Best Practice)

**Action:** Offload builds to GitHub Actions or Vercel

**Why this works:**
- CI/CD servers aren't behind your university firewall
- Builds run in cloud environment with full network access
- Production-ready workflow

**Setup GitHub Actions:**

1. Create `.github/workflows/build.yml`:

```yaml
name: Build and Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run migrations
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: npx prisma migrate deploy
      
      - name: Build
        run: npm run build
```

2. Add `DATABASE_URL` to GitHub Secrets:
   - Go to: Repository → Settings → Secrets → Actions
   - Add: `DATABASE_URL` with your connection string

**Setup Vercel:**

1. Connect your GitHub repository to Vercel
2. Add `DATABASE_URL` to Vercel environment variables
3. Vercel automatically runs migrations during build
4. Push code → Vercel builds → Deploys

**Pros:**
- ✅ Bypasses all local network restrictions
- ✅ Production-ready workflow
- ✅ Automatic builds on push
- ✅ Team can work without VPN

**Cons:**
- Requires CI/CD setup
- Need to manage secrets securely
- Slight delay for builds (vs local)

**When to use:** For production deployments and team collaboration

---

### ⚠️ Solution 5: SSH Tunnel (Advanced)

**Action:** Create SSH tunnel through external server

**Requirements:**
- External server (AWS EC2, VPS, etc.) with port 5432 access
- SSH access to that server

**Steps:**

1. Create SSH tunnel:
```bash
ssh -L 5432:ep-orange-forest-ad6wfhq8-pooler.c-2.us-east-1.aws.neon.tech:5432 user@your-server.com
```

2. Update `.env.local` temporarily:
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
```

3. Run build while tunnel is active

**Pros:**
- ✅ Bypasses restrictions
- ✅ Fine-grained control

**Cons:**
- Requires external server
- More complex setup
- Need to maintain tunnel

**When to use:** When other solutions aren't available and you have server access

---

## Why Port 443 Works But 5432 Doesn't

- **Port 443 (HTTPS):** Standard web port, rarely blocked
- **Port 5432 (PostgreSQL):** Database port, commonly blocked for security
- **Prisma Requirement:** Needs direct TCP connection on port 5432
- **Cannot Use HTTP/HTTPS:** Prisma migrations require PostgreSQL protocol, not HTTP

---

## Testing Your Connection

### Manual Tests

**1. Test DNS:**
```bash
nslookup ep-orange-forest-ad6wfhq8-pooler.c-2.us-east-1.aws.neon.tech
```

**2. Test Port 443:**
```bash
curl -v --connect-timeout 5 https://3.218.140.61:443
```

**3. Test Port 5432:**
```bash
curl -v --connect-timeout 5 telnet://3.218.140.61:5432
```

### Automated Test

```bash
npx tsx scripts/test-db-connection.ts
```

---

## Environment Variables

Ensure your `.env.local` has:

```bash
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.c-2.us-east-1.aws.neon.tech:5432/dbname?sslmode=require
```

**Note:** The port `:5432` is required. Prisma cannot use port 443 for PostgreSQL connections.

---

## Common Error Messages

### P1001: Can't reach database server
**Meaning:** Network cannot reach database host on port 5432  
**Solution:** Use VPN, hotspot, or contact IT

### Connection timeout
**Meaning:** Port 5432 is blocked by firewall  
**Solution:** Use VPN, hotspot, or contact IT

### DNS resolution works but connection fails
**Meaning:** Port is blocked (not DNS issue)  
**Solution:** Use VPN, hotspot, or contact IT

---

## Prevention for Teams

1. **Set up CI/CD** - All builds run in cloud
2. **Document VPN access** - Ensure team has VPN credentials
3. **IT exception** - Request firewall exception for development team
4. **Alternative networks** - Have backup network options documented

---

## Additional Resources

- [Neon Documentation](https://neon.tech/docs)
- [Prisma Connection Troubleshooting](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [PostgreSQL Port Information](https://www.postgresql.org/docs/current/runtime-config-connection.html)

---

## Summary

| Solution | Speed | Permanence | Complexity |
|----------|-------|------------|------------|
| VPN | ⚡ Fast | ⏱️ Temporary | 🟢 Easy |
| Hotspot | ⚡ Fast | ⏱️ Temporary | 🟢 Easy |
| IT Request | 🐌 Slow | ✅ Permanent | 🟢 Easy |
| CI/CD | ⚡ Fast | ✅ Permanent | 🟡 Medium |
| SSH Tunnel | ⚡ Fast | ⏱️ Temporary | 🔴 Complex |

**Recommended:** Start with VPN/hotspot for immediate work, set up CI/CD for long-term, and request IT exception in parallel.





