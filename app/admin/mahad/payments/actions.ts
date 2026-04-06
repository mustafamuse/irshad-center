'use server'

import { getBatchDropdownOptions } from '@/lib/db/queries/batch'
import { adminActionClient } from '@/lib/safe-action'

export const getBatchesForFilter = adminActionClient
  .metadata({ actionName: 'getBatchesForFilter' })
  .action(async () => {
    return await getBatchDropdownOptions()
  })
