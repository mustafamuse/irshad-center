/**
 * Typography components following Vercel Geist design patterns
 * Uses semantic typography tokens with Strong/Subtle modifiers
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { typography } from '@/lib/design-tokens'
import { cva, type VariantProps } from 'class-variance-authority'

// Display component for large values (stats, metrics, etc.)
const displayVariants = cva(
  'tabular-nums',
  {
    variants: {
      variant: {
        base: typography.display.base,
        strong: typography.display.strong,
        subtle: typography.display.subtle,
      },
    },
    defaultVariants: {
      variant: 'base',
    },
  }
)

interface DisplayProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof displayVariants> {
  as?: 'div' | 'p' | 'span'
}

export function Display({
  children,
  variant,
  className,
  as: Component = 'div',
  ...props
}: DisplayProps) {
  return (
    <Component
      data-slot="display"
      className={cn(displayVariants({ variant }), className)}
      {...props}
    >
      {children}
    </Component>
  )
}

// Heading component for page and section titles
const headingVariants = cva(
  '',
  {
    variants: {
      level: {
        page: typography.heading.page,
        section: typography.heading.section,
        card: typography.heading.card,
      },
    },
    defaultVariants: {
      level: 'section',
    },
  }
)

interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

export function Heading({
  children,
  level,
  className,
  as: Component = 'h2',
  ...props
}: HeadingProps) {
  return (
    <Component
      className={cn(headingVariants({ level }), className)}
      {...props}
    >
      {children}
    </Component>
  )
}

// Label component with support for nested strong elements
const labelVariants = cva(
  '',
  {
    variants: {
      variant: {
        base: typography.label.base,
        strong: typography.label.strong,
        subtle: typography.label.subtle,
      },
    },
    defaultVariants: {
      variant: 'base',
    },
  }
)

interface LabelProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof labelVariants> {
  as?: 'label' | 'p' | 'span' | 'div'
}

export function Label({
  children,
  variant,
  className,
  as: Component = 'label',
  ...props
}: LabelProps) {
  return (
    <Component
      data-slot="label"
      className={cn(labelVariants({ variant }), className)}
      {...props}
    >
      {children}
    </Component>
  )
}

// Body text component
const bodyVariants = cva(
  '',
  {
    variants: {
      variant: {
        base: typography.body.base,
        strong: typography.body.strong,
        subtle: typography.body.subtle,
      },
    },
    defaultVariants: {
      variant: 'base',
    },
  }
)

interface BodyProps
  extends React.HTMLAttributes<HTMLParagraphElement>,
    VariantProps<typeof bodyVariants> {
  as?: 'p' | 'div' | 'span'
}

export function Body({
  children,
  variant,
  className,
  as: Component = 'p',
  ...props
}: BodyProps) {
  return (
    <Component
      className={cn(bodyVariants({ variant }), className)}
      {...props}
    >
      {children}
    </Component>
  )
}

// Small text component
export function Small({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <small
      className={cn(typography.small, className)}
      {...props}
    >
      {children}
    </small>
  )
}

// Code component for inline code
export function Code({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <code
      className={cn(
        'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm',
        className
      )}
      {...props}
    >
      {children}
    </code>
  )
}

// Strong modifier for emphasis within text
export function Strong({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <strong
      className={cn('font-semibold text-foreground', className)}
      {...props}
    >
      {children}
    </strong>
  )
}

// Subtle modifier for de-emphasized text
export function Subtle({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <span
      className={cn('text-muted-foreground/70', className)}
      {...props}
    >
      {children}
    </span>
  )
}

// Composite component for page headers
interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <Heading as="h1" level="page">
        {title}
      </Heading>
      {description && (
        <Body variant="subtle">{description}</Body>
      )}
    </div>
  )
}

// Composite component for stat displays
interface StatDisplayProps {
  label: React.ReactNode
  value: React.ReactNode
  description?: React.ReactNode
  className?: string
}

export function StatDisplay({
  label,
  value,
  description,
  className,
}: StatDisplayProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <Label variant="base">{label}</Label>
      <Display variant="base">{value}</Display>
      {description && (
        <Small className="text-muted-foreground">{description}</Small>
      )}
    </div>
  )
}