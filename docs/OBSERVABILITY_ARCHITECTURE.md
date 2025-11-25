# Complete Observability Architecture: Pino + PostHog

**Date**: November 23, 2025
**Status**: Implementation Guide
**Stack**: Next.js 15 + Pino + PostHog (+ Optional Sentry)

---

## Executive Summary

This document outlines a **three-layer observability strategy** that provides complete visibility into system health, user behavior, and business metrics:

1. **Pino** - Server-side structured logging (debugging, system health)
2. **PostHog** - Product analytics + event tracking (user behavior, features)
3. **Sentry** (Optional) - Deep error tracking (stack traces, performance)

**Key Insight**: Don't choose between tools - use each for what it does best.

---

## The Problem: Traditional Monitoring is Incomplete

### What's Missing with Only Logging?

```typescript
// You know WHAT happened
logger.error({ userId: '123' }, 'Payment failed')

// But you don't know:
// - What was the user doing before this?
// - How many users hit this error?
// - Which feature flags were enabled?
// - What's the session replay?
```

### What's Missing with Only Analytics?

```typescript
// You know user clicked "Submit Payment"
posthog.capture('payment_submitted', { amount: 100 })

// But you don't know:
// - What server errors occurred?
// - Database query performance
// - API latency breakdown
// - System resource usage
```

**Solution**: Combine both for complete observability.

---

## Architecture: Three Layers of Observability

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER EXPERIENCE                          │
│                                                                 │
│  PostHog: Analytics, Session Replay, Feature Flags             │
│  "What are users doing? How do they feel?"                     │
└────────────┬────────────────────────────────────┬──────────────┘
             │                                    │
             ▼                                    ▼
┌────────────────────────┐          ┌────────────────────────┐
│   APPLICATION LAYER    │          │    SYSTEM LAYER        │
│                        │          │                        │
│  PostHog Events        │          │  Pino Structured Logs  │
│  - User actions        │          │  - Server errors       │
│  - Feature usage       │          │  - Database queries    │
│  - A/B test results    │          │  - API performance     │
│                        │          │  - System metrics      │
└────────────────────────┘          └────────────────────────┘
             │                                    │
             └────────────┬───────────────────────┘
                          ▼
             ┌────────────────────────┐
             │   ERROR TRACKING       │
             │                        │
             │  Sentry (Optional)     │
             │  - Stack traces        │
             │  - Performance APM     │
             │  - Release tracking    │
             └────────────────────────┘
```

---

## Tool Comparison: When to Use What

| Capability             | Pino     | PostHog  | Sentry     |
| ---------------------- | -------- | -------- | ---------- |
| **Server Logs**        | ✅ Best  | ❌ No    | ⚠️ Limited |
| **User Analytics**     | ❌ No    | ✅ Best  | ❌ No      |
| **Error Tracking**     | ⚠️ Basic | ⚠️ Good  | ✅ Best    |
| **Session Replay**     | ❌ No    | ✅ Yes   | ✅ Yes     |
| **Feature Flags**      | ❌ No    | ✅ Yes   | ❌ No      |
| **Performance APM**    | ❌ No    | ⚠️ Basic | ✅ Best    |
| **A/B Testing**        | ❌ No    | ✅ Yes   | ❌ No      |
| **Cost (Open Source)** | ✅ Free  | ✅ Free  | ⚠️ Paid    |

### Decision Matrix

**Use Pino When:**

- Debugging server-side logic
- Tracking database queries
- Monitoring API performance
- System health checks
- Compliance/audit logging

**Use PostHog When:**

- Understanding user behavior
- Tracking feature adoption
- Running A/B tests
- Analyzing conversion funnels
- Product analytics

**Use Sentry When:** (Optional)

- Need deep stack traces
- Complex performance monitoring
- Release health tracking
- Large engineering team coordination

---

## Implementation Strategy

### Phase 1: Enhance Pino (Logging Foundation)

**Goal**: Improve existing Pino implementation with correlation IDs and helpers.

#### 1.1 Add Request ID Middleware

**File**: `middleware.ts`

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'

export function middleware(request: NextRequest) {
  // Generate or extract request ID
  const requestId = request.headers.get('x-request-id') || randomUUID()

  // Add to request
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-request-id', requestId)

  // Add to response
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  response.headers.set('x-request-id', requestId)

  return response
}

export const config = {
  matcher: ['/api/:path*', '/admin/:path*'],
}
```

#### 1.2 Enhanced Logger with Request Context

**File**: `lib/logger.ts` (additions)

```typescript
import { headers } from 'next/headers'

/**
 * Safely serialize an error for logging
 * Handles Error objects, Prisma errors, and unknown types
 */
export function serializeError(error: unknown): { err: Error } {
  if (error instanceof Error) {
    return { err: error }
  }

  // Handle Prisma errors specifically
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = new Error((error as any).message || String(error))
    ;(prismaError as any).code = (error as any).code
    ;(prismaError as any).meta = (error as any).meta
    return { err: prismaError }
  }

  return { err: new Error(String(error)) }
}

/**
 * Get current request context (request ID, user ID)
 * Safe to call from Server Components and Server Actions
 */
export function getRequestContext() {
  try {
    const headersList = headers()
    return {
      requestId: headersList.get('x-request-id') || undefined,
      userAgent: headersList.get('user-agent') || undefined,
    }
  } catch {
    // Not in request context (e.g., build time)
    return {}
  }
}

/**
 * Create logger with automatic request context
 */
export function createContextualLogger(context: Record<string, unknown>) {
  const requestContext = getRequestContext()
  return createLogger({ ...requestContext, ...context })
}

// Enhanced API logger with request context
export function createAPILogger(route: string) {
  return createContextualLogger({ source: 'api', route })
}

// Enhanced action logger with request context
export function createActionLogger(action: string) {
  return createContextualLogger({ source: 'action', action })
}
```

#### 1.3 Simplified Error Logging

**Usage**:

```typescript
// Before (verbose)
logger.error(
  { err: error instanceof Error ? error : new Error(String(error)) },
  'Failed to delete family'
)

// After (clean)
logger.error(serializeError(error), 'Failed to delete family')

// Even better - add context
logger.error(
  { ...serializeError(error), familyId, userId },
  'Failed to delete family'
)
```

---

### Phase 2: Integrate PostHog (Analytics + Events)

**Goal**: Track user behavior, feature usage, and product metrics.

#### 2.1 Install PostHog

```bash
npm install posthog-js posthog-node
```

#### 2.2 PostHog Provider (Client-Side)

**File**: `app/providers/posthog-provider.tsx`

```typescript
'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Initialize PostHog (only once)
    if (typeof window !== 'undefined') {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        person_profiles: 'identified_only',

        // 2025 defaults - auto-track pageviews and pageleaves
        defaults: '2025-05-24',

        // Enable session recording
        session_recording: {
          maskAllInputs: false, // Customize based on privacy needs
          maskInputFn: (text, element) => {
            // Mask sensitive fields
            if (element?.attributes?.['data-sensitive']) return '*'.repeat(text.length)
            return text
          },
        },

        // Capture additional context
        capture_pageview: false, // Handled by defaults
        capture_pageleave: true,

        // Error tracking integration
        capture_exceptions: true,
      })
    }
  }, [])

  // Track route changes
  useEffect(() => {
    if (pathname) {
      posthog.capture('$pageview', {
        $current_url: window.location.href,
      })
    }
  }, [pathname, searchParams])

  return <>{children}</>
}
```

#### 2.3 PostHog Server Client

**File**: `lib/posthog-server.ts`

```typescript
import { PostHog } from 'posthog-node'

export const posthogServer = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  flushAt: 20, // Send events in batches
  flushInterval: 10000, // Send every 10s
})

// Graceful shutdown
if (process.env.NODE_ENV === 'production') {
  process.on('SIGTERM', async () => {
    await posthogServer.shutdown()
  })
}
```

#### 2.4 PostHog Hook (Client-Side)

**File**: `lib/hooks/use-posthog.ts`

```typescript
'use client'

import { useCallback } from 'react'
import posthog from 'posthog-js'

export function usePostHog() {
  const identify = useCallback(
    (userId: string, traits?: Record<string, any>) => {
      posthog.identify(userId, traits)
    },
    []
  )

  const capture = useCallback(
    (eventName: string, properties?: Record<string, any>) => {
      posthog.capture(eventName, properties)
    },
    []
  )

  const setPersonProperties = useCallback((properties: Record<string, any>) => {
    posthog.setPersonProperties(properties)
  }, [])

  return {
    identify,
    capture,
    setPersonProperties,
    posthog, // Access to full API
  }
}
```

#### 2.5 Correlation: Link Pino Logs with PostHog Events

**Key Pattern**: Use common identifiers in both systems.

```typescript
// Server Action Example
import { createActionLogger } from '@/lib/logger'
import { posthogServer } from '@/lib/posthog-server'

const logger = createActionLogger('registerStudent')

export async function registerStudent(data: StudentData) {
  const requestId = getRequestContext().requestId

  logger.info(
    {
      requestId,
      studentEmail: data.email,
    },
    'Starting student registration'
  )

  try {
    const student = await prisma.student.create({ data })

    // Log to Pino (debugging)
    logger.info(
      {
        requestId,
        studentId: student.id,
        studentEmail: data.email,
      },
      'Student created successfully'
    )

    // Track in PostHog (analytics)
    await posthogServer.capture({
      distinctId: student.id,
      event: 'student_registered',
      properties: {
        requestId, // 🔗 Correlation key
        program: 'mahad',
        registrationSource: 'self_service',
      },
    })

    return { success: true, student }
  } catch (error) {
    // Log error to Pino
    logger.error(
      {
        ...serializeError(error),
        requestId,
        studentEmail: data.email,
      },
      'Student registration failed'
    )

    // Track error in PostHog
    await posthogServer.capture({
      distinctId: data.email,
      event: 'student_registration_failed',
      properties: {
        requestId, // 🔗 Correlation key
        errorType: error instanceof Error ? error.constructor.name : 'unknown',
      },
    })

    throw error
  }
}
```

**Benefits**:

- Search Pino logs by `requestId` to see server details
- Search PostHog by `requestId` to see user journey
- Watch session replay of the exact request
- Correlate errors across both systems

---

### Phase 3: Event Taxonomy (Standardize Tracking)

**Goal**: Create consistent event naming and properties.

#### 3.1 Event Naming Convention

```typescript
// Pattern: {object}_{action}
// Examples:
'student_registered'
'payment_submitted'
'feature_enabled'
'error_occurred'

// Group events by category
'funnel_*' // Conversion events
'feature_*' // Feature usage
'error_*' // Error events
'engagement_*' // User engagement
```

#### 3.2 Centralized Event Tracking

**File**: `lib/analytics/events.ts`

```typescript
import { posthogServer } from '@/lib/posthog-server'
import { createServiceLogger } from '@/lib/logger'

const logger = createServiceLogger('analytics')

interface BaseEventProperties {
  requestId?: string
  source?: 'web' | 'api' | 'webhook'
}

interface StudentRegisteredProperties extends BaseEventProperties {
  program: 'mahad' | 'dugsi'
  registrationSource: 'self_service' | 'admin'
  hasSiblings: boolean
}

interface PaymentSubmittedProperties extends BaseEventProperties {
  amount: number
  currency: string
  paymentMethod: 'card' | 'ach'
}

/**
 * Track student registration event
 * Logs to both Pino and PostHog
 */
export async function trackStudentRegistered(
  userId: string,
  properties: StudentRegisteredProperties
) {
  // Log to Pino
  logger.info(
    {
      userId,
      event: 'student_registered',
      ...properties,
    },
    'Student registered'
  )

  // Track in PostHog
  await posthogServer.capture({
    distinctId: userId,
    event: 'student_registered',
    properties,
  })
}

/**
 * Track payment submission
 */
export async function trackPaymentSubmitted(
  userId: string,
  properties: PaymentSubmittedProperties
) {
  logger.info(
    {
      userId,
      event: 'payment_submitted',
      ...properties,
    },
    'Payment submitted'
  )

  await posthogServer.capture({
    distinctId: userId,
    event: 'payment_submitted',
    properties: {
      ...properties,
      // Don't send PII to PostHog
      amount: properties.amount,
      currency: properties.currency,
    },
  })
}

/**
 * Track feature flag evaluation
 */
export async function trackFeatureFlagEvaluated(
  userId: string,
  flagKey: string,
  flagValue: boolean | string
) {
  logger.debug(
    {
      userId,
      flagKey,
      flagValue,
    },
    'Feature flag evaluated'
  )

  // PostHog auto-tracks this, but you can capture custom properties
  await posthogServer.capture({
    distinctId: userId,
    event: 'feature_flag_evaluated',
    properties: {
      flagKey,
      flagValue,
    },
  })
}

/**
 * Track errors with correlation
 */
export async function trackError(
  userId: string | undefined,
  error: Error,
  context: {
    requestId?: string
    action?: string
    [key: string]: any
  }
) {
  // Log to Pino (includes stack trace)
  logger.error(
    {
      ...serializeError(error),
      userId,
      ...context,
    },
    'Error occurred'
  )

  // Track in PostHog (for analytics)
  if (userId) {
    await posthogServer.capture({
      distinctId: userId,
      event: 'error_occurred',
      properties: {
        errorName: error.name,
        errorMessage: error.message,
        ...context,
      },
    })
  }
}
```

---

### Phase 4: Feature Flags (Dynamic Configuration)

**Goal**: Use PostHog feature flags for gradual rollouts and A/B testing.

#### 4.1 Feature Flag Hook (Client-Side)

**File**: `lib/hooks/use-feature-flag.ts`

```typescript
'use client'

import { useEffect, useState } from 'react'
import posthog from 'posthog-js'

export function useFeatureFlag(flagKey: string): boolean | undefined {
  const [flagValue, setFlagValue] = useState<boolean | undefined>()

  useEffect(() => {
    // Check flag value
    const value = posthog.isFeatureEnabled(flagKey)
    setFlagValue(value)

    // Listen for flag changes
    const cleanup = posthog.onFeatureFlags(() => {
      const newValue = posthog.isFeatureEnabled(flagKey)
      setFlagValue(newValue)
    })

    return cleanup
  }, [flagKey])

  return flagValue
}

// Usage in component
export function PaymentPage() {
  const showNewPaymentFlow = useFeatureFlag('new-payment-flow')

  if (showNewPaymentFlow === undefined) {
    return <LoadingSpinner />
  }

  return showNewPaymentFlow
    ? <NewPaymentFlow />
    : <OldPaymentFlow />
}
```

#### 4.2 Server-Side Feature Flags

**File**: `lib/feature-flags.ts`

```typescript
import { posthogServer } from '@/lib/posthog-server'

export async function getFeatureFlag(
  userId: string,
  flagKey: string
): Promise<boolean> {
  const flagValue = await posthogServer.isFeatureEnabled(flagKey, userId)
  return flagValue === true
}

// Usage in Server Action
export async function registerStudent(userId: string, data: StudentData) {
  const enableAutoEnrollment = await getFeatureFlag(userId, 'auto-enrollment')

  if (enableAutoEnrollment) {
    // New behavior
    await autoEnrollStudent(data)
  } else {
    // Old behavior
    await manualEnrollStudent(data)
  }
}
```

---

### Phase 5: Session Replay (Debug User Issues)

**Goal**: Watch session replays of users who encountered errors.

#### 5.1 Enable Session Recording

Already configured in PostHog provider:

```typescript
session_recording: {
  maskAllInputs: false,
  maskInputFn: (text, element) => {
    // Mask sensitive fields
    if (element?.attributes?.['data-sensitive']) return '*'.repeat(text.length)
    if (element?.type === 'password') return '*'.repeat(text.length)
    return text
  },
}
```

#### 5.2 Mark Sensitive Fields

```tsx
// In your forms
<input
  type="text"
  name="cardNumber"
  data-sensitive // ← PostHog will mask this
/>

<input
  type="password"
  name="password"
  // ← Automatically masked
/>
```

#### 5.3 Link Error to Session Replay

When an error occurs, PostHog automatically links it to the session:

```typescript
// This error will appear in the session replay timeline
posthog.capture('error_occurred', {
  errorMessage: 'Payment failed',
  // Session replay automatically attached
})
```

**Debug Workflow**:

1. User reports: "Payment failed"
2. Search Pino logs for `requestId`
3. Search PostHog events for same `requestId`
4. Watch session replay to see what user did
5. See exact moment error occurred in replay

---

## Implementation Roadmap

### Week 1: Pino Improvements

- [x] ~~Migration complete~~
- [ ] Add request ID middleware
- [ ] Create `serializeError()` helper
- [ ] Add `getRequestContext()` helper
- [ ] Update all logger calls to include context

### Week 2: PostHog Setup

- [ ] Install PostHog packages
- [ ] Create PostHog provider
- [ ] Configure environment variables
- [ ] Set up reverse proxy (prevent ad blockers)
- [ ] Test basic event tracking

### Week 3: Event Taxonomy

- [ ] Define standard event names
- [ ] Create centralized event tracking functions
- [ ] Implement correlation with `requestId`
- [ ] Add feature flag infrastructure

### Week 4: Integration & Testing

- [ ] Test Pino + PostHog correlation
- [ ] Set up session replay
- [ ] Create PostHog dashboards
- [ ] Document best practices

---

## Environment Variables

```bash
# .env.local

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Pino
PINO_LOG_LEVEL=info  # debug in dev, info in prod
```

---

## Cost Analysis

| Service     | Free Tier       | Paid Tier       | Recommendation              |
| ----------- | --------------- | --------------- | --------------------------- |
| **Pino**    | ✅ Free         | -               | Use forever                 |
| **PostHog** | 1M events/month | $0.000225/event | Start free, scale as needed |
| **Sentry**  | 5K events/month | $26/month       | Optional - add if needed    |

**For Irshad Center** (estimated traffic):

- **Free tier is plenty** for MVP
- PostHog: ~100K events/month (well under 1M limit)
- Upgrade to paid when scaling

---

## Best Practices

### 1. Always Include Request ID

```typescript
const requestId = getRequestContext().requestId
logger.info({ requestId }, 'Action started')
posthog.capture('action_completed', { requestId })
```

### 2. Use Structured Properties

```typescript
// ❌ Bad
logger.info(`User ${userId} paid $${amount}`)
posthog.capture('payment', { details: `$${amount}` })

// ✅ Good
logger.info({ userId, amount, currency }, 'Payment processed')
posthog.capture('payment_processed', { userId, amount, currency })
```

### 3. Don't Log PII to PostHog

```typescript
// ❌ Bad
posthog.capture('user_registered', {
  email: 'user@example.com', // PII
  phone: '555-1234', // PII
})

// ✅ Good
posthog.capture('user_registered', {
  userId: 'uuid', // Use IDs instead
  userType: 'student',
})
```

### 4. Centralize Event Tracking

```typescript
// ❌ Bad - scattered throughout codebase
posthog.capture('user_thing')

// ✅ Good - centralized
import { trackUserRegistered } from '@/lib/analytics/events'
trackUserRegistered(userId, { program: 'mahad' })
```

---

## Sources

This architecture is based on industry best practices and official documentation:

**PostHog Integration:**

- [PostHog Next.js Docs](https://posthog.com/docs/libraries/next-js)
- [PostHog Error Tracking](https://posthog.com/docs/error-tracking/installation/nextjs)
- [Vercel + PostHog Guide](https://vercel.com/guides/posthog-nextjs-vercel-feature-flags-analytics)

**PostHog vs Sentry:**

- [PostHog vs Sentry Comparison](https://posthog.com/blog/posthog-vs-sentry)
- [Best Error Tracking Tools](https://posthog.com/blog/best-error-tracking-tools)

**Structured Logging:**

- [PostHog Internal Logging](https://posthog.com/handbook/engineering/conventions/backend-coding)
- [PostHog Correlation Analysis](https://posthog.com/docs/product-analytics/correlation)

---

## Next Steps

1. **Implement Pino improvements** (request ID, helpers)
2. **Set up PostHog** (provider, server client)
3. **Create event taxonomy** (standardize tracking)
4. **Add correlation** (link Pino + PostHog via requestId)
5. **Enable feature flags** (gradual rollouts)
6. **Set up dashboards** (monitor KPIs)

Ready to implement? Let's start with Phase 1 (Pino improvements) and Phase 2 (PostHog setup).
