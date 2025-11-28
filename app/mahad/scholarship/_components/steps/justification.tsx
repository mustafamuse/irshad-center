'use client'

import { useFormContext } from 'react-hook-form'

import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export default function ScholarshipJustification() {
  const {
    register,
    formState: { errors },
    setValue,
  } = useFormContext()

  const handleInputChange =
    (field: string) => (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(field, e.target.value, {
        shouldValidate: true,
        shouldDirty: true,
      })
    }

  return (
    <div className="space-y-8">
      {/* Need Justification */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="needJustification" className="mb-2 block">
            Why do you need this scholarship?{' '}
            <span className="text-red-500">*</span>
          </Label>
          <p className="mb-2 text-sm text-muted-foreground">
            Please explain your financial need and circumstances that make this
            scholarship necessary for your education.
          </p>
          <Textarea
            id="needJustification"
            {...register('needJustification')}
            onChange={handleInputChange('needJustification')}
            rows={5}
            placeholder="Describe your financial need..."
            className={cn(errors.needJustification && 'border-red-500')}
          />
          {errors.needJustification && (
            <p className="mt-1 text-sm text-red-500">
              {errors.needJustification.message as string}
            </p>
          )}
        </div>
      </div>

      <Separator />

      {/* Goals and Support */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="goalSupport" className="mb-2 block">
            How will this scholarship support your educational goals?{' '}
            <span className="text-red-500">*</span>
          </Label>
          <p className="mb-2 text-sm text-muted-foreground">
            Explain how this scholarship will help you achieve your educational
            and career objectives.
          </p>
          <Textarea
            id="goalSupport"
            {...register('goalSupport')}
            rows={5}
            placeholder="Describe how this scholarship will help you..."
            className={cn(errors.goalSupport && 'border-red-500')}
          />
          {errors.goalSupport && (
            <p className="mt-1 text-sm text-red-500">
              {errors.goalSupport.message as string}
            </p>
          )}
        </div>
      </div>

      <Separator />

      {/* Commitment */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="commitment" className="mb-2 block">
            What is your commitment to completing the program?{' '}
            <span className="text-red-500">*</span>
          </Label>
          <p className="mb-2 text-sm text-muted-foreground">
            Describe your dedication to completing the program and how you plan
            to maintain good academic standing.
          </p>
          <Textarea
            id="commitment"
            {...register('commitment')}
            rows={5}
            placeholder="Describe your commitment..."
            className={cn(errors.commitment && 'border-red-500')}
          />
          {errors.commitment && (
            <p className="mt-1 text-sm text-red-500">
              {errors.commitment.message as string}
            </p>
          )}
        </div>
      </div>

      <Separator />

      {/* Additional Information */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="additionalInfo" className="mb-2 block">
            Additional Information{' '}
            <span className="text-muted-foreground">(Optional)</span>
          </Label>
          <p className="mb-2 text-sm text-muted-foreground">
            Is there anything else you would like us to know about your
            situation?
          </p>
          <Textarea
            id="additionalInfo"
            {...register('additionalInfo')}
            rows={4}
            placeholder="Any additional information..."
            className={cn(errors.additionalInfo && 'border-red-500')}
          />
          {errors.additionalInfo && (
            <p className="mt-1 text-sm text-red-500">
              {errors.additionalInfo.message as string}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
