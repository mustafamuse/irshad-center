# Axiom Observability Guide

This document covers Axiom log aggregation setup, useful queries, and alert configurations.

## Overview

The Irshad Center uses a three-tier observability stack:

| Tool       | Purpose                     | Data                                        |
| ---------- | --------------------------- | ------------------------------------------- |
| **Sentry** | Error tracking, alerts, APM | Errors, performance traces                  |
| **Pino**   | Structured console logging  | All logs (stdout)                           |
| **Axiom**  | Log aggregation, querying   | Errors, warnings, business events, requests |

## Log Sources

| Source       | Description                                            | Key Fields                                |
| ------------ | ------------------------------------------------------ | ----------------------------------------- |
| `middleware` | All API/admin requests                                 | `path`, `method`, `duration`, `userAgent` |
| `app`        | Application logs via `logError`/`logWarning`/`logInfo` | `message`, `requestId`, context fields    |
| `web-vitals` | Core Web Vitals metrics                                | `metric`, `value`, `path`                 |

## Useful APL Queries

### Error Monitoring

**All errors in last hour:**

```apl
['vercel']
| where level == "error"
| where _time > ago(1h)
| order by _time desc
```

**Errors by type:**

```apl
['vercel']
| where level == "error"
| where _time > ago(24h)
| summarize count() by message
| order by count_ desc
```

**Webhook errors:**

```apl
['vercel']
| where level == "error"
| where message contains "webhook" or ['vercel.source'] == "webhook"
| where _time > ago(24h)
| order by _time desc
```

### Request Monitoring

**Slow requests (>1s):**

```apl
['vercel']
| where ['vercel.source'] == "middleware"
| where ['fields.duration'] > 1000
| where _time > ago(1h)
| project _time, ['fields.path'], ['fields.method'], ['fields.duration']
| order by ['fields.duration'] desc
```

**Requests by path:**

```apl
['vercel']
| where ['vercel.source'] == "middleware"
| where message == "Response"
| where _time > ago(1h)
| summarize count(), avg(['fields.duration']) by ['fields.path']
| order by count_ desc
```

**API endpoint latency percentiles:**

```apl
['vercel']
| where ['vercel.source'] == "middleware"
| where message == "Response"
| where _time > ago(1h)
| summarize
    p50 = percentile(['fields.duration'], 50),
    p95 = percentile(['fields.duration'], 95),
    p99 = percentile(['fields.duration'], 99)
  by ['fields.path']
```

### Webhook Monitoring

**Webhook events received:**

```apl
['vercel']
| where message == "Webhook received"
| where _time > ago(24h)
| summarize count() by ['fields.eventType'], ['fields.source']
| order by count_ desc
```

**Webhook success rate:**

```apl
['vercel']
| where message contains "Webhook"
| where _time > ago(24h)
| summarize
    received = countif(message == "Webhook received"),
    processed = countif(message == "Webhook processed successfully"),
    errors = countif(level == "error")
  by bin(_time, 1h)
```

**Failed webhooks:**

```apl
['vercel']
| where level == "error"
| where message contains "Webhook" or ['fields.eventId'] != ""
| where _time > ago(24h)
| order by _time desc
```

### Business Events (Audit Trail)

**Family deletions:**

```apl
['vercel']
| where message == "Dugsi family deleted"
| where _time > ago(7d)
| project _time, ['fields.studentId'], ['fields.studentsDeleted'], ['fields.subscriptionsCanceled']
| order by _time desc
```

**Subscription operations:**

```apl
['vercel']
| where message contains "subscription" or message contains "Subscription"
| where level == "info"
| where _time > ago(7d)
| project _time, message, ['fields.subscriptionId'], ['fields.program']
| order by _time desc
```

**Admin login activity:**

```apl
['vercel']
| where message contains "Admin login" or message contains "Admin logout"
| where _time > ago(7d)
| project _time, message, ['fields.ip']
| order by _time desc
```

**Payment link generations:**

```apl
['vercel']
| where message contains "checkout" or message contains "payment"
| where level == "info"
| where _time > ago(7d)
| order by _time desc
```

### Web Vitals

**LCP by page:**

```apl
['vercel']
| where ['vercel.source'] == "web-vitals"
| where ['fields.metric'] == "LCP"
| where _time > ago(24h)
| summarize avg(['fields.value']), p75 = percentile(['fields.value'], 75) by ['fields.path']
```

**All Core Web Vitals summary:**

```apl
['vercel']
| where ['vercel.source'] == "web-vitals"
| where _time > ago(24h)
| summarize
    avg_value = avg(['fields.value']),
    p75 = percentile(['fields.value'], 75),
    count = count()
  by ['fields.metric']
```

### Correlation

**Find all logs for a request:**

```apl
['vercel']
| where ['fields.requestId'] == "YOUR_REQUEST_ID_HERE"
| order by _time asc
```

**Cross-reference with Sentry:**

1. Find `requestId` in Sentry issue
2. Use the query above to see full request lifecycle in Axiom

---

## Recommended Alerts

### 1. Error Spike Alert

**Name:** High Error Rate
**Query:**

```apl
['vercel']
| where level == "error"
| where _time > ago(5m)
| summarize error_count = count()
```

**Condition:** `error_count > 10`
**Frequency:** Every 5 minutes
**Notification:** Slack/Email

### 2. Webhook Failure Alert

**Name:** Webhook Processing Failures
**Query:**

```apl
['vercel']
| where level == "error"
| where message contains "Webhook" or message contains "webhook"
| where _time > ago(15m)
| summarize failure_count = count()
```

**Condition:** `failure_count > 3`
**Frequency:** Every 15 minutes
**Notification:** Slack/Email (high priority)

### 3. Slow Response Alert

**Name:** High Latency Detected
**Query:**

```apl
['vercel']
| where ['vercel.source'] == "middleware"
| where ['fields.duration'] > 3000
| where _time > ago(5m)
| summarize slow_count = count()
```

**Condition:** `slow_count > 5`
**Frequency:** Every 5 minutes
**Notification:** Slack

### 4. Admin Login Alert (Security)

**Name:** Admin Login Activity
**Query:**

```apl
['vercel']
| where message == "Admin login successful"
| where _time > ago(5m)
| summarize login_count = count()
```

**Condition:** `login_count > 0` (or `> 3` for suspicious activity)
**Frequency:** Every 5 minutes
**Notification:** Email

### 5. Failed Payment Webhook Alert

**Name:** Payment Webhook Failures
**Query:**

```apl
['vercel']
| where level == "error"
| where ['fields.eventType'] contains "invoice" or ['fields.eventType'] contains "payment"
| where _time > ago(15m)
| summarize count = count()
```

**Condition:** `count > 0`
**Frequency:** Every 15 minutes
**Notification:** Slack/Email (high priority)

---

## Setting Up Alerts in Axiom

1. Go to **Monitors** in Axiom dashboard
2. Click **New Monitor**
3. Enter the APL query
4. Set threshold and frequency
5. Configure notification channel (Slack, Email, PagerDuty, etc.)
6. Save and enable

---

## Dashboard Suggestions

Create an Axiom dashboard with these panels:

1. **Error Rate Over Time** - Line chart of errors per hour
2. **Request Volume** - Bar chart of requests by path
3. **Latency Percentiles** - Line chart of p50/p95/p99
4. **Webhook Success Rate** - Pie chart of success vs failure
5. **Web Vitals Scores** - Gauge charts for LCP, CLS, FID
6. **Recent Errors** - Table of last 10 errors
7. **Admin Activity** - Table of login/logout events

---

## Correlation with Sentry

Every log includes a `requestId` that's also set in Sentry tags. To correlate:

1. **Sentry -> Axiom:** Find `requestId` tag in Sentry issue, search in Axiom
2. **Axiom -> Sentry:** Find `requestId` in Axiom error, search in Sentry by tag

This enables full request tracing across both systems.
