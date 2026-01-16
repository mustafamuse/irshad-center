import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import { Toaster } from 'sonner'

import { ThemeProvider } from '@/providers/theme-provider'

import { Providers } from './providers'
import './globals.css'

const siteDescription =
  'Islamic education, worship, and community center in Eden Prairie, Minnesota. Offering Mahad (Islamic Studies), Dugsi (Youth Quran Program), daily prayers, Jummah services, and youth activities.'

export const metadata: Metadata = {
  metadataBase: new URL('https://irshadcenter.com'),
  title: {
    default: 'Irshad Islamic Center | Eden Prairie, MN',
    template: '%s | Irshad Islamic Center',
  },
  description: siteDescription,
  keywords: [
    'Islamic center',
    'mosque',
    'Eden Prairie',
    'Minnesota',
    'Quran',
    'Islamic education',
    'Jummah',
    'Friday prayer',
    'prayer times',
    'Mahad',
    'Dugsi',
    'Muslim community',
    'Islamic studies',
    'Arabic',
  ],
  authors: [{ name: 'Irshad Islamic Center' }],
  creator: 'Irshad Islamic Center',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
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
    type: 'website',
    locale: 'en_US',
    url: 'https://irshadcenter.com',
    siteName: 'Irshad Islamic Center',
    title: 'Irshad Islamic Center | Eden Prairie, MN',
    description: siteDescription,
    images: [
      {
        url: '/images/Mosque.svg',
        width: 1200,
        height: 630,
        alt: 'Irshad Islamic Center',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Irshad Islamic Center | Eden Prairie, MN',
    description: siteDescription,
    images: ['/images/Mosque.svg'],
  },
  alternates: {
    canonical: 'https://irshadcenter.com',
  },
  other: {
    'geo.region': 'US-MN',
    'geo.placename': 'Eden Prairie',
    'geo.position': '44.8547;-93.4708',
    ICBM: '44.8547, -93.4708',
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Mosque',
                  '@id': 'https://irshadcenter.com/#organization',
                  name: 'Irshad Islamic Center',
                  url: 'https://irshadcenter.com',
                  logo: 'https://irshadcenter.com/images/Mosque.svg',
                  description: siteDescription,
                  address: {
                    '@type': 'PostalAddress',
                    streetAddress: '6520 Edenvale Blvd #110',
                    addressLocality: 'Eden Prairie',
                    addressRegion: 'MN',
                    postalCode: '55346',
                    addressCountry: 'US',
                  },
                  geo: {
                    '@type': 'GeoCoordinates',
                    latitude: 44.8547,
                    longitude: -93.4708,
                  },
                  email: 'info@irshadcenter.com',
                  telephone: '(952) 681-7785',
                  sameAs: ['https://www.instagram.com/irshadislamiccenter/'],
                },
                {
                  '@type': 'EducationalOrganization',
                  '@id': 'https://irshadcenter.com/#education',
                  name: 'Irshad Islamic Center',
                  url: 'https://irshadcenter.com',
                  description:
                    'Islamic education programs including Mahad (Islamic Studies) and Dugsi (Youth Quran Program)',
                  address: {
                    '@type': 'PostalAddress',
                    streetAddress: '6520 Edenvale Blvd #110',
                    addressLocality: 'Eden Prairie',
                    addressRegion: 'MN',
                    postalCode: '55346',
                    addressCountry: 'US',
                  },
                  makesOffer: [
                    {
                      '@type': 'Offer',
                      itemOffered: {
                        '@type': 'EducationalOccupationalProgram',
                        name: 'Irshad Mahad',
                        description: 'Islamic Studies Program for adults',
                      },
                    },
                    {
                      '@type': 'Offer',
                      itemOffered: {
                        '@type': 'EducationalOccupationalProgram',
                        name: 'Irshad Dugsi',
                        description: 'Youth Islamic Learning Program',
                      },
                    },
                  ],
                },
              ],
            }),
          }}
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
