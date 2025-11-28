'use client'

import { useFormContext } from 'react-hook-form'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const terms = [
  {
    title: 'Mandatory Contribution',
    content: [
      'I understand that all students are required to contribute financially toward their education. Scholarships are intended to provide temporary assistance, not to cover the full cost of tuition or fees.',
      'I acknowledge that the scholarship amount, if granted, will be based on demonstrated financial need and the availability of funds.',
    ],
  },
  {
    title: 'Temporary and Limited Assistance',
    content: [
      'Scholarships are awarded on a temporary basis and are subject to review and renewal at the beginning of each semester or as specified.',
      'I understand that scholarships are limited and awarded on a case-by-case basis, taking into account financial need, academic performance, and other relevant factors.',
    ],
  },
  {
    title: 'Eligibility and Continuation Requirements',
    content: [
      'I must maintain satisfactory academic progress, defined as a grade of C or above, to remain eligible for financial assistance.',
      'I must demonstrate consistent attendance. Scholarships may be revoked if I accrue four or more unexcused absences during a semester.',
    ],
  },
  {
    title: 'Reevaluation and Reporting',
    content: [
      'I agree to provide accurate and truthful information about my financial situation, including supporting documentation (e.g., pay stubs, bank statements) as required.',
      'I understand that I am required to report any significant changes in my financial circumstances (e.g., gaining employment, increased income) immediately, which may affect my eligibility for continued assistance.',
    ],
  },
  {
    title: 'Non-Transferable and Non-Guaranteed',
    content: [
      'I acknowledge that financial assistance is non-transferable and not guaranteed. Each application is independently assessed, and approval is contingent upon the availability of scholarship funds.',
    ],
  },
  {
    title: 'Payment Plans',
    content: [
      'If offered an extended payment plan, I agree to adhere to the agreed-upon schedule. Late or missed payments may result in the forfeiture of financial assistance and/or additional penalties.',
    ],
  },
  {
    title: 'Responsibility for Full Tuition',
    content: [
      'I understand that receiving a scholarship does not absolve me of my responsibility to pay the remaining portion of my tuition and fees.',
      'I acknowledge that failure to pay my share of tuition as agreed upon may result in suspension from the program.',
    ],
  },
  {
    title: 'Finality of Decisions',
    content: [
      'I accept that all scholarship decisions made by the program administration are final.',
    ],
  },
  {
    title: 'Code of Conduct',
    content: [
      "I commit to upholding the program's standards, policies, and values. Any behavior that is deemed inappropriate or in violation of the program's code of conduct may result in the termination of my scholarship.",
    ],
  },
  {
    title: 'Program Participation',
    content: [
      'I understand that my participation in the program requires ongoing effort, dedication, and active engagement in all coursework and activities.',
    ],
  },
]

export default function AcknowledgementAgreement() {
  const {
    setValue,
    watch,
    formState: { errors, touchedFields },
  } = useFormContext()

  const termsAgreed = watch('termsAgreed')

  return (
    <div className="space-y-6">
      <h2 className="mb-4 text-center text-2xl font-bold">
        Terms and Agreement
      </h2>
      <ScrollArea className="h-[400px] rounded-md border p-4">
        <div className="space-y-8">
          {terms.map((term, index) => (
            <div key={index} className="space-y-2">
              <h3 className="text-lg font-semibold text-primary">
                {term.title}
              </h3>
              <ul className="list-disc space-y-1 pl-5">
                {term.content.map((item, itemIndex) => (
                  <li key={itemIndex} className="text-sm text-muted-foreground">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </ScrollArea>
      <p className="text-sm italic text-muted-foreground">
        By checking the box below, I confirm that I have read, understood, and
        agree to abide by the terms and conditions outlined above.
      </p>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="termsAgreed"
          checked={termsAgreed}
          onCheckedChange={(checked) => {
            setValue('termsAgreed', checked === true, {
              shouldTouch: true,
            })
          }}
          className={cn(
            errors.termsAgreed && touchedFields.termsAgreed && 'border-red-500'
          )}
        />
        <Label htmlFor="termsAgreed" className="font-medium">
          I agree to the terms and conditions
        </Label>
      </div>
      {errors.termsAgreed && touchedFields.termsAgreed && (
        <p className="mt-1 text-sm text-red-500">
          {errors.termsAgreed.message as string}
        </p>
      )}
    </div>
  )
}
