'use client'

import { useState } from 'react'

import { formatCurrency } from '@/lib/utils/formatters'

interface ZakatFitrStatsProps {
  totalCollectedCents: number
  paymentCount: number
  totalPeopleCovered: number
}

export function ZakatFitrStats({
  totalCollectedCents,
  paymentCount,
  totalPeopleCovered,
}: ZakatFitrStatsProps) {
  const [open, setOpen] = useState(false)

  if (paymentCount === 0 && !open) return null

  return (
    <div className="mt-8 text-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-muted-foreground/40 transition-colors hover:text-muted-foreground/70"
      >
        {open ? 'Hide stats' : 'View collection stats'}
      </button>
      {open && (
        <div className="mt-3 rounded-lg border border-muted/30 bg-gray-50/50 px-4 py-3 text-sm text-muted-foreground">
          <div className="flex justify-center gap-6">
            <div>
              <p className="text-lg font-semibold text-foreground">
                {formatCurrency(totalCollectedCents)}
              </p>
              <p className="text-xs">collected</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                {paymentCount}
              </p>
              <p className="text-xs">payments</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                {totalPeopleCovered}
              </p>
              <p className="text-xs">people covered</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
