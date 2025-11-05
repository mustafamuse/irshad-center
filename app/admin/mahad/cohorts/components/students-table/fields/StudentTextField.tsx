import type { LucideIcon } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface StudentTextFieldProps {
  id: string
  label: string
  value: string
  isEditing: boolean
  onChange: (value: string) => void
  disabled?: boolean
  type?: 'text' | 'email' | 'tel'
  icon?: LucideIcon
  href?: string
  required?: boolean
  placeholder?: string
}

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
}: StudentTextFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label} {isEditing && required && '*'}
      </Label>

      {isEditing ? (
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
        />
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
