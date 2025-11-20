# Shared Mahad Components

This directory contains components that are **truly shared** across multiple features within the mahad module.

## Current Components

### stripe-pricing-table.tsx

**Used by:**

- `(public)/_components/payment-banner.tsx` - Payment banner on home page
- `(registration)/register/_components/payment-success-dialog.tsx` - Payment dialog after registration

**Purpose:** Stripe payment integration component that displays pricing options and handles Stripe checkout flow.

## Guidelines

**Only add components here if they are:**

- Used by 2+ different features or route groups
- Not specific to a single page or route
- Cross-cutting concerns (e.g., payments, shared UI patterns)

**For feature-specific components:**

- Use feature-level `_components/` folders (e.g., `scholarship-application/_components/`)
- Use route-group-level `_components/` if shared within route group (e.g., `(public)/_components/`)

This follows the Next.js 15 "feature-based splitting" best practice and matches the cohorts pattern.
