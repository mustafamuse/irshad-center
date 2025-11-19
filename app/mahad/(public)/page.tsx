import Link from 'next/link'

import { Metadata } from 'next'

import { AnnouncementSection } from './_components/announcements'
import { PaymentBanner } from './_components/banner'
import { ContactSection } from './_components/contact'
import SemesterCountdown from './_components/countdown'
import { HomeHero } from './_components/hero'
import { MobileNav } from './_components/nav'
import { ScrollHandler } from './_components/scroll-handler'
import { Testimonials } from './_components/testimonials'

export const metadata: Metadata = {
  title: 'Irshād Mâhad - Islamic Studies & Arabic Institute',
  description:
    "Accredited two-year Islamic education program in English at Eden Prairie. Study Qur'an, Fiqh, Hadith, and Arabic from distinguished Sheikhs and Islamic university graduates",
}

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <ScrollHandler />
      <PaymentBanner />
      <MobileNav />
      <SemesterCountdown />

      <main className="flex-1">
        <HomeHero />
        <AnnouncementSection />
        <Testimonials />
        <ContactSection />
      </main>

      <footer className="border-t py-8 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 px-4 md:h-24 md:flex-row">
          <p className="text-center text-sm leading-relaxed text-muted-foreground md:text-left">
            © 2025 Irshād Mâhad. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/mahad/terms"
              className="text-sm text-muted-foreground hover:text-primary"
            >
              Terms
            </Link>
            <Link
              href="/mahad/privacy"
              className="text-sm text-muted-foreground hover:text-primary"
            >
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
