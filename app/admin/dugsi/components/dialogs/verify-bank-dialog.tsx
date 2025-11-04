'use client'

import { useState, useTransition } from 'react'

import { useRouter } from 'next/navigation'

import { BadgeCheck, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { verifyDugsiBankAccount } from '../../actions'

interface VerifyBankDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  paymentIntentId: string
  parentEmail: string
}

export function VerifyBankDialog({
  open,
  onOpenChange,
  paymentIntentId,
  parentEmail,
}: VerifyBankDialogProps) {
  const router = useRouter()
  const [descriptorCode, setDescriptorCode] = useState('')
  const [isVerifying, startTransition] = useTransition()

  const handleVerify = async () => {
    if (!descriptorCode.trim()) {
      toast.error('Please enter the 6-digit verification code')
      return
    }

    startTransition(async () => {
      const result = await verifyDugsiBankAccount(
        paymentIntentId,
        descriptorCode
      )

      if (result.success) {
        toast.success('Bank account verified successfully!')
        onOpenChange(false)
        setDescriptorCode('')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to verify bank account')
      }
    })
  }

  const handleClose = () => {
    if (!isVerifying) {
      setDescriptorCode('')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <DialogTitle>Verify Bank Account</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Enter the 6-digit verification code that appears in the bank
            statement for <strong>{parentEmail}</strong>.
            <br />
            <span className="text-xs">
              The code starts with <strong>SM</strong> and appears as the
              company name in the $0.01 micro-deposit (e.g.,{' '}
              <strong>SMT86W</strong>).
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="descriptor-code">
              Verification Code
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="descriptor-code"
              placeholder="SMT86W"
              value={descriptorCode}
              onChange={(e) => setDescriptorCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="font-mono text-lg tracking-wider"
              disabled={isVerifying}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              6 characters starting with SM
            </p>
          </div>

          <div className="rounded-md bg-blue-50 p-3 text-xs dark:bg-blue-950">
            <div className="flex gap-2">
              <BadgeCheck className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="space-y-1">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  How to find the code:
                </p>
                <ol className="ml-4 list-decimal space-y-1 text-blue-700 dark:text-blue-300">
                  <li>Ask the family to check their bank statement</li>
                  <li>Look for a $0.01 deposit from your organization</li>
                  <li>
                    The 6-digit code appears at the start of the company name
                  </li>
                  <li>Enter the code exactly as shown</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isVerifying}
          >
            Cancel
          </Button>
          <Button
            onClick={handleVerify}
            disabled={isVerifying || descriptorCode.trim().length !== 6}
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify Bank Account'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
