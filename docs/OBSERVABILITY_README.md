# Observability Documentation - Quick Reference

Complete guide to logging, error tracking, and monitoring in the Irshad Center application.

---

## 📚 Documentation Index

### Implementation Status

| Document                            | Status      | Purpose                                           |
| ----------------------------------- | ----------- | ------------------------------------------------- |
| `LOGGING_MIGRATION_COMPLETE.md`     | ✅ Complete | Console.log → Pino migration (91 calls, 40 files) |
| `PINO_IMPLEMENTATION_REVIEW.md`     | ✅ Complete | Pino best practices review (Grade: 8.5/10)        |
| `SENTRY_IMPLEMENTATION_COMPLETE.md` | ✅ Complete | Sentry integration summary (Quick reference)      |
| `SENTRY_PINO_OBSERVABILITY.md`      | ✅ Complete | Complete observability guide (Full documentation) |
| `OBSERVABILITY_ARCHITECTURE.md`     | ℹ️ Research | PostHog research (superseded by Sentry)           |

---

## 🚀 Quick Start

### For Developers

**Import the logger**:

```typescript
// Server-side (actions, API routes, services)
import { createActionLogger, logError } from '@/lib/logger'

const logger = createActionLogger('myAction')

try {
  await riskyOperation()
} catch (error) {
  await logError(logger, error, 'Operation failed', { context })
}

// Client-side (React components)
import { createClientLogger } from '@/lib/logger-client'

const logger = createClientLogger('MyComponent')
logger.error('Something went wrong', error) // Sends to Sentry
```

**Key helper functions**:

- `serializeError(error)` - Clean error serialization
- `getRequestContext()` - Get requestId and userId
- `logError(logger, error, message, context)` - Log to Pino AND Sentry
- `logWarning(logger, message, context)` - Log warning + breadcrumb

---

## 📖 Documentation Guide

### Start Here

**New to the project?** Read in this order:

1. **`SENTRY_IMPLEMENTATION_COMPLETE.md`** (10 min read)
   - Quick overview of what was built
   - Before/after examples
   - Usage patterns
   - Production deployment checklist

2. **`SENTRY_PINO_OBSERVABILITY.md`** (30 min read)
   - Complete architecture guide
   - Detailed usage patterns for all contexts
   - Monitoring and debugging workflow
   - Troubleshooting guide

### Deep Dives

**Need more details?** Check these:

3. **`LOGGING_MIGRATION_COMPLETE.md`**
   - Historical context: Console → Pino migration
   - Statistics: 91 calls migrated across 40 files
   - Original patterns and benefits

4. **`PINO_IMPLEMENTATION_REVIEW.md`**
   - Comprehensive Pino audit
   - Issues identified and fixed
   - Recommendations (now implemented)

5. **`OBSERVABILITY_ARCHITECTURE.md`**
   - PostHog research (optional, for future)
   - Three-layer observability strategy
   - Not currently implemented (Sentry chosen instead)

---

## 🏗️ Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Request                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
                  ┌───────────────┐
                  │  Middleware   │ Injects requestId (UUID)
                  └───────┬───────┘
                          │
                          ▼
                ┌─────────────────────┐
                │  Application Code   │
                └─────────┬───────────┘
                          │
              ┌───────────┴────────────┐
              │                        │
              ▼                        ▼
       ┌──────────┐            ┌──────────┐
       │   Pino   │            │  Sentry  │
       │  Logging │            │  Errors  │
       └──────────┘            └──────────┘
              │                        │
              ▼                        ▼
        CloudWatch              Error Dashboard
        Datadog                 Session Replay
        Log Search              Performance APM
```

**Key Components**:

- **Middleware** (`middleware.ts`) - Request ID injection
- **Server Logger** (`lib/logger.ts`) - Pino + Sentry integration
- **Client Logger** (`lib/logger-client.ts`) - Browser console + Sentry
- **Sentry Configs** (`sentry.*.config.ts`) - Error tracking setup
- **Instrumentation** (`instrumentation.ts`) - Next.js hooks

---

## 🎯 What We Have

### Logging (Pino)

✅ Structured JSON logging
✅ PCI-compliant redaction (payment cards, API keys)
✅ Environment-aware log levels
✅ Contextual loggers (action, API, service, webhook, cron)
✅ Pretty-printed in development, JSON in production

### Error Tracking (Sentry)

✅ Automatic error capture (server & client)
✅ Session replay (see what users did before errors)
✅ Performance monitoring (API routes, database queries)
✅ Source maps (readable stack traces)
✅ Request correlation (trace by requestId)
✅ Breadcrumbs (understand error context)

### Helpers & Tools

✅ `serializeError()` - Clean error serialization
✅ `getRequestContext()` - Extract requestId/userId from headers
✅ `logError()` - Log to Pino AND Sentry with correlation
✅ `logWarning()` - Log warnings + Sentry breadcrumbs
✅ Request ID middleware - Automatic UUID injection
✅ Global error boundary - Catch React rendering errors

---

## 🔍 Finding Information

### "How do I log an error?"

**Server-side**:

```typescript
import { logError } from '@/lib/logger'
await logError(logger, error, 'Operation failed', { context })
```

**Client-side**:

```typescript
import { createClientLogger } from '@/lib/logger-client'
const logger = createClientLogger('Component')
logger.error('Error message', error)
```

See: `SENTRY_PINO_OBSERVABILITY.md` → "Usage Patterns by Context"

---

### "How do I trace a request?"

1. Get requestId from Sentry error tags or Pino logs
2. Search Pino logs: `requestId="550e8400-..."`
3. Search Sentry: `tags.requestId:"550e8400-..."`
4. See complete request flow across both systems

See: `SENTRY_PINO_OBSERVABILITY.md` → "Correlation Strategy"

---

### "How do I set up Sentry for production?"

1. Create Sentry project at https://sentry.io
2. Copy DSN from project settings
3. Set environment variables in Vercel:
   - `SENTRY_DSN`
   - `NEXT_PUBLIC_SENTRY_DSN`
   - `SENTRY_ORG`
   - `SENTRY_PROJECT`
   - `SENTRY_AUTH_TOKEN`
4. Deploy and verify errors appear in Sentry

See: `SENTRY_IMPLEMENTATION_COMPLETE.md` → "Production Deployment"

---

### "What helper functions are available?"

**Server-side (`lib/logger.ts`)**:

- `serializeError(error)` - Convert unknown error to Pino format
- `getRequestContext()` - Get requestId and userId from headers
- `logError(logger, error, msg, ctx)` - Log to Pino + Sentry
- `logWarning(logger, msg, ctx)` - Log warning + breadcrumb

**Client-side (`lib/logger-client.ts`)**:

- `createClientLogger(context)` - Create logger with context
- `logger.error(msg, ...args)` - Log error + send to Sentry
- `logger.warn(msg, ...args)` - Log warning + breadcrumb
- `logger.info(msg, ...args)` - Dev-only log + breadcrumb
- `logger.debug(msg, ...args)` - Dev-only log + breadcrumb

See: `SENTRY_PINO_OBSERVABILITY.md` → "Enhanced Error Handling & Correlation"

---

### "How do I debug an error in production?"

1. **Get alert** from Sentry (email/Slack)
2. **View error** in Sentry dashboard
3. **Watch session replay** to see what user did
4. **Check breadcrumbs** to understand context
5. **Find requestId** in error tags
6. **Search logs** by requestId in CloudWatch/Datadog
7. **Trace request** through entire system
8. **Reproduce locally** using replay + logs

See: `SENTRY_PINO_OBSERVABILITY.md` → "Debugging Workflow"

---

### "What's the cost of Sentry?"

- **Free**: 5K errors/month, 50 replays/month
- **Team**: $26/month - 50K errors, 500 replays
- **Business**: $80/month - 100K errors, 1K replays

**Optimization tips**:

- Lower replay sampling to 5%
- Filter ignored errors (network errors, bots)
- Adjust trace sampling to 5%

See: `SENTRY_PINO_OBSERVABILITY.md` → "Cost Optimization"

---

## 📝 Usage Patterns

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
    logger.info({ studentId }, 'Student updated')
    return { success: true, result }
  } catch (error) {
    await logError(logger, error, 'Failed to update student', { studentId })
    return { success: false }
  }
}
```

### API Routes

```typescript
import { createAPILogger, logError } from '@/lib/logger'

export async function POST(request: Request) {
  const logger = createAPILogger('/api/admin/export')

  try {
    const body = await request.json()
    logger.info({ format: body.format }, 'Starting export')
    const data = await generateExport(body)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    await logError(logger, error, 'Export failed', { body })
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
```

### React Components

```typescript
'use client'

import { createClientLogger } from '@/lib/logger-client'

export function PaymentForm() {
  const logger = createClientLogger('PaymentForm')

  const handleSubmit = async () => {
    try {
      logger.info('Submitting payment')
      await processPayment(data)
      logger.info('Payment successful')
    } catch (error) {
      logger.error('Payment failed', error)  // Sends to Sentry
    }
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

See: `SENTRY_PINO_OBSERVABILITY.md` → "Usage Patterns by Context"

---

## ✅ Implementation Checklist

### Already Done

- [x] Install Sentry for Next.js
- [x] Create Sentry configuration files
- [x] Enhance Pino logger with Sentry integration
- [x] Add request ID middleware
- [x] Create helper functions (logError, serializeError, etc.)
- [x] Enhance client logger with Sentry
- [x] Add global error boundary
- [x] Configure source map uploads
- [x] Update environment variables example
- [x] Write comprehensive documentation
- [x] Verify build success

### To Do (Production Setup)

- [ ] Create Sentry account/project
- [ ] Set Sentry environment variables in Vercel
- [ ] Generate Sentry auth token
- [ ] Deploy to production
- [ ] Test error reporting
- [ ] Configure Sentry alerts
- [ ] Set up log aggregation (CloudWatch/Datadog)

---

## 🆘 Troubleshooting

### Errors not appearing in Sentry

1. Check `SENTRY_DSN` environment variable is set
2. Verify DSN matches Sentry dashboard
3. Check network tab for `sentry.io` requests
4. Test with `Sentry.captureMessage('test')`

### Source maps not uploading

1. Check `SENTRY_AUTH_TOKEN` is set
2. Verify token has `project:releases` scope
3. Check build logs for upload errors
4. Ensure `SENTRY_ORG` and `SENTRY_PROJECT` match

### Request ID not in logs

1. Verify middleware is running (check headers in DevTools)
2. Ensure `await getRequestContext()` is called
3. Check middleware matcher includes the route
4. Restart dev server

See: `SENTRY_PINO_OBSERVABILITY.md` → "Troubleshooting"

---

## 📞 Support

- **Sentry Docs**: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- **Pino Docs**: https://getpino.io
- **Questions**: Check the comprehensive docs in this folder

---

## 📂 File Locations

### Documentation

- `/docs/LOGGING_MIGRATION_COMPLETE.md` - Pino migration summary
- `/docs/PINO_IMPLEMENTATION_REVIEW.md` - Pino audit
- `/docs/SENTRY_IMPLEMENTATION_COMPLETE.md` - Sentry quick reference
- `/docs/SENTRY_PINO_OBSERVABILITY.md` - Complete guide
- `/docs/OBSERVABILITY_ARCHITECTURE.md` - PostHog research

### Code

- `/lib/logger.ts` - Server logging
- `/lib/logger-client.ts` - Client logging
- `/middleware.ts` - Request ID injection
- `/sentry.client.config.ts` - Client Sentry config
- `/sentry.server.config.ts` - Server Sentry config
- `/sentry.edge.config.ts` - Edge Sentry config
- `/instrumentation.ts` - Next.js hooks
- `/app/global-error.tsx` - Global error boundary
- `/next.config.js` - Sentry webpack plugin

### Configuration

- `/.env.local.example` - Environment variables template
- `/.eslintrc.json` - ESLint rules (no-console warning)

---

**Last Updated**: November 22, 2025
**Version**: 1.0
**Status**: ✅ Production Ready
