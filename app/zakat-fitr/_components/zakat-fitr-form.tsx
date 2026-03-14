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
import { useShare } from '@/hooks/use-share'
import {
  MAX_FAMILY_SIZE,
  ZAKAT_FITR_PER_PERSON_CENTS,
  calculateStripeFee,
} from '@/lib/validations/zakat-fitr'

import { createZakatFitrAction } from '../actions'

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function ZakatFitrForm() {
  const [selectedCount, setSelectedCount] = useState<number>(1)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { copied, handleShare } = useShare('/zakat-fitr', {
    title: 'Zakat al-Fitr — Irshad Center',
    text: 'Pay your Zakat al-Fitr — $13 per person.',
  })

  const baseCents = selectedCount * ZAKAT_FITR_PER_PERSON_CENTS
  const { totalCents } = calculateStripeFee(baseCents)

  function handleSubmit() {
    setError(null)

    startTransition(async () => {
      const result = await createZakatFitrAction({
        numberOfPeople: selectedCount,
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

  return (
    <Card className="mx-auto w-full max-w-md rounded-2xl border-[#007078]/20 bg-white shadow-lg dark:border-[#007078]/40 dark:bg-gray-900">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl text-[#007078] dark:text-[#00a0a8]">
          Zakat al-Fitr
        </CardTitle>
        <CardDescription>
          Select the number of people in your household
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={() => {
              setSelectedCount((c) => Math.max(1, c - 1))
              setError(null)
            }}
            disabled={selectedCount <= 1}
            aria-label="Decrease household size"
            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#007078] text-2xl font-bold text-[#007078] transition-colors hover:bg-[#007078]/10 disabled:border-gray-300 disabled:text-gray-300"
          >
            -
          </button>
          <div className="text-center">
            <p className="text-5xl font-bold text-[#007078]">{selectedCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedCount === 1 ? 'person' : 'people'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedCount((c) => Math.min(MAX_FAMILY_SIZE, c + 1))
              setError(null)
            }}
            disabled={selectedCount >= MAX_FAMILY_SIZE}
            aria-label="Increase household size"
            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#007078] text-2xl font-bold text-[#007078] transition-colors hover:bg-[#007078]/10 disabled:border-gray-300 disabled:text-gray-300"
          >
            +
          </button>
        </div>

        <div className="rounded-lg bg-gray-50 p-4 text-center dark:bg-gray-800">
          <p className="text-2xl font-semibold text-foreground">
            {formatDollars(totalCents)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedCount} {selectedCount === 1 ? 'person' : 'people'} x{' '}
            {formatDollars(ZAKAT_FITR_PER_PERSON_CENTS)} + small processing fee
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          onClick={handleSubmit}
          disabled={isPending}
          className="w-full rounded-xl bg-[#deb43e] text-white hover:bg-[#c9a438]"
          size="lg"
        >
          {isPending ? 'Redirecting...' : `Pay ${formatDollars(totalCents)}`}
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
          Secure one-time payment processed by Stripe.
        </p>
      </CardContent>
    </Card>
  )
}
