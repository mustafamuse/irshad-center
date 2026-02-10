import type { SubscriptionStatus } from '@prisma/client'

export const STATUS_COLORS: Record<SubscriptionStatus | 'none', string> = {
  active: '#22c55e',
  canceled: '#ef4444',
  past_due: '#f97316',
  incomplete: '#eab308',
  trialing: '#3b82f6',
  unpaid: '#b91c1c',
  paused: '#6b7280',
  incomplete_expired: '#9ca3af',
  none: '#cbd5e1',
}

export const STATUS_LABELS: Record<SubscriptionStatus | 'none', string> = {
  active: 'Active',
  canceled: 'Canceled',
  past_due: 'Past Due',
  incomplete: 'Incomplete',
  trialing: 'Trialing',
  unpaid: 'Unpaid',
  paused: 'Paused',
  incomplete_expired: 'Incomplete Expired',
  none: 'None',
}

export const STATUS_TAILWIND_BG: Record<SubscriptionStatus | 'none', string> = {
  active: 'bg-green-500',
  trialing: 'bg-blue-500',
  past_due: 'bg-orange-500',
  incomplete: 'bg-yellow-500',
  canceled: 'bg-red-500',
  unpaid: 'bg-red-700',
  paused: 'bg-gray-500',
  incomplete_expired: 'bg-gray-400',
  none: 'bg-slate-300',
}
