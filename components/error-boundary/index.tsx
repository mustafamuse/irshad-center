'use client'

import { useRouter } from 'next/navigation'

import * as Sentry from '@sentry/nextjs'
import { AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type ErrorVariant = 'inline' | 'card' | 'fullscreen'

interface AppErrorBoundaryProps {
  children: React.ReactNode
  context?: string
  variant?: ErrorVariant
  fallbackUrl?: string
  fallbackLabel?: string
}

interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
  context: string
  variant: ErrorVariant
  fallbackUrl: string
  fallbackLabel: string
}

function detectErrorType(error: Error): 'database' | 'notFound' | 'generic' {
  if (error.constructor.name.includes('PrismaClient')) {
    return 'database'
  }

  if ('statusCode' in error) {
    const status = (error as { statusCode: number }).statusCode
    if (status === 404) return 'notFound'
    if (status >= 500) return 'database'
  }

  const message = error.message.toLowerCase()

  if (
    message.includes('prisma') ||
    message.includes('database') ||
    message.includes('connection') ||
    message.includes('timeout')
  ) {
    return 'database'
  }

  if (message.includes('not found') || message.includes('404')) {
    return 'notFound'
  }

  return 'generic'
}

function getSafeErrorMessage(error: Error): string {
  if (process.env.NODE_ENV === 'production') {
    return 'An unexpected error occurred. Please try again or contact support.'
  }
  return error.message
}

function getErrorContent(errorType: 'database' | 'notFound' | 'generic') {
  switch (errorType) {
    case 'database':
      return {
        title: 'Database Connection Error',
        description:
          "We couldn't connect to the database. This might be a temporary network issue. Please try again in a moment.",
      }
    case 'notFound':
      return {
        title: 'Not Found',
        description:
          "The resource you're looking for could not be found. It may have been removed or you may not have permission to access it.",
      }
    default:
      return {
        title: 'Something Went Wrong',
        description:
          "An unexpected error occurred while loading this content. The error has been logged and we're working to fix it.",
      }
  }
}

function InlineErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error
  resetErrorBoundary: () => void
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-lg border border-destructive/50 p-6"
    >
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle aria-hidden="true" className="h-4 w-4" />
        <h3 className="font-medium">Something went wrong</h3>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {getSafeErrorMessage(error)}
      </p>
      <Button variant="outline" onClick={resetErrorBoundary} className="mt-4">
        Try again
      </Button>
    </div>
  )
}

function CardErrorFallback({
  error,
  resetErrorBoundary,
  context,
  fallbackUrl,
  fallbackLabel,
}: Omit<ErrorFallbackProps, 'variant'>) {
  const router = useRouter()
  const errorType = detectErrorType(error)
  const { title, description } = getErrorContent(errorType)

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center"
    >
      <AlertCircle
        aria-hidden="true"
        className="mb-4 h-10 w-10 text-destructive"
      />

      <h3 className="mb-2 text-lg font-semibold text-destructive">{title}</h3>

      <p className="mb-4 max-w-md text-sm text-muted-foreground">
        {description}
      </p>

      <div className="flex gap-2">
        <Button onClick={resetErrorBoundary} size="sm">
          <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
          Try Again
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(fallbackUrl)}
        >
          {fallbackLabel}
        </Button>
      </div>

      {process.env.NODE_ENV === 'development' && (
        <details className="mt-6 max-w-2xl text-left">
          <summary className="cursor-pointer text-sm font-medium text-destructive">
            Error Details (Development Only)
          </summary>
          <div className="mt-2 rounded-md bg-muted p-3">
            <p className="text-xs text-muted-foreground">Context: {context}</p>
            <p className="mt-1 font-mono text-xs text-destructive">
              {error.message}
            </p>
            {error.stack && (
              <pre className="mt-2 max-h-40 overflow-auto text-xs text-muted-foreground">
                {error.stack}
              </pre>
            )}
          </div>
        </details>
      )}
    </div>
  )
}

function FullscreenErrorFallback({
  error,
  resetErrorBoundary,
  context,
  fallbackUrl,
  fallbackLabel,
}: Omit<ErrorFallbackProps, 'variant'>) {
  const router = useRouter()

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="container mx-auto flex min-h-screen items-center justify-center px-4 py-16"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle
              aria-hidden="true"
              className="h-6 w-6 text-destructive"
            />
          </div>
          <CardTitle className="text-center text-destructive">
            Something went wrong
          </CardTitle>
          <CardDescription className="text-center">
            An unexpected error occurred in the {context}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {getSafeErrorMessage(error)}
          </p>

          {process.env.NODE_ENV === 'development' && error.stack && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">
                Show technical details
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md border bg-muted p-2 text-xs">
                {error.stack}
              </pre>
            </details>
          )}

          <div className="flex justify-center gap-4">
            <Button onClick={resetErrorBoundary} variant="default">
              Try again
            </Button>
            <Button onClick={() => router.push(fallbackUrl)} variant="outline">
              {fallbackLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ErrorFallback(props: ErrorFallbackProps) {
  const { variant } = props

  switch (variant) {
    case 'inline':
      return (
        <InlineErrorFallback
          error={props.error}
          resetErrorBoundary={props.resetErrorBoundary}
        />
      )
    case 'fullscreen':
      return <FullscreenErrorFallback {...props} />
    case 'card':
    default:
      return <CardErrorFallback {...props} />
  }
}

export function AppErrorBoundary({
  children,
  context = 'application',
  variant = 'card',
  fallbackUrl = '/',
  fallbackLabel = 'Go home',
}: AppErrorBoundaryProps) {
  return (
    <ReactErrorBoundary
      FallbackComponent={(props) => (
        <ErrorFallback
          {...props}
          context={context}
          variant={variant}
          fallbackUrl={fallbackUrl}
          fallbackLabel={fallbackLabel}
        />
      )}
      onReset={() => {
        window.location.reload()
      }}
      onError={(error) => {
        console.error(`AppErrorBoundary caught error in ${context}:`, error)
        Sentry.captureException(error, {
          tags: { errorBoundary: context, variant },
        })
      }}
    >
      {children}
    </ReactErrorBoundary>
  )
}
