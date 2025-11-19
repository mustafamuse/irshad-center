'use client'

import { ChevronsUpDown, Search } from 'lucide-react'
import { useFormContext } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
// import { Student } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function ApplicantDetails() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
    // trigger,
    // clearErrors,
  } = useFormContext()

  // Watch form values
  const studentName = watch('studentName')
  const siblingCount = watch('siblingCount') || 0
  const monthlyRate = watch('monthlyRate') || 0
  const payer = watch('payer')

  // Handle student selection
  // const handleSelectStudent = async (student: Student) => {
  //   // Set student info
  //   setValue('studentName', student.name, {
  //     shouldValidate: true,
  //     shouldDirty: true,
  //   })
  //   clearErrors('studentName')

  //   // Set className instead of program
  //   setValue('className', student.className)

  //   // Set sibling info
  //   setValue('siblingCount', student.siblings ?? 0)
  //   setValue('monthlyRate', student.monthlyRate ?? 0)

  //   await trigger('studentName')
  // }

  return (
    <div className="space-y-6">
      {/* Student Name Selection */}
      <div>
        <Label className="mb-2 block">
          Select Your Name <span className="text-red-500">*</span>
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-between',
                errors.studentName && 'border-red-500'
              )}
            >
              {studentName ? studentName : 'Search for your name...'}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="max-h-64 w-full overflow-auto p-0"
          >
            <Command>
              <div className="flex items-center border-b px-3">
                <Search className="h-4 w-4 shrink-0 opacity-50" />
                <CommandInput
                  placeholder="Type a name to search..."
                  className="h-12 flex-1"
                />
              </div>
              <CommandEmpty>No student found.</CommandEmpty>
              <CommandGroup className="max-h-[300px] overflow-auto p-1">
                {/* {STUDENTS.map((student) => (
                  <CommandItem
                    key={student.id}
                    onSelect={() => handleSelectStudent(student)}
                    className="px-2 py-3 text-sm"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        studentName === student.name
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                    <span>{student.name}</span>
                  </CommandItem>
                ))} */}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
        {errors.studentName && (
          <p className="mt-1 text-sm text-red-600">
            {errors.studentName.message as string}
          </p>
        )}
      </div>

      {/* 2️⃣ Show Sibling/Family Info if applicable */}
      {studentName && siblingCount !== undefined && siblingCount > 0 && (
        <div className="rounded bg-muted p-4">
          <p>
            Keep in mind since you have <strong>{siblingCount}</strong> sibling
            {siblingCount !== 1 && 's'} enrolled,
            <br />
            The Mahad has provided a{' '}
            <strong>${150 - (monthlyRate ?? 0)}</strong> discount each month for
            each sibling.
          </p>
        </div>
      )}

      {/* Email */}
      <div>
        <Label htmlFor="email">
          Email <span className="text-red-500">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          {...register('email')}
          className={cn(errors.email && 'border-red-500')}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-500">
            {errors.email.message as string}
          </p>
        )}
      </div>

      {/* Phone */}
      <div>
        <Label htmlFor="phone">
          Phone Number <span className="text-red-500">*</span>
        </Label>
        <Input
          id="phone"
          type="tel"
          {...register('phone')}
          className={cn(errors.phone && 'border-red-500')}
        />
        {errors.phone && (
          <p className="mt-1 text-sm text-red-500">
            {errors.phone.message as string}
          </p>
        )}
      </div>

      {/* Payer Information */}
      <div className="space-y-4">
        <Label>
          Who will be paying for the program?{' '}
          <span className="text-red-500">*</span>
        </Label>
        <RadioGroup onValueChange={(value) => setValue('payer', value)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="self" id="self" />
            <Label htmlFor="self">Self</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="relative" id="relative" />
            <Label htmlFor="relative">Relative</Label>
          </div>
        </RadioGroup>
        {errors.payer && (
          <p className="mt-1 text-sm text-red-500">
            {errors.payer.message as string}
          </p>
        )}
      </div>

      {/* Conditional Payer Fields */}
      {payer === 'relative' && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="payerRelation">
              Relation to Student <span className="text-red-500">*</span>
            </Label>
            <Input
              id="payerRelation"
              {...register('payerRelation')}
              className={cn(errors.payerRelation && 'border-red-500')}
            />
            {errors.payerRelation && (
              <p className="mt-1 text-sm text-red-500">
                {errors.payerRelation.message as string}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="payerName">
              Payer's Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="payerName"
              {...register('payerName')}
              className={cn(errors.payerName && 'border-red-500')}
            />
            {errors.payerName && (
              <p className="mt-1 text-sm text-red-500">
                {errors.payerName.message as string}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="payerPhone">
              Payer's Phone Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="payerPhone"
              type="tel"
              {...register('payerPhone')}
              className={cn(errors.payerPhone && 'border-red-500')}
            />
            {errors.payerPhone && (
              <p className="mt-1 text-sm text-red-500">
                {errors.payerPhone.message as string}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
