'use client'

import { useState, useTransition } from 'react'

import { useRouter } from 'next/navigation'

import { CheckCircle, Loader2, XCircle } from 'lucide-react'
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

import { linkDugsiSubscription } from '../actions'

interface LinkSubscriptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parentEmail: string
  familyMembers: Array<{
    id: string
    name: string
  }>
}

export function LinkSubscriptionDialog({
  open,
  onOpenChange,
  parentEmail,
  familyMembers,
}: LinkSubscriptionDialogProps) {
  const router = useRouter()
  const [subscriptionId, setSubscriptionId] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [validationStatus, setValidationStatus] = useState<
    'idle' | 'valid' | 'invalid'
  >('idle')
  const [isLinking, startTransition] = useTransition()

  const handleValidate = async () => {
    if (!subscriptionId.startsWith('sub_')) {
      setValidationStatus('invalid')
      toast.error('Invalid subscription ID format')
      return
    }

    setIsValidating(true)
    // In a real implementation, you might want to validate against Stripe API
    // For now, we'll just check the format
    setTimeout(() => {
      setValidationStatus('valid')
      setIsValidating(false)
      toast.success('Subscription ID format is valid')
    }, 500)
  }

  const handleLink = async () => {
    if (!subscriptionId || validationStatus !== 'valid') {
      toast.error('Please validate the subscription ID first')
      return
    }

    startTransition(async () => {
      const result = await linkDugsiSubscription({
        parentEmail,
        subscriptionId,
      })

      if (result.success) {
        toast.success(result.message || 'Subscription linked successfully')
        onOpenChange(false)
        setSubscriptionId('')
        setValidationStatus('idle')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to link subscription')
      }
    })
  }

  const handleClose = () => {
    if (!isLinking) {
      onOpenChange(false)
      setSubscriptionId('')
      setValidationStatus('idle')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link Stripe Subscription</DialogTitle>
          <DialogDescription className="space-y-2 pt-2">
            <span>Link an existing Stripe subscription to this family.</span>
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium">Family Details:</p>
              <p className="mt-1 text-muted-foreground">
                Parent Email: {parentEmail}
              </p>
              <p className="text-muted-foreground">
                Children: {familyMembers.length} (
                {familyMembers.map((m) => m.name).join(', ')})
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="subscription-id">Stripe Subscription ID</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="subscription-id"
                  placeholder="sub_1234567890..."
                  value={subscriptionId}
                  onChange={(e) => {
                    setSubscriptionId(e.target.value)
                    setValidationStatus('idle')
                  }}
                  disabled={isLinking}
                  className="pr-10"
                />
                {validationStatus === 'valid' && (
                  <CheckCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-600" />
                )}
                {validationStatus === 'invalid' && (
                  <XCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-600" />
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleValidate}
                disabled={!subscriptionId || isValidating || isLinking}
              >
                {isValidating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Validate'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              You can find the subscription ID in your Stripe Dashboard. It
              starts with "sub_"
            </p>
          </div>

          {validationStatus === 'valid' && (
            <div className="rounded-lg border bg-green-50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-green-800">
                <CheckCircle className="h-4 w-4" />
                Subscription ID is valid
              </div>
              <p className="mt-1 text-xs text-green-700">
                This subscription will be linked to all {familyMembers.length}{' '}
                children in the family.
              </p>
            </div>
          )}

          {validationStatus === 'invalid' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-red-800">
                <XCircle className="h-4 w-4" />
                Invalid Subscription ID
              </div>
              <p className="mt-1 text-xs text-red-700">
                Please check the ID and try again. It should start with "sub_"
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLinking}
          >
            Cancel
          </Button>
          <Button
            onClick={handleLink}
            disabled={
              !subscriptionId || validationStatus !== 'valid' || isLinking
            }
          >
            {isLinking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Linking...
              </>
            ) : (
              'Link Subscription'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
