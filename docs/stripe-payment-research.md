# Stripe Payment Research (December 2025)

Research conducted for Irshad Center payment system.

---

## Table of Contents

1. [Checkout Session Expiration](#1-checkout-session-expiration)
2. [Checkout Sessions vs Payment Links](#2-checkout-sessions-vs-payment-links)
3. [Delayed Subscription Start Options](#3-delayed-subscription-start-options)
4. [Payment Confirmation Page Design](#4-payment-confirmation-page-design)

---

## 1. Checkout Session Expiration

### Key Finding: 24-hour maximum confirmed

From official Stripe API documentation:

> "You can set a custom expiration time for a Checkout Session by setting the `expires_at` parameter. It can be anywhere from **30 minutes to 24 hours** after Checkout Session creation."

### Details

| Setting            | Value                                    |
| ------------------ | ---------------------------------------- |
| Minimum expiration | 30 minutes                               |
| Maximum expiration | 24 hours                                 |
| Default            | 24 hours                                 |
| Applies to         | All modes (subscription, payment, setup) |

**No extension is possible** beyond 24 hours for Checkout Sessions.

### Sources

- [Checkout Session expires_at parameter](https://docs.stripe.com/api/checkout/sessions/create)
- [How Checkout works](https://docs.stripe.com/payments/checkout/how-checkout-works)

---

## 2. Checkout Sessions vs Payment Links

### Major Update (July 2025)

**Payment Links now support dynamic pricing via `price_data`!**

As of API version `2025-07-30.basil`, Payment Links support ad-hoc pricing:

```typescript
const paymentLink = await stripe.paymentLinks.create({
  line_items: [
    {
      price_data: {
        currency: 'usd',
        product_data: { name: 'Subscription' },
        unit_amount: 2000, // Dynamic amount
        recurring: { interval: 'month' },
      },
      quantity: 1,
    },
  ],
})
```

### Comparison Table

| Feature                    | Checkout Sessions                 | Payment Links             |
| -------------------------- | --------------------------------- | ------------------------- |
| **Code Required**          | Yes (API)                         | No (Dashboard or API)     |
| **Expiration**             | 30 min - 24 hours                 | Never (until deactivated) |
| **Reusable**               | No (one-time)                     | Yes (unlimited uses)      |
| **Dynamic `price_data`**   | Full support                      | Yes (July 2025)           |
| **Max Line Items**         | 100 (payment mode)                | 20                        |
| **Custom Fields**          | Unlimited                         | 3 max                     |
| **UI Modes**               | 3 (hosted/embedded/custom)        | 1 (hosted only)           |
| **`billing_cycle_anchor`** | Yes                               | No                        |
| **Trial + Anchor combo**   | Not allowed                       | N/A                       |
| **Custom redirect URLs**   | Yes (`success_url`, `cancel_url`) | Yes (`after_completion`)  |

### Key Insight

**Payment Links use Checkout Sessions under the hood.**

> "A Checkout Session represents your customer's session as they pay for one-time purchases or subscriptions through Checkout or Payment Links."

### When to Use Each

#### Checkout Sessions

Best for:

- Dynamic carts with changing contents
- SaaS applications with trials or subscriptions
- Applications requiring control over logic before purchase
- Complex pricing scenarios (calculated totals, custom quotes)
- Need for `billing_cycle_anchor`

#### Payment Links

Best for:

- No-code payment collection
- Sharing via social media, emails
- Testing product demand
- Simple subscription offerings
- Embedded buy buttons
- Links that never expire

### Limitations

#### Checkout Sessions Cannot:

- Reuse expired or completed sessions
- Combine trials with `billing_cycle_anchor`
- Use amount-off coupons with default proration
- Use one-time prices with `proration_behavior: none`

#### Payment Links Cannot:

- Have more than 20 line items
- Have more than 3 custom fields
- Use `billing_cycle_anchor`
- Add programmatic validation before checkout
- Dynamically calculate complex pricing at checkout time

### Sources

- [Checkout Sessions API Reference](https://docs.stripe.com/api/checkout/sessions)
- [Payment Links Documentation](https://docs.stripe.com/payment-links)
- [Ad-hoc prices for Payment Links (July 2025)](https://docs.stripe.com/changelog/basil/2025-07-30/ad-hoc-prices-for-payment-links)

---

## 3. Delayed Subscription Start Options

Three approaches to let users choose when their subscription starts:

### Option A: `billing_cycle_anchor` (Recommended)

Set a future start date using `subscription_data.billing_cycle_anchor`:

```typescript
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: 'price_xxx', quantity: 1 }],
  subscription_data: {
    billing_cycle_anchor: 1640995200, // Unix timestamp
    proration_behavior: 'none', // Free until anchor date
  },
  success_url: 'https://example.com/success',
  cancel_url: 'https://example.com/cancel',
})
```

**Key Details:**

- Anchor must be a future Unix timestamp
- `proration_behavior: 'none'` = free until anchor date (no invoice)
- `proration_behavior: 'create_prorations'` = prorated invoice for initial period
- **Cannot combine with trials**

### Option B: `trial_end`

Use a trial period to delay the first charge:

```typescript
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: 'price_xxx', quantity: 1 }],
  subscription_data: {
    trial_end: 1640995200, // Unix timestamp when billing begins
  },
  payment_method_collection: 'if_required',
  success_url: 'https://example.com/success',
  cancel_url: 'https://example.com/cancel',
})
```

**Key Details:**

- `trial_end` accepts Unix timestamp
- Alternative: `trial_period_days` (max 730 days)
- A $0 invoice **is generated** at subscription creation
- **Cannot combine with `billing_cycle_anchor`**

### Option C: Subscription Schedules

For true future-dated subscriptions:

```typescript
const schedule = await stripe.subscriptionSchedules.create({
  customer: 'cus_xxx',
  start_date: 1640995200, // Future Unix timestamp
  phases: [
    {
      items: [{ price: 'price_xxx', quantity: 1 }],
      iterations: 12,
    },
  ],
})
```

**Key Details:**

- Can set absolute future `start_date`
- Up to 10 current or future phases
- Cannot be created directly in Checkout Sessions
- Requires creating customer first

### Comparison

| Approach                                                         | Initial Period    | Invoice Generated | Best For                    |
| ---------------------------------------------------------------- | ----------------- | ----------------- | --------------------------- |
| `billing_cycle_anchor` + `proration_behavior: none`              | Free              | No                | Fixed monthly billing dates |
| `billing_cycle_anchor` + `proration_behavior: create_prorations` | Prorated charge   | Yes               | Immediate value delivery    |
| `trial_end`                                                      | Free trial        | $0 invoice        | Flexible delays             |
| Subscription Schedules                                           | Doesn't exist yet | No                | True future starts          |

### Sources

- [Set the billing cycle date](https://docs.stripe.com/payments/checkout/billing-cycle)
- [Subscription schedules](https://docs.stripe.com/billing/subscriptions/subscription-schedules)
- [Using trial periods](https://docs.stripe.com/billing/subscriptions/trials)

---

## 4. Payment Confirmation Page Design

### Design System (from codebase analysis)

- **Colors**: Black/white with HSL CSS variables, green for success states
- **Success Colors**: green-50/100/200/600/700/900
- **Typography**: System fonts, semibold headings
- **Components**: shadcn/ui (Card, Button, Badge, Separator)
- **Animations**: `animate-fade-in`, `animate-fade-in-up`, `animate-ping`
- **Layout**: Container with `max-w-3xl`, mobile-first (`p-4 sm:p-6`)

### Page Structure

```
┌─────────────────────────────────────────┐
│  Success Banner (animated)              │
│  ✓ Payment Confirmed!                   │
│  Confirmation #ABC123                   │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│  Payment Summary Card                   │
│  - Amount: $XX.XX                       │
│  - Frequency: Monthly/Yearly            │
│  - Payment method: Card ending XXXX     │
│  - Transaction date                     │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│  Subscription Details Card              │
│  - Program: Mahad/Dugsi                 │
│  - Student name(s)                      │
│  - Next billing date                    │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│  Next Steps Card                        │
│  - Check your email                     │
│  - Receipt available                    │
│  - Access your portal                   │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│  [View Payment History] [Go to Dashboard]│
└─────────────────────────────────────────┘
```

### Implementation Location

**Recommended**: `/app/payment/confirmation/page.tsx`

**Alternative** (program-specific):

- `/app/mahad/payment/confirmation/page.tsx`
- `/app/dugsi/payment/confirmation/page.tsx`

### Data Type

```typescript
interface PaymentConfirmationData {
  amount: number // cents
  currency: string
  interval: 'month' | 'year'
  nextBillingDate: Date
  paymentDate: Date
  confirmationNumber: string
  paymentMethod: {
    type: 'card' | 'bank_account'
    last4: string
    brand?: string
  }
  customerName: string
  customerEmail: string
  program: 'MAHAD' | 'DUGSI'
  students: Array<{
    id: string
    name: string
    gradeLevel?: string
  }>
  subscriptionId: string
}
```

### Key Features

1. **Mobile-Responsive**: Single column, stacked buttons on mobile
2. **Animations**: Staggered fade-in (100ms, 200ms, 300ms delays)
3. **Accessibility**: `role="status"`, `aria-live="polite"`, semantic HTML
4. **Server Component**: Fetch data server-side, minimal client JS

---

## Recommendations for Irshad Center

### Current Setup (Checkout Sessions)

Keep using Checkout Sessions because:

1. Per-student dynamic pricing via `price_data`
2. Override amounts require flexibility
3. Option to add `billing_cycle_anchor` for start date selection
4. 24-hour expiration is acceptable for admin-sent links

### If You Want Non-Expiring Links

Switch to Payment Links via API:

- Create unique Payment Link per student
- Use `price_data` for dynamic pricing (July 2025 feature)
- Trade-off: No `billing_cycle_anchor` support

### For Delayed Start Dates

Use `billing_cycle_anchor` with `proration_behavior: 'none'`:

- User completes checkout immediately
- No charge until anchor date
- Cannot combine with trials

---

## API Version Notes

- **2025-08-27.basil**: Current version used in codebase
- **2025-07-30.basil**: Payment Links `price_data` support added
- **2025-09-30**: `billing_cycle_anchor` affects subscription schedule phase calculations

---

_Research conducted: December 2025_
