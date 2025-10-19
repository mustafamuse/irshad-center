import { Gender } from '@prisma/client'
import { User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RadioGroup, RadioGroupItem } from './radio-group'
import { Label } from './label'

// ============================================================================
// GENDER RADIO GROUP COMPONENT
// ============================================================================

export interface GenderRadioGroupProps {
  value?: Gender | string | null
  onValueChange?: (value: Gender) => void
  name: string
  className?: string
  disabled?: boolean
}

const GENDER_OPTIONS = [
  { 
    value: 'MALE' as const, 
    label: 'Boy',
    icon: User,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    hoverColor: 'hover:bg-blue-100',
    selectedColor: 'bg-blue-100 border-blue-300'
  },
  { 
    value: 'FEMALE' as const, 
    label: 'Girl',
    icon: User,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    hoverColor: 'hover:bg-pink-100',
    selectedColor: 'bg-pink-100 border-pink-300'
  },
] as const

export function GenderRadioGroup({
  value,
  onValueChange,
  name,
  className,
  disabled = false,
}: GenderRadioGroupProps) {
  return (
    <RadioGroup
      value={value || ''}
      onValueChange={onValueChange}
      className={cn('grid grid-cols-2 gap-3', className)}
      disabled={disabled}
    >
      {GENDER_OPTIONS.map((option) => {
        const Icon = option.icon
        const isSelected = value === option.value
        
        return (
          <div key={option.value} className="relative">
            <RadioGroupItem
              value={option.value}
              id={`${name}-${option.value}`}
              className="peer sr-only"
            />
            <Label
              htmlFor={`${name}-${option.value}`}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border-2 p-4 transition-all duration-200',
                'peer-focus:ring-2 peer-focus:ring-offset-2',
                option.bgColor,
                option.borderColor,
                option.hoverColor,
                isSelected && option.selectedColor,
                isSelected && 'ring-2 ring-offset-2',
                disabled && 'cursor-not-allowed opacity-50',
                className
              )}
            >
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full',
                isSelected ? option.color : 'text-muted-foreground'
              )}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className={cn(
                  'text-sm font-medium',
                  isSelected ? option.color : 'text-foreground'
                )}>
                  {option.label}
                </div>
                <div className="text-xs text-muted-foreground">
                  {option.value === 'MALE' ? 'Male student' : 'Female student'}
                </div>
              </div>
              {isSelected && (
                <div className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full',
                  option.color,
                  option.bgColor
                )}>
                  <div className="h-2 w-2 rounded-full bg-current" />
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
  value?: Gender | string | null
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
        const Icon = option.icon
        const isSelected = value === option.value
        
        return (
          <div key={option.value} className="relative">
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
                'bg-background border-input',
                isSelected && option.selectedColor,
                isSelected && 'ring-2 ring-offset-2',
                disabled && 'cursor-not-allowed opacity-50',
                className
              )}
            >
              <Icon className={cn(
                'h-4 w-4',
                isSelected ? option.color : 'text-muted-foreground'
              )} />
              <span className={cn(
                'text-sm font-medium',
                isSelected ? option.color : 'text-foreground'
              )}>
                {option.label}
              </span>
            </Label>
          </div>
        )
      })}
    </RadioGroup>
  )
}
