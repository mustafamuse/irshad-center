'use client'

import { useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  XCircle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { formatRate } from '@/lib/utils/dugsi-tuition'

import { useActionHandler } from '../../_hooks/use-action-handler'
import {
  consolidateSubscriptionSchema,
  type ConsolidateSubscriptionFormValues,
} from '../../_schemas/dialog-schemas'
import {
  previewStripeSubscriptionForConsolidation,
  consolidateDugsiSubscription,
} from '../../actions'

interface PreviewData {
  subscriptionId: string
  customerId: string
  status: string
  amount: number
  interval: string
  periodStart: Date
  periodEnd: Date
  stripeCustomerName: string | null
  stripeCustomerEmail: string | null
  dbPayerName: string
  dbPayerEmail: string | null
  dbPayerPhone: string | null
  hasMismatch: boolean
  nameMismatch: boolean
  emailMismatch: boolean
  existingFamilyId: string | null
  existingFamilyName: string | null
  isAlreadyLinked: boolean
}

interface ConsolidateSubscriptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  familyId: string
  familyName: string
}

export function ConsolidateSubscriptionDialog({
  open,
  onOpenChange,
  familyId,
  familyName,
}: ConsolidateSubscriptionDialogProps) {
  const [step, setStep] = useState<'input' | 'preview'>('input')
  const [isValidating, setIsValidating] = useState(false)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [syncOption, setSyncOption] = useState<'sync' | 'keep'>('sync')
  const [forceOverrideConfirmed, setForceOverrideConfirmed] = useState(false)

  const form = useForm<ConsolidateSubscriptionFormValues>({
    resolver: zodResolver(consolidateSubscriptionSchema),
    defaultValues: {
      stripeSubscriptionId: '',
    },
  })

  const { execute: executeConsolidate, isPending: isConsolidating } =
    useActionHandler(consolidateDugsiSubscription, {
      successMessage: 'Subscription consolidated successfully',
      onSuccess: () => {
        handleClose()
      },
    })

  const handleValidate = async (data: ConsolidateSubscriptionFormValues) => {
    setIsValidating(true)
    try {
      const result = await previewStripeSubscriptionForConsolidation(
        data.stripeSubscriptionId,
        familyId
      )

      if (result.success && result.data) {
        setPreview(result.data)
        setStep('preview')
        setSyncOption(result.data.hasMismatch ? 'sync' : 'keep')
        setForceOverrideConfirmed(false)
      } else {
        toast.error(result.error || 'Failed to validate subscription')
      }
    } catch {
      toast.error('Failed to validate subscription')
    } finally {
      setIsValidating(false)
    }
  }

  const handleConsolidate = async () => {
    if (!preview) return

    if (preview.isAlreadyLinked && !forceOverrideConfirmed) {
      toast.error(
        'Please acknowledge moving the subscription from the other family'
      )
      return
    }

    await executeConsolidate({
      stripeSubscriptionId: preview.subscriptionId,
      familyId,
      syncStripeCustomer: syncOption === 'sync',
      forceOverride: preview.isAlreadyLinked
        ? forceOverrideConfirmed
        : undefined,
    })
  }

  const handleClose = () => {
    if (!isConsolidating) {
      onOpenChange(false)
      setStep('input')
      setPreview(null)
      setSyncOption('sync')
      setForceOverrideConfirmed(false)
      form.reset()
    }
  }

  const handleBack = () => {
    setStep('input')
    setPreview(null)
    setSyncOption('sync')
    setForceOverrideConfirmed(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link Stripe Subscription</DialogTitle>
          <DialogDescription className="pt-2">
            Link an existing Stripe subscription to the {familyName} family.
            This will create billing records and update Stripe metadata.
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleValidate)}
              className="space-y-4"
            >
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium">Target Family:</p>
                <p className="mt-1 text-muted-foreground">{familyName}</p>
              </div>

              <FormField
                control={form.control}
                name="stripeSubscriptionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stripe Subscription ID</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="sub_1234567890..."
                          {...field}
                          disabled={isValidating}
                          className="pr-10"
                        />
                        {form.formState.isSubmitSuccessful && preview && (
                          <CheckCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-600" />
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Find this in your Stripe Dashboard. Starts with "sub_"
                    </p>
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isValidating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isValidating}>
                  {isValidating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      Validate
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-4">
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Subscription Status</span>
                <Badge
                  variant={
                    preview.status === 'active' ? 'default' : 'secondary'
                  }
                >
                  {preview.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">
                  {formatRate(preview.amount)}/{preview.interval}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Period</span>
                <span>
                  {new Date(preview.periodStart).toLocaleDateString()} -{' '}
                  {new Date(preview.periodEnd).toLocaleDateString()}
                </span>
              </div>
            </div>

            {preview.isAlreadyLinked && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Subscription Already Linked</AlertTitle>
                <AlertDescription>
                  This subscription is currently linked to{' '}
                  <strong>{preview.existingFamilyName}</strong>. Proceeding will
                  move it to {familyName}.
                </AlertDescription>
                <div className="mt-3 flex items-center space-x-2">
                  <Checkbox
                    id="forceOverride"
                    checked={forceOverrideConfirmed}
                    onCheckedChange={(checked) =>
                      setForceOverrideConfirmed(checked === true)
                    }
                  />
                  <label
                    htmlFor="forceOverride"
                    className="text-sm font-medium leading-none"
                  >
                    I understand and want to move this subscription
                  </label>
                </div>
              </Alert>
            )}

            {preview.hasMismatch && (
              <>
                <Alert
                  variant="default"
                  className="border-yellow-200 bg-yellow-50"
                >
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-800">
                    Customer Details Mismatch
                  </AlertTitle>
                  <AlertDescription className="text-yellow-700">
                    The Stripe customer details differ from the database.
                  </AlertDescription>
                </Alert>

                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          Field
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Stripe
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Database
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        className={preview.nameMismatch ? 'bg-yellow-50' : ''}
                      >
                        <td className="px-3 py-2 text-muted-foreground">
                          Name
                        </td>
                        <td className="px-3 py-2">
                          {preview.stripeCustomerName || '(none)'}
                          {preview.nameMismatch && (
                            <XCircle className="ml-1 inline h-3 w-3 text-yellow-600" />
                          )}
                        </td>
                        <td className="px-3 py-2">{preview.dbPayerName}</td>
                      </tr>
                      <tr
                        className={preview.emailMismatch ? 'bg-yellow-50' : ''}
                      >
                        <td className="px-3 py-2 text-muted-foreground">
                          Email
                        </td>
                        <td className="px-3 py-2">
                          {preview.stripeCustomerEmail || '(none)'}
                          {preview.emailMismatch && (
                            <XCircle className="ml-1 inline h-3 w-3 text-yellow-600" />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {preview.dbPayerEmail || '(none)'}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-muted-foreground">
                          Phone
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">-</td>
                        <td className="px-3 py-2">
                          {preview.dbPayerPhone || '(none)'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    How should we handle the mismatch?
                  </Label>
                  <RadioGroup
                    value={syncOption}
                    onValueChange={(v) => setSyncOption(v as 'sync' | 'keep')}
                  >
                    <div className="flex items-start space-x-3 rounded-lg border p-3">
                      <RadioGroupItem
                        value="sync"
                        id="sync"
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor="sync"
                          className="cursor-pointer font-medium"
                        >
                          <RefreshCw className="mr-1.5 inline h-3.5 w-3.5" />
                          Update Stripe to match database (Recommended)
                        </Label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Stripe customer name and email will be updated to
                          match the primary payer in the database.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 rounded-lg border p-3">
                      <RadioGroupItem
                        value="keep"
                        id="keep"
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor="keep"
                          className="cursor-pointer font-medium"
                        >
                          Keep Stripe customer as-is
                        </Label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Only link the subscription without updating customer
                          details in Stripe.
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              </>
            )}

            {!preview.hasMismatch && !preview.isAlreadyLinked && (
              <div className="rounded-lg border bg-green-50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  Ready to link
                </div>
                <p className="mt-1 text-xs text-green-700">
                  Stripe customer details match the database. The subscription
                  will be linked and metadata will be updated.
                </p>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={isConsolidating}
              >
                Back
              </Button>
              <Button
                onClick={handleConsolidate}
                disabled={
                  isConsolidating ||
                  (preview.isAlreadyLinked && !forceOverrideConfirmed)
                }
              >
                {isConsolidating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Linking...
                  </>
                ) : (
                  'Link Subscription'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
