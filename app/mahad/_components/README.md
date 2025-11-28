# Shared Mahad Components

This directory contains components that are **truly shared** across multiple features within the mahad module.

## Current Components

### checkout-form.tsx

**Used by:**

- `(registration)/register/_components/page-wrapper.tsx` - Registration checkout flow

**Purpose:** Custom checkout form that calculates tuition based on graduation status and payment frequency, then creates a Stripe checkout session.

## Guidelines

**Only add components here if they are:**

- Used by 2+ different features or route groups
- Not specific to a single page or route
- Cross-cutting concerns (e.g., payments, shared UI patterns)

**For feature-specific components:**

- Use feature-level `_components/` folders (e.g., `scholarship-application/_components/`)
- Use route-group-level `_components/` if shared within route group (e.g., `(public)/_components/`)

This follows the Next.js 15 "feature-based splitting" best practice and matches the cohorts pattern.
