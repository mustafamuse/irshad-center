import type { LucideIcon } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface StudentTextFieldProps {
  /** Unique identifier for the field */
  id: string
  /** Label text displayed above the field */
  label: string
  /** Current field value */
  value: string
  /** Whether the field is in edit mode */
  isEditing: boolean
  /** Callback when value changes */
  onChange: (value: string) => void
  /** Whether the field is disabled */
  disabled?: boolean
  /** Input type (text, email, or tel) */
  type?: 'text' | 'email' | 'tel'
  /** Icon to display next to value in view mode */
  icon?: LucideIcon
  /** Link href for clickable value in view mode */
  href?: string
  /** Whether the field is required */
  required?: boolean
  /** Placeholder text for empty input */
  placeholder?: string
  /** Validation error message */
  error?: string
}

/**
 * StudentTextField - Reusable text input field component
 *
 * Renders an editable input in edit mode, or displays the value
 * with optional icon and link in view mode.
 */
export function StudentTextField({
  id,
  label,
  value,
  isEditing,
  onChange,
  disabled = false,
  type = 'text',
  icon: Icon,
  href,
  required = false,
  placeholder,
  error,
}: StudentTextFieldProps) {
  const errorId = `${id}-error`

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label} {isEditing && required && '*'}
      </Label>

      {isEditing ? (
        <>
          <Input
            id={id}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            required={required}
            placeholder={placeholder}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? errorId : undefined}
          />
          {error && (
            <p id={errorId} className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </>
      ) : value ? (
        <div className="flex items-center gap-2 text-sm">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          {href ? (
            <a
              href={href}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {value}
            </a>
          ) : (
            <span className="font-medium">{value}</span>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Not provided</p>
      )}
    </div>
  )
}
