'use client'

import { useEffect, useState } from 'react'

import { NextIntlClientProvider } from 'next-intl'

import { useLanguage } from '@/contexts/language-context'

interface IntlProviderWrapperProps {
  children: React.ReactNode
}

export function IntlProviderWrapper({ children }: IntlProviderWrapperProps) {
  const { locale } = useLanguage()
  const [messages, setMessages] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    // Dynamically import the messages based on the current locale
    import(`@/messages/${locale}.json`)
      .then((module) => setMessages(module.default))
      .catch((error) => {
        console.error(`Failed to load messages for locale: ${locale}`, error)
        // Fallback to English
        import('@/messages/en.json').then((module) =>
          setMessages(module.default)
        )
      })
  }, [locale])

  if (!messages) {
    // Show nothing or a loading state while messages are being loaded
    return null
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
