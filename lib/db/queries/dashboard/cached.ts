/**
 * Cached Dashboard Queries
 *
 * Server-side caching wrappers using Next.js unstable_cache.
 * Caches dashboard data for 60 seconds to reduce database load.
 *
 * Cache invalidation:
 * - Use revalidateTag('teachers') after teacher mutations
 */

import { unstable_cache } from 'next/cache'

import { Shift, Program } from '@prisma/client'

import { getDugsiDashboardRaw } from './dugsi-raw'
import { getMahadDashboardRaw } from './mahad-raw'
import { getTeachersDashboardRaw } from './teachers-raw'

export const getCachedDugsiDashboard = unstable_cache(
  async (filters?: { shift?: Shift }) => getDugsiDashboardRaw(filters),
  ['dugsi-dashboard'],
  { revalidate: 60, tags: ['dugsi'] }
)

export const getCachedMahadDashboard = unstable_cache(
  async () => getMahadDashboardRaw(),
  ['mahad-dashboard'],
  { revalidate: 60, tags: ['mahad'] }
)

export const getCachedTeachersDashboard = unstable_cache(
  async (program: Program) => getTeachersDashboardRaw(program),
  ['teachers-dashboard'],
  { revalidate: 60, tags: ['teachers'] }
)
