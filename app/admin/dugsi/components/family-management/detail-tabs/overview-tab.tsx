'use client'

import { Fragment } from 'react'
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

interface ParentContactProps {
  parentNumber: 1 | 2
  name: string
  email: string | null
  phone: string | null
  isPrimaryPayer: boolean
  showSetAsPayer: boolean
  isSettingPayer: boolean
  onSetAsPayer: () => void
  onEdit: () => void
  onCopy: (text: string, label: string) => void
}

function ParentContact({
  parentNumber,
  name,
  email,
  phone,
  isPrimaryPayer,
  showSetAsPayer,
  isSettingPayer,
  onSetAsPayer,
  onEdit,
  onCopy,
}: ParentContactProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {parentNumber}
          </div>
          <span className="font-medium">{name}</span>
          {isPrimaryPayer && (
            <Badge variant="outline" className="text-xs">
              <Wallet className="mr-1 h-3 w-3" />
              Primary Payer
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {showSetAsPayer && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSetAsPayer}
              disabled={isSettingPayer}
              className="h-7 px-2 text-xs"
            >
              Set as Payer
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-7 px-2"
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {email && (
        <div className="ml-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <a
            href={`mailto:${email}`}
            className="truncate hover:text-[#007078] hover:underline"
          >
            {email}
          </a>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0"
            onClick={() => onCopy(email, 'Email address')}
            aria-label="Copy email address"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      )}
      {phone && (
        <div className="ml-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <a
            href={`https://wa.me/${phone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#007078] hover:underline"
          >
            {phone}
          </a>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0"
            onClick={() => onCopy(phone, 'Phone number')}
            aria-label="Copy phone number"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
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

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied to clipboard`)
    } catch (error) {
      toast.error(
        error instanceof Error && error.name === 'NotAllowedError'
          ? 'Clipboard access denied. Check browser permissions.'
          : 'Failed to copy to clipboard'
      )
    }
  }

  const handleSetPrimaryPayer = (parentNumber: 1 | 2) => {
    executeSetPrimaryPayer({ studentId: firstMember.id, parentNumber })
  }

  const hasParent2 = hasSecondParent(firstMember)

  const parents: Array<{
    parentNumber: 1 | 2
    name: string
    email: string | null
    phone: string | null
  }> = [
    {
      parentNumber: 1,
      name: formatParentName(firstMember.parentFirstName, firstMember.parentLastName),
      email: firstMember.parentEmail,
      phone: firstMember.parentPhone,
    },
  ]

  if (hasParent2) {
    parents.push({
      parentNumber: 2,
      name: formatParentName(firstMember.parent2FirstName, firstMember.parent2LastName),
      email: firstMember.parent2Email,
      phone: firstMember.parent2Phone,
    })

    if (firstMember.primaryPayerParentNumber === 2) {
      parents.reverse()
    }
  }

  const sortedChildren = [...family.members].sort((a, b) => {
    if (!a.dateOfBirth && !b.dateOfBirth) return 0
    if (!a.dateOfBirth) return 1
    if (!b.dateOfBirth) return -1
    return new Date(a.dateOfBirth).getTime() - new Date(b.dateOfBirth).getTime()
  })

  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-lg border bg-card p-5">
        <h3 className="text-base font-semibold">Contact Information</h3>
        <div className="space-y-4 pt-1">
          {parents.map((parent, i) => (
            <Fragment key={parent.parentNumber}>
              {i > 0 && <Separator />}
              <ParentContact
                parentNumber={parent.parentNumber}
                name={parent.name}
                email={parent.email}
                phone={parent.phone}
                isPrimaryPayer={firstMember.primaryPayerParentNumber === parent.parentNumber}
                showSetAsPayer={firstMember.primaryPayerParentNumber !== parent.parentNumber && hasParent2}
                isSettingPayer={isSettingPrimaryPayer}
                onSetAsPayer={() => handleSetPrimaryPayer(parent.parentNumber)}
                onEdit={() => onEditParent(parent.parentNumber, false)}
                onCopy={copyToClipboard}
              />
            </Fragment>
          ))}
          {!hasParent2 && (
            <>
              <Separator />
              <div className="flex items-center justify-center pt-2">
                <Button variant="ghost" size="sm" onClick={() => onEditParent(2, true)} className="h-8 px-3">
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                  Add Parent 2
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

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
          {sortedChildren.map((child, index) => (
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
