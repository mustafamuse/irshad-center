import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import { Toaster } from 'sonner'

import { EnrollmentProvider } from '@/contexts/enrollment-context'
import { ThemeProvider } from '@/providers/theme-provider'

import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Irshād Mâhad - Islamic Education',
  description:
    'Comprehensive Islamic education and payment management system at Irshād Mâhad, Eden Prairie.',
  icons: {
    icon: [
      {
        url: '/images/Latest Irshad Mahad.png',
        type: 'image/png',
        sizes: '32x32',
      },
    ],
    apple: [
      {
        url: '/images/Latest Irshad Mahad.png',
        type: 'image/png',
        sizes: '180x180',
      },
    ],
  },
  openGraph: {
    title: 'Irshād Mâhad - Islamic Education',
    description:
      'Comprehensive Islamic education and payment management system at Irshād Mâhad, Eden Prairie.',
    images: [
      {
        url: '/images/Latest Irshad Mahad.png',
        width: 1200,
        height: 630,
        alt: 'Irshād Mâhad',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Irshād Mâhad - Islamic Education',
    description:
      'Comprehensive Islamic education and payment management system at Irshād Mâhad, Eden Prairie.',
    images: ['/images/Latest Irshad Mahad.png'],
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
            <EnrollmentProvider>{children}</EnrollmentProvider>
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
