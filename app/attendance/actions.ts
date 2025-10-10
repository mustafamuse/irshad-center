'use server'

import { selfCheckIn as adminSelfCheckIn } from '../admin/attendance/actions'

// Re-export the selfCheckIn action from admin attendance actions
export async function selfCheckIn(
  input: Parameters<typeof adminSelfCheckIn>[0]
) {
  return adminSelfCheckIn(input)
}
