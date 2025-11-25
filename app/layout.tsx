import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import { Toaster } from 'sonner'

import { ThemeProvider } from '@/providers/theme-provider'

import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://irshadcenter.com'),
  title: 'Irshād Mâhad - Islamic Studies & Arabic Institute',
  description:
    "Accredited two-year Islamic education program in English at Eden Prairie. Study Qur'an, Fiqh, Hadith, and Arabic from distinguished Sheikhs and Islamic university graduates",
  icons: {
    icon: [
      {
        url: '/images/Mosque.svg',
        type: 'image/svg+xml',
        sizes: '32x32',
      },
    ],
    apple: [
      {
        url: '/images/Mosque.svg',
        type: 'image/svg+xml',
        sizes: '180x180',
      },
    ],
  },
  openGraph: {
    title: 'Irshād Mâhad - Islamic Studies & Arabic Institute',
    description:
      "Accredited two-year Islamic education program in English at Eden Prairie. Study Qur'an, Fiqh, Hadith, and Arabic from distinguished Sheikhs and Islamic university graduates",
    images: [
      {
        url: '/images/Mosque.svg',
        width: 1200,
        height: 630,
        alt: 'Irshād Center',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Irshād Mâhad - Islamic Studies & Arabic Institute',
    description:
      "Accredited two-year Islamic education program in English at Eden Prairie. Study Qur'an, Fiqh, Hadith, and Arabic from distinguished Sheikhs and Islamic university graduates",
    images: ['/images/Mosque.svg'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1"
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={true}
            disableTransitionOnChange={false}
          >
            {children}
            {/* #region agent log */}
            {typeof window !== 'undefined' &&
              (() => {
                fetch(
                  'http://127.0.0.1:7242/ingest/dd387a56-ba45-49fb-a265-e15472772648',
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      location: 'layout.tsx:75',
                      message: 'Root layout rendering Toaster',
                      data: { position: 'top-right' },
                      timestamp: Date.now(),
                      sessionId: 'debug-session',
                      runId: 'run1',
                      hypothesisId: 'A',
                    }),
                  }
                ).catch(() => {})
                return null
              })()}
            {/* #endregion */}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  border: '1px solid hsl(var(--border))',
                },
              }}
            />
          </ThemeProvider>
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
