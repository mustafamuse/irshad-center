import {
  createSearchParamsCache,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from 'nuqs/server'

const SORT_OPTIONS = ['name.asc', 'name.desc'] as const

const STATUS_OPTIONS = [
  'registered',
  'enrolled',
  'withdrawn',
  'on_leave',
  'completed',
] as const

export const paymentsSearchParamsCache = createSearchParamsCache({
  page: parseAsInteger.withDefault(1),
  per_page: parseAsInteger.withDefault(10),
  sort: parseAsStringLiteral(SORT_OPTIONS),
  studentName: parseAsString,
  batchId: parseAsString,
  status: parseAsStringLiteral(STATUS_OPTIONS),
  needsBilling: parseAsBoolean,
})
