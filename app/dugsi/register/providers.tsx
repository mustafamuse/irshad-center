'use client'

import { AppErrorBoundary } from '@/components/error-boundary'
import { IntlProviderWrapper } from '@/components/intl-provider-wrapper'
import { LanguageProvider } from '@/contexts/language-context'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <LanguageProvider>
      <IntlProviderWrapper>
        <AppErrorBoundary context="Dugsi registration" variant="inline">
          {children}
        </AppErrorBoundary>
      </IntlProviderWrapper>
    </LanguageProvider>
  )
}
