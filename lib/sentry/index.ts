import * as Sentry from '@sentry/nextjs'
import type { Span } from '@sentry/nextjs'

export function startSpan<T>(
  name: string,
  op: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return Sentry.startSpan({ name, op }, fn)
}

export function startServiceSpan<T>(
  serviceName: string,
  operation: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    { name: `${serviceName}.${operation}`, op: 'service' },
    fn
  )
}

export function startDbSpan<T>(
  queryName: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return Sentry.startSpan({ name: queryName, op: 'db.query' }, fn)
}

export function startExternalSpan<T>(
  service: string,
  operation: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    { name: `${service}.${operation}`, op: 'http.client' },
    fn
  )
}
