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
import { Input } from '@/components/ui/input'
import { useShare } from '@/hooks/use-share'
import { cn } from '@/lib/utils'

import { createDonationAction } from '../actions'

const PRESET_AMOUNTS = [25000, 20000, 15000, 10000, 7500] as const

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`
}

function getButtonLabel(isPending: boolean, amountInCents: number): string {
  if (isPending) return 'Redirecting...'
  if (amountInCents < 100) return 'Donate Monthly'
  return `Donate ${formatCents(amountInCents)} / month`
}

export function DonationForm() {
  const [selectedPreset, setSelectedPreset] = useState<number | null>(15000)
  const [customAmount, setCustomAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { copied, handleShare } = useShare('/donate', {
    title: 'Donate to Irshad Center',
    text: 'Support Irshad Islamic Center with a monthly donation.',
  })

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
    const parts = cleaned.split('.')
    const sanitized =
      parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned
    setCustomAmount(sanitized)
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
        mode: 'subscription',
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
    <Card className="mx-auto w-full max-w-md rounded-2xl border-[#007078]/20 bg-white shadow-lg dark:border-[#007078]/40 dark:bg-gray-900">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl text-[#007078] dark:text-[#00a0a8]">
          Support Irshad Islamic Center
        </CardTitle>
        <CardDescription>
          Become a monthly supporter and help our community programs thrive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-2">
          {PRESET_AMOUNTS.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => handlePresetClick(amount)}
              className={cn(
                'rounded-lg border px-3 py-3 text-sm font-medium transition-colors',
                selectedPreset === amount
                  ? 'border-[#007078] bg-[#007078]/10 text-[#007078]'
                  : 'border-gray-200 hover:border-[#007078]/50 dark:border-gray-700'
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
                isCustomActive && 'border-[#007078] ring-1 ring-[#007078]'
              )}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          onClick={handleSubmit}
          disabled={isPending || amountInCents < 100}
          className="w-full rounded-xl bg-[#deb43e] text-white hover:bg-[#c9a438]"
          size="lg"
        >
          {getButtonLabel(isPending, amountInCents)}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handleShare}
          className="w-full rounded-xl border-[#007078]/30 text-[#007078] hover:bg-[#007078]/5"
          size="lg"
        >
          {copied ? 'Link copied!' : 'Share with family & friends'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Secure monthly subscription processed by Stripe. Cancel anytime.
        </p>
      </CardContent>
    </Card>
  )
}
