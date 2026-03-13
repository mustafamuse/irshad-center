'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export type DonationPeriod = 'today' | 'yesterday' | 'thisWeek'

const periods: { value: DonationPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'thisWeek', label: 'This Week' },
]

export function PeriodFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = (searchParams.get('period') as DonationPeriod) || 'today'

  function handleSelect(period: DonationPeriod) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', period)
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex gap-2">
      {periods.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => handleSelect(value)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            current === value
              ? 'bg-[#007078] text-white'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
