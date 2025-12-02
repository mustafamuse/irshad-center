import type { LucideIcon } from 'lucide-react'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface SelectOption {
  value: string
  label: string
}

interface StudentSelectFieldProps {
  /** Unique identifier for the field */
  id: string
  /** Label text displayed above the field */
  label: string
  /** Current selected value */
  value: string
  /** Available options for selection */
  options: SelectOption[]
  /** Whether the field is in edit mode */
  isEditing: boolean
  /** Callback when selection changes */
  onChange: (value: string) => void
  /** Whether the field is disabled */
  disabled?: boolean
  /** Icon to display next to value in view mode */
  icon?: LucideIcon
  /** Display text for view mode (defaults to selected option label) */
  displayValue?: string
  /** Placeholder text when no value selected */
  placeholder?: string
}

/**
 * StudentSelectField - Reusable select dropdown field component
 *
 * Renders a dropdown select in edit mode, or displays the value
 * with optional icon in view mode.
 */
export function StudentSelectField({
  id,
  label,
  value,
  options,
  isEditing,
  onChange,
  disabled = false,
  icon: Icon,
  displayValue,
  placeholder = 'Select an option',
}: StudentSelectFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>

      {isEditing ? (
        <Select value={value} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger id={id}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          <p className="text-sm">{displayValue || 'Not specified'}</p>
        </div>
      )}
    </div>
  )
}
