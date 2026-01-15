'use client'

import { GraduationCap, ChevronRight, Mail, Phone } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

import { MahadStudent, PaymentHealth } from '../../_types'
import { calculatePaymentHealth } from '../../_utils/grouping'

interface MobileStudentCardProps {
  student: MahadStudent
  isSelected: boolean
  onSelect: () => void
  onClick: () => void
}

function getPaymentHealthConfig(health: PaymentHealth) {
  const configs: Record<PaymentHealth, { className: string; label: string }> = {
    needs_action: {
      className: 'bg-red-100 text-red-800 border-red-200',
      label: 'Needs Action',
    },
    at_risk: {
      className: 'bg-amber-100 text-amber-800 border-amber-200',
      label: 'At Risk',
    },
    healthy: {
      className: 'bg-green-100 text-green-800 border-green-200',
      label: 'Healthy',
    },
    exempt: {
      className: 'bg-slate-100 text-slate-800 border-slate-200',
      label: 'Exempt',
    },
    pending: {
      className: 'bg-blue-100 text-blue-800 border-blue-200',
      label: 'Pending',
    },
    inactive: {
      className: 'bg-gray-100 text-gray-600 border-gray-200',
      label: 'Inactive',
    },
  }
  return configs[health]
}

export function MobileStudentCard({
  student,
  isSelected,
  onSelect,
  onClick,
}: MobileStudentCardProps) {
  const paymentHealth = calculatePaymentHealth(student)
  const healthConfig = getPaymentHealthConfig(paymentHealth)

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:bg-muted/50',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelect()}
            onClick={(e) => e.stopPropagation()}
            className="mt-1"
            aria-label="Select student"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold">{student.name}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {student.batch && (
                    <Badge
                      variant="secondary"
                      className="gap-1 whitespace-nowrap px-1.5 text-xs"
                    >
                      <GraduationCap className="h-3 w-3 shrink-0" />
                      {student.batch.name}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  className={`${healthConfig.className} flex-shrink-0 px-2 py-1 text-xs font-medium`}
                >
                  {healthConfig.label}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="mt-3 space-y-1.5 rounded-lg bg-muted/50 p-2">
              {student.email ? (
                <div className="flex items-center space-x-2">
                  <Mail className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">
                    {student.email}
                  </span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Mail className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50" />
                  <span className="text-sm italic text-muted-foreground">
                    No email
                  </span>
                </div>
              )}
              {student.phone ? (
                <div className="flex items-center space-x-2">
                  <Phone className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium">{student.phone}</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Phone className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50" />
                  <span className="text-sm italic text-muted-foreground">
                    No phone
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
