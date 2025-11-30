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
  helperText?: string
  options?: readonly {
    readonly value: string
    readonly label: string
    readonly subLabel?: string
  }[]
}

const GENDER_STYLES = {
  MALE: {
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    hoverColor: 'hover:bg-blue-100',
    selectedColor: 'bg-blue-100 border-blue-400',
    focusRing: 'focus-visible:ring-blue-500',
    shadow: 'shadow-md shadow-blue-200/50',
  },
  FEMALE: {
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    hoverColor: 'hover:bg-pink-100',
    selectedColor: 'bg-pink-100 border-pink-400',
    focusRing: 'focus-visible:ring-pink-500',
    shadow: 'shadow-md shadow-pink-200/50',
  },
} as const

export function GenderRadioGroup({
  value,
  onValueChange,
  name,
  className,
  disabled = false,
  helperText,
  options = GENDER_OPTIONS,
}: GenderRadioGroupProps) {
  const hasSelection = !!value

  return (
    <div className="space-y-2">
      <RadioGroup
        value={value || ''}
        onValueChange={onValueChange}
        className={cn('grid w-full grid-cols-2 gap-4', className)}
        disabled={disabled}
        aria-label="Select gender"
      >
        {options.map((option) => {
          const isSelected = value === option.value
          const styles =
            GENDER_STYLES[option.value as keyof typeof GENDER_STYLES]
          const subLabelId = `${name}-${option.value}-sublabel`

          return (
            <div key={option.value} className="relative w-full">
              <RadioGroupItem
                value={option.value}
                id={`${name}-${option.value}`}
                className="peer sr-only"
                aria-describedby={option.subLabel ? subLabelId : undefined}
                aria-checked={isSelected}
              />
              <Label
                htmlFor={`${name}-${option.value}`}
                className={cn(
                  'flex min-h-[60px] w-full cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-all duration-200',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2',
                  'hover:scale-[1.02] active:scale-[0.98]',
                  // Unselected state: neutral appearance
                  !isSelected && 'border-dashed border-gray-300 bg-white',
                  !isSelected && 'hover:border-solid hover:bg-gray-50',
                  // Selected state: strong colors
                  isSelected && styles.selectedColor,
                  isSelected && styles.shadow,
                  isSelected && 'ring-2 ring-offset-2',
                  styles.focusRing,
                  disabled &&
                    'cursor-not-allowed opacity-50 hover:scale-100 active:scale-100',
                  className
                )}
              >
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors',
                    isSelected ? styles.color : 'text-muted-foreground'
                  )}
                >
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      'text-sm font-semibold leading-tight',
                      isSelected ? styles.color : 'text-foreground'
                    )}
                  >
                    {option.label}
                  </div>
                  {option.subLabel && (
                    <div
                      id={subLabelId}
                      className="mt-0.5 text-[10px] leading-tight text-muted-foreground"
                    >
                      {option.subLabel}
                    </div>
                  )}
                </div>
                {isSelected && (
                  <div
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                      styles.color,
                      styles.bgColor
                    )}
                    aria-hidden="true"
                  >
                    <div className="h-2 w-2 rounded-full bg-current" />
                  </div>
                )}
              </Label>
            </div>
          )
        })}
      </RadioGroup>
      {helperText && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
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
