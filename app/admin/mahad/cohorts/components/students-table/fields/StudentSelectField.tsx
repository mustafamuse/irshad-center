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
  id: string
  label: string
  value: string
  options: SelectOption[]
  isEditing: boolean
  onChange: (value: string) => void
  disabled?: boolean
  icon?: LucideIcon
  displayValue?: string
  placeholder?: string
}

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
