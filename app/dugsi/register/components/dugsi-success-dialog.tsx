'use client'

import {
  Calendar,
  CheckCircle2,
  GraduationCap,
  Mail,
  MessageCircle,
  Phone,
  School,
  Sparkles,
  User,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import type { DugsiRegistrationValues } from '@/lib/registration/schemas/registration'
import {
  formatEducationLevel,
  formatGradeLevel,
} from '@/lib/utils/enum-formatters'

interface DugsiSuccessDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  data: DugsiRegistrationValues | null
}

export function DugsiSuccessDialog({
  isOpen,
  onOpenChange,
  data,
}: DugsiSuccessDialogProps) {
  // Don't render if data is null
  if (!data) {
    return null
  }

  const handleWhatsApp = () => {
    const text = generateSummaryText(data)
    const encodedText = encodeURIComponent(text)
    // Send directly to Sh Nuur's WhatsApp: +1 (952) 855-2101
    window.open(`https://wa.me/19528552101?text=${encodedText}`, '_blank')
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] w-[calc(100vw-2rem)] max-w-lg gap-0 overflow-hidden border-0 p-0 sm:max-w-2xl sm:rounded-2xl">
        {/* Success Header - Fixed at top */}
        <div className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="flex flex-col items-center gap-4 p-6 pb-5">
            {/* Success Icon */}
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/50">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>

            {/* Title */}
            <DialogHeader className="space-y-2 text-center">
              <DialogTitle className="flex items-center justify-center gap-2 text-2xl font-semibold tracking-tight">
                <Sparkles className="h-5 w-5 text-emerald-600" />
                Registration Complete
              </DialogTitle>
              <DialogDescription className="text-base text-muted-foreground">
                Successfully enrolled{' '}
                <span className="font-medium text-foreground">
                  {data.children.length}{' '}
                  {data.children.length === 1 ? 'child' : 'children'}
                </span>
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="max-h-[calc(95vh-280px)] space-y-6 overflow-y-auto p-6 sm:max-h-[calc(95vh-240px)]">
          {/* Parent Information Card */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Parent Information</span>
            </div>

            <div className="space-y-3 rounded-lg border bg-card p-4">
              {/* Parent 1 */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    1
                  </div>
                  <span className="font-semibold text-foreground">
                    {data.parent1FirstName} {data.parent1LastName}
                  </span>
                </div>
                <div className="ml-8 space-y-1.5 text-sm text-foreground/80">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{data.parent1Email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{data.parent1Phone}</span>
                  </div>
                </div>
              </div>

              {/* Parent 2 */}
              {!data.isSingleParent && (
                <>
                  <Separator />
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        2
                      </div>
                      <span className="font-semibold text-foreground">
                        {data.parent2FirstName} {data.parent2LastName}
                      </span>
                    </div>
                    <div className="ml-8 space-y-1.5 text-sm text-foreground/80">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{data.parent2Email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>{data.parent2Phone}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Children Cards */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <GraduationCap className="h-4 w-4" />
              <span>
                Enrolled {data.children.length === 1 ? 'Child' : 'Children'}
              </span>
            </div>

            <div className="space-y-3">
              {data.children.map((child, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
                >
                  {/* Child Header */}
                  <div className="flex items-center gap-3 border-b bg-muted/30 p-4">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate font-semibold">
                        {child.firstName} {child.lastName}
                      </h4>
                      <div className="flex items-center gap-2">
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(child.dateOfBirth)}
                        </p>
                        {child.gender && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            {child.gender === 'MALE' ? (
                              <>
                                <User className="h-3 w-3 text-blue-500" />
                                <span>Boy</span>
                              </>
                            ) : (
                              <>
                                <User className="h-3 w-3 text-pink-500" />
                                <span>Girl</span>
                              </>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Child Details */}
                  <div className="space-y-3 p-4">
                    <div className="flex items-start gap-2">
                      <School className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          School
                        </p>
                        <p className="truncate text-sm font-medium">
                          {child.schoolName}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Level
                        </p>
                        <p className="mt-0.5 text-sm font-medium">
                          {formatEducationLevel(child.educationLevel)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Grade
                        </p>
                        <p className="mt-0.5 text-sm font-medium">
                          {formatGradeLevel(child.gradeLevel)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Next Steps Card */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <MessageCircle className="h-4 w-4" />
              <span>Next Step</span>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    1
                  </div>
                  <p className="flex-1 text-sm leading-relaxed text-blue-950 dark:text-blue-50">
                    Tap <span className="font-semibold">"Send to Sh Nuur"</span>{' '}
                    button below
                  </p>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    2
                  </div>
                  <p className="flex-1 text-sm leading-relaxed text-blue-950 dark:text-blue-50">
                    WhatsApp will open - tap the{' '}
                    <span className="font-semibold">Send button</span> to send
                    your registration
                  </p>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                    ✓
                  </div>
                  <p className="flex-1 text-sm font-medium leading-relaxed text-emerald-950 dark:text-emerald-50">
                    Enrollment confirmed!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className="sticky bottom-0 z-10 border-t bg-white/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:p-6">
          <Button
            onClick={handleWhatsApp}
            size="lg"
            className="w-full touch-manipulation bg-[#25D366] hover:bg-[#20BA5A] active:scale-[0.98]"
          >
            <MessageCircle className="mr-2 h-5 w-5" />
            Send to Sh Nuur
          </Button>

          <Button
            onClick={() => onOpenChange(false)}
            variant="ghost"
            size="lg"
            className="mt-2 w-full touch-manipulation active:scale-[0.98]"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function formatDate(date: Date | string): string {
  if (!date) return 'N/A'
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function generateSummaryText(data: DugsiRegistrationValues): string {
  const children = data.children
    .map(
      (child, idx) =>
        `Child ${idx + 1}: ${child.firstName} ${child.lastName}
    - DOB: ${formatDate(child.dateOfBirth)}
    - School: ${child.schoolName}
    - Level: ${formatEducationLevel(child.educationLevel)}
    - Grade: ${formatGradeLevel(child.gradeLevel)}`
    )
    .join('\n')

  return `🎓 Dugsi Registration Confirmation

Parent Information:
Name: ${data.parent1FirstName} ${data.parent1LastName}
Email: ${data.parent1Email}
Phone: ${data.parent1Phone}
${
  !data.isSingleParent
    ? `
Parent 2:
Name: ${data.parent2FirstName} ${data.parent2LastName}
Email: ${data.parent2Email}
Phone: ${data.parent2Phone}`
    : ''
}

${children}

Please share this information with your teacher to confirm enrollment.`
}
