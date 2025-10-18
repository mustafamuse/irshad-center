'use client'

import { UserPlus, X, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { type SearchResult } from '@/lib/registration/schemas/registration'
import { buttonClassNames } from '@/lib/registration/utils/form-utils'
import { cn } from '@/lib/utils'

interface SiblingManagementSectionProps {
  siblings: SearchResult[]
  onRemoveSibling: (siblingId: string) => void
  onAddSiblingClick: () => void
  onContinue: () => void
  isSubmitting: boolean
}

export function SiblingManagementSection({
  siblings,
  onRemoveSibling,
  onAddSiblingClick,
  onContinue,
  isSubmitting,
}: SiblingManagementSectionProps) {
  return (
    <Card className="rounded-2xl border-0 bg-white shadow-sm ring-1 ring-gray-200">
      <CardHeader className="space-y-2 border-b p-6">
        <CardTitle className="text-2xl font-semibold text-[#007078]">
          Sibling Registration
        </CardTitle>
        <CardDescription className="text-base text-gray-600">
          Add your siblings to complete the registration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h4 className="text-lg font-medium text-[#007078]">
              Siblings to Add
            </h4>
            <p className="text-sm text-gray-600">
              {siblings.length
                ? `${siblings.length} sibling${siblings.length > 1 ? 's' : ''} added`
                : 'No siblings added yet'}
            </p>
          </div>
          <Button
            variant="outline"
            size="lg"
            className="flex w-full items-center gap-2 rounded-full border-[#007078] text-[#007078] transition-colors hover:bg-[#007078]/10 sm:w-auto"
            onClick={onAddSiblingClick}
          >
            <UserPlus className="h-5 w-5" />
            Add a Sibling
          </Button>
        </div>

        {siblings.length > 0 && (
          <div className="rounded-xl bg-[#007078]/5">
            {siblings.map((sibling, index) => (
              <div
                key={sibling.id}
                className={cn(
                  'flex items-center justify-between p-4',
                  index !== siblings.length - 1 &&
                    'border-b border-[#007078]/10'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#deb43e]/10">
                    <span className="text-sm font-medium text-[#deb43e]">
                      {sibling.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-[#007078]">{sibling.name}</p>
                    <p className="text-sm text-gray-600">
                      Sibling #{index + 1}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className={buttonClassNames.ghost}
                  onClick={() => onRemoveSibling(sibling.id)}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remove sibling</span>
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4 pt-4">
          <Button
            onClick={onContinue}
            className={buttonClassNames.primary}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Continue to Payment'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
