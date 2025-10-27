import { DollarSign } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface StudentMoneyFieldProps {
  id: string
  label: string
  value: number
  isEditing: boolean
  onChange: (value: number) => void
  disabled?: boolean
}

export function StudentMoneyField({
  id,
  label,
  value,
  isEditing,
  onChange,
  disabled = false,
}: StudentMoneyFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>

      {isEditing ? (
        <Input
          id={id}
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          disabled={disabled}
        />
      ) : (
        <div className="flex items-center gap-2 text-sm">
          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">${value.toFixed(2)}</span>
        </div>
      )}
    </div>
  )
}
