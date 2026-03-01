'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import { createDonationAction } from '../actions'

const PRESET_AMOUNTS = [1000, 2500, 5000, 10000, 25000] as const

const MODE_OPTIONS = [
  { value: 'payment', label: 'One-time' },
  { value: 'subscription', label: 'Monthly' },
] as const

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`
}

function getButtonLabel(
  isPending: boolean,
  amountInCents: number,
  mode: 'payment' | 'subscription'
): string {
  if (isPending) return 'Redirecting...'
  if (amountInCents < 100) return 'Donate'

  const amount = formatCents(amountInCents)
  return mode === 'subscription'
    ? `Donate ${amount} / month`
    : `Donate ${amount}`
}

export function DonationForm() {
  const [mode, setMode] = useState<'payment' | 'subscription'>('payment')
  const [selectedPreset, setSelectedPreset] = useState<number | null>(5000)
  const [customAmount, setCustomAmount] = useState('')
  const [donorName, setDonorName] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const parsedCustom = customAmount ? parseFloat(customAmount) : 0
  const amountInCents =
    selectedPreset ??
    (Number.isFinite(parsedCustom) ? Math.round(parsedCustom * 100) : 0)

  function handlePresetClick(amount: number) {
    setSelectedPreset(amount)
    setCustomAmount('')
    setError(null)
  }

  function handleCustomAmountChange(value: string) {
    const cleaned = value.replace(/[^0-9.]/g, '')
    setCustomAmount(cleaned)
    setSelectedPreset(null)
    setError(null)
  }

  function handleSubmit() {
    if (amountInCents < 100) {
      setError('Minimum donation is $1')
      return
    }
    if (amountInCents > 10_000_000) {
      setError('Maximum donation is $100,000')
      return
    }

    setError(null)

    startTransition(async () => {
      const result = await createDonationAction({
        amount: amountInCents,
        mode,
        donorName: isAnonymous ? undefined : donorName || undefined,
        isAnonymous,
      })

      if (!result.success) {
        setError(result.error ?? 'Something went wrong')
        return
      }

      if (result.data?.url) {
        window.location.href = result.data.url
      } else {
        setError('Unable to start checkout. Please try again.')
      }
    })
  }

  const isCustomActive = !selectedPreset && customAmount

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Support Irshad Center</CardTitle>
        <CardDescription>
          Your donation helps our community programs thrive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex rounded-lg border p-1">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              className={cn(
                'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                mode === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {PRESET_AMOUNTS.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => handlePresetClick(amount)}
              className={cn(
                'rounded-lg border px-3 py-3 text-sm font-medium transition-colors',
                selectedPreset === amount
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {formatCents(amount)}
            </button>
          ))}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Other"
              value={customAmount}
              onChange={(e) => handleCustomAmountChange(e.target.value)}
              className={cn(
                'h-full pl-7',
                isCustomActive && 'border-primary ring-1 ring-primary'
              )}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="donorName">Name (optional)</Label>
            <Input
              id="donorName"
              placeholder="Your name"
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
              disabled={isAnonymous}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="anonymous"
              checked={isAnonymous}
              onCheckedChange={(checked) => setIsAnonymous(checked === true)}
            />
            <Label htmlFor="anonymous" className="text-sm font-normal">
              Make my donation anonymous
            </Label>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          onClick={handleSubmit}
          disabled={isPending || amountInCents < 100}
          className="w-full"
          size="lg"
        >
          {getButtonLabel(isPending, amountInCents, mode)}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Secure payment processed by Stripe
        </p>
      </CardContent>
    </Card>
  )
}
