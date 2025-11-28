'use client'

import { useFormContext } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import { HIGH_SCHOOL_YEARS, COLLEGE_YEARS } from '../../_schemas'

export default function FinancialAssessment() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext()

  const educationStatus = watch('educationStatus')
  const qualifiesForFafsa = watch('qualifiesForFafsa')
  const livesWithBothParents = watch('livesWithBothParents')
  const isEmployed = watch('isEmployed')

  return (
    <div className="space-y-6">
      {/* Education Status */}
      <div>
        <Label htmlFor="educationStatus">
          Current Education Status <span className="text-red-500">*</span>
        </Label>
        <Select
          onValueChange={(value) => setValue('educationStatus', value)}
          defaultValue={educationStatus}
        >
          <SelectTrigger
            id="educationStatus"
            className={cn(errors.educationStatus && 'border-red-500')}
          >
            <SelectValue placeholder="Select your education status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="highschool">High School Student</SelectItem>
            <SelectItem value="college">College Student</SelectItem>
            <SelectItem value="not-studying">Not Currently Studying</SelectItem>
          </SelectContent>
        </Select>
        {errors.educationStatus && (
          <p className="mt-1 text-sm text-red-500">
            {errors.educationStatus.message as string}
          </p>
        )}
      </div>

      {/* High School Fields */}
      {educationStatus === 'highschool' && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="schoolName">
              High School Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="schoolName"
              {...register('schoolName')}
              className={cn(errors.schoolName && 'border-red-500')}
            />
            {errors.schoolName && (
              <p className="mt-1 text-sm text-red-500">
                {errors.schoolName.message as string}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="schoolYear">
              Current Grade <span className="text-red-500">*</span>
            </Label>
            <Select
              onValueChange={(value) => setValue('schoolYear', value)}
              defaultValue={watch('schoolYear')}
            >
              <SelectTrigger
                id="schoolYear"
                className={cn(errors.schoolYear && 'border-red-500')}
              >
                <SelectValue placeholder="Select your grade" />
              </SelectTrigger>
              <SelectContent>
                {HIGH_SCHOOL_YEARS.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.schoolYear && (
              <p className="mt-1 text-sm text-red-500">
                {errors.schoolYear.message as string}
              </p>
            )}
          </div>
        </div>
      )}

      {/* College Fields */}
      {educationStatus === 'college' && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="collegeName">
              College Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="collegeName"
              {...register('collegeName')}
              className={cn(errors.collegeName && 'border-red-500')}
            />
            {errors.collegeName && (
              <p className="mt-1 text-sm text-red-500">
                {errors.collegeName.message as string}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="collegeYear">
              Current Year <span className="text-red-500">*</span>
            </Label>
            <Select
              onValueChange={(value) => setValue('collegeYear', value)}
              defaultValue={watch('collegeYear')}
            >
              <SelectTrigger
                id="collegeYear"
                className={cn(errors.collegeYear && 'border-red-500')}
              >
                <SelectValue placeholder="Select your year" />
              </SelectTrigger>
              <SelectContent>
                {COLLEGE_YEARS.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.collegeYear && (
              <p className="mt-1 text-sm text-red-500">
                {errors.collegeYear.message as string}
              </p>
            )}
          </div>

          {/* FAFSA Question */}
          <div className="space-y-4">
            <Label>
              Do you qualify for FAFSA? <span className="text-red-500">*</span>
            </Label>
            <RadioGroup
              defaultValue={qualifiesForFafsa}
              onValueChange={(value) => setValue('qualifiesForFafsa', value)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="fafsa-yes" />
                <Label htmlFor="fafsa-yes">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="fafsa-no" />
                <Label htmlFor="fafsa-no">No</Label>
              </div>
            </RadioGroup>
            {errors.qualifiesForFafsa && (
              <p className="mt-1 text-sm text-red-500">
                {errors.qualifiesForFafsa.message as string}
              </p>
            )}
          </div>

          {/* FAFSA Explanation */}
          {qualifiesForFafsa === 'no' && (
            <div>
              <Label htmlFor="fafsaExplanation">
                Please explain why you don't qualify for FAFSA{' '}
                <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="fafsaExplanation"
                {...register('fafsaExplanation')}
                className={cn(errors.fafsaExplanation && 'border-red-500')}
              />
              {errors.fafsaExplanation && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.fafsaExplanation.message as string}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Household Information */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="householdSize">
            Total Household Size <span className="text-red-500">*</span>
          </Label>
          <Input
            id="householdSize"
            type="number"
            min="1"
            {...register('householdSize')}
            className={cn(errors.householdSize && 'border-red-500')}
          />
          {errors.householdSize && (
            <p className="mt-1 text-sm text-red-500">
              {errors.householdSize.message as string}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="dependents">
            Number of Dependents <span className="text-red-500">*</span>
          </Label>
          <Input
            id="dependents"
            type="number"
            min="0"
            {...register('dependents')}
            className={cn(errors.dependents && 'border-red-500')}
          />
          {errors.dependents && (
            <p className="mt-1 text-sm text-red-500">
              {errors.dependents.message as string}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="adultsInHousehold">
            Number of Adults in Household{' '}
            <span className="text-red-500">*</span>
          </Label>
          <Input
            id="adultsInHousehold"
            type="number"
            min="1"
            {...register('adultsInHousehold')}
            className={cn(errors.adultsInHousehold && 'border-red-500')}
          />
          {errors.adultsInHousehold && (
            <p className="mt-1 text-sm text-red-500">
              {errors.adultsInHousehold.message as string}
            </p>
          )}
        </div>
      </div>

      {/* Living Situation */}
      <div className="space-y-4">
        <Label>
          Do you live with both parents? <span className="text-red-500">*</span>
        </Label>
        <RadioGroup
          defaultValue={livesWithBothParents}
          onValueChange={(value) => setValue('livesWithBothParents', value)}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="yes" id="parents-yes" />
            <Label htmlFor="parents-yes">Yes</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="no" id="parents-no" />
            <Label htmlFor="parents-no">No</Label>
          </div>
        </RadioGroup>
        {errors.livesWithBothParents && (
          <p className="mt-1 text-sm text-red-500">
            {errors.livesWithBothParents.message as string}
          </p>
        )}

        {livesWithBothParents === 'no' && (
          <div>
            <Label htmlFor="livingExplanation">
              Please explain your living situation{' '}
              <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="livingExplanation"
              {...register('livingExplanation')}
              className={cn(errors.livingExplanation && 'border-red-500')}
            />
            {errors.livingExplanation && (
              <p className="mt-1 text-sm text-red-500">
                {errors.livingExplanation.message as string}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Employment Status */}
      <div className="space-y-4">
        <Label>
          Are you currently employed? <span className="text-red-500">*</span>
        </Label>
        <RadioGroup
          defaultValue={isEmployed}
          onValueChange={(value) => setValue('isEmployed', value)}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="yes" id="employed-yes" />
            <Label htmlFor="employed-yes">Yes</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="no" id="employed-no" />
            <Label htmlFor="employed-no">No</Label>
          </div>
        </RadioGroup>
        {errors.isEmployed && (
          <p className="mt-1 text-sm text-red-500">
            {errors.isEmployed.message as string}
          </p>
        )}

        {isEmployed === 'yes' && (
          <div>
            <Label htmlFor="monthlyIncome">
              Monthly Income <span className="text-red-500">*</span>
            </Label>
            <Input
              id="monthlyIncome"
              type="number"
              min="0"
              step="0.01"
              {...register('monthlyIncome', { valueAsNumber: true })}
              className={cn(errors.monthlyIncome && 'border-red-500')}
            />
            {errors.monthlyIncome && (
              <p className="mt-1 text-sm text-red-500">
                {errors.monthlyIncome.message as string}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
