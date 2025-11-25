# Sentry + Pino Observability Architecture

**Date**: November 22, 2025
**Status**: ✅ Complete
**Version**: 1.0

## Executive Summary

Complete observability solution combining **Pino** (structured logging) with **Sentry** (error tracking & monitoring) for production-grade error tracking, performance monitoring, and distributed tracing.

### What We Built

1. **Server-side logging** - Pino with PCI-compliant redaction
2. **Client-side logging** - Browser console wrapper with Sentry integration
3. **Error tracking** - Automatic Sentry reporting with context
4. **Request correlation** - UUID-based request ID tracing
5. **Session replay** - Sentry replay for debugging user issues
6. **Source maps** - Automatic upload for readable stack traces

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Request                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Middleware                                  │
│  • Generate/reuse requestId (UUID)                              │
│  • Inject requestId into headers                                │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Application Code                              │
│                                                                  │
│  Server-side (lib/logger.ts):                                   │
│  ├─ Pino structured logging (JSON)                              │
│  ├─ PCI-compliant redaction                                     │
│  ├─ Request context extraction                                  │
│  └─ Sentry error capture                                        │
│                                                                  │
│  Client-side (lib/logger-client.ts):                            │
│  ├─ Console logging (dev-only for debug/info)                   │
│  ├─ Sentry error capture                                        │
│  └─ Breadcrumb tracking                                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
           ┌──────────────┴──────────────┐
           ▼                             ▼
┌──────────────────────┐      ┌──────────────────────┐
│   Pino Logs (JSON)   │      │   Sentry Platform    │
│  • CloudWatch        │      │  • Error tracking    │
│  • Datadog           │      │  • Performance APM   │
│  • Log aggregation   │      │  • Session replay    │
│  • Searchable logs   │      │  • Alerts & reports  │
└──────────────────────┘      └──────────────────────┘
```

---

## Implementation Details

### 1. Server-Side Logging (`lib/logger.ts`)

**Enhanced Features**:

- ✅ PCI-compliant redaction (payment cards, API keys, secrets)
- ✅ Request ID correlation
- ✅ Sentry error integration
- ✅ Error serialization helpers
- ✅ Context extraction from Next.js headers

**New Helper Functions**:

```typescript
// 1. Serialize errors consistently
import { serializeError } from '@/lib/logger'

try {
  await riskyOperation()
} catch (error) {
  logger.error(serializeError(error), 'Operation failed')
}

// 2. Get request context (requestId, userId)
import { getRequestContext } from '@/lib/logger'

const context = await getRequestContext()
logger.info({ ...context, amount }, 'Processing payment')

// 3. Log errors to both Pino AND Sentry
import { logError } from '@/lib/logger'

try {
  await updateStudent(studentId, data)
} catch (error) {
  await logError(logger, error, 'Failed to update student', { studentId })
}

// 4. Log warnings to Pino + Sentry breadcrumbs
import { logWarning } from '@/lib/logger'

await logWarning(logger, 'Unusual payment amount', { amount, customerId })
```

**Before vs After**:

```typescript
// ❌ BEFORE: Verbose and repetitive
try {
  await operation()
} catch (error) {
  logger.error(
    { err: error instanceof Error ? error : new Error(String(error)) },
    'Operation failed'
  )
}

// ✅ AFTER: Clean and concise
try {
  await operation()
} catch (error) {
  logger.error(serializeError(error), 'Operation failed')
}

// ✅ EVEN BETTER: Automatic Sentry reporting
try {
  await operation()
} catch (error) {
  await logError(logger, error, 'Operation failed', { operationId })
}
```

---

### 2. Client-Side Logging (`lib/logger-client.ts`)

**Enhanced Features**:

- ✅ Automatic Sentry error capture
- ✅ Breadcrumb tracking for debugging
- ✅ Conditional logging (dev-only for debug/info)
- ✅ Context tagging

**Usage Pattern**:

```typescript
import { createClientLogger } from '@/lib/logger-client'

const logger = createClientLogger('PaymentForm')

// Error: Always logged + sent to Sentry
logger.error('Payment failed', error)
// → Console output + Sentry error tracking

// Warning: Always logged + Sentry breadcrumb
logger.warn('Retry attempt', { attempt: 2 })
// → Console output + breadcrumb in Sentry

// Info: Dev-only console + breadcrumb
logger.info('Form submitted', formData)
// → Dev: console.info + breadcrumb
// → Prod: breadcrumb only

// Debug: Dev-only console + breadcrumb
logger.debug('Validation state', validationState)
// → Dev: console.log + breadcrumb
// → Prod: breadcrumb only
```

---

### 3. Request ID Middleware (`middleware.ts`)

**Purpose**: Generate unique requestId for every request to enable distributed tracing.

**Implementation**:

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Generate or reuse request ID
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()

  // Inject into response headers
  const response = NextResponse.next()
  response.headers.set('x-request-id', requestId)

  return response
}

// Applied to all routes (excludes static files)
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Request Flow**:

```
1. Request comes in → Middleware generates UUID
2. UUID stored in x-request-id header
3. Server code extracts requestId via getRequestContext()
4. All logs include requestId field
5. Sentry errors tagged with requestId
6. Search logs by requestId to trace request across services
```

---

### 4. Sentry Configuration

**Files Created**:

1. **`sentry.client.config.ts`** - Browser error tracking
   - Session replay (100% of errors, 10% of sessions)
   - Error filtering (ignore extensions, network errors)
   - Environment-based sampling

2. **`sentry.server.config.ts`** - Server error tracking
   - Prisma error handling
   - Sensitive data redaction
   - Performance profiling (10% in prod)

3. **`sentry.edge.config.ts`** - Edge runtime errors
   - Minimal configuration for middleware

4. **`instrumentation.ts`** - Next.js instrumentation hooks
   - Loads Sentry configs
   - `onRequestError` hook for nested RSC errors

5. **`app/global-error.tsx`** - Global error boundary
   - Catches React rendering errors
   - Reports to Sentry

**Environment Variables**:

```bash
# Client-side DSN (public, safe to expose)
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@xxxxx.ingest.us.sentry.io/xxxxx

# Server-side DSN (private)
SENTRY_DSN=https://xxxxx@xxxxx.ingest.us.sentry.io/xxxxx

# Org and project for source map uploads
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=irshad-center

# Auth token for CI/CD (scopes: project:releases, org:read)
SENTRY_AUTH_TOKEN=sntrys_xxxxx

# Optional: Release version (auto-set by CI/CD)
SENTRY_RELEASE=v1.0.0
```

---

### 5. Correlation Strategy

**How Logs and Errors are Connected**:

```typescript
// Example: Payment processing request

// 1. Middleware assigns requestId
// x-request-id: "550e8400-e29b-41d4-a716-446655440000"

// 2. Server action logs with requestId
const logger = createActionLogger('processPayment')
const context = await getRequestContext()
logger.info({ ...context, amount }, 'Processing payment')
// Pino output:
// {
//   "requestId": "550e8400-e29b-41d4-a716-446655440000",
//   "amount": 50,
//   "msg": "Processing payment",
//   "source": "action",
//   "action": "processPayment"
// }

// 3. Error occurs and logged
try {
  await chargeCard(amount)
} catch (error) {
  await logError(logger, error, 'Payment failed', { amount, customerId })
  // Pino output:
  // {
  //   "requestId": "550e8400-e29b-41d4-a716-446655440000",
  //   "err": { ... error details ... },
  //   "amount": 50,
  //   "customerId": "cus_123",
  //   "msg": "Payment failed"
  // }
  //
  // Sentry error:
  // - Tagged with requestId: "550e8400-e29b-41d4-a716-446655440000"
  // - Includes full stack trace
  // - Linked to session replay
}

// 4. Search by requestId in both systems
// Pino logs: Filter by requestId="550e8400-e29b-41d4-a716-446655440000"
// Sentry: Search tags.requestId:"550e8400-e29b-41d4-a716-446655440000"
// → See complete request lifecycle
```

---

## Usage Patterns by Context

### Server Actions

```typescript
import { createActionLogger, logError } from '@/lib/logger'

export async function updateStudentAction(
  studentId: string,
  data: StudentData
) {
  const logger = createActionLogger('updateStudent')

  try {
    logger.info({ studentId }, 'Updating student')
    const result = await updateStudent(studentId, data)
    logger.info({ studentId }, 'Student updated successfully')
    return { success: true, result }
  } catch (error) {
    await logError(logger, error, 'Failed to update student', {
      studentId,
      data,
    })
    return { success: false, error: 'Update failed' }
  }
}
```

### API Routes

```typescript
import { createAPILogger, logError } from '@/lib/logger'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const logger = createAPILogger('/api/admin/export')

  try {
    const body = await request.json()
    logger.info({ format: body.format }, 'Starting export')

    const data = await generateExport(body)

    logger.info({ recordCount: data.length }, 'Export completed')
    return NextResponse.json({ success: true, data })
  } catch (error) {
    await logError(logger, error, 'Export failed', { body })
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
```

### React Components (Client-side)

```typescript
'use client'

import { createClientLogger } from '@/lib/logger-client'
import { useState } from 'react'

export function PaymentForm() {
  const logger = createClientLogger('PaymentForm')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      logger.info('Submitting payment', { amount })
      const result = await processPayment(paymentData)
      logger.info('Payment successful', { transactionId: result.id })
    } catch (error) {
      logger.error('Payment failed', error)
      // Error automatically sent to Sentry
    } finally {
      setLoading(false)
    }
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

### Webhooks

```typescript
import { createWebhookLogger, logError } from '@/lib/logger'
import Stripe from 'stripe'

export async function POST(request: Request) {
  const logger = createWebhookLogger('mahad')

  try {
    const signature = request.headers.get('stripe-signature')
    const event = stripe.webhooks.constructEvent(body, signature, secret)

    logger.info(
      { eventType: event.type, eventId: event.id },
      'Webhook received'
    )

    await handleStripeEvent(event)

    logger.info({ eventType: event.type }, 'Webhook processed')
    return new Response('Success', { status: 200 })
  } catch (error) {
    await logError(logger, error, 'Webhook processing failed', { eventType })
    return new Response('Webhook error', { status: 400 })
  }
}
```

---

## Sentry Features Enabled

### 1. Error Tracking

**What It Does**: Captures all errors with full stack traces, context, and user information.

**When It Triggers**:

- Unhandled exceptions (server & client)
- Manual captures via `logError()`
- React rendering errors (via global-error.tsx)
- Server component errors (via onRequestError hook)

**Benefits**:

- Alerts when new errors occur
- Group similar errors automatically
- Track error frequency and affected users
- See full stack trace with source maps

### 2. Session Replay

**What It Does**: Records user sessions as video-like replays showing exactly what users see and do.

**Configuration**:

- 100% of sessions with errors (replaysOnErrorSampleRate: 1.0)
- 10% of normal sessions in production (replaysSessionSampleRate: 0.1)
- All text and media masked for privacy

**Benefits**:

- See exactly what user did before error
- Reproduce bugs easily
- Understand user behavior
- Debug visual issues

**Accessing Replays**:

1. Go to Sentry error
2. Click "Replays" tab
3. Watch session leading up to error

### 3. Performance Monitoring (APM)

**What It Does**: Tracks transaction performance, slow database queries, and API response times.

**Configuration**:

- 10% of transactions sampled in production
- 100% in development
- Automatic instrumentation of:
  - API routes
  - Database queries (Prisma)
  - External API calls

**Benefits**:

- Identify slow endpoints
- Track performance regressions
- Optimize database queries
- Monitor third-party API latency

### 4. Source Maps

**What It Does**: Uploads source maps so stack traces show original TypeScript code, not minified JavaScript.

**Configuration** (in `next.config.js`):

```javascript
{
  widenClientFileUpload: true,  // Upload more source maps
  hideSourceMaps: true,           // Don't expose in production
  automaticVercelMonitors: true,  // Integrate with Vercel Cron
}
```

**Benefits**:

- Readable stack traces
- Click to exact line in source code
- Debug minified production errors

### 5. Breadcrumbs

**What It Does**: Tracks user actions, network requests, console logs leading up to errors.

**Automatic Breadcrumbs**:

- All client-side logger calls (info, debug, warn)
- Navigation events
- Network requests
- Console logs

**Manual Breadcrumbs**:

```typescript
Sentry.addBreadcrumb({
  message: 'User started checkout',
  category: 'navigation',
  level: 'info',
  data: { cartTotal: 50 },
})
```

**Benefits**:

- Understand error context
- See what led to failure
- Debug complex user flows

---

## Migration from Console Logging

**Old Pattern** (90+ occurrences):

```typescript
try {
  await operation()
} catch (error) {
  console.error('Operation failed:', error)
  // ❌ Lost when container restarts
  // ❌ No alerting
  // ❌ Can't search or aggregate
}
```

**New Pattern**:

```typescript
import { createActionLogger, logError } from '@/lib/logger'

const logger = createActionLogger('operation')

try {
  await operation()
} catch (error) {
  await logError(logger, error, 'Operation failed', { operationId })
  // ✅ Persisted to log aggregator
  // ✅ Sentry alert + email
  // ✅ Searchable by requestId
  // ✅ Session replay attached
}
```

---

## Production Deployment Checklist

### Before Deploying

- [ ] Set Sentry DSN environment variables
- [ ] Configure Sentry auth token for CI/CD
- [ ] Test error reporting in staging
- [ ] Verify source maps upload
- [ ] Configure Sentry alerts (email/Slack)

### Sentry Project Setup

1. **Create Sentry project**:
   - Go to https://sentry.io
   - Create new project → Next.js
   - Copy DSN

2. **Set environment variables**:

   ```bash
   # Production
   SENTRY_DSN=https://xxxxx@xxxxx.ingest.us.sentry.io/xxxxx
   NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@xxxxx.ingest.us.sentry.io/xxxxx
   SENTRY_ORG=your-org
   SENTRY_PROJECT=irshad-center
   SENTRY_AUTH_TOKEN=sntrys_xxxxx
   ```

3. **Configure alerts**:
   - Sentry → Alerts → New Alert Rule
   - "When an issue is first seen"
   - Send to: Email or Slack

4. **Set up releases** (optional):
   ```bash
   # In CI/CD pipeline
   export SENTRY_RELEASE=$(git rev-parse HEAD)
   npm run build
   # Sentry webpack plugin auto-uploads source maps
   ```

### Vercel Configuration

Add environment variables in Vercel dashboard:

- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_AUTH_TOKEN`

### Testing in Production

```typescript
// Test error reporting
import * as Sentry from '@sentry/nextjs'

// Trigger test error
Sentry.captureMessage('Test error from production', 'error')

// Verify in Sentry dashboard:
// 1. Error appears
// 2. Request ID tagged
// 3. Session replay attached (if configured)
```

---

## Monitoring & Debugging

### Finding Errors

**In Sentry**:

1. Go to Sentry dashboard → Issues
2. Filter by:
   - Environment (production, staging, development)
   - Tags (requestId, userId, context)
   - Time range
3. Click issue to see:
   - Full stack trace
   - Session replay
   - Breadcrumbs
   - Similar issues

**In Logs (CloudWatch/Datadog)**:

1. Search by requestId
2. Filter by level=error
3. See full request flow:
   ```json
   {
     "level": 30,
     "requestId": "550e8400-e29b-41d4-a716-446655440000",
     "msg": "Processing payment"
   }
   {
     "level": 50,
     "requestId": "550e8400-e29b-41d4-a716-446655440000",
     "err": {...},
     "msg": "Payment failed"
   }
   ```

### Debugging Workflow

1. **Error Alert**: Get email/Slack notification from Sentry
2. **View Session Replay**: See exactly what user did
3. **Check Breadcrumbs**: Understand user flow
4. **Find requestId**: In Sentry error tags
5. **Search Logs**: Filter by requestId in log aggregator
6. **Trace Request**: Follow requestId through all services
7. **Reproduce**: Use replay + logs to recreate locally
8. **Fix & Deploy**: Sentry tracks if error resolved

---

## Performance Considerations

### Pino Performance

- ✅ **Fast**: ~3,000 ns/op (10x faster than Winston)
- ✅ **Async**: Non-blocking I/O
- ✅ **JSON**: Efficient serialization
- ✅ **Tree-shaking**: Only load what you use

### Sentry Performance

- ✅ **Async**: Non-blocking error capture
- ✅ **Sampling**: 10% of transactions in prod
- ✅ **Throttling**: Rate limiting built-in
- ✅ **Batching**: Groups events before sending

### Client-Side Considerations

- ✅ **Dev-only logging**: Debug/info logs stripped in production
- ✅ **Error-only in prod**: Only errors sent to Sentry
- ✅ **Replay sampling**: 10% of sessions recorded
- ✅ **Bundle size**: Sentry adds ~50KB gzipped

---

## Cost Optimization

### Sentry Pricing Tiers

- **Free**: 5K errors/month, 50 replays/month
- **Team**: $26/month - 50K errors, 500 replays
- **Business**: $80/month - 100K errors, 1K replays

### Reducing Costs

1. **Lower replay sampling**:

   ```typescript
   // sentry.client.config.ts
   replaysSessionSampleRate: 0.05 // 5% instead of 10%
   ```

2. **Filter ignored errors**:

   ```typescript
   ignoreErrors: [/network error/i, /failed to fetch/i]
   ```

3. **Rate limiting**:

   ```typescript
   beforeSend(event) {
     // Skip events from bots
     if (event.request?.headers?.['user-agent']?.includes('bot')) {
       return null
     }
     return event
   }
   ```

4. **Sampling adjustments**:
   ```typescript
   tracesSampleRate: 0.05 // 5% of transactions
   ```

---

## Troubleshooting

### Source Maps Not Uploading

**Symptom**: Stack traces show minified code in Sentry.

**Solution**:

1. Check `SENTRY_AUTH_TOKEN` is set
2. Verify auth token has `project:releases` scope
3. Check build logs for upload errors
4. Ensure `SENTRY_ORG` and `SENTRY_PROJECT` match Sentry dashboard

### Errors Not Appearing in Sentry

**Symptom**: Errors logged but not in Sentry dashboard.

**Solution**:

1. Check `SENTRY_DSN` environment variable is set
2. Verify DSN is correct (copy from Sentry dashboard)
3. Check `beforeSend` hook isn't filtering errors
4. Test with `Sentry.captureMessage('test')`
5. Check network tab for `sentry.io` requests

### Request ID Not Appearing in Logs

**Symptom**: Logs missing requestId field.

**Solution**:

1. Verify middleware is running (check headers in browser DevTools)
2. Ensure `await getRequestContext()` is called
3. Check middleware matcher includes the route
4. Restart dev server after middleware changes

### High Sentry Bill

**Solution**:

1. Lower sampling rates (traces, replays)
2. Add more filters to `ignoreErrors`
3. Filter in `beforeSend` hook
4. Upgrade to higher tier (lower per-error cost)

---

## Next Steps & Enhancements

### Short Term (Recommended)

1. **Add log aggregation**:
   - Set up CloudWatch Logs or Datadog
   - Configure log shipping from Vercel
   - Create dashboards for common queries

2. **Configure Sentry alerts**:
   - Email on new errors
   - Slack integration
   - Weekly error summary reports

3. **Set up Sentry releases**:
   - Auto-tag releases with git SHA
   - Track which version introduced errors
   - Auto-resolve errors on new deploys

### Medium Term (Optional)

4. **User identification**:

   ```typescript
   Sentry.setUser({
     id: userId,
     email: userEmail,
   })
   ```

5. **Custom Sentry dashboards**:
   - Error rate by route
   - Performance by endpoint
   - User impact reports

6. **Performance budgets**:
   - Alert if API route > 1s
   - Track slow database queries
   - Monitor Stripe API latency

### Long Term (Future)

7. **Distributed tracing**:
   - OpenTelemetry integration
   - Trace across microservices
   - Database query tracing

8. **Advanced analytics**:
   - Add PostHog for product analytics
   - Correlate errors with user behavior
   - A/B test error recovery flows

---

## Documentation & Training

### For Developers

**Quick Start**:

- Import logger: `import { createActionLogger } from '@/lib/logger'`
- Use `logError()` for errors: `await logError(logger, error, 'Failed', { context })`
- Add context to logs: `const context = await getRequestContext()`

**Key Files**:

- `lib/logger.ts` - Server logging
- `lib/logger-client.ts` - Client logging
- `middleware.ts` - Request ID injection
- `sentry.*.config.ts` - Sentry configuration

### For Operations

**Accessing Logs**:

- Pino logs → CloudWatch Logs / Datadog
- Sentry errors → https://sentry.io
- Search by requestId to trace requests

**Common Queries**:

```
# Find all errors for a request
requestId="550e8400-e29b-41d4-a716-446655440000"

# Find errors in last hour
level=error AND @timestamp > now-1h

# Find slow API routes
source=api AND duration > 1000
```

---

## Conclusion

Complete observability solution is now in place:

✅ **Structured logging** - Pino with PCI compliance
✅ **Error tracking** - Sentry with session replay
✅ **Request correlation** - UUID-based tracing
✅ **Helper functions** - Simplified error handling
✅ **Source maps** - Readable stack traces
✅ **Client & server** - Full coverage

**Production Ready**: All code tested, built successfully, and documented.

**Next Step**: Set up Sentry account and configure environment variables for production deployment.

---

## Resources

- **Pino Documentation**: https://getpino.io
- **Sentry Next.js Guide**: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- **Source Code**:
  - `lib/logger.ts` - Server logging
  - `lib/logger-client.ts` - Client logging
  - `middleware.ts` - Request ID injection
  - `sentry.*.config.ts` - Sentry configs
- **Migration Summary**: `docs/LOGGING_MIGRATION_COMPLETE.md`
- **Pino Review**: `docs/PINO_IMPLEMENTATION_REVIEW.md`
