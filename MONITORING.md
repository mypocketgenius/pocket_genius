# Vercel Monitoring Setup Guide

This guide covers how to set up and use Vercel monitoring features to track error rates, monitor API response times, and view logs for Pocket Genius.

---

## Overview

Pocket Genius uses multiple monitoring tools:
- **Vercel Dashboard** - Built-in logs, analytics, and function monitoring
- **Sentry** - Error tracking and performance monitoring
- **Neon Dashboard** - Database performance monitoring

This guide focuses on **Vercel monitoring** as specified in Phase 6, Task 6.

---

## 1. Accessing Vercel Logs

### 1.1 View Real-Time Logs

**Location:** Vercel Dashboard → Your Project → Logs

**Steps:**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your Pocket Genius project
3. Click **Logs** in the sidebar
4. View real-time logs from all deployments

**What You'll See:**
- API route logs (`console.log`, `console.error`)
- Build logs
- Runtime errors
- Function execution logs

**Filtering Logs:**
- Filter by deployment (Production, Preview, Development)
- Filter by function name (e.g., `/api/chat`)
- Search by keyword
- Filter by log level (Info, Warning, Error)

### 1.2 Understanding Log Levels

**Info (Default):**
```typescript
console.log('Chat request received', { chatbotId, userId });
```

**Warning:**
```typescript
console.warn('Rate limit approaching', { userId, remaining: 2 });
```

**Error:**
```typescript
console.error('Pinecone query failed', { error: error.message, chatbotId });
```

### 1.3 Best Practices for Logging

**Do:**
- ✅ Log important events (request start, completion, errors)
- ✅ Include context (userId, chatbotId, conversationId)
- ✅ Use structured logging (objects, not strings)
- ✅ Log errors with full context

**Don't:**
- ❌ Log sensitive data (API keys, tokens, passwords)
- ❌ Log excessive data (full request bodies)
- ❌ Use console.log for everything (use appropriate levels)

**Example Structured Logging:**
```typescript
// Good: Structured logging with context
console.log('Chat request', {
  userId: dbUserId || 'anonymous',
  chatbotId,
  conversationId,
  messageLength: lastMessage.content.length,
});

// Bad: Unstructured string logging
console.log(`User ${dbUserId} sent message to ${chatbotId}`);
```

---

## 2. Tracking Error Rates

### 2.1 View Error Rates in Vercel Dashboard

**Location:** Vercel Dashboard → Your Project → Analytics → Errors

**Steps:**
1. Go to **Analytics** tab
2. Click **Errors** section
3. View error rate over time
4. See error breakdown by:
   - Function name (which API route)
   - Error type (500, 400, etc.)
   - Time period

**Key Metrics:**
- **Error Rate**: Percentage of requests that fail
- **Error Count**: Total number of errors
- **Error Rate Trend**: Is it increasing or decreasing?

### 2.2 Error Rate Targets

**MVP Success Criteria:**
- ✅ Error rate < 1% over 24 hours
- ✅ No critical errors (500s) in production
- ✅ All errors logged to Sentry

**Monitoring Frequency:**
- Check daily during MVP phase
- Set up alerts for error rate spikes (see Section 4)

### 2.3 Common Error Types to Monitor

**1. API Route Errors (500)**
- Database connection failures
- External API failures (OpenAI, Pinecone)
- Unexpected exceptions

**2. Client Errors (400)**
- Invalid request data
- Missing required fields
- Validation failures

**3. Authentication Errors (401)**
- Missing or invalid Clerk tokens
- Expired sessions

**4. Rate Limit Errors (429)**
- Too many requests from same user
- API quota exceeded

**5. Timeout Errors (504)**
- Long-running operations
- External API timeouts

---

## 3. Monitoring API Response Times

### 3.1 View Function Performance

**Location:** Vercel Dashboard → Your Project → Analytics → Functions

**Steps:**
1. Go to **Analytics** tab
2. Click **Functions** section
3. View performance metrics for each API route

**Key Metrics:**
- **Duration**: Average response time per function
- **P50/P95/P99**: Percentile response times
- **Invocation Count**: Number of requests
- **Error Rate**: Percentage of failed requests

### 3.2 Response Time Targets

**MVP Success Criteria:**
- ✅ Chat API: < 3 seconds (end-to-end)
- ✅ Feedback API: < 500ms
- ✅ Dashboard API: < 2 seconds
- ✅ File Upload API: < 10 seconds (depends on file size)

**Monitoring:**
- Check P95 response times (95% of requests should be under target)
- Alert on P95 > target threshold

### 3.3 Identifying Slow Functions

**In Vercel Dashboard:**
1. Sort functions by **Duration** (descending)
2. Identify functions with high P95 times
3. Click on function to see detailed breakdown

**Common Slow Functions:**
- `/api/chat` - RAG query + OpenAI generation (expected to be slowest)
- `/api/files/upload` - File processing + Pinecone upsert
- `/api/dashboard/chunks` - Database queries with joins

**Optimization Strategies:**
- Add database indexes (already done for MVP)
- Cache frequently accessed data
- Optimize database queries
- Use edge runtime where possible

---

## 4. Setting Up Alerts

### 4.1 Vercel Alerts (Built-in)

**Location:** Vercel Dashboard → Your Project → Settings → Notifications

**Available Alerts:**
- Deployment failures
- Build failures
- Function errors (when error rate exceeds threshold)

**Steps to Enable:**
1. Go to **Settings** → **Notifications**
2. Configure email/Slack notifications
3. Set thresholds for alerts

**Recommended Alerts:**
- ✅ Alert on deployment failure
- ✅ Alert on build failure
- ✅ Alert on error rate > 5% (for MVP)

### 4.2 Sentry Alerts (Recommended)

**Why Sentry Alerts:**
- More granular control
- Better error grouping
- Performance monitoring
- Release tracking

**Setting Up Sentry Alerts:**

1. **Go to Sentry Dashboard** → Your Project → Alerts
2. **Create Alert Rule:**
   - **Trigger**: Error rate > 1% in 5 minutes
   - **Action**: Send email/Slack notification
   - **Filter**: Only production environment

3. **Create Performance Alert:**
   - **Trigger**: P95 response time > 3 seconds
   - **Action**: Send notification
   - **Filter**: `/api/chat` function only

4. **Create Critical Error Alert:**
   - **Trigger**: New error with level "fatal"
   - **Action**: Immediate notification
   - **Filter**: Production only

**Alert Best Practices:**
- ✅ Set reasonable thresholds (don't alert on every error)
- ✅ Use different channels for different severity levels
- ✅ Include context in alert messages
- ✅ Test alerts before relying on them

---

## 5. Monitoring Dashboard Setup

### 5.1 Create Monitoring Dashboard (Optional)

**For MVP:** Vercel's built-in analytics are sufficient.

**For Post-MVP:** Consider creating a custom monitoring dashboard that aggregates:
- Vercel function metrics
- Sentry error rates
- Database query performance
- External API health (OpenAI, Pinecone)

**Tools to Consider:**
- **Vercel Analytics** (built-in)
- **Sentry Performance** (already configured)
- **Custom Next.js API route** that aggregates metrics

### 5.2 Daily Monitoring Checklist

**Morning Routine (5 minutes):**
1. ✅ Check Vercel Logs for overnight errors
2. ✅ Review Sentry dashboard for new issues
3. ✅ Check error rate (should be < 1%)
4. ✅ Review slowest functions (P95 times)

**Weekly Review (15 minutes):**
1. ✅ Analyze error trends (increasing/decreasing)
2. ✅ Review performance trends (getting slower?)
3. ✅ Check database connection pool usage
4. ✅ Review external API usage (OpenAI, Pinecone costs)

---

## 6. Integration with Sentry

### 6.1 Sentry Already Configured

Pocket Genius already has Sentry configured:
- ✅ `sentry.server.config.ts` - Server-side error tracking
- ✅ `sentry.edge.config.ts` - Edge runtime tracking
- ✅ `instrumentation.ts` - Auto-initialization
- ✅ `next.config.ts` - Source map uploads

### 6.2 Viewing Errors in Sentry

**Location:** [Sentry Dashboard](https://sentry.io) → Your Project → Issues

**What Sentry Provides:**
- **Error Grouping**: Similar errors grouped together
- **Stack Traces**: Full error context
- **User Context**: Which users affected
- **Release Tracking**: Which deployment caused error
- **Performance Monitoring**: Slow transactions

### 6.3 Sentry vs Vercel Logs

**Use Vercel Logs For:**
- Real-time debugging
- Build logs
- Function execution logs
- Quick error checks

**Use Sentry For:**
- Error tracking and grouping
- Performance monitoring
- Release tracking
- User impact analysis
- Long-term error trends

**Best Practice:** Use both! Vercel for real-time, Sentry for analysis.

---

## 7. Monitoring API Routes

### 7.1 Key API Routes to Monitor

**Critical Routes (Monitor Daily):**
1. **`/api/chat`** - Core functionality
   - Monitor: Response time, error rate, rate limit hits
   - Alert: If error rate > 2% or P95 > 5 seconds

2. **`/api/feedback/message`** - User feedback
   - Monitor: Error rate, response time
   - Alert: If error rate > 1%

3. **`/api/files/upload`** - File ingestion
   - Monitor: Success rate, processing time
   - Alert: If error rate > 5% (file processing can be flaky)

**Important Routes (Monitor Weekly):**
4. **`/api/dashboard/chunks`** - Dashboard data
   - Monitor: Response time (should be < 2 seconds)
   - Alert: If P95 > 3 seconds

5. **`/api/conversations`** - Conversation list
   - Monitor: Response time
   - Alert: If P95 > 1 second

### 7.2 Adding Custom Metrics (Post-MVP)

**For advanced monitoring, consider tracking:**
- RAG retrieval quality (chunk relevance scores)
- Token usage per conversation (for cost tracking)
- User engagement metrics (messages per conversation)
- Chunk usage patterns (which chunks are most used)

**Implementation:**
```typescript
// Example: Track custom metric in Sentry
import * as Sentry from '@sentry/nextjs';

Sentry.metrics.distribution('rag.retrieval_score', score, {
  tags: { chatbotId },
  unit: 'none',
});
```

---

## 8. Troubleshooting Common Issues

### 8.1 High Error Rate

**Symptoms:**
- Error rate > 1% in Vercel Analytics
- Many errors in Sentry

**Steps to Debug:**
1. Check Vercel Logs for error patterns
2. Review Sentry Issues for grouped errors
3. Check external API status (OpenAI, Pinecone)
4. Review recent deployments (did a change break something?)

**Common Causes:**
- External API failures (OpenAI, Pinecone)
- Database connection issues
- Invalid environment variables
- Recent code changes

### 8.2 Slow API Response Times

**Symptoms:**
- P95 response time > target threshold
- Users reporting slow responses

**Steps to Debug:**
1. Check Vercel Functions analytics for slow functions
2. Review Sentry Performance for transaction breakdowns
3. Check database query performance (Neon Dashboard)
4. Review external API response times

**Common Causes:**
- Slow database queries (missing indexes)
- External API latency (OpenAI, Pinecone)
- Large payloads (too much data)
- Cold starts (first request after inactivity)

**Solutions:**
- Add database indexes (already done for MVP)
- Optimize queries (reduce joins, add limits)
- Cache frequently accessed data
- Use edge runtime for simple routes

### 8.3 Missing Logs

**Symptoms:**
- No logs appearing in Vercel Dashboard
- Errors not showing up

**Possible Causes:**
1. **Logs not being generated**
   - Check if `console.log` statements exist
   - Verify code is executing (add test logs)

2. **Wrong deployment selected**
   - Check you're viewing the correct deployment (Production vs Preview)

3. **Logs filtered out**
   - Check log filters in Vercel Dashboard
   - Verify log level (Info, Warning, Error)

4. **Sentry not configured**
   - Verify `SENTRY_DSN` is set in Vercel environment variables
   - Check Sentry dashboard for project status

---

## 9. Monitoring Best Practices

### 9.1 Logging Best Practices

**Structured Logging:**
```typescript
// Good: Structured with context
console.log('Chat request', {
  userId: dbUserId || 'anonymous',
  chatbotId,
  messageLength: lastMessage.content.length,
  timestamp: new Date().toISOString(),
});

// Bad: Unstructured string
console.log(`User ${dbUserId} sent message`);
```

**Error Logging:**
```typescript
// Good: Full error context
console.error('Pinecone query failed', {
  error: error.message,
  stack: error.stack,
  chatbotId,
  query: lastMessage.content.substring(0, 100), // First 100 chars only
});

// Bad: Just error message
console.error('Pinecone query failed');
```

### 9.2 Monitoring Frequency

**During MVP:**
- **Daily**: Check error rates, review logs
- **Weekly**: Review performance trends, analyze slow functions
- **After deployments**: Monitor closely for 1 hour

**Post-MVP:**
- **Real-time**: Set up alerts for critical errors
- **Daily**: Review error trends, performance metrics
- **Weekly**: Deep dive into performance optimization

### 9.3 What to Monitor

**Must Monitor (Critical):**
- ✅ Error rates (target: < 1%)
- ✅ API response times (target: < 3s for chat)
- ✅ Database connection health
- ✅ External API failures (OpenAI, Pinecone)

**Should Monitor (Important):**
- ✅ Function invocation counts (traffic patterns)
- ✅ Rate limit hits (are limits too strict?)
- ✅ File upload success rates
- ✅ User engagement metrics (messages per conversation)

**Nice to Monitor (Post-MVP):**
- Token usage per conversation (cost tracking)
- RAG retrieval quality scores
- Chunk usage patterns
- User feedback trends

---

## 10. Quick Reference

### 10.1 Vercel Dashboard URLs

- **Project Dashboard**: `https://vercel.com/dashboard`
- **Logs**: Project → Logs
- **Analytics**: Project → Analytics
- **Functions**: Project → Analytics → Functions
- **Errors**: Project → Analytics → Errors
- **Settings**: Project → Settings → Environment Variables

### 10.2 Key Metrics to Track

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Error Rate | < 1% | > 5% |
| Chat API P95 | < 3s | > 5s |
| Feedback API P95 | < 500ms | > 1s |
| Dashboard API P95 | < 2s | > 3s |
| Database Queries | < 200ms | > 500ms |

### 10.3 Daily Monitoring Checklist

- [ ] Check Vercel Logs for errors
- [ ] Review Sentry Issues for new errors
- [ ] Check error rate (< 1%)
- [ ] Review slowest functions (P95 times)
- [ ] Check external API status (OpenAI, Pinecone)

---

## 11. Next Steps

**Immediate Actions:**
1. ✅ Set up Vercel email notifications for deployment failures
2. ✅ Configure Sentry alerts for error rate > 1%
3. ✅ Review current error rates and performance metrics
4. ✅ Document any existing issues in Sentry

**Post-MVP Enhancements:**
- Set up custom monitoring dashboard
- Add performance budgets
- Implement custom metrics tracking
- Set up automated performance reports

---

**Last Updated:** December 2024

**Related Documentation:**
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment setup
- [ENV_VARIABLES.md](./ENV_VARIABLES.md) - Environment variables
- [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs)








