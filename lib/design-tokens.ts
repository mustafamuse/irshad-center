/**
 * Design tokens for consistent styling across admin pages
 * Aligned with shadcn and Vercel Geist design patterns
 */

// Semantic color mappings for different states
export const semanticColors = {
  stat: {
    default: 'muted',
    primary: 'primary',
    success: 'accent',
    warning: 'destructive',
    error: 'destructive',
    info: 'secondary',
  }
} as const

// Typography presets following Vercel Geist patterns
export const typography = {
  // Display text for large values
  display: {
    base: 'text-2xl font-semibold tabular-nums sm:text-3xl',
    strong: 'text-2xl font-bold tabular-nums sm:text-3xl',
    subtle: 'text-2xl font-medium tabular-nums text-muted-foreground sm:text-3xl',
  },
  // Headings for pages and sections
  heading: {
    page: 'text-3xl font-bold tracking-tight',
    section: 'text-2xl font-semibold',
    card: 'text-lg font-semibold',
  },
  // Labels and descriptions
  label: {
    base: 'text-sm text-muted-foreground',
    strong: 'text-sm font-medium text-foreground',
    subtle: 'text-sm text-muted-foreground/70',
  },
  // Body text
  body: {
    base: 'text-base',
    strong: 'text-base font-medium',
    subtle: 'text-base text-muted-foreground',
  },
  // Badge and small text
  badge: 'text-xs font-medium',
  small: 'text-xs',
} as const

// Spacing tokens aligned with shadcn patterns
export const spacing = {
  // Page-level spacing
  page: 'p-6 lg:p-8',
  section: 'space-y-8',

  // Card spacing variants
  card: {
    compact: 'px-4 py-4',
    default: 'px-6 py-6',
    spacious: 'px-8 py-8',
  },

  // Component spacing
  badge: 'px-2 py-0.5',
  button: 'px-4 py-2',

  // Grid and stack spacing
  grid: 'gap-6',
  gridCompact: 'gap-4',
  gridSpacious: 'gap-8',
  stack: 'space-y-4',
  stackCompact: 'space-y-2',
  stackSpacious: 'space-y-6',
} as const

// Animation tokens for consistent motion
export const animations = {
  // Base transitions
  default: 'transition-all duration-200',
  fast: 'transition-all duration-150',
  slow: 'transition-all duration-300',

  // Specific animations
  card: 'transition-all duration-200 hover:shadow-lg',
  button: 'transition-colors duration-150',
  fade: 'transition-opacity duration-300',
  slide: 'transition-transform duration-200',
  scale: 'transition-transform duration-150 hover:scale-[1.02]',
} as const

// Layout patterns
export const layouts = {
  container: 'container mx-auto',
  maxWidth: 'max-w-7xl',

  // Grid layouts with container queries
  statsGrid: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4 @container',
  cardsGrid: 'grid gap-6 md:grid-cols-2 lg:grid-cols-3 @container',
  actionsGrid: 'grid gap-4 md:grid-cols-3 @container',

  // Flex layouts
  flexBetween: 'flex items-center justify-between',
  flexCenter: 'flex items-center justify-center',
  flexStart: 'flex items-center',
} as const

// Shadow tokens aligned with shadcn
export const shadows = {
  sm: 'shadow-sm',
  default: 'shadow',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',

  // Interactive shadows
  hover: 'hover:shadow-lg',
  focus: 'focus:shadow-md',
} as const

// Border tokens
export const borders = {
  default: 'border',
  accent: 'border-l-4',
  dashed: 'border-dashed',

  // Border radius matching shadcn
  radius: {
    sm: 'rounded-sm',
    default: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full',
  },
} as const

// Container query tokens
export const container = {
  stat: '@container/stat',
  card: '@container/card',
  grid: '@container/grid',
  main: '@container/main',
} as const

// Helper function to get semantic color class
export function getSemanticColor(
  status: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'
): string {
  return semanticColors.stat[status] || semanticColors.stat.default
}

// Helper function to get trend color based on direction and context
export function getTrendColor(
  direction: 'up' | 'down' | 'neutral',
  isPositive: boolean = true
): string {
  if (direction === 'neutral') return 'muted'

  const isGood = (direction === 'up' && isPositive) || (direction === 'down' && !isPositive)
  return isGood ? 'accent' : 'destructive'
}

// Composite styles for common patterns
export const patterns = {
  // Stat card patterns
  statCard: {
    wrapper: 'relative transition-all duration-200 hover:shadow-lg @container/stat',
    header: 'flex items-center justify-between',
    value: typography.display.base,
    label: typography.label.base,
    trend: 'inline-flex items-center gap-1 text-sm',
  },

  // Page header patterns
  pageHeader: {
    wrapper: 'space-y-1',
    title: typography.heading.page,
    description: typography.body.subtle,
  },

  // Data slot patterns (for semantic identification)
  dataSlot: {
    card: '[data-slot="card"]',
    statCard: '[data-slot="stat-card"]',
    heroCard: '[data-slot="hero-card"]',
    header: '[data-slot="header"]',
    content: '[data-slot="content"]',
  },
} as const

// Gradient patterns for cards
export const gradients = {
  default: 'bg-gradient-to-br from-card to-muted/20',
  success: 'bg-gradient-to-br from-card to-accent/10',
  warning: 'bg-gradient-to-br from-card to-destructive/5',
  info: 'bg-gradient-to-br from-card to-secondary/10',

  // Subtle gradient overlays
  overlay: {
    light: 'bg-gradient-to-t from-background/5 to-transparent',
    medium: 'bg-gradient-to-t from-background/10 to-transparent',
    strong: 'bg-gradient-to-t from-background/20 to-transparent',
  },
} as const