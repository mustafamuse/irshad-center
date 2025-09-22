# Cursor Rules for Irshad Center Project

## TypeScript & React Patterns

### Component Structure

```typescript
// 1. Imports (grouped and ordered)
import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// 2. Types/Interfaces
interface ComponentProps {
  // Required props first
  requiredProp: string
  // Optional props last
  optionalProp?: number
}

// 3. Component Definition
export function Component({ requiredProp, optionalProp }: ComponentProps) {
  // 4. Hooks (ordered by dependency)
  const { data, isLoading } = useQuery(...)

  // 5. Memoized values
  const memoizedValue = useMemo(() => {
    // Complex calculations
  }, [/* dependencies */])

  // 6. Handlers (useCallback for event handlers)
  const handleClick = useCallback(() => {
    // Event handling
  }, [/* dependencies */])

  // 7. Early returns
  if (isLoading) return <ComponentSkeleton />
  if (!data) return null

  // 8. Render
  return (
    <div className={cn(
      "base-styles",
      "conditional-styles",
      "responsive-styles"
    )}>
      {/* JSX content */}
    </div>
  )
}
```

### File Organization

- One component per file
- Group related components in feature directories
- Follow Next.js App Router conventions

```
app/
  ├── (feature)/
  │   ├── _components/
  │   ├── _hooks/
  │   ├── _services/
  │   ├── _store/
  │   ├── _types/
  │   └── page.tsx
  └── layout.tsx
```

## Styling Guidelines

### Tailwind Classes

- Use semantic class ordering:
  1. Layout (flex, grid, position)
  2. Spacing (padding, margin)
  3. Typography
  4. Visual (colors, borders)
  5. Interactive states
  6. Responsive variants

```typescript
<div className={cn(
  // Layout
  "flex items-center justify-between",
  // Spacing
  "gap-4 p-4",
  // Typography
  "text-sm font-medium",
  // Visual
  "rounded-lg border bg-background",
  // States
  "hover:bg-muted",
  // Responsive
  "md:flex-row md:p-6"
)}/>
```

### Component Variants

- Use cva for component variants
- Define reusable variants in utils

```typescript
const buttonVariants = cva('base-styles', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground',
      secondary: 'bg-secondary text-secondary-foreground',
    },
    size: {
      default: 'h-10 px-4 py-2',
      sm: 'h-9 px-3',
      lg: 'h-11 px-8',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
})
```

## Testing Standards

### Test File Structure

```typescript
describe('ComponentName', () => {
  // 1. Setup
  const defaultProps = {...}

  beforeEach(() => {
    // Reset mocks
  })

  // 2. Rendering tests
  it('renders correctly', () => {})

  // 3. Interaction tests
  it('handles user interactions', () => {})

  // 4. State tests
  it('manages state correctly', () => {})

  // 5. Edge cases
  it('handles edge cases', () => {})
})
```

### Testing Best Practices

- Test behavior, not implementation
- Use meaningful test descriptions
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies
- Test accessibility

## State Management

### Zustand Store Structure

```typescript
interface Store {
  // 1. State
  data: Data[]
  isLoading: boolean
  error: Error | null

  // 2. Actions
  setData: (data: Data[]) => void
  clearError: () => void

  // 3. Computed values
  filteredData: () => Data[]
}

const useStore = create<Store>((set, get) => ({
  // Implementation
}))
```

## API Integration

### Service Pattern

```typescript
export class Service {
  private static instance: Service

  public static getInstance(): Service {
    if (!Service.instance) {
      Service.instance = new Service()
    }
    return Service.instance
  }

  public async fetch(): Promise<Data> {
    try {
      // Implementation
    } catch (error) {
      // Error handling
    }
  }
}
```

## Performance Guidelines

### Optimization Checklist

- Use React.memo for expensive components
- Implement virtualization for long lists
- Memoize callbacks and computed values
- Optimize images and assets
- Use proper Suspense boundaries

## Accessibility Standards

### Required Attributes

- Semantic HTML elements
- ARIA labels and roles
- Keyboard navigation
- Focus management
- Color contrast compliance

```typescript
<button
  role="button"
  aria-label="Descriptive label"
  className={cn("focus:ring-2 focus:ring-offset-2")}
  onClick={handleClick}
  onKeyDown={handleKeyDown}
>
  Content
</button>
```

## Error Handling

### Error Boundaries

- Implement feature-level error boundaries
- Provide meaningful error messages
- Log errors appropriately
- Graceful fallbacks

## Documentation

### Component Documentation

````typescript
/**
 * Component description
 *
 * @example
 * ```tsx
 * <Component prop="value" />
 * ```
 *
 * @param props - Component props
 * @param props.required - Required prop description
 * @param [props.optional] - Optional prop description
 */
````

## Code Review Checklist

1. Type Safety

   - No any types
   - Proper type definitions
   - Type inference where appropriate

2. Performance

   - Proper memoization
   - Optimized re-renders
   - Bundle size consideration

3. Accessibility

   - ARIA attributes
   - Keyboard navigation
   - Screen reader support

4. Testing

   - Unit tests
   - Integration tests
   - Edge cases covered

5. Error Handling

   - Proper error boundaries
   - Meaningful error messages
   - Graceful degradation

6. Documentation
   - Component documentation
   - Complex logic explanation
   - Usage examples
