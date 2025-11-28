'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'

interface SubmissionSuccessProps {
  onReset: () => void
}

export function SubmissionSuccess({ onReset }: SubmissionSuccessProps) {
  return (
    <div className="container mx-auto px-4 py-16">
      <Card className="mx-auto w-full max-w-2xl border-green-100 bg-white shadow-lg">
        <CardHeader className="space-y-6 border-b border-green-100 pb-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div className="space-y-2 text-center">
            <CardTitle className="text-2xl font-bold text-green-600">
              Application Submitted Successfully
            </CardTitle>
            <CardDescription className="text-lg text-gray-600">
              Thank you for applying for the scholarship program
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-8 p-8">
          <div className="rounded-lg bg-green-50/50 p-6">
            <div className="space-y-4">
              <p className="text-gray-700">
                Your application has been received and will be reviewed by the
                Mahad.
              </p>
              <div className="mt-6 rounded-md bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-gray-900">Next Steps:</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-600">
                  <li>Application review by the Mahad Office</li>
                  <li>Evaluation of financial need and circumstances</li>
                  <li>Decision notification via email/in-person</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-600">
              If you have any questions, please contact the Mahad Office
              directly
            </p>
            <Button
              variant="outline"
              className="mt-4 border-green-200 hover:bg-green-50 hover:text-green-600"
              onClick={onReset}
            >
              Submit Another Application
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
