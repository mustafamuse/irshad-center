'use client'

import { Mail, Phone, Copy, Edit, UserPlus, Wallet } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

import { useActionHandler } from '../../../_hooks/use-action-handler'
import { Family, DugsiRegistration } from '../../../_types'
import { formatParentName, hasSecondParent } from '../../../_utils/format'
import { setPrimaryPayer } from '../../../actions'
import { ChildInfoCard } from '../../ui/child-info-card'

interface OverviewTabProps {
  family: Family
  firstMember: DugsiRegistration
  onEditParent: (parentNumber: 1 | 2, isAdding: boolean) => void
  onEditChild: (studentId: string) => void
  onAddChild: () => void
}

export function OverviewTab({
  family,
  firstMember,
  onEditParent,
  onEditChild,
  onAddChild,
}: OverviewTabProps) {
  const { execute: executeSetPrimaryPayer, isPending: isSettingPrimaryPayer } =
    useActionHandler(setPrimaryPayer)

  const copyToClipboardAsync = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied to clipboard`)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  const handleSetPrimaryPayer = (parentNumber: 1 | 2) => {
    executeSetPrimaryPayer({
      studentId: firstMember.id,
      parentNumber,
    })
  }

  return (
    <div className="space-y-5">
      {/* Contact Information */}
      <div className="space-y-4 rounded-lg border bg-card p-5">
        <h3 className="text-base font-semibold">Contact Information</h3>
        <div className="space-y-4 pt-1">
          {/* Parent 1 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  1
                </div>
                <span className="font-medium">
                  {formatParentName(
                    firstMember.parentFirstName,
                    firstMember.parentLastName
                  )}
                </span>
                {firstMember.primaryPayerParentNumber === 1 && (
                  <Badge variant="outline" className="text-xs">
                    <Wallet className="mr-1 h-3 w-3" />
                    Primary Payer
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {firstMember.primaryPayerParentNumber !== 1 &&
                  hasSecondParent(firstMember) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetPrimaryPayer(1)}
                      disabled={isSettingPrimaryPayer}
                      className="h-7 px-2 text-xs"
                    >
                      Set as Payer
                    </Button>
                  )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditParent(1, false)}
                  className="h-7 px-2"
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {firstMember.parentEmail && (
              <div className="ml-8 flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <a
                  href={`mailto:${firstMember.parentEmail}`}
                  className="truncate hover:text-[#007078] hover:underline"
                >
                  {firstMember.parentEmail}
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0"
                  onClick={() =>
                    firstMember.parentEmail &&
                    copyToClipboardAsync(
                      firstMember.parentEmail,
                      'Email address'
                    )
                  }
                  aria-label="Copy email address"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
            {firstMember.parentPhone && (
              <div className="ml-8 flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <a
                  href={`https://wa.me/${firstMember.parentPhone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#007078] hover:underline"
                >
                  {firstMember.parentPhone}
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0"
                  onClick={() =>
                    firstMember.parentPhone &&
                    copyToClipboardAsync(
                      firstMember.parentPhone,
                      'Phone number'
                    )
                  }
                  aria-label="Copy phone number"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Parent 2 */}
          {hasSecondParent(firstMember) ? (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      2
                    </div>
                    <span className="font-medium">
                      {formatParentName(
                        firstMember.parent2FirstName,
                        firstMember.parent2LastName
                      )}
                    </span>
                    {firstMember.primaryPayerParentNumber === 2 && (
                      <Badge variant="outline" className="text-xs">
                        <Wallet className="mr-1 h-3 w-3" />
                        Primary Payer
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {firstMember.primaryPayerParentNumber !== 2 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetPrimaryPayer(2)}
                        disabled={isSettingPrimaryPayer}
                        className="h-7 px-2 text-xs"
                      >
                        Set as Payer
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditParent(2, false)}
                      className="h-7 px-2"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {firstMember.parent2Email && (
                  <div className="ml-8 flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <a
                      href={`mailto:${firstMember.parent2Email}`}
                      className="truncate hover:text-[#007078] hover:underline"
                    >
                      {firstMember.parent2Email}
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0"
                      onClick={() =>
                        firstMember.parent2Email &&
                        copyToClipboardAsync(
                          firstMember.parent2Email,
                          'Email address'
                        )
                      }
                      aria-label="Copy email address"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {firstMember.parent2Phone && (
                  <div className="ml-8 flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <a
                      href={`https://wa.me/${firstMember.parent2Phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#007078] hover:underline"
                    >
                      {firstMember.parent2Phone}
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0"
                      onClick={() =>
                        firstMember.parent2Phone &&
                        copyToClipboardAsync(
                          firstMember.parent2Phone,
                          'Phone number'
                        )
                      }
                      aria-label="Copy phone number"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Separator />
              <div className="flex items-center justify-center pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditParent(2, true)}
                  className="h-8 px-3"
                >
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                  Add Parent 2
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Kids Details */}
      <div className="space-y-4 rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">
            Kids ({family.members.length})
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddChild}
            className="h-8 px-2 sm:px-3"
          >
            <UserPlus className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Add Child</span>
          </Button>
        </div>
        <div className="space-y-2.5 pt-1">
          {family.members.map((child, index) => (
            <ChildInfoCard
              key={child.id}
              child={child}
              index={index}
              editButton={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditChild(child.id)}
                  className="h-7 px-2"
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}
