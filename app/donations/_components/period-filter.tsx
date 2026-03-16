'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export type DonationPeriod = 'all' | 'today' | 'thisWeek' | 'thisMonth'

const periods: { value: DonationPeriod; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'today', label: 'Today' },
]

export function PeriodFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = (searchParams.get('period') as DonationPeriod) || 'all'

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
