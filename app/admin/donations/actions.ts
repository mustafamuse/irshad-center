'use server'

import { getDonations, getDonationStats } from '@/lib/db/queries/donation'
import { type ActionResult, withActionError } from '@/lib/utils/action-helpers'

export async function fetchDonations(options: {
  page?: number
  pageSize?: number
  status?: string
  isRecurring?: boolean
}) {
  return withActionError(
    () => getDonations(options),
    'Failed to fetch donations'
  )
}

export async function fetchDonationStats(): Promise<
  ActionResult<Awaited<ReturnType<typeof getDonationStats>>>
> {
  return withActionError(
    () => getDonationStats(),
    'Failed to fetch donation stats'
  )
}
