import { Gender } from '@prisma/client'
import { User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RadioGroup, RadioGroupItem } from './radio-group'
import { Label } from './label'
import { GENDER_OPTIONS } from '@/lib/registration/schemas/registration'

// ============================================================================
// GENDER RADIO GROUP COMPONENT
// ============================================================================

export interface GenderRadioGroupProps {
  value?: Gender | null
  onValueChange?: (value: Gender) => void
  name: string
  className?: string
  disabled?: boolean
  options?: readonly { readonly value: string; readonly label: string }[]
}

const GENDER_STYLES = {
  MALE: {
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    hoverColor: 'hover:bg-blue-100',
    selectedColor: 'bg-blue-100 border-blue-300',
  },
  FEMALE: {
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    hoverColor: 'hover:bg-pink-100',
    selectedColor: 'bg-pink-100 border-pink-300',
  },
} as const

export function GenderRadioGroup({
  value,
  onValueChange,
  name,
  className,
  disabled = false,
  options = GENDER_OPTIONS,
}: GenderRadioGroupProps) {
  return (
    <RadioGroup
      value={value || ''}
      onValueChange={onValueChange}
      className={cn('grid w-full grid-cols-2 gap-4', className)}
      disabled={disabled}
    >
      {options.map((option) => {
        const isSelected = value === option.value
        const styles = GENDER_STYLES[option.value as keyof typeof GENDER_STYLES]

        return (
          <div key={option.value} className="relative w-full">
            <RadioGroupItem
              value={option.value}
              id={`${name}-${option.value}`}
              className="peer sr-only"
            />
            <Label
              htmlFor={`${name}-${option.value}`}
              className={cn(
                'flex min-h-[60px] w-full cursor-pointer items-center gap-2 rounded-lg border-2 p-3 transition-all duration-200',
                'peer-focus:ring-2 peer-focus:ring-offset-2',
                styles.bgColor,
                styles.borderColor,
                styles.hoverColor,
                isSelected && styles.selectedColor,
                isSelected && 'ring-2 ring-offset-2',
                disabled && 'cursor-not-allowed opacity-50',
                className
              )}
            >
              <div
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full',
                  isSelected ? styles.color : 'text-muted-foreground'
                )}
              >
                <User className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div
                  className={cn(
                    'text-sm font-medium',
                    isSelected ? styles.color : 'text-foreground'
                  )}
                >
                  {option.label}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {option.value === 'MALE' ? 'Male' : 'Female'}
                </div>
              </div>
              {isSelected && (
                <div
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded-full',
                    styles.color,
                    styles.bgColor
                  )}
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-current" />
                </div>
              )}
            </Label>
          </div>
        )
      })}
    </RadioGroup>
  )
}

// ============================================================================
// COMPACT GENDER RADIO GROUP (for smaller spaces)
// ============================================================================

export interface CompactGenderRadioGroupProps {
  value?: Gender | null
  onValueChange?: (value: Gender) => void
  name: string
  className?: string
  disabled?: boolean
}

export function CompactGenderRadioGroup({
  value,
  onValueChange,
  name,
  className,
  disabled = false,
}: CompactGenderRadioGroupProps) {
  return (
    <RadioGroup
      value={value || ''}
      onValueChange={onValueChange}
      className={cn('flex gap-4', className)}
      disabled={disabled}
    >
      {GENDER_OPTIONS.map((option) => {
        const isSelected = value === option.value
        const styles = GENDER_STYLES[option.value as keyof typeof GENDER_STYLES]

        return (
          <div key={option.value} className="relative w-full">
            <RadioGroupItem
              value={option.value}
              id={`${name}-${option.value}`}
              className="peer sr-only"
            />
            <Label
              htmlFor={`${name}-${option.value}`}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition-all duration-200',
                'peer-focus:ring-2 peer-focus:ring-offset-2',
                'border-input bg-background',
                isSelected && styles.selectedColor,
                isSelected && 'ring-2 ring-offset-2',
                disabled && 'cursor-not-allowed opacity-50',
                className
              )}
            >
              <User
                className={cn(
                  'h-4 w-4',
                  isSelected ? styles.color : 'text-muted-foreground'
                )}
              />
              <span
                className={cn(
                  'text-sm font-medium',
                  isSelected ? styles.color : 'text-foreground'
                )}
              >
                {option.label}
              </span>
            </Label>
          </div>
        )
      })}
    </RadioGroup>
  )
}
