/**
 * Empty State Component
 * Reusable component for displaying empty states with optional illustrations and actions
 */
import * as React from 'react'

import { Button } from './button'

export interface EmptyStateProps {
  /**
   * Optional icon to display (from lucide-react)
   */
  icon?: React.ReactNode
  /**
   * Title text
   */
  title: string
  /**
   * Optional description text
   */
  description?: string
  /**
   * Primary action button
   */
  action?: {
    label: string
    onClick: () => void
    variant?: 'default' | 'outline' | 'secondary'
  }
  /**
   * Secondary action button
   */
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  /**
   * Optional custom className
   */
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-4 py-12 text-center ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* Icon */}
      {icon && (
        <div className="mb-4 rounded-full bg-muted p-4 text-muted-foreground">
          {icon}
        </div>
      )}

      {/* Title */}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>

      {/* Description */}
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {action && (
            <Button
              variant={action.variant || 'default'}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
